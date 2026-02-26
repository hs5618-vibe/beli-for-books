import { getAppUserId } from './userProfile';
import { supabase } from '../lib/supabase';

export const ONBOARDING_RATINGS_TARGET = 5;
export const ONBOARDING_FOLLOWS_TARGET = 5;

export type OnboardingProgress = {
  ratingsCount: number;
  followingCount: number;
  ratingsTarget: number;
  followsTarget: number;
  isComplete: boolean;
};

export async function getOnboardingProgress(authUserId: string): Promise<OnboardingProgress> {
  const appUserId = await getAppUserId(authUserId);

  const [ratingsResult, followsResult] = await Promise.all([
    supabase
      .from('ratings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', appUserId),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', appUserId),
  ]);

  if (ratingsResult.error) {
    throw new Error(ratingsResult.error.message);
  }

  if (followsResult.error) {
    throw new Error(followsResult.error.message);
  }

  const ratingsCount = ratingsResult.count ?? 0;
  const followingCount = followsResult.count ?? 0;

  return {
    ratingsCount,
    followingCount,
    ratingsTarget: ONBOARDING_RATINGS_TARGET,
    followsTarget: ONBOARDING_FOLLOWS_TARGET,
    isComplete: ratingsCount >= ONBOARDING_RATINGS_TARGET && followingCount >= ONBOARDING_FOLLOWS_TARGET,
  };
}
