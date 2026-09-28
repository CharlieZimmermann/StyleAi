import { decode } from 'base64-arraybuffer';

import { supabase } from '@/lib/supabase';
import type { ClothingCategory, ClothingItem, Season } from '@/types/clothing';

const BUCKET = 'clothing-images';
// How long a signed image URL stays valid. The closet list re-signs on
// every load, so this just needs to outlive one screen viewing -- it
// doesn't need to be long-lived.
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * Uploads a JPEG (as base64) to this user's folder in the private
 * clothing-images bucket, per the <user_id>/<filename> convention documented
 * in supabase/schema.sql. Returns the storage path to save on the
 * clothing_items row -- NOT a public URL, since the bucket is private.
 */
export async function uploadClothingImage(userId: string, base64: string): Promise<string> {
  const path = `${userId}/${Date.now()}-${Math.round(Math.random() * 1e6)}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, decode(base64), {
    contentType: 'image/jpeg',
  });

  if (error) throw error;
  return path;
}

/** Best-effort cleanup, e.g. when saving the row failed after the photo uploaded. */
export async function deleteClothingImage(path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
}

type NewClothingItem = {
  imagePath: string;
  title?: string | null;
  category: ClothingCategory;
  color?: string | null;
  season?: Season | null;
  brand?: string | null;
  /** Raw AI output worth keeping around, stored as-is in the flexible ai_tags jsonb column. */
  aiTags?: Record<string, unknown> | null;
};

export async function createClothingItem(userId: string, item: NewClothingItem) {
  const { error } = await supabase.from('clothing_items').insert({
    user_id: userId,
    title: item.title ?? null,
    category: item.category,
    color: item.color ?? null,
    season: item.season ?? null,
    brand: item.brand ?? null,
    image_url: item.imagePath,
    ai_tags: item.aiTags ?? null,
  });

  if (error) throw error;
}

/** Cheap existence check, so a brand-new user can be shown a friendly
 * "add your first item" prompt instead of an outfit-generation error. */
export async function hasAnyClothingItems(): Promise<boolean> {
  const { data, error } = await supabase.from('clothing_items').select('id').limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * Fetches the signed-in user's closet, most recent first, and attaches a
 * temporary signed URL to each item so the (private) photo can actually be
 * displayed. Signed URLs expire, so don't cache the result across screens --
 * re-fetch whenever the list screen is shown.
 */
export async function listClothingItems(): Promise<(ClothingItem & { signedUrl: string | null })[]> {
  const { data: items, error } = await supabase
    .from('clothing_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return attachSignedUrls((items ?? []) as ClothingItem[]);
}

/** One item, with a signed URL for its (private) photo, or null if it's gone. */
export async function getClothingItem(
  id: string,
): Promise<(ClothingItem & { signedUrl: string | null }) | null> {
  const { data, error } = await supabase.from('clothing_items').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [withUrl] = await attachSignedUrls([data as ClothingItem]);
  return withUrl;
}

export type ClothingItemUpdate = Partial<{
  title: string | null;
  category: ClothingCategory;
  color: string | null;
  season: Season | null;
  brand: string | null;
}>;

export async function updateClothingItem(id: string, updates: ClothingItemUpdate) {
  const { error } = await supabase.from('clothing_items').update(updates).eq('id', id);
  if (error) throw error;
}

/**
 * Deletes the item row, then best-effort deletes its photo. RLS/foreign keys
 * cascade this out of any outfit_items/wear_log rows automatically (see
 * supabase/schema.sql), so a saved outfit that included this item just ends
 * up with fewer items -- it isn't deleted itself.
 */
export async function deleteClothingItem(id: string, imagePath: string) {
  const { error } = await supabase.from('clothing_items').delete().eq('id', id);
  if (error) throw error;
  await deleteClothingImage(imagePath);
}

/**
 * Adds a temporary signed URL to each item so its (private) photo can be
 * displayed. Signed URLs expire, so don't cache the result across screens.
 */
export async function attachSignedUrls(
  items: ClothingItem[],
): Promise<(ClothingItem & { signedUrl: string | null })[]> {
  if (items.length === 0) return [];

  const { data: signedUrls } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(
      items.map((item) => item.image_url),
      SIGNED_URL_TTL_SECONDS,
    );

  const urlByPath = new Map((signedUrls ?? []).map((entry) => [entry.path, entry.signedUrl]));

  return items.map((item) => ({
    ...item,
    signedUrl: urlByPath.get(item.image_url) ?? null,
  }));
}
