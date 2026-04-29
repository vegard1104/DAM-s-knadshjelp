-- ============================================================
-- Sett Vegards bruker som admin
-- ============================================================
-- Kjør denne ETTER 0001_initial_schema.sql, og ETTER at du har
-- registrert minst én bruker (deg selv) i Supabase Authentication.
--
-- Endre e-postadressen under hvis nødvendig.

UPDATE public.profiles
SET role = 'admin'
WHERE email = 'vegard.hauge99@gmail.com';

-- Verifiser:
SELECT id, email, navn, role, created_at FROM public.profiles;
