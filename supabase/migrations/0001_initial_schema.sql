-- ============================================================
-- DAM Søknadshjelpe — initial database-skjema
-- ============================================================
-- Skjemaet skal kjøres ÉN gang i Supabase SQL Editor.
-- Hvis det allerede finnes data eller tabeller, kjører ikke noe — vi
-- bruker IF NOT EXISTS / DO blocks for å være idempotent.

-- ============================================================
-- 1. ENUMS — kontrollerte verdilister
-- ============================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('bruker', 'admin', 'utvikler');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE program AS ENUM ('ekspress', 'helse', 'utvikling', 'forskning');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE soknad_status AS ENUM (
    'kladd',       -- jobber med
    'vurdert',     -- har fått minst én agent-vurdering
    'sendt',       -- sendt til DAM, venter svar
    'innvilget',   -- DAM ga ja
    'avslag'       -- DAM ga nei
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vurdering_anbefaling AS ENUM (
    'klar_til_innsending',
    'bor_forbedres',
    'trenger_arbeid',
    'vesentlige_mangler'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dam_utfall AS ENUM ('innvilget', 'avslag');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE feedback_type AS ENUM (
    'tommel_opp',
    'tommel_ned',
    'utvikler_endring'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE endringslogg_status AS ENUM ('ny', 'godkjent', 'avvist');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- 2. TABELLER
-- ============================================================

-- ---------- profiles ----------
-- Utvider Supabase auth.users med navn og rolle. Én rad per innlogget bruker.
-- Opprettes automatisk via trigger når en ny auth.users-rad lages (se §4).
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  navn        text NOT NULL DEFAULT '',
  role        user_role NOT NULL DEFAULT 'bruker',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Utvidelse av auth.users med navn og rolle. Opprettes automatisk via trigger.';


-- ---------- soknader ----------
-- Selve søknadene. felter-kolonnen er JSON med program-spesifikke felt
-- (alle Ekspress-feltene for et Ekspress-prosjekt, alle Helse-feltene for
-- et Helse-prosjekt osv.). De viktigste filter-feltene er kopiert ut til
-- egne kolonner for raskere SQL-filtrering og UI-rendering.
CREATE TABLE IF NOT EXISTS public.soknader (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program             program NOT NULL,
  tittel              text NOT NULL DEFAULT '',
  status              soknad_status NOT NULL DEFAULT 'kladd',

  -- Alle skjemafelt fra Damnett som JSON. Eksempel for Ekspress:
  -- { "1.1.2": "...", "2.1.1_antall": 30, "2.1.2": "...", "3.1_oppstart": "2026-08-01", ... }
  felter              jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Filter-felt kopiert ut for SQL-bruk
  soknadssum_kr       integer,
  totalbudsjett_kr    integer,
  oppstart_dato       date,
  avslutt_dato        date,

  -- Tidsstempler
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  last_modified_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.soknader IS 'Alle DAM-søknader. felter er JSON med program-spesifikke felt. Auto-slettes etter 90 dager kun hvis status=kladd.';
COMMENT ON COLUMN public.soknader.felter IS 'Alle skjemafelt som JSON. Strukturen følger Damnett-skjemaet for det aktuelle programmet.';


-- ---------- vurderinger ----------
-- Claudes vurderinger av en søknad. Vi tillater flere per søknad
-- (versjonering) slik at man kan se hvordan scoren utvikler seg når
-- søknaden redigeres.
CREATE TABLE IF NOT EXISTS public.vurderinger (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  soknad_id                uuid NOT NULL REFERENCES public.soknader(id) ON DELETE CASCADE,
  versjon                  integer NOT NULL DEFAULT 1,

  -- Score per kriterium på 1–7-skala (DAM-rubrikken)
  score_soliditet          numeric(3,1) CHECK (score_soliditet IS NULL OR score_soliditet BETWEEN 1 AND 7),
  score_virkning           numeric(3,1) CHECK (score_virkning IS NULL OR score_virkning BETWEEN 1 AND 7),
  score_gjennomforing      numeric(3,1) CHECK (score_gjennomforing IS NULL OR score_gjennomforing BETWEEN 1 AND 7),
  score_prioriteringer     numeric(3,1) CHECK (score_prioriteringer IS NULL OR score_prioriteringer BETWEEN 1 AND 7),
  snitt_score              numeric(3,2),  -- beregnes ved insert
  anbefaling               vurdering_anbefaling NOT NULL,

  -- Agentens narrative output
  begrunnelse              text,
  forbedringer             jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ felt, original, forslag, hvorfor }]
  rode_flagg               jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ tekst, alvorlighet }]

  -- Sporbarhet for senere debugging og kvalitetsmåling
  modell_brukt             text,                                 -- f.eks. "claude-sonnet-4-6"
  system_prompt_versjon    text,                                 -- f.eks. "ekspress-v2"
  ra_response              jsonb,                                -- hele Claude-svaret for debugging

  created_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT vurderinger_soknad_versjon_unik UNIQUE (soknad_id, versjon)
);

COMMENT ON TABLE public.vurderinger IS 'Claudes vurderinger. Append-only — flere vurderinger per søknad (versjonering).';


-- ---------- dam_svar ----------
-- DAMs faktiske svar. Én rad per søknad (UNIQUE soknad_id).
-- Brukes for å sammenligne agent-vurdering mot virkelighet.
CREATE TABLE IF NOT EXISTS public.dam_svar (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  soknad_id             uuid NOT NULL UNIQUE REFERENCES public.soknader(id) ON DELETE CASCADE,
  utfall                dam_utfall NOT NULL,
  innvilget_belop_kr    integer,                  -- kun ved utfall=innvilget
  begrunnelse_avslag    text,                     -- kun ved utfall=avslag
  pdf_path              text,                     -- Supabase Storage-path
  registrert_av         uuid REFERENCES public.profiles(id),
  created_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.dam_svar IS 'DAMs faktiske svar — for å sammenligne agent-vurdering mot virkelighet.';


-- ---------- feedback ----------
-- Brukerens tilbakemelding på en vurdering. Maks én av hver type per
-- bruker per vurdering (du kan endre, men ikke ha flere parallelle).
CREATE TABLE IF NOT EXISTS public.feedback (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vurdering_id          uuid NOT NULL REFERENCES public.vurderinger(id) ON DELETE CASCADE,
  bruker_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type                  feedback_type NOT NULL,
  kommentar             text,
  behandlet_av_agent    boolean NOT NULL DEFAULT false,  -- gjelder utvikler_endring: er endringen applisert?
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT feedback_unik_per_bruker_type UNIQUE (vurdering_id, bruker_id, type)
);

COMMENT ON TABLE public.feedback IS 'Tommel opp/ned + utvikler-endringsforslag på en vurdering.';


-- ---------- rubrikk_endringslogg ----------
-- Forslag fra brukere til endringer i scoringsrubrikken.
-- Auto-applieres IKKE — venter på admin-godkjenning.
CREATE TABLE IF NOT EXISTS public.rubrikk_endringslogg (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  foreslatt_av      uuid NOT NULL REFERENCES public.profiles(id),
  kriterium         text NOT NULL,           -- 'soliditet' / 'virkning' / 'gjennomforing' / 'prioriteringer' / 'generell'
  forslag           text NOT NULL,
  begrunnelse       text,
  status            endringslogg_status NOT NULL DEFAULT 'ny',
  behandlet_av      uuid REFERENCES public.profiles(id),
  behandlet_at      timestamptz,
  behandlet_notat   text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rubrikk_endringslogg IS 'Forslag til rubrikk-endringer. Krever admin-godkjenning.';


-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_soknader_owner          ON public.soknader (owner_id);
CREATE INDEX IF NOT EXISTS idx_soknader_status         ON public.soknader (status);
CREATE INDEX IF NOT EXISTS idx_soknader_program        ON public.soknader (program);
CREATE INDEX IF NOT EXISTS idx_soknader_last_mod       ON public.soknader (last_modified_at);
CREATE INDEX IF NOT EXISTS idx_vurderinger_soknad      ON public.vurderinger (soknad_id);
CREATE INDEX IF NOT EXISTS idx_dam_svar_soknad         ON public.dam_svar (soknad_id);
CREATE INDEX IF NOT EXISTS idx_feedback_vurdering      ON public.feedback (vurdering_id);
CREATE INDEX IF NOT EXISTS idx_feedback_bruker         ON public.feedback (bruker_id);
CREATE INDEX IF NOT EXISTS idx_endringslogg_status     ON public.rubrikk_endringslogg (status);


-- ============================================================
-- 4. TRIGGERS OG FUNKSJONER
-- ============================================================

-- updated_at-oppdaterer (gjenbruktbar)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS soknader_set_updated_at ON public.soknader;
CREATE TRIGGER soknader_set_updated_at
  BEFORE UPDATE ON public.soknader
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- last_modified_at-oppdaterer for soknader (brukes av 90-dagers sletting)
CREATE OR REPLACE FUNCTION public.set_last_modified_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS soknader_set_last_modified ON public.soknader;
CREATE TRIGGER soknader_set_last_modified
  BEFORE UPDATE ON public.soknader
  FOR EACH ROW EXECUTE FUNCTION public.set_last_modified_at();


-- Beregn snitt_score automatisk når vurdering settes inn/oppdateres
CREATE OR REPLACE FUNCTION public.calc_vurdering_snitt()
RETURNS TRIGGER AS $$
DECLARE
  scores numeric[];
  sum_val numeric := 0;
  cnt integer := 0;
  v numeric;
BEGIN
  scores := ARRAY[
    NEW.score_soliditet,
    NEW.score_virkning,
    NEW.score_gjennomforing,
    NEW.score_prioriteringer
  ];

  FOREACH v IN ARRAY scores LOOP
    IF v IS NOT NULL THEN
      sum_val := sum_val + v;
      cnt := cnt + 1;
    END IF;
  END LOOP;

  IF cnt > 0 THEN
    NEW.snitt_score := round(sum_val / cnt, 2);
  ELSE
    NEW.snitt_score := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vurderinger_calc_snitt ON public.vurderinger;
CREATE TRIGGER vurderinger_calc_snitt
  BEFORE INSERT OR UPDATE ON public.vurderinger
  FOR EACH ROW EXECUTE FUNCTION public.calc_vurdering_snitt();


-- Auto-opprett profile når ny auth.users-rad lages
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, navn)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'navn', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auth_user_created ON auth.users;
CREATE TRIGGER auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- Hjelpefunksjon: er innlogget bruker admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- Auto-slett gamle kladder. Kjøres manuelt eller via cron.
-- IKKE skedulert automatisk i denne MVP-en — Vegard kan slå på senere.
CREATE OR REPLACE FUNCTION public.delete_old_drafts()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.soknader
    WHERE status = 'kladd'
      AND last_modified_at < (now() - interval '90 days')
    RETURNING 1
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.delete_old_drafts IS 'Sletter kladder eldre enn 90 dager. Kjør manuelt eller skedulér via pg_cron når dere er klare.';


-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soknader               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vurderinger            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dam_svar               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubrikk_endringslogg   ENABLE ROW LEVEL SECURITY;


-- ---------- profiles ----------
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;
CREATE POLICY profiles_update_self_or_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- INSERT/DELETE er kun via trigger og admin (admin via service-role-key)
DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
CREATE POLICY profiles_admin_all ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ---------- soknader ----------
-- Sekretariatet samarbeider — alle innloggede ser alt.
DROP POLICY IF EXISTS soknader_select ON public.soknader;
CREATE POLICY soknader_select ON public.soknader
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS soknader_insert_self ON public.soknader;
CREATE POLICY soknader_insert_self ON public.soknader
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS soknader_update_owner_or_admin ON public.soknader;
CREATE POLICY soknader_update_owner_or_admin ON public.soknader
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin())
  WITH CHECK (owner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS soknader_delete_owner_or_admin ON public.soknader;
CREATE POLICY soknader_delete_owner_or_admin ON public.soknader
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin());


-- ---------- vurderinger ----------
DROP POLICY IF EXISTS vurderinger_select ON public.vurderinger;
CREATE POLICY vurderinger_select ON public.vurderinger
  FOR SELECT TO authenticated
  USING (true);

-- Vurdering kan kun opprettes av eier av søknaden (eller admin)
DROP POLICY IF EXISTS vurderinger_insert_owner ON public.vurderinger;
CREATE POLICY vurderinger_insert_owner ON public.vurderinger
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.soknader s
      WHERE s.id = soknad_id
        AND (s.owner_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS vurderinger_delete_owner_or_admin ON public.vurderinger;
CREATE POLICY vurderinger_delete_owner_or_admin ON public.vurderinger
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.soknader s
      WHERE s.id = soknad_id
        AND (s.owner_id = auth.uid() OR public.is_admin())
    )
  );


-- ---------- dam_svar ----------
DROP POLICY IF EXISTS dam_svar_select ON public.dam_svar;
CREATE POLICY dam_svar_select ON public.dam_svar
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS dam_svar_insert_owner ON public.dam_svar;
CREATE POLICY dam_svar_insert_owner ON public.dam_svar
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.soknader s
      WHERE s.id = soknad_id
        AND (s.owner_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS dam_svar_update_owner ON public.dam_svar;
CREATE POLICY dam_svar_update_owner ON public.dam_svar
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.soknader s
      WHERE s.id = soknad_id
        AND (s.owner_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS dam_svar_delete_owner ON public.dam_svar;
CREATE POLICY dam_svar_delete_owner ON public.dam_svar
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.soknader s
      WHERE s.id = soknad_id
        AND (s.owner_id = auth.uid() OR public.is_admin())
    )
  );


-- ---------- feedback ----------
DROP POLICY IF EXISTS feedback_select ON public.feedback;
CREATE POLICY feedback_select ON public.feedback
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS feedback_insert_self ON public.feedback;
CREATE POLICY feedback_insert_self ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (bruker_id = auth.uid());

DROP POLICY IF EXISTS feedback_update_self_or_admin ON public.feedback;
CREATE POLICY feedback_update_self_or_admin ON public.feedback
  FOR UPDATE TO authenticated
  USING (bruker_id = auth.uid() OR public.is_admin())
  WITH CHECK (bruker_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS feedback_delete_self_or_admin ON public.feedback;
CREATE POLICY feedback_delete_self_or_admin ON public.feedback
  FOR DELETE TO authenticated
  USING (bruker_id = auth.uid() OR public.is_admin());


-- ---------- rubrikk_endringslogg ----------
DROP POLICY IF EXISTS endringslogg_select ON public.rubrikk_endringslogg;
CREATE POLICY endringslogg_select ON public.rubrikk_endringslogg
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS endringslogg_insert ON public.rubrikk_endringslogg;
CREATE POLICY endringslogg_insert ON public.rubrikk_endringslogg
  FOR INSERT TO authenticated
  WITH CHECK (foreslatt_av = auth.uid());

DROP POLICY IF EXISTS endringslogg_update_admin ON public.rubrikk_endringslogg;
CREATE POLICY endringslogg_update_admin ON public.rubrikk_endringslogg
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS endringslogg_delete_admin ON public.rubrikk_endringslogg;
CREATE POLICY endringslogg_delete_admin ON public.rubrikk_endringslogg
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ============================================================
-- 6. STORAGE — bucket for DAM-svar-PDFer
-- ============================================================

-- Bucket opprettes hvis den ikke finnes (privat — kun via signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dam-svar-pdf',
  'dam-svar-pdf',
  false,
  10485760,                                 -- 10 MB
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: alle innloggede kan se og laste opp filer i bucketen.
-- Filsti-konvensjon: {soknad_id}/{filnavn.pdf}
DROP POLICY IF EXISTS storage_dam_svar_select ON storage.objects;
CREATE POLICY storage_dam_svar_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'dam-svar-pdf');

DROP POLICY IF EXISTS storage_dam_svar_insert ON storage.objects;
CREATE POLICY storage_dam_svar_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dam-svar-pdf');

DROP POLICY IF EXISTS storage_dam_svar_delete ON storage.objects;
CREATE POLICY storage_dam_svar_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'dam-svar-pdf');


-- ============================================================
-- 7. BACKFILL — opprett profiler for eksisterende auth-brukere
-- ============================================================
-- Triggeren over fyrer kun for NYE auth.users-rader. Brukere som
-- registrerte seg før migrasjonen ble kjørt mangler en profil-rad.
-- Vi backfiller dem her.

INSERT INTO public.profiles (id, email, navn)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'navn', split_part(u.email, '@', 1))
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;


-- ============================================================
-- FERDIG! Verifiser ved å kjøre:
--   SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- Skal gi 6 rader: profiles, soknader, vurderinger, dam_svar, feedback, rubrikk_endringslogg
--
--   SELECT id, email, navn, role FROM public.profiles;
-- Skal gi minst én rad — din egen.
-- ============================================================
