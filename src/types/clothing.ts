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
  /** A specific title (e.g. "Green Day Tour T-Shirt"); null falls back to the category label. */
  title: string | null;
  category: ClothingCategory;
  color: string | null;
  brand: string | null;
  season: Season | null;
  purchase_price: number | null;
  image_url: string;
  ai_tags: Record<string, unknown> | null;
  created_at: string;
};

/** The primary/secondary label to show for an item: its title if it has one
 * (falling back to the category), plus a subtitle of whatever's left over. */
export function clothingItemLabel(
  item: Pick<ClothingItem, 'title' | 'category' | 'color'>,
): { title: string; subtitle: string | null } {
  const title = item.title || CATEGORY_LABELS[item.category];
  const subtitle =
    [item.title ? CATEGORY_LABELS[item.category] : null, item.color].filter(Boolean).join(' · ') ||
    null;
  return { title, subtitle };
}

/** What the tag-clothing-item Edge Function returns for one photo. */
export type SuggestedTags = {
  /** A specific title if the AI recognized a graphic/logo/text, else a plain descriptive one. */
  title: string;
  category: ClothingCategory;
  color: string;
  season: Season;
  description: string;
};
