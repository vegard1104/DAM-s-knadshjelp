"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  ThumbsUp,
  ThumbsDown,
  X,
  Trash2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  lagreSeksjonFeedbackAction,
  slettSeksjonFeedbackAction,
} from "@/app/(app)/soknader/[id]/feedback-actions";
import type { Feedback } from "@/types/database";

/**
 * Seksjons-spesifikk feedback for trenere (admin/utvikler).
 *
 * Vises som en liten "Foreslå endring her"-knapp ved siden av en seksjon
 * av vurderingen. Klikk åpner et inline-form hvor treneren kan:
 *  - Velge tommel opp / ned for denne seksjonen
 *  - Skrive en kommentar ("dette likte jeg ikke fordi...")
 *  - Skrive en konkret omskrivning ("slik ville jeg skrevet det...")
 *
 * Hopper over dobbeltsjekk-regelen — trenere er allerede konkrete.
 * Lagres direkte til feedback-tabellen og dukker opp i admin-køen.
 */

type Props = {
  vurderingId: string;
  /** F.eks. "kriterium_soliditet", "rode_flagg", "forbedring:1.1.2" */
  seksjonId: string;
  /** Lesbar etikett for menneskelig referanse */
  seksjonNavn: string;
  /** Skal "Slik ville jeg skrevet det"-feltet være ekstra fremtredende? */
  visForslagsFelt?: boolean;
  /** Eksisterende feedback fra innlogget bruker for denne seksjonen */
  eksisterende?: Feedback | null;
  /** Skal vi vise denne i det hele tatt? Kun for admin/utvikler. */
  synlig: boolean;
};

export function SeksjonFeedback({
  vurderingId,
  seksjonId,
  seksjonNavn,
  visForslagsFelt = false,
  eksisterende,
  synlig,
}: Props) {
  const router = useRouter();
  const [apent, setApent] = useState(false);
  const [type, setType] = useState<"tommel_opp" | "tommel_ned">(
    (eksisterende?.type as "tommel_opp" | "tommel_ned") ?? "tommel_ned",
  );
  const [kommentar, setKommentar] = useState(eksisterende?.kommentar ?? "");
  const [omskrivning, setOmskrivning] = useState(
    eksisterende?.foreslatt_omskrivning ?? "",
  );
  const [arbeider, startArbeid] = useTransition();
  const [feil, setFeil] = useState<string | null>(null);

  if (!synlig) return null;

  // Sammenfoldet visning
  if (!apent) {
    if (eksisterende) {
      return (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setApent(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-cp-blue/30 bg-cp-blue-tint px-2.5 py-1 text-[11.5px] font-medium text-cp-blue-dark hover:bg-cp-blue-soft transition"
          >
            {eksisterende.type === "tommel_opp" ? (
              <ThumbsUp className="h-3 w-3" />
            ) : (
              <ThumbsDown className="h-3 w-3" />
            )}
            Du har gitt tilbakemelding her — endre
          </button>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => setApent(true)}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-dashed border-line-1 px-2.5 py-1 text-[11.5px] font-medium text-ink-4 hover:border-cp-blue/40 hover:text-cp-blue hover:bg-cp-blue-tint transition"
      >
        <Pencil className="h-3 w-3" />
        Foreslå endring her
      </button>
    );
  }

  function send() {
    setFeil(null);
    startArbeid(async () => {
      const r = await lagreSeksjonFeedbackAction({
        vurderingId,
        targetSection: seksjonId,
        type,
        kommentar: kommentar.trim() || null,
        foreslattOmskrivning: omskrivning.trim() || null,
      });

      if (!r.ok) {
        setFeil(r.feil);
        return;
      }

      setApent(false);
      router.refresh();
    });
  }

  function slett() {
    if (!eksisterende) return;
    if (!confirm("Slette denne tilbakemeldingen?")) return;
    setFeil(null);
    startArbeid(async () => {
      const r = await slettSeksjonFeedbackAction(eksisterende.id);
      if (!r.ok) {
        setFeil(r.feil);
        return;
      }
      setKommentar("");
      setOmskrivning("");
      setApent(false);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 rounded-md border-2 border-cp-blue/30 bg-cp-blue-tint p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-cp-blue mb-0.5">
            Trener-tilbakemelding på &laquo;{seksjonNavn}&raquo;
          </p>
          <p className="text-[12px] text-ink-3 leading-relaxed">
            Lagres direkte i forbedringskøen — ikke noe dobbeltsjekk her.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setApent(false)}
          className="text-ink-4 hover:text-ink-1 shrink-0"
          aria-label="Lukk"
          disabled={arbeider}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tommel */}
      <div className="flex gap-2 mb-3">
        <TommelKnapp
          aktiv={type === "tommel_opp"}
          onClick={() => setType("tommel_opp")}
          ikon={ThumbsUp}
          etikett="Likte denne"
          farge="good"
        />
        <TommelKnapp
          aktiv={type === "tommel_ned"}
          onClick={() => setType("tommel_ned")}
          ikon={ThumbsDown}
          etikett="Likte ikke denne"
          farge="cp-red"
        />
      </div>

      {/* Kommentar */}
      <div className="mb-3">
        <label className="text-[12px] font-medium text-ink-2 block mb-1">
          Hva fungerte (ikke)?
        </label>
        <textarea
          rows={2}
          value={kommentar}
          onChange={(e) => setKommentar(e.target.value)}
          placeholder={
            type === "tommel_ned"
              ? "F.eks. «for streng på score, og styrkene var for generelle»"
              : "F.eks. «traff godt med konkrete eksempler fra teksten»"
          }
          className="w-full rounded-md border border-line-1 bg-white px-3 py-2 text-[13px] resize-y focus:outline-none focus:ring-[3px] focus:ring-cp-blue/15 focus:border-cp-blue"
          disabled={arbeider}
        />
      </div>

      {/* Foreslått omskrivning (større fokus hvis visForslagsFelt) */}
      {visForslagsFelt && (
        <div className="mb-3">
          <label className="text-[12px] font-medium text-ink-2 block mb-1">
            Slik ville jeg skrevet det
            <span className="ml-1 text-[11px] font-normal text-ink-5">
              — valgfritt, men gull verdt for å spisse agenten
            </span>
          </label>
          <textarea
            rows={4}
            value={omskrivning}
            onChange={(e) => setOmskrivning(e.target.value)}
            placeholder="Skriv inn hvordan denne seksjonen burde sett ut..."
            className="w-full rounded-md border border-line-1 bg-white px-3 py-2 text-[13px] resize-y focus:outline-none focus:ring-[3px] focus:ring-cp-blue/15 focus:border-cp-blue"
            disabled={arbeider}
          />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="text-[11.5px] text-cp-red font-medium">
          {feil}
        </div>
        <div className="flex items-center gap-2">
          {eksisterende && (
            <button
              type="button"
              onClick={slett}
              disabled={arbeider}
              className="inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-4 hover:text-cp-red transition"
            >
              <Trash2 className="h-3 w-3" />
              Slett
            </button>
          )}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={send}
            disabled={
              arbeider ||
              (kommentar.trim().length === 0 && omskrivning.trim().length === 0)
            }
          >
            <Check className="h-3.5 w-3.5" />
            {arbeider
              ? "Lagrer …"
              : eksisterende
                ? "Lagre endringer"
                : "Send tilbakemelding"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TommelKnapp({
  aktiv,
  onClick,
  ikon: Ikon,
  etikett,
  farge,
}: {
  aktiv: boolean;
  onClick: () => void;
  ikon: typeof ThumbsUp;
  etikett: string;
  farge: "good" | "cp-red";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md border-2 bg-white px-3 py-1.5 text-[12px] font-medium transition",
        aktiv
          ? farge === "good"
            ? "border-good bg-good-soft text-green-900"
            : "border-cp-red bg-cp-red-soft text-cp-red"
          : "border-line-1 text-ink-3 hover:bg-bg-sunk",
      )}
    >
      <Ikon className="h-3.5 w-3.5" />
      {etikett}
    </button>
  );
}
