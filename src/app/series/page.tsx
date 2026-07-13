import { getPopularTV, getTVGenres, type TVSortBy } from "@/lib/tmdb";
import { enrichTVWithRatings } from "@/lib/ratings";
import {
  MediaExplorer,
  type MediaExplorerConfig,
} from "@/components/media-explorer";

const SERIES_CONFIG: MediaExplorerConfig<TVSortBy> = {
  basePath: "series",
  searchEndpoint: "/api/tv/search",
  discoverEndpoint: "/api/tv/discover",
  moodSearchEndpoint: "/api/tv/mood-search",
  vibeBlendEndpoint: "/api/tv/vibe-blend",
  popularEndpoint: "/api/tv/popular",
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
    getPopularTV(),
    getTVGenres(),
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
