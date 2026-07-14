import {
  discoverMovies,
  discoverTV,
  getMovieDetails,
  getTVDetails,
  getMovieRecommendations,
  getTVRecommendations,
  type TMDBMovie,
} from "@/lib/tmdb";
import { getMovieKeywordList, getTVKeywordList } from "@/lib/keywords";
import {
  computeBlendSignals,
  blendSignalScore,
  explainBlendMatch,
} from "@/lib/match-explanation";

export class VibeBlendError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "VibeBlendError";
  }
}

// Recommendation-list overlap is blend-specific (mood search and detail-page
// recommendations don't have a second title to cross-reference against), so
// these two weights stay local rather than living in match-explanation.ts
// alongside the genre/keyword weights every context shares.
const RECOMMENDATION_POINTS_ONE = 2;
const RECOMMENDATION_POINTS_BOTH = 6;

export type MediaType = "movie" | "tv";

export interface BlendResult {
  results: (TMDBMovie & { matchExplanation: string | null })[];
  titleA: { id: number; title: string };
  titleB: { id: number; title: string };
}

interface SeedData {
  id: number;
  title: string;
  genreNames: Map<number, string>;
  keywordNames: Map<number, string>;
  recommendationIds: Set<number>;
}

async function fetchSeed(id: number, mediaType: MediaType, language: string): Promise<SeedData> {
  const getKeywords = mediaType === "movie" ? getMovieKeywordList : getTVKeywordList;

  const [details, keywords, recommendations] =
    mediaType === "movie"
      ? await Promise.all([getMovieDetails(id, language), getKeywords(id), getMovieRecommendations(id, 1, language)])
      : await Promise.all([getTVDetails(id, language), getKeywords(id), getTVRecommendations(id, 1, language)]);

  return {
    id: details.id,
    title: details.title,
    genreNames: new Map(details.genres.map((genre) => [genre.id, genre.name])),
    keywordNames: new Map(keywords.map((keyword) => [keyword.id, keyword.name])),
    recommendationIds: new Set(recommendations.results.map((item) => item.id)),
  };
}

async function fetchCandidateKeywordIds(
  id: number,
  mediaType: MediaType
): Promise<Set<number>> {
  try {
    const keywords =
      mediaType === "movie" ? await getMovieKeywordList(id) : await getTVKeywordList(id);
    return new Set(keywords.map((keyword) => keyword.id));
  } catch {
    // Best-effort: a failed lookup just scores/explains that candidate on
    // genres/recommendations only, same tolerance as mood search's
    // reference-title resolution.
    return new Set();
  }
}

export async function blendTitles(
  idA: number,
  idB: number,
  mediaType: MediaType,
  language = "en-US"
): Promise<BlendResult> {
  if (idA === idB) {
    throw new VibeBlendError("Pick two different titles to blend", 400);
  }

  const [seedA, seedB] = await Promise.all([
    fetchSeed(idA, mediaType, language),
    fetchSeed(idB, mediaType, language),
  ]);

  const genreIds = [...new Set([...seedA.genreNames.keys(), ...seedB.genreNames.keys()])];
  const keywordIds = [
    ...new Set([...seedA.keywordNames.keys(), ...seedB.keywordNames.keys()]),
  ];

  const discover =
    mediaType === "movie"
      ? await discoverMovies({ genreIds, keywordIds, sortBy: "popularity.desc", page: 1, language })
      : await discoverTV({ genreIds, keywordIds, sortBy: "popularity.desc", page: 1, language });

  const candidates = discover.results.filter(
    (item) => item.id !== idA && item.id !== idB
  );

  const candidateKeywordSets = await Promise.all(
    candidates.map((candidate) => fetchCandidateKeywordIds(candidate.id, mediaType))
  );

  const scored = candidates.map((candidate, index) => {
    const signals = computeBlendSignals(
      candidate.genre_ids,
      candidateKeywordSets[index],
      seedA.genreNames,
      seedB.genreNames,
      seedA.keywordNames,
      seedB.keywordNames
    );

    const inRecA = seedA.recommendationIds.has(candidate.id);
    const inRecB = seedB.recommendationIds.has(candidate.id);
    const recommendationScore =
      inRecA && inRecB
        ? RECOMMENDATION_POINTS_BOTH
        : inRecA || inRecB
          ? RECOMMENDATION_POINTS_ONE
          : 0;

    return {
      candidate,
      score: blendSignalScore(signals) + recommendationScore,
      matchExplanation: explainBlendMatch(signals, seedA.title, seedB.title, inRecA, inRecB),
    };
  });

  // Array.prototype.sort is stable, so equal scores keep the discover
  // response's popularity.desc order as an implicit tie-break.
  scored.sort((a, b) => b.score - a.score);

  return {
    results: scored.map((entry) => ({ ...entry.candidate, matchExplanation: entry.matchExplanation })),
    titleA: { id: seedA.id, title: seedA.title },
    titleB: { id: seedB.id, title: seedB.title },
  };
}
