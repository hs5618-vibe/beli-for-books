import type { FeedActivityType, ReadingStatus, Sentiment } from '../types/feed';
import { supabase } from '../lib/supabase';
import { getAppUserId } from './userProfile';

export type FollowedBookActivity = {
  id: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  activityType: FeedActivityType;
  createdAt: string;
  sentiment?: Sentiment;
  numericScore?: number;
  notePreview?: string;
  readingStatus?: ReadingStatus;
};

export type BookDetailInsights = {
  averageScore: number | null;
  ratingsCount: number;
  followedActivity: FollowedBookActivity[];
};

type ActivityRow = {
  id: string;
  actor_user_id: string;
  activity_type: FeedActivityType;
  rating_id: string | null;
  status_id: string | null;
  created_at: string;
};

export async function getBookDetailInsights(
  authUserId: string,
  bookId: string,
): Promise<BookDetailInsights> {
  const appUserId = await getAppUserId(authUserId);

  const [ratingsResult, followsResult] = await Promise.all([
    supabase.from('ratings').select('numeric_score').eq('book_id', bookId),
    supabase.from('follows').select('followee_id').eq('follower_id', appUserId),
  ]);

  if (ratingsResult.error) {
    throw new Error(ratingsResult.error.message);
  }

  if (followsResult.error) {
    throw new Error(followsResult.error.message);
  }

  const scoreValues = (ratingsResult.data ?? []).map((row) => row.numeric_score);
  const ratingsCount = scoreValues.length;
  const averageScore =
    ratingsCount > 0
      ? Number((scoreValues.reduce((sum, value) => sum + value, 0) / ratingsCount).toFixed(1))
      : null;

  const followedIds = (followsResult.data ?? []).map((row) => row.followee_id);
  if (followedIds.length === 0) {
    return {
      averageScore,
      ratingsCount,
      followedActivity: [],
    };
  }

  const activityResult = await supabase
    .from('activities')
    .select('id,actor_user_id,activity_type,rating_id,status_id,created_at')
    .eq('book_id', bookId)
    .in('actor_user_id', followedIds)
    .order('created_at', { ascending: false })
    .limit(20);

  if (activityResult.error) {
    throw new Error(activityResult.error.message);
  }

  const activities = (activityResult.data ?? []) as ActivityRow[];
  if (activities.length === 0) {
    return {
      averageScore,
      ratingsCount,
      followedActivity: [],
    };
  }

  const actorIds = [...new Set(activities.map((row) => row.actor_user_id))];
  const ratingIds = [
    ...new Set(activities.map((row) => row.rating_id).filter((value): value is string => Boolean(value))),
  ];
  const statusIds = [
    ...new Set(activities.map((row) => row.status_id).filter((value): value is string => Boolean(value))),
  ];

  const [usersResult, detailRatingsResult, statusesResult] = await Promise.all([
    supabase.from('users').select('id,display_name,avatar_url').in('id', actorIds),
    ratingIds.length > 0
      ? supabase
          .from('ratings')
          .select('id,sentiment,numeric_score,note,is_note_private')
          .in('id', ratingIds)
      : Promise.resolve({ data: [], error: null }),
    statusIds.length > 0
      ? supabase.from('book_statuses').select('id,status').in('id', statusIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (usersResult.error) {
    throw new Error(usersResult.error.message);
  }
  if (detailRatingsResult.error) {
    throw new Error(detailRatingsResult.error.message);
  }
  if (statusesResult.error) {
    throw new Error(statusesResult.error.message);
  }

  const usersById = new Map<string, FollowedBookActivity['user']>(
    (usersResult.data ?? []).map((row) => [
      row.id,
      {
        id: row.id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url ?? undefined,
      },
    ]),
  );

  const ratingsById = new Map(
    (detailRatingsResult.data ?? []).map((row) => [
      row.id,
      {
        sentiment: row.sentiment as Sentiment | undefined,
        numericScore: row.numeric_score as number | undefined,
        notePreview: row.is_note_private ? undefined : row.note ?? undefined,
      },
    ]),
  );

  const statusesById = new Map(
    (statusesResult.data ?? []).map((row) => [row.id, row.status as ReadingStatus]),
  );

  const followedActivity: FollowedBookActivity[] = [];
  for (const activity of activities) {
    const user = usersById.get(activity.actor_user_id);
    if (!user) {
      continue;
    }

    const rating = activity.rating_id ? ratingsById.get(activity.rating_id) : undefined;
    const readingStatus = activity.status_id ? statusesById.get(activity.status_id) : undefined;

    followedActivity.push({
      id: activity.id,
      user,
      activityType: activity.activity_type,
      createdAt: activity.created_at,
      sentiment: rating?.sentiment,
      numericScore: rating?.numericScore,
      notePreview: rating?.notePreview,
      readingStatus,
    });
  }

  return {
    averageScore,
    ratingsCount,
    followedActivity,
  };
}
