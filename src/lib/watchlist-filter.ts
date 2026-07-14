import type { TMDBMovie } from "@/lib/tmdb";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { WatchlistMediaType } from "@/lib/watchlist";

export type MyStatusFilter = "all" | "watched" | "unwatched";

export function isMyStatusFilter(value: string): value is MyStatusFilter {
  return value === "all" || value === "watched" || value === "unwatched";
}

interface PersonalStatusRow {
  tmdb_id: number;
  watched: boolean;
  rating: number | null;
}

// Filters an already-fetched TMDB page down to the signed-in user's own
// watched/rating history for just those ids - one extra query per page
// load (an `IN` lookup scoped to this page's ids, same "fetch once, not
// once per card" discipline the watchlist button state already uses; see
// src/lib/watchlist.ts), not once per candidate. TMDB's own discover/
// popular/search endpoints have no way to filter by an arbitrary id list,
// so this necessarily narrows an already-paginated TMDB page rather than
// asking TMDB for "page 2 of only my watched titles" - a filtered page
// can come back with fewer than the usual ~20 items as a result, the same
// tradeoff mood search's own genre+keyword AND'ing already accepts
// elsewhere in this app.
//
// No-ops (returns `items` unchanged) when there's nothing to filter by,
// or when signed out - the client-side filter UI only ever sends these
// params while signed in, but a stray/replayed request without a session
// degrades to "show everything" rather than erroring.
export async function filterByPersonalStatus<T extends TMDBMovie>(
  items: T[],
  mediaType: WatchlistMediaType,
  statusFilter: MyStatusFilter,
  minRating: number | null
): Promise<T[]> {
  if (statusFilter === "all" && minRating === null) return items;
  if (items.length === 0) return items;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return items;

  const { data, error } = await supabase
    .from("watchlist")
    .select("tmdb_id, watched, rating")
    .eq("user_id", user.id)
    .eq("media_type", mediaType)
    .in(
      "tmdb_id",
      items.map((item) => item.id)
    );

  // Best-effort, same tolerance as every other filter in this app degrading
  // gracefully on failure - a broken personal-filter lookup shouldn't take
  // the whole grid down with it.
  if (error) return items;

  const rows = (data ?? []) as PersonalStatusRow[];
  const byId = new Map(rows.map((row) => [row.tmdb_id, row]));

  return items.filter((item) => {
    const row = byId.get(item.id);
    const watched = row?.watched ?? false;
    if (statusFilter === "watched" && !watched) return false;
    if (statusFilter === "unwatched" && watched) return false;
    // My rating is only meaningful combined with "Watched" (matches the
    // UI, which disables/hides the rating select unless status is
    // Watched) - an item with no rating never satisfies a minimum.
    if (minRating !== null) {
      if (!watched) return false;
      if ((row?.rating ?? 0) < minRating) return false;
    }
    return true;
  });
}
