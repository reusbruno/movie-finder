# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start the dev server (Turbopack)
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)
- `npx tsc --noEmit` — type-check only (no separate script defined; there is no test runner configured in this project)

## Architecture

- **App Router** under `src/app`. Path alias `@/*` maps to `src/*` (see `tsconfig.json`).
- **Server-side API clients live in `src/lib`** and are consumed only by route handlers under `src/app/api/**/route.ts` — never imported from client components. `src/lib/tmdb.ts` is the reference pattern for this: a small `xFetch` helper that attaches auth and normalizes errors into a typed `XError` (carries the upstream HTTP status), plus one exported function per API operation. Follow the same shape for any new external API client (e.g. OMDb).
- **Auth tokens are read via `process.env` only**, never hardcoded — e.g. `TMDB_API_TOKEN` (TMDB v4 bearer token), `ANTHROPIC_API_KEY` (mood search, optional — see below), in `.env.local`, which is git-ignored (`.env*` in `.gitignore`).
- Route handlers translate client errors (missing/invalid params) to `400`, and propagate the upstream API's status code on failure rather than collapsing everything to `500`.
- Styling is Tailwind v4 via `@tailwindcss/postcss` (see `postcss.config.mjs`, `src/app/globals.css`); no component library is in use yet.

## Build plan

Phase 1 (done): core browsing experience.

1. ~~Server-side TMDB client + API routes~~ — done (`src/lib/tmdb.ts`, `src/app/api/movies/search`, `src/app/api/movies/[id]`). Verified against the live TMDB API; env-var handling checked clean (no raw token anywhere outside `.env.local`).
2. ~~Movies/Series toggle + shared UI shell~~ — done (layout/nav common to both modes).
3. ~~Search feature + recommendations grid~~ — done.
4. ~~Browse mode: genre checkboxes + sort controls~~ — done.
5. ~~IMDb/RT score filtering via OMDb~~ — done (`src/lib/ratings.ts`); see Known follow-ups for a pending dedup check.
6. ~~TMDB attribution notice in the footer~~ — done (`src/components/tmdb-attribution.tsx`).

Phase 2: build ONE AT A TIME, each with the usual verify-then-commit cycle before starting the next.

1. ~~Free-text mood search~~ — built (`src/lib/mood-search.ts`, `src/app/api/movies/mood-search`, `src/app/api/tv/mood-search`). Claude Haiku 4.5 via structured outputs turns a query into genres (constrained to the real TMDB genre list)/keywords/reference titles/sort/year-range, resolved against TMDB (`with_keywords` added to `discoverMovies`/`discoverTV`) and fed into the existing discover pipeline. Degrades to a visible-but-disabled input ("Mood search — coming soon") when `ANTHROPIC_API_KEY` is unset; verified via lint/typecheck/build plus a real dev-server run (disabled state screenshotted, availability/validation/error-mapping branches exercised with a fake key against the live Anthropic API). See Known follow-ups for the one thing still unverified.
2. Vibe blending — pick two titles, get recommendations between them (keyword/genre intersection + recommendation overlap).
3. "Why this match" explanations on recommendation cards (shared keywords, cast/crew, themes).
4. Where-to-watch — TMDB's watch-providers endpoint, per-region.
5. Watchlist — localStorage-based, no accounts.
6. "Surprise me" — random pick respecting active filters.

## Known follow-ups

- Verify OMDb-call dedup once the free-tier quota resets: `src/lib/ratings.ts`'s `getRatings` marks a cache entry fresh optimistically before its fetch settles, so concurrent lookups for the same title should reuse the one in-flight fetch rather than each firing their own OMDb request. This was verified against a standalone re-implementation of the caching logic (see the 2026-07-08 ratings-cache-TTL change), not against the real API - OMDb's key was over its daily limit ("Request limit reached!") at the time. To check: load a page that triggers several simultaneous lookups for the same title (e.g. a popular grid where the same movie appears in both the main grid and a "More like this" row) and confirm only one real OMDb call fires, not several.
- Verify mood search against the real Anthropic API once `ANTHROPIC_API_KEY` is added to `.env.local`: confirm a real query (e.g. "slow melancholic sci-fi") returns sensible genres/keywords, the "Interpreted as: …" caption renders, and submitting mood search clears the quick-search/genre/sort state (and vice versa) in `MediaExplorer`. Everything up to the live LLM call itself was verified (see build plan item 1); only the actual interpretation quality and the client-side mutual-exclusion UI are unverified.
