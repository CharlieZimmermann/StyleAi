import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';
import { listClothingItems } from '@/lib/clothing-items';
import { createManualOutfit } from '@/lib/outfits';
import { clothingItemLabel, type ClothingItem } from '@/types/clothing';

type ClosetItem = ClothingItem & { signedUrl: string | null };

/** Hand-pick items into an outfit -- no AI. Reached from Closet > + Build an outfit. */
export default function BuildOutfitScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { session } = useAuth();

  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listClothingItems()
      .then(setItems)
      .catch((err) => setLoadError(errorMessage(err, 'Could not load your closet.')))
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!session || selected.size === 0) return;
    setSaving(true);
    try {
      await createManualOutfit(session.user.id, Array.from(selected));
      Alert.alert('Outfit saved', 'Find it under Closet → Saved Outfits.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Could not save outfit', errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const numColumns = 2;
  const gridGap = Spacing.three;
  const cardWidth = (width - gridGap * (numColumns + 1)) / numColumns;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedView style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
            <SymbolView tintColor={theme.text} name="chevron.left" size={20} />
            <ThemedText type="link">Closet</ThemedText>
          </Pressable>
        </ThemedView>

        <ThemedText type="title" style={styles.header}>
          Build an outfit
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subheader}>
          Tap items to add them. {selected.size} selected.
        </ThemedText>

        {loading ? (
          <ThemedView style={styles.centered}>
            <ActivityIndicator />
          </ThemedView>
        ) : loadError ? (
          <ThemedView style={styles.centered}>
            <ThemedText type="small" style={styles.errorText}>
              {loadError}
            </ThemedText>
          </ThemedView>
        ) : items.length === 0 ? (
          <ThemedView style={styles.centered}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              Your closet is empty -- add items first.
            </ThemedText>
          </ThemedView>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            numColumns={numColumns}
            contentContainerStyle={[styles.grid, { paddingBottom: BottomTabInset + Spacing.six }]}
            columnWrapperStyle={{ gap: gridGap }}
            ItemSeparatorComponent={() => <ThemedView style={{ height: gridGap }} />}
            renderItem={({ item }) => {
              const label = clothingItemLabel(item);
              const isSelected = selected.has(item.id);
              return (
                <Pressable onPress={() => toggle(item.id)}>
                  <ThemedView
                    type={isSelected ? 'backgroundSelected' : 'backgroundElement'}
                    style={[styles.card, { width: cardWidth }, isSelected && styles.cardSelected]}>
                    {item.signedUrl ? (
                      <Image
                        source={{ uri: item.signedUrl }}
                        style={[styles.cardImage, { width: cardWidth, backgroundColor: theme.backgroundSelected }]}
                        contentFit="cover"
                      />
                    ) : (
                      <ThemedView type="backgroundSelected" style={[styles.cardImage, { width: cardWidth }]} />
                    )}
                    {isSelected && (
                      <ThemedView style={styles.checkBadge}>
                        <SymbolView tintColor="#fff" name="checkmark" size={14} />
                      </ThemedView>
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
                </Pressable>
              );
            }}
          />
        )}

        {selected.size > 0 && (
          <ThemedView style={[styles.saveBar, { paddingBottom: BottomTabInset + Spacing.two }]}>
            <Pressable
              style={[styles.saveButton, saving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.saveButtonText}>Save outfit ({selected.size})</ThemedText>
              )}
            </Pressable>
          </ThemedView>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  header: {
    fontSize: 32,
    lineHeight: 40,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  subheader: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.three,
  },
  grid: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  card: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: '#208AEF',
  },
  cardImage: {
    aspectRatio: 1,
  },
  cardLabel: {
    padding: Spacing.two,
    gap: 2,
  },
  checkBadge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBar: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  saveButton: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  centerText: {
    textAlign: 'center',
  },
  errorText: {
    textAlign: 'center',
    color: '#d33',
  },
});
