"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ThumbsUp, ThumbsDown, Sparkles, Check, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  lagreFeedbackAction,
  bekreftTolkningAction,
} from "@/app/(app)/soknader/[id]/feedback-actions";
import type { Feedback } from "@/types/database";

/**
 * Panel for å gi tommel opp/ned + kommentar på en vurdering.
 *
 * Implementerer dobbeltsjekk-regelen (prosjektkontekst v2 §6):
 * Hvis brukeren skriver kommentar, kjører Claude tolkning og spør tilbake
 * "Forstod jeg deg riktig?" før feedbacken lagres som "bekreftet".
 *
 * Påvirker IKKE agenten direkte — det er bare data som lagres.
 * Utvikler-rolle kan senere konvertere bekreftet feedback til en
 * faktisk prompt-endring (lag 3, kommer i neste runde).
 */

type Props = {
  vurderingId: string;
  /** Eksisterende feedback fra innlogget bruker, hvis noen */
  eksisterendeFeedback: Feedback | null;
};

export function FeedbackPanel({ vurderingId, eksisterendeFeedback }: Props) {
  const router = useRouter();
  const [type, setType] = useState<"tommel_opp" | "tommel_ned" | null>(
    (eksisterendeFeedback?.type as "tommel_opp" | "tommel_ned" | null) ?? null,
  );
  const [kommentar, setKommentar] = useState(
    eksisterendeFeedback?.kommentar ?? "",
  );
  const [feedback, setFeedback] = useState<Feedback | null>(
    eksisterendeFeedback,
  );
  const [arbeider, startArbeid] = useTransition();
  const [feil, setFeil] = useState<string | null>(null);
  const [statusTekst, setStatusTekst] = useState<string | null>(null);

  // Tre tilstander:
  // 1. Bruker har ikke gitt feedback ennå (eller har klikket "endre")
  // 2. Feedback lagret + Claude tolket → vis dobbeltsjekk-spørsmålet
  // 3. Feedback bekreftet → vis lukket sammendrag

  const visBekreftelse =
    !!feedback &&
    !!feedback.agent_tolkning &&
    !feedback.bruker_bekreftet;

  const visBekreftet =
    !!feedback && feedback.bruker_bekreftet === true;

  function sendInn() {
    if (!type) {
      setFeil("Velg tommel opp eller ned først.");
      return;
    }
    setFeil(null);
    setStatusTekst(null);

    startArbeid(async () => {
      const harKommentar = kommentar.trim().length > 0;
      if (harKommentar) {
        setStatusTekst("Lagrer og lar agenten tolke kommentaren …");
      }

      const r = await lagreFeedbackAction({
        vurderingId,
        type,
        kommentar,
      });

      if (!r.ok) {
        setFeil(r.feil);
        setStatusTekst(null);
        return;
      }

      setFeedback(r.feedback);
      setStatusTekst(null);
      router.refresh();
    });
  }

  function bekreft(bekreftet: boolean, nyKommentar?: string) {
    if (!feedback) return;
    setFeil(null);

    startArbeid(async () => {
      const r = await bekreftTolkningAction({
        feedbackId: feedback.id,
        bekreftet,
        nyKommentar,
      });

      if (!r.ok) {
        setFeil(r.feil);
        return;
      }

      setFeedback(r.feedback);
      router.refresh();
    });
  }

  // Variant 3: bekreftet sammendrag
  if (visBekreftet && feedback) {
    return (
      <div className="rounded-md border border-good/30 bg-good-soft/40 p-4">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-full bg-good text-white grid place-items-center shrink-0">
            <Check className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-[12.5px] font-semibold text-ink-1 mb-1">
              Tilbakemelding registrert
              {feedback.type === "tommel_opp" ? (
                <ThumbsUp className="inline-block h-3.5 w-3.5 ml-1.5 text-good" />
              ) : (
                <ThumbsDown className="inline-block h-3.5 w-3.5 ml-1.5 text-cp-red" />
              )}
            </p>
            {feedback.agent_tolkning && (
              <p className="text-[12px] text-ink-3 italic leading-relaxed">
                Agenten forstod: &laquo;{feedback.agent_tolkning}&raquo;
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setFeedback({ ...feedback, bruker_bekreftet: false });
              }}
              className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-cp-blue hover:underline"
            >
              <RotateCw className="h-3 w-3" /> Endre tilbakemelding
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Variant 2: dobbeltsjekk
  if (visBekreftelse && feedback) {
    return (
      <DobbeltsjekkBoks
        feedback={feedback}
        kommentar={kommentar}
        setKommentar={setKommentar}
        onBekreft={() => bekreft(true)}
        onKorriger={(ny) => bekreft(false, ny)}
        arbeider={arbeider}
        feil={feil}
      />
    );
  }

  // Variant 1: ny feedback
  return (
    <div className="rounded-[10px] border border-line-1 bg-bg-card p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="text-[14px] font-semibold text-ink-1 mb-0.5">
            Var dette nyttig?
          </h3>
          <p className="text-[12px] text-ink-4 leading-relaxed">
            Tilbakemeldingen din hjelper oss å forbedre agenten. Hvis du
            skriver en kommentar speiler agenten tilbake hva den forstod.
          </p>
        </div>
      </div>

      {/* Tommel-toggle */}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setType("tommel_opp")}
          className={cn(
            "flex items-center gap-2 rounded-md border-2 px-4 py-2 text-[13px] font-medium transition",
            type === "tommel_opp"
              ? "border-good bg-good-soft text-green-900"
              : "border-line-1 bg-white text-ink-3 hover:bg-bg-sunk",
          )}
        >
          <ThumbsUp className="h-4 w-4" />
          Nyttig
        </button>
        <button
          type="button"
          onClick={() => setType("tommel_ned")}
          className={cn(
            "flex items-center gap-2 rounded-md border-2 px-4 py-2 text-[13px] font-medium transition",
            type === "tommel_ned"
              ? "border-cp-red bg-cp-red-soft text-cp-red"
              : "border-line-1 bg-white text-ink-3 hover:bg-bg-sunk",
          )}
        >
          <ThumbsDown className="h-4 w-4" />
          Ikke nyttig
        </button>
      </div>

      {/* Kommentar (valgfri) */}
      <div className="mb-3">
        <label className="text-[12.5px] font-medium text-ink-2 block mb-1.5">
          Kommentar
          <span className="ml-1 text-[11.5px] font-normal text-ink-5">
            — valgfri, men hjelper agenten å forstå
          </span>
        </label>
        <textarea
          rows={3}
          value={kommentar}
          onChange={(e) => setKommentar(e.target.value)}
          placeholder={
            type === "tommel_ned"
              ? "F.eks. «du var for streng på Soliditet — prosjektet er mer nyskapende enn vurderingen tilsier»"
              : "F.eks. «forslagene på 1.1.2 traff veldig godt»"
          }
          className="w-full rounded-md border border-line-1 bg-white px-3 py-2 text-[13px] resize-y focus:outline-none focus:ring-[3px] focus:ring-cp-blue/15 focus:border-cp-blue"
          disabled={arbeider}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-[11.5px] text-ink-4 min-w-0">
          {feil && <span className="text-cp-red font-medium">{feil}</span>}
          {!feil && statusTekst && (
            <span className="text-cp-blue font-medium">{statusTekst}</span>
          )}
        </div>
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={sendInn}
          disabled={arbeider || !type}
        >
          {arbeider ? (
            <>
              <Sparkles className="h-4 w-4 animate-pulse" />
              Lagrer …
            </>
          ) : (
            "Send tilbakemelding"
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Dobbeltsjekk-boks: Claude har tolket, brukeren bekrefter eller korrigerer
// ============================================================

function DobbeltsjekkBoks({
  feedback,
  kommentar,
  setKommentar,
  onBekreft,
  onKorriger,
  arbeider,
  feil,
}: {
  feedback: Feedback;
  kommentar: string;
  setKommentar: (v: string) => void;
  onBekreft: () => void;
  onKorriger: (nyKommentar: string) => void;
  arbeider: boolean;
  feil: string | null;
}) {
  const [korrigerer, setKorrigerer] = useState(false);

  return (
    <div className="rounded-[10px] border-2 border-cp-blue/30 bg-cp-blue-tint p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-8 w-8 rounded-full bg-cp-blue text-white grid place-items-center shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-[12.5px] font-semibold text-ink-1 mb-2">
            Forstod jeg deg riktig?
          </p>
          <div className="bg-white rounded-md border border-cp-blue/20 p-3 mb-2">
            <p className="text-[13px] text-ink-1 leading-relaxed">
              {feedback.agent_tolkning}
            </p>
          </div>
          {feedback.agent_oppfolging && (
            <div className="bg-warning-soft/40 rounded-md border border-warning/30 p-3 mb-2">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-warning mb-1">
                Oppklarende spørsmål
              </p>
              <p className="text-[12.5px] text-ink-2 leading-relaxed">
                {feedback.agent_oppfolging}
              </p>
            </div>
          )}
        </div>
      </div>

      {!korrigerer ? (
        <div className="flex items-center justify-end gap-2">
          {feil && (
            <span className="text-[11.5px] text-cp-red font-medium mr-auto">
              {feil}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setKorrigerer(true)}
            disabled={arbeider}
          >
            Nei, jeg mente noe annet
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onBekreft}
            disabled={arbeider}
          >
            <Check className="h-3.5 w-3.5" />
            {arbeider ? "Lagrer …" : "Ja, det stemmer"}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            rows={3}
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
            placeholder="Skriv om så vi treffer riktig denne gangen …"
            className="w-full rounded-md border border-line-1 bg-white px-3 py-2 text-[13px] resize-y focus:outline-none focus:ring-[3px] focus:ring-cp-blue/15 focus:border-cp-blue"
            disabled={arbeider}
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            {feil && (
              <span className="text-[11.5px] text-cp-red font-medium mr-auto">
                {feil}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setKorrigerer(false)}
              disabled={arbeider}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => onKorriger(kommentar)}
              disabled={arbeider || kommentar.trim().length === 0}
            >
              {arbeider ? "Tolker på nytt …" : "Send presisering"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
