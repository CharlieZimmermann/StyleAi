import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listClothingItems } from '@/lib/clothing-items';
import { errorMessage } from '@/lib/errors';
import { CATEGORY_LABELS, CLOTHING_CATEGORIES, type ClothingCategory, type ClothingItem } from '@/types/clothing';

type ClosetItem = ClothingItem & { signedUrl: string | null };

const FILTERS: (ClothingCategory | 'all')[] = ['all', ...CLOTHING_CATEGORIES];

function filterLabel(filter: ClothingCategory | 'all') {
  return filter === 'all' ? 'All' : CATEGORY_LABELS[filter];
}

export default function ClosetScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ClothingCategory | 'all'>('all');

  const load = useCallback(async () => {
    setError(null);
    try {
      const fetched = await listClothingItems();
      setItems(fetched);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your closet.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch every time this tab regains focus (e.g. after adding an item),
  // not just on first mount.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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

        {loading ? (
          <ThemedView style={styles.centered}>
            <ActivityIndicator />
          </ThemedView>
        ) : error ? (
          <ThemedView style={styles.centered}>
            <ThemedText type="small" style={styles.errorText}>
              {error}
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
            refreshing={loading}
            onRefresh={load}
            contentContainerStyle={[styles.grid, { paddingBottom: BottomTabInset + Spacing.four }]}
            columnWrapperStyle={{ gap: gridGap }}
            ItemSeparatorComponent={() => <ThemedView style={{ height: gridGap }} />}
            renderItem={({ item }) => (
              <ThemedView type="backgroundElement" style={[styles.card, { width: cardWidth }]}>
                {item.signedUrl ? (
                  <Image
                    source={{ uri: item.signedUrl }}
                    style={[styles.cardImage, { width: cardWidth, backgroundColor: theme.backgroundSelected }]}
                    contentFit="cover"
                  />
                ) : (
                  <ThemedView
                    type="backgroundSelected"
                    style={[styles.cardImage, { width: cardWidth }]}
                  />
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
