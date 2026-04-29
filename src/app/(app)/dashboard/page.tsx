import Link from "next/link";
import { Plus, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { LogoutButton } from "./logout-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const greeting = user?.email?.split("@")[0] ?? "Bruker";

  return (
    <div className="px-10 py-10 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-ink-4 mb-2">
            Hjem
          </p>
          <h1 className="text-[32px] font-bold tracking-tight text-ink-1">
            God morgen, {greeting}
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

      {/* Personvern-banner — designsystemets avsnitt 8 */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-cp-blue-soft bg-cp-blue-tint px-4 py-3">
        <Shield className="h-4 w-4 text-cp-blue mt-0.5 shrink-0" />
        <div className="text-[12.5px] text-ink-3 leading-relaxed">
          <span className="font-medium text-ink-2">Personvern.</span> Mine tall
          er kun synlig for deg. Sekretariatets fellestall er aggregert og
          aldri brutt ned per ansatt.
        </div>
      </div>

      {/* Statistikk-kort: foreløpig tomme placeholders.
          Disse fylles med ekte data når Supabase-skjemaet er på plass. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          eyebrow="Mine kladder"
          value="—"
          hint="Du har ingen aktive kladder."
        />
        <StatCard
          eyebrow="Mine vurderinger"
          value="—"
          hint="Vurderinger vises her etter første søknad."
        />
        <StatCard
          eyebrow="Min snitt-score"
          value="—"
          hint="Snittet bygges når du har ≥ 3 vurderinger."
        />
      </div>

      {/* Tom liste — placeholder */}
      <Card>
        <CardContent>
          <div className="text-center py-12">
            <h3 className="text-[16px] font-semibold text-ink-1 mb-2">
              Ingen søknader ennå
            </h3>
            <p className="text-[13.5px] text-ink-4 max-w-md mx-auto leading-relaxed">
              Når du oppretter din første søknad vil den vises her, sammen med
              kollegers søknader i sekretariatet.
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

      {/* Status-fotnote for testfasen */}
      <p className="mt-8 text-[11.5px] text-ink-5 text-center">
        v0.1 · intern beta · Logget inn som {user?.email}
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
