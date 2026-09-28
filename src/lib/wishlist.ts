import { invokeFunction } from '@/lib/functions';
import { supabase } from '@/lib/supabase';
import type { SuggestionStatus, WishlistSuggestion } from '@/types/wishlist';

function fromRow(row: {
  id: string;
  product_name: string;
  brand: string | null;
  reason: string | null;
  product_url: string | null;
  status: SuggestionStatus;
}): WishlistSuggestion {
  return {
    id: row.id,
    productName: row.product_name,
    brand: row.brand,
    reason: row.reason,
    productUrl: row.product_url,
    status: row.status,
  };
}

/** Active (not dismissed/purchased) gap suggestions, newest first. */
export async function listWishlistSuggestions(): Promise<WishlistSuggestion[]> {
  const { data, error } = await supabase
    .from('wishlist_suggestions')
    .select('id, product_name, brand, reason, product_url, status')
    .eq('status', 'suggested')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function setSuggestionStatus(id: string, status: SuggestionStatus) {
  const { error } = await supabase.from('wishlist_suggestions').update({ status }).eq('id', id);
  if (error) throw error;
}

type GapSuggestionsResult = { count: number };

/**
 * Asks the suggest-wardrobe-gaps Edge Function to look at the closet and
 * refresh the suggestion list. Replaces the previous batch of suggestions
 * (dismissed/purchased ones are untouched), so call listWishlistSuggestions
 * again afterward.
 */
export async function generateWishlistSuggestions(): Promise<GapSuggestionsResult> {
  return invokeFunction<GapSuggestionsResult>('suggest-wardrobe-gaps', {});
}
