import { getMovieKeywords, getTVKeywords, type TMDBKeyword } from "@/lib/tmdb";

type MediaType = "movie" | "tv";

// Same shape as ratings.ts's cache: keywords change rarely, so a shared,
// TTL'd, in-memory cache means "why this match" explanations (and blend's
// per-candidate scoring) share one lookup per title across mood
// search/blend/detail-page recommendations, instead of each context
// re-fetching the same title's keywords from TMDB independently. No disk
// persistence here (unlike ratings.ts) - TMDB isn't the rate-limited API in
// this app, so surviving a dev-server restart isn't worth the complexity.
const KEYWORDS_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedKeywords {
  keywords: TMDBKeyword[];
  fetchedAt: number;
}

const keywordsCache = new Map<string, Promise<TMDBKeyword[]>>();
const resolvedKeywords: Record<string, CachedKeywords> = {};

function isStale(key: string): boolean {
  const entry = resolvedKeywords[key];
  return !entry || Date.now() - entry.fetchedAt >= KEYWORDS_TTL_MS;
}

async function fetchKeywords(mediaType: MediaType, id: number): Promise<TMDBKeyword[]> {
  if (mediaType === "movie") {
    const { keywords } = await getMovieKeywords(id);
    return keywords;
  }
  const { results } = await getTVKeywords(id);
  return results;
}

function getCachedKeywords(mediaType: MediaType, id: number): Promise<TMDBKeyword[]> {
  const key = `${mediaType}:${id}`;
  const cached = keywordsCache.get(key);
  if (cached && !isStale(key)) {
    return cached;
  }

  // Mark fresh optimistically before the fetch settles, same as
  // ratings.ts's getRatings - a concurrent lookup for the same title reuses
  // this in-flight promise instead of racing a duplicate TMDB request.
  resolvedKeywords[key] = {
    keywords: resolvedKeywords[key]?.keywords ?? [],
    fetchedAt: Date.now(),
  };

  const fetched = fetchKeywords(mediaType, id)
    .then((keywords) => {
      resolvedKeywords[key] = { keywords, fetchedAt: Date.now() };
      return keywords;
    })
    .catch((error: unknown) => {
      keywordsCache.delete(key);
      delete resolvedKeywords[key];
      console.error(`Keywords fetch failed for ${key}, degrading to no keywords:`, error);
      return [];
    });
  keywordsCache.set(key, fetched);
  return fetched;
}

export function getMovieKeywordList(id: number): Promise<TMDBKeyword[]> {
  return getCachedKeywords("movie", id);
}

export function getTVKeywordList(id: number): Promise<TMDBKeyword[]> {
  return getCachedKeywords("tv", id);
}
