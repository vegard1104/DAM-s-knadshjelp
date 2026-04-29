import Link from "next/link";
import { Plus } from "lucide-react";

export default function SoknaderPage() {
  return (
    <div className="px-10 py-10 max-w-[1200px]">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-ink-4 mb-2">
            Søknader
          </p>
          <h1 className="text-[32px] font-bold tracking-tight text-ink-1">
            Alle søknader
          </h1>
          <p className="text-[13.5px] text-ink-4 mt-1.5">
            Sekretariatets samlede søknader. Filter og søk kommer i neste
            iterasjon.
          </p>
        </div>
        <Link
          href="/soknader/ny"
          className="inline-flex items-center gap-2 rounded-md bg-cp-blue px-4 py-2.5 text-[13px] font-medium text-white shadow-cp-sm transition hover:bg-cp-blue-dark"
        >
          <Plus className="h-4 w-4" /> Ny søknad
        </Link>
      </div>

      <div className="rounded-md border border-line-1 bg-bg-card p-12 text-center">
        <p className="text-[13.5px] text-ink-4">
          Ingen søknader ennå. Kommer i neste iterasjon — vi bygger
          Ekspress-skjemaet først.
        </p>
      </div>
    </div>
  );
}
