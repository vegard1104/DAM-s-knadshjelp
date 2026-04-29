import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreBar } from "@/components/ui/score-bar";
import { formatDate } from "@/lib/utils";
import type {
  VurderingAnbefaling,
  Forbedring,
  RodtFlagg,
} from "@/types/database";
import { finnFelt } from "@/types/ekspress-felter";
import { VurderPaaNyttKnapp } from "./vurder-paa-nytt-knapp";

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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: soknadId } = await params;
  const supabase = await createClient();

  // Hent søknaden + nyeste vurdering
  const { data: soknad } = await supabase
    .from("soknader")
    .select("id, tittel, program, status, owner_id")
    .eq("id", soknadId)
    .single();

  if (!soknad) notFound();

  const { data: vurdering } = await supabase
    .from("vurderinger")
    .select("*")
    .eq("soknad_id", soknadId)
    .order("versjon", { ascending: false })
    .limit(1)
    .single();

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

  const forbedringer = (vurdering.forbedringer ?? []) as Forbedring[];
  const rodeFlagg = (vurdering.rode_flagg ?? []) as RodtFlagg[];

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
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-ink-4 mb-2">
            Vurdering · Versjon {vurdering.versjon} ·{" "}
            {formatDate(vurdering.created_at)}
          </p>
          <h1 className="text-[28px] font-bold tracking-tight text-ink-1">
            {soknad.tittel || "Uten navn"}
          </h1>
        </div>
        <VurderPaaNyttKnapp soknadId={soknadId} />
      </div>

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
          />
          <KriteriumRad
            navn="Virkning"
            beskrivelse="Potensiell virkning, nytteverdi og spredning."
            score={vurdering.score_virkning}
            begrunnelse={extractKriterium(vurdering.begrunnelse, "virkning")}
          />
          <KriteriumRad
            navn="Gjennomføring"
            beskrivelse="Organisering, styring, ressursbruk og kompetanse."
            score={vurdering.score_gjennomforing}
            begrunnelse={extractKriterium(
              vurdering.begrunnelse,
              "gjennomforing",
            )}
          />
          <KriteriumRad
            navn="Stiftelsen Dams prioriteringer"
            beskrivelse="Frivillighet, brukerinvolvering, lokalt engasjement."
            score={vurdering.score_prioriteringer}
            begrunnelse={extractKriterium(
              vurdering.begrunnelse,
              "prioriteringer",
            )}
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
            {forbedringer.map((f, idx) => (
              <ForbedringRad key={idx} forbedring={f} />
            ))}
          </div>
        </Card>
      )}

      {/* Note fra agenten */}
      {extractNote(vurdering.begrunnelse) && (
        <div className="rounded-md border border-line-1 bg-bg-sunk px-4 py-3 text-[12px] text-ink-3 leading-relaxed italic">
          {extractNote(vurdering.begrunnelse)}
        </div>
      )}

      <p className="mt-6 text-[11px] text-ink-5 text-center">
        Modell: {vurdering.modell_brukt} · Prompt-versjon:{" "}
        {vurdering.system_prompt_versjon}
      </p>
    </div>
  );
}

function KriteriumRad({
  navn,
  beskrivelse,
  score,
  begrunnelse,
}: {
  navn: string;
  beskrivelse: string;
  score: number | null;
  begrunnelse: { styrker?: string; svakheter?: string } | null;
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
    </div>
  );
}

function ForbedringRad({ forbedring }: { forbedring: Forbedring }) {
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
