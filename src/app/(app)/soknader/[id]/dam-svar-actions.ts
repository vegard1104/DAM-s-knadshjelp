"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DamUtfall } from "@/types/database";

// ============================================================
// Marker søknad som sendt til DAM
// ============================================================

export type MarkerSomSendtResultat =
  | { ok: true }
  | { ok: false; feil: string };

export async function markerSomSendtAction(
  soknadId: string,
): Promise<MarkerSomSendtResultat> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, feil: "Du må være innlogget." };

  const { error } = await supabase
    .from("soknader")
    .update({ status: "sendt" })
    .eq("id", soknadId);

  if (error) {
    return { ok: false, feil: error.message };
  }

  revalidatePath(`/soknader/${soknadId}`);
  revalidatePath("/soknader");
  revalidatePath("/dashboard");

  return { ok: true };
}

// ============================================================
// Registrer DAM-svar (etter at PDF er lastet opp til Storage)
// ============================================================

export type RegistrerDamSvarInput = {
  utfall: DamUtfall;
  innvilget_belop_kr: number | null;
  begrunnelse_avslag: string | null;
  pdf_path: string | null;
};

export type RegistrerDamSvarResultat =
  | { ok: true }
  | { ok: false; feil: string };

/**
 * Lagrer DAM-svar etter at PDF-en er lastet opp til Supabase Storage
 * fra klienten. Vi gjør upload separat fra denne actionen for å ikke
 * presse PDF-en gjennom Vercels Server Action body limit.
 *
 * Oppdaterer også søknadens status til innvilget eller avslag basert
 * på utfallet.
 */
export async function registrerDamSvarAction(
  soknadId: string,
  input: RegistrerDamSvarInput,
): Promise<RegistrerDamSvarResultat> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, feil: "Du må være innlogget." };

  // 1. Sjekk om dam_svar finnes fra før — hvis ja, oppdater i stedet for insert
  const { data: eksisterende } = await supabase
    .from("dam_svar")
    .select("id, pdf_path")
    .eq("soknad_id", soknadId)
    .single();

  if (eksisterende) {
    // Hvis det er en gammel PDF og vi laster opp en ny — slett den gamle
    if (
      eksisterende.pdf_path &&
      input.pdf_path &&
      eksisterende.pdf_path !== input.pdf_path
    ) {
      await supabase.storage
        .from("dam-svar-pdf")
        .remove([eksisterende.pdf_path]);
    }

    const { error } = await supabase
      .from("dam_svar")
      .update({
        utfall: input.utfall,
        innvilget_belop_kr:
          input.utfall === "innvilget" ? input.innvilget_belop_kr : null,
        begrunnelse_avslag:
          input.utfall === "avslag" ? input.begrunnelse_avslag : null,
        pdf_path: input.pdf_path ?? eksisterende.pdf_path,
        registrert_av: user.id,
      })
      .eq("id", eksisterende.id);

    if (error) return { ok: false, feil: error.message };
  } else {
    const { error } = await supabase.from("dam_svar").insert({
      soknad_id: soknadId,
      utfall: input.utfall,
      innvilget_belop_kr:
        input.utfall === "innvilget" ? input.innvilget_belop_kr : null,
      begrunnelse_avslag:
        input.utfall === "avslag" ? input.begrunnelse_avslag : null,
      pdf_path: input.pdf_path,
      registrert_av: user.id,
    });

    if (error) return { ok: false, feil: error.message };
  }

  // 2. Oppdater søknadens status
  await supabase
    .from("soknader")
    .update({ status: input.utfall })
    .eq("id", soknadId);

  revalidatePath(`/soknader/${soknadId}`);
  revalidatePath("/soknader");
  revalidatePath("/dashboard");

  return { ok: true };
}

// ============================================================
// Slett DAM-svar (admin/eier kan angre)
// ============================================================

export type SlettDamSvarResultat =
  | { ok: true }
  | { ok: false; feil: string };

export async function slettDamSvarAction(
  soknadId: string,
): Promise<SlettDamSvarResultat> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, feil: "Du må være innlogget." };

  const { data: eksisterende } = await supabase
    .from("dam_svar")
    .select("id, pdf_path")
    .eq("soknad_id", soknadId)
    .single();

  if (!eksisterende) {
    return { ok: false, feil: "Ingen DAM-svar å slette." };
  }

  // Slett PDF-en fra Storage hvis den finnes
  if (eksisterende.pdf_path) {
    await supabase.storage.from("dam-svar-pdf").remove([eksisterende.pdf_path]);
  }

  const { error } = await supabase
    .from("dam_svar")
    .delete()
    .eq("id", eksisterende.id);

  if (error) return { ok: false, feil: error.message };

  // Tilbake til "sendt" hvis vi hadde en status; ellers "vurdert"
  await supabase
    .from("soknader")
    .update({ status: "sendt" })
    .eq("id", soknadId);

  revalidatePath(`/soknader/${soknadId}`);
  revalidatePath("/soknader");
  revalidatePath("/dashboard");

  return { ok: true };
}

// ============================================================
// Lag signed URL for PDF-visning (gyldig 1 time)
// ============================================================

export async function getPdfSignedUrl(
  pdfPath: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("dam-svar-pdf")
    .createSignedUrl(pdfPath, 3600);

  if (error || !data) {
    console.error("[getPdfSignedUrl] feilet:", error);
    return null;
  }
  return data.signedUrl;
}
