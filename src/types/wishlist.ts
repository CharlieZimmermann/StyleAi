export type SuggestionStatus = 'suggested' | 'dismissed' | 'purchased';

/** Matches a row in public.wishlist_suggestions (see supabase/schema.sql). */
export type WishlistSuggestion = {
  id: string;
  productName: string;
  brand: string | null;
  reason: string | null;
  /** A search-engine link built from the suggestion -- not a real product page (no shopping API yet). */
  productUrl: string | null;
  status: SuggestionStatus;
};
