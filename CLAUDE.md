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

## Design notes

- **Reference is Letterboxd/Apple TV+ quiet chrome.** Default to restraint - most controls are small, outlined, and muted (`text-foreground/60`-ish); loudness is spent deliberately, not by default.
- **Gold (`--accent`, `bg-accent`/`text-accent-foreground`) is reserved for exactly one primary action per screen state** - not tied to a specific button. On the browse page's hero (`src/components/hero-search.tsx`), that's Find by default and Blend once swapped into blend view; they never coexist, so "one gold button on screen" holds automatically as the state changes. Small passive count badges (e.g. `FilterPanel`'s active-filter count) are a different visual category - status, not a competing call-to-action - and can still use accent color.
- **Bebas Neue (`font-display`) is reserved for page titles only** - the browse page's hero heading ("What are you in the mood for?"), not results headers, section labels, or any other content text. Results headers (mood/blend/search/filtered-browse) are content labels, not titles: normal weight, quiet color, `{context} · N results` shape - see `resultsHeaderContext`/`heading` in `media-explorer.tsx`.
- Explicit 5-size type scale in `globals.css` (`xs 12 / sm 14 / base 16 / lg 20 / xl 32`) - every text size in the app should map to one of these, no arbitrary `text-[Npx]`.

## Deployment notes

- **Target is Vercel, serverless (Hobby tier, friends-scale testing).** Each invocation may land on a fresh function instance, so the in-memory caches (`ratings.ts`, `keywords.ts`, `watch-providers.ts` - all the same TTL'd-`Map` shape) don't persist across requests the way they do in a long-running `next dev`/`next start` process.
- **Known and accepted, not a bug**: a cache miss just re-fetches from the upstream API instead of hitting a warm in-memory entry. OMDb's free-tier rate limit is the resource most likely to feel this first (it's already the most rate-limited API this app calls); `ratings.ts` already degrades any fetch failure to "no ratings available" rather than erroring, so a quota bump shows up as missing scores, not a broken page.
- Revisit with real persistent caching (e.g. Vercel KV) only if this actually bites in practice - not preemptively.
- **Same in-memory-on-serverless caveat applies to rate limiting** (`src/lib/rate-limit.ts`, a fixed-window per-IP counter guarding the three Anthropic-backed routes - both mood-search routes and `explain-match` - at 10 requests/minute/IP). No Redis/KV here either, same reasoning: a burst of requests can land on different warm function instances, each with an independent counter, so a determined abuser spread across enough cold starts could exceed the nominal limit. It still blunts the common case (a script hammering one endpoint in a tight loop) at zero cost, and it's a second layer, not the real backstop - the Anthropic spend cap is. Move to real distributed rate limiting only if this one is found to not be enough in practice.

## Build history and known follow-ups

See the `build-log` skill (`.claude/skills/build-log/SKILL.md`) for the full Phase 1/Phase 2 build plan (all shipped) and the current list of known follow-ups. Not loaded by default - ask about project status/roadmap/what's-left/known-issues to pull it in, or read the file directly.
