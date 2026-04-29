import Link from "next/link";

export default function NySoknadPage() {
  return (
    <div className="px-10 py-10 max-w-[1200px]">
      <div className="mb-8">
        <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-ink-4 mb-2">
          Ny søknad
        </p>
        <h1 className="text-[32px] font-bold tracking-tight text-ink-1">
          Velg program
        </h1>
        <p className="text-[13.5px] text-ink-4 mt-1.5">
          Hvilket DAM-program søker du på? Valget bestemmer hvilken
          spesialist-agent som vurderer søknaden din.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ProgramCard
          name="Ekspress"
          beløp="5 000 – 40 000 kr"
          varighet="Maks 12 måneder"
          beskrivelse="Lokalt og frivillighetsbasert arbeid. Ett skjema, ingen vedlegg. Svar i løpet av maks 45 dager."
          available
          href="/soknader/ny/ekspress"
        />
        <ProgramCard
          name="Helse"
          beløp="40 000 – 400 000 kr"
          varighet="Maks 24 måneder"
          beskrivelse="Helse-prosjekter med større omfang. Inkluderer forskningsspor hvis %FOU > 0."
          comingSoon
        />
        <ProgramCard
          name="Utvikling"
          beløp="400 000 – 1 500 000 kr"
          varighet="To-trinns søknad"
          beskrivelse="Skissesøknad → utvidet søknad. Krever obligatoriske PDF-maler."
          comingSoon
        />
        <ProgramCard
          name="Forskning"
          beløp="1 500 000 – 3 000 000 kr"
          varighet="Frist 15. februar"
          beskrivelse="Excellence/Impact/Implementation-rammeverk. Krever ORCID og etisk vurdering."
          comingSoon
        />
      </div>
    </div>
  );
}

function ProgramCard({
  name,
  beløp,
  varighet,
  beskrivelse,
  available,
  comingSoon,
  href,
}: {
  name: string;
  beløp: string;
  varighet: string;
  beskrivelse: string;
  available?: boolean;
  comingSoon?: boolean;
  href?: string;
}) {
  const inner = (
    <div className="rounded-[10px] border border-line-1 bg-bg-card p-6 transition hover:shadow-cp-md hover:border-cp-blue/30">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-[18px] font-semibold text-ink-1">{name}</h3>
        {comingSoon && (
          <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-5 bg-line-3 px-2 py-1 rounded">
            Kommer
          </span>
        )}
      </div>
      <p className="text-[12.5px] text-ink-3 leading-relaxed mb-3">
        {beskrivelse}
      </p>
      <dl className="text-[12px] text-ink-4 space-y-1">
        <div className="flex gap-2">
          <dt className="font-medium text-ink-3 w-20">Beløp:</dt>
          <dd className="tabular">{beløp}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium text-ink-3 w-20">Varighet:</dt>
          <dd>{varighet}</dd>
        </div>
      </dl>
    </div>
  );

  if (available && href) {
    return <Link href={href}>{inner}</Link>;
  }
  return <div className="opacity-60 cursor-not-allowed">{inner}</div>;
}
