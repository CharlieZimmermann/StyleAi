// Mirrors the enums defined in supabase/schema.sql. Keep these two files in
// sync -- if you add a category or season there, add it here too.

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

export type ClothingCategory = (typeof CLOTHING_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  t_shirt: 'T-Shirt',
  shirt: 'Shirt',
  sweatshirt: 'Sweatshirt',
  hoodie: 'Hoodie',
  pants: 'Pants',
  formal_pants: 'Formal Pants',
  shorts: 'Shorts',
  dress_skirt: 'Dress / Skirt',
  outerwear: 'Outerwear',
  shoes: 'Shoes',
  hat: 'Hat',
  accessory: 'Accessory',
};

export const SEASONS = ['spring', 'summer', 'fall', 'winter', 'all_season'] as const;

export type Season = (typeof SEASONS)[number];

export const SEASON_LABELS: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  fall: 'Fall',
  winter: 'Winter',
  all_season: 'All Season',
};

/** Matches a row in public.clothing_items (see supabase/schema.sql). */
export type ClothingItem = {
  id: string;
  user_id: string;
  category: ClothingCategory;
  color: string | null;
  brand: string | null;
  season: Season | null;
  purchase_price: number | null;
  image_url: string;
  ai_tags: Record<string, unknown> | null;
  created_at: string;
};

/** What the tag-clothing-item Edge Function returns for one photo. */
export type SuggestedTags = {
  category: ClothingCategory;
  color: string;
  season: Season;
  description: string;
};
