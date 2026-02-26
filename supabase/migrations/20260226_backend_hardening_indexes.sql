-- Backend hardening: indexes for feed, social graph, book detail, and analytics hot paths.

create index if not exists idx_follows_follower_created
  on public.follows (follower_id, created_at desc);

create index if not exists idx_ratings_book_created
  on public.ratings (book_id, created_at desc);

create index if not exists idx_ratings_book_score
  on public.ratings (book_id, numeric_score desc);

create index if not exists idx_book_statuses_book_created
  on public.book_statuses (book_id, created_at desc);

create index if not exists idx_activities_book_created
  on public.activities (book_id, created_at desc);

create index if not exists idx_activities_actor_book_created
  on public.activities (actor_user_id, book_id, created_at desc);

create index if not exists idx_analytics_dedupe_key
  on public.analytics_events (dedupe_key)
  where dedupe_key is not null;
