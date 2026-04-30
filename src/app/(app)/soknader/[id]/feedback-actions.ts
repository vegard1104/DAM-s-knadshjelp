"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { tolkFeedback } from "@/lib/claude/feedback-tolkning";
import type {
  Feedback,
  FeedbackAdminStatus,
  FeedbackType,
  Vurdering,
} from "@/types/database";

// ============================================================
// Lagre feedback + (hvis kommentar finnes) la Claude tolke den
// ============================================================

export type LagreFeedbackInput = {
  vurderingId: string;
  type: FeedbackType;
  kommentar: string;
};

export type LagreFeedbackResultat =
  | { ok: true; feedback: Feedback }
  | { ok: false; feil: string };

export async function lagreFeedbackAction(
  input: LagreFeedbackInput,
): Promise<LagreFeedbackResultat> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, feil: "Du må være innlogget." };

  const kommentar = input.kommentar.trim() || null;

  // Steg 1: hent vurderingen for å gi Claude nok kontekst
  const { data: vurdering } = await supabase
    .from("vurderinger")
    .select("*")
    .eq("id", input.vurderingId)
    .single();

  if (!vurdering) {
    return { ok: false, feil: "Fant ikke vurderingen." };
  }

  // Steg 2: kjør Claude-tolkning hvis brukeren har skrevet kommentar.
  // Tommel opp uten kommentar trenger ingen tolkning — det er bare et
  // datapunkt at noen syntes vurderingen var bra.
  let agentTolkning: string | null = null;
  let agentOppfolging: string | null = null;

  if (kommentar && (input.type === "tommel_ned" || input.type === "tommel_opp")) {
    try {
      const tolkning = await tolkFeedback(
        vurdering as Vurdering,
        kommentar,
        input.type,
      );
      agentTolkning = tolkning.tolkning || null;
      agentOppfolging = tolkning.oppfolging || null;
    } catch (error) {
      // Hvis Claude feiler, lagrer vi feedback uten tolkning. Brukeren
      // kan fortsatt prøve på nytt eller bare leve med rå-kommentaren.
      console.error("[lagreFeedbackAction] Tolkning feilet:", error);
    }
  }

  // Steg 3: insert eller upsert feedback
  // ON CONFLICT (vurdering_id, bruker_id, type) — én av hver type per bruker
  const { data, error } = await supabase
    .from("feedback")
    .upsert(
      {
        vurdering_id: input.vurderingId,
        bruker_id: user.id,
        type: input.type,
        kommentar,
        agent_tolkning: agentTolkning,
        agent_oppfolging: agentOppfolging,
        bruker_bekreftet: false,
        oppdatert_at: new Date().toISOString(),
      },
      { onConflict: "vurdering_id,bruker_id,type" },
    )
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      feil: error?.message ?? "Kunne ikke lagre tilbakemelding.",
    };
  }

  // Refresh kun den aktuelle vurderingssiden
  revalidatePath(`/soknader`);

  return { ok: true, feedback: data as Feedback };
}

// ============================================================
// Bekreft eller korriger Claudes tolkning (dobbeltsjekk-regelen)
// ============================================================

export type BekreftTolkningInput = {
  feedbackId: string;
  bekreftet: boolean;
  /** Hvis brukeren ikke bekrefter, kan de gi en presisering — nytt kommentar-utkast */
  nyKommentar?: string;
};

export type BekreftTolkningResultat =
  | { ok: true; feedback: Feedback }
  | { ok: false; feil: string };

export async function bekreftTolkningAction(
  input: BekreftTolkningInput,
): Promise<BekreftTolkningResultat> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, feil: "Du må være innlogget." };

  // Hvis bruker bekrefter — bare oppdater feltet
  if (input.bekreftet) {
    const { data, error } = await supabase
      .from("feedback")
      .update({
        bruker_bekreftet: true,
        oppdatert_at: new Date().toISOString(),
      })
      .eq("id", input.feedbackId)
      .eq("bruker_id", user.id) // sikkerhet — RLS dekker også, men vi er eksplisitte
      .select("*")
      .single();

    if (error || !data) {
      return { ok: false, feil: error?.message ?? "Kunne ikke bekrefte." };
    }
    return { ok: true, feedback: data as Feedback };
  }

  // Bruker korrigerer — vi tolker på nytt med ny kommentar
  if (!input.nyKommentar || input.nyKommentar.trim().length === 0) {
    return {
      ok: false,
      feil: "Skriv en presisering før du sender på nytt.",
    };
  }

  // Hent eksisterende feedback + vurderingen
  const { data: eksisterende } = await supabase
    .from("feedback")
    .select("*, vurdering:vurderinger(*)")
    .eq("id", input.feedbackId)
    .eq("bruker_id", user.id)
    .single();

  if (!eksisterende) {
    return { ok: false, feil: "Fant ikke tilbakemeldingen." };
  }

  type FeedbackMedVurdering = Feedback & { vurdering: Vurdering };
  const eksisterendeTyped = eksisterende as unknown as FeedbackMedVurdering;
  const vurdering = eksisterendeTyped.vurdering;

  let agentTolkning: string | null = null;
  let agentOppfolging: string | null = null;

  try {
    const tolkning = await tolkFeedback(
      vurdering,
      input.nyKommentar,
      eksisterendeTyped.type === "tommel_ned"
        ? "tommel_ned"
        : "tommel_opp",
    );
    agentTolkning = tolkning.tolkning || null;
    agentOppfolging = tolkning.oppfolging || null;
  } catch (error) {
    console.error("[bekreftTolkningAction] Re-tolkning feilet:", error);
  }

  const { data, error } = await supabase
    .from("feedback")
    .update({
      kommentar: input.nyKommentar,
      agent_tolkning: agentTolkning,
      agent_oppfolging: agentOppfolging,
      bruker_bekreftet: false,
      oppdatert_at: new Date().toISOString(),
    })
    .eq("id", input.feedbackId)
    .eq("bruker_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, feil: error?.message ?? "Kunne ikke oppdatere." };
  }

  return { ok: true, feedback: data as Feedback };
}

// ============================================================
// Trener-modus: seksjons-spesifikk feedback (admin/utvikler)
// Hopper over dobbeltsjekk-regelen — admin er antatt å være konkret.
// ============================================================

export type SeksjonFeedbackInput = {
  vurderingId: string;
  targetSection: string;
  type: "tommel_opp" | "tommel_ned";
  kommentar: string | null;
  foreslattOmskrivning: string | null;
};

export type SeksjonFeedbackResultat =
  | { ok: true; feedback: Feedback }
  | { ok: false; feil: string };

export async function lagreSeksjonFeedbackAction(
  input: SeksjonFeedbackInput,
): Promise<SeksjonFeedbackResultat> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, feil: "Du må være innlogget." };

  // Sjekk rolle — kun admin/utvikler
  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profil || (profil.role !== "admin" && profil.role !== "utvikler")) {
    return {
      ok: false,
      feil: "Kun admin og utvikler kan gi seksjons-spesifikk tilbakemelding.",
    };
  }

  // Må ha noen substans
  if (
    !input.kommentar?.trim() &&
    !input.foreslattOmskrivning?.trim()
  ) {
    return {
      ok: false,
      feil: "Skriv en kommentar eller en foreslått omskrivning før du sender.",
    };
  }

  // Upsert basert på (vurdering_id, bruker_id, target_section)
  const { data, error } = await supabase
    .from("feedback")
    .upsert(
      {
        vurdering_id: input.vurderingId,
        bruker_id: user.id,
        type: input.type,
        target_section: input.targetSection,
        kommentar: input.kommentar?.trim() || null,
        foreslatt_omskrivning: input.foreslattOmskrivning?.trim() || null,
        // Hopp over dobbeltsjekk for trener-feedback — det er allerede konkret
        bruker_bekreftet: true,
        agent_tolkning: null,
        agent_oppfolging: null,
        admin_status: "ny",
        oppdatert_at: new Date().toISOString(),
      },
      { onConflict: "vurdering_id,bruker_id,target_section" },
    )
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      feil: error?.message ?? "Kunne ikke lagre tilbakemelding.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/soknader");

  return { ok: true, feedback: data as Feedback };
}

export async function slettSeksjonFeedbackAction(
  feedbackId: string,
): Promise<{ ok: true } | { ok: false; feil: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, feil: "Du må være innlogget." };

  const { error } = await supabase
    .from("feedback")
    .delete()
    .eq("id", feedbackId)
    .eq("bruker_id", user.id);

  if (error) return { ok: false, feil: error.message };

  revalidatePath("/admin");
  revalidatePath("/soknader");
  return { ok: true };
}

// ============================================================
// Admin: oppdater status på en feedback (behandle køen)
// ============================================================

export type OppdaterFeedbackStatusInput = {
  feedbackId: string;
  nyStatus: FeedbackAdminStatus;
  notat?: string;
};

export async function oppdaterFeedbackStatusAction(
  input: OppdaterFeedbackStatusInput,
): Promise<{ ok: true } | { ok: false; feil: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, feil: "Du må være innlogget." };

  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profil || (profil.role !== "admin" && profil.role !== "utvikler")) {
    return { ok: false, feil: "Kun admin og utvikler kan endre status." };
  }

  const { error } = await supabase
    .from("feedback")
    .update({
      admin_status: input.nyStatus,
      admin_notat: input.notat ?? null,
      behandlet_av: user.id,
      behandlet_at: new Date().toISOString(),
    })
    .eq("id", input.feedbackId);

  if (error) return { ok: false, feil: error.message };

  revalidatePath("/admin");
  return { ok: true };
}
