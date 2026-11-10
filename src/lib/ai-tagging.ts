import { invokeFunction } from '@/lib/functions';
import type { SuggestedTags } from '@/types/clothing';

/**
 * Sends a photo to the tag-clothing-item Edge Function for AI tagging. The
 * function requires a signed-in user (see
 * supabase/functions/tag-clothing-item/index.ts), so this can't be called by
 * anyone who isn't logged into this app.
 */
// Sized above the function's own worst case (4 Gemini models x 15s timeout
// each) -- see supabase/functions/_shared/gemini.ts.
const TAG_TIMEOUT_MS = 70_000;

export function requestClothingTags(imageBase64: string): Promise<SuggestedTags> {
  return invokeFunction<SuggestedTags>('tag-clothing-item', { imageBase64 }, TAG_TIMEOUT_MS);
}
