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

const REQUEST_TIMEOUT_MS = 10_000;

// Cache windows, conservative on purpose - staleness this short is invisible
// to users but still cuts most of the redundant upstream traffic. `false`
// means genuinely request-specific (search results) and shouldn't be cached.
export const REVALIDATE = {
  reference: 86_400, // genre lists - practically static
  listing: 300, // popular/discover/credits/details/external_ids
  search: false as const,
} as const;

async function tmdbFetch<T>(
  path: string,
  searchParams?: Record<string, string>,
  revalidate: number | false = REVALIDATE.listing
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
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    next: revalidate === false ? { revalidate: 0 } : { revalidate },
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
  return tmdbFetch<TMDBSearchResponse>(
    "/search/movie",
    { query, page: String(page), include_adult: "false" },
    REVALIDATE.search
  );
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
  return tmdbFetch<TMDBGenreListResponse>(
    "/genre/movie/list",
    undefined,
    REVALIDATE.reference
  );
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

export interface TMDBYearRange {
  gte?: number;
  lte?: number;
}

export function discoverMovies(options: {
  genreIds?: number[];
  keywordIds?: number[];
  sortBy?: MovieSortBy;
  page?: number;
  yearRange?: TMDBYearRange;
  // TMDB's with_genres treats "," as AND (must have every listed genre) and
  // "|" as OR (must have any). "any" (OR) is the right default for the
  // browse page's genre checkboxes - checking Action + Comedy there means
  // "show me either", the standard multi-select filter convention. Mood
  // search passes "all" instead: its genres are meant to be a hard,
  // narrowing filter (e.g. "Science Fiction" for a sci-fi mood), and OR
  // let unrelated single-genre matches (a Drama with no Sci-Fi at all)
  // through whenever the LLM returned more than one genre.
  genreMatchMode?: "any" | "all";
  // "Streaming on" filter (curated list in watch-providers.ts). OR'd
  // together (any of the selected platforms) - watch_region is required
  // by TMDB whenever with_watch_providers is set. Scoped to
  // with_watch_monetization_types=flatrate specifically: a "Streaming on
  // Netflix" filter means subscription-streamable there, not "available
  // to rent/buy through Netflix's storefront".
  watchProviderIds?: number[];
  watchRegion?: string;
}): Promise<TMDBSearchResponse> {
  const {
    genreIds = [],
    keywordIds = [],
    sortBy = "popularity.desc",
    page = 1,
    yearRange,
    genreMatchMode = "any",
    watchProviderIds = [],
    watchRegion,
  } = options;

  const params: Record<string, string> = {
    sort_by: sortBy,
    page: String(page),
    "vote_count.gte": String(
      sortBy === "vote_average.desc" ? TOP_RATED_MIN_VOTE_COUNT : DEFAULT_MIN_VOTE_COUNT
    ),
  };
  if (genreIds.length > 0) {
    params.with_genres = genreIds.join(genreMatchMode === "all" ? "," : "|");
  }
  if (keywordIds.length > 0) {
    params.with_keywords = keywordIds.join("|");
  }
  if (yearRange?.gte) {
    params["primary_release_date.gte"] = `${yearRange.gte}-01-01`;
  }
  if (yearRange?.lte) {
    params["primary_release_date.lte"] = `${yearRange.lte}-12-31`;
  }
  if (watchProviderIds.length > 0 && watchRegion) {
    params.with_watch_providers = watchProviderIds.join("|");
    params.watch_region = watchRegion;
    params.with_watch_monetization_types = "flatrate";
  }

  return tmdbFetch<TMDBSearchResponse>("/discover/movie", params);
}

export interface TMDBKeyword {
  id: number;
  name: string;
}

export function searchKeywords(query: string): Promise<{ results: TMDBKeyword[] }> {
  return tmdbFetch<{ results: TMDBKeyword[] }>(
    "/search/keyword",
    { query },
    REVALIDATE.search
  );
}

// TMDB's movie and TV keyword endpoints use different response keys
// ("keywords" vs "results") for the same shape - callers use
// getMovieKeywords/getTVKeywords directly rather than a shared helper.
export function getMovieKeywords(id: number): Promise<{ id: number; keywords: TMDBKeyword[] }> {
  return tmdbFetch<{ id: number; keywords: TMDBKeyword[] }>(`/movie/${id}/keywords`);
}

export function getTVKeywords(id: number): Promise<{ id: number; results: TMDBKeyword[] }> {
  return tmdbFetch<{ id: number; results: TMDBKeyword[] }>(`/tv/${id}/keywords`);
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
  return tmdbFetch<TMDBPersonSearchResponse>(
    "/search/person",
    { query, page: String(page), include_adult: "false" },
    REVALIDATE.search
  );
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
  return tmdbFetch<RawTMDBSearchResponse>(
    "/search/tv",
    { query, page: String(page), include_adult: "false" },
    REVALIDATE.search
  ).then(mapTVSearchResponse);
}

export function getPopularTV(page = 1): Promise<TMDBSearchResponse> {
  return tmdbFetch<RawTMDBSearchResponse>("/tv/popular", {
    page: String(page),
  }).then(mapTVSearchResponse);
}

export function getTVGenres(): Promise<TMDBGenreListResponse> {
  return tmdbFetch<TMDBGenreListResponse>(
    "/genre/tv/list",
    undefined,
    REVALIDATE.reference
  );
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
  keywordIds?: number[];
  sortBy?: TVSortBy;
  page?: number;
  yearRange?: TMDBYearRange;
  // See discoverMovies - "any" (OR) for the browse page's genre checkboxes,
  // "all" (AND) for mood search's harder genre filter.
  genreMatchMode?: "any" | "all";
  // See discoverMovies.
  watchProviderIds?: number[];
  watchRegion?: string;
}): Promise<TMDBSearchResponse> {
  const {
    genreIds = [],
    keywordIds = [],
    sortBy = "popularity.desc",
    page = 1,
    yearRange,
    genreMatchMode = "any",
    watchProviderIds = [],
    watchRegion,
  } = options;

  const params: Record<string, string> = {
    sort_by: sortBy,
    page: String(page),
    "vote_count.gte": String(
      sortBy === "vote_average.desc" ? TOP_RATED_MIN_VOTE_COUNT : DEFAULT_MIN_VOTE_COUNT
    ),
  };
  if (genreIds.length > 0) {
    params.with_genres = genreIds.join(genreMatchMode === "all" ? "," : "|");
  }
  if (keywordIds.length > 0) {
    params.with_keywords = keywordIds.join("|");
  }
  if (yearRange?.gte) {
    params["first_air_date.gte"] = `${yearRange.gte}-01-01`;
  }
  if (yearRange?.lte) {
    params["first_air_date.lte"] = `${yearRange.lte}-12-31`;
  }
  if (watchProviderIds.length > 0 && watchRegion) {
    params.with_watch_providers = watchProviderIds.join("|");
    params.watch_region = watchRegion;
    params.with_watch_monetization_types = "flatrate";
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

export interface TMDBWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

export interface TMDBWatchProvidersRegion {
  link: string;
  flatrate?: TMDBWatchProvider[];
  rent?: TMDBWatchProvider[];
  buy?: TMDBWatchProvider[];
}

export interface TMDBWatchProvidersResponse {
  id: number;
  // Keyed by ISO 3166-1 region code (e.g. "US") - TMDB returns every region
  // it has data for in one response, not just one you ask for.
  results: Record<string, TMDBWatchProvidersRegion>;
}

export function getWatchProviders(
  mediaType: "movie" | "tv",
  id: number
): Promise<TMDBWatchProvidersResponse> {
  return tmdbFetch<TMDBWatchProvidersResponse>(`/${mediaType}/${id}/watch/providers`);
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
