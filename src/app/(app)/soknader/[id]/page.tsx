import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatusChip } from "@/components/ui/status-chip";
import { Avatar, nameToInitials } from "@/components/ui/avatar";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SoknadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: soknad } = await supabase
    .from("soknader")
    .select("*")
    .eq("id", id)
    .single();

  if (!soknad) {
    notFound();
  }

  const { data: eier } = await supabase
    .from("profiles")
    .select("navn, email")
    .eq("id", soknad.owner_id)
    .single();

  return (
    <div className="px-10 py-10 max-w-[860px]">
      <Link
        href="/soknader"
        className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-4 hover:text-ink-1 mb-4"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Tilbake til alle søknader
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-ink-4 mb-2">
            {soknad.program}
          </p>
          <h1 className="text-[28px] font-bold tracking-tight text-ink-1">
            {soknad.tittel || "Uten navn"}
          </h1>
        </div>
        <StatusChip status={soknad.status} />
      </div>

      <div className="rounded-[10px] border border-line-1 bg-bg-card p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4 text-[12.5px]">
          <Meta label="Eier">
            {eier && (
              <span className="inline-flex items-center gap-2">
                <Avatar initials={nameToInitials(eier.navn || eier.email)} size="sm" />
                {eier.navn || eier.email}
              </span>
            )}
          </Meta>
          <Meta label="Opprettet">{formatDate(soknad.created_at)}</Meta>
          <Meta label="Sist endret">{formatDate(soknad.last_modified_at)}</Meta>
          <Meta label="Status"><StatusChip status={soknad.status} /></Meta>
          {soknad.soknadssum_kr !== null && (
            <Meta label="Søknadssum">
              <span className="tabular">{formatCurrency(soknad.soknadssum_kr)}</span>
            </Meta>
          )}
          {soknad.totalbudsjett_kr !== null && (
            <Meta label="Totalbudsjett">
              <span className="tabular">{formatCurrency(soknad.totalbudsjett_kr)}</span>
            </Meta>
          )}
          {soknad.oppstart_dato && (
            <Meta label="Oppstart">{formatDate(soknad.oppstart_dato)}</Meta>
          )}
          {soknad.avslutt_dato && (
            <Meta label="Avslutning">{formatDate(soknad.avslutt_dato)}</Meta>
          )}
        </div>

        <div className="border-t border-line-2 pt-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-4 mb-2">
            Skjemafelt (rå JSON)
          </p>
          <pre className="bg-bg-sunk rounded-md p-3 text-[11.5px] text-ink-3 overflow-x-auto whitespace-pre-wrap font-mono">
            {JSON.stringify(soknad.felter, null, 2)}
          </pre>
        </div>
      </div>

      <p className="mt-4 text-[11.5px] text-ink-5 text-center">
        Detaljvisning — full redigering, vurderingsknapp og DAM-svar-opplasting kommer i neste runde.
      </p>
    </div>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-4 mb-1">
        {label}
      </dt>
      <dd className="text-ink-2">{children}</dd>
    </div>
  );
}
