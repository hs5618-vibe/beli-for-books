-- Taste match functions for Beli for Books.
-- Similarity is based on overlapping books and normalized score difference on a 0-10 scale.

create or replace function public.taste_match_percentage(user_a uuid, user_b uuid)
returns table (
  percentage integer,
  overlap_count integer
)
language sql
stable
as $$
  with overlap as (
    select
      r1.book_id,
      r1.numeric_score as score_a,
      r2.numeric_score as score_b
    from public.ratings r1
    inner join public.ratings r2
      on r1.book_id = r2.book_id
    where r1.user_id = user_a
      and r2.user_id = user_b
  ),
  aggregate_scores as (
    select
      count(*)::int as overlap_count,
      avg(1 - (abs(score_a - score_b) / 10.0)) as similarity
    from overlap
  )
  select
    case
      when overlap_count = 0 then null
      else round(greatest(0, least(1, similarity)) * 100)::int
    end as percentage,
    overlap_count
  from aggregate_scores;
$$;

create or replace function public.taste_match_percentages(base_user_id uuid, other_user_ids uuid[])
returns table (
  other_user_id uuid,
  percentage integer,
  overlap_count integer
)
language sql
stable
as $$
  select
    other_id as other_user_id,
    tm.percentage,
    tm.overlap_count
  from unnest(other_user_ids) as other_id
  left join lateral public.taste_match_percentage(base_user_id, other_id) tm
    on true;
$$;

grant execute on function public.taste_match_percentage(uuid, uuid) to authenticated;
grant execute on function public.taste_match_percentages(uuid, uuid[]) to authenticated;
