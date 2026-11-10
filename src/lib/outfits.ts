import { attachSignedUrls } from '@/lib/clothing-items';
import { invokeFunction } from '@/lib/functions';
import { supabase } from '@/lib/supabase';
import type { ClothingItem } from '@/types/clothing';
import type { Outfit, WeatherLocation, WeatherSnapshot } from '@/types/outfit';

/** The device's local calendar date as YYYY-MM-DD (not UTC, which can be a day off). */
export function localDateString(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// Display order inside an outfit card: tops/dress, layers, bottoms, shoes, extras.
const SLOT_ORDER: Record<string, number> = {
  t_shirt: 1,
  shirt: 1,
  sweatshirt: 1,
  hoodie: 1,
  dress_skirt: 1,
  outerwear: 2,
  pants: 3,
  formal_pants: 3,
  shorts: 3,
  shoes: 4,
  hat: 5,
  accessory: 6,
};

type GeneratedOutfit = { outfitId: string };

// Sized above the function's own worst case: a weather/geocoding lookup
// (10s timeout each) plus, when avoidItemIds is set, up to two full passes
// through the 4-model Gemini fallback chain (15s timeout each) if the first
// pass can't find anything different -- see generate-outfit/index.ts and
// supabase/functions/_shared/gemini.ts.
const GENERATE_TIMEOUT_MS = 150_000;

/**
 * Asks the generate-outfit Edge Function for an outfit and returns it fully
 * loaded. With no eventPrompt this is today's daily outfit (replacing any
 * existing one); with one it's a new outfit for that occasion.
 * `avoidItemIds` is the outfit being rejected, so a regenerate looks different.
 */
export async function generateOutfit(options: {
  location: WeatherLocation;
  eventPrompt?: string;
  avoidItemIds?: string[];
}): Promise<Outfit> {
  const generated = await invokeFunction<GeneratedOutfit>(
    'generate-outfit',
    {
      ...options.location,
      localDate: localDateString(),
      eventPrompt: options.eventPrompt,
      avoidItemIds: options.avoidItemIds,
    },
    GENERATE_TIMEOUT_MS,
  );
  return loadOutfit(generated.outfitId);
}

/** Today's daily outfit if one was already generated, otherwise null. */
export async function getTodaysOutfit(): Promise<Outfit | null> {
  const { data, error } = await supabase
    .from('outfits')
    .select('id')
    .eq('outfit_type', 'daily')
    .eq('outfit_date', localDateString())
    .maybeSingle();
  if (error) throw error;
  return data ? loadOutfit(data.id) : null;
}

/** Loads one outfit (by id) fully: its items, signed photo URLs, and today's worn status. */
export async function loadOutfit(outfitId: string): Promise<Outfit> {
  const { data: row, error } = await supabase
    .from('outfits')
    .select('id, outfit_type, outfit_date, event_prompt, ai_reason, weather_snapshot, is_saved')
    .eq('id', outfitId)
    .single();
  if (error) throw error;

  const { data: links, error: linksError } = await supabase
    .from('outfit_items')
    .select('clothing_items(*)')
    .eq('outfit_id', outfitId);
  if (linksError) throw linksError;

  const clothing = (links ?? [])
    .map((link) => link.clothing_items as unknown as ClothingItem | null)
    .filter((item): item is ClothingItem => item !== null)
    .sort((a, b) => (SLOT_ORDER[a.category] ?? 9) - (SLOT_ORDER[b.category] ?? 9));
  const items = await attachSignedUrls(clothing);

  const alreadyWorn = await wornTodayIds(items.map((item) => item.id));

  return {
    id: row.id,
    outfitDate: row.outfit_date,
    outfitType: row.outfit_type,
    eventPrompt: row.event_prompt,
    reason: row.ai_reason,
    weather: row.weather_snapshot as WeatherSnapshot | null,
    items,
    wornToday: items.length > 0 && items.every((item) => alreadyWorn.has(item.id)),
    isSaved: row.is_saved,
  };
}

/** The most recent event (occasion) outfits, newest first. */
export async function listEventOutfits(limit = 5): Promise<Outfit[]> {
  const { data, error } = await supabase
    .from('outfits')
    .select('id')
    .eq('outfit_type', 'event')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return Promise.all((data ?? []).map((row) => loadOutfit(row.id)));
}

/** Every outfit (daily or event) the user has starred, newest first. */
export async function listSavedOutfits(limit = 30): Promise<Outfit[]> {
  const { data, error } = await supabase
    .from('outfits')
    .select('id')
    .eq('is_saved', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return Promise.all((data ?? []).map((row) => loadOutfit(row.id)));
}

/**
 * Hand-assembles an outfit from chosen items, with no AI involved --
 * closes out the outfit_type enum (daily/event were AI-generated; this is
 * the third, manual, path). Auto-saved (is_saved: true): building one by
 * hand is a deliberate choice to keep it, and there's no separate "manual
 * outfit history" screen, so it needs to land somewhere findable --
 * Closet > Saved Outfits.
 */
export async function createManualOutfit(userId: string, itemIds: string[]): Promise<Outfit> {
  const { data: outfit, error: outfitError } = await supabase
    .from('outfits')
    .insert({
      user_id: userId,
      outfit_type: 'manual',
      outfit_date: localDateString(),
      is_saved: true,
    })
    .select('id')
    .single();
  if (outfitError || !outfit) throw outfitError ?? new Error('Could not create the outfit.');

  const { error: linkError } = await supabase
    .from('outfit_items')
    .insert(itemIds.map((id) => ({ outfit_id: outfit.id, clothing_item_id: id })));
  if (linkError) {
    await supabase.from('outfits').delete().eq('id', outfit.id);
    throw linkError;
  }

  return loadOutfit(outfit.id);
}

export async function setOutfitSaved(outfitId: string, saved: boolean) {
  const { error } = await supabase.from('outfits').update({ is_saved: saved }).eq('id', outfitId);
  if (error) throw error;
}

/** Which of these items already have a wear_log entry for today. */
async function wornTodayIds(itemIds: string[]): Promise<Set<string>> {
  if (itemIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('wear_log')
    .select('clothing_item_id')
    .eq('worn_on', localDateString())
    .in('clothing_item_id', itemIds);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.clothing_item_id as string));
}

/**
 * Records that the user wore these items today. Skips ones already logged
 * today, so tapping "Wear this" twice can't double-count.
 */
export async function logWorn(userId: string, itemIds: string[]) {
  const already = await wornTodayIds(itemIds);
  const rows = itemIds
    .filter((id) => !already.has(id))
    .map((id) => ({ user_id: userId, clothing_item_id: id, worn_on: localDateString() }));
  if (rows.length === 0) return;

  const { error } = await supabase.from('wear_log').insert(rows);
  if (error) throw error;
}
