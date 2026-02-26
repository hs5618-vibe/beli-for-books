import { supabase } from '../lib/supabase';
import { getAppUserId } from './userProfile';

export type SuggestedUser = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  isFollowing: boolean;
  ratingsCount: number;
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
