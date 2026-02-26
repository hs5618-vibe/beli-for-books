-- MVP backend health and product checks

-- 1) Event volume by event name (last 7 days)
select event_name, count(*) as events_7d
from public.analytics_events
where created_at >= now() - interval '7 days'
group by event_name
order by events_7d desc;

-- 2) Onboarding completion proxy by app user
-- Completion definition in app: ratings >= 5
with ratings_per_user as (
  select user_id, count(*) as rating_count
  from public.ratings
  group by user_id
)
select
  count(*) filter (where rating_count >= 5) as users_completed_onboarding,
  count(*) as users_with_any_rating
from ratings_per_user;

-- 3) Feed activity volume (last 7 days)
select date_trunc('day', created_at) as day, count(*) as activity_count
from public.activities
where created_at >= now() - interval '7 days'
group by day
order by day;

-- 4) Follow graph basic stats
select
  count(*) as total_follow_edges,
  count(distinct follower_id) as users_following_someone,
  count(distinct followee_id) as users_with_followers
from public.follows;

-- 5) Private-note safety check in analytics payloads (should be only metadata)
select event_name, properties
from public.analytics_events
where event_name in ('note_added', 'note_marked_private')
order by created_at desc
limit 20;

-- 6) Ratings and statuses distribution
select sentiment, count(*) as count
from public.ratings
group by sentiment
order by count desc;

select status, count(*) as count
from public.book_statuses
group by status
order by count desc;
