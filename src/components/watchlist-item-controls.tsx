"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useWatchlist } from "@/lib/use-watchlist";
import type { WatchlistMediaType } from "@/lib/watchlist";
import { useLanguage } from "@/components/language-provider";

const RATING_VALUES = [1, 2, 3, 4, 5] as const;

// Notes has no other UI anywhere else, so it's the one field here that
// isn't already covered by the shared watchlist store/cards - kept as a
// small local update, same shape as before.
async function updateNotes(id: number, mediaType: WatchlistMediaType, notes: string | null) {
  const supabase = getSupabaseBrowserClient();
  await supabase.from("watchlist").update({ notes }).eq("tmdb_id", id).eq("media_type", mediaType);
}

// This component no longer has its own "watched" toggle - since
// in_watchlist/watched are now independent fields (see
// supabase/migrations/0002_decouple_watched.sql), every card on this page
// (via the shared MovieGrid -> MovieCard -> WatchedButton, same as every
// other grid) already has its own eye icon. Duplicating a second watched
// toggle here would show two controls for the same state and risked
// drifting out of sync (this component previously tracked watched in
// local useState, seeded once from the server; the card's own button
// writes through the shared client-side store - the two would disagree
// the moment either one changed without a full page reload). Rating still
// lives here (nothing else shows it) and now reads live from that same
// shared store so it stays in sync with the card's own post-watched
// rating popover, rather than a second local copy of the same value.
export function WatchlistItemControls({
  id,
  mediaType,
  title,
  initialNotes,
}: {
  id: number;
  mediaType: WatchlistMediaType;
  title: string;
  initialNotes: string | null;
}) {
  const { t } = useLanguage();
  const { getWatched, getRating, setWatched } = useWatchlist();
  const watched = getWatched(id, mediaType);
  const rating = getRating(id, mediaType);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  function handleRate(value: number) {
    // Clicking the star that's already the current rating clears it -
    // otherwise there'd be no way to remove a rating once set. Passes the
    // current watched value through unchanged - rating here shouldn't
    // silently flip watched either way, matching setWatched's own
    // "omit to leave untouched" contract for the fields it doesn't own.
    const next = rating === value ? null : value;
    void setWatched(id, mediaType, watched, next);
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    await updateNotes(id, mediaType, notes.trim() === "" ? null : notes);
    setSavingNotes(false);
    setNotesDirty(false);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-black/[.08] p-4 sm:flex-row sm:items-start sm:gap-4 dark:border-white/[.145]">
      <p className="text-sm font-medium sm:w-40 sm:shrink-0 sm:pt-1">{title}</p>
      <div className="flex flex-1 flex-col gap-2">
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
