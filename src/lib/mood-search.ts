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
const MAX_KEYWORDS_FROM_QUERY = 5;
const MAX_REFERENCE_TITLES = 3;
const MAX_KEYWORDS_PER_REFERENCE_TITLE = 3;

export function isMoodSearchAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new MoodSearchError("Mood search is not configured", 503);
    }
    client = new Anthropic({ apiKey });
  }
  return client;
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
          "Genres from the allowed list that match the mood. Empty array if none clearly fit.",
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
          gte: { type: "integer", description: "Earliest release year, if implied." },
          lte: { type: "integer", description: "Latest release year, if implied." },
        },
        additionalProperties: false,
      },
    },
    required: ["genres", "keywords", "referenceTitles", "sortBy"],
    additionalProperties: false,
  };

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: MOOD_SEARCH_MODEL,
      max_tokens: 1024,
      system:
        "You translate a free-text mood or vibe description into structured filters for a movie/TV discovery search. Be conservative: only include genres, keywords, or titles you're confident are actually implied by the query.",
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
  interpretation: {
    genreNames: string[];
    keywordTerms: string[];
    sortBy: string;
  };
}

export async function resolveMoodFilters(
  interpretation: MoodInterpretation,
  mediaType: "movie" | "tv",
  genres: TMDBGenre[]
): Promise<ResolvedMoodFilters> {
  const genreNameToId = new Map(genres.map((genre) => [genre.name, genre.id]));
  const genreIds = interpretation.genres
    .map((name) => genreNameToId.get(name))
    .filter((id): id is number => id !== undefined);

  const keywordTerms = new Set<string>();
  const keywordIds = new Set<number>();

  async function addKeywordTerm(term: string) {
    if (keywordTerms.has(term)) return;
    try {
      const { results } = await searchKeywords(term);
      if (results[0]) {
        keywordTerms.add(term);
        keywordIds.add(results[0].id);
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
    interpretation: {
      genreNames: interpretation.genres.filter((name) => genreNameToId.has(name)),
      keywordTerms: [...keywordTerms],
      sortBy: interpretation.sortBy,
    },
  };
}
