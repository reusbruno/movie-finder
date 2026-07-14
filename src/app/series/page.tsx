import { getPopularTV, getTVGenres, type TVSortBy } from "@/lib/tmdb";
import { enrichTVWithRatings } from "@/lib/ratings";
import {
  MediaExplorer,
  type MediaExplorerConfig,
} from "@/components/media-explorer";
import { DEFAULT_LOCALE, TMDB_LANGUAGE } from "@/lib/i18n/locale";

// See src/app/movies/page.tsx - same SSR-default reasoning.
const SSR_LANGUAGE = TMDB_LANGUAGE[DEFAULT_LOCALE];

const SERIES_CONFIG: MediaExplorerConfig<TVSortBy> = {
  basePath: "series",
  searchEndpoint: "/api/tv/search",
  discoverEndpoint: "/api/tv/discover",
  moodSearchEndpoint: "/api/tv/mood-search",
  vibeBlendEndpoint: "/api/tv/vibe-blend",
  popularEndpoint: "/api/tv/popular",
  genresEndpoint: "/api/tv/genres",
  sortOptions: [
    { value: "popularity.desc" },
    { value: "vote_average.desc" },
    { value: "first_air_date.desc" },
    { value: "name.asc" },
  ],
  defaultSort: "popularity.desc",
};

export default async function SeriesPage() {
  const [popular, genres] = await Promise.all([
    getPopularTV(1, SSR_LANGUAGE),
    getTVGenres(SSR_LANGUAGE),
  ]);
  const initialShows = await enrichTVWithRatings(popular.results);

  return (
    <MediaExplorer
      initialItems={initialShows}
      initialTotalPages={popular.total_pages}
      genres={genres.genres}
      config={SERIES_CONFIG}
    />
  );
}
