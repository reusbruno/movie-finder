import { getPopularTV, getTVGenres } from "@/lib/tmdb";
import { enrichTVWithRatings } from "@/lib/ratings";
import { SeriesExplorer } from "@/components/series-explorer";

export default async function SeriesPage() {
  const [popular, genres] = await Promise.all([
    getPopularTV(),
    getTVGenres(),
  ]);
  const initialShows = await enrichTVWithRatings(popular.results);

  return <SeriesExplorer initialShows={initialShows} genres={genres.genres} />;
}
