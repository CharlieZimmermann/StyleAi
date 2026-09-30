import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/animated-pressable';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  deleteClothingItem,
  getClothingItem,
  updateClothingItem,
} from '@/lib/clothing-items';
import { errorMessage } from '@/lib/errors';
import {
  CATEGORY_LABELS,
  CLOTHING_CATEGORIES,
  SEASONS,
  SEASON_LABELS,
  type ClothingCategory,
  type ClothingItem,
  type Season,
} from '@/types/clothing';

type Item = ClothingItem & { signedUrl: string | null };

export default function ItemDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ClothingCategory | null>(null);
  const [color, setColor] = useState('');
  const [season, setSeason] = useState<Season | null>(null);
  const [brand, setBrand] = useState('');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getClothingItem(id)
      .then((found) => {
        if (!found) {
          setLoadError('This item no longer exists.');
          return;
        }
        setItem(found);
        setTitle(found.title ?? '');
        setCategory(found.category);
        setColor(found.color ?? '');
        setSeason(found.season);
        setBrand(found.brand ?? '');
      })
      .catch((err) => setLoadError(errorMessage(err, 'Could not load this item.')))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    if (!category) return;
    setSaving(true);
    try {
      await updateClothingItem(id, {
        title: title.trim() || null,
        category,
        color: color.trim() || null,
        season,
        brand: brand.trim() || null,
      });
      router.back();
    } catch (err) {
      Alert.alert('Could not save changes', errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!item) return;
    Alert.alert('Delete this item?', 'This removes its photo and takes it out of any outfits.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteClothingItem(item.id, item.image_url);
            router.back();
          } catch (err) {
            Alert.alert('Could not delete item', errorMessage(err));
            setDeleting(false);
          }
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedView style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
            <SymbolView tintColor={theme.text} name="chevron.left" size={20} />
            <ThemedText type="link">Closet</ThemedText>
          </Pressable>
        </ThemedView>

        {loading ? (
          <ThemedView style={styles.centered}>
            <ActivityIndicator />
          </ThemedView>
        ) : loadError || !item ? (
          <ThemedView style={styles.centered}>
            <ThemedText type="small" style={[styles.errorText, { color: theme.danger }]}>
              {loadError ?? 'Could not load this item.'}
            </ThemedText>
          </ThemedView>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {item.signedUrl ? (
              <Image
                source={{ uri: item.signedUrl }}
                style={[styles.preview, { backgroundColor: theme.backgroundSelected }]}
                contentFit="cover"
              />
            ) : (
              <ThemedView type="backgroundSelected" style={styles.preview} />
            )}

            <ThemedView style={styles.form}>
              <ThemedText type="smallBold">Title</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
                placeholder="e.g. Green Day Tour T-Shirt"
                placeholderTextColor={theme.textSecondary}
                value={title}
                onChangeText={setTitle}
              />

              <ThemedText type="smallBold">Category</ThemedText>
              <ThemedView style={styles.chipWrap}>
                {CLOTHING_CATEGORIES.map((value) => {
                  const active = category === value;
                  return (
                    <AnimatedPressable scaleTo={0.94} key={value} onPress={() => setCategory(value)}>
                      <ThemedView
                        type={active ? 'backgroundSelected' : 'backgroundElement'}
                        style={styles.chip}>
                        <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
                          {CATEGORY_LABELS[value]}
                        </ThemedText>
                      </ThemedView>
                    </AnimatedPressable>
                  );
                })}
              </ThemedView>

              <ThemedText type="smallBold">Season</ThemedText>
              <ThemedView style={styles.chipWrap}>
                {SEASONS.map((value) => {
                  const active = season === value;
                  return (
                    <AnimatedPressable scaleTo={0.94} key={value} onPress={() => setSeason(value)}>
                      <ThemedView
                        type={active ? 'backgroundSelected' : 'backgroundElement'}
                        style={styles.chip}>
                        <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
                          {SEASON_LABELS[value]}
                        </ThemedText>
                      </ThemedView>
                    </AnimatedPressable>
                  );
                })}
              </ThemedView>

              <ThemedText type="smallBold">Color</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
                placeholder="e.g. navy blue"
                placeholderTextColor={theme.textSecondary}
                value={color}
                onChangeText={setColor}
              />

              <ThemedText type="smallBold">Brand (optional)</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
                placeholder="e.g. Uniqlo"
                placeholderTextColor={theme.textSecondary}
                value={brand}
                onChangeText={setBrand}
              />

              <PrimaryButton
                label="Save changes"
                onPress={handleSave}
                loading={saving}
                disabled={!category}
                style={styles.saveButton}
              />

              <PrimaryButton
                label="Delete item"
                onPress={handleDelete}
                loading={deleting}
                variant="dangerText"
              />
            </ThemedView>
          </ScrollView>
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
    paddingBottom: Spacing.three,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  preview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Spacing.three,
  },
  form: {
    gap: Spacing.two,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    marginBottom: Spacing.two,
  },
  saveButton: {
    marginTop: Spacing.two,
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
});
