import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EkspressSkjema } from "@/components/soknad/ekspress-skjema";
import { autoFyllEkspressKladd } from "../../ny/ekspress/actions";
import {
  vurderSoknadAction,
  oppdaterEkspressSoknad,
} from "../actions";
import type { Forbedring } from "@/types/database";
import type { LagreKladdInput } from "../../ny/ekspress/actions";

export const dynamic = "force-dynamic";

export default async function RedigerSoknadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: soknadId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: soknad } = await supabase
    .from("soknader")
    .select("*")
    .eq("id", soknadId)
    .single();

  if (!soknad) notFound();

  if (soknad.program !== "ekspress") {
    return (
      <div className="px-10 py-10 max-w-[860px]">
        <p className="text-[14px] text-ink-3">
          Foreløpig kan kun Ekspress-søknader redigeres her — Helse,
          Utvikling og Forskning kommer senere.
        </p>
      </div>
    );
  }

  // Bare eier eller admin kan redigere — RLS sier også dette, men vi
  // sjekker UI-side for å gi tydelig feilmelding.
  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const erEier = soknad.owner_id === user.id;
  const erAdmin = profil?.role === "admin";

  if (!erEier && !erAdmin) {
    return (
      <div className="px-10 py-10 max-w-[860px]">
        <Link
          href={`/soknader/${soknadId}`}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-4 hover:text-ink-1 mb-4"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Tilbake
        </Link>
        <h1 className="text-[24px] font-bold text-ink-1 mb-2">
          Ingen tilgang
        </h1>
        <p className="text-[14px] text-ink-3">
          Du kan se denne søknaden, men ikke redigere den. Kun eier (eller
          admin) kan endre.
        </p>
      </div>
    );
  }

  // Hent siste vurderings forbedringer
  const { data: vurdering } = await supabase
    .from("vurderinger")
    .select("forbedringer, versjon, snitt_score, anbefaling")
    .eq("soknad_id", soknadId)
    .order("versjon", { ascending: false })
    .limit(1)
    .single();

  const forbedringer = (vurdering?.forbedringer ?? []) as Forbedring[];

  // Server Action wrapper som binder soknadId til oppdaterAction.
  // Må kjøres som "use server" for å passe med form-komponentens signatur.
  async function lagreEndringer(input: LagreKladdInput) {
    "use server";
    return oppdaterEkspressSoknad(soknadId, input);
  }

  // Initielle verdier — hovedsakelig hentet fra felter, men datoer og
  // søknadssum ligger som egne kolonner og må mappes inn.
  const felter = soknad.felter as Record<string, unknown>;
  const initielleVerdier: Record<string, unknown> = {
    ...felter,
    prosjektnavn: felter.prosjektnavn ?? soknad.tittel,
  };

  return (
    <div className="px-10 py-10 max-w-[860px]">
      <Link
        href={`/soknader/${soknadId}`}
        className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-4 hover:text-ink-1 mb-4"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Tilbake til søknaden
      </Link>

      <div className="mb-8">
        <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-ink-4 mb-2">
          Søknadsmodus · Rediger Ekspress
        </p>
        <h1 className="text-[28px] font-bold tracking-tight text-ink-1">
          {soknad.tittel || "Uten navn"}
        </h1>
        <p className="text-[13.5px] text-ink-4 mt-1.5 max-w-prose">
          Rediger teksten basert på Claudes forslag. Klikk
          &laquo;Vurder på nytt&raquo; når du er ferdig — det lager en ny
          versjon (v{(vurdering?.versjon ?? 0) + 1}) og lar deg se hvordan
          scoren utvikler seg.
        </p>
      </div>

      {/* Status om eksisterende vurdering */}
      {vurdering && forbedringer.length > 0 && (
        <div className="mb-6 rounded-md border border-cp-blue-soft bg-cp-blue-tint px-4 py-3 flex items-start gap-3">
          <Sparkles className="h-4 w-4 text-cp-blue mt-0.5 shrink-0" />
          <div className="text-[12.5px] text-ink-2 leading-relaxed">
            <span className="font-semibold">
              Forslag fra v{vurdering.versjon} (snitt{" "}
              {vurdering.snitt_score?.toFixed(2)} / 7).
            </span>{" "}
            Klikk &laquo;Forslag fra Claude&raquo;-banneret under hvert felt
            for å se hva agenten foreslo. Bruk forslaget eller skriv din
            egen versjon.
          </div>
        </div>
      )}

      <EkspressSkjema
        modus="rediger"
        forbedringer={forbedringer}
        initielleVerdier={initielleVerdier}
        initiellSoknadssum={soknad.soknadssum_kr}
        initiellOppstart={soknad.oppstart_dato}
        initiellAvslutt={soknad.avslutt_dato}
        lagreAction={lagreEndringer}
        autoFyllAction={autoFyllEkspressKladd}
        vurderAction={vurderSoknadAction}
      />
    </div>
  );
}
