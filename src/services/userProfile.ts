import { supabase } from '../lib/supabase';

export type AppUserProfile = {
  id: string;
  displayName: string;
  avatarUrl?: string;
};

export async function getOrCreateAppUser(authUserId: string): Promise<AppUserProfile> {
  const existing = await supabase
    .from('users')
    .select('id,display_name,avatar_url')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  if (existing.data?.id) {
    return {
      id: existing.data.id,
      displayName: existing.data.display_name,
      avatarUrl: existing.data.avatar_url ?? undefined,
    };
  }

  const created = await supabase
    .from('users')
    .insert({
      auth_user_id: authUserId,
      display_name: 'Reader',
    })
    .select('id,display_name,avatar_url')
    .single();

  if (created.error || !created.data?.id) {
    throw new Error(created.error?.message ?? 'Failed to create user profile');
  }

  return {
    id: created.data.id,
    displayName: created.data.display_name,
    avatarUrl: created.data.avatar_url ?? undefined,
  };
}

export async function getAppUserId(authUserId: string): Promise<string> {
  const profile = await getOrCreateAppUser(authUserId);
  return profile.id;
}
