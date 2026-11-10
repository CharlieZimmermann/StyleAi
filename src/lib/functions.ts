import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Calls one of our Edge Functions as the signed-in user (supabase-js attaches
 * their access token automatically).
 *
 * For any non-2xx response supabase-js only says "Edge Function returned a
 * non-2xx status code". Our functions explain themselves in the response body
 * ({ error, detail? }), so dig that out and throw it as a readable Error.
 *
 * `timeoutMs` defaults to a value sized for a quick call (e.g. account
 * deletion); the AI-calling functions pass a much larger one sized for their
 * own worst-case server-side bound (see their call sites), so a client-side
 * timeout never fires before the server's own would -- this is a backstop
 * against the request hanging somewhere the server-side timeout can't catch
 * (a dead connection, a cold start, etc.), not the primary defense.
 */
export async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body, timeout: timeoutMs });

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
