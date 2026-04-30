import { createClient } from "@/lib/supabase/server";
import {
  EKSPRESS_SYSTEM_PROMPT,
  EKSPRESS_SYSTEM_PROMPT_VERSJON,
  EKSPRESS_RUBRIKK,
  EKSPRESS_RUBRIKK_VERSJON,
} from "@/prompts/ekspress-system-prompt";
import type { Program } from "@/types/database";

/**
 * Henter aktiv prompt-versjon fra databasen.
 *
 * Self-bootstrap: hvis ingen aktiv versjon finnes (typisk ved første
 * deploy), inserter vi kode-versjonen som aktiv. Dette gjør at appen
 * fungerer fra dag én uten manuell SQL-seeding, og at endringer som
 * gjøres senere via UI overstyrer kode-versjonen.
 */

export type AgentPromptType = "system_prompt" | "rubrikk";

type ActivePrompt = {
  versjon: string;
  innhold: string;
};

/**
 * Hent aktiv prompt for et program og en type. Bootstrapper fra
 * kode-versjonen hvis databasen er tom.
 */
export async function hentAktivPrompt(
  program: Program,
  type: AgentPromptType,
): Promise<ActivePrompt> {
  const supabase = await createClient();

  // Forsøk å hente aktiv versjon
  const { data, error } = await supabase
    .from("agent_prompts")
    .select("versjon, innhold")
    .eq("program", program)
    .eq("type", type)
    .eq("aktiv", true)
    .maybeSingle();

  if (error) {
    console.error("[hentAktivPrompt] DB-feil, faller tilbake til kode:", error);
    return getKodeFallback(program, type);
  }

  if (data) {
    return data;
  }

  // Ingen aktiv versjon — bootstrap fra kode
  const fallback = getKodeFallback(program, type);
  await bootstrapPrompt(program, type, fallback);
  return fallback;
}

/**
 * Hent begge prompts for et program på én SQL-runde — brukes typisk
 * ved vurdering der vi trenger både system_prompt og rubrikk.
 */
export async function hentAktivePrompts(program: Program): Promise<{
  system: ActivePrompt;
  rubrikk: ActivePrompt;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agent_prompts")
    .select("type, versjon, innhold")
    .eq("program", program)
    .eq("aktiv", true);

  if (error) {
    console.error("[hentAktivePrompts] DB-feil:", error);
    return {
      system: getKodeFallback(program, "system_prompt"),
      rubrikk: getKodeFallback(program, "rubrikk"),
    };
  }

  const system = data?.find((r) => r.type === "system_prompt") ?? null;
  const rubrikk = data?.find((r) => r.type === "rubrikk") ?? null;

  // Bootstrap manglende versjoner
  if (!system) {
    const fallback = getKodeFallback(program, "system_prompt");
    await bootstrapPrompt(program, "system_prompt", fallback);
  }
  if (!rubrikk) {
    const fallback = getKodeFallback(program, "rubrikk");
    await bootstrapPrompt(program, "rubrikk", fallback);
  }

  return {
    system: system ?? getKodeFallback(program, "system_prompt"),
    rubrikk: rubrikk ?? getKodeFallback(program, "rubrikk"),
  };
}

/**
 * Sett en spesifikk versjon som aktiv. Brukes ved opprettelse av ny
 * versjon eller rull-tilbake til gammel.
 */
export async function settAktivPrompt(versjonId: string): Promise<{
  ok: true;
} | { ok: false; feil: string }> {
  const supabase = await createClient();

  // Hent versjonen for å vite program/type
  const { data: ny } = await supabase
    .from("agent_prompts")
    .select("program, type")
    .eq("id", versjonId)
    .single();

  if (!ny) {
    return { ok: false, feil: "Fant ikke prompt-versjonen." };
  }

  const { error } = await supabase.rpc("bytt_aktiv_prompt", {
    p_program: ny.program,
    p_type: ny.type,
    p_ny_versjon_id: versjonId,
  });

  if (error) {
    return { ok: false, feil: error.message };
  }

  return { ok: true };
}

// ============================================================
// Hjelpere
// ============================================================

function getKodeFallback(
  program: Program,
  type: AgentPromptType,
): ActivePrompt {
  if (program !== "ekspress") {
    throw new Error(
      `Ingen kode-prompt for program=${program}, type=${type}. Legg til i prompts-mappa først.`,
    );
  }
  if (type === "system_prompt") {
    return {
      versjon: EKSPRESS_SYSTEM_PROMPT_VERSJON,
      innhold: EKSPRESS_SYSTEM_PROMPT,
    };
  }
  return {
    versjon: EKSPRESS_RUBRIKK_VERSJON,
    innhold: EKSPRESS_RUBRIKK,
  };
}

async function bootstrapPrompt(
  program: Program,
  type: AgentPromptType,
  prompt: ActivePrompt,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("agent_prompts").insert({
    program,
    type,
    versjon: prompt.versjon,
    innhold: prompt.innhold,
    aktiv: true,
    endrings_grunnlag:
      "Bootstrap fra kode-versjonen. Endringer via UI overstyrer denne.",
  });

  if (error) {
    // Hvis insert feiler pga RLS (utvikler/admin-only) — log og fortsett.
    // Vurderingen kan kjøre med kode-versjonen uansett.
    console.warn(
      `[bootstrapPrompt] Kunne ikke seede ${program}/${type}: ${error.message}. ` +
        `Logg inn som admin/utvikler og kjør første vurdering for å bootstrappe.`,
    );
  } else {
    console.log(
      `[bootstrapPrompt] Seedet ${program}/${type} ${prompt.versjon} til DB.`,
    );
  }
}
