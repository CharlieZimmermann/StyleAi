import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { SuggestedTags } from '@/types/clothing';

/**
 * Sends a photo to the tag-clothing-item Edge Function for AI tagging.
 * supabase.functions.invoke automatically attaches the signed-in user's
 * access token, and the function itself requires it (see
 * supabase/functions/tag-clothing-item/index.ts) -- this can't be called by
 * anyone who isn't logged into this app.
 */
export async function requestClothingTags(imageBase64: string): Promise<SuggestedTags> {
  const { data, error } = await supabase.functions.invoke<SuggestedTags>('tag-clothing-item', {
    body: { imageBase64 },
  });

  if (error) {
    // For any non-2xx response, supabase-js only says "Edge Function returned
    // a non-2xx status code". The function's own explanation is in the
    // response body, so dig it out.
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      if (body?.error) {
        throw new Error(body.detail ? `${body.error} (${body.detail})` : body.error);
      }
      throw new Error(`Tagging service returned status ${error.context.status}.`);
    }
    throw error;
  }
  if (!data) throw new Error('The tagging function returned no data.');
  return data;
}
