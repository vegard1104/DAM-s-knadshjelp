"use client";

import { Sparkles, ChevronDown, ChevronUp, Check } from "lucide-react";
import { useState } from "react";
import type { Forbedring } from "@/types/database";

/**
 * Inline forbedringsforslag-kort som vises rett under et skjemafelt.
 * Brukes i søknadsmodus (rediger) slik at brukeren ser agentens forslag
 * mens de skriver, og kan velge å bruke forslaget eller ignorere det.
 *
 * Sammenfoldet som standard for å ikke ta opp plass i et langt skjema.
 * Ekspander for å se original vs. forslag side ved side, med
 * "Bruk forslaget"-knapp.
 */
export function ForbedringInline({
  forbedring,
  tegngrense,
  onBruk,
}: {
  forbedring: Forbedring;
  tegngrense?: number;
  onBruk: () => void;
}) {
  const [apent, setApent] = useState(false);

  return (
    <div className="mt-2 rounded-md border border-cp-blue/30 bg-cp-blue-tint overflow-hidden">
      <button
        type="button"
        onClick={() => setApent((x) => !x)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-cp-blue-soft transition"
      >
        <Sparkles className="h-3.5 w-3.5 text-cp-blue shrink-0" />
        <span className="text-[12px] font-semibold text-cp-blue-dark flex-1">
          Forslag fra Claude
        </span>
        <span className="text-[11px] text-ink-3 italic flex-1 truncate">
          {forbedring.hvorfor}
        </span>
        {apent ? (
          <ChevronUp className="h-3.5 w-3.5 text-ink-4 shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-ink-4 shrink-0" />
        )}
      </button>

      {apent && (
        <div className="border-t border-cp-blue/20 p-3 space-y-2.5 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div className="rounded border border-line-1 bg-bg-sunk p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-4 mb-1">
                Original
              </p>
              <p className="text-[12px] text-ink-2 leading-relaxed whitespace-pre-wrap">
                {forbedring.original || (
                  <span className="italic text-ink-5">(tom)</span>
                )}
              </p>
            </div>
            <div className="rounded border border-cp-blue/40 bg-cp-blue-tint p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-cp-blue mb-1">
                Forslag
              </p>
              <p className="text-[12px] text-ink-1 leading-relaxed whitespace-pre-wrap">
                {forbedring.forslag}
              </p>
              {tegngrense !== undefined && (
                <p className="text-[10px] text-ink-5 tabular mt-1.5">
                  {forbedring.forslag.length} / {tegngrense} tegn
                </p>
              )}
            </div>
          </div>

          <p className="text-[11.5px] text-ink-3 italic leading-relaxed">
            <span className="font-semibold not-italic text-ink-2">Hvorfor: </span>
            {forbedring.hvorfor}
          </p>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onBruk}
              className="inline-flex items-center gap-1.5 rounded-md bg-cp-blue px-3 py-1.5 text-[12px] font-medium text-white hover:bg-cp-blue-dark transition"
            >
              <Check className="h-3.5 w-3.5" />
              Bruk forslaget
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
