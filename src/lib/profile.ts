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

export type Preferences = {
  budgetMin: number | null;
  budgetMax: number | null;
  preferredBrands: string[];
  styleTags: string[];
};

/** Feeds the gap-finder (suggest-wardrobe-gaps); none of this is required to use the app. */
export async function getPreferences(userId: string): Promise<Preferences> {
  const { data, error } = await supabase
    .from('users')
    .select('budget_min, budget_max, preferred_brands, style_tags')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return {
    budgetMin: data?.budget_min ?? null,
    budgetMax: data?.budget_max ?? null,
    preferredBrands: data?.preferred_brands ?? [],
    styleTags: data?.style_tags ?? [],
  };
}

export async function setPreferences(userId: string, prefs: Preferences) {
  const { error } = await supabase
    .from('users')
    .update({
      budget_min: prefs.budgetMin,
      budget_max: prefs.budgetMax,
      preferred_brands: prefs.preferredBrands,
      style_tags: prefs.styleTags,
    })
    .eq('id', userId);
  if (error) throw error;
}

/** Turns "Uniqlo, J.Crew,  " into ["Uniqlo", "J.Crew"] -- for the comma-separated text inputs. */
export function parseTagList(text: string): string[] {
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}
