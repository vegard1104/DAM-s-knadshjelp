/**
 * Damnett Ekspress-skjema — feltspesifikasjon.
 *
 * Speiler nøyaktig hjelpetekstene og tegngrensene fra Damnett, basert på
 * system-prompt-ekspress-v2.md og Damnetts offisielle skjema.
 *
 * Brukes til:
 * 1. Rendering av skjemaet (label, hjelpetekst, tegngrense)
 * 2. Validering av brukerinput (rødt flagg ved overskredet grense)
 * 3. Auto-fyll-prompt til Claude (vi sender denne strukturen som schema)
 * 4. Vurderings-prompt til Claude (vi sender felt-for-felt med ID)
 */

export type FelttypeKategori =
  | "tekst"        // fritekst med tegngrense
  | "kort_tekst"   // kort fritekst (prosjektnavn, navn)
  | "tall"         // heltall (antall, beløp)
  | "dato"         // ISO-dato
  | "valg_flere"   // checkbox, maks N valg
  | "tabell";      // budsjett-tabell

export type EkspressFelt = {
  id: string;                  // f.eks. "1.1.2"
  seksjon: string;             // gruppe-overskrift
  navn: string;                // kort label
  hjelpetekst: string;         // ordrett fra Damnett
  type: FelttypeKategori;
  tegngrense?: number;         // for tekst/kort_tekst
  pakrevd: boolean;            // er feltet obligatorisk?
  // For valg_flere:
  valg?: { kode: string; etikett: string }[];
  maksValg?: number;
  // For tabell (budsjett):
  kolonner?: string[];
};

export const EKSPRESS_FELTER: EkspressFelt[] = [
  // === SEKSJON 1: PROSJEKTET ===
  {
    id: "prosjektnavn",
    seksjon: "1. Prosjektet",
    navn: "Prosjektnavn",
    hjelpetekst:
      "Et kort, beskrivende navn på prosjektet. Vises i søknadsoversikten i Damnett.",
    type: "kort_tekst",
    tegngrense: 80,
    pakrevd: true,
  },
  {
    id: "1.1.2",
    seksjon: "1. Prosjektet",
    navn: "Aktiviteter og tiltak",
    hjelpetekst:
      "Beskriv aktiviteter eller tiltak som skal gjennomføres og bakgrunnen for hvorfor dere ønsker å gjennomføre prosjektet. Få også fram hvem tiltakene retter seg mot (målgruppen for prosjektet).",
    type: "tekst",
    tegngrense: 1000,
    pakrevd: true,
  },

  // === SEKSJON 2: VIRKNING ===
  {
    id: "2.1.1_antall",
    seksjon: "2. Virkning",
    navn: "Antall deltakere/mottakere",
    hjelpetekst:
      "Hvor mange skal delta i eller motta tiltakene fra prosjektet? Oppgi et realistisk antall.",
    type: "tall",
    pakrevd: true,
  },
  {
    id: "2.1.2",
    seksjon: "2. Virkning",
    navn: "Forventet virkning",
    hjelpetekst:
      "Beskriv hvilke positive virkninger prosjektet forventes å gi for deltakerne, målgruppen og samfunnet. Og hvis det er aktuelt: Beskriv hvordan informasjon om prosjektet og resultatene skal formidles. Det er virkningen av dette konkrete prosjektet som skal beskrives.",
    type: "tekst",
    tegngrense: 1000,
    pakrevd: true,
  },

  // === SEKSJON 3: GJENNOMFØRING ===
  {
    id: "3.1_oppstart",
    seksjon: "3. Gjennomføring",
    navn: "Oppstartsdato",
    hjelpetekst:
      "Dato for når prosjektet starter. Må være 60–180 dager etter innsending.",
    type: "dato",
    pakrevd: true,
  },
  {
    id: "3.1_avslutt",
    seksjon: "3. Gjennomføring",
    navn: "Avslutningsdato",
    hjelpetekst:
      "Dato for når prosjektet avsluttes. Maks 12 måneder etter oppstart.",
    type: "dato",
    pakrevd: true,
  },
  {
    id: "3.2.1",
    seksjon: "3. Gjennomføring",
    navn: "Prosjektgruppe",
    hjelpetekst: "Hvem er det som skal gjennomføre prosjektet?",
    type: "tekst",
    tegngrense: 300,
    pakrevd: true,
  },
  {
    id: "3.2.2_frivillige",
    seksjon: "3. Gjennomføring",
    navn: "Antall frivillige",
    hjelpetekst:
      "Hvor mange frivillige forventer dere å mobilisere i prosjektet?",
    type: "tall",
    pakrevd: false,
  },
  {
    id: "3.2.3",
    seksjon: "3. Gjennomføring",
    navn: "Plan for gjennomføring",
    hjelpetekst:
      "Beskriv den praktiske gjennomføringen av prosjektet — for eksempel hvordan deltakerne skal rekrutteres og aktivitetene skal gjennomføres.",
    type: "tekst",
    tegngrense: 900,
    pakrevd: true,
  },
  {
    id: "3.3_budsjett",
    seksjon: "3. Gjennomføring",
    navn: "Budsjett",
    hjelpetekst:
      "Sett opp en oversikt over alle inntekter og utgifter. Søknadssum må være minst 1/3 av totalbudsjettet.",
    type: "tabell",
    kolonner: ["Post", "Beløp (kr)"],
    pakrevd: true,
  },
  {
    id: "3.3.2",
    seksjon: "3. Gjennomføring",
    navn: "Utdyp om budsjettet",
    hjelpetekst:
      "Beskriv kort de viktigste utgiftene og eventuelt hvor «andre inntekter» kommer fra.",
    type: "tekst",
    tegngrense: 400,
    pakrevd: true,
  },
  {
    id: "3.3.3",
    seksjon: "3. Gjennomføring",
    navn: "Innkjøp av utstyr",
    hjelpetekst:
      "Beskriv evt. utstyr som skal kjøpes inn og hvordan det er knyttet til aktivitetene.",
    type: "tekst",
    tegngrense: 300,
    pakrevd: false,
  },
  {
    id: "3.4.1",
    seksjon: "3. Gjennomføring",
    navn: "Mulige utfordringer (velg maks 3)",
    hjelpetekst:
      "Hvilke utfordringer kan oppstå i prosjektet? Velg maksimalt tre.",
    type: "valg_flere",
    pakrevd: true,
    maksValg: 3,
    valg: [
      { kode: "rekruttering", etikett: "Rekruttering av deltakere" },
      { kode: "gjennomforing", etikett: "Praktisk gjennomføring" },
      { kode: "kompetanse", etikett: "Kompetanse i prosjektgruppa" },
      { kode: "budsjett", etikett: "Budsjett-overskridelser" },
      { kode: "tidsplan", etikett: "Tidsplan" },
      { kode: "samarbeid", etikett: "Samarbeid med eksterne" },
      { kode: "etisk", etikett: "Etiske utfordringer" },
      { kode: "annet", etikett: "Andre utfordringer" },
    ],
  },
  {
    id: "3.4.2",
    seksjon: "3. Gjennomføring",
    navn: "Andre utfordringer (frifelt)",
    hjelpetekst:
      "Hvis dere har valgt «Andre utfordringer» — beskriv kort hva.",
    type: "tekst",
    tegngrense: 200,
    pakrevd: false,
  },
  {
    id: "3.4.3",
    seksjon: "3. Gjennomføring",
    navn: "Mulige løsninger",
    hjelpetekst: "Beskriv kort hvordan utfordringene kan løses.",
    type: "tekst",
    tegngrense: 600,
    pakrevd: true,
  },
  {
    id: "3.4.4",
    seksjon: "3. Gjennomføring",
    navn: "Sannsynlighet for utfordringer",
    hjelpetekst: "Hvor sannsynlig er det at utfordringene oppstår?",
    type: "valg_flere",
    pakrevd: true,
    maksValg: 1,
    valg: [
      { kode: "lav", etikett: "Lav" },
      { kode: "middels", etikett: "Middels" },
      { kode: "hoy", etikett: "Høy" },
    ],
  },

  // === SEKSJON 4: STIFTELSEN DAMS PRIORITERINGER ===
  {
    id: "4.1.1",
    seksjon: "4. Stiftelsen Dams prioriteringer",
    navn: "Prioriterte områder",
    hjelpetekst:
      "Beskriv hvordan prosjektet retter seg mot de prioriterte områdene (frivillighet, brukerinvolvering, lokal forankring). Hvis prosjektet ikke retter seg mot noen av de prioriterte områdene, skriv «Ingen» her.",
    type: "tekst",
    tegngrense: 400,
    pakrevd: true,
  },
];

/** Henter et felt på ID. */
export function finnFelt(id: string): EkspressFelt | undefined {
  return EKSPRESS_FELTER.find((f) => f.id === id);
}

/** Grupperer felt etter seksjon — for rendering av skjemaet. */
export function gruppertEtterSeksjon(): Map<string, EkspressFelt[]> {
  const map = new Map<string, EkspressFelt[]>();
  for (const felt of EKSPRESS_FELTER) {
    const eksisterende = map.get(felt.seksjon) ?? [];
    eksisterende.push(felt);
    map.set(felt.seksjon, eksisterende);
  }
  return map;
}
