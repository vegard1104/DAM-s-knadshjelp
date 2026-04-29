"use client";

/**
 * Tall-felt for antall, beløp, osv. Returnerer alltid number eller null.
 */
export function TallFelt({
  feltId,
  navn,
  hjelpetekst,
  pakrevd,
  verdi,
  onChange,
  suffiks,
  min,
  max,
}: {
  feltId: string;
  navn: string;
  hjelpetekst?: string;
  pakrevd: boolean;
  verdi: number | null;
  onChange: (v: number | null) => void;
  suffiks?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={feltId} className="text-[12.5px] font-medium text-ink-2">
        <span className="text-ink-4 font-normal mr-1">{feltId}</span>
        {navn}
        {pakrevd && <span className="text-cp-red ml-0.5">*</span>}
      </label>

      {hjelpetekst && (
        <p className="text-[11.5px] text-ink-4 leading-relaxed">
          {hjelpetekst}
        </p>
      )}

      <div className="flex items-stretch">
        <input
          id={feltId}
          type="number"
          inputMode="numeric"
          value={verdi ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? null : Number(v));
          }}
          min={min}
          max={max}
          className="w-full rounded-md border border-line-1 bg-white px-3 py-2.5 text-[13.5px] text-ink-1 transition tabular focus:outline-none focus:ring-[3px] focus:ring-cp-blue/15 focus:border-cp-blue"
        />
        {suffiks && (
          <span className="ml-2 inline-flex items-center text-[12.5px] text-ink-4">
            {suffiks}
          </span>
        )}
      </div>
    </div>
  );
}
