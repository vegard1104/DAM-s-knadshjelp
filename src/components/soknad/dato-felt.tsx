"use client";

/**
 * Dato-felt — bruker native date picker. Lagrer ISO-format (YYYY-MM-DD).
 */
export function DatoFelt({
  feltId,
  navn,
  hjelpetekst,
  pakrevd,
  verdi,
  onChange,
  min,
  max,
}: {
  feltId: string;
  navn: string;
  hjelpetekst?: string;
  pakrevd: boolean;
  verdi: string | null;
  onChange: (v: string | null) => void;
  min?: string;
  max?: string;
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

      <input
        id={feltId}
        type="date"
        value={verdi ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        min={min}
        max={max}
        className="w-full rounded-md border border-line-1 bg-white px-3 py-2.5 text-[13.5px] text-ink-1 transition tabular focus:outline-none focus:ring-[3px] focus:ring-cp-blue/15 focus:border-cp-blue"
      />
    </div>
  );
}
