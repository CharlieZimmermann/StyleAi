// Deletes the signed-in user's own account, permanently. This is the first
// function that needs the SECRET key: there's no client-safe way to delete
// an auth.users row (the RLS-scoped publishable-key client used elsewhere in
// this app can only ever touch the caller's own rows in the public schema,
// never auth.users itself) -- only the admin API can do that, and it
// requires the secret key. That key never leaves this function.
//
// Safety: the id passed to admin.deleteUser is always the CALLER's own id,
// resolved from their own JWT below -- never anything the client sends -- so
// there's no way to use this to delete a different account.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';
import { getPublishableKey, getSecretKey } from '../_shared/env-keys.ts';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Use POST.' }, 405);

  // ---- Who is calling? (their own JWT, not the secret key -- this part
  // only proves identity, it can't act outside their own RLS scope.) ----
  const authHeader = req.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = getPublishableKey() ?? req.headers.get('apikey');
  if (!authHeader || !supabaseUrl || !publishableKey) {
    return jsonResponse({ error: 'Not signed in.' }, 401);
  }

  const callerClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser(
    authHeader.replace(/^Bearer\s+/i, ''),
  );
  if (userError || !userData.user) return jsonResponse({ error: 'Not signed in.' }, 401);
  const userId = userData.user.id;

  const secretKey = getSecretKey();
  if (!secretKey) {
    console.error('No secret key available to this function -- cannot delete accounts.');
    return jsonResponse({ error: 'Account deletion is not available right now.' }, 500);
  }
  const adminClient = createClient(supabaseUrl, secretKey);

  // ---- Clean up their photos. Deleting the DB rows below does NOT delete
  // Storage objects -- those would otherwise be orphaned forever. ----
  const { data: files, error: listError } = await adminClient.storage
    .from('clothing-images')
    .list(userId, { limit: 1000 });
  if (listError) {
    console.error('Could not list photos to delete (continuing anyway):', listError);
  } else if (files && files.length > 0) {
    const { error: removeError } = await adminClient.storage
      .from('clothing-images')
      .remove(files.map((file) => `${userId}/${file.name}`));
    if (removeError) console.error('Could not delete some photos (continuing anyway):', removeError);
  }

  // ---- Delete the auth user. This cascades to public.users and, from
  // there, every other table (on delete cascade -- see schema.sql). ----
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('Failed to delete user:', deleteError);
    return jsonResponse({ error: "Couldn't delete your account. Try again." }, 500);
  }

  return jsonResponse({ deleted: true });
});
