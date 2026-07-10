import Anthropic from "@anthropic-ai/sdk";
import {
  searchKeywords,
  searchMovies,
  searchTV,
  getMovieKeywords,
  getTVKeywords,
  type TMDBGenre,
  type TMDBYearRange,
} from "@/lib/tmdb";
import {
  getAnthropicClient,
  isAnthropicAvailable,
  AnthropicUnavailableError,
} from "@/lib/anthropic-client";

export class MoodSearchError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "MoodSearchError";
  }
}

// Structured extraction of genres/keywords/sort from a short free-text query -
// not open-ended reasoning, so the fast/cheap tier is the right fit here.
const MOOD_SEARCH_MODEL = "claude-haiku-4-5";
// Genres are now AND'd together in the discover call (see discoverMovies's
// genreMatchMode) so a result has to actually match every one - capped low
// so an LLM response with several loosely-related genres doesn't intersect
// down to zero results.
const MAX_GENRES_FROM_QUERY = 2;
const MAX_KEYWORDS_FROM_QUERY = 5;
const MAX_REFERENCE_TITLES = 3;
const MAX_KEYWORDS_PER_REFERENCE_TITLE = 3;

export function isMoodSearchAvailable(): boolean {
  return isAnthropicAvailable();
}

function getClient(): Anthropic {
  try {
    return getAnthropicClient();
  } catch (error) {
    if (error instanceof AnthropicUnavailableError) {
      throw new MoodSearchError("Mood search is not configured", 503);
    }
    throw error;
  }
}

export interface MoodInterpretation {
  genres: string[];
  keywords: string[];
  referenceTitles: string[];
  sortBy: string;
  yearRange?: TMDBYearRange;
}

export async function interpretMoodQuery(
  query: string,
  options: { genreNames: string[]; sortOptions: readonly string[] }
): Promise<MoodInterpretation> {
  const anthropic = getClient();

  const schema = {
    type: "object" as const,
    properties: {
      genres: {
        type: "array",
        items: { type: "string", enum: options.genreNames },
        description:
          "Genres from the allowed list that match the mood. Empty array if none clearly fit. " +
          'Be careful with "Family" - on TMDB it means content aimed at children (animated ' +
          "franchises, kids' movies), not just \"warm\" or \"wholesome\" in a general adult " +
          'sense. Only include it when the query explicitly signals kids/family viewing (e.g. ' +
          '"movie night with the kids", "something Pixar-like"), not for adult-oriented moods ' +
          'like "cozy" or "feel-good" on their own - those are Comedy/Drama/etc. without Family.',
      },
      keywords: {
        type: "array",
        items: { type: "string" },
        description:
          "Up to 5 short thematic or tonal keywords evoked by the query (e.g. 'slow burn', 'melancholic', 'time loop').",
      },
      referenceTitles: {
        type: "array",
        items: { type: "string" },
        description:
          "Up to 3 specific movie or TV titles the query explicitly names or clearly implies (e.g. 'like Arrival'). Empty array if none.",
      },
      sortBy: {
        type: "string",
        enum: options.sortOptions,
        description:
          "Best sort order for this mood - a rating-based sort for 'best'/'acclaimed'-style requests, otherwise popularity.",
      },
      yearRange: {
        type: "object",
        properties: {
          gte: {
            type: "integer",
            description:
              "Earliest release year, if implied - including fuzzy temporal language, not " +
              'just literal years/decades. Anchor "modern"/"contemporary"/"recent" to roughly ' +
              "the last 10-15 years using today's date above (e.g. today 2026 -> gte ~2011-2016); " +
              '"80s"/"90s"-style decade mentions -> that decade\'s start; explicit years/ranges -> ' +
              "exact. Omit if the query has no temporal signal at all.",
          },
          lte: {
            type: "integer",
            description:
              'Latest release year, if implied. "classic"/"old"/a named decade -> that decade\'s ' +
              "end (leave gte unset for open-ended \"classic\"); explicit years/ranges -> exact. " +
              "Omit if the query has no temporal signal at all.",
          },
        },
        additionalProperties: false,
      },
    },
    required: ["genres", "keywords", "referenceTitles", "sortBy"],
    additionalProperties: false,
  };

  // Real anchor for fuzzy temporal language ("modern", "recent", "classic") -
  // without it the model has no idea what year range "modern" should mean
  // and tends to treat it as a vibe keyword instead (see yearRange below).
  const today = new Date().toISOString().slice(0, 10);

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: MOOD_SEARCH_MODEL,
      max_tokens: 1024,
      system:
        `Today's date is ${today}. You translate a free-text mood or vibe description into ` +
        "structured filters for a movie/TV discovery search. Be conservative: only include " +
        "genres, keywords, or titles you're confident are actually implied by the query.",
      messages: [{ role: "user", content: query }],
      output_config: { format: { type: "json_schema", schema } },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new MoodSearchError("Mood search is not configured correctly", 503);
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new MoodSearchError(
        "Mood search is temporarily rate-limited - try again shortly",
        429
      );
    }
    if (error instanceof Anthropic.APIError) {
      throw new MoodSearchError("Mood search is temporarily unavailable", 502);
    }
    throw error;
  }

  if (response.stop_reason === "refusal") {
    throw new MoodSearchError("Could not interpret that mood query", 422);
  }

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  if (!textBlock) {
    throw new MoodSearchError("Could not interpret that mood query", 502);
  }

  try {
    return JSON.parse(textBlock.text) as MoodInterpretation;
  } catch {
    throw new MoodSearchError("Could not interpret that mood query", 502);
  }
}

export interface ResolvedMoodFilters {
  genreIds: number[];
  keywordIds: number[];
  sortBy: string;
  yearRange?: TMDBYearRange;
  // Name maps for the resolved ids above - used to build per-candidate "why
  // this match" explanations (see match-explanation.ts), restricted to just
  // what the query actually resolved to, not the full TMDB catalog.
  genreNames: Map<number, string>;
  keywordNames: Map<number, string>;
  interpretation: {
    genreNames: string[];
    keywordTerms: string[];
    sortBy: string;
    yearRange?: TMDBYearRange;
  };
}

export async function resolveMoodFilters(
  interpretation: MoodInterpretation,
  mediaType: "movie" | "tv",
  genres: TMDBGenre[]
): Promise<ResolvedMoodFilters> {
  const genreNameToId = new Map(genres.map((genre) => [genre.name, genre.id]));
  const genreIds = interpretation.genres
    .slice(0, MAX_GENRES_FROM_QUERY)
    .map((name) => genreNameToId.get(name))
    .filter((id): id is number => id !== undefined);
  const genreNames = new Map(genreIds.map((id) => [id, genres.find((g) => g.id === id)!.name]));

  const keywordTerms = new Set<string>();
  const keywordIds = new Set<number>();
  const keywordNames = new Map<number, string>();

  async function addKeywordTerm(term: string) {
    if (keywordTerms.has(term)) return;
    try {
      const { results } = await searchKeywords(term);
      if (results[0]) {
        keywordTerms.add(term);
        keywordIds.add(results[0].id);
        keywordNames.set(results[0].id, results[0].name);
      }
    } catch {
      // Best-effort: a failed keyword lookup just drops that one term.
    }
  }

  await Promise.all(
    interpretation.keywords.slice(0, MAX_KEYWORDS_FROM_QUERY).map(addKeywordTerm)
  );

  await Promise.all(
    interpretation.referenceTitles.slice(0, MAX_REFERENCE_TITLES).map(async (title) => {
      try {
        const { results } =
          mediaType === "movie" ? await searchMovies(title) : await searchTV(title);
        const match = results[0];
        if (!match) return;
        const rawKeywords =
          mediaType === "movie"
            ? (await getMovieKeywords(match.id)).keywords
            : (await getTVKeywords(match.id)).results;
        for (const keyword of rawKeywords.slice(0, MAX_KEYWORDS_PER_REFERENCE_TITLE)) {
          if (!keywordTerms.has(keyword.name)) {
            keywordTerms.add(keyword.name);
            keywordIds.add(keyword.id);
            keywordNames.set(keyword.id, keyword.name);
          }
        }
      } catch {
        // Best-effort: a failed reference-title lookup just contributes nothing.
      }
    })
  );

  return {
    genreIds,
    keywordIds: [...keywordIds],
    sortBy: interpretation.sortBy,
    yearRange: interpretation.yearRange,
    genreNames,
    keywordNames,
    interpretation: {
      // Derived from the capped, resolved genreIds (not the raw LLM list)
      // so the "Interpreted as: …" caption never shows a genre that isn't
      // actually part of the AND filter below.
      genreNames: [...genreNames.values()],
      keywordTerms: [...keywordTerms],
      sortBy: interpretation.sortBy,
      yearRange: interpretation.yearRange,
    },
  };
}

// Client-shareable shape of a resolved mood interpretation, round-tripped
// so a later filter change can re-run discovery without re-invoking the
// LLM (see the mood-search route's cachedInterpretation branch - no
// query text, no rate limit, no Anthropic spend, just a fresh TMDB
// discover call with updated filters). Genre/keyword names travel
// alongside their ids so match-explanation can still build "why this
// match" text without a second TMDB round-trip to look names back up.
export interface ResolvedMoodParams {
  genres: { id: number; name: string }[];
  keywords: { id: number; name: string }[];
  sortBy: string;
  yearRange?: TMDBYearRange;
}

export function toResolvedMoodParams(resolved: ResolvedMoodFilters): ResolvedMoodParams {
  return {
    genres: [...resolved.genreNames.entries()].map(([id, name]) => ({ id, name })),
    keywords: [...resolved.keywordNames.entries()].map(([id, name]) => ({ id, name })),
    sortBy: resolved.sortBy,
    yearRange: resolved.yearRange,
  };
}

export function fromResolvedMoodParams(params: ResolvedMoodParams): {
  genreIds: number[];
  genreNames: Map<number, string>;
  keywordIds: number[];
  keywordNames: Map<number, string>;
  sortBy: string;
  yearRange?: TMDBYearRange;
} {
  return {
    genreIds: params.genres.map((g) => g.id),
    genreNames: new Map(params.genres.map((g) => [g.id, g.name])),
    keywordIds: params.keywords.map((k) => k.id),
    keywordNames: new Map(params.keywords.map((k) => [k.id, k.name])),
    sortBy: params.sortBy,
    yearRange: params.yearRange,
  };
}

// User-set filters win over whatever the LLM extracted - see CLAUDE.md's
// architecture note on why mood search stopped being mutually exclusive
// with filters (real user feedback: filtering felt broken combined with
// mood search). Keywords always pass through untouched regardless of
// overrides - there's no UI control for them, so there's never a real
// conflict to resolve. A genre override also switches genre matching from
// mood's AND (a hard, narrowing filter meant for LLM-extracted genres) to
// the browse page's own OR convention - selectedGenres is that exact same
// checkbox state, so once the user is explicitly picking genres, they get
// checkbox semantics, not mood's.
export interface MoodFilterOverrides {
  genreIds?: number[];
  sortBy?: string;
  watchProviderIds?: number[];
  watchRegion?: string;
}

export function applyMoodFilterOverrides(
  params: { genreIds: number[]; sortBy: string; yearRange?: TMDBYearRange },
  overrides: MoodFilterOverrides
): {
  genreIds: number[];
  genreMatchMode: "any" | "all";
  sortBy: string;
  yearRange?: TMDBYearRange;
} {
  const hasGenreOverride = Boolean(overrides.genreIds && overrides.genreIds.length > 0);
  return {
    genreIds: hasGenreOverride ? overrides.genreIds! : params.genreIds,
    genreMatchMode: hasGenreOverride ? "any" : "all",
    sortBy: overrides.sortBy ?? params.sortBy,
    yearRange: params.yearRange,
  };
}

// 5 was too lenient in practice: a query landing at *exactly* 5 (measured
// directly - "slow melancholic sci-fi"'s 5 mood keywords OR'd, AND'd with
// Science Fiction+Drama, gives exactly 5 against the live API) satisfied
// `>= MIN_MOOD_RESULTS` and never triggered the keyword-drop relaxation
// below, even though 5 is clearly too thin for a satisfying grid - and
// dropping keywords for that same query yields 291-1,687 results depending
// on vote-count threshold, so there's no real cost to relaxing more
// readily. 10 gives a comfortable amount of variety without being so low
// that a precise, well-populated keyword match gets discarded for no reason.
const MIN_MOOD_RESULTS = 10;

// Mood search's discover call can undershoot for two very different
// reasons, and they don't deserve equal blame:
//
// - TMDB's keyword tagging for abstract tone/vibe words ("cozy",
//   "wholesome", "feel-good") is sparse to the point of being nearly
//   unusable as a hard filter - measured directly against the live API,
//   individual mood keywords like these cover as few as 5-26 movies in
//   TMDB's *entire* catalog. Even OR'd across 5 terms, that's a tiny pool,
//   and AND-ing it with a genre collapses further still (Comedy alone:
//   ~12,700 movies; Comedy AND [any of 5 mood keywords]: ~5).
// - Two AND'd genres (see discoverMovies/discoverTV's genreMatchMode) can
//   also over-narrow - "Comedy" + "Family" skews toward kids' animation,
//   since TMDB's Family genre leans heavily children's - but genre tagging
//   itself is comprehensive on TMDB, unlike keyword tagging, so it's a much
//   smaller effect (Comedy AND Family, no keywords at all: ~1,746 movies).
//
// So the fallback relaxes keywords first, genre only as a last resort:
// keywords are dropped from the hard filter entirely (not OR'd looser -
// even OR'd, sparse tagging still starves the pool), then genre narrows to
// just the primary genre if it's still thin. Dropping keywords here isn't
// losing that signal outright - attachMatchExplanations still fetches each
// candidate's own keywords and surfaces a genuine overlap in "why this
// match" text; this only stops REQUIRING one for inclusion.
export async function discoverWithMoodFallback<T extends { results: unknown[] }>(
  discover: (genreIds: number[], keywordIds: number[]) => Promise<T>,
  genreIds: number[],
  keywordIds: number[]
): Promise<T & { appliedGenreIds: number[]; appliedKeywordIds: number[] }> {
  const attempts: { genreIds: number[]; keywordIds: number[] }[] = [
    { genreIds, keywordIds },
  ];
  if (keywordIds.length > 0) {
    attempts.push({ genreIds, keywordIds: [] });
  }
  if (genreIds.length > 1) {
    attempts.push({ genreIds: genreIds.slice(0, 1), keywordIds: [] });
  }

  let attempt = attempts[0];
  let result = await discover(attempt.genreIds, attempt.keywordIds);

  for (const next of attempts.slice(1)) {
    if (result.results.length >= MIN_MOOD_RESULTS) break;
    attempt = next;
    result = await discover(attempt.genreIds, attempt.keywordIds);
  }

  return { ...result, appliedGenreIds: attempt.genreIds, appliedKeywordIds: attempt.keywordIds };
}
