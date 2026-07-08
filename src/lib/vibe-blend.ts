import {
  discoverMovies,
  discoverTV,
  getMovieDetails,
  getTVDetails,
  getMovieKeywords,
  getTVKeywords,
  getMovieRecommendations,
  getTVRecommendations,
  type TMDBMovie,
} from "@/lib/tmdb";

export class VibeBlendError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "VibeBlendError";
  }
}

// A genre/keyword/recommendation-list hit that lands on BOTH seed titles is
// worth more than one that only connects to a single title - that's the
// literal "between two titles" signal this feature is built around.
// Keywords outweigh genres because genres are coarse (~19 possible values)
// while keywords are specific, so a shared keyword is stronger evidence of a
// shared vibe than a shared genre.
const GENRE_POINTS_ONE = 1;
const GENRE_POINTS_BOTH = 2;
const KEYWORD_POINTS_ONE = 2;
const KEYWORD_POINTS_BOTH = 4;
const RECOMMENDATION_POINTS_ONE = 2;
const RECOMMENDATION_POINTS_BOTH = 6;

export type MediaType = "movie" | "tv";

export interface BlendResult {
  results: TMDBMovie[];
  titleA: { id: number; title: string };
  titleB: { id: number; title: string };
}

interface SeedData {
  id: number;
  title: string;
  genreIds: Set<number>;
  keywordIds: Set<number>;
  recommendationIds: Set<number>;
}

async function fetchSeed(id: number, mediaType: MediaType): Promise<SeedData> {
  if (mediaType === "movie") {
    const [details, keywords, recommendations] = await Promise.all([
      getMovieDetails(id),
      getMovieKeywords(id),
      getMovieRecommendations(id),
    ]);
    return {
      id: details.id,
      title: details.title,
      genreIds: new Set(details.genres.map((genre) => genre.id)),
      keywordIds: new Set(keywords.keywords.map((keyword) => keyword.id)),
      recommendationIds: new Set(recommendations.results.map((item) => item.id)),
    };
  }

  const [details, keywords, recommendations] = await Promise.all([
    getTVDetails(id),
    getTVKeywords(id),
    getTVRecommendations(id),
  ]);
  return {
    id: details.id,
    title: details.title,
    genreIds: new Set(details.genres.map((genre) => genre.id)),
    keywordIds: new Set(keywords.results.map((keyword) => keyword.id)),
    recommendationIds: new Set(recommendations.results.map((item) => item.id)),
  };
}

async function fetchCandidateKeywordIds(
  id: number,
  mediaType: MediaType
): Promise<Set<number>> {
  try {
    if (mediaType === "movie") {
      const { keywords } = await getMovieKeywords(id);
      return new Set(keywords.map((keyword) => keyword.id));
    }
    const { results } = await getTVKeywords(id);
    return new Set(results.map((keyword) => keyword.id));
  } catch {
    // Best-effort: a failed lookup just scores that candidate on
    // genres/recommendations only, same tolerance as mood search's
    // reference-title resolution.
    return new Set();
  }
}

function scoreCandidate(
  candidate: TMDBMovie,
  candidateKeywordIds: Set<number>,
  seedA: SeedData,
  seedB: SeedData
): number {
  let score = 0;

  for (const genreId of candidate.genre_ids) {
    const inA = seedA.genreIds.has(genreId);
    const inB = seedB.genreIds.has(genreId);
    if (inA && inB) score += GENRE_POINTS_BOTH;
    else if (inA || inB) score += GENRE_POINTS_ONE;
  }

  for (const keywordId of candidateKeywordIds) {
    const inA = seedA.keywordIds.has(keywordId);
    const inB = seedB.keywordIds.has(keywordId);
    if (inA && inB) score += KEYWORD_POINTS_BOTH;
    else if (inA || inB) score += KEYWORD_POINTS_ONE;
  }

  const inRecA = seedA.recommendationIds.has(candidate.id);
  const inRecB = seedB.recommendationIds.has(candidate.id);
  if (inRecA && inRecB) score += RECOMMENDATION_POINTS_BOTH;
  else if (inRecA || inRecB) score += RECOMMENDATION_POINTS_ONE;

  return score;
}

export async function blendTitles(
  idA: number,
  idB: number,
  mediaType: MediaType
): Promise<BlendResult> {
  if (idA === idB) {
    throw new VibeBlendError("Pick two different titles to blend", 400);
  }

  const [seedA, seedB] = await Promise.all([
    fetchSeed(idA, mediaType),
    fetchSeed(idB, mediaType),
  ]);

  const genreIds = [...new Set([...seedA.genreIds, ...seedB.genreIds])];
  const keywordIds = [...new Set([...seedA.keywordIds, ...seedB.keywordIds])];

  const discover =
    mediaType === "movie"
      ? await discoverMovies({ genreIds, keywordIds, sortBy: "popularity.desc", page: 1 })
      : await discoverTV({ genreIds, keywordIds, sortBy: "popularity.desc", page: 1 });

  const candidates = discover.results.filter(
    (item) => item.id !== idA && item.id !== idB
  );

  const candidateKeywordSets = await Promise.all(
    candidates.map((candidate) => fetchCandidateKeywordIds(candidate.id, mediaType))
  );

  const scored = candidates.map((candidate, index) => ({
    candidate,
    score: scoreCandidate(candidate, candidateKeywordSets[index], seedA, seedB),
  }));

  // Array.prototype.sort is stable, so equal scores keep the discover
  // response's popularity.desc order as an implicit tie-break.
  scored.sort((a, b) => b.score - a.score);

  return {
    results: scored.map((entry) => entry.candidate),
    titleA: { id: seedA.id, title: seedA.title },
    titleB: { id: seedB.id, title: seedB.title },
  };
}
