import { getClaudeClient, getModel } from "./client";
import type {
  Forbedring,
  RodtFlagg,
  VurderingAnbefaling,
} from "@/types/database";

/**
 * Vurder en Ekspress-søknad mot rubrikken (system-prompten).
 *
 * Vi bruker tool use for å garantere strukturert output. Tool-skjemaet
 * matcher vurderinger-tabellen: scores per kriterium, anbefaling,
 * begrunnelse, forbedringsforslag, røde flagg.
 *
 * System-prompten er ~9 kB og caches via cache_control. Etter første
 * kall blir gjentatte vurderinger raskere og billigere.
 */

export type VurderingResultat = {
  score_soliditet: number;
  score_virkning: number;
  score_gjennomforing: number;
  score_prioriteringer: number;
  anbefaling: VurderingAnbefaling;
  samlet_begrunnelse: string;
  begrunnelse_per_kriterium: {
    soliditet: { styrker: string; svakheter: string };
    virkning: { styrker: string; svakheter: string };
    gjennomforing: { styrker: string; svakheter: string };
    prioriteringer: { styrker: string; svakheter: string };
  };
  rode_flagg: RodtFlagg[];
  forbedringer: Forbedring[];
  kommentar_til_bruker: string;
  modell_brukt: string;
  system_prompt_versjon: string;
  rubrikk_versjon: string;
  ra_response: unknown;
};

/** Aktive agent-prompts hentet fra databasen (eller kode-fallback). */
export type AktivePromptsForVurdering = {
  system: { versjon: string; innhold: string };
  rubrikk: { versjon: string; innhold: string };
};

/** Inputformat for vurderingen — alt agenten trenger om søknaden. */
export type VurderingInput = {
  tittel: string;
  felter: Record<string, unknown>;
  soknadssum_kr: number | null;
  totalbudsjett_kr: number | null;
  oppstart_dato: string | null;
  avslutt_dato: string | null;
};

const TOOL_NAVN = "vurder_ekspress_soknad";

const TOOL_SCHEMA = {
  name: TOOL_NAVN,
  description:
    "Lever vurderingen av Ekspress-søknaden i strukturert form. Du SKAL alltid kalle dette verktøyet — ikke svar med fritekst.",
  input_schema: {
    type: "object" as const,
    properties: {
      score_soliditet: {
        type: "number",
        minimum: 1,
        maximum: 7,
        description: "Score for kriterium 1 — Soliditet. 1-7, kan ha desimal.",
      },
      score_virkning: {
        type: "number",
        minimum: 1,
        maximum: 7,
        description: "Score for kriterium 2 — Virkning. 1-7.",
      },
      score_gjennomforing: {
        type: "number",
        minimum: 1,
        maximum: 7,
        description: "Score for kriterium 3 — Gjennomføring. 1-7.",
      },
      score_prioriteringer: {
        type: "number",
        minimum: 1,
        maximum: 7,
        description:
          "Score for kriterium 4 — Stiftelsen Dams prioriteringer. 1-7.",
      },
      anbefaling: {
        type: "string",
        enum: [
          "klar_til_innsending",
          "bor_forbedres",
          "trenger_arbeid",
          "vesentlige_mangler",
        ],
        description:
          "Samlet anbefaling, basert på terskelreglene i system-prompten.",
      },
      samlet_begrunnelse: {
        type: "string",
        description:
          "1-2 setningers oppsummering for brukeren — hvorfor denne anbefalingen.",
      },
      begrunnelse_per_kriterium: {
        type: "object",
        properties: {
          soliditet: {
            type: "object",
            properties: {
              styrker: { type: "string" },
              svakheter: { type: "string" },
            },
            required: ["styrker", "svakheter"],
          },
          virkning: {
            type: "object",
            properties: {
              styrker: { type: "string" },
              svakheter: { type: "string" },
            },
            required: ["styrker", "svakheter"],
          },
          gjennomforing: {
            type: "object",
            properties: {
              styrker: { type: "string" },
              svakheter: { type: "string" },
            },
            required: ["styrker", "svakheter"],
          },
          prioriteringer: {
            type: "object",
            properties: {
              styrker: { type: "string" },
              svakheter: { type: "string" },
            },
            required: ["styrker", "svakheter"],
          },
        },
        required: ["soliditet", "virkning", "gjennomforing", "prioriteringer"],
      },
      rode_flagg: {
        type: "array",
        description:
          "Røde flagg fra system-prompten. Tom liste hvis ingen flagg.",
        items: {
          type: "object",
          properties: {
            tekst: { type: "string" },
            alvorlighet: {
              type: "string",
              enum: ["kritisk", "advarsel", "info"],
            },
          },
          required: ["tekst", "alvorlighet"],
        },
      },
      forbedringer: {
        type: "array",
        description:
          "Konkrete forbedringsforslag per felt. Bare felt der omskrivning gir tydelig forbedring. Ikke nødvendigvis alle felt.",
        items: {
          type: "object",
          properties: {
            felt: {
              type: "string",
              description:
                "Felt-id, f.eks. '1.1.2', '2.1.2', '3.2.3', '4.1.1'.",
            },
            original: {
              type: "string",
              description:
                "Brukerens originale tekst (kortet ned hvis veldig lang).",
            },
            forslag: {
              type: "string",
              description:
                "Din omskrevne versjon. Hold deg innenfor tegngrensa for det aktuelle feltet.",
            },
            hvorfor: {
              type: "string",
              description: "1-2 setninger om hva som ble bedre.",
            },
          },
          required: ["felt", "original", "forslag", "hvorfor"],
        },
      },
      kommentar_til_bruker: {
        type: "string",
        description:
          "Personlig note til brukeren (f.eks. ansvarsfraskrivelsen om at dette ikke er fagutvalgets faktiske scorer).",
      },
    },
    required: [
      "score_soliditet",
      "score_virkning",
      "score_gjennomforing",
      "score_prioriteringer",
      "anbefaling",
      "samlet_begrunnelse",
      "begrunnelse_per_kriterium",
      "rode_flagg",
      "forbedringer",
      "kommentar_til_bruker",
    ],
  },
};

function bruker_meldingForSoknad(input: VurderingInput): string {
  const linjer: string[] = [];

  linjer.push(`# Søknad: ${input.tittel || "(uten tittel)"}`);
  linjer.push("");

  if (input.soknadssum_kr !== null) {
    linjer.push(`**Søknadssum:** ${input.soknadssum_kr} kr`);
  }
  if (input.totalbudsjett_kr !== null) {
    linjer.push(`**Totalbudsjett:** ${input.totalbudsjett_kr} kr`);
  }
  if (input.soknadssum_kr !== null && input.totalbudsjett_kr !== null) {
    const andel = (input.soknadssum_kr / input.totalbudsjett_kr) * 100;
    linjer.push(
      `**Andel søknadssum av total:** ${andel.toFixed(1)}% (DAM krever ≥ 33%)`,
    );
  }
  if (input.oppstart_dato) {
    linjer.push(`**Oppstart:** ${input.oppstart_dato}`);
  }
  if (input.avslutt_dato) {
    linjer.push(`**Avslutning:** ${input.avslutt_dato}`);
  }

  linjer.push("");
  linjer.push("## Skjemafelt");
  linjer.push("");

  // Sorter felt-IDer slik at de kommer i Damnett-rekkefølge
  const sortertIDer = Object.keys(input.felter).sort();
  for (const id of sortertIDer) {
    const verdi = input.felter[id];
    if (verdi === null || verdi === undefined || verdi === "") continue;
    if (Array.isArray(verdi) && verdi.length === 0) continue;

    linjer.push(`### ${id}`);
    if (typeof verdi === "string") {
      linjer.push(verdi);
      linjer.push(`*(${verdi.length} tegn)*`);
    } else if (typeof verdi === "number") {
      linjer.push(String(verdi));
    } else if (Array.isArray(verdi)) {
      linjer.push(verdi.map((v) => `- ${JSON.stringify(v)}`).join("\n"));
    } else if (typeof verdi === "object") {
      linjer.push("```json");
      linjer.push(JSON.stringify(verdi, null, 2));
      linjer.push("```");
    } else {
      linjer.push(String(verdi));
    }
    linjer.push("");
  }

  linjer.push("---");
  linjer.push("");
  linjer.push(
    "Vurder denne Ekspress-søknaden mot rubrikken. Bruk verktøyet `vurder_ekspress_soknad` for å levere svaret strukturert.",
  );

  return linjer.join("\n");
}

export async function vurderEkspressSoknad(
  input: VurderingInput,
  prompts: AktivePromptsForVurdering,
): Promise<VurderingResultat> {
  const client = getClaudeClient();
  const modell = getModel();

  // System-prompten består av to deler: agentens "personlighet" + rubrikken.
  // Vi setter dem sammen som ett system-felt med felles cache-grense.
  const sammensatt = `${prompts.system.innhold}\n\n${prompts.rubrikk.innhold}`;

  const response = await client.messages.create({
    model: modell,
    max_tokens: 8192,
    tool_choice: { type: "tool", name: TOOL_NAVN },
    tools: [TOOL_SCHEMA],
    system: [
      {
        type: "text",
        text: sammensatt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: bruker_meldingForSoknad(input),
      },
    ],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      "Claude returnerte ikke et tool_use-svar. Innhold: " +
        JSON.stringify(response.content).slice(0, 500),
    );
  }

  const args = toolUse.input as Record<string, unknown>;

  return {
    score_soliditet: args.score_soliditet as number,
    score_virkning: args.score_virkning as number,
    score_gjennomforing: args.score_gjennomforing as number,
    score_prioriteringer: args.score_prioriteringer as number,
    anbefaling: args.anbefaling as VurderingAnbefaling,
    samlet_begrunnelse: (args.samlet_begrunnelse as string) ?? "",
    begrunnelse_per_kriterium:
      (args.begrunnelse_per_kriterium as VurderingResultat["begrunnelse_per_kriterium"]) ??
      {
        soliditet: { styrker: "", svakheter: "" },
        virkning: { styrker: "", svakheter: "" },
        gjennomforing: { styrker: "", svakheter: "" },
        prioriteringer: { styrker: "", svakheter: "" },
      },
    rode_flagg: (args.rode_flagg as RodtFlagg[]) ?? [],
    forbedringer: (args.forbedringer as Forbedring[]) ?? [],
    kommentar_til_bruker: (args.kommentar_til_bruker as string) ?? "",
    modell_brukt: modell,
    system_prompt_versjon: prompts.system.versjon,
    rubrikk_versjon: prompts.rubrikk.versjon,
    ra_response: response.content,
  };
}
