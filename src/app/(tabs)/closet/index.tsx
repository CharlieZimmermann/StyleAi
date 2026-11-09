import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/animated-pressable';
import { OutfitCard, OutfitCardSkeleton } from '@/components/outfit-card';
import { PrimaryButton } from '@/components/primary-button';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, CardShadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listClothingItems } from '@/lib/clothing-items';
import { errorMessage } from '@/lib/errors';
import { listSavedOutfits } from '@/lib/outfits';
import {
  generateWishlistSuggestions,
  listWishlistSuggestions,
  setSuggestionStatus,
} from '@/lib/wishlist';
import {
  CATEGORY_LABELS,
  CLOTHING_CATEGORIES,
  clothingItemLabel,
  type ClothingCategory,
  type ClothingItem,
} from '@/types/clothing';
import type { Outfit } from '@/types/outfit';
import type { WishlistSuggestion } from '@/types/wishlist';

type ClosetItem = ClothingItem & { signedUrl: string | null };
type Segment = 'items' | 'saved' | 'wishlist';

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

  const [suggestions, setSuggestions] = useState<WishlistSuggestion[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(true);
  const [wishlistError, setWishlistError] = useState<string | null>(null);
  const [findingGaps, setFindingGaps] = useState(false);

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

  const loadWishlist = useCallback(async () => {
    setWishlistError(null);
    try {
      setSuggestions(await listWishlistSuggestions());
    } catch (err) {
      setWishlistError(errorMessage(err, 'Could not load suggestions.'));
    } finally {
      setWishlistLoading(false);
    }
  }, []);

  // Re-fetch every time this tab regains focus (e.g. after adding an item or
  // starring an outfit elsewhere), not just on first mount.
  useFocusEffect(
    useCallback(() => {
      void loadItems();
      void loadSaved();
      void loadWishlist();
    }, [loadItems, loadSaved, loadWishlist]),
  );

  function handleSavedOutfitChange(next: Outfit) {
    if (next.isSaved) {
      setSavedOutfits((prev) => prev.map((outfit) => (outfit.id === next.id ? next : outfit)));
    } else {
      // Unstarred from here -- it no longer belongs in this list.
      setSavedOutfits((prev) => prev.filter((outfit) => outfit.id !== next.id));
    }
  }

  async function handleFindGaps() {
    setFindingGaps(true);
    setWishlistError(null);
    try {
      await generateWishlistSuggestions();
      await loadWishlist();
    } catch (err) {
      setWishlistError(errorMessage(err, "Couldn't find gaps right now."));
    } finally {
      setFindingGaps(false);
    }
  }

  async function handleSuggestionStatus(id: string, status: 'dismissed' | 'purchased') {
    // Optimistic: both statuses remove it from this (suggested-only) list.
    setSuggestions((prev) => prev.filter((item) => item.id !== id));
    try {
      await setSuggestionStatus(id, status);
    } catch (err) {
      Alert.alert('Could not update', errorMessage(err));
      void loadWishlist(); // out of sync with the server -- refetch to recover
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
          {(['items', 'saved', 'wishlist'] as const).map((value) => {
            const active = segment === value;
            const label = value === 'items' ? 'Items' : value === 'saved' ? 'Saved Outfits' : 'Wishlist';
            return (
              <AnimatedPressable
                key={value}
                scaleTo={0.97}
                haptic={false}
                style={styles.segmentButton}
                onPress={() => {
                  if (value !== segment) void Haptics.selectionAsync();
                  setSegment(value);
                }}>
                <ThemedView
                  type={active ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.segmentInner}>
                  <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
                    {label}
                  </ThemedText>
                </ThemedView>
              </AnimatedPressable>
            );
          })}
        </ThemedView>

        <Animated.View key={segment} entering={FadeIn.duration(200)} style={styles.segmentContent}>
        {segment === 'items' ? (
          <>
            <Pressable style={styles.buildOutfitRow} onPress={() => router.push('/closet/build-outfit')}>
              <ThemedText type="linkPrimary">+ Build an outfit</ThemedText>
            </Pressable>

            <FlatList
              horizontal
              data={FILTERS}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              renderItem={({ item: chip }) => {
                const active = chip === filter;
                return (
                  <AnimatedPressable scaleTo={0.94} onPress={() => setFilter(chip)}>
                    <ThemedView
                      type={active ? 'backgroundSelected' : 'backgroundElement'}
                      style={styles.filterChip}>
                      <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
                        {filterLabel(chip)}
                      </ThemedText>
                    </ThemedView>
                  </AnimatedPressable>
                );
              }}
            />

            {itemsLoading ? (
              <ThemedView style={[styles.grid, styles.skeletonGrid]}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <ThemedView key={i} style={{ width: cardWidth }}>
                    <ThemedView type="backgroundElement" style={styles.card}>
                      <Skeleton style={styles.cardImage} borderRadius={0} />
                      <ThemedView style={styles.cardLabel}>
                        <Skeleton height={13} width="70%" />
                        <Skeleton height={11} width="45%" />
                      </ThemedView>
                    </ThemedView>
                  </ThemedView>
                ))}
              </ThemedView>
            ) : itemsError ? (
              <ThemedView style={styles.centered}>
                <ThemedText type="small" style={[styles.errorText, { color: theme.danger }]}>
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
                renderItem={({ item, index }) => {
                  const label = clothingItemLabel(item);
                  return (
                    <Animated.View
                      entering={FadeInUp.duration(300).delay(Math.min(index, 9) * 40).springify().damping(18)}
                      style={[{ width: cardWidth }, CardShadow]}>
                      <AnimatedPressable scaleTo={0.97} onPress={() => router.push(`/closet/${item.id}`)}>
                        <ThemedView type="backgroundElement" style={styles.card}>
                          {item.signedUrl ? (
                            <Image
                              source={{ uri: item.signedUrl }}
                              style={[styles.cardImage, { backgroundColor: theme.backgroundSelected }]}
                              contentFit="cover"
                            />
                          ) : (
                            <ThemedView type="backgroundSelected" style={styles.cardImage} />
                          )}
                          <ThemedView style={styles.cardLabel}>
                            <ThemedText type="smallBold" numberOfLines={1}>
                              {label.title}
                            </ThemedText>
                            {label.subtitle && (
                              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                                {label.subtitle}
                              </ThemedText>
                            )}
                          </ThemedView>
                        </ThemedView>
                      </AnimatedPressable>
                    </Animated.View>
                  );
                }}
              />
            )}
          </>
        ) : segment === 'saved' ? (
          savedLoading ? (
            <ThemedView style={styles.savedList}>
              <OutfitCardSkeleton />
            </ThemedView>
          ) : savedError ? (
            <ThemedView style={styles.centered}>
              <ThemedText type="small" style={[styles.errorText, { color: theme.danger }]}>
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
          )
        ) : (
          <>
            <ThemedView style={styles.wishlistIntro}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.wishlistIntroText}>
                Staples missing from your closet, based on what you own and your preferences (set in
                the Account tab).
              </ThemedText>
              <PrimaryButton label="Find gaps" onPress={handleFindGaps} loading={findingGaps} />
            </ThemedView>

            {wishlistError && (
              <ThemedText type="small" style={[styles.errorText, { color: theme.danger }]}>
                {wishlistError}
              </ThemedText>
            )}

            {wishlistLoading ? (
              <ThemedView style={[styles.savedList, styles.skeletonStack]}>
                {[0, 1, 2].map((i) => (
                  <ThemedView key={i} type="backgroundElement" style={[styles.suggestionCard, CardShadow]}>
                    <Skeleton height={14} width="60%" />
                    <Skeleton height={12} width="35%" />
                    <Skeleton height={12} width="90%" />
                  </ThemedView>
                ))}
              </ThemedView>
            ) : suggestions.length === 0 && !wishlistError ? (
              <ThemedView style={styles.centered}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  No suggestions yet -- tap &quot;Find gaps&quot; above.
                </ThemedText>
              </ThemedView>
            ) : (
              <FlatList
                data={suggestions}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[styles.savedList, { paddingBottom: BottomTabInset + Spacing.four }]}
                ItemSeparatorComponent={() => <ThemedView style={styles.savedSeparator} />}
                renderItem={({ item, index }) => (
                  <Animated.View
                    entering={FadeInUp.duration(300).delay(Math.min(index, 9) * 50).springify().damping(18)}>
                    <ThemedView type="backgroundElement" style={[styles.suggestionCard, CardShadow]}>
                    <ThemedText type="smallBold">{item.productName}</ThemedText>
                    {item.brand && (
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.brand}
                      </ThemedText>
                    )}
                    {item.reason && <ThemedText type="small">{item.reason}</ThemedText>}
                    <ThemedView style={styles.suggestionActions}>
                      {item.productUrl && (
                        <Pressable onPress={() => Linking.openURL(item.productUrl!)}>
                          <ThemedText type="linkPrimary">Shop options</ThemedText>
                        </Pressable>
                      )}
                      <Pressable onPress={() => handleSuggestionStatus(item.id, 'purchased')}>
                        <ThemedText type="linkPrimary">Bought it</ThemedText>
                      </Pressable>
                      <Pressable onPress={() => handleSuggestionStatus(item.id, 'dismissed')}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Dismiss
                        </ThemedText>
                      </Pressable>
                    </ThemedView>
                  </ThemedView>
                  </Animated.View>
                )}
              />
            )}
          </>
        )}
        </Animated.View>
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
  segmentContent: {
    flex: 1,
  },
  buildOutfitRow: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
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
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skeletonStack: {
    gap: Spacing.four,
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
  wishlistIntro: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  wishlistIntroText: {
    lineHeight: 20,
  },
  suggestionCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  suggestionActions: {
    flexDirection: 'row',
    gap: Spacing.four,
    marginTop: Spacing.one,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  errorText: {
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
});
