import {
  getWatchProviders as fetchWatchProviders,
  type TMDBWatchProvidersRegion,
} from "@/lib/tmdb";

type MediaType = "movie" | "tv";

// Only the regions the UI actually offers a dropdown for - no geo-IP, no
// Accept-Language sniffing, just an explicit user choice persisted in
// localStorage (src/lib/watch-region.ts). Add more here (and to the
// dropdown, which reads this same list) if that ever expands.
export const WATCH_REGIONS = [
  { code: "US", label: "United States" },
  { code: "BR", label: "Brazil" },
] as const;

export type WatchRegion = (typeof WATCH_REGIONS)[number]["code"];

export const DEFAULT_WATCH_REGION: WatchRegion = "US";

export function isWatchRegion(value: string): value is WatchRegion {
  return WATCH_REGIONS.some((region) => region.code === value);
}

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

// TMDB's watch-providers endpoint returns every region it has data for in
// one response (see tmdb.ts's TMDBWatchProvidersResponse) - a single fetch
// already carries both US and BR. We still cache and fetch per-region key
// below rather than caching the whole multi-region payload once: simpler,
// matches ratings.ts/keywords.ts's one-value-per-key shape, and TMDB isn't
// rate-limited here so the extra call when a title's checked in both
// regions costs nothing that matters.
async function fetchRegionProviders(
  mediaType: MediaType,
  id: number,
  region: WatchRegion
): Promise<TMDBWatchProvidersRegion | null> {
  const { results } = await fetchWatchProviders(mediaType, id);
  return results[region] ?? null;
}

function getCachedWatchProviders(
  mediaType: MediaType,
  id: number,
  region: WatchRegion
): Promise<TMDBWatchProvidersRegion | null> {
  // Keyed by region too, so switching the dropdown doesn't overwrite the
  // other region's cached entry - US and BR results for the same title are
  // independent cache slots.
  const key = `${mediaType}:${id}:${region}`;
  const cached = watchProvidersCache.get(key);
  if (cached && !isStale(key)) {
    return cached;
  }

  // Mark fresh optimistically before the fetch settles, same as
  // ratings.ts/keywords.ts - a concurrent lookup for the same title+region
  // reuses this in-flight promise instead of racing a duplicate TMDB request.
  resolvedWatchProviders[key] = {
    region: resolvedWatchProviders[key]?.region ?? null,
    fetchedAt: Date.now(),
  };

  const fetched = fetchRegionProviders(mediaType, id, region)
    .then((result) => {
      resolvedWatchProviders[key] = { region: result, fetchedAt: Date.now() };
      return result;
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

export function getMovieWatchProviders(
  id: number,
  region: WatchRegion
): Promise<TMDBWatchProvidersRegion | null> {
  return getCachedWatchProviders("movie", id, region);
}

export function getTVWatchProviders(
  id: number,
  region: WatchRegion
): Promise<TMDBWatchProvidersRegion | null> {
  return getCachedWatchProviders("tv", id, region);
}
