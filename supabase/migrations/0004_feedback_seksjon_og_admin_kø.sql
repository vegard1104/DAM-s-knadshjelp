-- ============================================================
-- Lag 2.5: Seksjons-spesifikk feedback (trener-modus) + admin-kø
-- ============================================================
-- Endringer i feedback-tabellen for å støtte:
--  1. Seksjons-spesifikk feedback fra admin/utvikler ("trener-modus")
--     med eget felt for omskrivning per seksjon.
--  2. Admin-status (ny/behandlet/implementert/avvist) slik at admin
--     kan jobbe seg gjennom køen av forbedringspunkter.

ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS target_section          text,
  ADD COLUMN IF NOT EXISTS foreslatt_omskrivning   text,
  ADD COLUMN IF NOT EXISTS admin_status            text NOT NULL DEFAULT 'ny',
  ADD COLUMN IF NOT EXISTS admin_notat             text,
  ADD COLUMN IF NOT EXISTS behandlet_av            uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS behandlet_at            timestamptz;

-- Begrens admin_status til kjente verdier
DO $$ BEGIN
  ALTER TABLE public.feedback
    ADD CONSTRAINT feedback_admin_status_check
    CHECK (admin_status IN ('ny', 'behandlet', 'implementert', 'avvist'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Drop den gamle unique-constraint som forhindret flere
-- seksjons-feedback-rader per bruker/vurdering
ALTER TABLE public.feedback
  DROP CONSTRAINT IF EXISTS feedback_unik_per_bruker_type;

-- To nye delvise unique-indekser:
--  * Generell feedback: én av hver type per bruker per vurdering
--    (når target_section er null, dvs. fra det vanlige bunn-panelet)
CREATE UNIQUE INDEX IF NOT EXISTS feedback_unik_generell
  ON public.feedback (vurdering_id, bruker_id, type)
  WHERE target_section IS NULL;

--  * Seksjons-feedback: én per seksjon per bruker per vurdering
--    (uavhengig av tommel-type, siden brukeren kan endre fra opp til
--    ned eller motsatt — vi vil ha kun én pågående feedback per seksjon)
CREATE UNIQUE INDEX IF NOT EXISTS feedback_unik_seksjon
  ON public.feedback (vurdering_id, bruker_id, target_section)
  WHERE target_section IS NOT NULL;

-- Indekser for admin-køen
CREATE INDEX IF NOT EXISTS idx_feedback_admin_status
  ON public.feedback (admin_status);

CREATE INDEX IF NOT EXISTS idx_feedback_target_section
  ON public.feedback (target_section)
  WHERE target_section IS NOT NULL;

-- Kommentarer for fremtidig deg
COMMENT ON COLUMN public.feedback.target_section IS
  'NULL for generell feedback (bunn-panel). Ellers seksjons-id som "kriterium_soliditet", "rode_flagg", "forbedring:1.1.2", "anbefaling", "note".';
COMMENT ON COLUMN public.feedback.foreslatt_omskrivning IS
  'Trenerens forslag til hvordan den seksjonen burde vært skrevet/vurdert. Kun fra admin/utvikler.';
COMMENT ON COLUMN public.feedback.admin_status IS
  'ny (innkommet) | behandlet (admin har sett) | implementert (sendt til prompt-endring via lag 3) | avvist.';
COMMENT ON COLUMN public.feedback.behandlet_av IS
  'Hvilken admin behandlet denne feedbacken.';

-- ============================================================
-- FERDIG. Verifiser:
--   SELECT admin_status, COUNT(*) FROM feedback GROUP BY admin_status;
-- Skal vise alle eksisterende feedback med admin_status='ny' (default).
-- ============================================================
