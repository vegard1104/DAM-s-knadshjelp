"use client";

import { useState, useTransition } from "react";
import { Sparkles, Wand2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AutoFyllResultatRespons } from "@/app/(app)/soknader/ny/ekspress/actions";

/**
 * Panel for auto-fyll: stor textarea hvor brukeren limer inn fritekst,
 * og en knapp som kaller Claude og fyller ut skjemaet.
 *
 * Vises sammenfoldet som standard (et lite banner med "Auto-fyll fra
 * tekst"-knapp), så det ikke tar opp plass i lange skjemaer der
 * brukeren allerede har fyllt ut for hånd.
 */

const MIN_LENGDE = 30;

export function AutoFyllPanel({
  onResultat,
  autoFyllAction,
}: {
  onResultat: (data: NonNullable<Extract<AutoFyllResultatRespons, { ok: true }>["data"]>) => void;
  autoFyllAction: (tekst: string) => Promise<AutoFyllResultatRespons>;
}) {
  const [apent, setApent] = useState(false);
  const [tekst, setTekst] = useState("");
  const [arbeider, startArbeid] = useTransition();
  const [feilmelding, setFeilmelding] = useState<string | null>(null);
  const [kommentar, setKommentar] = useState<string | null>(null);

  function utforAutoFyll() {
    setFeilmelding(null);
    setKommentar(null);

    startArbeid(async () => {
      const resultat = await autoFyllAction(tekst);
      if (!resultat.ok) {
        setFeilmelding(resultat.feil);
        return;
      }
      onResultat(resultat.data);
      setKommentar(resultat.data.kommentar_fra_agent || null);
      // La textarea stå urørt — brukeren kan justere og kjøre på nytt
    });
  }

  if (!apent) {
    return (
      <button
        type="button"
        onClick={() => setApent(true)}
        className="w-full rounded-[10px] border border-dashed border-cp-blue/40 bg-cp-blue-tint hover:bg-cp-blue-soft transition px-5 py-4 flex items-center gap-3 text-left"
      >
        <Wand2 className="h-5 w-5 text-cp-blue shrink-0" />
        <div className="flex-1">
          <div className="text-[13.5px] font-semibold text-ink-1">
            Lim inn tekst og fyll ut skjemaet automatisk
          </div>
          <div className="text-[12px] text-ink-3 mt-0.5">
            Har du en e-post, gamle notater eller en tidligere søknad? Lim
            den inn — Claude trekker ut feltene og fyller skjemaet for deg.
          </div>
        </div>
        <ChevronDown className="h-4 w-4 text-ink-4 shrink-0" />
      </button>
    );
  }

  return (
    <div className="rounded-[10px] border border-cp-blue/30 bg-cp-blue-tint p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Wand2 className="h-5 w-5 text-cp-blue mt-0.5 shrink-0" />
          <div>
            <h3 className="text-[14px] font-semibold text-ink-1">
              Auto-fyll fra tekst
            </h3>
            <p className="text-[12px] text-ink-3 mt-0.5 leading-relaxed max-w-prose">
              Lim inn det du har. Det kan være rotete — Claude håndterer
              e-post-utveksling, notater eller tidligere søknader. Felt
              som ikke kan fylles ut blir markert tomme.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setApent(false)}
          className="text-ink-4 hover:text-ink-1 shrink-0"
          aria-label="Lukk auto-fyll-panel"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>

      <textarea
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        placeholder="Lim inn fritekst her — beskrivelse, notater, e-post-utveksling, tidligere søknad &#8230;"
        rows={8}
        className="w-full rounded-md border border-line-1 bg-white px-3 py-2.5 text-[13px] text-ink-1 placeholder:text-ink-5 transition resize-y focus:outline-none focus:ring-[3px] focus:ring-cp-blue/15 focus:border-cp-blue"
        disabled={arbeider}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="text-[11.5px] text-ink-4 tabular">
          {tekst.length.toLocaleString("nb-NO")} tegn
          {tekst.length > 0 && tekst.length < MIN_LENGDE && (
            <span className="text-warning ml-2">
              · trenger minst {MIN_LENGDE} tegn
            </span>
          )}
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={utforAutoFyll}
          disabled={arbeider || tekst.trim().length < MIN_LENGDE}
        >
          <Sparkles className={cn("h-4 w-4", arbeider && "animate-pulse")} />
          {arbeider ? "Fyller ut …" : "Fyll ut skjemaet"}
        </Button>
      </div>

      {feilmelding && (
        <div className="rounded-md border border-cp-red-soft bg-white px-3 py-2 text-[12.5px] text-cp-red">
          {feilmelding}
        </div>
      )}

      {kommentar && (
        <div className="rounded-md border border-cp-blue-soft bg-white px-3 py-2 text-[12.5px] text-ink-3 leading-relaxed">
          <span className="font-medium text-ink-1">Note fra agenten:</span>{" "}
          {kommentar}
        </div>
      )}
    </div>
  );
}
