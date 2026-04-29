"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LagreKladdInput = {
  tittel: string;
  felter: Record<string, unknown>;
  soknadssum_kr: number | null;
  totalbudsjett_kr: number | null;
  oppstart_dato: string | null;
  avslutt_dato: string | null;
};

export type LagreKladdResultat =
  | { ok: true; soknadId: string }
  | { ok: false; feil: string };

/**
 * Lagrer en ny Ekspress-kladd til soknader-tabellen.
 * Eier blir automatisk innlogget bruker (fra auth-cookie).
 */
export async function lagreEkspressKladd(
  input: LagreKladdInput,
): Promise<LagreKladdResultat> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, feil: "Du må være innlogget for å lagre en søknad." };
  }

  if (!input.tittel || input.tittel.trim().length === 0) {
    return { ok: false, feil: "Prosjektnavn må fylles inn." };
  }

  const { data, error } = await supabase
    .from("soknader")
    .insert({
      owner_id: user.id,
      program: "ekspress" as const,
      tittel: input.tittel.trim(),
      status: "kladd" as const,
      felter: input.felter,
      soknadssum_kr: input.soknadssum_kr,
      totalbudsjett_kr: input.totalbudsjett_kr,
      oppstart_dato: input.oppstart_dato,
      avslutt_dato: input.avslutt_dato,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[lagreEkspressKladd] Supabase-feil:", error);
    return {
      ok: false,
      feil: `Kunne ikke lagre kladden: ${error.message}`,
    };
  }

  // Refresh søknadslista og dashboardet slik at den nye kladden vises
  revalidatePath("/soknader");
  revalidatePath("/dashboard");

  return { ok: true, soknadId: data.id };
}
