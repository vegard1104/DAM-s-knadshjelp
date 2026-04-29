import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { EkspressSkjema } from "@/components/soknad/ekspress-skjema";
import { lagreEkspressKladd } from "./actions";

export const dynamic = "force-dynamic";

export default function NyEkspressSoknadPage() {
  return (
    <div className="px-10 py-10 max-w-[860px]">
      {/* Brødsmule */}
      <Link
        href="/soknader/ny"
        className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-4 hover:text-ink-1 mb-4"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Tilbake til programvalg
      </Link>

      {/* Header */}
      <div className="mb-8">
        <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-ink-4 mb-2">
          Ny søknad · Ekspress
        </p>
        <h1 className="text-[32px] font-bold tracking-tight text-ink-1">
          Søknadsskjema
        </h1>
        <p className="text-[13.5px] text-ink-4 mt-1.5 max-w-prose">
          Strukturen følger Damnett. Du kan lagre kladd når som helst og
          komme tilbake senere — vi bygger auto-fyll fra limt-inn tekst
          og Claude-vurdering i neste runde.
        </p>
      </div>

      <EkspressSkjema lagreKladdAction={lagreEkspressKladd} />
    </div>
  );
}
