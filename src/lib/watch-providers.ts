import {
  getWatchProviders as fetchWatchProviders,
  type TMDBWatchProvidersRegion,
} from "@/lib/tmdb";

type MediaType = "movie" | "tv";

// No region concept exists anywhere else in this app (no geo-IP, no user
// setting) - hardcoded to "US" for now. See CLAUDE.md Known follow-ups.
const REGION = "US";

// Same shape as keywords.ts's cache: TMDB isn't the rate-limited API here, so
// this is in-memory-only (no disk persistence, unlike ratings.ts) and just
// avoids re-fetching the same title's providers repeatedly within the
// window. Availability changes slowly enough that a day-old answer is fine.
const WATCH_PROVIDERS_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedWatchProviders {
  region: TMDBWatchProvidersRegion | null;
  fetchedAt: number;
}

const watchProvidersCache = new Map<string, Promise<TMDBWatchProvidersRegion | null>>();
const resolvedWatchProviders: Record<string, CachedWatchProviders> = {};

function isStale(key: string): boolean {
  const entry = resolvedWatchProviders[key];
  return !entry || Date.now() - entry.fetchedAt >= WATCH_PROVIDERS_TTL_MS;
}

async function fetchRegionProviders(
  mediaType: MediaType,
  id: number
): Promise<TMDBWatchProvidersRegion | null> {
  const { results } = await fetchWatchProviders(mediaType, id);
  return results[REGION] ?? null;
}

function getCachedWatchProviders(
  mediaType: MediaType,
  id: number
): Promise<TMDBWatchProvidersRegion | null> {
  const key = `${mediaType}:${id}`;
  const cached = watchProvidersCache.get(key);
  if (cached && !isStale(key)) {
    return cached;
  }

  // Mark fresh optimistically before the fetch settles, same as
  // ratings.ts/keywords.ts - a concurrent lookup for the same title reuses
  // this in-flight promise instead of racing a duplicate TMDB request.
  resolvedWatchProviders[key] = {
    region: resolvedWatchProviders[key]?.region ?? null,
    fetchedAt: Date.now(),
  };

  const fetched = fetchRegionProviders(mediaType, id)
    .then((region) => {
      resolvedWatchProviders[key] = { region, fetchedAt: Date.now() };
      return region;
    })
    .catch((error: unknown) => {
      watchProvidersCache.delete(key);
      delete resolvedWatchProviders[key];
      console.error(`Watch providers fetch failed for ${key}, degrading to none:`, error);
      return null;
    });
  watchProvidersCache.set(key, fetched);
  return fetched;
}

export function getMovieWatchProviders(id: number): Promise<TMDBWatchProvidersRegion | null> {
  return getCachedWatchProviders("movie", id);
}

export function getTVWatchProviders(id: number): Promise<TMDBWatchProvidersRegion | null> {
  return getCachedWatchProviders("tv", id);
}
