import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase-klient for serveren (Server Components, Server Actions, Route Handlers).
 * Leser/skriver auth-cookies slik at innloggede brukere kan kjøre spørringer
 * mot databasen mens RLS-policies kjøres på deres vegne.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase-konfigurasjon mangler på serveren. Sett " +
        "NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY i Vercel.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
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
  });
}
