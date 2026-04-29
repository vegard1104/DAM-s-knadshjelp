import Anthropic from "@anthropic-ai/sdk";

/**
 * Claude API-klient for server-side bruk.
 *
 * Modell og nøkkel kommer fra miljøvariabler:
 *   ANTHROPIC_API_KEY  — hemmelig (server-only)
 *   ANTHROPIC_MODEL    — f.eks. "claude-sonnet-4-6"
 *
 * Vi bruker prompt caching (cache_control) der det gir mening — system-
 * prompten er stort sett uendret mellom kall, så cachen sparer både
 * latens og kostnad.
 */

let cachedClient: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!cachedClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY mangler i miljøvariablene. Sett den i Vercel.",
      );
    }
    cachedClient = new Anthropic({ apiKey });
  }
  return cachedClient;
}

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
}
