// Generates an outfit from the signed-in user's own closet, using today's
// weather, their recent wear history, and (optionally) an occasion, then
// saves it to the outfits / outfit_items tables.
//
// Unlike tag-clothing-item, this function reads and writes the user's data --
// so it talks to Supabase AS THE USER (their own JWT, forwarded below),
// which means the RLS policies in supabase/schema.sql apply exactly as they
// do in the app. It never uses the secret key.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';
import { getPublishableKey } from '../_shared/env-keys.ts';
import { generateJson } from '../_shared/gemini.ts';
import { checkRateLimit, logAiCall } from '../_shared/rate-limit.ts';
import { fetchWeather, geocodeCity, type WeatherSnapshot } from '../_shared/weather.ts';
import {
  buildPrompt,
  closetGap,
  daysBetween,
  RESPONSE_SCHEMA,
  validatePick,
  WEAR_HISTORY_DAYS,
  type ClosetItem,
  type OutfitPick,
} from './logic.ts';

const MAX_EVENT_PROMPT_LENGTH = 200;
const RATE_LIMIT_PER_DAY = 20;
const FUNCTION_NAME = 'generate-outfit';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Use POST.' }, 405);

  // ---- Auth: act as the calling user, so RLS applies. ----
  const authHeader = req.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = getPublishableKey() ?? req.headers.get('apikey');
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

  const rateCheck = await checkRateLimit(supabase, userId, FUNCTION_NAME, RATE_LIMIT_PER_DAY);
  if (!rateCheck.allowed) return jsonResponse({ error: rateCheck.retryMessage }, 429);

  // ---- Input ----
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Expected a JSON body.' }, 400);
  }

  const localDate = body.localDate;
  if (typeof localDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    return jsonResponse({ error: 'localDate must be YYYY-MM-DD.' }, 400);
  }

  const eventPrompt =
    typeof body.eventPrompt === 'string' && body.eventPrompt.trim()
      ? body.eventPrompt.trim().slice(0, MAX_EVENT_PROMPT_LENGTH)
      : null;
  const outfitType = eventPrompt ? 'event' : 'daily';

  const avoidItemIds = Array.isArray(body.avoidItemIds)
    ? body.avoidItemIds.filter((id): id is string => typeof id === 'string').slice(0, 10)
    : [];

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set for this Edge Function.');
    return jsonResponse({ error: 'Server is not configured for AI outfits yet.' }, 500);
  }

  // ---- Weather: GPS coordinates if we got them, otherwise the saved city. ----
  let weather: WeatherSnapshot;
  try {
    if (isNumber(body.latitude) && isNumber(body.longitude)) {
      weather = await fetchWeather(body.latitude, body.longitude, null);
    } else if (typeof body.city === 'string' && body.city.trim()) {
      const place = await geocodeCity(body.city);
      if (!place) {
        return jsonResponse({ error: `Couldn't find a place called "${body.city}".` }, 422);
      }
      weather = await fetchWeather(place.latitude, place.longitude, place.name);
    } else {
      return jsonResponse({ error: 'Send latitude/longitude or a city.' }, 400);
    }
  } catch (err) {
    console.error('Weather error:', err);
    return jsonResponse({ error: "Couldn't get the weather right now. Try again." }, 502);
  }

  // ---- The user's closet and recent wear history (RLS-scoped to them). ----
  const { data: closetRows, error: closetError } = await supabase
    .from('clothing_items')
    .select('id, title, category, color, brand, season');
  if (closetError) {
    console.error('Closet query failed:', closetError);
    return jsonResponse({ error: "Couldn't load your closet." }, 500);
  }
  const items = (closetRows ?? []) as ClosetItem[];

  const gap = closetGap(items);
  if (gap) return jsonResponse({ error: gap }, 422);

  const sinceDate = new Date(Date.parse(localDate) - WEAR_HISTORY_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const { data: wearRows, error: wearError } = await supabase
    .from('wear_log')
    .select('clothing_item_id, worn_on')
    .gte('worn_on', sinceDate);
  if (wearError) {
    console.error('Wear log query failed:', wearError);
    return jsonResponse({ error: "Couldn't load your wear history." }, 500);
  }

  const lastWorn = new Map<string, string>();
  for (const row of wearRows ?? []) {
    const previous = lastWorn.get(row.clothing_item_id);
    if (!previous || row.worn_on > previous) lastWorn.set(row.clothing_item_id, row.worn_on);
  }
  const closet = items.map((item) => ({
    ...item,
    lastWornDaysAgo: lastWorn.has(item.id) ? daysBetween(localDate, lastWorn.get(item.id)!) : null,
  }));

  // ---- Ask Gemini for the outfit. ----
  const prompt = buildPrompt({ localDate, weather, closet, eventPrompt, avoidItemIds });
  const ask = (avoid: string[]) =>
    generateJson<OutfitPick>({
      apiKey,
      parts: [{ text: prompt }],
      schema: RESPONSE_SCHEMA,
      validate: (data) => validatePick(data, items, avoid),
    });

  let result = await ask(avoidItemIds);
  // A tiny closet may only be able to make one outfit. Rather than fail, allow
  // the same one back if nothing different could be found.
  if (!result.ok && avoidItemIds.length > 0) result = await ask([]);
  if (!result.ok) {
    return jsonResponse(
      {
        error: "Couldn't put an outfit together right now. Try again in a moment.",
        detail: result.failures.join(' | '),
      },
      502,
    );
  }
  const pick = result.value;
  // Awaited, not fire-and-forget: an Edge Function's isolate can be frozen
  // the moment a response is returned, which would silently drop an
  // un-awaited write -- and a rate limit that doesn't reliably record calls
  // doesn't limit anything.
  await logAiCall(supabase, userId, FUNCTION_NAME);

  // ---- Save. A user gets one "daily" outfit per day (unique index in
  // schema.sql), so regenerating replaces today's; event outfits accumulate. ----
  if (outfitType === 'daily') {
    const { error: deleteError } = await supabase
      .from('outfits')
      .delete()
      .eq('outfit_type', 'daily')
      .eq('outfit_date', localDate);
    if (deleteError) {
      console.error('Failed to replace the existing daily outfit:', deleteError);
      return jsonResponse({ error: "Couldn't save the outfit." }, 500);
    }
  }

  const { data: outfit, error: outfitError } = await supabase
    .from('outfits')
    .insert({
      user_id: userId,
      outfit_type: outfitType,
      outfit_date: localDate,
      event_prompt: eventPrompt,
      weather_snapshot: weather,
      ai_reason: pick.reason,
    })
    .select('id')
    .single();
  if (outfitError || !outfit) {
    console.error('Failed to save outfit:', outfitError);
    return jsonResponse({ error: "Couldn't save the outfit." }, 500);
  }

  const { error: linkError } = await supabase
    .from('outfit_items')
    .insert(pick.itemIds.map((id) => ({ outfit_id: outfit.id, clothing_item_id: id })));
  if (linkError) {
    console.error('Failed to save outfit items:', linkError);
    // Don't leave a half-built outfit behind.
    await supabase.from('outfits').delete().eq('id', outfit.id);
    return jsonResponse({ error: "Couldn't save the outfit." }, 500);
  }

  return jsonResponse({
    outfitId: outfit.id,
    outfitDate: localDate,
    outfitType,
    reason: pick.reason,
    itemIds: pick.itemIds,
    weather,
  });
});
