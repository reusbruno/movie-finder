const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";

export class TMDBError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "TMDBError";
  }
}

export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  original_language: string;
  adult: boolean;
}

export interface TMDBSearchResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBMovieDetails extends Omit<TMDBMovie, "genre_ids"> {
  genres: TMDBGenre[];
  runtime: number | null;
  status: string;
  tagline: string | null;
  homepage: string | null;
  budget: number;
  revenue: number;
}

function getApiToken(): string {
  const token = process.env.TMDB_API_TOKEN;
  if (!token) {
    throw new Error("TMDB_API_TOKEN environment variable is not set");
  }
  return token;
}

async function tmdbFetch<T>(
  path: string,
  searchParams?: Record<string, string>
): Promise<T> {
  const url = new URL(`${TMDB_API_BASE_URL}${path}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getApiToken()}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new TMDBError(
      `TMDB request failed: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  return response.json() as Promise<T>;
}

export function searchMovies(
  query: string,
  page = 1
): Promise<TMDBSearchResponse> {
  return tmdbFetch<TMDBSearchResponse>("/search/movie", {
    query,
    page: String(page),
    include_adult: "false",
  });
}

export function getMovieDetails(id: number): Promise<TMDBMovieDetails> {
  return tmdbFetch<TMDBMovieDetails>(`/movie/${id}`);
}
