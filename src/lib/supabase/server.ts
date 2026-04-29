import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase-klient for serveren (Server Components, Server Actions, Route Handlers).
 * Leser/skriver auth-cookies slik at innloggede brukere kan kjøre spørringer
 * mot databasen mens RLS-policies kjøres på deres vegne.
 *
 * Vi bruker non-null-assert (!) på env vars i stedet for å kaste en feil
 * under modulinitialisering. Det lar Next.js bygge prosjektet selv om vars
 * mangler under build (f.eks. første Vercel-deploy). Hvis varene mangler i
 * prod, vil Supabase selv kaste en tydelig feil ved første API-kall.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll kan kalles fra Server Components der vi ikke får sette cookies.
            // Da gjør proxy/middleware jobben i stedet.
          }
        },
      },
    },
  );
}
