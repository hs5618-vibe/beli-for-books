import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { getAppUserId } from './userProfile';

export type AnalyticsEventName =
  | 'account_created'
  | 'onboarding_books_completed'
  | 'onboarding_follows_completed'
  | 'book_rated'
  | 'note_added'
  | 'note_marked_private'
  | 'book_status_changed'
  | 'user_followed'
  | 'user_unfollowed'
  | 'feed_viewed'
  | 'book_detail_viewed'
  | 'profile_viewed'
  | 'book_searched';

type TrackParams = {
  event: AnalyticsEventName;
  authUserId?: string;
  appUserId?: string;
  properties?: Record<string, unknown>;
  dedupeKey?: string;
};

async function resolveAppUserId(params: TrackParams): Promise<string | null> {
  if (params.appUserId) {
    return params.appUserId;
  }

  if (!params.authUserId) {
    return null;
  }

  try {
    return await getAppUserId(params.authUserId);
  } catch {
    return null;
  }
}

export async function trackEvent(params: TrackParams): Promise<void> {
  if (!isSupabaseConfigured) {
    return;
  }

  const resolvedAppUserId = await resolveAppUserId(params);

  const payload = {
    event_name: params.event,
    app_user_id: resolvedAppUserId,
    auth_user_id: params.authUserId ?? null,
    properties: params.properties ?? {},
    dedupe_key: params.dedupeKey ?? null,
  };

  const query = params.dedupeKey
    ? supabase.from('analytics_events').upsert(payload, { onConflict: 'dedupe_key' })
    : supabase.from('analytics_events').insert(payload);

  const { error } = await query;
  if (error) {
    console.warn('trackEvent failed:', params.event, error.message);
  }
}
