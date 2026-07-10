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
  searchPlaceholder: "Search series…",
  sortOptions: [
    { value: "popularity.desc", label: "Popularity" },
    { value: "vote_average.desc", label: "Top Rated" },
    { value: "first_air_date.desc", label: "Newest" },
    { value: "name.asc", label: "Title (A-Z)" },
  ],
  defaultSort: "popularity.desc",
  popularHeading: "Popular series",
  itemsLabel: "TV shows",
  filterFootnote: (
    <p className="text-xs text-foreground/50">
      Rotten Tomatoes scores are frequently unavailable for TV shows in our
      data source, even for popular ones — a missing score doesn&apos;t mean
      it doesn&apos;t exist elsewhere.
    </p>
  ),
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
