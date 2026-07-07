const OMDB_API_BASE_URL = "https://www.omdbapi.com/";

export class OMDBError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "OMDBError";
  }
}

export interface MovieRatings {
  imdbRating: number | null;
  rottenTomatoesScore: number | null;
}

interface OMDBRatingEntry {
  Source: string;
  Value: string;
}

interface OMDBTitleResponse {
  Response: "True" | "False";
  Error?: string;
  imdbRating?: string;
  Ratings?: OMDBRatingEntry[];
}

function getApiKey(): string {
  const key = process.env.OMDB_API_KEY;
  if (!key) {
    throw new Error("OMDB_API_KEY environment variable is not set");
  }
  return key;
}

async function omdbFetch(
  params: Record<string, string>
): Promise<OMDBTitleResponse> {
  const url = new URL(OMDB_API_BASE_URL);
  url.searchParams.set("apikey", getApiKey());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new OMDBError(
      `OMDb request failed: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  return response.json() as Promise<OMDBTitleResponse>;
}

function parseImdbRating(value: string | undefined): number | null {
  if (!value || value === "N/A") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRottenTomatoesScore(
  ratings: OMDBRatingEntry[] | undefined
): number | null {
  const entry = ratings?.find((rating) => rating.Source === "Rotten Tomatoes");
  if (!entry) return null;

  const match = entry.Value.match(/^(\d+)%$/);
  if (!match) return null;

  return Number(match[1]);
}

export async function getMovieRatingsByImdbId(
  imdbId: string
): Promise<MovieRatings> {
  const data = await omdbFetch({ i: imdbId });

  if (data.Response === "False") {
    return { imdbRating: null, rottenTomatoesScore: null };
  }

  return {
    imdbRating: parseImdbRating(data.imdbRating),
    rottenTomatoesScore: parseRottenTomatoesScore(data.Ratings),
  };
}
