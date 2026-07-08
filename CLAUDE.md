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
- **Auth tokens are read via `process.env` only**, never hardcoded — e.g. `TMDB_API_TOKEN` (TMDB v4 bearer token) in `.env.local`, which is git-ignored (`.env*` in `.gitignore`).
- Route handlers translate client errors (missing/invalid params) to `400`, and propagate the upstream API's status code on failure rather than collapsing everything to `500`.
- Styling is Tailwind v4 via `@tailwindcss/postcss` (see `postcss.config.mjs`, `src/app/globals.css`); no component library is in use yet.

## Build plan

Rough order of remaining work for this app (Kindred):

1. ~~Server-side TMDB client + API routes~~ — done (`src/lib/tmdb.ts`, `src/app/api/movies/search`, `src/app/api/movies/[id]`). Verified against the live TMDB API; env-var handling checked clean (no raw token anywhere outside `.env.local`).
2. Movies/Series toggle + shared UI shell (layout/nav common to both modes).
3. Search feature + recommendations grid.
4. Browse mode: genre checkboxes + sort controls.
5. IMDb/RT score filtering via OMDb (new server-side client following the `tmdb.ts` pattern, plus a way to cross-reference TMDB results with OMDb ratings).
6. TMDB attribution notice in the footer (required by TMDB's terms of use).

## Known follow-ups

- Verify OMDb-call dedup once the free-tier quota resets: `src/lib/ratings.ts`'s `getRatings` marks a cache entry fresh optimistically before its fetch settles, so concurrent lookups for the same title should reuse the one in-flight fetch rather than each firing their own OMDb request. This was verified against a standalone re-implementation of the caching logic (see the 2026-07-08 ratings-cache-TTL change), not against the real API - OMDb's key was over its daily limit ("Request limit reached!") at the time. To check: load a page that triggers several simultaneous lookups for the same title (e.g. a popular grid where the same movie appears in both the main grid and a "More like this" row) and confirm only one real OMDb call fires, not several.
