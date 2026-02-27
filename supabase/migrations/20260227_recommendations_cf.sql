-- Instant collaborative-filtering recommendations after rating submission.
-- Tuning knobs:
--   neighbors K = 20
--   min overlap = 3 books
--   min taste match = 60
--   top N recommendations = 3

create index if not exists idx_ratings_user_id on public.ratings (user_id);
create index if not exists idx_ratings_book_id on public.ratings (book_id);
create index if not exists idx_ratings_created_at on public.ratings (created_at desc);

create or replace function public.get_recommendations_for_user(target_user_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  result jsonb;
  user_rating_count integer;
begin
  select count(*)::int
  into user_rating_count
  from public.ratings r
  where r.user_id = target_user_id;

  with
  rated_by_user as (
    select r.book_id
    from public.ratings r
    where r.user_id = target_user_id
  ),
  neighbors as (
    select
      u.id as neighbor_user_id,
      u.display_name,
      tm.percentage as taste_match,
      tm.overlap_count
    from public.users u
    join lateral public.taste_match_percentage(target_user_id, u.id) tm
      on true
    where u.id <> target_user_id
      and tm.overlap_count >= 3
      and tm.percentage >= 60
    order by tm.percentage desc
    limit 20
  ),
  neighbor_positive as (
    select
      n.neighbor_user_id,
      n.display_name,
      n.taste_match,
      n.overlap_count,
      r.book_id,
      r.created_at,
      r.sentiment,
      r.numeric_score,
      case
        when r.sentiment = 'Loved' then 1.0
        when r.sentiment = 'Liked' then 0.6
        else greatest(0, least(1, r.numeric_score / 10.0))
      end as rating_weight,
      (n.taste_match / 100.0) *
      case
        when r.sentiment = 'Loved' then 1.0
        when r.sentiment = 'Liked' then 0.6
        else greatest(0, least(1, r.numeric_score / 10.0))
      end as contribution
    from neighbors n
    join public.ratings r
      on r.user_id = n.neighbor_user_id
    left join rated_by_user ru
      on ru.book_id = r.book_id
    where ru.book_id is null
      and (
        r.sentiment in ('Loved', 'Liked')
        or r.numeric_score >= 7
      )
  ),
  candidate_scored as (
    select
      np.book_id,
      sum(np.contribution) as score,
      count(distinct np.neighbor_user_id)::int as distinct_neighbors,
      max(np.created_at) as latest_positive_at
    from neighbor_positive np
    group by np.book_id
  ),
  top_candidates as (
    select
      cs.book_id,
      cs.score,
      cs.distinct_neighbors,
      cs.latest_positive_at
    from candidate_scored cs
    order by
      cs.score desc,
      cs.distinct_neighbors desc,
      cs.latest_positive_at desc
    limit 3
  ),
  top_reason_neighbors as (
    select
      tc.book_id,
      np.display_name,
      np.taste_match,
      np.contribution,
      row_number() over (
        partition by tc.book_id
        order by np.contribution desc, np.created_at desc
      ) as rn
    from top_candidates tc
    join neighbor_positive np
      on np.book_id = tc.book_id
  ),
  top_reason_agg as (
    select
      trn.book_id,
      case
        when count(*) = 0 then 'Loved by similar readers'
        when count(*) = 1 then
          format('Loved by %s (%s%% match)', min(trn.display_name), min(trn.taste_match))
        else
          format(
            'Loved by %s (%s%% match) and %s (%s%% match)',
            max(case when trn.rn = 1 then trn.display_name end),
            max(case when trn.rn = 1 then trn.taste_match::text end),
            max(case when trn.rn = 2 then trn.display_name end),
            max(case when trn.rn = 2 then trn.taste_match::text end)
          )
      end as reason
    from top_reason_neighbors trn
    where trn.rn <= 2
    group by trn.book_id
  ),
  neighbor_output as (
    select
      tc.book_id,
      b.title,
      b.author,
      b.cover_url,
      round(tc.score::numeric, 4) as score,
      tra.reason,
      tc.distinct_neighbors,
      tc.latest_positive_at
    from top_candidates tc
    join public.books b
      on b.id = tc.book_id
    left join top_reason_agg tra
      on tra.book_id = tc.book_id
  ),
  follows as (
    select f.followee_id
    from public.follows f
    where f.follower_id = target_user_id
  ),
  trending_positive as (
    select
      r.book_id,
      count(*)::int as positives_count,
      max(r.created_at) as latest_positive_at
    from public.ratings r
    left join rated_by_user ru
      on ru.book_id = r.book_id
    where ru.book_id is null
      and r.created_at >= now() - interval '14 days'
      and (
        r.sentiment in ('Loved', 'Liked')
        or r.numeric_score >= 7
      )
      and (
        exists (select 1 from follows)
          and r.user_id in (select followee_id from follows)
        or not exists (select 1 from follows)
      )
    group by r.book_id
    order by positives_count desc, latest_positive_at desc
    limit 3
  ),
  trending_output as (
    select
      tp.book_id,
      b.title,
      b.author,
      b.cover_url,
      tp.positives_count::numeric as score,
      'Popular this week'::text as reason,
      tp.positives_count as distinct_neighbors,
      tp.latest_positive_at
    from trending_positive tp
    join public.books b
      on b.id = tp.book_id
  ),
  base_rows as (
    select *
    from (
      select * from neighbor_output
      where user_rating_count >= 5 and exists (select 1 from neighbors)
      union all
      select * from trending_output
      where user_rating_count < 5 or not exists (select 1 from neighbors)
    ) q
    order by score desc, distinct_neighbors desc, latest_positive_at desc
    limit 3
  ),
  fallback_rows as (
    select
      b.id as book_id,
      b.title,
      b.author,
      b.cover_url,
      0::numeric as score,
      'Popular this week'::text as reason,
      0::int as distinct_neighbors,
      b.created_at as latest_positive_at
    from public.books b
    left join rated_by_user ru
      on ru.book_id = b.id
    left join base_rows br
      on br.book_id = b.id
    where ru.book_id is null
      and br.book_id is null
    order by b.created_at desc
    limit 3
  ),
  final_rows as (
    select *
    from (
      select * from base_rows
      union all
      select * from fallback_rows
    ) combined
    order by score desc, distinct_neighbors desc, latest_positive_at desc
    limit 3
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'book_id', fr.book_id,
        'title', fr.title,
        'author', fr.author,
        'cover_url', fr.cover_url,
        'score', fr.score,
        'reason', fr.reason
      )
      order by fr.score desc, fr.distinct_neighbors desc, fr.latest_positive_at desc
    ),
    '[]'::jsonb
  )
  into result
  from final_rows fr;

  return result;
end;
$$;

grant execute on function public.get_recommendations_for_user(uuid) to authenticated;
