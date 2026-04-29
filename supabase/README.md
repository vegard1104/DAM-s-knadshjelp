# Supabase-migrasjoner

Denne mappa inneholder SQL-migrasjoner for DAM Søknadshjelpe.

## Hva er en migrasjon?

En migrasjon er en SQL-fil som legger til/endrer noe i databasen. Vi
kjører dem i rekkefølge (0001, 0002, …) og holder dem versjonert i
Git slik at hele sekvensen er reproduserbar.

## Kjøre migrasjonene

### Alternativ 1 — Supabase Dashboard (enklest)

1. Gå til [SQL Editor](https://supabase.com/dashboard/project/qtfpxfaktbfgumhaecdz/sql/new)
2. Åpne `migrations/0001_initial_schema.sql` i en teksteditor
3. Kopier hele innholdet
4. Lim inn i SQL Editor
5. Klikk **"Run"** (eller Ctrl+Enter)
6. Verifiser ved å gå til **Database → Tables** — skal se 6 tabeller:
   `profiles`, `soknader`, `vurderinger`, `dam_svar`, `feedback`,
   `rubrikk_endringslogg`

7. Logg inn på appen (https://dam-s-knadshjelp.vercel.app) — det
   oppretter en `profiles`-rad for deg via trigger.

8. Tilbake til SQL Editor — kjør `migrations/0002_set_initial_admin.sql`
   for å gi deg admin-tilgang.

### Alternativ 2 — Supabase CLI (for senere)

Hvis vi vil automatisere senere kan vi bruke `supabase db push`.
Krever at vi kobler prosjektet med `supabase link`. Ikke nødvendig nå.

## Migrasjonene

| Fil | Hva den gjør |
|---|---|
| `0001_initial_schema.sql` | Oppretter alle 6 tabeller, enums, indexes, triggers, RLS-policies og Storage-bucketen for DAM-svar-PDFer. |
| `0002_set_initial_admin.sql` | Setter Vegards bruker (vegard.hauge99@gmail.com) som admin. Kjør etter at du har registrert deg i Supabase Auth. |

## Endre databasen senere

Når vi trenger å legge til/endre noe, lager vi en ny fil
`0003_navn_på_endringen.sql`. Vi endrer ALDRI tidligere migrasjoner —
det ville bryte med tidligere kjørte databaser.
