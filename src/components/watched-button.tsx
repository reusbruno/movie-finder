"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Eye, Star, X } from "lucide-react";
import { useWatchlist } from "@/lib/use-watchlist";
import { useAuth } from "@/lib/use-auth";
import { showToast } from "@/lib/toast";
import type { WatchlistMediaType } from "@/lib/watchlist";
import { useLanguage } from "@/components/language-provider";

// Same duration as WatchlistButton's own pulse (movie-card.tsx) - both
// icons on the same poster should feel identically instant on click.
const PULSE_MS = 180;
const RATING_VALUES = [1, 2, 3, 4, 5] as const;

// Grid cards / detail pages' own "mark as watched" control - independent
// of WatchlistButton's "+" (see src/lib/watchlist.ts: in_watchlist and
// watched are separate fields on the same row). Marking watched here
// never touches wishlist membership; a title can be marked watched
// straight from the catalog without ever being wishlisted.
export function WatchedButton({
  id,
  mediaType,
  title,
}: {
  id: number;
  mediaType: WatchlistMediaType;
  title: string;
}) {
  const { t } = useLanguage();
  const { getWatched, setWatched } = useWatchlist();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const watched = getWatched(id, mediaType);
  const [pulsing, setPulsing] = useState(false);
  // Only ever offered right after marking watched (not on unmarking, and
  // not just from being in some persistent "already watched" state) -
  // optional and skippable, never a blocking modal, per the request.
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);

  function handleToggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!user) {
      router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
      return;
    }

    setPulsing(true);
    setTimeout(() => setPulsing(false), PULSE_MS);

    const next = !watched;
    void setWatched(id, mediaType, next).then((result) => {
      if (result.error === "failed") {
        showToast(t.watchlist.watchedUpdateFailedToast, "error");
        return;
      }
      if (result.error === null) {
        showToast(
          next ? t.watchlist.markedWatchedToast : t.watchlist.unmarkedWatchedToast,
          "success"
        );
        if (next) setShowRatingPrompt(true);
      }
    });
  }

  function handleRate(value: number, event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    void setWatched(id, mediaType, true, value);
    setShowRatingPrompt(false);
  }

  function handleDismissPrompt(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setShowRatingPrompt(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={watched}
        aria-label={watched ? t.watchlistButton.unmarkWatchedAria(title) : t.watchlistButton.markWatchedAria(title)}
        title={watched ? t.watchlistButton.unmarkWatchedAria(title) : t.watchlistButton.markWatchedAria(title)}
        className={`absolute right-2 top-11 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition-all duration-150 hover:bg-black/80 ${
          watched ? "text-white" : "text-white/50"
        } ${pulsing ? "scale-125" : "scale-100"}`}
      >
        <Eye className="h-3.5 w-3.5" />
      </button>

      {showRatingPrompt && (
        <div
          role="group"
          aria-label={t.watchlist.rating}
          className="absolute right-2 top-20 z-20 flex items-center gap-1 rounded-full bg-black/80 px-2 py-1.5 backdrop-blur-sm"
        >
          {RATING_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={(event) => handleRate(value, event)}
              aria-label={t.watchlist.rateStars(value)}
              className="text-white/50 transition-colors hover:text-accent"
            >
              <Star className="h-3 w-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={handleDismissPrompt}
            aria-label={t.common.dismiss}
            className="ml-1 text-white/50 transition-colors hover:text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </>
  );
}
