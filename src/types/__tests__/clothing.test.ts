import { clothingItemLabel } from '@/types/clothing';
import type { ClothingItem } from '@/types/clothing';

function item(overrides: Partial<ClothingItem> = {}): Pick<ClothingItem, 'title' | 'category' | 'color'> {
  return {
    title: null,
    category: 't_shirt',
    color: null,
    ...overrides,
  };
}

describe('clothingItemLabel', () => {
  it('uses the category label as the title when there is no title', () => {
    const label = clothingItemLabel(item({ category: 'hoodie' }));
    expect(label.title).toBe('Hoodie');
  });

  it('uses the AI/manual title when present, with category as the subtitle', () => {
    const label = clothingItemLabel(item({ title: 'Green Day Tour T-Shirt', category: 't_shirt' }));
    expect(label.title).toBe('Green Day Tour T-Shirt');
    expect(label.subtitle).toBe('T-Shirt');
  });

  it('appends color to the subtitle when both a title and a color are present', () => {
    const label = clothingItemLabel(item({ title: 'Tour Tee', category: 't_shirt', color: 'black' }));
    expect(label.subtitle).toBe('T-Shirt · black');
  });

  it('subtitle is just the color when there is no title (category is already the main title)', () => {
    const label = clothingItemLabel(item({ category: 'shoes', color: 'white' }));
    expect(label.title).toBe('Shoes');
    expect(label.subtitle).toBe('white');
  });

  it('subtitle is null when there is neither a title nor a color', () => {
    const label = clothingItemLabel(item({ category: 'shoes', color: null }));
    expect(label.subtitle).toBeNull();
  });
});
