import type { TMDBGenre, MovieSortBy } from "@/lib/tmdb";
import type { MovieWithRatings } from "@/lib/ratings";
import { MediaExplorer, type MediaExplorerConfig } from "@/components/media-explorer";

const MOVIES_CONFIG: MediaExplorerConfig<MovieSortBy> = {
  basePath: "movies",
  searchEndpoint: "/api/movies/search",
  discoverEndpoint: "/api/movies/discover",
  moodSearchEndpoint: "/api/movies/mood-search",
  vibeBlendEndpoint: "/api/movies/vibe-blend",
  popularEndpoint: "/api/movies/popular",
  searchPlaceholder: "Search movies…",
  sortOptions: [
    { value: "popularity.desc", label: "Popularity" },
    { value: "vote_average.desc", label: "Top Rated" },
    { value: "primary_release_date.desc", label: "Newest" },
    { value: "title.asc", label: "Title (A-Z)" },
  ],
  defaultSort: "popularity.desc",
  popularHeading: "Popular movies",
  itemsLabel: "movies",
};

export function MoviesView({
  initialMovies,
  initialTotalPages,
  genres,
}: {
  initialMovies: MovieWithRatings[];
  initialTotalPages: number;
  genres: TMDBGenre[];
}) {
  return (
    <MediaExplorer
      initialItems={initialMovies}
      initialTotalPages={initialTotalPages}
      genres={genres}
      config={MOVIES_CONFIG}
    />
  );
}
