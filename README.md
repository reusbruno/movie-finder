# Kindred

Kindred is a movie and TV discovery app built on TMDB. Describe a mood and get a shortlist that actually matches it, blend two titles to see what sits between them, get a plain-language "why this matched" on any recommendation, check where a title is streaming (with a US/Brazil region switch), keep a watchlist, or hit "Surprise me" and let it pick.

## Tech stack

Next.js (App Router) on TMDB for catalog data, OMDb (with an MDBList fallback) for IMDb/Rotten Tomatoes scores, and Claude Haiku for mood search and match explanations.

## Setup

```bash
npm install
```

Create `.env.local` in the project root:

```
TMDB_API_TOKEN=
OMDB_API_KEY=
MDBLIST_API_KEY=
ANTHROPIC_API_KEY=
```

- **`TMDB_API_TOKEN`** — required; the whole app is built on TMDB's catalog. A v4 read access token from your [TMDB account API settings](https://www.themoviedb.org/settings/api) (free, instant).
- **`OMDB_API_KEY`** — an [OMDb API key](https://www.omdbapi.com/apikey.aspx) (free tier). Powers IMDb ratings and most Rotten Tomatoes scores. Optional: without it, ratings just show as "—" everywhere instead of erroring.
- **`MDBLIST_API_KEY`** — an [MDBList API key](https://mdblist.com/api/) (free account). Best-effort fallback for Rotten Tomatoes scores OMDb doesn't have, which is common for TV. Optional: without it, that fallback silently doesn't run.
- **`ANTHROPIC_API_KEY`** — an [Anthropic API key](https://console.anthropic.com/). Powers mood search and the "Explain more" button. Optional, but the difference is visible: without it, the mood search box renders disabled ("Mood search — coming soon") and "Explain more" doesn't appear — everything else works normally.

Then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

- `npm run dev` — dev server (Turbopack)
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint
