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

// Tried in order. The newest model is best but is also the busiest, so when
// it (or any model) is overloaded, rate-limited, or retired we fall through
// to the next instead of failing the whole request. Gemini's lineup moves
// fast (new versions every couple of months as of 2026) -- see
// https://ai.google.dev/gemini-api/docs/models to refresh this list.
const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

// HTTP statuses where trying a different model can help. Anything else
// (e.g. 400 bad request, 403 bad key) would fail on every model, so stop.
const RETRYABLE_STATUSES = new Set([404, 429, 500, 503, 504]);

const geminiUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

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

  const requestBody = JSON.stringify({
    contents: [
      {
        parts: [{ text: PROMPT }, { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  // Walk the model list until one answers. `failures` records what each
  // model said, so a total failure is diagnosable from the app.
  let geminiResponse: Response | null = null;
  const failures: string[] = [];

  for (const model of GEMINI_MODELS) {
    let response: Response;
    try {
      response = await fetch(geminiUrl(model), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: requestBody,
      });
    } catch (err) {
      console.error(`Network error calling ${model}:`, err);
      failures.push(`${model}: network error`);
      continue;
    }

    if (response.ok) {
      geminiResponse = response;
      break;
    }

    const errorText = await response.text();
    console.error(`${model} error:`, response.status, errorText);
    // `failures` is safe to expose: it's Gemini's own status/message and
    // never contains our API key.
    failures.push(`${model} ${response.status}: ${errorText.slice(0, 120)}`);

    if (!RETRYABLE_STATUSES.has(response.status)) break;
  }

  if (!geminiResponse) {
    return jsonResponse(
      {
        error: 'The AI tagging service is busy right now. Try again in a moment.',
        detail: failures.join(' | '),
      },
      502,
    );
  }

  const result = await geminiResponse.json();
  const candidate = result.candidates?.[0];
  const rawText: string | undefined = candidate?.content?.parts?.[0]?.text;

  if (!rawText) {
    console.error('Gemini returned no usable content:', JSON.stringify(result));
    return jsonResponse(
      { error: "Couldn't identify this item from the photo. Try a clearer, well-lit shot." },
      422,
    );
  }

  let tags: SuggestedTags;
  try {
    tags = JSON.parse(rawText);
  } catch (err) {
    console.error('Failed to parse Gemini JSON output:', rawText, err);
    return jsonResponse({ error: 'The AI response was malformed. Try again.' }, 502);
  }

  // Defensive re-check: the schema's `enum` constraint should already
  // guarantee this, but a fallback here is cheap insurance against a model
  // change or a schema-enforcement slip.
  if (
    !CLOTHING_CATEGORIES.includes(tags.category) ||
    !SEASONS.includes(tags.season) ||
    typeof tags.color !== 'string' ||
    typeof tags.description !== 'string'
  ) {
    console.error('Gemini output failed validation:', tags);
    return jsonResponse({ error: 'Got an unexpected response shape from the AI. Try again.' }, 502);
  }

  return jsonResponse(tags satisfies SuggestedTags);
});
