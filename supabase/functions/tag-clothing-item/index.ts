// Deno.serve is the standard, built-in entry point for Supabase Edge
// Functions -- no import needed. See:
// https://supabase.com/docs/guides/functions
//
// This function is a thin, stateless proxy in front of the Gemini API: the
// client sends a photo, this returns AI-suggested clothing tags. It never
// touches the database or Storage -- the client does that itself afterward,
// under the RLS policies in supabase/schema.sql.
//
// Auth: Supabase's Edge Function gateway verifies the caller's JWT by
// default (deploy WITHOUT --no-verify-jwt to keep that on), so by the time
// this code runs, the caller is already a signed-in user of this app --
// that's what keeps random internet traffic from burning our free Gemini
// quota.

import { corsHeaders } from '../_shared/cors.ts';
import { CLOTHING_CATEGORIES, SEASONS } from '../_shared/clothing-schema.ts';
import { generateJson } from '../_shared/gemini.ts';

// Keep inline image payloads well under Gemini's 20MB request limit and
// fast to upload over a phone connection. The app resizes/compresses photos
// before sending (see src/app/(tabs)/add-item.tsx), so this is a safety net,
// not the primary control.
const MAX_BASE64_LENGTH = 8_000_000; // ~6MB of actual image data

const PROMPT = `You are tagging a photo of a single clothing item for a wardrobe app.
Look at the image and identify:
- category: the single best-fitting category for this item
- color: the main color, as a short common name (e.g. "navy blue", "white", "olive green")
- season: the best-fitting season for wearing this item
- description: one short, plain sentence describing the item

Respond with only the requested fields. If the photo doesn't clearly show a
single wearable clothing item, still make your best guess.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: [...CLOTHING_CATEGORIES] },
    color: { type: 'string' },
    season: { type: 'string', enum: [...SEASONS] },
    description: { type: 'string' },
  },
  required: ['category', 'color', 'season', 'description'],
  propertyOrdering: ['category', 'color', 'season', 'description'],
};

type SuggestedTags = {
  category: (typeof CLOTHING_CATEGORIES)[number];
  color: string;
  season: (typeof SEASONS)[number];
  description: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Use POST.' }, 405);
  }

  let imageBase64: unknown;
  try {
    const body = await req.json();
    imageBase64 = body.imageBase64;
  } catch {
    return jsonResponse({ error: 'Expected a JSON body with an imageBase64 field.' }, 400);
  }

  if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
    return jsonResponse({ error: 'imageBase64 must be a non-empty base64 string.' }, 400);
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return jsonResponse({ error: 'Image is too large. Please use a smaller photo.' }, 400);
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    // This means the secret hasn't been set yet -- see the Step 3 setup
    // notes for `supabase secrets set GEMINI_API_KEY=...`.
    console.error('GEMINI_API_KEY is not set for this Edge Function.');
    return jsonResponse({ error: 'Server is not configured for AI tagging yet.' }, 500);
  }

  const result = await generateJson<SuggestedTags>({
    apiKey,
    parts: [{ text: PROMPT }, { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }],
    schema: RESPONSE_SCHEMA,
    // Defensive re-check: the schema's `enum` constraint should already
    // guarantee this, but a fallback here is cheap insurance against a model
    // change or a schema-enforcement slip.
    validate: (data) => {
      const tags = data as Partial<SuggestedTags> | null;
      if (
        !tags ||
        !CLOTHING_CATEGORIES.includes(tags.category as SuggestedTags['category']) ||
        !SEASONS.includes(tags.season as SuggestedTags['season']) ||
        typeof tags.color !== 'string' ||
        typeof tags.description !== 'string'
      ) {
        return { ok: false, reason: 'unexpected response shape' };
      }
      return { ok: true, value: tags as SuggestedTags };
    },
  });

  if (!result.ok) {
    return jsonResponse(
      {
        error: 'The AI tagging service is busy right now. Try again in a moment.',
        detail: result.failures.join(' | '),
      },
      502,
    );
  }

  return jsonResponse(result.value);
});
