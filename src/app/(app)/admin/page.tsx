import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ThumbsUp,
  ThumbsDown,
  Pencil,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Avatar, nameToInitials } from "@/components/ui/avatar";
import { formatDate, cn } from "@/lib/utils";
import type {
  Feedback,
  FeedbackAdminStatus,
  Soknad,
  Vurdering,
} from "@/types/database";
import { AdminFeedbackHandlinger } from "./admin-feedback-handlinger";

export const dynamic = "force-dynamic";

type FeedbackMedKontekst = Feedback & {
  bruker: { navn: string; email: string; role: string } | null;
  vurdering: (Vurdering & { soknad: Soknad | null }) | null;
};

/**
 * Etiketter for de forskjellige seksjons-id-ene som dukker opp i
 * trener-tilbakemeldingene. Brukes til å vise lesbare beskrivelser
 * i admin-køen.
 */
const SEKSJON_NAVN: Record<string, string> = {
  anbefaling: "Anbefaling og samlet begrunnelse",
  rode_flagg: "Røde flagg",
  kriterium_soliditet: "Soliditet (score + begrunnelse)",
  kriterium_virkning: "Virkning (score + begrunnelse)",
  kriterium_gjennomforing: "Gjennomføring (score + begrunnelse)",
  kriterium_prioriteringer: "Stiftelsen Dams prioriteringer (score + begrunnelse)",
  note: "Note fra agenten",
};

function lesbarSeksjon(targetSection: string | null): string {
  if (!targetSection) return "Generell tilbakemelding";
  if (targetSection.startsWith("forbedring:")) {
    const felt = targetSection.replace("forbedring:", "");
    return `Forbedringsforslag for ${felt}`;
  }
  return SEKSJON_NAVN[targetSection] ?? targetSection;
}

const STATUS_META: Record<
  FeedbackAdminStatus,
  { etikett: string; klasser: string; ikon: typeof Clock }
> = {
  ny: {
    etikett: "Ny",
    klasser: "bg-cp-blue-soft text-cp-blue-dark border-cp-blue/30",
    ikon: AlertCircle,
  },
  behandlet: {
    etikett: "Behandlet",
    klasser: "bg-warning-soft text-warning border-warning/30",
    ikon: Clock,
  },
  implementert: {
    etikett: "Implementert",
    klasser: "bg-good-soft text-green-900 border-good/30",
    ikon: CheckCircle2,
  },
  avvist: {
    etikett: "Avvist",
    klasser: "bg-line-2 text-ink-3 border-line-1",
    ikon: XCircle,
  },
};

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profil || (profil.role !== "admin" && profil.role !== "utvikler")) {
    return (
      <div className="px-10 py-10 max-w-[860px]">
        <h1 className="text-[24px] font-bold text-ink-1 mb-2">Ingen tilgang</h1>
        <p className="text-[14px] text-ink-3">
          Du må ha rolle admin eller utvikler for å se admin-siden.
        </p>
      </div>
    );
  }

  // Hent all feedback med bruker- og vurderingskontekst
  const { data: feedback } = await supabase
    .from("feedback")
    .select(
      `
      *,
      bruker:profiles!feedback_bruker_id_fkey(navn, email, role),
      vurdering:vurderinger!feedback_vurdering_id_fkey(
        *,
        soknad:soknader!vurderinger_soknad_id_fkey(*)
      )
    `,
    )
    .order("created_at", { ascending: false });

  const alle = (feedback as unknown as FeedbackMedKontekst[]) ?? [];

  // Splitt: brukere (target_section IS NULL eller fra rolle=bruker)
  // vs trenere (target_section IS NOT NULL og fra admin/utvikler)
  const fraBrukere = alle.filter((f) => {
    if (!f.bruker_bekreftet) return false; // ikke ferdig dobbeltsjekket ennå
    return !f.target_section;
  });

  const fraTrenere = alle.filter((f) => !!f.target_section);

  return (
    <div className="px-10 py-10 max-w-[1100px]">
      <div className="mb-8">
        <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-ink-4 mb-2">
          Admin
        </p>
        <h1 className="text-[32px] font-bold tracking-tight text-ink-1">
          Forbedring av agenten
        </h1>
        <p className="text-[13.5px] text-ink-4 mt-1.5 max-w-prose">
          Tilbakemeldinger fra brukere og spissing fra trenere som venter på
          behandling. Marker som implementert når en endring er innarbeidet i
          agenten, eller avvis hvis forslaget ikke skal følges.
        </p>
      </div>

      {/* Sammendrag-kort */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <SammendragKort
          tittel="Nye fra brukere"
          antall={
            fraBrukere.filter((f) => f.admin_status === "ny").length
          }
          ikon={ThumbsUp}
          aksent="cp-blue"
        />
        <SammendragKort
          tittel="Nye fra trenere"
          antall={
            fraTrenere.filter((f) => f.admin_status === "ny").length
          }
          ikon={Pencil}
          aksent="cp-blue"
        />
        <SammendragKort
          tittel="Implementert"
          antall={
            alle.filter((f) => f.admin_status === "implementert").length
          }
          ikon={CheckCircle2}
          aksent="good"
        />
        <SammendragKort
          tittel="Avvist"
          antall={alle.filter((f) => f.admin_status === "avvist").length}
          ikon={XCircle}
          aksent="ink"
        />
      </div>

      {/* Forbedringspunkter fra brukere */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-[18px] font-semibold text-ink-1">
            Forbedringspunkter fra brukere
          </h2>
          <span className="text-[12px] text-ink-4">
            {fraBrukere.length} totalt
          </span>
        </div>
        <p className="text-[12.5px] text-ink-4 mb-4 leading-relaxed">
          Tommel opp/ned + kommentar fra de som ikke har trener-tilgang.
          Hver er bekreftet av brukeren via dobbeltsjekk-regelen før den
          dukker opp her.
        </p>

        {fraBrukere.length === 0 ? (
          <TomtKort tekst="Ingen tilbakemeldinger fra brukere ennå." />
        ) : (
          <div className="space-y-3">
            {fraBrukere.map((f) => (
              <FeedbackKort key={f.id} feedback={f} kilde="bruker" />
            ))}
          </div>
        )}
      </section>

      {/* Spissing fra trenere */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-[18px] font-semibold text-ink-1">
            Spissing fra trenere
          </h2>
          <span className="text-[12px] text-ink-4">
            {fraTrenere.length} totalt
          </span>
        </div>
        <p className="text-[12.5px] text-ink-4 mb-4 leading-relaxed">
          Konkrete seksjons-tilbakemeldinger fra admin/utvikler. Disse er
          klare for å bli omsatt til prompt-endringer i lag 3 (kommer).
        </p>

        {fraTrenere.length === 0 ? (
          <TomtKort tekst="Ingen seksjons-tilbakemeldinger fra trenere ennå." />
        ) : (
          <div className="space-y-3">
            {fraTrenere.map((f) => (
              <FeedbackKort key={f.id} feedback={f} kilde="trener" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SammendragKort({
  tittel,
  antall,
  ikon: Ikon,
  aksent,
}: {
  tittel: string;
  antall: number;
  ikon: typeof Clock;
  aksent: "cp-blue" | "good" | "ink";
}) {
  const fargeKlasser = {
    "cp-blue": "bg-cp-blue-tint text-cp-blue",
    good: "bg-good-soft text-good",
    ink: "bg-line-2 text-ink-3",
  }[aksent];

  return (
    <Card>
      <div className="p-4 flex items-center gap-3">
        <div
          className={cn(
            "h-10 w-10 rounded-md grid place-items-center shrink-0",
            fargeKlasser,
          )}
        >
          <Ikon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-4 mb-0.5">
            {tittel}
          </p>
          <p className="text-[20px] font-semibold text-ink-1 tabular leading-none">
            {antall}
          </p>
        </div>
      </div>
    </Card>
  );
}

function TomtKort({ tekst }: { tekst: string }) {
  return (
    <Card>
      <div className="p-8 text-center">
        <p className="text-[13px] text-ink-4">{tekst}</p>
      </div>
    </Card>
  );
}

function FeedbackKort({
  feedback,
  kilde,
}: {
  feedback: FeedbackMedKontekst;
  kilde: "bruker" | "trener";
}) {
  const status = STATUS_META[feedback.admin_status];
  const StatusIkon = status.ikon;

  return (
    <Card>
      <div className="p-5">
        {/* Header: bruker, status, dato */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2.5">
            {feedback.bruker && (
              <Avatar
                initials={nameToInitials(
                  feedback.bruker.navn || feedback.bruker.email,
                )}
                size="sm"
              />
            )}
            <div>
              <p className="text-[12.5px] font-medium text-ink-1">
                {feedback.bruker?.navn || feedback.bruker?.email || "Ukjent"}
                <span className="text-ink-4 font-normal ml-1.5">
                  · {feedback.bruker?.role}
                </span>
              </p>
              <p className="text-[11px] text-ink-4">
                {formatDate(feedback.created_at)}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
              status.klasser,
            )}
          >
            <StatusIkon className="h-3 w-3" />
            {status.etikett}
          </span>
        </div>

        {/* Kontekst: hvilken seksjon, hvilken vurdering */}
        <div className="mb-3 rounded-md bg-bg-sunk px-3 py-2 text-[12px]">
          <div className="flex items-center gap-2 flex-wrap">
            {kilde === "trener" && (
              <span className="inline-flex items-center gap-1 rounded bg-cp-blue text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]">
                <Pencil className="h-2.5 w-2.5" />
                Seksjon
              </span>
            )}
            <span className="font-medium text-ink-2">
              {lesbarSeksjon(feedback.target_section)}
            </span>
            <span className="text-ink-4">·</span>
            {feedback.type === "tommel_opp" ? (
              <span className="inline-flex items-center gap-1 text-good">
                <ThumbsUp className="h-3 w-3" />
                Likte
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-cp-red">
                <ThumbsDown className="h-3 w-3" />
                Likte ikke
              </span>
            )}
          </div>
          {feedback.vurdering?.soknad && (
            <Link
              href={`/soknader/${feedback.vurdering.soknad.id}/vurdering?v=${feedback.vurdering.versjon}`}
              className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-cp-blue hover:underline"
            >
              {feedback.vurdering.soknad.tittel || "(uten navn)"} · v
              {feedback.vurdering.versjon}
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {/* Kommentar */}
        {feedback.kommentar && (
          <div className="mb-3">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-4 mb-1">
              Kommentar
            </p>
            <p className="text-[13px] text-ink-2 leading-relaxed whitespace-pre-wrap">
              {feedback.kommentar}
            </p>
          </div>
        )}

        {/* Forslått omskrivning (typisk fra trenere) */}
        {feedback.foreslatt_omskrivning && (
          <div className="mb-3 rounded-md border border-cp-blue/30 bg-cp-blue-tint p-3">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-cp-blue mb-1">
              Slik ville treneren skrevet det
            </p>
            <p className="text-[13px] text-ink-1 leading-relaxed whitespace-pre-wrap">
              {feedback.foreslatt_omskrivning}
            </p>
          </div>
        )}

        {/* Agentens tolkning (kun fra brukere via dobbeltsjekk) */}
        {feedback.agent_tolkning && (
          <div className="mb-3 rounded-md border border-line-1 bg-bg-sunk px-3 py-2">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-4 mb-0.5">
              Agentens tolkning
            </p>
            <p className="text-[12px] text-ink-3 italic leading-relaxed">
              {feedback.agent_tolkning}
            </p>
          </div>
        )}

        {/* Admin-handlinger */}
        <AdminFeedbackHandlinger
          feedbackId={feedback.id}
          naverende={feedback.admin_status}
          notat={feedback.admin_notat}
        />
      </div>
    </Card>
  );
}
