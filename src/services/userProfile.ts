import { supabase } from '../lib/supabase';

export async function getAppUserId(authUserId: string): Promise<string> {
  const existing = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  if (existing.data?.id) {
    return existing.data.id;
  }

  const created = await supabase
    .from('users')
    .insert({
      auth_user_id: authUserId,
      display_name: 'Reader',
    })
    .select('id')
    .single();

  if (created.error || !created.data?.id) {
    throw new Error(created.error?.message ?? 'Failed to create user profile');
  }

  return created.data.id;
}
