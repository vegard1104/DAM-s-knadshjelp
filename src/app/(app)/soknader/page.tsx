import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatusChip } from "@/components/ui/status-chip";
import { Avatar, nameToInitials } from "@/components/ui/avatar";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SoknaderPage() {
  const supabase = await createClient();

  // Hent alle søknader (sekretariatet ser alle — RLS i Supabase). Joiner
  // mot profiles for å få eier-navn.
  const { data: soknader, error } = await supabase
    .from("soknader")
    .select(
      `
      id, tittel, program, status, soknadssum_kr, totalbudsjett_kr,
      oppstart_dato, last_modified_at, owner_id,
      eier:profiles!soknader_owner_id_fkey(navn, email)
    `,
    )
    .order("last_modified_at", { ascending: false });

  if (error) {
    console.error("[SoknaderPage] feil:", error);
  }

  return (
    <div className="px-10 py-10 max-w-[1100px]">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-ink-4 mb-2">
            Søknader
          </p>
          <h1 className="text-[32px] font-bold tracking-tight text-ink-1">
            Alle søknader
          </h1>
          <p className="text-[13.5px] text-ink-4 mt-1.5">
            Sekretariatets samlede søknader. Du ser alle — kun eier (eller
            admin) kan redigere.
          </p>
        </div>
        <Link
          href="/soknader/ny"
          className="inline-flex items-center gap-2 rounded-md bg-cp-blue px-4 py-2.5 text-[13px] font-medium text-white shadow-cp-sm transition hover:bg-cp-blue-dark"
        >
          <Plus className="h-4 w-4" /> Ny søknad
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-cp-red-soft bg-cp-red-tint px-4 py-3 text-[12.5px] text-cp-red">
          Kunne ikke laste søknadene: {error.message}
        </div>
      )}

      {!soknader || soknader.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-[10px] border border-line-1 bg-bg-card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-sunk">
              <tr className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-4">
                <th className="px-4 py-3 text-left">Tittel</th>
                <th className="px-4 py-3 text-left">Eier</th>
                <th className="px-4 py-3 text-left">Program</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Søknadssum</th>
                <th className="px-4 py-3 text-left">Sist endret</th>
              </tr>
            </thead>
            <tbody>
              {soknader.map((s) => {
                // eier kan være null i RLS-edge-cases
                const eier = Array.isArray(s.eier) ? s.eier[0] : s.eier;
                return (
                  <tr
                    key={s.id}
                    className="border-t border-line-2 hover:bg-bg-sunk transition"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/soknader/${s.id}`}
                        className="font-medium text-ink-1 hover:text-cp-blue"
                      >
                        {s.tittel || (
                          <span className="italic text-ink-5">Uten navn</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {eier && (
                        <span className="inline-flex items-center gap-2 text-[12.5px] text-ink-3">
                          <Avatar
                            initials={nameToInitials(
                              eier.navn || eier.email,
                            )}
                            size="sm"
                          />
                          {eier.navn || eier.email}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-ink-3 capitalize">
                      {s.program}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-right tabular text-ink-2">
                      {s.soknadssum_kr !== null
                        ? formatCurrency(s.soknadssum_kr)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-ink-4 tabular">
                      {formatDate(s.last_modified_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[10px] border border-line-1 bg-bg-card p-12 text-center">
      <h3 className="text-[16px] font-semibold text-ink-1 mb-2">
        Ingen søknader ennå
      </h3>
      <p className="text-[13.5px] text-ink-4 max-w-md mx-auto leading-relaxed">
        Når du oppretter din første søknad vises den her, sammen med
        kollegers søknader i sekretariatet.
      </p>
      <Link
        href="/soknader/ny"
        className="inline-flex items-center gap-2 mt-5 rounded-md bg-cp-blue px-4 py-2.5 text-[13px] font-medium text-white shadow-cp-sm transition hover:bg-cp-blue-dark"
      >
        <Plus className="h-4 w-4" /> Opprett første søknad
      </Link>
    </div>
  );
}
