// Mirrors the enums in supabase/schema.sql and src/types/clothing.ts.
// Edge Functions deploy as a self-contained bundle of supabase/functions/,
// so this can't just import from src/ -- keep these three in sync by hand.

export const CLOTHING_CATEGORIES = [
  't_shirt',
  'shirt',
  'sweatshirt',
  'hoodie',
  'pants',
  'formal_pants',
  'shorts',
  'dress_skirt',
  'outerwear',
  'shoes',
  'hat',
  'accessory',
] as const;

export const SEASONS = ['spring', 'summer', 'fall', 'winter', 'all_season'] as const;
