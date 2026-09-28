import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

/**
 * Calls one of our Edge Functions as the signed-in user (supabase-js attaches
 * their access token automatically).
 *
 * For any non-2xx response supabase-js only says "Edge Function returned a
 * non-2xx status code". Our functions explain themselves in the response body
 * ({ error, detail? }), so dig that out and throw it as a readable Error.
 */
export async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      if (payload?.error) {
        throw new Error(payload.detail ? `${payload.error} (${payload.detail})` : payload.error);
      }
      throw new Error(`${name} returned status ${error.context.status}.`);
    }
    throw error;
  }
  if (data === null || data === undefined) throw new Error(`${name} returned no data.`);
  return data;
}
