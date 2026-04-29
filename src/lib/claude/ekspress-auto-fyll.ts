import { getClaudeClient, getModel } from "./client";
import { EKSPRESS_FELTER } from "@/types/ekspress-felter";
import type { BudsjettRad } from "@/components/soknad/budsjett-felt";

/**
 * Auto-fyll en Ekspress-søknad fra fritekst.
 *
 * Brukeren limer inn rotete tekst — gamle e-poster, notater, utdrag fra
 * tidligere søknader — og Claude returnerer et strukturert JSON-objekt
 * som passer Damnett-skjemaet vårt.
 *
 * Vi bruker tool-use for å tvinge JSON-output: Claude blir bedt om å
 * "kalle" et tool med navnene på Damnett-feltene som parametre, og vi
 * leser tool-argumentene direkte. Det er mer robust enn å parse
 * fritekst-JSON, og lar oss validere typene direkte.
 *
 * Prompt caching: system-prompten er stort sett uendret mellom kall, så
 * vi merker den med cache_control. Det gir ~90% rabatt på cache-treff og
 * raskere respons (~2x).
 */

export type AutoFyllResultat = {
  tittel: string;
  felter: Record<string, unknown>;
  soknadssum_kr: number | null;
  totalbudsjett_kr: number | null;
  oppstart_dato: string | null;
  avslutt_dato: string | null;
  budsjett_rader: BudsjettRad[];
  manglende_felter: string[];
  kommentar_fra_agent: string;
};

/** Bygg system-prompten dynamisk fra EKSPRESS_FELTER. */
function buildSystemPrompt(): string {
  const feltBeskrivelse = EKSPRESS_FELTER.map((f) => {
    const grense = f.tegngrense ? ` (maks ${f.tegngrense} tegn)` : "";
    const valg = f.valg
      ? `\n  Gyldige verdier: ${f.valg.map((v) => v.kode).join(", ")}`
      : "";
    const maks = f.maksValg ? ` — maks ${f.maksValg} valg` : "";
    return `- **${f.id}** (${f.type}${grense}${maks}): ${f.navn}\n  ${f.hjelpetekst}${valg}`;
  }).join("\n\n");

  return `Du er en assistent som hjelper sekretariatet i CP-foreningen å strukturere
søknadsutkast til Stiftelsen Dams Ekspress-program.

Brukeren vil lime inn fritekst — kan være rotete notater, e-postutveksling,
gamle søknader fra arkivet, intervju-transkript osv. Din oppgave er å
trekke ut informasjon og strukturere det inn i Damnetts skjema.

# REGLER

1. **Hold deg innenfor tegngrensene.** Hvis brukerens kildetekst er
   lengre enn grensa, sammenfatt — men behold konkrete navn, tall og
   eksempler. Generelle utsagn har lavere verdi enn konkrete.

2. **Behold brukerens egne formuleringer der mulig.** Du skal IKKE
   skrive om for å lyde mer "profesjonelt" — denne agenten gjør bare
   strukturering, ikke vurdering. Kvalitetsforbedring kommer i en egen
   vurderings-runde senere.

3. **Hvis du ikke har grunnlag for å fylle ut et felt, sett det til
   null** (eller tom streng for tekstfelt) og legg felt-id-en inn i
   "manglende_felter". Ikke gjett.

4. **For datoer:** kun konkrete datoer som "1. august 2026" eller
   "2026-08-01". Skriver brukeren "i august" eller "neste høst", legg
   feltet i manglende_felter. Format: YYYY-MM-DD.

5. **For 3.4.1 utfordringer:** velg maks 3 fra listen. Ikke finn på
   nye koder.

6. **For budsjett:** ekstraher alle linjer du finner. Hvis ingen klar
   oversikt, returner tomt array. Beløp som heltall i kroner.

7. **Søknadssum**: hvis brukeren skriver "vi søker om 35 000 kr" skal
   det bli soknadssum_kr=35000. Hvis ikke nevnt, sett til null.

8. **Tone:** "kommentar_fra_agent" skal være en kort note (1–2 setninger)
   til brukeren — gjerne flagge hva som mangler eller virker uklart.
   På norsk, vennlig og direkte.

# DAMNETT-FELTSTRUKTUR

${feltBeskrivelse}

# OUTPUT

Bruk verktøyet "fyll_inn_ekspress_skjema" med argumentene som er definert.
Hvert tekstfelt med tegngrense skal være en streng innenfor grensa
(eller tom streng hvis du ikke kan fylle ut). Bruk null for tall og
datoer som ikke kan fastsettes. Bruk tomt array for valg-felt der
brukeren ikke har gitt grunnlag.`;
}

/** JSON-skjema for tool-use-parametrene. */
function buildToolSchema() {
  // Bygg properties dynamisk fra EKSPRESS_FELTER
  const felterProperties: Record<string, object> = {};
  for (const f of EKSPRESS_FELTER) {
    if (f.id === "3.3_budsjett") continue; // håndteres separat
    if (f.id === "3.1_oppstart" || f.id === "3.1_avslutt") continue; // top-level

    if (f.type === "tekst" || f.type === "kort_tekst") {
      felterProperties[f.id] = {
        type: "string",
        maxLength: f.tegngrense,
        description: `${f.navn} — ${f.hjelpetekst}`,
      };
    } else if (f.type === "tall") {
      felterProperties[f.id] = {
        type: ["number", "null"],
        description: f.navn,
      };
    } else if (f.type === "valg_flere") {
      felterProperties[f.id] = {
        type: "array",
        items: {
          type: "string",
          enum: f.valg?.map((v) => v.kode) ?? [],
        },
        maxItems: f.maksValg,
        description: f.navn,
      };
    }
  }

  return {
    name: "fyll_inn_ekspress_skjema",
    description:
      "Fyll inn et Ekspress-søknadsskjema basert på brukerens fritekst.",
    input_schema: {
      type: "object" as const,
      properties: {
        tittel: {
          type: "string",
          maxLength: 80,
          description: "Prosjektnavn — kort beskrivende tittel.",
        },
        felter: {
          type: "object",
          properties: felterProperties,
          additionalProperties: false,
        },
        oppstart_dato: {
          type: ["string", "null"],
          description: "Oppstartsdato på formen YYYY-MM-DD eller null.",
        },
        avslutt_dato: {
          type: ["string", "null"],
          description: "Avslutningsdato på formen YYYY-MM-DD eller null.",
        },
        soknadssum_kr: {
          type: ["number", "null"],
          description: "Beløp søkt fra Stiftelsen Dam, i hele kroner.",
        },
        totalbudsjett_kr: {
          type: ["number", "null"],
          description: "Totalt prosjektbudsjett, i hele kroner.",
        },
        budsjett_rader: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["utgift", "inntekt"] },
              post: { type: "string" },
              belop: { type: ["number", "null"] },
            },
            required: ["type", "post", "belop"],
          },
          description: "Budsjettposter — utgifter og evt. andre inntekter.",
        },
        manglende_felter: {
          type: "array",
          items: { type: "string" },
          description:
            "Liste over felt-id-er du ikke kunne fylle ut basert på kildeteksten.",
        },
        kommentar_fra_agent: {
          type: "string",
          description:
            "Kort note (1–2 setninger) til brukeren om hva som mangler eller virker uklart.",
        },
      },
      required: [
        "tittel",
        "felter",
        "manglende_felter",
        "kommentar_fra_agent",
      ],
    },
  };
}

/** Kjør auto-fyll mot Claude. Kaster ved feil. */
export async function autoFyllEkspress(
  fritekst: string,
): Promise<AutoFyllResultat> {
  const client = getClaudeClient();
  const tool = buildToolSchema();

  const response = await client.messages.create({
    model: getModel(),
    max_tokens: 4096,
    // Tving Claude til å bruke vårt tool — alternativet "any" lar Claude
    // velge fritt blant flere tools, men vi har bare ett, så det er
    // ekvivalent med å si "bruk dette".
    tool_choice: { type: "tool", name: tool.name },
    tools: [tool],
    system: [
      {
        type: "text",
        text: buildSystemPrompt(),
        // Cache system-prompten — den er stort sett uendret mellom kall.
        // Cache-treff gir ~90% rabatt og kuttet latens.
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Her er fritekst-utkastet jeg vil ha strukturert:\n\n${fritekst}`,
      },
    ],
  });

  // Plukk ut tool_use-blokken
  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      "Claude returnerte ikke et tool-call. Råinnhold: " +
        JSON.stringify(response.content),
    );
  }

  const args = toolUse.input as Record<string, unknown>;

  // Pakk om til vårt return-format. Tilfellet hvor en spesifikk nøkkel
  // mangler — bruk fornuftige defaults.
  return {
    tittel: (args.tittel as string) ?? "",
    felter: (args.felter as Record<string, unknown>) ?? {},
    soknadssum_kr: (args.soknadssum_kr as number | null) ?? null,
    totalbudsjett_kr: (args.totalbudsjett_kr as number | null) ?? null,
    oppstart_dato: (args.oppstart_dato as string | null) ?? null,
    avslutt_dato: (args.avslutt_dato as string | null) ?? null,
    budsjett_rader: (args.budsjett_rader as BudsjettRad[]) ?? [],
    manglende_felter: (args.manglende_felter as string[]) ?? [],
    kommentar_fra_agent: (args.kommentar_fra_agent as string) ?? "",
  };
}
