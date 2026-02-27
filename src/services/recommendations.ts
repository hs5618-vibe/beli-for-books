import type { BookSummary } from '../types/book';
import { supabase } from '../lib/supabase';
import { getAppUserId } from './userProfile';

export type Recommendation = BookSummary & {
  score: number;
  reason: string;
};

type RecommendationRow = {
  book_id: string;
  title: string;
  author: string;
  cover_url: string | null;
  score: number;
  reason: string;
};

export async function getRecommendationsForUser(authUserId: string): Promise<Recommendation[]> {
  const appUserId = await getAppUserId(authUserId);

  const response = await supabase.rpc('get_recommendations_for_user', {
    target_user_id: appUserId,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  const rows = Array.isArray(response.data) ? (response.data as RecommendationRow[]) : [];

  return rows.map((row) => ({
    id: row.book_id,
    title: row.title,
    author: row.author,
    coverUrl: row.cover_url ?? undefined,
    score: row.score,
    reason: row.reason,
  }));
}
