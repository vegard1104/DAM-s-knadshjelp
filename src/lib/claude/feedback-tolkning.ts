import { getClaudeClient, getModel } from "./client";
import type { Vurdering } from "@/types/database";

/**
 * Tolker brukerens tilbakemelding på en vurdering — implementerer
 * dobbeltsjekk-regelen fra prosjektkontekst v2 §6.
 *
 * Vi sender Claude et utdrag av vurderingen sammen med brukerens
 * kommentar, og ber agenten:
 *  1. Si tilbake hva den TROR brukeren mente
 *  2. Identifisere kategorien — er det formuleringsproblem, score for
 *     streng/snill, rubrikk-utfordring, eller noe annet?
 *  3. Stille et oppklarende spørsmål hvis tolkningen er usikker
 *
 * Resultatet vises til brukeren som "Forstod jeg deg riktig at du mente
 * X?" og brukeren bekrefter eller korrigerer. Vi auto-applierer ALDRI
 * endringer i denne flyten — det krever et separat steg via lag 3.
 */

export type FeedbackTolkning = {
  tolkning: string;
  oppfolging: string;
  kategori: "score" | "formulering" | "rubrikk" | "feil_vurdering" | "uklart";
};

const TOOL = {
  name: "tolk_brukerens_feedback",
  description:
    "Tolk brukerens kommentar og foreslå en kategorisering. Lever ALLTID via dette verktøyet.",
  input_schema: {
    type: "object" as const,
    properties: {
      tolkning: {
        type: "string",
        description:
          "Din beste tolkning av hva brukeren mener — på formen «Jeg forstod at du mente …» (1-2 setninger). Skal vises tilbake til brukeren for bekreftelse.",
      },
      oppfolging: {
        type: "string",
        description:
          "Eventuelt oppklarende spørsmål hvis tolkningen er usikker. Tom streng hvis du er trygg på tolkningen.",
      },
      kategori: {
        type: "string",
        enum: ["score", "formulering", "rubrikk", "feil_vurdering", "uklart"],
        description:
          "Kategori: 'score' = score er for streng/snill; 'formulering' = ordvalget i forbedringsforslagene; 'rubrikk' = forslag til endring i selve scoringsrubrikken; 'feil_vurdering' = agenten bommet konkret på et faktum i søknaden; 'uklart' = greier ikke kategorisere.",
      },
    },
    required: ["tolkning", "oppfolging", "kategori"],
  },
};

const SYSTEM_PROMPT = `Du er Ekspress-agenten. En bruker har gitt en tilbakemelding på en av dine vurderinger. Din oppgave er å:

1. Tolke hva brukeren mener — vær presis og direkte. Ikke gjenta kommentaren ordrett, men si hva DU forstår.
2. Kategorisere tilbakemeldingen:
   - "score" = brukeren mener én eller flere score er feil (for streng eller for snill)
   - "formulering" = brukeren reagerer på ordvalget i et forbedringsforslag eller en begrunnelse
   - "rubrikk" = brukeren foreslår å endre selve scoringsrubrikken (f.eks. "Soliditet bør vekte X mer")
   - "feil_vurdering" = agenten bommet konkret på et faktum i søknaden (f.eks. trodde det var landsomfattende, men det var lokalt)
   - "uklart" = du greier ikke å forstå hva brukeren mener — be om presisering
3. Stille et oppklarende spørsmål hvis du er usikker.

Lever svaret via verktøyet "tolk_brukerens_feedback". Hold tolkningen kort og konkret. Ikke gjør endringer — du SKAL bare tolke og kategorisere. Endringer gjøres i et separat steg etter at brukeren har bekreftet at du forstod riktig.

Norsk, naturlig prosa. Ingen unødvendig høflighet.`;

export async function tolkFeedback(
  vurdering: Vurdering,
  feedbackKommentar: string,
  feedbackType: "tommel_opp" | "tommel_ned",
): Promise<FeedbackTolkning> {
  const client = getClaudeClient();
  const modell = getModel();

  const vurderingsSammendrag = lagVurderingsSammendrag(vurdering);

  const userMessage = `Her er vurderingen din:

${vurderingsSammendrag}

Brukeren ga **${feedbackType === "tommel_ned" ? "tommel ned" : "tommel opp"}** og skrev:

> ${feedbackKommentar}

Tolk hva brukeren mener og kategoriser tilbakemeldingen.`;

  const response = await client.messages.create({
    model: modell,
    max_tokens: 1024,
    tool_choice: { type: "tool", name: TOOL.name },
    tools: [TOOL],
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude returnerte ikke et tool_use-svar.");
  }

  const args = toolUse.input as Record<string, unknown>;
  return {
    tolkning: (args.tolkning as string) ?? "",
    oppfolging: (args.oppfolging as string) ?? "",
    kategori:
      (args.kategori as FeedbackTolkning["kategori"]) ?? "uklart",
  };
}

/** Lager en kompakt tekst-representasjon av en vurdering for Claude. */
function lagVurderingsSammendrag(v: Vurdering): string {
  const linjer: string[] = [];
  linjer.push(`Snitt: ${v.snitt_score?.toFixed(2)} / 7`);
  linjer.push(
    `Scores: Soliditet ${v.score_soliditet}, Virkning ${v.score_virkning}, Gjennomføring ${v.score_gjennomforing}, Prioriteringer ${v.score_prioriteringer}`,
  );
  linjer.push(`Anbefaling: ${v.anbefaling}`);
  if (v.begrunnelse) {
    linjer.push("");
    linjer.push("Begrunnelse:");
    linjer.push(v.begrunnelse);
  }
  if (v.forbedringer && v.forbedringer.length > 0) {
    linjer.push("");
    linjer.push("Forbedringsforslag:");
    for (const f of v.forbedringer) {
      linjer.push(`- ${f.felt}: ${f.forslag.slice(0, 200)}…`);
    }
  }
  return linjer.join("\n");
}
