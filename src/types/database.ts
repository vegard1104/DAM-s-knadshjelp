/**
 * TypeScript-typer for Supabase-skjemaet.
 * Speiler 1:1 supabase/migrations/0001_initial_schema.sql.
 *
 * Når skjemaet endres må disse oppdateres manuelt — eventuelt kan vi
 * senere generere dem automatisk med `supabase gen types typescript`.
 */

// ---------- Enums ----------

export type UserRole = "bruker" | "admin" | "utvikler";

export type Program = "ekspress" | "helse" | "utvikling" | "forskning";

export type SoknadStatus =
  | "kladd"
  | "vurdert"
  | "sendt"
  | "innvilget"
  | "avslag";

export type VurderingAnbefaling =
  | "klar_til_innsending"
  | "bor_forbedres"
  | "trenger_arbeid"
  | "vesentlige_mangler";

export type DamUtfall = "innvilget" | "avslag";

export type FeedbackType =
  | "tommel_opp"
  | "tommel_ned"
  | "utvikler_endring";

export type EndringsloggStatus = "ny" | "godkjent" | "avvist";

// ---------- Tabell-rader ----------

export type Profile = {
  id: string;
  email: string;
  navn: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

/**
 * Forbedringsforslag fra agenten — én per skjemafelt.
 */
export type Forbedring = {
  felt: string;        // f.eks. "1.1.2"
  original: string;    // brukerens originaltekst
  forslag: string;     // agentens omskrevne tekst
  hvorfor: string;     // begrunnelse for endringen
};

/**
 * Rødt flagg fra agenten — diskvalifiserende eller alvorlig.
 */
export type RodtFlagg = {
  tekst: string;
  alvorlighet: "kritisk" | "advarsel" | "info";
};

export type Soknad = {
  id: string;
  owner_id: string;
  program: Program;
  tittel: string;
  status: SoknadStatus;
  felter: Record<string, unknown>; // program-spesifikt — se prompts/ekspress-felter.ts
  soknadssum_kr: number | null;
  totalbudsjett_kr: number | null;
  oppstart_dato: string | null;    // ISO date
  avslutt_dato: string | null;
  created_at: string;
  updated_at: string;
  last_modified_at: string;
};

export type Vurdering = {
  id: string;
  soknad_id: string;
  versjon: number;
  score_soliditet: number | null;
  score_virkning: number | null;
  score_gjennomforing: number | null;
  score_prioriteringer: number | null;
  snitt_score: number | null;
  anbefaling: VurderingAnbefaling;
  begrunnelse: string | null;
  forbedringer: Forbedring[];
  rode_flagg: RodtFlagg[];
  modell_brukt: string | null;
  system_prompt_versjon: string | null;
  ra_response: unknown;
  created_at: string;
};

export type DamSvar = {
  id: string;
  soknad_id: string;
  utfall: DamUtfall;
  innvilget_belop_kr: number | null;
  begrunnelse_avslag: string | null;
  pdf_path: string | null;
  registrert_av: string | null;
  created_at: string;
};

export type Feedback = {
  id: string;
  vurdering_id: string;
  bruker_id: string;
  type: FeedbackType;
  kommentar: string | null;
  behandlet_av_agent: boolean;
  created_at: string;
};

export type RubrikkEndringslogg = {
  id: string;
  foreslatt_av: string;
  kriterium: string;
  forslag: string;
  begrunnelse: string | null;
  status: EndringsloggStatus;
  behandlet_av: string | null;
  behandlet_at: string | null;
  behandlet_notat: string | null;
  created_at: string;
};

// ---------- Insert-typer (alt utenom auto-genererte felt er valgfrie) ----------

export type SoknadInsert = {
  owner_id: string;
  program: Program;
  tittel?: string;
  status?: SoknadStatus;
  felter?: Record<string, unknown>;
  soknadssum_kr?: number | null;
  totalbudsjett_kr?: number | null;
  oppstart_dato?: string | null;
  avslutt_dato?: string | null;
};

export type SoknadUpdate = Partial<Omit<SoknadInsert, "owner_id">>;

export type VurderingInsert = {
  soknad_id: string;
  versjon?: number;
  score_soliditet?: number | null;
  score_virkning?: number | null;
  score_gjennomforing?: number | null;
  score_prioriteringer?: number | null;
  anbefaling: VurderingAnbefaling;
  begrunnelse?: string | null;
  forbedringer?: Forbedring[];
  rode_flagg?: RodtFlagg[];
  modell_brukt?: string | null;
  system_prompt_versjon?: string | null;
  ra_response?: unknown;
};

// ---------- Helper-typer for hele Supabase-databasen ----------

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Pick<Profile, "id" | "email"> & Partial<Profile>;
        Update: Partial<Profile>;
      };
      soknader: {
        Row: Soknad;
        Insert: SoknadInsert;
        Update: SoknadUpdate;
      };
      vurderinger: {
        Row: Vurdering;
        Insert: VurderingInsert;
        Update: Partial<VurderingInsert>;
      };
      dam_svar: {
        Row: DamSvar;
        Insert: Omit<DamSvar, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<DamSvar>;
      };
      feedback: {
        Row: Feedback;
        Insert: Omit<Feedback, "id" | "created_at" | "behandlet_av_agent"> & {
          id?: string;
          created_at?: string;
          behandlet_av_agent?: boolean;
        };
        Update: Partial<Feedback>;
      };
      rubrikk_endringslogg: {
        Row: RubrikkEndringslogg;
        Insert: Omit<
          RubrikkEndringslogg,
          "id" | "created_at" | "status"
        > & {
          id?: string;
          created_at?: string;
          status?: EndringsloggStatus;
        };
        Update: Partial<RubrikkEndringslogg>;
      };
    };
  };
};
