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

export interface TMDBKnownForItem {
  id: number;
  media_type: "movie" | "tv";
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
}

export interface TMDBPerson {
  id: number;
  name: string;
  original_name: string;
  profile_path: string | null;
  popularity: number;
  known_for_department: string;
  known_for: TMDBKnownForItem[];
}

export interface TMDBPersonSearchResponse {
  page: number;
  results: TMDBPerson[];
  total_pages: number;
  total_results: number;
}

export function searchPeople(
  query: string,
  page = 1
): Promise<TMDBPersonSearchResponse> {
  return tmdbFetch<TMDBPersonSearchResponse>("/search/person", {
    query,
    page: String(page),
    include_adult: "false",
  });
}

export function getPopularPeople(
  page = 1
): Promise<TMDBPersonSearchResponse> {
  return tmdbFetch<TMDBPersonSearchResponse>("/person/popular", {
    page: String(page),
  });
}

export interface TMDBPersonDetails {
  id: number;
  name: string;
  biography: string;
  profile_path: string | null;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  known_for_department: string;
}

export function getPersonDetails(id: number): Promise<TMDBPersonDetails> {
  return tmdbFetch<TMDBPersonDetails>(`/person/${id}`);
}

export interface TMDBCastCredit extends TMDBMovie {
  character: string;
  credit_id: string;
  media_type?: "movie" | "tv";
}

export interface TMDBPersonMovieCredits {
  id: number;
  cast: TMDBCastCredit[];
}

interface RawTMDBPersonMovieCredits {
  id: number;
  cast: Omit<TMDBCastCredit, "media_type">[];
}

export function getPersonMovieCredits(
  id: number
): Promise<TMDBPersonMovieCredits> {
  return tmdbFetch<RawTMDBPersonMovieCredits>(
    `/person/${id}/movie_credits`
  ).then((data) => ({
    id: data.id,
    cast: data.cast.map((credit) => ({ ...credit, media_type: "movie" as const })),
  }));
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  credit_id: string;
  order: number;
  profile_path: string | null;
}

export interface TMDBMovieCredits {
  id: number;
  cast: TMDBCastMember[];
}

export function getMovieCredits(id: number): Promise<TMDBMovieCredits> {
  return tmdbFetch<TMDBMovieCredits>(`/movie/${id}/credits`);
}

// --- TV -----------------------------------------------------------------
//
// TMDB's TV endpoints mirror the movie ones but with different field names
// (name/first_air_date instead of title/release_date). List-shaped TV
// responses are mapped into the same TMDBMovie shape so every movie UI
// component (MovieCard, MovieGrid, GenreFilter, ratings enrichment, discover
// filtering) works unchanged for TV data - only the base path for links
// genuinely differs, handled via a `basePath` prop where needed.

interface RawTMDBTVShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  first_air_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  original_language: string;
  adult?: boolean;
}

function mapTVShowToMovieShape(show: RawTMDBTVShow): TMDBMovie {
  return {
    id: show.id,
    title: show.name,
    original_title: show.original_name,
    overview: show.overview,
    release_date: show.first_air_date,
    poster_path: show.poster_path,
    backdrop_path: show.backdrop_path,
    vote_average: show.vote_average,
    vote_count: show.vote_count,
    popularity: show.popularity,
    genre_ids: show.genre_ids,
    original_language: show.original_language,
    adult: show.adult ?? false,
  };
}

interface RawTMDBSearchResponse {
  page: number;
  results: RawTMDBTVShow[];
  total_pages: number;
  total_results: number;
}

function mapTVSearchResponse(data: RawTMDBSearchResponse): TMDBSearchResponse {
  return { ...data, results: data.results.map(mapTVShowToMovieShape) };
}

export function searchTV(query: string, page = 1): Promise<TMDBSearchResponse> {
  return tmdbFetch<RawTMDBSearchResponse>("/search/tv", {
    query,
    page: String(page),
    include_adult: "false",
  }).then(mapTVSearchResponse);
}

export function getPopularTV(page = 1): Promise<TMDBSearchResponse> {
  return tmdbFetch<RawTMDBSearchResponse>("/tv/popular", {
    page: String(page),
  }).then(mapTVSearchResponse);
}

export function getTVGenres(): Promise<TMDBGenreListResponse> {
  return tmdbFetch<TMDBGenreListResponse>("/genre/tv/list");
}

export const TV_SORT_OPTIONS = [
  "popularity.desc",
  "vote_average.desc",
  "first_air_date.desc",
  "name.asc",
] as const;

export type TVSortBy = (typeof TV_SORT_OPTIONS)[number];

export function discoverTV(options: {
  genreIds?: number[];
  sortBy?: TVSortBy;
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

  return tmdbFetch<RawTMDBSearchResponse>("/discover/tv", params).then(
    mapTVSearchResponse
  );
}

interface RawTMDBTVDetails {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  first_air_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  original_language: string;
  adult: boolean;
  genres: TMDBGenre[];
  status: string;
  tagline: string;
  homepage: string;
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
}

export interface TMDBTVDetails {
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
  original_language: string;
  adult: boolean;
  genres: TMDBGenre[];
  status: string;
  tagline: string | null;
  homepage: string | null;
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
}

export function getTVDetails(id: number): Promise<TMDBTVDetails> {
  return tmdbFetch<RawTMDBTVDetails>(`/tv/${id}`).then((data) => ({
    id: data.id,
    title: data.name,
    original_title: data.original_name,
    overview: data.overview,
    release_date: data.first_air_date,
    poster_path: data.poster_path,
    backdrop_path: data.backdrop_path,
    vote_average: data.vote_average,
    vote_count: data.vote_count,
    popularity: data.popularity,
    original_language: data.original_language,
    adult: data.adult,
    genres: data.genres,
    status: data.status,
    tagline: data.tagline || null,
    homepage: data.homepage || null,
    number_of_seasons: data.number_of_seasons,
    number_of_episodes: data.number_of_episodes,
    episode_run_time: data.episode_run_time,
  }));
}

export function getTVExternalIds(id: number): Promise<TMDBExternalIds> {
  return tmdbFetch<TMDBExternalIds>(`/tv/${id}/external_ids`);
}

export function getTVRecommendations(
  id: number,
  page = 1
): Promise<TMDBSearchResponse> {
  return tmdbFetch<RawTMDBSearchResponse>(`/tv/${id}/recommendations`, {
    page: String(page),
  }).then(mapTVSearchResponse);
}

export function getTVCredits(id: number): Promise<TMDBMovieCredits> {
  return tmdbFetch<TMDBMovieCredits>(`/tv/${id}/credits`);
}

interface RawTMDBTVCastCredit extends RawTMDBTVShow {
  character: string;
  credit_id: string;
}

export function getPersonTVCredits(
  id: number
): Promise<TMDBPersonMovieCredits> {
  return tmdbFetch<{ id: number; cast: RawTMDBTVCastCredit[] }>(
    `/person/${id}/tv_credits`
  ).then((data) => ({
    id: data.id,
    cast: data.cast.map((credit) => ({
      ...mapTVShowToMovieShape(credit),
      character: credit.character,
      credit_id: credit.credit_id,
      media_type: "tv" as const,
    })),
  }));
}
