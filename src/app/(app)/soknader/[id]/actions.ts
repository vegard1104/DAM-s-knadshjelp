"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { vurderEkspressSoknad } from "@/lib/claude/ekspress-vurdering";

export type VurderResultat =
  | { ok: true; vurderingId: string; soknadId: string }
  | { ok: false; feil: string };

/**
 * Vurderer en eksisterende søknad mot rubrikken (system-prompten),
 * lagrer resultatet i vurderinger-tabellen, og oppdaterer søknadens
 * status til "vurdert" hvis den var "kladd".
 *
 * Krever at brukeren er innlogget og at RLS slipper gjennom INSERT
 * på vurderinger (eier av søknaden eller admin).
 */
export async function vurderSoknadAction(
  soknadId: string,
): Promise<VurderResultat> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, feil: "Du må være innlogget for å vurdere en søknad." };
  }

  // 1. Hent søknaden
  const { data: soknad, error: soknadFeil } = await supabase
    .from("soknader")
    .select("*")
    .eq("id", soknadId)
    .single();

  if (soknadFeil || !soknad) {
    return {
      ok: false,
      feil: `Kunne ikke finne søknaden: ${soknadFeil?.message ?? "ukjent"}`,
    };
  }

  if (soknad.program !== "ekspress") {
    return {
      ok: false,
      feil:
        "Foreløpig kan kun Ekspress-søknader vurderes — Helse, Utvikling og Forskning kommer senere.",
    };
  }

  // 2. Kall Claude
  let resultat;
  try {
    resultat = await vurderEkspressSoknad({
      tittel: soknad.tittel,
      felter: soknad.felter as Record<string, unknown>,
      soknadssum_kr: soknad.soknadssum_kr,
      totalbudsjett_kr: soknad.totalbudsjett_kr,
      oppstart_dato: soknad.oppstart_dato,
      avslutt_dato: soknad.avslutt_dato,
    });
  } catch (error) {
    console.error("[vurderSoknadAction] Claude-feil:", error);
    const melding =
      error instanceof Error ? error.message : "Ukjent feil mot Claude API.";
    return { ok: false, feil: `Vurdering feilet: ${melding}` };
  }

  // 3. Finn neste versjon (1 hvis ingen tidligere, eller maks+1)
  const { data: tidligere } = await supabase
    .from("vurderinger")
    .select("versjon")
    .eq("soknad_id", soknadId)
    .order("versjon", { ascending: false })
    .limit(1);

  const nesteVersjon = (tidligere?.[0]?.versjon ?? 0) + 1;

  // 4. Lagre vurderingen
  const { data: vurdering, error: vurderingFeil } = await supabase
    .from("vurderinger")
    .insert({
      soknad_id: soknadId,
      versjon: nesteVersjon,
      score_soliditet: resultat.score_soliditet,
      score_virkning: resultat.score_virkning,
      score_gjennomforing: resultat.score_gjennomforing,
      score_prioriteringer: resultat.score_prioriteringer,
      anbefaling: resultat.anbefaling,
      begrunnelse: lagBegrunnelseSamlet(resultat),
      forbedringer: resultat.forbedringer,
      rode_flagg: resultat.rode_flagg,
      modell_brukt: resultat.modell_brukt,
      system_prompt_versjon: resultat.system_prompt_versjon,
      ra_response: resultat.ra_response,
    })
    .select("id")
    .single();

  if (vurderingFeil || !vurdering) {
    console.error("[vurderSoknadAction] Lagring feilet:", vurderingFeil);
    return {
      ok: false,
      feil: `Lagring av vurdering feilet: ${vurderingFeil?.message}`,
    };
  }

  // 5. Oppdater søknadens status til "vurdert" hvis den var "kladd"
  if (soknad.status === "kladd") {
    await supabase
      .from("soknader")
      .update({ status: "vurdert" })
      .eq("id", soknadId);
  }

  revalidatePath(`/soknader/${soknadId}`);
  revalidatePath("/soknader");
  revalidatePath("/dashboard");

  return { ok: true, vurderingId: vurdering.id, soknadId };
}

/**
 * Lager en samlet markdown-formatert begrunnelse fra agentens
 * strukturerte svar — egnet til å lagre i vurderinger.begrunnelse-feltet
 * for back-compat og lett rendering.
 */
function lagBegrunnelseSamlet(
  r: Awaited<ReturnType<typeof vurderEkspressSoknad>>,
): string {
  const linjer: string[] = [];
  linjer.push(r.samlet_begrunnelse);
  linjer.push("");
  linjer.push("## Per kriterium");
  for (const [navn, b] of Object.entries(r.begrunnelse_per_kriterium)) {
    linjer.push(`### ${navn}`);
    if (b.styrker) linjer.push(`**Styrker:** ${b.styrker}`);
    if (b.svakheter) linjer.push(`**Svakheter:** ${b.svakheter}`);
  }
  if (r.kommentar_til_bruker) {
    linjer.push("");
    linjer.push("## Note");
    linjer.push(r.kommentar_til_bruker);
  }
  return linjer.join("\n");
}
