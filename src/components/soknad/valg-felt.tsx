"use client";

import { cn } from "@/lib/utils";

/**
 * Avkrysningsfelt for flere valg, med valgfri makgrense (f.eks. maks 3
 * for Ekspress 3.4.1). Hvis maksValg=1 oppfører det seg som radio.
 */
export function ValgFelt({
  feltId,
  navn,
  hjelpetekst,
  pakrevd,
  valgteKoder,
  valg,
  maksValg,
  onChange,
}: {
  feltId: string;
  navn: string;
  hjelpetekst?: string;
  pakrevd: boolean;
  valgteKoder: string[];
  valg: { kode: string; etikett: string }[];
  maksValg?: number;
  onChange: (v: string[]) => void;
}) {
  const overMaks = maksValg !== undefined && valgteKoder.length > maksValg;
  const erRadio = maksValg === 1;

  function toggle(kode: string) {
    if (erRadio) {
      onChange([kode]);
      return;
    }
    if (valgteKoder.includes(kode)) {
      onChange(valgteKoder.filter((k) => k !== kode));
    } else {
      // Hvis vi er på maks, ignorer (eller bytt ut eldste — vi velger ignorer)
      if (maksValg !== undefined && valgteKoder.length >= maksValg) return;
      onChange([...valgteKoder, kode]);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[12.5px] font-medium text-ink-2">
          <span className="text-ink-4 font-normal mr-1">{feltId}</span>
          {navn}
          {pakrevd && <span className="text-cp-red ml-0.5">*</span>}
        </label>
        {maksValg !== undefined && !erRadio && (
          <span
            className={cn(
              "text-[11px] tabular",
              overMaks
                ? "text-cp-red font-semibold"
                : valgteKoder.length === maksValg
                  ? "text-ink-3"
                  : "text-ink-5",
            )}
          >
            {valgteKoder.length} / {maksValg} valgt
          </span>
        )}
      </div>

      {hjelpetekst && (
        <p className="text-[11.5px] text-ink-4 leading-relaxed">
          {hjelpetekst}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {valg.map((opt) => {
          const valgt = valgteKoder.includes(opt.kode);
          const disabled =
            !valgt &&
            !erRadio &&
            maksValg !== undefined &&
            valgteKoder.length >= maksValg;
          return (
            <label
              key={opt.kode}
              className={cn(
                "flex items-center gap-2.5 rounded-md border px-3 py-2 text-[12.5px] transition cursor-pointer",
                valgt
                  ? "border-cp-blue bg-cp-blue-tint text-ink-1"
                  : disabled
                    ? "border-line-2 bg-line-3 text-ink-5 cursor-not-allowed"
                    : "border-line-1 bg-white text-ink-2 hover:bg-bg-sunk",
              )}
            >
              <input
                type={erRadio ? "radio" : "checkbox"}
                name={feltId}
                checked={valgt}
                onChange={() => toggle(opt.kode)}
                disabled={disabled}
                className="h-4 w-4 accent-cp-blue"
              />
              {opt.etikett}
            </label>
          );
        })}
      </div>
    </div>
  );
}
