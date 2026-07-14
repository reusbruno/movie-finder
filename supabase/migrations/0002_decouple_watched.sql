-- Decouples "watched + rating" from "in wishlist" - a row can now exist
-- with any combination of in_watchlist/watched/rating, instead of watched/
-- rating only ever existing inside a wishlist row. Run this in the
-- Supabase SQL editor after 0001_watchlist.sql.

alter table public.watchlist
  add column if not exists in_watchlist boolean not null default true;

-- Explicit backfill, even though the column default above already covers
-- it for every existing row (NOT NULL DEFAULT true on ADD COLUMN backfills
-- automatically in Postgres) - stated as its own step per request, and
-- harmless/idempotent if re-run.
update public.watchlist set in_watchlist = true where in_watchlist is distinct from true;

-- Restated explicitly, even though already applied via 0001 - the missing
-- GRANT was the actual bug that blocked every write last time, so it's
-- called out here again rather than assumed to still be in place.
grant select, insert, update, delete on public.watchlist to authenticated;
