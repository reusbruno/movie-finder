"use client";

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
import { useLanguage } from "@/components/language-provider";

// Keyed by TMDB's numeric genre id, not name - stable and language-
// independent, unlike the name (which now arrives in whatever locale is
// active). Movie and TV share the same id for every overlapping genre
// (Animation, Comedy, Crime, Documentary, Drama, Family, Mystery, Western),
// so those are listed once; ids that only exist in one taxonomy or the
// other (Science Fiction/War for movies, the TV-only entries below) are
// listed separately even where the icon choice happens to match.
const GENRE_ICONS: Record<number, LucideIcon> = {
  28: Swords, // Action
  12: Compass, // Adventure
  16: Palette, // Animation
  35: Laugh, // Comedy
  80: Siren, // Crime
  99: Camera, // Documentary
  18: Drama, // Drama
  10751: Users, // Family
  14: Wand2, // Fantasy
  36: Landmark, // History
  27: Ghost, // Horror
  10402: Music, // Music
  9648: Search, // Mystery
  10749: Heart, // Romance
  878: Rocket, // Science Fiction (movie)
  10770: Tv, // TV Movie
  53: Eye, // Thriller
  10752: Shield, // War (movie)
  37: Mountain, // Western
  // TV-only ids
  10759: Swords, // Action & Adventure
  10762: Baby, // Kids
  10763: Newspaper, // News
  10764: Clapperboard, // Reality
  10765: Rocket, // Sci-Fi & Fantasy
  10766: Sparkles, // Soap
  10767: Mic, // Talk
  10768: Scale, // War & Politics
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
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium tracking-wide text-foreground/50 uppercase">
        {t.filters.genres}
      </span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t.filters.genres}>
        {genres.map((genre) => {
          const Icon = GENRE_ICONS[genre.id] ?? Film;
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
