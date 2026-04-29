"use client";

import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils";

export type BudsjettRad = {
  type: "utgift" | "inntekt";
  post: string;
  belop: number | null;
};

export type Budsjett = {
  rader: BudsjettRad[];
};

const TOMME_RADER: BudsjettRad[] = [
  { type: "utgift", post: "", belop: null },
];

/**
 * Budsjett-tabell. Bruker kan legge til/fjerne rader. Skiller mellom
 * utgifter og inntekter slik at vi kan beregne totaler og søknadssum
 * (= utgifter - andre inntekter).
 *
 * Returnerer hele budsjettet som ett objekt — lagres som JSON i
 * soknader.felter.
 */
export function BudsjettFelt({
  feltId,
  hjelpetekst,
  budsjett,
  soknadssum,
  onBudsjettChange,
  onSoknadssumChange,
}: {
  feltId: string;
  hjelpetekst: string;
  budsjett: Budsjett;
  soknadssum: number | null;
  onBudsjettChange: (b: Budsjett) => void;
  onSoknadssumChange: (n: number | null) => void;
}) {
  const rader = budsjett.rader.length > 0 ? budsjett.rader : TOMME_RADER;
  const utgifter = rader
    .filter((r) => r.type === "utgift")
    .reduce((sum, r) => sum + (r.belop ?? 0), 0);
  const inntekter = rader
    .filter((r) => r.type === "inntekt")
    .reduce((sum, r) => sum + (r.belop ?? 0), 0);

  const totalbudsjett = utgifter;
  const sokeAndel = soknadssum && totalbudsjett > 0
    ? soknadssum / totalbudsjett
    : null;
  const oppfyllerEnTredjedel = sokeAndel === null || sokeAndel >= 1 / 3;

  function oppdaterRad(idx: number, endring: Partial<BudsjettRad>) {
    const nyeRader = [...rader];
    nyeRader[idx] = { ...nyeRader[idx], ...endring };
    onBudsjettChange({ rader: nyeRader });
  }

  function leggTilRad(type: "utgift" | "inntekt") {
    onBudsjettChange({
      rader: [...rader, { type, post: "", belop: null }],
    });
  }

  function fjernRad(idx: number) {
    if (rader.length === 1) return;
    onBudsjettChange({ rader: rader.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-2">
      <label className="text-[12.5px] font-medium text-ink-2">
        <span className="text-ink-4 font-normal mr-1">{feltId}</span>
        Budsjett <span className="text-cp-red ml-0.5">*</span>
      </label>
      <p className="text-[11.5px] text-ink-4 leading-relaxed">{hjelpetekst}</p>

      <div className="rounded-md border border-line-1 overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead className="bg-bg-sunk">
            <tr className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-4">
              <th className="px-3 py-2 text-left w-[110px]">Type</th>
              <th className="px-3 py-2 text-left">Post</th>
              <th className="px-3 py-2 text-right w-[150px]">Beløp (kr)</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rader.map((rad, idx) => (
              <tr key={idx} className="border-t border-line-2">
                <td className="px-3 py-1.5">
                  <select
                    value={rad.type}
                    onChange={(e) =>
                      oppdaterRad(idx, {
                        type: e.target.value as "utgift" | "inntekt",
                      })
                    }
                    className="w-full bg-transparent text-[12.5px] text-ink-2 focus:outline-none"
                  >
                    <option value="utgift">Utgift</option>
                    <option value="inntekt">Inntekt</option>
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="text"
                    value={rad.post}
                    onChange={(e) =>
                      oppdaterRad(idx, { post: e.target.value })
                    }
                    placeholder={
                      rad.type === "utgift" ? "F.eks. Honorar foredragsholder" : "F.eks. Egne midler"
                    }
                    className="w-full bg-transparent text-[12.5px] text-ink-1 placeholder:text-ink-5 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={rad.belop ?? ""}
                    onChange={(e) =>
                      oppdaterRad(idx, {
                        belop: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="w-full bg-transparent text-[12.5px] text-ink-1 tabular text-right focus:outline-none"
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => fjernRad(idx)}
                    disabled={rader.length === 1}
                    className="text-ink-5 hover:text-cp-red disabled:opacity-30"
                    aria-label="Fjern rad"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-bg-sunk text-[12px] tabular">
            <tr className="border-t border-line-1">
              <td colSpan={2} className="px-3 py-2 text-right font-medium text-ink-3">
                Sum utgifter (totalbudsjett)
              </td>
              <td className="px-3 py-2 text-right font-semibold text-ink-1">
                {formatNumber(utgifter)}
              </td>
              <td></td>
            </tr>
            {inntekter > 0 && (
              <tr className="border-t border-line-2">
                <td colSpan={2} className="px-3 py-2 text-right font-medium text-ink-3">
                  Andre inntekter
                </td>
                <td className="px-3 py-2 text-right font-semibold text-ink-1">
                  {formatNumber(inntekter)}
                </td>
                <td></td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => leggTilRad("utgift")}
          className="inline-flex items-center gap-1.5 rounded-md border border-line-1 bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-3 hover:bg-bg-sunk"
        >
          <Plus className="h-3.5 w-3.5" /> Legg til utgift
        </button>
        <button
          type="button"
          onClick={() => leggTilRad("inntekt")}
          className="inline-flex items-center gap-1.5 rounded-md border border-line-1 bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-3 hover:bg-bg-sunk"
        >
          <Plus className="h-3.5 w-3.5" /> Legg til inntekt
        </button>
      </div>

      {/* Søknadssum og 1/3-validering */}
      <div className="rounded-md border border-line-1 bg-bg-card p-4 space-y-2">
        <label className="text-[12.5px] font-medium text-ink-2">
          Søknadssum til Stiftelsen Dam <span className="text-cp-red ml-0.5">*</span>
        </label>
        <p className="text-[11.5px] text-ink-4 leading-relaxed">
          Beløpet du søker DAM om. Må være minst 1/3 av totalbudsjettet (DAM-regel).
        </p>
        <div className="flex items-center gap-3">
          <div className="relative w-48">
            <input
              type="number"
              inputMode="numeric"
              value={soknadssum ?? ""}
              onChange={(e) =>
                onSoknadssumChange(
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              className={cn(
                "w-full rounded-md border bg-white px-3 py-2.5 text-[13.5px] text-ink-1 tabular focus:outline-none focus:ring-[3px] focus:ring-cp-blue/15 focus:border-cp-blue",
                !oppfyllerEnTredjedel ? "border-red-400 bg-cp-red-tint" : "border-line-1",
              )}
            />
          </div>
          <span className="text-[12.5px] text-ink-4">kr</span>

          {sokeAndel !== null && (
            <span
              className={cn(
                "text-[11.5px] tabular",
                oppfyllerEnTredjedel ? "text-good" : "text-cp-red font-semibold",
              )}
            >
              {Math.round(sokeAndel * 100)}% av totalbudsjett
              {!oppfyllerEnTredjedel && " — for lav (DAM krever ≥ 33%)"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
