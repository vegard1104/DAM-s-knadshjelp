-- ============================================================
-- Lag 1: Database-basert agent-prompt med split (system + rubrikk)
-- Lag 2: Dobbeltsjekk-felt på feedback
-- ============================================================
-- Kjør denne i Supabase SQL Editor som vanlig.

-- ============================================================
-- 1. agent_prompts — lagrer system-prompts og rubrikker per program
-- ============================================================

DO $$ BEGIN
  CREATE TYPE agent_prompt_type AS ENUM ('system_prompt', 'rubrikk');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.agent_prompts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program             program NOT NULL,
  type                agent_prompt_type NOT NULL,
  versjon             text NOT NULL,                   -- f.eks. "ekspress-system-v2"
  innhold             text NOT NULL,                   -- selve prompt-teksten (markdown)
  aktiv               boolean NOT NULL DEFAULT false,  -- kun én aktiv per (program, type)
  endret_av           uuid REFERENCES public.profiles(id),
  endret_at           timestamptz NOT NULL DEFAULT now(),
  endrings_grunnlag   text,                            -- hvorfor denne versjonen ble laget
  forrige_versjon_id  uuid REFERENCES public.agent_prompts(id), -- sporbar historie

  CONSTRAINT agent_prompts_versjon_unik UNIQUE (program, type, versjon)
);

-- Kun én aktiv versjon per (program, type)
CREATE UNIQUE INDEX IF NOT EXISTS agent_prompts_aktiv_unik
  ON public.agent_prompts (program, type)
  WHERE aktiv = true;

CREATE INDEX IF NOT EXISTS idx_agent_prompts_program_type ON public.agent_prompts (program, type);

COMMENT ON TABLE public.agent_prompts IS
  'Versjonerte agent-prompts og rubrikker per program. Hentes ved kjøring av Claude — kan oppdateres uten redeploy.';

-- RLS
ALTER TABLE public.agent_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_prompts_select ON public.agent_prompts;
CREATE POLICY agent_prompts_select ON public.agent_prompts
  FOR SELECT TO authenticated
  USING (true);

-- Kun admin og utvikler-rolle kan endre prompts
DROP POLICY IF EXISTS agent_prompts_insert ON public.agent_prompts;
CREATE POLICY agent_prompts_insert ON public.agent_prompts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'utvikler')
    )
  );

DROP POLICY IF EXISTS agent_prompts_update ON public.agent_prompts;
CREATE POLICY agent_prompts_update ON public.agent_prompts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'utvikler')
    )
  );

-- Sletting kun for admin (utvikler kan deaktivere via aktiv=false, ikke slette historie)
DROP POLICY IF EXISTS agent_prompts_delete ON public.agent_prompts;
CREATE POLICY agent_prompts_delete ON public.agent_prompts
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ============================================================
-- 2. Legg til rubrikk_versjon på vurderinger
-- ============================================================
ALTER TABLE public.vurderinger
  ADD COLUMN IF NOT EXISTS rubrikk_versjon text;

COMMENT ON COLUMN public.vurderinger.rubrikk_versjon IS
  'Versjon av rubrikken som var aktiv da vurderingen ble laget. Kombinert med system_prompt_versjon gir full sporbarhet.';


-- ============================================================
-- 3. Dobbeltsjekk-felt på feedback
-- ============================================================
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS agent_tolkning      text,
  ADD COLUMN IF NOT EXISTS agent_oppfolging    text,
  ADD COLUMN IF NOT EXISTS bruker_bekreftet    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS oppdatert_at        timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.feedback.agent_tolkning IS
  'Claudes tolkning av brukerens kommentar — vises tilbake til brukeren for bekreftelse (dobbeltsjekk-regelen).';
COMMENT ON COLUMN public.feedback.agent_oppfolging IS
  'Eventuelt oppklarende spørsmål Claude stilte hvis tolkningen var usikker.';
COMMENT ON COLUMN public.feedback.bruker_bekreftet IS
  'Har brukeren bekreftet at agentens tolkning er riktig?';


-- ============================================================
-- 4. Hjelpefunksjon: bytt aktiv prompt-versjon
-- ============================================================
-- Bytt aktiv versjon for et (program, type)-par på én atomic transaksjon.
-- Brukes ved opprettelse av ny versjon eller ved rull-tilbake til gammel.
CREATE OR REPLACE FUNCTION public.bytt_aktiv_prompt(
  p_program program,
  p_type agent_prompt_type,
  p_ny_versjon_id uuid
)
RETURNS void AS $$
BEGIN
  -- Sjekk at ny versjon eksisterer og passer
  IF NOT EXISTS (
    SELECT 1 FROM public.agent_prompts
    WHERE id = p_ny_versjon_id
      AND program = p_program
      AND type = p_type
  ) THEN
    RAISE EXCEPTION 'Prompt-versjonen finnes ikke eller passer ikke (program=%, type=%)',
      p_program, p_type;
  END IF;

  -- Deaktiver alle nåværende aktive
  UPDATE public.agent_prompts
  SET aktiv = false
  WHERE program = p_program
    AND type = p_type
    AND aktiv = true;

  -- Aktiver den nye
  UPDATE public.agent_prompts
  SET aktiv = true
  WHERE id = p_ny_versjon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.bytt_aktiv_prompt IS
  'Bytter aktiv prompt-versjon atomært. Kall fra UI ved opprettelse av ny versjon eller rull-tilbake.';


-- ============================================================
-- FERDIG! Verifiser:
--   SELECT type, versjon, aktiv FROM agent_prompts;
-- Skal være tom inntil appen kjører første vurdering — da bootstrappes
-- prompts fra kode-versjonen automatisk.
-- ============================================================
