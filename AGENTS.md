<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# DAM Søknadshjelpe — for Claude Code

Internt verktøy for sekretariatet i CP-foreningen. Hjelper dem skrive bedre
søknader til Stiftelsen Dam. MVP dekker Ekspress-programmet; Helse,
Utvikling og Forskning kommer senere.

## Kontekst

Source-of-truth-dokumenter ligger i `C:\Users\VegardHauge\Documents\DAM\`:
- `dam-prosjekt-kontekst-v2.md` — scope, eierskap, tilgangsregler, feedback-loop
- `rubrikk-utkast-v1.md` — scoringsrubrikk (1–7) per kriterium
- `system-prompt-ekspress-v2.md` — agent-prompt (kopiert til `src/prompts/`)
- `design/DAM s_knadshjelpe/DESIGN-SYSTEM.md` — fasit for farger/typografi
- `design/DAM s_knadshjelpe/handoff/*.html` — per-side static markup
- `design/DAM s_knadshjelpe/*.jsx` — React-mockups (window-globals — refaktorer)

## Stack

- Next.js 16 (App Router) + TypeScript + React 19
- Tailwind CSS v4 (CSS-først via `@theme {}` i `src/app/globals.css`)
- Supabase (auth + Postgres + Storage)
- Anthropic SDK (Sonnet 4.6 default — `ANTHROPIC_MODEL` env var styrer)
- Vercel hosting

## Mappestruktur

```
src/
├── app/
│   ├── (auth)/login/      # Innlogging — utenfor app-shell
│   ├── (app)/             # Krever innlogging — har sidebar
│   │   ├── dashboard/
│   │   ├── soknader/
│   │   ├── statistikk/
│   │   └── admin/
│   ├── api/claude/        # Server-side Claude API-kall
│   ├── globals.css        # Tailwind v4 @theme-tokens
│   └── layout.tsx
├── components/
│   ├── ui/                # Button, Input, Card, StatusChip, ScoreBar, Avatar
│   ├── layout/            # Sidebar
│   └── soknad/
├── lib/
│   ├── supabase/          # client / server / middleware
│   ├── claude/            # Anthropic SDK-wrapper
│   └── rubrikk/           # Scoring + terskler + røde flagg
├── prompts/               # System-prompter (markdown)
└── middleware.ts
```

## Designsystem-tokens

`src/app/globals.css` definerer CP-farger som `--color-cp-blue`,
`--color-cp-red`, `--color-ink-{1..5}`, `--color-bg-{app,card,sunk}`,
`--color-good`, `--color-warning`, `--color-warm`. Bruk dem som Tailwind
v4-klasser: `bg-cp-blue`, `text-ink-3`, etc.

## Norsk overalt

All UI på norsk. Feilmeldinger oversettes fra Supabase. Tone: profesjonell,
varm, ryddig — i tråd med CP-foreningens designmanual.

## Personvernregler (designsystemets avsnitt 8)

- Personlige tall (mine søknader, min snitt) — kun innlogget bruker ser
- Aggregerte fellestall — alle ser, aldri brutt ned per ansatt
- Felles arkiv — viser titler/tema, masker kollegers individuelle
  agent-score og DAM-utfall

Implementeres via Supabase RLS + UI-komponenter med skjold-ikon.
