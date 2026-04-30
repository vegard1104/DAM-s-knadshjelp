import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ArrowRight, Sparkles, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatusChip } from "@/components/ui/status-chip";
import { ScoreBar } from "@/components/ui/score-bar";
import { Avatar, nameToInitials } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EKSPRESS_FELTER } from "@/types/ekspress-felter";
import type { VurderingAnbefaling } from "@/types/database";
import { VurderPaaNyttKnapp } from "./vurdering/vurder-paa-nytt-knapp";

export const dynamic = "force-dynamic";

const ANBEFALING_ETIKETT: Record<VurderingAnbefaling, string> = {
  klar_til_innsending: "Klar til innsending",
  bor_forbedres: "Bør forbedres",
  trenger_arbeid: "Trenger arbeid",
  vesentlige_mangler: "Vesentlige mangler",
};

export default async function SoknadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: soknad } = await supabase
    .from("soknader")
    .select("*")
    .eq("id", id)
    .single();

  if (!soknad) {
    notFound();
  }

  const { data: eier } = await supabase
    .from("profiles")
    .select("navn, email")
    .eq("id", soknad.owner_id)
    .single();

  // Hent siste vurdering hvis finnes
  const { data: vurdering } = await supabase
    .from("vurderinger")
    .select(
      "id, snitt_score, anbefaling, score_soliditet, score_virkning, score_gjennomforing, score_prioriteringer, created_at, versjon",
    )
    .eq("soknad_id", id)
    .order("versjon", { ascending: false })
    .limit(1)
    .single();

  // Sortér felt etter Damnett-rekkefølge for visning
  const felter = soknad.felter as Record<string, unknown>;

  return (
    <div className="px-10 py-10 max-w-[860px]">
      <Link
        href="/soknader"
        className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-4 hover:text-ink-1 mb-4"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Tilbake til alle søknader
      </Link>

      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-ink-4 mb-2">
            {soknad.program}
          </p>
          <h1 className="text-[28px] font-bold tracking-tight text-ink-1">
            {soknad.tittel || "Uten navn"}
          </h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={`/soknader/${id}/rediger`}
            className="inline-flex items-center gap-2 rounded-md border border-line-1 bg-white px-3 py-2 text-[13px] font-medium text-ink-2 hover:bg-bg-sunk transition"
          >
            <Pencil className="h-4 w-4" />
            Rediger
          </Link>
          <StatusChip status={soknad.status} />
        </div>
      </div>

      {/* Vurderings-sammendrag (eller "vurder nå"-prompt) */}
      {vurdering ? (
        <Card className="mb-6 border-cp-blue/20">
          <div className="px-5 py-4 border-b border-line-2 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-4 mb-0.5">
                Siste vurdering · v{vurdering.versjon} ·{" "}
                {formatDate(vurdering.created_at)}
              </p>
              <p className="text-[15px] font-semibold text-ink-1">
                {ANBEFALING_ETIKETT[vurdering.anbefaling as VurderingAnbefaling]}
                <span className="ml-3 text-ink-4 font-normal">
                  Snitt {vurdering.snitt_score?.toFixed(2)} / 7
                </span>
              </p>
            </div>
            <Link
              href={`/soknader/${id}/vurdering`}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-cp-blue hover:underline"
            >
              Se hele vurderingen <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <ScoreCell navn="Soliditet" score={vurdering.score_soliditet} />
            <ScoreCell navn="Virkning" score={vurdering.score_virkning} />
            <ScoreCell
              navn="Gjennomføring"
              score={vurdering.score_gjennomforing}
            />
            <ScoreCell
              navn="Prioriteringer"
              score={vurdering.score_prioriteringer}
            />
          </div>
        </Card>
      ) : (
        <Card className="mb-6 border-dashed">
          <div className="p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[14px] font-semibold text-ink-1 mb-1">
                Ingen vurdering ennå
              </p>
              <p className="text-[12.5px] text-ink-4 max-w-prose leading-relaxed">
                Klikk &laquo;Vurder søknad&raquo; for å la Claude vurdere
                søknaden mot DAMs kriterier og foreslå forbedringer per felt.
              </p>
            </div>
            <VurderPaaNyttKnapp soknadId={id} />
          </div>
        </Card>
      )}

      {/* Metadata */}
      <Card className="mb-6">
        <div className="p-5 grid grid-cols-2 gap-4 text-[12.5px]">
          <Meta label="Eier">
            {eier && (
              <span className="inline-flex items-center gap-2">
                <Avatar
                  initials={nameToInitials(eier.navn || eier.email)}
                  size="sm"
                />
                {eier.navn || eier.email}
              </span>
            )}
          </Meta>
          <Meta label="Status">
            <StatusChip status={soknad.status} />
          </Meta>
          <Meta label="Opprettet">{formatDate(soknad.created_at)}</Meta>
          <Meta label="Sist endret">
            {formatDate(soknad.last_modified_at)}
          </Meta>
          {soknad.soknadssum_kr !== null && (
            <Meta label="Søknadssum">
              <span className="tabular">
                {formatCurrency(soknad.soknadssum_kr)}
              </span>
            </Meta>
          )}
          {soknad.totalbudsjett_kr !== null && (
            <Meta label="Totalbudsjett">
              <span className="tabular">
                {formatCurrency(soknad.totalbudsjett_kr)}
              </span>
            </Meta>
          )}
          {soknad.oppstart_dato && (
            <Meta label="Oppstart">{formatDate(soknad.oppstart_dato)}</Meta>
          )}
          {soknad.avslutt_dato && (
            <Meta label="Avslutning">{formatDate(soknad.avslutt_dato)}</Meta>
          )}
        </div>
      </Card>

      {/* Skjemafelt — pent rendret per seksjon */}
      <Card>
        <div className="px-5 py-4 border-b border-line-2">
          <h2 className="text-[14px] font-semibold text-ink-1">Skjemainnhold</h2>
        </div>
        <div className="divide-y divide-line-2">
          {EKSPRESS_FELTER.map((f) => {
            const verdi = felter[f.id];
            if (
              verdi === null ||
              verdi === undefined ||
              verdi === "" ||
              (Array.isArray(verdi) && verdi.length === 0)
            ) {
              return null;
            }
            return (
              <div key={f.id} className="px-5 py-3">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-4 mb-0.5">
                  {f.id} · {f.navn}
                </p>
                <FeltVisning verdi={verdi} type={f.type} />
              </div>
            );
          })}
        </div>
      </Card>

      <p className="mt-6 text-[11.5px] text-ink-5 text-center">
        Redigering av eksisterende søknad kommer i neste runde.
      </p>
    </div>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-4 mb-1">
        {label}
      </dt>
      <dd className="text-ink-2">{children}</dd>
    </div>
  );
}

function ScoreCell({
  navn,
  score,
}: {
  navn: string;
  score: number | null;
}) {
  return (
    <div>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-4 mb-1">
        {navn}
      </p>
      {score !== null ? (
        <ScoreBar value={score} />
      ) : (
        <span className="text-ink-5 text-[12px]">—</span>
      )}
    </div>
  );
}

function FeltVisning({ verdi, type }: { verdi: unknown; type: string }) {
  if (type === "tabell" && typeof verdi === "object" && verdi !== null) {
    const b = verdi as { rader?: { type: string; post: string; belop: number | null }[] };
    if (!b.rader || b.rader.length === 0) return null;
    return (
      <table className="w-full text-[12.5px] mt-1">
        <tbody>
          {b.rader.map((r, idx) => (
            <tr key={idx} className="border-b border-line-3 last:border-0">
              <td className="py-1 pr-3 text-ink-4 capitalize w-20">{r.type}</td>
              <td className="py-1 pr-3 text-ink-2">{r.post}</td>
              <td className="py-1 text-right tabular text-ink-1">
                {r.belop !== null ? formatCurrency(r.belop) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (typeof verdi === "string") {
    return (
      <p className="text-[13px] text-ink-2 leading-relaxed whitespace-pre-wrap">
        {verdi}
      </p>
    );
  }

  if (typeof verdi === "number") {
    return <p className="text-[13px] text-ink-2 tabular">{verdi}</p>;
  }

  if (Array.isArray(verdi)) {
    return (
      <p className="text-[13px] text-ink-2">
        {verdi.map((v) => String(v)).join(", ")}
      </p>
    );
  }

  return (
    <pre className="text-[12px] text-ink-3 font-mono whitespace-pre-wrap">
      {JSON.stringify(verdi, null, 2)}
    </pre>
  );
}
