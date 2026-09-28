// Looks at the signed-in user's closet and style/budget preferences, asks
// Gemini for a handful of missing wardrobe staples, and saves them to
// wishlist_suggestions.
//
// Like generate-outfit, this talks to Supabase AS THE USER (their own JWT,
// forwarded below), so RLS applies exactly as it does in the app. It never
// uses the secret key.
//
// No shopping API here by design (see docs/technical-architecture.md and the
// Step 1 discussion): real shopping APIs need approval and are fragile, so
// each suggestion instead gets a plain web search link the user can act on
// themselves. That link is built here, deterministically, from the
// suggestion text -- never trusted from the AI's own output -- so it's
// always a real, working URL.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';
import { generateJson } from '../_shared/gemini.ts';

const MAX_SUGGESTIONS = 6;

type ClosetItem = { category: string; color: string | null };

type Suggestion = { productName: string; brand: string | null; reason: string };

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productName: { type: 'string' },
          brand: { type: 'string', nullable: true },
          reason: { type: 'string' },
        },
        required: ['productName', 'reason'],
        propertyOrdering: ['productName', 'brand', 'reason'],
      },
    },
  },
  required: ['suggestions'],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function validate(data: unknown): { ok: true; value: Suggestion[] } | { ok: false; reason: string } {
  const parsed = data as { suggestions?: unknown } | null;
  if (!parsed || !Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
    return { ok: false, reason: 'unexpected response shape' };
  }
  const suggestions: Suggestion[] = [];
  for (const item of parsed.suggestions) {
    const candidate = item as Partial<Suggestion> | null;
    if (!candidate || typeof candidate.productName !== 'string' || typeof candidate.reason !== 'string') {
      return { ok: false, reason: 'a suggestion was missing productName/reason' };
    }
    suggestions.push({
      productName: candidate.productName,
      brand: typeof candidate.brand === 'string' ? candidate.brand : null,
      reason: candidate.reason,
    });
  }
  return { ok: true, value: suggestions.slice(0, MAX_SUGGESTIONS) };
}

/** A plain web search link -- not a specific product page, since there's no shopping API (yet). */
function searchUrl(suggestion: Suggestion, preferredBrands: string[]): string {
  const brand = suggestion.brand ?? preferredBrands[0];
  const query = brand ? `${brand} ${suggestion.productName}` : suggestion.productName;
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Use POST.' }, 405);

  // ---- Auth: act as the calling user, so RLS applies. ----
  const authHeader = req.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey =
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
    Deno.env.get('SUPABASE_ANON_KEY') ??
    req.headers.get('apikey');
  if (!authHeader || !supabaseUrl || !supabaseKey) {
    return jsonResponse({ error: 'Not signed in.' }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(
    authHeader.replace(/^Bearer\s+/i, ''),
  );
  if (userError || !userData.user) return jsonResponse({ error: 'Not signed in.' }, 401);
  const userId = userData.user.id;

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set for this Edge Function.');
    return jsonResponse({ error: 'Server is not configured for AI suggestions yet.' }, 500);
  }

  // ---- The user's closet and preferences (RLS-scoped to them). ----
  const { data: closetRows, error: closetError } = await supabase
    .from('clothing_items')
    .select('category, color');
  if (closetError) {
    console.error('Closet query failed:', closetError);
    return jsonResponse({ error: "Couldn't load your closet." }, 500);
  }
  const closet = (closetRows ?? []) as ClosetItem[];
  if (closet.length === 0) {
    return jsonResponse(
      { error: 'Add a few items to your closet first, so there\'s something to compare against.' },
      422,
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('budget_min, budget_max, preferred_brands, style_tags')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) {
    console.error('Profile query failed:', profileError);
    return jsonResponse({ error: "Couldn't load your preferences." }, 500);
  }
  const preferredBrands: string[] = profile?.preferred_brands ?? [];

  // ---- Ask Gemini what's missing. ----
  const prompt = `You are a wardrobe stylist. Here is a user's current closet (JSON, one entry per item):
${JSON.stringify(closet)}

${profile?.style_tags?.length ? `Their style: ${profile.style_tags.join(', ')}.` : ''}
${
    profile?.budget_min || profile?.budget_max
      ? `Their budget per item is roughly $${profile.budget_min ?? 0}-${profile.budget_max ?? '?'}.`
      : ''
  }
${preferredBrands.length ? `Brands they like: ${preferredBrands.join(', ')}.` : ''}

List ${MAX_SUGGESTIONS} specific, common wardrobe staples this closet is clearly missing (e.g.
"plain white crew-neck t-shirt", "black leather belt") -- not duplicates of
what they already own. For each, give a short reason mentioning what gap it
fills (e.g. "you have no neutral tops to layer under a hoodie"). Only name a
brand if one of their preferred brands is a good fit; otherwise leave it out.`;

  const result = await generateJson<Suggestion[]>({
    apiKey,
    parts: [{ text: prompt }],
    schema: RESPONSE_SCHEMA,
    validate,
  });
  if (!result.ok) {
    return jsonResponse(
      {
        error: "Couldn't come up with suggestions right now. Try again in a moment.",
        detail: result.failures.join(' | '),
      },
      502,
    );
  }

  // ---- Save: replace the previous batch of active suggestions. Dismissed
  // and purchased ones are untouched -- they're history, not clutter. ----
  const { error: clearError } = await supabase
    .from('wishlist_suggestions')
    .delete()
    .eq('status', 'suggested');
  if (clearError) {
    console.error('Failed to clear old suggestions:', clearError);
    return jsonResponse({ error: "Couldn't save suggestions." }, 500);
  }

  const { error: insertError } = await supabase.from('wishlist_suggestions').insert(
    result.value.map((suggestion) => ({
      user_id: userId,
      product_name: suggestion.productName,
      brand: suggestion.brand,
      reason: suggestion.reason,
      product_url: searchUrl(suggestion, preferredBrands),
      status: 'suggested',
    })),
  );
  if (insertError) {
    console.error('Failed to save suggestions:', insertError);
    return jsonResponse({ error: "Couldn't save suggestions." }, 500);
  }

  return jsonResponse({ count: result.value.length });
});
