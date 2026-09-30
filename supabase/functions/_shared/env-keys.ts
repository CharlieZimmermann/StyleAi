// Supabase Edge Functions auto-inject API keys, but the platform's newer
// publishable/secret key system changed the variable shape:
//   - Current: SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS, each a JSON
//     object of named keys -- read the "default" entry.
//   - Legacy (still injected, but deprecated): SUPABASE_ANON_KEY /
//     SUPABASE_SERVICE_ROLE_KEY, plain strings.
// These try the current shape first and fall back to the legacy one, so
// this keeps working whether the underlying project has old- or new-style
// keys.

function readNamedKey(jsonVarName: string): string | undefined {
  const raw = Deno.env.get(jsonVarName);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw)?.default;
  } catch {
    console.error(`${jsonVarName} was set but not valid JSON.`);
    return undefined;
  }
}

/** Safe to use as the caller's own key when their JWT is forwarded too (RLS still applies). */
export function getPublishableKey(): string | undefined {
  return (
    readNamedKey('SUPABASE_PUBLISHABLE_KEYS') ??
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
    Deno.env.get('SUPABASE_ANON_KEY')
  );
}

/**
 * BYPASSES ROW LEVEL SECURITY. Only use for operations that must act outside
 * any single user's RLS scope (e.g. deleting their auth.users row). Never
 * send this key to the client or log it.
 */
export function getSecretKey(): string | undefined {
  return (
    readNamedKey('SUPABASE_SECRET_KEYS') ??
    Deno.env.get('SUPABASE_SECRET_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  );
}
