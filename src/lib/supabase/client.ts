"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase-klient for nettleseren (Client Components).
 * Bruker NEXT_PUBLIC_-nøkler — sikre så lenge RLS er aktivert i Supabase.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
