import { NextResponse } from "next/server";

/**
 * Enkelt diagnostikkendepunkt for å verifisere at Vercel-deployment fungerer.
 * Returnerer JSON med oppstart-tid og status på de viktigste env-varene
 * (uten å avsløre selve verdiene).
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "DAM Søknadshjelpe",
    time: new Date().toISOString(),
    env: {
      supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_anon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabase_secret: !!process.env.SUPABASE_SECRET_KEY,
      anthropic_key: !!process.env.ANTHROPIC_API_KEY,
      anthropic_model: process.env.ANTHROPIC_MODEL ?? null,
    },
  });
}
