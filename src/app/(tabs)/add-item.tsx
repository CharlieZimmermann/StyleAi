import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/animated-pressable';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, CardShadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { requestClothingTags } from '@/lib/ai-tagging';
import { createClothingItem, deleteClothingImage, uploadClothingImage } from '@/lib/clothing-items';
import { errorMessage } from '@/lib/errors';
import {
  CATEGORY_LABELS,
  CLOTHING_CATEGORIES,
  SEASONS,
  SEASON_LABELS,
  type ClothingCategory,
  type Season,
  type SuggestedTags,
} from '@/types/clothing';

// Resize/compress before both AI tagging and upload, so we send one small,
// consistent image everywhere instead of a multi-MB camera photo. Sized a
// bit larger and less compressed than a minimal thumbnail so small text or
// graphics (e.g. a band tour tee) stay legible to the AI tagger.
const RESIZE_WIDTH = 1280;
const JPEG_QUALITY = 0.85;

type Picked = { uri: string; base64: string };

export default function AddItemScreen() {
  const theme = useTheme();
  const { session } = useAuth();

  const [photo, setPhoto] = useState<Picked | null>(null);
  const [tagging, setTagging] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ClothingCategory | null>(null);
  const [color, setColor] = useState('');
  const [season, setSeason] = useState<Season | null>(null);
  const [brand, setBrand] = useState('');
  const [aiTags, setAiTags] = useState<SuggestedTags | null>(null);

  function resetForm() {
    setPhoto(null);
    setTagError(null);
    setTitle('');
    setCategory(null);
    setColor('');
    setSeason(null);
    setBrand('');
    setAiTags(null);
  }

  async function processPickedImage(uri: string) {
    const image = await ImageManipulator.manipulate(uri).resize({ width: RESIZE_WIDTH }).renderAsync();
    const result = await image.saveAsync({
      base64: true,
      compress: JPEG_QUALITY,
      format: SaveFormat.JPEG,
    });
    if (!result.base64) throw new Error('Could not process the photo.');

    setPhoto({ uri: result.uri, base64: result.base64 });
    setTagError(null);
    setTagging(true);
    try {
      const tags = await requestClothingTags(result.base64);
      setTitle(tags.title);
      setCategory(tags.category);
      setColor(tags.color);
      setSeason(tags.season);
      setAiTags(tags);
    } catch (err) {
      // AI tagging is a convenience, not a requirement -- let the user
      // keep going and fill the form in by hand.
      setTagError(errorMessage(err, 'Could not identify this item automatically.'));
    } finally {
      setTagging(false);
    }
  }

  async function handleTakePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Enable camera access in Settings to photograph items.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (!result.canceled) await processPickedImage(result.assets[0].uri);
  }

  async function handlePickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Enable photo library access in Settings to add items.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!result.canceled) await processPickedImage(result.assets[0].uri);
  }

  async function handleSave() {
    if (!photo || !category || !session) return;
    setSaving(true);
    let uploadedPath: string | null = null;
    try {
      uploadedPath = await uploadClothingImage(session.user.id, photo.base64);
      await createClothingItem(session.user.id, {
        imagePath: uploadedPath,
        title: title.trim() || null,
        category,
        color: color.trim() || null,
        season,
        brand: brand.trim() || null,
        aiTags: aiTags,
      });
      resetForm();
      router.navigate('/closet'); // back to the Closet tab
    } catch (err) {
      // Don't leave an orphaned photo in Storage if the row never got saved.
      if (uploadedPath) await deleteClothingImage(uploadedPath).catch(() => {});
      Alert.alert('Could not save item', errorMessage(err, 'Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  const canSave = !!photo && !!category && !saving;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: BottomTabInset + Spacing.four }]}>
          <ThemedText type="title" style={styles.header}>
            Add Item
          </ThemedText>

          {photo ? (
            <Pressable onPress={resetForm}>
              <Image source={{ uri: photo.uri }} style={styles.preview} contentFit="cover" />
              <ThemedText type="small" themeColor="textSecondary" style={styles.retakeHint}>
                Tap photo to start over
              </ThemedText>
            </Pressable>
          ) : (
            <ThemedView style={styles.pickerRow}>
              <AnimatedPressable style={[styles.pickerButton, CardShadow]} onPress={handleTakePhoto}>
                <ThemedView type="backgroundElement" style={styles.pickerButtonInner}>
                  <ThemedText type="link">Take Photo</ThemedText>
                </ThemedView>
              </AnimatedPressable>
              <AnimatedPressable style={[styles.pickerButton, CardShadow]} onPress={handlePickFromLibrary}>
                <ThemedView type="backgroundElement" style={styles.pickerButtonInner}>
                  <ThemedText type="link">Choose from Library</ThemedText>
                </ThemedView>
              </AnimatedPressable>
            </ThemedView>
          )}

          {photo && (
            <ThemedView style={styles.form}>
              {tagging && (
                <ThemedView style={styles.taggingRow}>
                  <ActivityIndicator />
                  <ThemedText type="small" themeColor="textSecondary">
                    Identifying item...
                  </ThemedText>
                </ThemedView>
              )}
              {tagError && (
                <ThemedText type="small" style={{ color: theme.danger }}>
                  {tagError} You can still fill this in yourself below.
                </ThemedText>
              )}

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
                label={category ? 'Save to Closet' : 'Pick a category to save'}
                onPress={handleSave}
                loading={saving}
                disabled={!canSave}
                style={styles.saveButton}
              />
            </ThemedView>
          )}
        </ScrollView>
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
  scrollContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    fontSize: 32,
    lineHeight: 40,
    paddingTop: Spacing.three,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  pickerButton: {
    flex: 1,
  },
  pickerButtonInner: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.five,
    alignItems: 'center',
  },
  preview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Spacing.three,
  },
  retakeHint: {
    textAlign: 'center',
    marginTop: Spacing.one,
  },
  form: {
    gap: Spacing.two,
  },
  taggingRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
});
