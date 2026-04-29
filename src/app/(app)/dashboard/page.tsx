import Link from "next/link";
import { Plus, Shield, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { StatusChip, type SoknadStatus } from "@/components/ui/status-chip";
import { Avatar, nameToInitials } from "@/components/ui/avatar";
import { formatCurrency, formatDate } from "@/lib/utils";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Hent profil for hilsen
  const { data: profil } = await supabase
    .from("profiles")
    .select("navn")
    .eq("id", user!.id)
    .single();

  const greeting = profil?.navn || user?.email?.split("@")[0] || "Bruker";

  // Mine søknader (bare egne)
  const { data: mineSoknader } = await supabase
    .from("soknader")
    .select("id, status")
    .eq("owner_id", user!.id);

  // Alle søknader for sekretariats-oversikt (de 5 nyeste)
  const { data: nyligeSoknader } = await supabase
    .from("soknader")
    .select(
      `
      id, tittel, program, status, soknadssum_kr, last_modified_at, owner_id,
      eier:profiles!soknader_owner_id_fkey(navn, email)
    `,
    )
    .order("last_modified_at", { ascending: false })
    .limit(5);

  const minKladdAntall =
    mineSoknader?.filter((s) => s.status === "kladd").length ?? 0;
  const mineVurdert =
    mineSoknader?.filter((s) => s.status !== "kladd").length ?? 0;

  return (
    <div className="px-10 py-10 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-ink-4 mb-2">
            Hjem
          </p>
          <h1 className="text-[32px] font-bold tracking-tight text-ink-1">
            God dag, {greeting}
          </h1>
          <p className="text-[13.5px] text-ink-4 mt-1.5">
            Internt arbeidsverktøy for sekretariatet i CP-foreningen.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/soknader/ny"
            className="inline-flex items-center gap-2 rounded-md bg-cp-blue px-4 py-2.5 text-[13px] font-medium text-white shadow-cp-sm transition hover:bg-cp-blue-dark"
          >
            <Plus className="h-4 w-4" /> Ny søknad
          </Link>
          <LogoutButton />
        </div>
      </div>

      {/* Personvern-banner */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-cp-blue-soft bg-cp-blue-tint px-4 py-3">
        <Shield className="h-4 w-4 text-cp-blue mt-0.5 shrink-0" />
        <div className="text-[12.5px] text-ink-3 leading-relaxed">
          <span className="font-medium text-ink-2">Personvern.</span> Mine tall
          er kun synlig for deg. Sekretariatets fellestall er aggregert og
          aldri brutt ned per ansatt.
        </div>
      </div>

      {/* Statistikk-kort */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          eyebrow="Mine kladder"
          value={minKladdAntall.toString()}
          hint={
            minKladdAntall === 0
              ? "Du har ingen aktive kladder."
              : minKladdAntall === 1
                ? "1 kladd venter på fortsettelse."
                : `${minKladdAntall} kladder venter på fortsettelse.`
          }
        />
        <StatCard
          eyebrow="Mine vurderinger"
          value={mineVurdert.toString()}
          hint={
            mineVurdert === 0
              ? "Vurderinger vises her etter første søknad."
              : `${mineVurdert} ${mineVurdert === 1 ? "søknad" : "søknader"} har vært gjennom vurdering.`
          }
        />
        <StatCard
          eyebrow="Sekretariatet totalt"
          value={(nyligeSoknader?.length === 5 ? "5+" : (nyligeSoknader?.length ?? 0).toString())}
          hint="Antall søknader som vises i listen under."
        />
      </div>

      {/* Nyligste søknader */}
      {nyligeSoknader && nyligeSoknader.length > 0 ? (
        <Card>
          <div className="px-5 py-4 border-b border-line-2 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-ink-1">Sist endret</h2>
            <Link
              href="/soknader"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-cp-blue hover:underline"
            >
              Se alle <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="divide-y divide-line-2">
            {nyligeSoknader.map((s) => {
              const eier = Array.isArray(s.eier) ? s.eier[0] : s.eier;
              return (
                <li key={s.id}>
                  <Link
                    href={`/soknader/${s.id}`}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-bg-sunk transition"
                  >
                    {eier && (
                      <Avatar
                        initials={nameToInitials(eier.navn || eier.email)}
                        size="md"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-ink-1 truncate">
                        {s.tittel || (
                          <span className="italic text-ink-5">Uten navn</span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-ink-4 truncate">
                        {eier?.navn || eier?.email} · {s.program} ·{" "}
                        {formatDate(s.last_modified_at)}
                      </div>
                    </div>
                    {s.soknadssum_kr !== null && (
                      <div className="text-[12.5px] tabular text-ink-3 shrink-0">
                        {formatCurrency(s.soknadssum_kr)}
                      </div>
                    )}
                    <StatusChip status={s.status as SoknadStatus} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <h3 className="text-[16px] font-semibold text-ink-1 mb-2">
                Ingen søknader ennå
              </h3>
              <p className="text-[13.5px] text-ink-4 max-w-md mx-auto leading-relaxed">
                Når du oppretter din første søknad vil den vises her, sammen
                med kollegers søknader.
              </p>
              <Link
                href="/soknader/ny"
                className="inline-flex items-center gap-2 mt-5 rounded-md bg-cp-blue px-4 py-2.5 text-[13px] font-medium text-white shadow-cp-sm transition hover:bg-cp-blue-dark"
              >
                <Plus className="h-4 w-4" /> Opprett første søknad
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="mt-8 text-[11.5px] text-ink-5 text-center">
        v0.2 · intern beta · Logget inn som {user?.email}
      </p>
    </div>
  );
}

function StatCard({
  eyebrow,
  value,
  hint,
}: {
  eyebrow: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-4 mb-2">
          {eyebrow}
        </p>
        <p className="text-[28px] font-semibold text-ink-1 tabular leading-none mb-1.5">
          {value}
        </p>
        <p className="text-[12px] text-ink-4 leading-relaxed">{hint}</p>
      </CardContent>
    </Card>
  );
}
