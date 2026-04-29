"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase-klient for nettleseren (Client Components).
 * Bruker NEXT_PUBLIC_-nøkler — sikre så lenge RLS er aktivert i Supabase.
 *
 * Kaster en tydelig feil hvis env vars mangler, slik at det blir åpenbart
 * hva som er galt i stedet for kryptiske runtime-feil.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase-konfigurasjon mangler. Kontakt admin og sjekk at " +
        "NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY er satt i miljøet.",
    );
  }

  return createBrowserClient(url, anonKey);
}
