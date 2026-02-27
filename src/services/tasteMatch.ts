import { supabase } from '../lib/supabase';
import { getAppUserId } from './userProfile';

export type TasteMatchResult = {
  percentage: number | null;
  overlapCount: number;
};

type TasteMatchRow = {
  percentage: number | null;
  overlap_count: number | null;
};

type TasteMatchBatchRow = TasteMatchRow & {
  other_user_id: string;
};

function normalizeTasteMatchRow(row: TasteMatchRow): TasteMatchResult {
  return {
    percentage: row.percentage,
    overlapCount: row.overlap_count ?? 0,
  };
}

export async function getTasteMatchBetweenAppUsers(
  baseAppUserId: string,
  otherAppUserId: string,
): Promise<TasteMatchResult> {
  const response = await supabase
    .rpc('taste_match_percentage', {
      user_a: baseAppUserId,
      user_b: otherAppUserId,
    })
    .single();

  if (response.error) {
    throw new Error(response.error.message);
  }

  return normalizeTasteMatchRow(response.data as TasteMatchRow);
}

export async function getTasteMatchForUser(authUserId: string, targetAppUserId: string): Promise<TasteMatchResult> {
  const viewerAppUserId = await getAppUserId(authUserId);
  return getTasteMatchBetweenAppUsers(viewerAppUserId, targetAppUserId);
}

export async function getTasteMatchMapForUser(
  authUserId: string,
  targetAppUserIds: string[],
): Promise<Map<string, TasteMatchResult>> {
  if (targetAppUserIds.length === 0) {
    return new Map();
  }

  const viewerAppUserId = await getAppUserId(authUserId);

  const response = await supabase.rpc('taste_match_percentages', {
    base_user_id: viewerAppUserId,
    other_user_ids: targetAppUserIds,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  const rows = (response.data ?? []) as TasteMatchBatchRow[];

  return new Map(
    rows.map((row) => [
      row.other_user_id,
      normalizeTasteMatchRow({
        percentage: row.percentage,
        overlap_count: row.overlap_count,
      }),
    ]),
  );
}
