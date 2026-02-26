import { supabase } from '../lib/supabase';
import { trackEvent } from './analytics';
import { getAppUserId } from './userProfile';
import type { ReadingStatus, Sentiment } from '../types/feed';

export type SuggestedUser = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  isFollowing: boolean;
  ratingsCount: number;
};

export type SocialActivity = {
  id: string;
  activityType: 'Rated' | 'StatusChanged' | 'Added';
  createdAt: string;
  sentiment?: Sentiment;
  readingStatus?: ReadingStatus;
  book?: {
    id: string;
    title: string;
    author: string;
    coverUrl?: string;
  };
};

export type UserProfileView = {
  appUserId: string;
  displayName: string;
  avatarUrl?: string;
  followersCount: number;
  followingCount: number;
  ratingsCount: number;
  booksReadCount: number;
  booksWantToTryCount: number;
  isFollowing: boolean;
  recentActivity: SocialActivity[];
};

export type ConnectionUser = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  isFollowing: boolean;
};

export async function followUser(authUserId: string, followeeId: string): Promise<void> {
  const followerId = await getAppUserId(authUserId);

  const { error } = await supabase
    .from('follows')
    .insert({
      follower_id: followerId,
      followee_id: followeeId,
    });

  if (error && error.code !== '23505') {
    throw new Error(error.message);
  }

  await trackEvent({
    event: 'user_followed',
    authUserId,
    appUserId: followerId,
    properties: {
      target_user_id: followeeId,
    },
  });
}

export async function unfollowUser(authUserId: string, followeeId: string): Promise<void> {
  const followerId = await getAppUserId(authUserId);

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId);

  if (error) {
    throw new Error(error.message);
  }

  await trackEvent({
    event: 'user_unfollowed',
    authUserId,
    appUserId: followerId,
    properties: {
      target_user_id: followeeId,
    },
  });
}

export async function getSuggestedUsers(authUserId: string, limit = 20): Promise<SuggestedUser[]> {
  const selfAppUserId = await getAppUserId(authUserId);

  const usersResult = await supabase
    .from('users')
    .select('id,display_name,avatar_url')
    .neq('id', selfAppUserId)
    .limit(Math.max(limit, 25));

  if (usersResult.error) {
    throw new Error(usersResult.error.message);
  }

  const candidates = usersResult.data ?? [];
  if (candidates.length === 0) {
    return [];
  }

  const candidateIds = candidates.map((user) => user.id);

  const [followingResult, ratingsResult] = await Promise.all([
    supabase
      .from('follows')
      .select('followee_id')
      .eq('follower_id', selfAppUserId)
      .in('followee_id', candidateIds),
    supabase
      .from('ratings')
      .select('user_id')
      .in('user_id', candidateIds),
  ]);

  if (followingResult.error) {
    throw new Error(followingResult.error.message);
  }

  if (ratingsResult.error) {
    throw new Error(ratingsResult.error.message);
  }

  const followingSet = new Set((followingResult.data ?? []).map((row) => row.followee_id));

  const ratingCounts = new Map<string, number>();
  for (const row of ratingsResult.data ?? []) {
    ratingCounts.set(row.user_id, (ratingCounts.get(row.user_id) ?? 0) + 1);
  }

  return candidates
    .map((candidate) => ({
      id: candidate.id,
      displayName: candidate.display_name,
      avatarUrl: candidate.avatar_url ?? undefined,
      isFollowing: followingSet.has(candidate.id),
      ratingsCount: ratingCounts.get(candidate.id) ?? 0,
    }))
    .sort((a, b) => {
      if (a.isFollowing !== b.isFollowing) {
        return a.isFollowing ? 1 : -1;
      }
      return b.ratingsCount - a.ratingsCount;
    })
    .slice(0, limit);
}

async function countBy(table: string, filters: Array<[string, string]>): Promise<number> {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  for (const [column, value] of filters) {
    query = query.eq(column, value);
  }

  const result = await query;
  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.count ?? 0;
}

export async function getUserProfileView(
  authUserId: string,
  targetAppUserId: string,
): Promise<UserProfileView> {
  const viewerAppUserId = await getAppUserId(authUserId);

  const [userResult, relationResult, followersCount, followingCount, ratingsCount, readCount, wantCount] =
    await Promise.all([
      supabase
        .from('users')
        .select('id,display_name,avatar_url')
        .eq('id', targetAppUserId)
        .single(),
      supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', viewerAppUserId)
        .eq('followee_id', targetAppUserId)
        .maybeSingle(),
      countBy('follows', [['followee_id', targetAppUserId]]),
      countBy('follows', [['follower_id', targetAppUserId]]),
      countBy('ratings', [['user_id', targetAppUserId]]),
      countBy('book_statuses', [
        ['user_id', targetAppUserId],
        ['status', 'Read'],
      ]),
      countBy('book_statuses', [
        ['user_id', targetAppUserId],
        ['status', 'WantToRead'],
      ]),
    ]);

  if (userResult.error) {
    throw new Error(userResult.error.message);
  }
  if (relationResult.error) {
    throw new Error(relationResult.error.message);
  }

  const activityResult = await supabase
    .from('activities')
    .select(
      'id,activity_type,created_at,book:books(id,title,author,cover_url),rating:ratings(sentiment),status:book_statuses(status)',
    )
    .eq('actor_user_id', targetAppUserId)
    .order('created_at', { ascending: false })
    .limit(15);

  if (activityResult.error) {
    throw new Error(activityResult.error.message);
  }

  const recentActivity: SocialActivity[] = (activityResult.data ?? []).map((row) => {
    const relatedBook = Array.isArray(row.book) ? row.book[0] : row.book;
    const relatedRating = Array.isArray(row.rating) ? row.rating[0] : row.rating;
    const relatedStatus = Array.isArray(row.status) ? row.status[0] : row.status;

    return {
      id: row.id,
      activityType: row.activity_type,
      createdAt: row.created_at,
      sentiment: relatedRating?.sentiment,
      readingStatus: relatedStatus?.status,
      book: relatedBook
        ? {
            id: relatedBook.id,
            title: relatedBook.title,
            author: relatedBook.author,
            coverUrl: relatedBook.cover_url ?? undefined,
          }
        : undefined,
    };
  });

  return {
    appUserId: userResult.data.id,
    displayName: userResult.data.display_name,
    avatarUrl: userResult.data.avatar_url ?? undefined,
    followersCount,
    followingCount,
    ratingsCount,
    booksReadCount: readCount,
    booksWantToTryCount: wantCount,
    isFollowing: Boolean(relationResult.data),
    recentActivity,
  };
}

export async function getConnections(
  authUserId: string,
  targetAppUserId: string,
  kind: 'followers' | 'following',
): Promise<ConnectionUser[]> {
  const viewerAppUserId = await getAppUserId(authUserId);

  let userIds: string[] = [];

  if (kind === 'followers') {
    const edgesResult = await supabase
      .from('follows')
      .select('follower_id')
      .eq('followee_id', targetAppUserId);

    if (edgesResult.error) {
      throw new Error(edgesResult.error.message);
    }

    userIds = (edgesResult.data ?? []).map((row) => row.follower_id);
  } else {
    const edgesResult = await supabase
      .from('follows')
      .select('followee_id')
      .eq('follower_id', targetAppUserId);

    if (edgesResult.error) {
      throw new Error(edgesResult.error.message);
    }

    userIds = (edgesResult.data ?? []).map((row) => row.followee_id);
  }

  if (userIds.length === 0) {
    return [];
  }

  const [usersResult, followingResult] = await Promise.all([
    supabase.from('users').select('id,display_name,avatar_url').in('id', userIds),
    supabase.from('follows').select('followee_id').eq('follower_id', viewerAppUserId).in('followee_id', userIds),
  ]);

  if (usersResult.error) {
    throw new Error(usersResult.error.message);
  }
  if (followingResult.error) {
    throw new Error(followingResult.error.message);
  }

  const followingSet = new Set((followingResult.data ?? []).map((row) => row.followee_id));

  return (usersResult.data ?? []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? undefined,
    isFollowing: followingSet.has(row.id),
  }));
}
