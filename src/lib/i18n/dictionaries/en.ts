// English dictionary - the canonical shape every other locale's dictionary
// is typed against (see pt-BR.ts's `Dictionary` annotation). A missing or
// extra key in another locale is a compile error, not a runtime gap - that
// guarantee is the actual mechanism behind "no leftover English", not a
// manual QA pass.
const en = {
  common: {
    loading: "Loading…",
    loadMore: "Load more",
    searching: "Searching…",
    noMatches: "No matches",
    noPosterAvailable: "No poster available",
    unknownYear: "Unknown year",
    tryAgain: "Try again",
    clear: "Clear",
  },
  header: {
    watchlist: "Watchlist",
    movies: "Movies",
    series: "Series",
    contentModeAriaLabel: "Content mode",
    languageAriaLabel: "Language",
    searchTitlesAndPeople: "Search titles and people",
    searchTitlesPlaceholder: "Search titles…",
    people: "People",
  },
  hero: {
    heading: "What are you in the mood for?",
    moodPlaceholder: "Describe a mood… e.g. slow melancholic sci-fi",
    moodAriaLabel: "Mood search",
    thinking: "Thinking…",
    find: "Find",
    firstTitle: "First title…",
    secondTitle: "Second title…",
    blending: "Blending…",
    blend: "Blend",
    pickTwoDifferent: "Pick two different titles to blend",
    backToMood: "← Mood search",
    moodComingSoon: "Mood search — coming soon",
    blendTwoTitles: "Blend two titles",
    picking: "Picking…",
    surpriseMe: "Surprise me",
    browseWithFilters: "Browse with filters",
  },
  interpretation: {
    label: "Interpreted as",
    noFilters: "No specific filters",
  },
  filters: {
    panel: "Filters",
    genres: "Genres",
    streamingOn: "Streaming on",
    sortBy: "Sort by",
    minImdb: "Min IMDb",
    minRt: "Min RT",
    any: "Any",
  },
  results: {
    heading: (context: string, count: number) =>
      `${context} · ${count} ${count === 1 ? "result" : "results"}`,
    blendingCaption: (titleA: string, titleB: string) => `Blending: ${titleA} + ${titleB}`,
    resultsFor: (query: string) => `Results for "${query}"`,
    filtered: "Filtered",
  },
  grid: {
    noResults: "No results found.",
  },
  watchlistButton: {
    removeAria: (title: string) => `Remove ${title} from watchlist`,
    addAria: (title: string) => `Add ${title} to watchlist`,
    removeTooltip: "Remove from watchlist",
    addTooltip: "Add to watchlist",
    posterAlt: (title: string) => `${title} poster`,
  },
  explain: {
    expanding: "Expanding…",
    explainMore: "Explain more",
    failedToExpand: "Failed to expand explanation",
  },
  sortLabels: {
    "popularity.desc": "Popularity",
    "vote_average.desc": "Top Rated",
    "primary_release_date.desc": "Newest",
    "title.asc": "Title (A-Z)",
    "first_air_date.desc": "Newest",
    "name.asc": "Title (A-Z)",
  } as Record<string, string>,
  watchProviders: {
    stream: "Stream",
    rent: "Rent",
    buy: "Buy",
    whereToWatch: "Where to watch",
    region: "Region",
    moreInfoOnTmdb: "More info on TMDB →",
  },
  watchRegionLabels: {
    US: "United States",
    BR: "Brazil",
  } as Record<string, string>,
  watchlist: {
    empty: "Your watchlist is empty. Add titles from any movie or show card.",
    loadError: "Failed to load your watchlist. Try refreshing.",
  },
  titlePicker: {
    searchFailed: "Search failed",
    clear: (title: string) => `Clear ${title}`,
  },
  actorFilmography: {
    from: "From",
    to: "To",
    yearPlaceholder: "Year",
  },
  cast: {
    noPhoto: "No photo available",
    asCharacter: (character: string) => `as ${character}`,
  },
  filmography: {
    tvSuffix: " · TV",
    noResults: "Nothing matches these filters.",
  },
  tmdbAttribution: {
    logoAlt: "The Movie Database (TMDB) logo",
    text: "This product uses the TMDB API but is not endorsed or certified by TMDB.",
  },
  notFound: {
    heading: "Not found",
    body: "We couldn't find what you were looking for. It may have been removed, or the link might be wrong.",
    backToMovies: "Back to Movies",
  },
  errorPage: {
    heading: "Something went wrong",
    defaultMessage: "An unexpected error occurred.",
  },
  movies: {
    searchPlaceholder: "Search movies…",
    searchAriaLabel: "Search movies",
    popularHeading: "Popular movies",
    errors: {
      failedToLoad: "Failed to load movies",
      failedToSearch: "Failed to search movies",
    },
  },
  series: {
    searchPlaceholder: "Search series…",
    searchAriaLabel: "Search series",
    popularHeading: "Popular series",
    ratingsFootnote:
      "Rotten Tomatoes scores are frequently unavailable for TV shows in our data source, even for popular ones — a missing score doesn't mean it doesn't exist elsewhere.",
    errors: {
      failedToLoad: "Failed to load TV shows",
      failedToSearch: "Failed to search TV shows",
    },
  },
  errors: {
    tooManySearches: "Too many searches — wait a moment and try again.",
    failedToInterpretMood: "Failed to interpret mood query",
    noTitlesMatchFilters: "No titles match the current filters.",
    failedToPickSurprise: "Failed to pick a surprise title",
    failedToBlend: "Failed to blend titles",
  },
  // Server-side route catch-all fallbacks - reused as both client fallback
  // text (data.error ?? ...) and the actual `error` field the route itself
  // returns, via getDictionary(locale) server-side. Scoped to genuine
  // upstream/failure messages only, not request-validation 400s (a
  // malformed request from this app's own client should never happen, so
  // those stay English - a developer-facing signal, not a user-facing one).
  serverErrors: {
    invalidMovieId: "Invalid movie id",
    invalidTVId: "Invalid TV show id",
    invalidPersonId: "Invalid person id",
    failedToFetchMovieDetails: "Failed to fetch movie details",
    failedToFetchTVDetails: "Failed to fetch TV show details",
    failedToFetchMovieCredits: "Failed to fetch movie credits",
    failedToFetchTVCredits: "Failed to fetch TV show credits",
    failedToFetchPersonCredits: "Failed to fetch person credits",
    failedToFetchMovieRecommendations: "Failed to fetch movie recommendations",
    failedToFetchTVRecommendations: "Failed to fetch TV show recommendations",
    failedToFetchGenres: "Failed to fetch genres",
    failedToFetchTVGenres: "Failed to fetch TV genres",
    failedToFetchPopularMovies: "Failed to fetch popular movies",
    failedToFetchPopularTV: "Failed to fetch popular TV shows",
    failedToFetchPopularPeople: "Failed to fetch popular people",
    failedToDiscoverMovies: "Failed to discover movies",
    failedToDiscoverTV: "Failed to discover TV shows",
    failedToSearchMovies: "Failed to search movies",
    failedToSearchTV: "Failed to search TV shows",
    failedToSearchPeople: "Failed to search people",
    failedToBlendMovies: "Failed to blend movies",
    failedToBlendTV: "Failed to blend TV shows",
    unsupportedLanguage: "Query parameter 'language' is not supported",
    moodSearchNotConfigured: "Mood search is not configured",
  },
  yearRange: {
    through: (year: number) => `through ${year}`,
  },
  detail: {
    backToMovies: "← Back to Movies",
    backToSeries: "← Back to Series",
    cast: "Cast",
    moreLikeThis: "More like this",
    runtimeMinutes: (minutes: number) => `${minutes} min`,
    seasons: (count: number) => `${count} ${count === 1 ? "season" : "seasons"}`,
    episodes: (count: number) => `${count} ${count === 1 ? "episode" : "episodes"}`,
  },
  actor: {
    noBiography: "No biography available.",
    filmography: "Filmography",
  },
};

export default en;
export type Dictionary = typeof en;
