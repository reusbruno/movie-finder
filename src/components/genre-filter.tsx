import {
  Baby,
  Camera,
  Clapperboard,
  Compass,
  Drama,
  Eye,
  Film,
  Ghost,
  Heart,
  Landmark,
  Laugh,
  Mic,
  Mountain,
  Music,
  Newspaper,
  Palette,
  Rocket,
  Scale,
  Search,
  Shield,
  Siren,
  Sparkles,
  Swords,
  Tv,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import type { TMDBGenre } from "@/lib/tmdb";

const GENRE_ICONS: Record<string, LucideIcon> = {
  // Movie genres
  Action: Swords,
  Adventure: Compass,
  Animation: Palette,
  Comedy: Laugh,
  Crime: Siren,
  Documentary: Camera,
  Drama,
  Family: Users,
  Fantasy: Wand2,
  History: Landmark,
  Horror: Ghost,
  Music,
  Mystery: Search,
  Romance: Heart,
  "Science Fiction": Rocket,
  "TV Movie": Tv,
  Thriller: Eye,
  War: Shield,
  Western: Mountain,
  // TV-only genres (movie/TV shared names above cover the rest)
  "Action & Adventure": Swords,
  Kids: Baby,
  News: Newspaper,
  Reality: Clapperboard,
  "Sci-Fi & Fantasy": Rocket,
  Soap: Sparkles,
  Talk: Mic,
  "War & Politics": Scale,
};

export function GenreFilter({
  genres,
  selectedGenreIds,
  onToggle,
}: {
  genres: TMDBGenre[];
  selectedGenreIds: number[];
  onToggle: (id: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium tracking-wide text-foreground/50 uppercase">
        Genres
      </span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Genres">
        {genres.map((genre) => {
          const Icon = GENRE_ICONS[genre.name] ?? Film;
          const selected = selectedGenreIds.includes(genre.id);

          return (
            <button
              key={genre.id}
              type="button"
              onClick={() => onToggle(genre.id)}
              aria-pressed={selected}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selected
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-black/[.08] text-foreground/60 hover:border-foreground/30 hover:text-foreground dark:border-white/[.145]"
              }`}
            >
              <Icon className="h-3 w-3" aria-hidden="true" />
              {genre.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
