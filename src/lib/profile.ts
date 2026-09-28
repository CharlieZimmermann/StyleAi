import { supabase } from '@/lib/supabase';

/**
 * Makes sure a public.users row exists for this session, creating (or
 * refreshing) it if not. Normally the supabase/schema.sql sign-up trigger
 * handles this once, at sign-up -- this is a self-healing backstop for the
 * row going missing afterward (e.g. deleted directly from the Table Editor
 * rather than via Authentication -> Users, which would cascade properly).
 * Without it, every insert into clothing_items (and other user-owned
 * tables) fails its foreign key check with no obvious cause.
 */
export async function ensureUserProfile(userId: string, email: string | undefined) {
  const { error } = await supabase.from('users').upsert({ id: userId, email: email ?? '' });
  if (error) console.error('ensureUserProfile failed:', error);
}

/** The city to fall back on for weather when location permission is denied. */
export async function getHomeCity(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('home_city')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.home_city ?? null;
}

export async function setHomeCity(userId: string, city: string) {
  const { error } = await supabase.from('users').update({ home_city: city }).eq('id', userId);
  if (error) throw error;
}
