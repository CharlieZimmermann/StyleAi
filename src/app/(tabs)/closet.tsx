import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OutfitCard } from '@/components/outfit-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listClothingItems } from '@/lib/clothing-items';
import { errorMessage } from '@/lib/errors';
import { listSavedOutfits } from '@/lib/outfits';
import { CATEGORY_LABELS, CLOTHING_CATEGORIES, type ClothingCategory, type ClothingItem } from '@/types/clothing';
import type { Outfit } from '@/types/outfit';

type ClosetItem = ClothingItem & { signedUrl: string | null };
type Segment = 'items' | 'saved';

const FILTERS: (ClothingCategory | 'all')[] = ['all', ...CLOTHING_CATEGORIES];

function filterLabel(filter: ClothingCategory | 'all') {
  return filter === 'all' ? 'All' : CATEGORY_LABELS[filter];
}

export default function ClosetScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [segment, setSegment] = useState<Segment>('items');

  const [items, setItems] = useState<ClosetItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ClothingCategory | 'all'>('all');

  const [savedOutfits, setSavedOutfits] = useState<Outfit[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setItemsError(null);
    try {
      setItems(await listClothingItems());
    } catch (err) {
      setItemsError(errorMessage(err, 'Could not load your closet.'));
    } finally {
      setItemsLoading(false);
    }
  }, []);

  const loadSaved = useCallback(async () => {
    setSavedError(null);
    try {
      setSavedOutfits(await listSavedOutfits());
    } catch (err) {
      setSavedError(errorMessage(err, 'Could not load your saved outfits.'));
    } finally {
      setSavedLoading(false);
    }
  }, []);

  // Re-fetch every time this tab regains focus (e.g. after adding an item or
  // starring an outfit elsewhere), not just on first mount.
  useFocusEffect(
    useCallback(() => {
      void loadItems();
      void loadSaved();
    }, [loadItems, loadSaved]),
  );

  function handleSavedOutfitChange(next: Outfit) {
    if (next.isSaved) {
      setSavedOutfits((prev) => prev.map((outfit) => (outfit.id === next.id ? next : outfit)));
    } else {
      // Unstarred from here -- it no longer belongs in this list.
      setSavedOutfits((prev) => prev.filter((outfit) => outfit.id !== next.id));
    }
  }

  const visibleItems = filter === 'all' ? items : items.filter((item) => item.category === filter);

  const numColumns = 2;
  const gridGap = Spacing.three;
  const cardWidth = (width - gridGap * (numColumns + 1)) / numColumns;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedText type="title" style={styles.header}>
          Closet
        </ThemedText>

        <ThemedView style={styles.segmentRow}>
          {(['items', 'saved'] as const).map((value) => {
            const active = segment === value;
            return (
              <Pressable key={value} style={styles.segmentButton} onPress={() => setSegment(value)}>
                <ThemedView
                  type={active ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.segmentInner}>
                  <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
                    {value === 'items' ? 'Items' : 'Saved Outfits'}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            );
          })}
        </ThemedView>

        {segment === 'items' ? (
          <>
            <FlatList
              horizontal
              data={FILTERS}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              renderItem={({ item: chip }) => {
                const active = chip === filter;
                return (
                  <Pressable onPress={() => setFilter(chip)}>
                    <ThemedView
                      type={active ? 'backgroundSelected' : 'backgroundElement'}
                      style={styles.filterChip}>
                      <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
                        {filterLabel(chip)}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                );
              }}
            />

            {itemsLoading ? (
              <ThemedView style={styles.centered}>
                <ActivityIndicator />
              </ThemedView>
            ) : itemsError ? (
              <ThemedView style={styles.centered}>
                <ThemedText type="small" style={styles.errorText}>
                  {itemsError}
                </ThemedText>
              </ThemedView>
            ) : visibleItems.length === 0 ? (
              <ThemedView style={styles.centered}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  {items.length === 0
                    ? "No items yet -- tap the Add tab to photograph your first one."
                    : 'No items in this category yet.'}
                </ThemedText>
              </ThemedView>
            ) : (
              <FlatList
                data={visibleItems}
                keyExtractor={(item) => item.id}
                numColumns={numColumns}
                refreshing={itemsLoading}
                onRefresh={loadItems}
                contentContainerStyle={[styles.grid, { paddingBottom: BottomTabInset + Spacing.four }]}
                columnWrapperStyle={{ gap: gridGap }}
                ItemSeparatorComponent={() => <ThemedView style={{ height: gridGap }} />}
                renderItem={({ item }) => (
                  <ThemedView type="backgroundElement" style={[styles.card, { width: cardWidth }]}>
                    {item.signedUrl ? (
                      <Image
                        source={{ uri: item.signedUrl }}
                        style={[
                          styles.cardImage,
                          { width: cardWidth, backgroundColor: theme.backgroundSelected },
                        ]}
                        contentFit="cover"
                      />
                    ) : (
                      <ThemedView type="backgroundSelected" style={[styles.cardImage, { width: cardWidth }]} />
                    )}
                    <ThemedView style={styles.cardLabel}>
                      <ThemedText type="smallBold" numberOfLines={1}>
                        {CATEGORY_LABELS[item.category]}
                      </ThemedText>
                      {item.color && (
                        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                          {item.color}
                        </ThemedText>
                      )}
                    </ThemedView>
                  </ThemedView>
                )}
              />
            )}
          </>
        ) : savedLoading ? (
          <ThemedView style={styles.centered}>
            <ActivityIndicator />
          </ThemedView>
        ) : savedError ? (
          <ThemedView style={styles.centered}>
            <ThemedText type="small" style={styles.errorText}>
              {savedError}
            </ThemedText>
          </ThemedView>
        ) : savedOutfits.length === 0 ? (
          <ThemedView style={styles.centered}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              No saved outfits yet -- tap the star on an outfit in the Today tab to keep it here.
            </ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={savedOutfits}
            keyExtractor={(outfit) => outfit.id}
            contentContainerStyle={[styles.savedList, { paddingBottom: BottomTabInset + Spacing.four }]}
            ItemSeparatorComponent={() => <ThemedView style={styles.savedSeparator} />}
            renderItem={({ item }) => (
              <OutfitCard outfit={item} onChange={handleSavedOutfitChange} showWeather />
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    fontSize: 32,
    lineHeight: 40,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  segmentButton: {
    flex: 1,
  },
  segmentInner: {
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    alignItems: 'center',
  },
  filterRow: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  filterChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  grid: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  card: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  cardImage: {
    aspectRatio: 1,
  },
  cardLabel: {
    padding: Spacing.two,
    gap: 2,
  },
  savedList: {
    paddingHorizontal: Spacing.four,
  },
  savedSeparator: {
    height: Spacing.four,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  errorText: {
    textAlign: 'center',
    color: '#d33',
  },
  emptyText: {
    textAlign: 'center',
  },
});
