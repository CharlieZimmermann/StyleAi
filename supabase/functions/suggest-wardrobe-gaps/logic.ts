// Pure logic for suggest-wardrobe-gaps, split out from index.ts so it can be
// unit tested directly (index.ts calls Deno.serve at module load time --
// importing it would start an actual server listener).

import { CLOTHING_CATEGORIES } from '../_shared/clothing-schema.ts';

export const MAX_SUGGESTIONS = 8;

export type Suggestion = { productName: string; brand: string | null; reason: string };

export const RESPONSE_SCHEMA = {
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

export function validate(
  data: unknown,
): { ok: true; value: Suggestion[] } | { ok: false; reason: string } {
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
export function searchUrl(suggestion: Suggestion, preferredBrands: string[]): string {
  const brand = suggestion.brand ?? preferredBrands[0];
  const query = brand ? `${brand} ${suggestion.productName}` : suggestion.productName;
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
}

// Plain-language examples for the prompt -- "hat" and "accessory" especially
// are broad buckets the model won't reliably unpack on its own otherwise.
export const CATEGORY_EXAMPLES: Record<(typeof CLOTHING_CATEGORIES)[number], string> = {
  t_shirt: 'plain or graphic t-shirts',
  shirt: 'button-up or casual shirts',
  sweatshirt: 'sweatshirts',
  hoodie: 'hoodies',
  pants: 'casual pants, jeans',
  formal_pants: 'dress/formal pants',
  shorts: 'shorts',
  dress_skirt: 'dresses, skirts',
  outerwear: 'jackets, coats',
  shoes: 'shoes (sneakers, boots, dress shoes, sandals)',
  hat: 'hats (baseball cap, beanie, sun hat)',
  accessory: 'accessories: sunglasses, jewelry/watches, belts, bags, scarves',
};
