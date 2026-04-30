import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Info,
  Pencil,
  History,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ScoreBar } from "@/components/ui/score-bar";
import { formatDate, cn } from "@/lib/utils";
import type {
  VurderingAnbefaling,
  Forbedring,
  RodtFlagg,
} from "@/types/database";
import { finnFelt } from "@/types/ekspress-felter";
import { VurderPaaNyttKnapp } from "./vurder-paa-nytt-knapp";
import { FeedbackPanel } from "@/components/soknad/feedback-panel";
import { SeksjonFeedback } from "@/components/soknad/seksjon-feedback";
import type { Feedback } from "@/types/database";

export const dynamic = "force-dynamic";

const ANBEFALING_META: Record<
  VurderingAnbefaling,
  { etikett: string; klasser: string; ikon: typeof CheckCircle2 }
> = {
  klar_til_innsending: {
    etikett: "Klar til innsending",
    klasser: "border-good bg-good-soft text-green-900",
    ikon: CheckCircle2,
  },
  bor_forbedres: {
    etikett: "Bør forbedres",
    klasser: "border-warning bg-warning-soft text-warning",
    ikon: Info,
  },
  trenger_arbeid: {
    etikett: "Trenger arbeid",
    klasser: "border-warning bg-warning-soft text-warning",
    ikon: AlertTriangle,
  },
  vesentlige_mangler: {
    etikett: "Vesentlige mangler",
    klasser: "border-cp-red bg-cp-red-soft text-cp-red",
    ikon: AlertTriangle,
  },
};

export default async function VurderingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { id: soknadId } = await params;
  const { v: valgtVersjonStr } = await searchParams;
  const supabase = await createClient();

  // Hent søknaden + alle vurderinger
  const { data: soknad } = await supabase
    .from("soknader")
    .select("id, tittel, program, status, owner_id")
    .eq("id", soknadId)
    .single();

  if (!soknad) notFound();

  const { data: alleVurderinger } = await supabase
    .from("vurderinger")
    .select("*")
    .eq("soknad_id", soknadId)
    .order("versjon", { ascending: false });

  // Velg versjon: ?v=N hvis spesifisert, ellers nyeste
  const valgtVersjon = valgtVersjonStr ? parseInt(valgtVersjonStr, 10) : null;
  const vurdering =
    (valgtVersjon !== null
      ? alleVurderinger?.find((vu) => vu.versjon === valgtVersjon)
      : alleVurderinger?.[0]) ?? null;

  if (!vurdering) {
    return (
      <div className="px-10 py-10 max-w-[860px]">
        <Link
          href={`/soknader/${soknadId}`}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-4 hover:text-ink-1 mb-4"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Tilbake til søknaden
        </Link>
        <h1 className="text-[28px] font-bold tracking-tight text-ink-1 mb-3">
          Ingen vurdering ennå
        </h1>
        <p className="text-[13.5px] text-ink-4 mb-6">
          Denne søknaden har ikke blitt vurdert ennå. Klikk &laquo;Vurder
          søknad&raquo; på søknadsskjemaet eller på detaljsiden for å starte.
        </p>
        <VurderPaaNyttKnapp soknadId={soknadId} />
      </div>
    );
  }

  const meta = ANBEFALING_META[vurdering.anbefaling as VurderingAnbefaling];
  const AnbefalingIkon = meta.ikon;

  // Defensiv Array.isArray — hvis JSONB-feltet skulle være feil format
  // krasjer vi ikke hele siden.
  const forbedringer: Forbedring[] = Array.isArray(vurdering.forbedringer)
    ? (vurdering.forbedringer as Forbedring[])
    : [];
  const rodeFlagg: RodtFlagg[] = Array.isArray(vurdering.rode_flagg)
    ? (vurdering.rode_flagg as RodtFlagg[])
    : [];

  // Hent eventuell feedback fra innlogget bruker + sjekk rolle
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profil } = user
    ? await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
    : { data: null };
  const kanSpisse = profil?.role === "admin" || profil?.role === "utvikler";

  const { data: alleFeedback } = user
    ? await supabase
        .from("feedback")
        .select("*")
        .eq("vurdering_id", vurdering.id)
        .eq("bruker_id", user.id)
    : { data: null };

  const feedbackPerSeksjon = new Map<string, Feedback>();
  let minGenerellFeedback: Feedback | null = null;
  for (const f of (alleFeedback ?? []) as Feedback[]) {
    if (f.target_section) {
      feedbackPerSeksjon.set(f.target_section, f);
    } else if (f.type === "tommel_opp" || f.type === "tommel_ned") {
      minGenerellFeedback = f;
    }
  }

  return (
    <div className="px-10 py-10 max-w-[860px]">
      <Link
        href={`/soknader/${soknadId}`}
        className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-4 hover:text-ink-1 mb-4"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Tilbake til søknaden
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-ink-4 mb-2">
            Vurdering v{vurdering.versjon} · {formatDate(vurdering.created_at)}
          </p>
          <h1 className="text-[28px] font-bold tracking-tight text-ink-1">
            {soknad.tittel || "Uten navn"}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/soknader/${soknadId}/rediger`}
            className="inline-flex items-center gap-2 rounded-md border border-line-1 bg-white px-3 py-2 text-[13px] font-medium text-ink-2 hover:bg-bg-sunk transition"
          >
            <Pencil className="h-4 w-4" />
            Rediger søknad
          </Link>
          <VurderPaaNyttKnapp soknadId={soknadId} />
        </div>
      </div>

      {/* Versjon-historikk */}
      {alleVurderinger && alleVurderinger.length > 1 && (
        <div className="mb-6 rounded-md border border-line-1 bg-bg-card p-3 flex items-center gap-3 overflow-x-auto">
          <History className="h-4 w-4 text-ink-4 shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-4 shrink-0">
            Versjoner
          </span>
          <div className="flex items-center gap-1.5">
            {alleVurderinger.map((vu) => {
              const aktiv = vu.versjon === vurdering.versjon;
              return (
                <Link
                  key={vu.id}
                  href={`/soknader/${soknadId}/vurdering?v=${vu.versjon}`}
                  className={cn(
                    "inline-flex items-baseline gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition",
                    aktiv
                      ? "bg-cp-blue text-white"
                      : "border border-line-1 text-ink-2 hover:bg-bg-sunk",
                  )}
                  title={`Vurdert ${formatDate(vu.created_at)}`}
                >
                  v{vu.versjon}
                  <span
                    className={cn(
                      "tabular text-[11px]",
                      aktiv ? "text-white/80" : "text-ink-4",
                    )}
                  >
                    {vu.snitt_score?.toFixed(1)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Anbefaling */}
      <div
        className={`rounded-[14px] border-2 px-6 py-5 mb-6 flex items-start gap-4 ${meta.klasser}`}
      >
        <AnbefalingIkon className="h-6 w-6 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-80 mb-1">
            Samlet anbefaling
          </p>
          <h2 className="text-[24px] font-bold tracking-tight mb-1">
            {meta.etikett}
          </h2>
          <div className="flex items-baseline gap-3 mb-3">
            <span className="text-[13px] opacity-80">Snitt:</span>
            <span className="text-[20px] font-semibold tabular">
              {vurdering.snitt_score?.toFixed(2)} / 7
            </span>
          </div>
          {extractSamletBegrunnelse(vurdering.begrunnelse) && (
            <p className="text-[13.5px] leading-relaxed">
              {extractSamletBegrunnelse(vurdering.begrunnelse)}
            </p>
          )}
        </div>
      </div>
      <SeksjonFeedback
        vurderingId={vurdering.id}
        seksjonId="anbefaling"
        seksjonNavn="Samlet anbefaling og begrunnelse"
        visForslagsFelt
        eksisterende={feedbackPerSeksjon.get("anbefaling")}
        synlig={kanSpisse}
      />

      {/* Røde flagg */}
      {rodeFlagg.length > 0 && (
        <Card className="mb-6 border-cp-red/30">
          <div className="px-5 py-4 border-b border-line-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-cp-red" />
            <h3 className="text-[14px] font-semibold text-ink-1">
              Røde flagg ({rodeFlagg.length})
            </h3>
          </div>
          <ul className="divide-y divide-line-2">
            {rodeFlagg.map((flagg, idx) => (
              <li
                key={idx}
                className="px-5 py-3 flex items-start gap-3 text-[13px]"
              >
                <span
                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.06em] mt-0.5 shrink-0 ${
                    flagg.alvorlighet === "kritisk"
                      ? "bg-cp-red text-white"
                      : flagg.alvorlighet === "advarsel"
                        ? "bg-warning-soft text-warning"
                        : "bg-line-2 text-ink-3"
                  }`}
                >
                  {flagg.alvorlighet}
                </span>
                <span className="text-ink-2 leading-relaxed">{flagg.tekst}</span>
              </li>
            ))}
          </ul>
          <div className="px-5 pb-4">
            <SeksjonFeedback
              vurderingId={vurdering.id}
              seksjonId="rode_flagg"
              seksjonNavn="Røde flagg"
              eksisterende={feedbackPerSeksjon.get("rode_flagg")}
              synlig={kanSpisse}
            />
          </div>
        </Card>
      )}

      {/* Score per kriterium */}
      <Card className="mb-6">
        <div className="px-5 py-4 border-b border-line-2">
          <h3 className="text-[14px] font-semibold text-ink-1">
            Vurdering per kriterium
          </h3>
        </div>
        <div className="divide-y divide-line-2">
          <KriteriumRad
            navn="Soliditet"
            beskrivelse="Kvalitet på aktiviteter og metoder. Ambisjon og nytenkning."
            score={vurdering.score_soliditet}
            begrunnelse={extractKriterium(vurdering.begrunnelse, "soliditet")}
            seksjonId="kriterium_soliditet"
            vurderingId={vurdering.id}
            kanSpisse={kanSpisse}
            eksisterende={feedbackPerSeksjon.get("kriterium_soliditet")}
          />
          <KriteriumRad
            navn="Virkning"
            beskrivelse="Potensiell virkning, nytteverdi og spredning."
            score={vurdering.score_virkning}
            begrunnelse={extractKriterium(vurdering.begrunnelse, "virkning")}
            seksjonId="kriterium_virkning"
            vurderingId={vurdering.id}
            kanSpisse={kanSpisse}
            eksisterende={feedbackPerSeksjon.get("kriterium_virkning")}
          />
          <KriteriumRad
            navn="Gjennomføring"
            beskrivelse="Organisering, styring, ressursbruk og kompetanse."
            score={vurdering.score_gjennomforing}
            begrunnelse={extractKriterium(
              vurdering.begrunnelse,
              "gjennomforing",
            )}
            seksjonId="kriterium_gjennomforing"
            vurderingId={vurdering.id}
            kanSpisse={kanSpisse}
            eksisterende={feedbackPerSeksjon.get("kriterium_gjennomforing")}
          />
          <KriteriumRad
            navn="Stiftelsen Dams prioriteringer"
            beskrivelse="Frivillighet, brukerinvolvering, lokalt engasjement."
            score={vurdering.score_prioriteringer}
            begrunnelse={extractKriterium(
              vurdering.begrunnelse,
              "prioriteringer",
            )}
            seksjonId="kriterium_prioriteringer"
            vurderingId={vurdering.id}
            kanSpisse={kanSpisse}
            eksisterende={feedbackPerSeksjon.get("kriterium_prioriteringer")}
          />
        </div>
      </Card>

      {/* Forbedringsforslag */}
      {forbedringer.length > 0 && (
        <Card className="mb-6">
          <div className="px-5 py-4 border-b border-line-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cp-blue" />
            <h3 className="text-[14px] font-semibold text-ink-1">
              Forbedringsforslag ({forbedringer.length})
            </h3>
          </div>
          <div className="divide-y divide-line-2">
            {forbedringer.map((f, idx) => {
              const seksjonId = `forbedring:${f.felt}`;
              return (
                <ForbedringRad
                  key={idx}
                  forbedring={f}
                  seksjonId={seksjonId}
                  vurderingId={vurdering.id}
                  kanSpisse={kanSpisse}
                  eksisterende={feedbackPerSeksjon.get(seksjonId)}
                />
              );
            })}
          </div>
        </Card>
      )}

      {/* Note fra agenten */}
      {extractNote(vurdering.begrunnelse) && (
        <div className="rounded-md border border-line-1 bg-bg-sunk px-4 py-3 text-[12px] text-ink-3 leading-relaxed italic mb-6">
          {extractNote(vurdering.begrunnelse)}
        </div>
      )}

      {/* Feedback-panel — generell tommel/kommentar med dobbeltsjekk */}
      <FeedbackPanel
        vurderingId={vurdering.id}
        eksisterendeFeedback={minGenerellFeedback}
      />

      <p className="mt-6 text-[11px] text-ink-5 text-center">
        Modell: {vurdering.modell_brukt} · System: {vurdering.system_prompt_versjon}
        {vurdering.rubrikk_versjon && ` · Rubrikk: ${vurdering.rubrikk_versjon}`}
      </p>
    </div>
  );
}

function KriteriumRad({
  navn,
  beskrivelse,
  score,
  begrunnelse,
  seksjonId,
  vurderingId,
  kanSpisse,
  eksisterende,
}: {
  navn: string;
  beskrivelse: string;
  score: number | null;
  begrunnelse: { styrker?: string; svakheter?: string } | null;
  seksjonId: string;
  vurderingId: string;
  kanSpisse: boolean;
  eksisterende?: Feedback;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-baseline justify-between gap-4 mb-1.5">
        <div>
          <h4 className="text-[14px] font-semibold text-ink-1">{navn}</h4>
          <p className="text-[11.5px] text-ink-4">{beskrivelse}</p>
        </div>
        {score !== null && <ScoreBar value={score} />}
      </div>
      {begrunnelse && (
        <div className="mt-2 space-y-1.5 text-[12.5px]">
          {begrunnelse.styrker && (
            <p>
              <span className="font-semibold text-good">Styrker: </span>
              <span className="text-ink-2">{begrunnelse.styrker}</span>
            </p>
          )}
          {begrunnelse.svakheter && (
            <p>
              <span className="font-semibold text-warning">Svakheter: </span>
              <span className="text-ink-2">{begrunnelse.svakheter}</span>
            </p>
          )}
        </div>
      )}
      <SeksjonFeedback
        vurderingId={vurderingId}
        seksjonId={seksjonId}
        seksjonNavn={`${navn} — score og begrunnelse`}
        visForslagsFelt
        eksisterende={eksisterende}
        synlig={kanSpisse}
      />
    </div>
  );
}

function ForbedringRad({
  forbedring,
  seksjonId,
  vurderingId,
  kanSpisse,
  eksisterende,
}: {
  forbedring: Forbedring;
  seksjonId: string;
  vurderingId: string;
  kanSpisse: boolean;
  eksisterende?: Feedback;
}) {
  const felt = finnFelt(forbedring.felt);
  return (
    <div className="px-5 py-4 space-y-3">
      <div>
        <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-4 mb-0.5">
          Felt {forbedring.felt}
        </p>
        {felt && (
          <p className="text-[13px] font-semibold text-ink-1">{felt.navn}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-md border border-line-1 bg-bg-sunk p-3">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-4 mb-1.5">
            Original
          </p>
          <p className="text-[12.5px] text-ink-2 leading-relaxed whitespace-pre-wrap">
            {forbedring.original}
          </p>
        </div>
        <div className="rounded-md border border-cp-blue/30 bg-cp-blue-tint p-3">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-cp-blue mb-1.5">
            Forslag
          </p>
          <p className="text-[12.5px] text-ink-1 leading-relaxed whitespace-pre-wrap">
            {forbedring.forslag}
          </p>
          {felt?.tegngrense && (
            <p className="text-[10.5px] text-ink-5 tabular mt-1.5">
              {forbedring.forslag.length} / {felt.tegngrense} tegn
            </p>
          )}
        </div>
      </div>

      <div className="text-[12px] text-ink-3 italic leading-relaxed">
        <span className="font-semibold not-italic">Hvorfor: </span>
        {forbedring.hvorfor}
      </div>

      <SeksjonFeedback
        vurderingId={vurderingId}
        seksjonId={seksjonId}
        seksjonNavn={`Forbedringsforslag for ${forbedring.felt}`}
        visForslagsFelt
        eksisterende={eksisterende}
        synlig={kanSpisse}
      />
    </div>
  );
}

/**
 * begrunnelse-feltet er markdown-format. Vi parser ut samlet sammendrag,
 * per-kriterium-blokker og notatet for rendering. Naive men holder for nå.
 */
function extractSamletBegrunnelse(begrunnelse: string | null): string {
  if (!begrunnelse) return "";
  const linjer = begrunnelse.split("\n");
  const tomLinje = linjer.findIndex((l) => l.startsWith("## "));
  if (tomLinje === -1) return begrunnelse.trim();
  return linjer.slice(0, tomLinje).join("\n").trim();
}

function extractKriterium(
  begrunnelse: string | null,
  kriterium: string,
): { styrker?: string; svakheter?: string } | null {
  if (!begrunnelse) return null;
  const matchH3 = new RegExp(
    `### ${kriterium}\\s*([\\s\\S]*?)(?=###|## Note|$)`,
    "i",
  );
  const blokk = begrunnelse.match(matchH3)?.[1] ?? "";
  if (!blokk) return null;

  const styrkerMatch = blokk.match(/\*\*Styrker:\*\*\s*([^\n]+)/);
  const svakheterMatch = blokk.match(/\*\*Svakheter:\*\*\s*([^\n]+)/);

  return {
    styrker: styrkerMatch?.[1]?.trim(),
    svakheter: svakheterMatch?.[1]?.trim(),
  };
}

function extractNote(begrunnelse: string | null): string {
  if (!begrunnelse) return "";
  const noteMatch = begrunnelse.match(/## Note\s*\n([\s\S]+)$/);
  return noteMatch?.[1]?.trim() ?? "";
}
