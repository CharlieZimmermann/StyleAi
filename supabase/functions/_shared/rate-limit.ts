// A per-user, per-function daily cap on AI Edge Function calls, backed by
// ai_call_log (see supabase/schema.sql). Without this, a UI bug or someone
// rapid-tapping a button could exhaust the free-tier Gemini quota and break
// the app for everyone until it resets -- worst case, mid-demo. These limits
// are generous for normal use (see call sites), not a real usage cap.
//
// `supabase` must be a client scoped to the calling user (their JWT
// forwarded), matching every other query in these functions, so this is
// naturally scoped by RLS -- it can only see/write this user's own rows.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const WINDOW_HOURS = 24;

export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  functionName: string,
  limit: number,
): Promise<{ allowed: true } | { allowed: false; retryMessage: string }> {
  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from('ai_call_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('function_name', functionName)
    .gte('created_at', since);

  if (error) {
    // Fail open: a logging problem shouldn't block the feature.
    console.error('Rate limit check failed (allowing the call):', error);
    return { allowed: true };
  }

  if ((count ?? 0) >= limit) {
    return {
      allowed: false,
      retryMessage: `You've hit today's limit for this feature (${limit}/24h). Try again later.`,
    };
  }
  return { allowed: true };
}

/** Best-effort -- a failed log write shouldn't fail the request it's logging. */
export async function logAiCall(supabase: SupabaseClient, userId: string, functionName: string) {
  const { error } = await supabase
    .from('ai_call_log')
    .insert({ user_id: userId, function_name: functionName });
  if (error) console.error('Failed to log AI call:', error);
}
