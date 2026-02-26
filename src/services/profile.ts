import { supabase } from '../lib/supabase';
import type { BookSummary } from '../types/book';
import { getOrCreateAppUser } from './userProfile';

type CountResult = {
  count: number;
};

export type ProfileActivity = {
  id: string;
  activityType: 'Rated' | 'StatusChanged' | 'Added';
  createdAt: string;
  book?: BookSummary;
};

export type ProfileRecommendation = BookSummary & {
  lovedByCount: number;
};

export type ProfileDashboard = {
  appUserId: string;
  displayName: string;
  avatarUrl?: string;
  followersCount: number;
  followingCount: number;
  booksReadCount: number;
  booksWantToTryCount: number;
  ratingsCount: number;
  rank: number | null;
  rankPopulation: number;
  streakWeeks: number;
  recentActivity: ProfileActivity[];
  recommendations: ProfileRecommendation[];
};

type ActivityRow = {
  id: string;
  activity_type: 'Rated' | 'StatusChanged' | 'Added';
  created_at: string;
  book: Array<{
    id: string;
    title: string;
    author: string;
    cover_url: string | null;
  }> | null;
};

function countFromResponse(result: CountResult | null): number {
  return result?.count ?? 0;
}

function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-${weekNo}`;
}

function previousWeekKey(currentKey: string): string {
  const [year, week] = currentKey.split('-').map((v) => Number(v));
  const approxDate = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  approxDate.setUTCDate(approxDate.getUTCDate() - 7);
  return weekKey(approxDate);
}

function computeStreakWeeks(activityDates: string[]): number {
  if (activityDates.length === 0) {
    return 0;
  }

  const uniqueWeeks = new Set(activityDates.map((isoDate) => weekKey(new Date(isoDate))));

  let streak = 0;
  let cursor = weekKey(new Date());

  while (uniqueWeeks.has(cursor)) {
    streak += 1;
    cursor = previousWeekKey(cursor);
  }

  return streak;
}

async function fetchCount(table: string, filters: Array<[string, string | number]>): Promise<number> {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });

  for (const [column, value] of filters) {
    query = query.eq(column, value);
  }

  const response = await query;

  if (response.error) {
    throw new Error(response.error.message);
  }

  return countFromResponse({ count: response.count ?? 0 });
}

async function computeRank(appUserId: string): Promise<{ rank: number | null; population: number }> {
  const { data, error } = await supabase.from('ratings').select('user_id');

  if (error) {
    throw new Error(error.message);
  }

  const countsByUser = new Map<string, number>();
  for (const row of data ?? []) {
    countsByUser.set(row.user_id, (countsByUser.get(row.user_id) ?? 0) + 1);
  }

  const population = countsByUser.size;

  if (!countsByUser.has(appUserId)) {
    return { rank: null, population };
  }

  const sorted = [...countsByUser.entries()].sort((a, b) => b[1] - a[1]);
  const index = sorted.findIndex(([userId]) => userId === appUserId);

  return {
    rank: index >= 0 ? index + 1 : null,
    population,
  };
}

async function fetchRecentActivity(appUserId: string): Promise<ProfileActivity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('id,activity_type,created_at,book:books(id,title,author,cover_url)')
    .eq('actor_user_id', appUserId)
    .order('created_at', { ascending: false })
    .limit(12);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ActivityRow[];

  return rows.map((row) => {
    const relatedBook = row.book?.[0];

    return {
      id: row.id,
      activityType: row.activity_type,
      createdAt: row.created_at,
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
}

async function fetchRecommendations(appUserId: string): Promise<ProfileRecommendation[]> {
  const userRatingsResponse = await supabase.from('ratings').select('book_id').eq('user_id', appUserId);

  if (userRatingsResponse.error) {
    throw new Error(userRatingsResponse.error.message);
  }

  const excludedBookIds = new Set((userRatingsResponse.data ?? []).map((row) => row.book_id));

  const lovedResponse = await supabase
    .from('ratings')
    .select('book_id')
    .eq('sentiment', 'Loved')
    .neq('user_id', appUserId)
    .limit(200);

  if (lovedResponse.error) {
    throw new Error(lovedResponse.error.message);
  }

  const lovedCounts = new Map<string, number>();
  for (const row of lovedResponse.data ?? []) {
    if (excludedBookIds.has(row.book_id)) {
      continue;
    }

    lovedCounts.set(row.book_id, (lovedCounts.get(row.book_id) ?? 0) + 1);
  }

  const topBookIds = [...lovedCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([bookId]) => bookId);

  if (topBookIds.length === 0) {
    return [];
  }

  const booksResponse = await supabase
    .from('books')
    .select('id,title,author,cover_url')
    .in('id', topBookIds);

  if (booksResponse.error) {
    throw new Error(booksResponse.error.message);
  }

  const booksById = new Map<string, ProfileRecommendation>();
  for (const row of booksResponse.data ?? []) {
    booksById.set(row.id, {
      id: row.id,
      title: row.title,
      author: row.author,
      coverUrl: row.cover_url ?? undefined,
      lovedByCount: lovedCounts.get(row.id) ?? 0,
    });
  }

  return topBookIds
    .map((bookId) => booksById.get(bookId))
    .filter((book): book is ProfileRecommendation => Boolean(book));
}

export async function getProfileDashboard(authUserId: string): Promise<ProfileDashboard> {
  const profile = await getOrCreateAppUser(authUserId);

  const [
    followersCount,
    followingCount,
    booksReadCount,
    booksWantToTryCount,
    ratingsCount,
    rankResult,
    recentActivity,
    recommendations,
  ] = await Promise.all([
    fetchCount('follows', [['followee_id', profile.id]]),
    fetchCount('follows', [['follower_id', profile.id]]),
    fetchCount('book_statuses', [
      ['user_id', profile.id],
      ['status', 'Read'],
    ]),
    fetchCount('book_statuses', [
      ['user_id', profile.id],
      ['status', 'WantToRead'],
    ]),
    fetchCount('ratings', [['user_id', profile.id]]),
    computeRank(profile.id),
    fetchRecentActivity(profile.id),
    fetchRecommendations(profile.id),
  ]);

  const streakWeeks = computeStreakWeeks(recentActivity.map((item) => item.createdAt));

  return {
    appUserId: profile.id,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    followersCount,
    followingCount,
    booksReadCount,
    booksWantToTryCount,
    ratingsCount,
    rank: rankResult.rank,
    rankPopulation: rankResult.population,
    streakWeeks,
    recentActivity,
    recommendations,
  };
}

export async function updateOwnProfile(params: {
  authUserId: string;
  displayName: string;
  avatarUrl?: string;
}): Promise<void> {
  const profile = await getOrCreateAppUser(params.authUserId);

  const { error } = await supabase
    .from('users')
    .update({
      display_name: params.displayName.trim(),
      avatar_url: params.avatarUrl?.trim() || null,
    })
    .eq('id', profile.id);

  if (error) {
    throw new Error(error.message);
  }
}

export function profileShareUrl(appUserId: string): string {
  return `https://beli-books.app/u/${appUserId}`;
}
