"use client";

import { useState } from "react";
import { Eye, Star } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { WatchlistMediaType } from "@/lib/watchlist";
import { showToast } from "@/lib/toast";
import { useLanguage } from "@/components/language-provider";

const RATING_VALUES = [1, 2, 3, 4, 5] as const;

// Same duration as movie-card.tsx's WatchlistButton pulse - both should
// feel identically "instant" on click.
const PULSE_MS = 180;

// RLS (see supabase/migrations/0001_watchlist.sql) already scopes every
// query to the caller's own rows, so tmdb_id + media_type is enough to
// target the right row without also filtering on user_id here. Returns
// the write error (if any) so callers that want success/failure feedback
// (the watched toggle, below) can react to it - callers that don't
// (rating, notes) simply ignore the return value, unchanged from before.
async function updateRow(
  id: number,
  mediaType: WatchlistMediaType,
  patch: { watched?: boolean; rating?: number | null; notes?: string | null }
) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("watchlist")
    .update(patch)
    .eq("tmdb_id", id)
    .eq("media_type", mediaType);
  return error;
}

export function WatchlistItemControls({
  id,
  mediaType,
  title,
  initialWatched,
  initialRating,
  initialNotes,
}: {
  id: number;
  mediaType: WatchlistMediaType;
  title: string;
  initialWatched: boolean;
  initialRating: number | null;
  initialNotes: string | null;
}) {
  const { t } = useLanguage();
  const [watched, setWatched] = useState(initialWatched);
  const [rating, setRating] = useState<number | null>(initialRating);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [watchedPulsing, setWatchedPulsing] = useState(false);

  function handleToggleWatched() {
    const next = !watched;

    // Fires immediately on click, same as movie-card.tsx's WatchlistButton
    // pulse - the click should feel instant regardless of the write's
    // actual latency.
    setWatchedPulsing(true);
    setTimeout(() => setWatchedPulsing(false), PULSE_MS);

    setWatched(next);
    void updateRow(id, mediaType, { watched: next }).then((error) => {
      if (error) {
        // Roll back the optimistic toggle and surface the failure the
        // same way the watchlist add/remove button does.
        setWatched(!next);
        showToast(t.watchlist.watchedUpdateFailedToast, "error");
        return;
      }
      showToast(
        next ? t.watchlist.markedWatchedToast : t.watchlist.unmarkedWatchedToast,
        "success"
      );
    });
  }

  function handleRate(value: number) {
    // Clicking the star that's already the current rating clears it -
    // otherwise there'd be no way to remove a rating once set.
    const next = rating === value ? null : value;
    setRating(next);
    void updateRow(id, mediaType, { rating: next });
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    await updateRow(id, mediaType, { notes: notes.trim() === "" ? null : notes });
    setSavingNotes(false);
    setNotesDirty(false);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-4 sm:flex-row sm:items-start sm:gap-4 dark:border-white/[.145]">
      <p className="text-sm font-medium sm:w-40 sm:shrink-0 sm:pt-1">{title}</p>
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex w-fit items-center gap-2">
          <button
            type="button"
            onClick={handleToggleWatched}
            aria-pressed={watched}
            aria-label={t.watchlist.watched}
            title={t.watchlist.watched}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-all duration-150 ${
              watched ? "text-foreground" : "text-foreground/30 hover:text-foreground/60"
            } ${watchedPulsing ? "scale-125" : "scale-100"}`}
          >
            {/* Unlike Bookmark's fill toggle, Eye's shape (an outer almond
                plus an inner pupil circle) reads as an indistinct blob when
                solid-filled at this size - confirmed via screenshot, not
                assumed. State is conveyed by color weight alone instead. */}
            <Eye className="h-4 w-4" />
          </button>
          <span className="text-sm text-foreground/70">{t.watchlist.watched}</span>
        </div>

        <div className="flex items-center gap-1" role="radiogroup" aria-label={t.watchlist.rating}>
          {RATING_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => handleRate(value)}
              aria-pressed={rating !== null && value <= rating}
              aria-label={t.watchlist.rateStars(value)}
              className="text-foreground/30 transition-colors hover:text-accent"
            >
              <Star
                className="h-4 w-4"
                fill={rating !== null && value <= rating ? "currentColor" : "none"}
              />
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-2">
          <textarea
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setNotesDirty(true);
            }}
            placeholder={t.watchlist.notesPlaceholder}
            rows={2}
            className="min-w-0 flex-1 rounded-lg border border-black/[.08] bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 dark:border-white/[.145]"
          />
          <button
            type="button"
            onClick={handleSaveNotes}
            disabled={savingNotes || !notesDirty}
            className="shrink-0 rounded-full border border-black/[.08] px-4 py-2 text-xs font-medium transition-colors hover:border-foreground/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.145]"
          >
            {savingNotes ? t.common.loading : t.watchlist.saveNotes}
          </button>
        </div>
      </div>
    </div>
  );
}
