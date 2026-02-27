-- Smoke test for public.get_recommendations_for_user(uuid)
-- Run manually in Supabase SQL editor.
-- This script inserts fixture data, validates key behaviors, then rolls back.

begin;

do $$
declare
  target_user uuid := '00000000-0000-0000-0000-000000000101';
  neighbor_a uuid := '00000000-0000-0000-0000-000000000102';
  neighbor_b uuid := '00000000-0000-0000-0000-000000000103';
  low_overlap uuid := '00000000-0000-0000-0000-000000000104';
  fallback_user uuid := '00000000-0000-0000-0000-000000000105';
  recs jsonb;
  fallback_recs jsonb;
  already_rated_hits integer;
begin
  insert into public.users (id, display_name) values
    (target_user, 'Target Reader'),
    (neighbor_a, 'Maya'),
    (neighbor_b, 'Sam'),
    (low_overlap, 'Low Overlap'),
    (fallback_user, 'Fallback User');

  insert into public.books (id, title, author, cover_url) values
    ('test-rec-b1', 'Overlap One', 'Author A', null),
    ('test-rec-b2', 'Overlap Two', 'Author A', null),
    ('test-rec-b3', 'Overlap Three', 'Author A', null),
    ('test-rec-b4', 'Overlap Four', 'Author A', null),
    ('test-rec-b5', 'Overlap Five', 'Author A', null),
    ('test-rec-c1', 'Candidate One', 'Author B', null),
    ('test-rec-c2', 'Candidate Two', 'Author B', null),
    ('test-rec-c3', 'Candidate Three', 'Author B', null),
    ('test-rec-t1', 'Trending One', 'Author C', null),
    ('test-rec-t2', 'Trending Two', 'Author C', null),
    ('test-rec-t3', 'Trending Three', 'Author C', null);

  -- Target user has >= 5 ratings.
  insert into public.ratings (user_id, book_id, sentiment, numeric_score, note, is_note_private) values
    (target_user, 'test-rec-b1', 'Loved', 9.0, null, false),
    (target_user, 'test-rec-b2', 'Liked', 7.0, null, false),
    (target_user, 'test-rec-b3', 'Liked', 7.0, null, false),
    (target_user, 'test-rec-b4', 'Okay', 5.0, null, false),
    (target_user, 'test-rec-b5', 'Loved', 9.0, null, false);

  -- Qualified neighbors (overlap >= 3 and high taste match).
  insert into public.ratings (user_id, book_id, sentiment, numeric_score, note, is_note_private) values
    (neighbor_a, 'test-rec-b1', 'Loved', 9.0, null, false),
    (neighbor_a, 'test-rec-b2', 'Liked', 7.0, null, false),
    (neighbor_a, 'test-rec-b3', 'Liked', 7.0, null, false),
    (neighbor_a, 'test-rec-c1', 'Loved', 9.0, null, false),
    (neighbor_a, 'test-rec-c2', 'Liked', 7.0, null, false),
    (neighbor_b, 'test-rec-b1', 'Loved', 9.0, null, false),
    (neighbor_b, 'test-rec-b2', 'Loved', 9.0, null, false),
    (neighbor_b, 'test-rec-b3', 'Liked', 7.0, null, false),
    (neighbor_b, 'test-rec-c1', 'Liked', 7.0, null, false),
    (neighbor_b, 'test-rec-c3', 'Loved', 9.0, null, false);

  -- Low-overlap user should be ignored.
  insert into public.ratings (user_id, book_id, sentiment, numeric_score, note, is_note_private) values
    (low_overlap, 'test-rec-b1', 'Loved', 9.0, null, false),
    (low_overlap, 'test-rec-c2', 'Loved', 9.0, null, false);

  recs := public.get_recommendations_for_user(target_user);

  if jsonb_array_length(recs) <> 3 then
    raise exception 'Expected 3 recommendations, got %', jsonb_array_length(recs);
  end if;

  select count(*)
  into already_rated_hits
  from jsonb_array_elements(recs) r
  join public.ratings rr
    on rr.book_id = r->>'book_id'
   and rr.user_id = target_user;

  if already_rated_hits <> 0 then
    raise exception 'Recommendations include already-rated books';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(recs) r
    where coalesce(r->>'reason', '') like '%match%'
  ) then
    raise exception 'Expected at least one reason to include taste-match explanation';
  end if;

  -- Fallback user has < 5 ratings. Should use "Popular this week".
  insert into public.ratings (user_id, book_id, sentiment, numeric_score, note, is_note_private) values
    (fallback_user, 'test-rec-b1', 'Liked', 7.0, null, false);

  -- Trending seed in last 14 days.
  insert into public.ratings (user_id, book_id, sentiment, numeric_score, note, is_note_private, created_at) values
    (neighbor_a, 'test-rec-t1', 'Loved', 9.0, null, false, now()),
    (neighbor_b, 'test-rec-t1', 'Liked', 7.0, null, false, now()),
    (neighbor_a, 'test-rec-t2', 'Loved', 9.0, null, false, now()),
    (neighbor_b, 'test-rec-t3', 'Loved', 9.0, null, false, now());

  fallback_recs := public.get_recommendations_for_user(fallback_user);

  if jsonb_array_length(fallback_recs) <> 3 then
    raise exception 'Fallback expected 3 recommendations, got %', jsonb_array_length(fallback_recs);
  end if;

  if exists (
    select 1
    from jsonb_array_elements(fallback_recs) r
    where coalesce(r->>'reason', '') <> 'Popular this week'
  ) then
    raise exception 'Fallback recommendations must use "Popular this week" reason';
  end if;
end
$$;

rollback;
