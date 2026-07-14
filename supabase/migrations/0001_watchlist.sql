-- Personal watchlist, one row per (user, title). Run this in the Supabase
-- SQL editor (Project > SQL Editor > New query) - not applied automatically,
-- see the build log / plan for why.

create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  watched boolean not null default false,
  rating smallint check (rating between 1 and 5),
  notes text,
  added_at timestamptz not null default now(),
  unique (user_id, tmdb_id, media_type)
);

-- Every row belongs to exactly one user's own watchlist; RLS is the only
-- thing enforcing that once the anon/authenticated key is used from the
-- browser (see src/lib/watchlist.ts and watchlist-item-controls.tsx, which
-- both query this table directly with the signed-in user's own session -
-- no service-role key or server-side ownership check anywhere in the app).
alter table public.watchlist enable row level security;

create policy "select own watchlist rows"
  on public.watchlist for select
  using (auth.uid() = user_id);

create policy "insert own watchlist rows"
  on public.watchlist for insert
  with check (auth.uid() = user_id);

create policy "update own watchlist rows"
  on public.watchlist for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own watchlist rows"
  on public.watchlist for delete
  using (auth.uid() = user_id);

-- RLS policies alone are NOT enough - Postgres checks table-level GRANTs
-- first and only consults RLS policies to narrow rows within what the role
-- is already allowed to touch. A table created via the SQL editor doesn't
-- automatically get these grants the way tables created through some other
-- paths do, so without this every request 403s with "permission denied for
-- table watchlist" regardless of how correct the RLS policies above are -
-- hit and confirmed live during this feature's own verification. Scoped to
-- `authenticated` only, not `anon` - this app has no anonymous watchlist
-- access (see movie-card.tsx's WatchlistButton, which prompts sign-in
-- instead), and every RLS policy above requires auth.uid() = user_id, which
-- an anon request can never satisfy anyway.
grant select, insert, update, delete on public.watchlist to authenticated;

-- Every watchlist page load queries "this user's rows" (see
-- src/app/watchlist/page.tsx) - index on user_id so that stays cheap as
-- the table grows, independent of the uniqueness index above.
create index if not exists watchlist_user_id_idx on public.watchlist (user_id);
