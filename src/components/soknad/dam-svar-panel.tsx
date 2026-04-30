"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  CheckCircle2,
  XCircle,
  FileText,
  Trash2,
  Send,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  markerSomSendtAction,
  registrerDamSvarAction,
  slettDamSvarAction,
} from "@/app/(app)/soknader/[id]/dam-svar-actions";
import type { DamSvar, SoknadStatus, DamUtfall } from "@/types/database";

/**
 * "Etter innsending"-panelet på søknadsdetalj-siden.
 *
 * Tre sub-tilstander basert på status og om dam_svar finnes:
 * 1. Søknad er kladd/vurdert → "Marker som sendt"-knapp
 * 2. Søknad er sendt, ingen dam_svar → opplastings-form
 * 3. dam_svar finnes → vis det med edit/delete-mulighet
 */

type Props = {
  soknadId: string;
  soknadStatus: SoknadStatus;
  damSvar: DamSvar | null;
  pdfSignedUrl: string | null;
  kanRedigere: boolean;
};

export function DamSvarPanel({
  soknadId,
  soknadStatus,
  damSvar,
  pdfSignedUrl,
  kanRedigere,
}: Props) {
  // Hvilken visning som er aktiv kan også styres av en lokal state
  // (f.eks. "endre"-modus etter at dam_svar er registrert)
  const [redigerer, setRedigerer] = useState(false);

  if (damSvar && !redigerer) {
    return (
      <DamSvarVisning
        soknadId={soknadId}
        damSvar={damSvar}
        pdfSignedUrl={pdfSignedUrl}
        kanRedigere={kanRedigere}
        onRediger={() => setRedigerer(true)}
      />
    );
  }

  if (soknadStatus === "kladd" || soknadStatus === "vurdert") {
    return <MarkerSomSendtBoks soknadId={soknadId} kanEndre={kanRedigere} />;
  }

  // sendt, eller redigerer eksisterende
  return (
    <DamSvarFormBoks
      soknadId={soknadId}
      eksisterende={damSvar}
      onAvbryt={() => setRedigerer(false)}
      kanLagre={kanRedigere}
    />
  );
}

/* ============================================================
   Variant 1: Marker som sendt
   ============================================================ */

function MarkerSomSendtBoks({
  soknadId,
  kanEndre,
}: {
  soknadId: string;
  kanEndre: boolean;
}) {
  const router = useRouter();
  const [arbeider, startArbeid] = useTransition();
  const [feil, setFeil] = useState<string | null>(null);

  function utfor() {
    setFeil(null);
    startArbeid(async () => {
      const r = await markerSomSendtAction(soknadId);
      if (!r.ok) setFeil(r.feil);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-[10px] border border-line-1 bg-bg-card p-5">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-full bg-cp-blue-soft text-cp-blue grid place-items-center shrink-0">
          <Send className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-[14px] font-semibold text-ink-1 mb-1">
            Sendt søknaden til DAM?
          </h3>
          <p className="text-[12.5px] text-ink-4 leading-relaxed mb-3">
            Når du har kopiert teksten over til Damnett og sendt søknaden,
            klikker du her for å markere den som sendt. Du får så en boks
            for å laste opp DAMs svarbrev når det kommer (etter ~20–45 dager).
          </p>
          {kanEndre && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={utfor}
              disabled={arbeider}
            >
              <Send className="h-3.5 w-3.5" />
              {arbeider ? "Markerer …" : "Marker som sendt"}
            </Button>
          )}
          {!kanEndre && (
            <p className="text-[11.5px] text-ink-5 italic">
              Kun eier eller admin kan endre status.
            </p>
          )}
          {feil && (
            <p className="text-[11.5px] text-cp-red mt-2">{feil}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Variant 2: Form for å registrere DAM-svar
   ============================================================ */

function DamSvarFormBoks({
  soknadId,
  eksisterende,
  onAvbryt,
  kanLagre,
}: {
  soknadId: string;
  eksisterende: DamSvar | null;
  onAvbryt: () => void;
  kanLagre: boolean;
}) {
  const router = useRouter();
  const [utfall, setUtfall] = useState<DamUtfall>(
    eksisterende?.utfall ?? "innvilget",
  );
  const [innvilgetBelop, setInnvilgetBelop] = useState<number | null>(
    eksisterende?.innvilget_belop_kr ?? null,
  );
  const [begrunnelse, setBegrunnelse] = useState<string>(
    eksisterende?.begrunnelse_avslag ?? "",
  );
  const [fil, setFil] = useState<File | null>(null);
  const [arbeider, startArbeid] = useTransition();
  const [feil, setFeil] = useState<string | null>(null);
  const [opplastingsstatus, setOpplastingsstatus] = useState<string | null>(
    null,
  );

  function utfor() {
    setFeil(null);
    setOpplastingsstatus(null);

    startArbeid(async () => {
      let pdfPath: string | null = eksisterende?.pdf_path ?? null;

      // 1. Last opp PDF-en hvis brukeren valgte ny fil
      if (fil) {
        if (fil.size > 10 * 1024 * 1024) {
          setFeil("Filen er for stor (maks 10 MB).");
          return;
        }
        if (fil.type !== "application/pdf") {
          setFeil("Filen må være en PDF.");
          return;
        }

        setOpplastingsstatus("Laster opp PDF …");

        const sb = createBrowserClient();
        const tidsstempel = Date.now();
        const trygtFilnavn = fil.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${soknadId}/${tidsstempel}-${trygtFilnavn}`;

        const { error: opplastingsfeil } = await sb.storage
          .from("dam-svar-pdf")
          .upload(path, fil, { upsert: false });

        if (opplastingsfeil) {
          setFeil(`Opplasting feilet: ${opplastingsfeil.message}`);
          setOpplastingsstatus(null);
          return;
        }

        pdfPath = path;
      }

      // 2. Lagre dam_svar-raden
      setOpplastingsstatus("Lagrer DAM-svar …");

      const r = await registrerDamSvarAction(soknadId, {
        utfall,
        innvilget_belop_kr: utfall === "innvilget" ? innvilgetBelop : null,
        begrunnelse_avslag:
          utfall === "avslag" && begrunnelse ? begrunnelse : null,
        pdf_path: pdfPath,
      });

      if (!r.ok) {
        setFeil(r.feil);
        setOpplastingsstatus(null);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="rounded-[10px] border border-line-1 bg-bg-card p-5">
      <div className="flex items-start gap-4 mb-5">
        <div className="h-10 w-10 rounded-full bg-cp-blue-soft text-cp-blue grid place-items-center shrink-0">
          <Upload className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-[14px] font-semibold text-ink-1 mb-1">
            {eksisterende ? "Endre DAM-svar" : "Last opp DAM-svar"}
          </h3>
          <p className="text-[12.5px] text-ink-4 leading-relaxed">
            Velg utfall og last opp PDF-en med DAMs svarbrev. Hvis avslag —
            lim inn fagutvalgets begrunnelse, det er gull verdt for å
            kalibrere agenten på hva som faktisk skiller innvilget fra
            avslag.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Utfall */}
        <div>
          <label className="text-[12.5px] font-medium text-ink-2 block mb-2">
            Utfall <span className="text-cp-red">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <UtfallValg
              valgt={utfall === "innvilget"}
              onClick={() => setUtfall("innvilget")}
              ikon={CheckCircle2}
              etikett="Innvilget"
              klasser="border-good text-good"
              valgtKlasser="bg-good-soft border-good"
            />
            <UtfallValg
              valgt={utfall === "avslag"}
              onClick={() => setUtfall("avslag")}
              ikon={XCircle}
              etikett="Avslått"
              klasser="border-cp-red text-cp-red"
              valgtKlasser="bg-cp-red-soft border-cp-red"
            />
          </div>
        </div>

        {/* Innvilget beløp (hvis innvilget) */}
        {utfall === "innvilget" && (
          <div>
            <label className="text-[12.5px] font-medium text-ink-2 block mb-1.5">
              Innvilget beløp (kr)
            </label>
            <p className="text-[11.5px] text-ink-4 leading-relaxed mb-2">
              Hvor mye DAM bevilget. Kan være lavere enn dere søkte om
              (delvis innvilgelse).
            </p>
            <input
              type="number"
              inputMode="numeric"
              value={innvilgetBelop ?? ""}
              onChange={(e) =>
                setInnvilgetBelop(
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              className="w-48 rounded-md border border-line-1 bg-white px-3 py-2 text-[13.5px] tabular focus:outline-none focus:ring-[3px] focus:ring-cp-blue/15 focus:border-cp-blue"
            />
          </div>
        )}

        {/* Begrunnelse fra fagutvalget (hvis avslag) */}
        {utfall === "avslag" && (
          <div>
            <label className="text-[12.5px] font-medium text-ink-2 block mb-1.5">
              Begrunnelse fra fagutvalget
            </label>
            <p className="text-[11.5px] text-ink-4 leading-relaxed mb-2">
              Lim inn det fagutvalget skrev om hvorfor søknaden ble avslått.
            </p>
            <textarea
              rows={5}
              value={begrunnelse}
              onChange={(e) => setBegrunnelse(e.target.value)}
              placeholder="Eks: «Markedsføringen i SoMe er i liten grad omtalt …»"
              className="w-full rounded-md border border-line-1 bg-white px-3 py-2.5 text-[13.5px] resize-y focus:outline-none focus:ring-[3px] focus:ring-cp-blue/15 focus:border-cp-blue"
            />
          </div>
        )}

        {/* PDF-opplasting */}
        <div>
          <label className="text-[12.5px] font-medium text-ink-2 block mb-1.5">
            DAMs svarbrev (PDF) {!eksisterende && <span className="text-cp-red">*</span>}
          </label>
          <p className="text-[11.5px] text-ink-4 leading-relaxed mb-2">
            Maks 10 MB. Kun PDF-format.
          </p>
          {eksisterende?.pdf_path && !fil && (
            <p className="text-[11.5px] text-ink-3 italic mb-2">
              En fil er allerede lastet opp. Velg en ny her hvis du vil
              erstatte den.
            </p>
          )}
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFil(e.target.files?.[0] ?? null)}
            className="block w-full text-[12.5px] text-ink-3 file:mr-3 file:rounded-md file:border-0 file:bg-cp-blue file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-white hover:file:bg-cp-blue-dark file:cursor-pointer"
          />
        </div>

        {/* Knapper og feilmeldinger */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="text-[11.5px] text-ink-4 min-w-0">
            {feil && <span className="text-cp-red font-medium">{feil}</span>}
            {!feil && opplastingsstatus && (
              <span className="text-cp-blue font-medium">
                {opplastingsstatus}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {eksisterende && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onAvbryt}
                disabled={arbeider}
              >
                Avbryt
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={utfor}
              disabled={
                arbeider ||
                !kanLagre ||
                (!fil && !eksisterende) ||
                (utfall === "innvilget" && innvilgetBelop === null && !eksisterende)
              }
            >
              <Upload className="h-4 w-4" />
              {arbeider ? "Lagrer …" : eksisterende ? "Lagre endringer" : "Last opp"}
            </Button>
          </div>
        </div>
        {!kanLagre && (
          <p className="text-[11.5px] text-ink-5 italic">
            Kun eier eller admin kan registrere DAM-svar.
          </p>
        )}
      </div>
    </div>
  );
}

function UtfallValg({
  valgt,
  onClick,
  ikon: Ikon,
  etikett,
  klasser,
  valgtKlasser,
}: {
  valgt: boolean;
  onClick: () => void;
  ikon: typeof CheckCircle2;
  etikett: string;
  klasser: string;
  valgtKlasser: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-md border-2 bg-white px-4 py-3 text-[13.5px] font-medium transition",
        valgt ? valgtKlasser : "border-line-1 text-ink-3 hover:bg-bg-sunk",
        valgt ? "" : klasser,
      )}
    >
      <Ikon className={cn("h-5 w-5", valgt ? "" : "opacity-40")} />
      {etikett}
    </button>
  );
}

/* ============================================================
   Variant 3: Vis registrert DAM-svar
   ============================================================ */

function DamSvarVisning({
  soknadId,
  damSvar,
  pdfSignedUrl,
  kanRedigere,
  onRediger,
}: {
  soknadId: string;
  damSvar: DamSvar;
  pdfSignedUrl: string | null;
  kanRedigere: boolean;
  onRediger: () => void;
}) {
  const router = useRouter();
  const [arbeider, startArbeid] = useTransition();
  const [feil, setFeil] = useState<string | null>(null);

  function utforSlett() {
    if (!confirm("Er du sikker på at du vil slette DAM-svaret?")) return;
    setFeil(null);
    startArbeid(async () => {
      const r = await slettDamSvarAction(soknadId);
      if (!r.ok) setFeil(r.feil);
      else router.refresh();
    });
  }

  const erInnvilget = damSvar.utfall === "innvilget";

  return (
    <div
      className={cn(
        "rounded-[10px] border-2 p-5",
        erInnvilget
          ? "border-good/30 bg-good-soft/30"
          : "border-cp-red/30 bg-cp-red-soft/30",
      )}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "h-10 w-10 rounded-full grid place-items-center shrink-0",
              erInnvilget
                ? "bg-good text-white"
                : "bg-cp-red text-white",
            )}
          >
            {erInnvilget ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-4 mb-0.5">
              DAM-svar · Registrert {formatDate(damSvar.created_at)}
            </p>
            <h3 className="text-[18px] font-bold tracking-tight text-ink-1">
              {erInnvilget ? "Innvilget" : "Avslått"}
            </h3>
            {erInnvilget && damSvar.innvilget_belop_kr && (
              <p className="text-[14px] text-good font-semibold tabular mt-0.5">
                {formatCurrency(damSvar.innvilget_belop_kr)}
              </p>
            )}
          </div>
        </div>

        {kanRedigere && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRediger}
            >
              Endre
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={utforSlett}
              disabled={arbeider}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Slett
            </Button>
          </div>
        )}
      </div>

      {/* Begrunnelse */}
      {!erInnvilget && damSvar.begrunnelse_avslag && (
        <div className="bg-white rounded-md border border-line-1 p-3 mb-3">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-4 mb-1">
            Begrunnelse fra fagutvalget
          </p>
          <p className="text-[13px] text-ink-2 leading-relaxed whitespace-pre-wrap">
            {damSvar.begrunnelse_avslag}
          </p>
        </div>
      )}

      {/* PDF-link */}
      {damSvar.pdf_path && pdfSignedUrl && (
        <a
          href={pdfSignedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md bg-white border border-line-1 px-3 py-2 text-[12.5px] font-medium text-ink-2 hover:bg-bg-sunk transition"
        >
          <FileText className="h-4 w-4 text-cp-red" />
          Åpne svarbrevet (PDF)
          <ExternalLink className="h-3 w-3 text-ink-4" />
        </a>
      )}

      {feil && <p className="text-[11.5px] text-cp-red mt-2">{feil}</p>}
    </div>
  );
}
