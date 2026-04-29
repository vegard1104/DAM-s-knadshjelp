"use client";

import { cn } from "@/lib/utils";

/**
 * Textarea med live tegnteller. Tegntelleren viser:
 *   - normalt: grå "X / Y tegn"
 *   - over 85% av grensa: gul advarsel
 *   - over 100%: rød feil + rødt flagg på selve tekstboksen
 */
export function TextareaFelt({
  feltId,
  navn,
  hjelpetekst,
  tegngrense,
  pakrevd,
  verdi,
  onChange,
  rader = 4,
}: {
  feltId: string;
  navn: string;
  hjelpetekst: string;
  tegngrense: number;
  pakrevd: boolean;
  verdi: string;
  onChange: (v: string) => void;
  rader?: number;
}) {
  const tegnAntall = verdi.length;
  const ratio = tegnAntall / tegngrense;
  const overGrense = tegnAntall > tegngrense;
  const naerGrense = ratio > 0.85;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <label
          htmlFor={feltId}
          className="text-[12.5px] font-medium text-ink-2"
        >
          <span className="text-ink-4 font-normal mr-1">{feltId}</span>
          {navn}
          {pakrevd && <span className="text-cp-red ml-0.5">*</span>}
        </label>
      </div>

      <p className="text-[11.5px] text-ink-4 leading-relaxed">{hjelpetekst}</p>

      <textarea
        id={feltId}
        rows={rader}
        value={verdi}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full rounded-md border bg-white px-3 py-2.5 text-[13.5px] text-ink-1 transition resize-y",
          "focus:outline-none focus:ring-[3px] focus:ring-cp-blue/15 focus:border-cp-blue",
          overGrense
            ? "border-red-400 bg-cp-red-tint focus:border-cp-red focus:ring-cp-red/15"
            : "border-line-1",
        )}
      />

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
          {tegnAntall.toLocaleString("nb-NO")} / {tegngrense.toLocaleString("nb-NO")} tegn
        </span>
      </div>
    </div>
  );
}
