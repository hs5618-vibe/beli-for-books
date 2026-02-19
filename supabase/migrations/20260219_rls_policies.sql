-- RLS policies for client-side authenticated access.

alter table public.users enable row level security;
alter table public.books enable row level security;
alter table public.follows enable row level security;
alter table public.ratings enable row level security;
alter table public.book_statuses enable row level security;
alter table public.pairwise_comparisons enable row level security;
alter table public.activities enable row level security;

-- Users
DROP POLICY IF EXISTS users_select_all_authenticated ON public.users;
create policy users_select_all_authenticated on public.users
for select to authenticated
using (true);

DROP POLICY IF EXISTS users_insert_own ON public.users;
create policy users_insert_own on public.users
for insert to authenticated
with check (auth_user_id = auth.uid());

DROP POLICY IF EXISTS users_update_own ON public.users;
create policy users_update_own on public.users
for update to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

-- Books
DROP POLICY IF EXISTS books_select_all_authenticated ON public.books;
create policy books_select_all_authenticated on public.books
for select to authenticated
using (true);

DROP POLICY IF EXISTS books_insert_authenticated ON public.books;
create policy books_insert_authenticated on public.books
for insert to authenticated
with check (true);

DROP POLICY IF EXISTS books_update_authenticated ON public.books;
create policy books_update_authenticated on public.books
for update to authenticated
using (true)
with check (true);

-- Follows
DROP POLICY IF EXISTS follows_select_all_authenticated ON public.follows;
create policy follows_select_all_authenticated on public.follows
for select to authenticated
using (true);

DROP POLICY IF EXISTS follows_insert_own ON public.follows;
create policy follows_insert_own on public.follows
for insert to authenticated
with check (
  exists (
    select 1 from public.users u
    where u.id = follower_id and u.auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS follows_delete_own ON public.follows;
create policy follows_delete_own on public.follows
for delete to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = follower_id and u.auth_user_id = auth.uid()
  )
);

-- Ratings
DROP POLICY IF EXISTS ratings_select_all_authenticated ON public.ratings;
create policy ratings_select_all_authenticated on public.ratings
for select to authenticated
using (true);

DROP POLICY IF EXISTS ratings_write_own ON public.ratings;
create policy ratings_write_own on public.ratings
for all to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = user_id and u.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.id = user_id and u.auth_user_id = auth.uid()
  )
);

-- Book statuses
DROP POLICY IF EXISTS book_statuses_select_all_authenticated ON public.book_statuses;
create policy book_statuses_select_all_authenticated on public.book_statuses
for select to authenticated
using (true);

DROP POLICY IF EXISTS book_statuses_write_own ON public.book_statuses;
create policy book_statuses_write_own on public.book_statuses
for all to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = user_id and u.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.id = user_id and u.auth_user_id = auth.uid()
  )
);

-- Pairwise comparisons
DROP POLICY IF EXISTS pairwise_select_own ON public.pairwise_comparisons;
create policy pairwise_select_own on public.pairwise_comparisons
for select to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = user_id and u.auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS pairwise_insert_own ON public.pairwise_comparisons;
create policy pairwise_insert_own on public.pairwise_comparisons
for insert to authenticated
with check (
  exists (
    select 1 from public.users u
    where u.id = user_id and u.auth_user_id = auth.uid()
  )
);

-- Activities
DROP POLICY IF EXISTS activities_select_all_authenticated ON public.activities;
create policy activities_select_all_authenticated on public.activities
for select to authenticated
using (true);

DROP POLICY IF EXISTS activities_insert_own ON public.activities;
create policy activities_insert_own on public.activities
for insert to authenticated
with check (
  exists (
    select 1 from public.users u
    where u.id = actor_user_id and u.auth_user_id = auth.uid()
  )
);
