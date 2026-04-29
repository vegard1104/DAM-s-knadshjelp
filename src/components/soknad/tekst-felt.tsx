"use client";

import { cn } from "@/lib/utils";

/**
 * Single-line tekstfelt — for prosjektnavn og lignende. Bruker samme
 * tegnteller-logikk som TextareaFelt.
 */
export function TekstFelt({
  feltId,
  navn,
  hjelpetekst,
  tegngrense,
  pakrevd,
  verdi,
  onChange,
  placeholder,
}: {
  feltId: string;
  navn: string;
  hjelpetekst?: string;
  tegngrense?: number;
  pakrevd: boolean;
  verdi: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const tegnAntall = verdi.length;
  const overGrense = tegngrense !== undefined && tegnAntall > tegngrense;
  const naerGrense =
    tegngrense !== undefined && tegnAntall / tegngrense > 0.85;

  return (
    <div className="space-y-1.5">
      <label htmlFor={feltId} className="text-[12.5px] font-medium text-ink-2">
        {feltId !== navn && (
          <span className="text-ink-4 font-normal mr-1">{feltId}</span>
        )}
        {navn}
        {pakrevd && <span className="text-cp-red ml-0.5">*</span>}
      </label>

      {hjelpetekst && (
        <p className="text-[11.5px] text-ink-4 leading-relaxed">
          {hjelpetekst}
        </p>
      )}

      <input
        id={feltId}
        type="text"
        value={verdi}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-md border bg-white px-3 py-2.5 text-[13.5px] text-ink-1 transition placeholder:text-ink-5",
          "focus:outline-none focus:ring-[3px] focus:ring-cp-blue/15 focus:border-cp-blue",
          overGrense
            ? "border-red-400 bg-cp-red-tint focus:border-cp-red focus:ring-cp-red/15"
            : "border-line-1",
        )}
      />

      {tegngrense !== undefined && (
        <div className="flex items-center justify-end">
          <span
            className={cn(
              "text-[11px] tabular",
              overGrense
                ? "text-cp-red font-semibold"
                : naerGrense
                  ? "text-warning font-semibold"
                  : "text-ink-5",
            )}
          >
            {tegnAntall} / {tegngrense} tegn
          </span>
        </div>
      )}
    </div>
  );
}
