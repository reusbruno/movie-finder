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
2. ~~Vibe blending~~ — built (`src/lib/vibe-blend.ts`, `src/app/api/movies/vibe-blend`, `src/app/api/tv/vibe-blend`, `src/components/title-picker.tsx`). Union of both titles' genres/keywords is the discover candidate pool (one page, 20 results); each candidate is scored per-signal (genre/keyword/recommendation-list membership), doubled-to-quadrupled when it hits *both* seed titles rather than one, and TMDB's own `/recommendations` overlap is weighted highest. New "Blend" mode in `MediaExplorer`, mutually exclusive with search/mood/filters, with a "Blending: X + Y" caption. Verified via lint/typecheck/build plus real TMDB calls (not mocked) through both the raw API and a driven browser session: Inception + Arrival → Interstellar top result; Breaking Bad + Better Call Saul → Dexter/The Sopranos; same-id, invalid-id, and missing-param cases all return clean errors. See Known follow-ups for the one thing still worth tuning.
3. "Why this match" explanations on recommendation cards (shared keywords, cast/crew, themes).
4. Where-to-watch — TMDB's watch-providers endpoint, per-region.
5. Watchlist — localStorage-based, no accounts.
6. "Surprise me" — random pick respecting active filters.

## Known follow-ups

- OMDb's free-tier quota reset (2026-07-09) and ratings now populate correctly end-to-end - confirmed via a fresh blend request (Inception + Arrival, real `imdbRating`/`rottenTomatoesScore` values returned) and a detail-page visit. `getRatings`'s optimistic-marking dedup (see `src/lib/ratings.ts`) is unchanged by any of today's fixes; three concurrent requests for the same uncached title resolved consistently with no errors or races, but the exact "one OMDb call, not three" claim is still not directly instrumented (an attempt to log real call counts hit a shell-redirection issue with the backgrounded dev server, not a code problem) - low priority now that the broader "does this even work against the real API" question is answered, but worth a proper instrumented check if OMDb quota exhaustion becomes a recurring problem again.
- Verify mood search against the real Anthropic API once `ANTHROPIC_API_KEY` is added to `.env.local`: confirm a real query (e.g. "slow melancholic sci-fi") returns sensible genres/keywords, the "Interpreted as: …" caption renders, and submitting mood search clears the quick-search/genre/sort state (and vice versa) in `MediaExplorer`. Everything up to the live LLM call itself was verified (see build plan item 1); only the actual interpretation quality and the client-side mutual-exclusion UI are unverified.
- Vibe blending's score weights (genre 1/2, keyword 2/4, recommendation 2/6 - see `src/lib/vibe-blend.ts`) are a reasoned starting point, not tuned against real usage. Revisit once there's a sense of whether results skew too genre-heavy, too obscure, or too `/recommendations`-dominated. The OMDb burst this used to cause on every blend (enriching the full ~19-candidate pool) is fixed - ratings enrichment is now capped to the top 10 candidates *after* scoring/ranking (`MAX_ENRICHED_BLEND_RESULTS` in both `vibe-blend` routes), and the movie detail page's own rating now goes through `ratings.ts`'s shared cache (`getMovieRatings`) instead of calling OMDb directly, so a title already looked up via a grid/mood-search/blend costs nothing extra there. `blendTitles` still fires one TMDB keyword call per candidate (~20 per blend, parallelized, best-effort) - that's TMDB, not OMDb, and TMDB isn't the rate-limited API here, so it's left as-is.
