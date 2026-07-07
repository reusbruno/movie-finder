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
  imdb_id: string | null;
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

export function getPopularMovies(page = 1): Promise<TMDBSearchResponse> {
  return tmdbFetch<TMDBSearchResponse>("/movie/popular", {
    page: String(page),
  });
}

export function getMovieRecommendations(
  id: number,
  page = 1
): Promise<TMDBSearchResponse> {
  return tmdbFetch<TMDBSearchResponse>(`/movie/${id}/recommendations`, {
    page: String(page),
  });
}

export interface TMDBExternalIds {
  imdb_id: string | null;
}

export function getMovieExternalIds(id: number): Promise<TMDBExternalIds> {
  return tmdbFetch<TMDBExternalIds>(`/movie/${id}/external_ids`);
}

export interface TMDBGenreListResponse {
  genres: TMDBGenre[];
}

export function getMovieGenres(): Promise<TMDBGenreListResponse> {
  return tmdbFetch<TMDBGenreListResponse>("/genre/movie/list");
}

export const MOVIE_SORT_OPTIONS = [
  "popularity.desc",
  "vote_average.desc",
  "primary_release_date.desc",
  "title.asc",
] as const;

export type MovieSortBy = (typeof MOVIE_SORT_OPTIONS)[number];

// TMDB's /discover/movie endpoint rejects page > 500 regardless of total_pages.
export const TMDB_MAX_DISCOVER_PAGE = 500;

const DEFAULT_MIN_VOTE_COUNT = 50;
const TOP_RATED_MIN_VOTE_COUNT = 200;

export function discoverMovies(options: {
  genreIds?: number[];
  sortBy?: MovieSortBy;
  page?: number;
}): Promise<TMDBSearchResponse> {
  const { genreIds = [], sortBy = "popularity.desc", page = 1 } = options;

  const params: Record<string, string> = {
    sort_by: sortBy,
    page: String(page),
    "vote_count.gte": String(
      sortBy === "vote_average.desc" ? TOP_RATED_MIN_VOTE_COUNT : DEFAULT_MIN_VOTE_COUNT
    ),
  };
  if (genreIds.length > 0) {
    params.with_genres = genreIds.join("|");
  }

  return tmdbFetch<TMDBSearchResponse>("/discover/movie", params);
}
