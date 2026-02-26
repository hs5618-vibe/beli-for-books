import type { FeedItem, FeedItemBook, FeedItemUser } from '../types/feed';
import { supabase } from '../lib/supabase';
import { getAppUserId } from './userProfile';

type ActivityRow = {
  id: string;
  actor_user_id: string;
  book_id: string;
  activity_type: 'Rated' | 'StatusChanged' | 'Added';
  rating_id: string | null;
  status_id: string | null;
  created_at: string;
};

type FeedPageParams = {
  authUserId: string;
  limit?: number;
  cursor?: string | null;
};

export type FeedPage = {
  items: FeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

const DEFAULT_PAGE_SIZE = 12;
const NOISE_WINDOW_MS = 2 * 60 * 1000;

function dedupeNoisyActivities(activities: ActivityRow[]): ActivityRow[] {
  const seenByKey = new Map<string, number>();
  const result: ActivityRow[] = [];

  for (const activity of activities) {
    const key = `${activity.actor_user_id}:${activity.book_id}:${activity.activity_type}`;
    const currentTimestamp = new Date(activity.created_at).getTime();
    const previousTimestamp = seenByKey.get(key);

    if (previousTimestamp !== undefined && previousTimestamp - currentTimestamp <= NOISE_WINDOW_MS) {
      continue;
    }

    seenByKey.set(key, currentTimestamp);
    result.push(activity);
  }

  return result;
}

export async function getFeedPage(params: FeedPageParams): Promise<FeedPage> {
  const pageSize = params.limit ?? DEFAULT_PAGE_SIZE;
  const selfAppUserId = await getAppUserId(params.authUserId);

  const followsResult = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', selfAppUserId);

  if (followsResult.error) {
    throw new Error(followsResult.error.message);
  }

  const followedIds = (followsResult.data ?? []).map((row) => row.followee_id);
  if (followedIds.length === 0) {
    return {
      items: [],
      nextCursor: null,
      hasMore: false,
    };
  }

  let activityQuery = supabase
    .from('activities')
    .select('id,actor_user_id,book_id,activity_type,rating_id,status_id,created_at')
    .in('actor_user_id', followedIds)
    .order('created_at', { ascending: false })
    .limit(pageSize + 1);

  if (params.cursor) {
    activityQuery = activityQuery.lt('created_at', params.cursor);
  }

  const activitiesResult = await activityQuery;

  if (activitiesResult.error) {
    throw new Error(activitiesResult.error.message);
  }

  const activities = (activitiesResult.data ?? []) as ActivityRow[];
  if (activities.length === 0) {
    return {
      items: [],
      nextCursor: null,
      hasMore: false,
    };
  }

  const hasMore = activities.length > pageSize;
  const pageActivities = dedupeNoisyActivities(activities.slice(0, pageSize));

  if (pageActivities.length === 0) {
    return {
      items: [],
      nextCursor: hasMore ? activities[activities.length - 1]?.created_at ?? null : null,
      hasMore,
    };
  }

  const actorIds = [...new Set(pageActivities.map((row) => row.actor_user_id))];
  const bookIds = [...new Set(pageActivities.map((row) => row.book_id))];
  const ratingIds = [
    ...new Set(pageActivities.map((row) => row.rating_id).filter((value): value is string => Boolean(value))),
  ];
  const statusIds = [
    ...new Set(pageActivities.map((row) => row.status_id).filter((value): value is string => Boolean(value))),
  ];

  const [usersResult, booksResult, ratingsResult, statusesResult] = await Promise.all([
    supabase.from('users').select('id,display_name,avatar_url').in('id', actorIds),
    supabase.from('books').select('id,title,author,cover_url').in('id', bookIds),
    ratingIds.length > 0
      ? supabase
          .from('ratings')
          .select('id,sentiment,numeric_score,note,is_note_private,user_id')
          .in('id', ratingIds)
      : Promise.resolve({ data: [], error: null }),
    statusIds.length > 0
      ? supabase.from('book_statuses').select('id,status').in('id', statusIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (usersResult.error) {
    throw new Error(usersResult.error.message);
  }

  if (booksResult.error) {
    throw new Error(booksResult.error.message);
  }

  if (ratingsResult.error) {
    throw new Error(ratingsResult.error.message);
  }

  if (statusesResult.error) {
    throw new Error(statusesResult.error.message);
  }

  const usersById = new Map<string, FeedItemUser>(
    (usersResult.data ?? []).map((row) => [
      row.id,
      {
        id: row.id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url ?? undefined,
      },
    ]),
  );

  const booksById = new Map<string, FeedItemBook>(
    (booksResult.data ?? []).map((row) => [
      row.id,
      {
        id: row.id,
        title: row.title,
        author: row.author,
        coverUrl: row.cover_url ?? undefined,
      },
    ]),
  );

  const ratingsById = new Map(
    (ratingsResult.data ?? []).map((row) => [
      row.id,
      {
        sentiment: row.sentiment,
        numericScore: row.numeric_score,
        note: row.note,
        isNotePrivate: row.is_note_private,
      },
    ]),
  );

  const statusesById = new Map((statusesResult.data ?? []).map((row) => [row.id, row.status]));

  const items = pageActivities
    .map((activity) => {
      const user = usersById.get(activity.actor_user_id);
      const book = booksById.get(activity.book_id);

      if (!user || !book) {
        return null;
      }

      const rating = activity.rating_id ? ratingsById.get(activity.rating_id) : undefined;
      const status = activity.status_id ? statusesById.get(activity.status_id) : undefined;

      return {
        id: activity.id,
        user,
        book,
        activityType: activity.activity_type,
        sentiment: rating?.sentiment,
        numericScore: rating?.numericScore,
        notePreview: rating?.isNotePrivate ? undefined : rating?.note ?? undefined,
        readingStatus: status,
        createdAt: activity.created_at,
      } as FeedItem;
    })
    .filter((item): item is FeedItem => Boolean(item));

  return {
    items,
    hasMore,
    nextCursor: hasMore
      ? activities[Math.min(pageSize, activities.length) - 1]?.created_at ?? null
      : null,
  };
}
