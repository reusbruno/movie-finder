import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  getMovieExternalIds,
  getTVExternalIds,
  type TMDBMovie,
} from "@/lib/tmdb";
import { getMovieRatingsByImdbId, type MovieRatings } from "@/lib/omdb";
import { getRottenTomatoesScore } from "@/lib/mdblist";

const EMPTY_RATINGS: MovieRatings = {
  imdbRating: null,
  rottenTomatoesScore: null,
};

type MediaType = "movie" | "tv";

interface CachedRatings {
  ratings: MovieRatings;
  fetchedAt: number;
}

// Ratings shift slowly (new votes trickle in, an RT score gets added later
// by OMDb/MDBList), but the raw fetches in omdb.ts/mdblist.ts already carry
// their own 300s revalidate window aimed at OMDb's rate-limited free tier -
// this cache sits in front of that and must not defeat it by never expiring.
// 24h matches the "practically static" cadence tmdb.ts uses for reference
// data (REVALIDATE.reference): fresh enough that a corrected rating shows up
// within a day, without re-spending OMDb quota on every popular title on
// every visit.
const RATINGS_TTL_MS = 24 * 60 * 60 * 1000;

// Persisted to disk (in addition to the in-process Map below) so ratings
// survive dev-server restarts. Every restart previously wiped the cache and
// re-triggered a full OMDb/MDBList/TMDB-external-ids fan-out for every movie
// touched again - the actual driver of OMDb quota burn during testing, not
// just a one-time cost. This is a flat, regenerable JSON snapshot - not the
// caching layer the build plan defers - so it's gitignored, not committed.
const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "ratings-cache.json");

function loadPersistedRatings(): Record<string, CachedRatings> {
  if (!existsSync(CACHE_FILE)) return {};
  try {
    const parsed = JSON.parse(readFileSync(CACHE_FILE, "utf-8")) as Record<
      string,
      Partial<CachedRatings>
    >;
    // Cache files written before the TTL was added lack `fetchedAt` - drop
    // those entries rather than crash; they just get re-fetched on first
    // use, same as any other cache miss.
    const result: Record<string, CachedRatings> = {};
    for (const [key, entry] of Object.entries(parsed)) {
      if (entry && typeof entry.fetchedAt === "number" && entry.ratings) {
        result[key] = entry as CachedRatings;
      }
    }
    return result;
  } catch (error) {
    console.error("Failed to read persisted ratings cache, starting empty:", error);
    return {};
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

// Debounced: enrichWithRatings resolves up to ~20 ratings in a single burst
// (Promise.allSettled over a recommendations grid), which would otherwise
// mean up to 20 synchronous disk writes per page load.
function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(CACHE_FILE, JSON.stringify(resolvedRatings));
    } catch (error) {
      console.error("Failed to persist ratings cache:", error);
    }
  }, 500);
}

// In-process memoization - avoids re-fetching OMDb for the same title
// repeatedly within the TTL window. Keyed by media type + id since movie and
// TV ids are separate TMDB id spaces.
const ratingsCache = new Map<string, Promise<MovieRatings>>();

// Plain-object mirror of resolved (non-error) entries in ratingsCache - this
// is what actually gets written to disk, since Promises themselves aren't
// serializable. Also the source of truth for each entry's fetchedAt, since
// checking staleness can't await the (possibly still in-flight) cached
// promise itself.
const resolvedRatings: Record<string, CachedRatings> = loadPersistedRatings();
for (const [key, entry] of Object.entries(resolvedRatings)) {
  ratingsCache.set(key, Promise.resolve(entry.ratings));
}

function isStale(key: string): boolean {
  const entry = resolvedRatings[key];
  return !entry || Date.now() - entry.fetchedAt >= RATINGS_TTL_MS;
}

async function fetchRatings(
  mediaType: MediaType,
  tmdbId: number
): Promise<MovieRatings> {
  const externalIds =
    mediaType === "movie"
      ? await getMovieExternalIds(tmdbId)
      : await getTVExternalIds(tmdbId);

  if (!externalIds.imdb_id) {
    return EMPTY_RATINGS;
  }

  const omdbRatings = await getMovieRatingsByImdbId(externalIds.imdb_id);

  if (omdbRatings.rottenTomatoesScore !== null) {
    return omdbRatings;
  }

  // OMDb has no RT score for this title (common for TV) - try MDBList as
  // a fallback. Best-effort only: any failure here (missing key, network
  // error, title not in MDBList either) just keeps OMDb's null result
  // rather than breaking the whole rating fetch.
  try {
    const fallbackScore = await getRottenTomatoesScore(
      externalIds.imdb_id,
      mediaType
    );
    if (fallbackScore !== null) {
      return { ...omdbRatings, rottenTomatoesScore: fallbackScore };
    }
  } catch {
    // swallow - fallback is advisory only
  }

  return omdbRatings;
}

function getRatings(mediaType: MediaType, tmdbId: number): Promise<MovieRatings> {
  const key = `${mediaType}:${tmdbId}`;
  const cached = ratingsCache.get(key);
  if (cached && !isStale(key)) {
    return cached;
  }

  // Mark fresh optimistically, before the fetch settles, so a concurrent
  // call for the same key (e.g. two requests enriching the same popular
  // title at once) reuses this in-flight promise instead of also seeing a
  // stale entry and racing a duplicate fetch.
  resolvedRatings[key] = {
    ratings: resolvedRatings[key]?.ratings ?? EMPTY_RATINGS,
    fetchedAt: Date.now(),
  };

  // Ratings are a nice-to-have enrichment, never the reason a page should
  // fail to render - any failure (rate limit, network error, whatever)
  // degrades to "no ratings available" for this title, same as the
  // existing null-handling for a missing RT score. The cache entry is
  // still cleared on failure so a transient error doesn't get stuck
  // forever; logged so a real, ongoing problem (e.g. a spent OMDb quota)
  // is actually visible instead of silently invisible everywhere.
  const fetched = fetchRatings(mediaType, tmdbId)
    .then((ratings) => {
      resolvedRatings[key] = { ratings, fetchedAt: Date.now() };
      schedulePersist();
      return ratings;
    })
    .catch((error: unknown) => {
      ratingsCache.delete(key);
      delete resolvedRatings[key];
      console.error(`Ratings fetch failed for ${key}, degrading to no ratings:`, error);
      return EMPTY_RATINGS;
    });
  ratingsCache.set(key, fetched);
  return fetched;
}

export function getMovieRatings(tmdbId: number): Promise<MovieRatings> {
  return getRatings("movie", tmdbId);
}

export function getTVRatings(tmdbId: number): Promise<MovieRatings> {
  return getRatings("tv", tmdbId);
}

export type MovieWithRatings = TMDBMovie & { ratings: MovieRatings };

async function enrichWithRatings(
  mediaType: MediaType,
  items: TMDBMovie[]
): Promise<MovieWithRatings[]> {
  const settled = await Promise.allSettled(
    items.map((item) => getRatings(mediaType, item.id))
  );

  return items.map((item, index) => {
    const result = settled[index];
    return {
      ...item,
      ratings: result.status === "fulfilled" ? result.value : EMPTY_RATINGS,
    };
  });
}

export function enrichMoviesWithRatings(
  movies: TMDBMovie[]
): Promise<MovieWithRatings[]> {
  return enrichWithRatings("movie", movies);
}

export function enrichTVWithRatings(
  shows: TMDBMovie[]
): Promise<MovieWithRatings[]> {
  return enrichWithRatings("tv", shows);
}

export function passesRatingFilters(
  ratings: MovieRatings,
  minImdb: number | null,
  minRt: number | null
): boolean {
  if (
    minImdb !== null &&
    ratings.imdbRating !== null &&
    ratings.imdbRating < minImdb
  ) {
    return false;
  }
  if (
    minRt !== null &&
    ratings.rottenTomatoesScore !== null &&
    ratings.rottenTomatoesScore < minRt
  ) {
    return false;
  }
  return true;
}
