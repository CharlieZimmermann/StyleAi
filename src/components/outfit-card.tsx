import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';
import { logWorn, setOutfitSaved } from '@/lib/outfits';
import { CATEGORY_LABELS } from '@/types/clothing';
import type { Outfit } from '@/types/outfit';

type Props = {
  outfit: Outfit;
  /** Called with the updated outfit after a successful wear/save action. */
  onChange?: (next: Outfit) => void;
  showWeather?: boolean;
};

/** One outfit: its items, the AI's reason, and Wear/Save actions. Reused by
 * the Today tab (daily + event outfits) and the Closet tab's Saved section. */
export function OutfitCard({ outfit, onChange, showWeather = false }: Props) {
  const theme = useTheme();
  const { session } = useAuth();
  const [wearing, setWearing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleWear() {
    if (!session) return;
    setWearing(true);
    try {
      await logWorn(
        session.user.id,
        outfit.items.map((item) => item.id),
      );
      onChange?.({ ...outfit, wornToday: true });
    } catch (err) {
      Alert.alert('Could not log outfit', errorMessage(err));
    } finally {
      setWearing(false);
    }
  }

  async function handleToggleSaved() {
    setSaving(true);
    try {
      const next = !outfit.isSaved;
      await setOutfitSaved(outfit.id, next);
      onChange?.({ ...outfit, isSaved: next });
    } catch (err) {
      Alert.alert('Could not update', errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.wrapper}>
      {outfit.eventPrompt && (
        <ThemedText type="smallBold" numberOfLines={1}>
          For: {outfit.eventPrompt}
        </ThemedText>
      )}

      {showWeather && outfit.weather && (
        <ThemedView type="backgroundElement" style={styles.weatherRow}>
          <ThemedText type="smallBold">{outfit.weather.condition}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {outfit.weather.temperatureF}°F (feels {outfit.weather.feelsLikeF}°F)
          </ThemedText>
        </ThemedView>
      )}

      <ThemedView style={styles.grid}>
        {outfit.items.map((item) => (
          <ThemedView key={item.id} type="backgroundElement" style={styles.itemCard}>
            {item.signedUrl ? (
              <Image
                source={{ uri: item.signedUrl }}
                style={[styles.itemImage, { backgroundColor: theme.backgroundSelected }]}
                contentFit="cover"
              />
            ) : (
              <ThemedView type="backgroundSelected" style={styles.itemImage} />
            )}
            <ThemedView style={styles.itemLabel}>
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
        ))}
      </ThemedView>

      {outfit.reason && (
        <ThemedView type="backgroundElement" style={styles.reasonCard}>
          <ThemedText type="small">{outfit.reason}</ThemedText>
        </ThemedView>
      )}

      <ThemedView style={styles.actionRow}>
        <Pressable
          style={[styles.wearButton, (outfit.wornToday || wearing) && styles.buttonDisabled]}
          onPress={handleWear}
          disabled={outfit.wornToday || wearing}>
          {wearing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.wearButtonText}>
              {outfit.wornToday ? 'Worn today ✓' : 'Wear this'}
            </ThemedText>
          )}
        </Pressable>

        <Pressable
          style={styles.saveButton}
          onPress={handleToggleSaved}
          disabled={saving}
          accessibilityLabel={outfit.isSaved ? 'Unsave outfit' : 'Save outfit'}>
          {saving ? (
            <ActivityIndicator />
          ) : (
            <SymbolView
              tintColor={outfit.isSaved ? '#208AEF' : theme.textSecondary}
              name={outfit.isSaved ? 'star.fill' : 'star'}
              size={22}
            />
          )}
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.three,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  itemCard: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    aspectRatio: 1,
  },
  itemLabel: {
    padding: Spacing.two,
    gap: 2,
    backgroundColor: 'transparent',
  },
  reasonCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  wearButton: {
    flex: 1,
    backgroundColor: '#208AEF',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  wearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    width: 48,
    height: 48,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
