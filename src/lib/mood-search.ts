import Anthropic from "@anthropic-ai/sdk";
import {
  searchKeywords,
  searchMovies,
  searchTV,
  getMovieKeywords,
  getTVKeywords,
  type TMDBGenre,
  type TMDBYearRange,
  type TMDBMovie,
  type TMDBSearchResponse,
} from "@/lib/tmdb";
import {
  getAnthropicClient,
  isAnthropicAvailable,
  AnthropicUnavailableError,
} from "@/lib/anthropic-client";
import { getMovieKeywordList, getTVKeywordList } from "@/lib/keywords";
import { computeMatchSignals, blendSignalScore, explainMoodMatch } from "@/lib/match-explanation";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n";

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
// Mood-relative, not a fixed "dark genres" list - see avoidGenres below. 4
// comfortably covers a case like cozy/feel-good avoiding Thriller/Crime/
// Horror/War without being unbounded.
const MAX_AVOID_GENRES_FROM_QUERY = 4;

export function isMoodSearchAvailable(): boolean {
  return isAnthropicAvailable();
}

function getClient(locale: Locale): Anthropic {
  try {
    return getAnthropicClient();
  } catch (error) {
    if (error instanceof AnthropicUnavailableError) {
      throw new MoodSearchError(getDictionary(locale).serverErrors.moodSearchNotConfigured, 503);
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
  // Genres that would work against this mood's tone even on a candidate
  // that satisfies the main `genres` requirement above - see the schema
  // description below. Mood-relative by construction (resolved fresh per
  // query, not a maintained table), so "cozy" avoids Thriller/Crime while
  // "tense thriller" avoids Comedy/Family instead of avoiding itself.
  avoidGenres: string[];
}

export async function interpretMoodQuery(
  query: string,
  options: { genreNames: string[]; sortOptions: readonly string[]; locale?: Locale }
): Promise<MoodInterpretation> {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const t = getDictionary(locale);
  const anthropic = getClient(locale);

  const schema = {
    type: "object" as const,
    properties: {
      genres: {
        type: "array",
        items: { type: "string", enum: options.genreNames },
        description:
          "Genres from the allowed list that match the mood. Empty array if none clearly fit. " +
          "If a word in the query literally names one of the allowed genres (e.g. the query " +
          'contains "comedy", "thriller", "horror"), that is strong evidence for including THAT ' +
          "genre specifically - always include it, don't let surrounding tone words crowd it " +
          "out. That said, still separately consider whether OTHER genres are also clearly " +
          'implied by the rest of the query on top of the literal one (e.g. "cozy feel-good ' +
          'comedy" should still resolve to Comedy AND Drama - the literal "comedy" secures ' +
          'Comedy, while "cozy"/"feel-good" independently imply Drama). A literal genre mention ' +
          "is a floor, not a ceiling, on how many genres you pick. " +
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
          "Up to 5 short thematic or tonal keywords evoked by the query (e.g. 'slow burn', " +
          "'melancholic', 'time loop'). ALWAYS in English, regardless of what language the query " +
          "itself is written in - these are matched against TMDB's keyword catalog, which is " +
          "English-only, so a Portuguese (or any non-English) query should still produce English " +
          "keyword tags (e.g. a Portuguese query evoking 'viagem no tempo' should still yield " +
          "'time travel', not 'viagem no tempo').",
      },
      referenceTitles: {
        type: "array",
        items: { type: "string" },
        description:
          "Up to 3 specific movie or TV titles the query explicitly names or clearly implies (e.g. 'like Arrival'). Empty array if none.",
      },
      avoidGenres: {
        type: "array",
        items: { type: "string", enum: options.genreNames },
        description:
          "Genres from the allowed list whose presence on a candidate would work AGAINST this " +
          "mood's tone, even if the candidate satisfies the main genre requirement above. This is " +
          "relative to the SPECIFIC mood, not a fixed 'dark' or 'light' list - e.g. a cozy/" +
          "feel-good mood should avoid Thriller, Crime, Horror, War (intensity/violence clash " +
          "with cozy); a tense/dark/paranoid mood should avoid Comedy, Family, Animation (whimsy " +
          "undercuts tension) and must NOT avoid Thriller, Crime, or Horror even though those " +
          "sound 'dark' - they're exactly what's being asked for. Most mood queries (plot-based, " +
          "reference-title-based, or without a strong tonal polarity) should leave this empty - " +
          "only include a genre here when its presence would genuinely undercut this specific " +
          "mood, not just because it's unrelated to it. Never repeat a genre already selected in " +
          "the genres field above.",
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
    required: ["genres", "keywords", "referenceTitles", "avoidGenres", "sortBy"],
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
        "genres, keywords, or titles you're confident are actually implied by the query. " +
        "The query may be written in Portuguese, English, or any other language - interpret it " +
        "in whichever language it's actually in, and don't require it to be in English. " +
        "Regardless of the query's language, `genres` and `avoidGenres` must still only use " +
        "values from the allowed list given in the schema exactly as spelled there (that list " +
        "may itself be in Portuguese or English depending on the request) - never translate or " +
        "invent a genre value outside that list. `keywords`, however, must always be in English " +
        "no matter what language the query is in (see the keywords field's own description).",
      messages: [{ role: "user", content: query }],
      output_config: { format: { type: "json_schema", schema } },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new MoodSearchError(t.serverErrors.moodSearchMisconfigured, 503);
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new MoodSearchError(t.serverErrors.moodSearchRateLimited, 429);
    }
    if (error instanceof Anthropic.APIError) {
      throw new MoodSearchError(t.serverErrors.moodSearchUnavailable, 502);
    }
    throw error;
  }

  if (response.stop_reason === "refusal") {
    throw new MoodSearchError(t.serverErrors.moodSearchCouldNotInterpret, 422);
  }

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  if (!textBlock) {
    throw new MoodSearchError(t.serverErrors.moodSearchCouldNotInterpret, 502);
  }

  try {
    return JSON.parse(textBlock.text) as MoodInterpretation;
  } catch {
    throw new MoodSearchError(t.serverErrors.moodSearchCouldNotInterpret, 502);
  }
}

export interface ResolvedMoodFilters {
  genreIds: number[];
  keywordIds: number[];
  // Resolved the same way as genreIds - see discoverAndRankMoodPool for
  // where this actually applies (a per-candidate ranking penalty, not a
  // filter - see the schema description on avoidGenres above for why).
  avoidGenreIds: number[];
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
  genres: TMDBGenre[],
  language = "en-US"
): Promise<ResolvedMoodFilters> {
  const genreNameToId = new Map(genres.map((genre) => [genre.name, genre.id]));
  const genreIds = interpretation.genres
    .slice(0, MAX_GENRES_FROM_QUERY)
    .map((name) => genreNameToId.get(name))
    .filter((id): id is number => id !== undefined);
  const genreNames = new Map(genreIds.map((id) => [id, genres.find((g) => g.id === id)!.name]));
  const avoidGenreIds = (interpretation.avoidGenres ?? [])
    .slice(0, MAX_AVOID_GENRES_FROM_QUERY)
    .map((name) => genreNameToId.get(name))
    .filter((id): id is number => id !== undefined);

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
          mediaType === "movie"
            ? await searchMovies(title, 1, language)
            : await searchTV(title, 1, language);
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
    avoidGenreIds,
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
  // Just ids, not {id, name} pairs like genres/keywords above - never
  // surfaced in any UI text (no "why this DOESN'T match" display), so
  // there's no name to round-trip.
  avoidGenreIds: number[];
  sortBy: string;
  yearRange?: TMDBYearRange;
}

export function toResolvedMoodParams(resolved: ResolvedMoodFilters): ResolvedMoodParams {
  return {
    genres: [...resolved.genreNames.entries()].map(([id, name]) => ({ id, name })),
    keywords: [...resolved.keywordNames.entries()].map(([id, name]) => ({ id, name })),
    avoidGenreIds: resolved.avoidGenreIds,
    sortBy: resolved.sortBy,
    yearRange: resolved.yearRange,
  };
}

export function fromResolvedMoodParams(params: ResolvedMoodParams): {
  genreIds: number[];
  genreNames: Map<number, string>;
  keywordIds: number[];
  keywordNames: Map<number, string>;
  avoidGenreIds: number[];
  sortBy: string;
  yearRange?: TMDBYearRange;
} {
  return {
    genreIds: params.genres.map((g) => g.id),
    genreNames: new Map(params.genres.map((g) => [g.id, g.name])),
    keywordIds: params.keywords.map((k) => k.id),
    keywordNames: new Map(params.keywords.map((k) => [k.id, k.name])),
    // Cached interpretations saved before this field existed (or a stale
    // client bundle across a deploy) just default to no penalty - today's
    // behavior, not a crash.
    avoidGenreIds: params.avoidGenreIds ?? [],
    sortBy: params.sortBy,
    yearRange: params.yearRange,
  };
}

// User-set filters win over whatever the LLM extracted - see CLAUDE.md's
// architecture note on why mood search stopped being mutually exclusive
// with filters (real user feedback: filtering felt broken combined with
// mood search). Keywords always pass through untouched regardless of
// overrides - there's no UI control for them, so there's never a real
// conflict to resolve.
export interface MoodFilterOverrides {
  genreIds?: number[];
  sortBy?: string;
  watchProviderIds?: number[];
  watchRegion?: string;
}

export interface MoodGenreAttempt {
  genreIds: number[];
  genreMatchMode: "any" | "all";
}

// A genre override used to REPLACE the mood's own genres outright (hard
// AND -> OR checkbox semantics). Real usage showed this producing wrong
// results: mood "slow melancholic sci-fi" (Science Fiction+Drama) plus
// checking Adventure returned Wizard of Oz and Meet the Robinsons - the
// sci-fi constraint just gone, replaced by Adventure alone. What's wanted
// instead is narrowing: mood genres AND the user's pick, all required at
// once (-> Interstellar, Project Hail Mary - both genuinely Science
// Fiction+Drama+Adventure). So the override now produces an ORDERED list
// of attempts for discoverAndRankMoodPool to try in sequence, most
// specific first, falling back only when an attempt is too thin
// (MIN_MOOD_RESULTS below) - a genuinely contradictory pick (mood "cozy
// feel-good comedy" + checking Horror) still needs to show *something*
// rather than a near-empty grid, so it falls back to the user's own pick
// alone, OR mode, matching the browse page's normal checkbox convention -
// this is the ONLY behavior mood search had before this change, now
// demoted to a fallback instead of the default.
export function applyMoodFilterOverrides(
  params: { genreIds: number[]; sortBy: string; yearRange?: TMDBYearRange },
  overrides: MoodFilterOverrides
): {
  genreAttempts: MoodGenreAttempt[];
  sortBy: string;
  yearRange?: TMDBYearRange;
} {
  const hasGenreOverride = Boolean(overrides.genreIds && overrides.genreIds.length > 0);

  let genreAttempts: MoodGenreAttempt[];
  if (hasGenreOverride) {
    const combinedGenreIds = [...new Set([...params.genreIds, ...overrides.genreIds!])];
    genreAttempts =
      // Nothing to narrow FROM if the mood itself resolved to zero genres -
      // the "combined" set would just be the user's own pick again, making
      // a second, OR-mode attempt at the identical id list redundant.
      params.genreIds.length > 0
        ? [
            { genreIds: combinedGenreIds, genreMatchMode: "all" },
            { genreIds: overrides.genreIds!, genreMatchMode: "any" },
          ]
        : [{ genreIds: overrides.genreIds!, genreMatchMode: "any" }];
  } else {
    genreAttempts =
      // Two AND'd mood genres can over-narrow on their own (Comedy + Family
      // skews toward kids' animation), independent of any user override -
      // narrows to just the primary genre as a last resort. Skipped when
      // there's only one mood genre to begin with, since slice(0, 1) of a
      // single-genre list is the same attempt again.
      params.genreIds.length > 1
        ? [
            { genreIds: params.genreIds, genreMatchMode: "all" },
            { genreIds: params.genreIds.slice(0, 1), genreMatchMode: "all" },
          ]
        : [{ genreIds: params.genreIds, genreMatchMode: "all" }];
  }

  return {
    genreAttempts,
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
// Now gates the BULK pool's genre-attempt cascade below (both the
// no-override "narrow to primary genre" case and the genre-override
// "combined intersection too thin, fall back to the user's own pick"
// case - see applyMoodFilterOverrides) - keywords no longer have a "give
// up and drop the filter" threshold of their own, since the precision
// pool (below) always takes whatever it finds.
const MIN_MOOD_RESULTS = 10;

// Reranking turns keywords from a filter-or-nothing switch into a ranking
// signal, closing the "popularity.desc has no notion of tone" gap (a
// popular-but-tonally-wrong title like Parasite or The Wolf of Wall Street
// ranking above genuinely cozy/feel-good picks in a Comedy+Drama pool).
//
// A single popularity-sorted pool isn't enough to do this well: TMDB's
// keyword tagging for abstract tone/vibe words ("cozy", "feel-good") is
// sparse to the point of covering as few as 5-26 movies in the ENTIRE
// catalog - measured directly against the live API - so titles that
// genuinely carry one of these tags are often not anywhere near the top of
// their genre by raw popularity. A single 60-candidate popularity-sorted
// pool for "cozy feel-good comedy" turned up only ~7 genuine keyword
// matches; reranking correctly promoted those 7 to the top, but the
// remaining 13 "top 20" slots still had to be padded from the same
// zero-match, high-popularity tier that includes Parasite and The Wolf of
// Wall Street - undoing the fix by padding it right back in.
//
// So the pool is a union of two independently-fetched sets:
// - precision: genre AND + keywords OR, as a hard filter, fetched
//   unconditionally and taken as-is however few results it has - every
//   genuine keyword match is worth having, there's no "too thin, give up"
//   threshold here unlike the old keyword-drop fallback this replaces.
// - bulk: genre only (never keyword-filtered), for volume - walks
//   genreAttempts (see applyMoodFilterOverrides) in order, falling back to
//   the next attempt whenever the current one is too thin on page 1
//   (MIN_MOOD_RESULTS). Covers two distinct cases with the same cascade:
//   two AND'd mood genres over-narrowing on their own (Comedy + Family
//   skews toward kids' animation), and a user genre override that's too
//   narrow once intersected with the mood's own genres, falling back to
//   the user's pick alone.
// Deduped by id after union; every pool member (from either set) is scored
// against the FULL original keyword set below, so bulk-only members still
// get credit for any keyword they happen to carry.
const POOL_PAGES = 3;
// The already-scored pool this file builds is 40-60 candidates deep (see the
// union comment above) but only one page of it ships per request - Load More
// asks for a later page of the SAME deterministic pool (see the `page`
// parameter on discoverAndRankMoodPool below) rather than fetching more TMDB
// pages or re-ranking, so no new Anthropic call and no reordering.
const MOOD_PAGE_SIZE = 20;
// Same value as tmdb.ts's TOP_RATED_MIN_VOTE_COUNT, applied here regardless
// of sort (not just for vote_average.desc) - a pool candidate's genre/
// keyword tagging (and its vote_average, used as a rerank tiebreaker) isn't
// trustworthy signal below a real vote base. Verified directly against the
// live API for both regression cases: Science Fiction+Drama keeps 291
// candidates at this threshold, Comedy+Drama keeps 1,590 - comfortably
// enough for a pool either way, precision set included.
export const POOL_MIN_VOTE_COUNT = 200;

// genreMatchMode is a per-call argument (not baked into the closure) since
// discoverAndRankMoodPool now needs to fetch different genre attempts -
// combined AND, then a looser OR fallback - within the same pool build.
type DiscoverMoodPage = (
  genreIds: number[],
  keywordIds: number[],
  page: number,
  genreMatchMode: "any" | "all"
) => Promise<TMDBSearchResponse>;

async function fetchPoolPages(
  discover: DiscoverMoodPage,
  genreIds: number[],
  keywordIds: number[],
  genreMatchMode: "any" | "all"
): Promise<TMDBMovie[]> {
  const page1 = await discover(genreIds, keywordIds, 1, genreMatchMode);
  const extraPageNumbers: number[] = [];
  for (let page = 2; page <= Math.min(page1.total_pages, POOL_PAGES); page++) {
    extraPageNumbers.push(page);
  }
  const morePages = await Promise.all(
    extraPageNumbers.map((page) => discover(genreIds, keywordIds, page, genreMatchMode))
  );
  return [...page1.results, ...morePages.flatMap((r) => r.results)];
}

// Subtracted once per clashing genre a candidate carries (see avoidGenres
// on the schema above) - strictly smaller than KEYWORD_POINTS_ONE (2) so a
// candidate with a real mood-keyword match plus exactly one clash genre
// still outranks an untagged, non-clashing candidate (2 genre baseline + 2
// keyword - 1 clash = 3, vs. 2 baseline + 0 = 2). Two or more simultaneous
// clash genres CAN invert that against a single-keyword match - treated as
// correct, not a bug: a candidate clashing on multiple genres at once is a
// genuinely worse fit even with an incidental keyword tag.
const AVOID_GENRE_PENALTY = 1;

export async function discoverAndRankMoodPool(
  discover: DiscoverMoodPage,
  genreAttempts: MoodGenreAttempt[],
  keywordIds: number[],
  avoidGenreIds: number[],
  genreNames: Map<number, string>,
  keywordNames: Map<number, string>,
  mediaType: "movie" | "tv",
  // Which MOOD_PAGE_SIZE-sized window of the ranked pool to return - 1 is
  // the original top tier, 2+ is Load More asking for the next tier of the
  // SAME pool. The pool itself (precision+bulk fetch, keyword lookups,
  // scoring) is rebuilt identically regardless of page - deterministic given
  // the same inputs, so a later page is genuinely "the next slice of the
  // already-ranked pool," not a new interpretation or a different ranking.
  page: number = 1,
  locale: Locale = DEFAULT_LOCALE
): Promise<{
  results: (TMDBMovie & { matchExplanation: string | null })[];
  appliedGenreIds: number[];
  hasMore: boolean;
}> {
  // The precision pool always uses the most specific attempt (genreAttempts[0]
  // - mood's own genres, or mood+user combined when a genre is overridden)
  // unconditionally, regardless of what the bulk pool below ends up falling
  // back to - matching its existing "take whatever genuine matches exist, no
  // relaxation" philosophy. Worst case it contributes nothing and the bulk
  // pool's own fallback carries the grid.
  const primaryAttempt = genreAttempts[0];
  const precisionPool =
    keywordIds.length > 0
      ? await fetchPoolPages(
          discover,
          primaryAttempt.genreIds,
          keywordIds,
          primaryAttempt.genreMatchMode
        )
      : [];

  let bulkAttempt = primaryAttempt;
  let bulkPage1 = await discover(bulkAttempt.genreIds, [], 1, bulkAttempt.genreMatchMode);
  for (const next of genreAttempts.slice(1)) {
    if (bulkPage1.results.length >= MIN_MOOD_RESULTS) break;
    bulkAttempt = next;
    bulkPage1 = await discover(bulkAttempt.genreIds, [], 1, bulkAttempt.genreMatchMode);
  }
  const bulkExtraPageNumbers: number[] = [];
  for (let page = 2; page <= Math.min(bulkPage1.total_pages, POOL_PAGES); page++) {
    bulkExtraPageNumbers.push(page);
  }
  const bulkMorePages = await Promise.all(
    bulkExtraPageNumbers.map((page) =>
      discover(bulkAttempt.genreIds, [], page, bulkAttempt.genreMatchMode)
    )
  );
  const bulkPool = [...bulkPage1.results, ...bulkMorePages.flatMap((r) => r.results)];

  const seenIds = new Set<number>();
  const pool: TMDBMovie[] = [];
  for (const item of [...precisionPool, ...bulkPool]) {
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    pool.push(item);
  }

  const getKeywords = mediaType === "movie" ? getMovieKeywordList : getTVKeywordList;
  const poolKeywordIdSets = await Promise.all(
    pool.map(async (candidate) => {
      try {
        const keywords = await getKeywords(candidate.id);
        return new Set(keywords.map((keyword) => keyword.id));
      } catch {
        // Best-effort: a failed keyword lookup just scores that candidate
        // on genre only, same tolerance as blend's candidate scoring.
        return new Set<number>();
      }
    })
  );

  const avoidGenreIdSet = new Set(avoidGenreIds);
  const scored = pool.map((candidate, index) => {
    const signals = computeMatchSignals(
      candidate.genre_ids,
      poolKeywordIdSets[index],
      genreNames,
      keywordNames
    );
    const clashCount = candidate.genre_ids.filter((id) => avoidGenreIdSet.has(id)).length;
    return {
      candidate,
      score: blendSignalScore(signals) - clashCount * AVOID_GENRE_PENALTY,
      matchExplanation: explainMoodMatch(signals, locale),
    };
  });

  // Stable sort: the pool arrives already ordered by the resolved sort
  // (popularity or vote_average), so equal scores keep that order as an
  // implicit tiebreak - same pattern vibe-blend.ts already relies on.
  scored.sort((a, b) => b.score - a.score);

  const offset = (page - 1) * MOOD_PAGE_SIZE;
  return {
    results: scored
      .slice(offset, offset + MOOD_PAGE_SIZE)
      .map((entry) => ({ ...entry.candidate, matchExplanation: entry.matchExplanation })),
    appliedGenreIds: bulkAttempt.genreIds,
    hasMore: offset + MOOD_PAGE_SIZE < scored.length,
  };
}
