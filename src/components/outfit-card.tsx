import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/animated-pressable';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardShadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';
import { logWorn, setOutfitSaved } from '@/lib/outfits';
import { clothingItemLabel } from '@/types/clothing';
import type { Outfit } from '@/types/outfit';

type Props = {
  outfit: Outfit;
  /** Called with the updated outfit after a successful wear/save action. */
  onChange?: (next: Outfit) => void;
  showWeather?: boolean;
};

/** Placeholder shaped like OutfitCard, for while an outfit is still
 * loading/generating -- previews the eventual layout instead of a bare
 * spinner floating in empty space. */
export function OutfitCardSkeleton() {
  return (
    <ThemedView style={styles.wrapper}>
      <Skeleton height={52} borderRadius={Spacing.three} style={CardShadow} />
      <ThemedView style={styles.grid}>
        {[0, 1, 2, 3].map((i) => (
          <ThemedView key={i} style={[styles.itemCard, CardShadow]}>
            <ThemedView type="backgroundElement" style={styles.itemCardInner}>
              <Skeleton style={styles.itemImage} borderRadius={0} />
              <ThemedView style={styles.itemLabel}>
                <Skeleton height={13} width="70%" />
                <Skeleton height={11} width="45%" />
              </ThemedView>
            </ThemedView>
          </ThemedView>
        ))}
      </ThemedView>
      <Skeleton height={44} borderRadius={Spacing.three} style={CardShadow} />
      <ThemedView style={styles.actionRow}>
        <Skeleton height={48} borderRadius={Spacing.two} style={styles.wearButton} />
        <Skeleton width={48} height={48} borderRadius={Spacing.two} />
      </ThemedView>
    </ThemedView>
  );
}

/** One outfit: its items, the AI's reason, and Wear/Save actions. Reused by
 * the Today tab (daily + event outfits) and the Closet tab's Saved section.
 * Reveals itself in (per the original product doc's "outfit reveal" first-
 * class animation requirement) rather than appearing instantly. */
export function OutfitCard({ outfit, onChange, showWeather = false }: Props) {
  const theme = useTheme();
  const { session } = useAuth();
  const [wearing, setWearing] = useState(false);
  const [saving, setSaving] = useState(false);
  const starScale = useSharedValue(1);

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
    // .set(), not .value = -- see the note in animated-pressable.tsx.
    starScale.set(withSequence(withSpring(1.35, { damping: 8 }), withSpring(1, { damping: 10 })));
    void Haptics.selectionAsync();
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

  const starAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: starScale.get() }] }));

  return (
    <Animated.View entering={FadeInUp.duration(450).springify().damping(16)} style={styles.wrapper}>
      {outfit.eventPrompt && (
        <ThemedText type="smallBold" numberOfLines={1}>
          For: {outfit.eventPrompt}
        </ThemedText>
      )}

      {showWeather && outfit.weather && (
        <ThemedView type="backgroundElement" style={[styles.weatherRow, CardShadow]}>
          <ThemedText type="smallBold">{outfit.weather.condition}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {outfit.weather.temperatureF}°F (feels {outfit.weather.feelsLikeF}°F)
          </ThemedText>
        </ThemedView>
      )}

      <ThemedView style={styles.grid}>
        {outfit.items.map((item, index) => {
          const label = clothingItemLabel(item);
          return (
            <Animated.View
              key={item.id}
              entering={FadeInUp.duration(350).delay(index * 60).springify().damping(16)}
              style={[styles.itemCard, CardShadow]}>
              <ThemedView type="backgroundElement" style={styles.itemCardInner}>
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
                    {label.title}
                  </ThemedText>
                  {label.subtitle && (
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {label.subtitle}
                    </ThemedText>
                  )}
                </ThemedView>
              </ThemedView>
            </Animated.View>
          );
        })}
      </ThemedView>

      {outfit.reason && (
        <ThemedView type="backgroundElement" style={[styles.reasonCard, CardShadow]}>
          <ThemedText type="small">{outfit.reason}</ThemedText>
        </ThemedView>
      )}

      <ThemedView style={styles.actionRow}>
        <AnimatedPressable
          style={[
            styles.wearButton,
            { backgroundColor: theme.tint },
            (outfit.wornToday || wearing) && styles.buttonDisabled,
          ]}
          onPress={handleWear}
          disabled={outfit.wornToday || wearing}>
          {wearing ? (
            <ActivityIndicator color={theme.tintText} />
          ) : (
            <ThemedText style={[styles.wearButtonText, { color: theme.tintText }]}>
              {outfit.wornToday ? 'Worn today ✓' : 'Wear this'}
            </ThemedText>
          )}
        </AnimatedPressable>

        <AnimatedPressable
          style={styles.saveButton}
          onPress={handleToggleSaved}
          disabled={saving}
          haptic={false}
          accessibilityLabel={outfit.isSaved ? 'Unsave outfit' : 'Save outfit'}>
          {saving ? (
            <ActivityIndicator />
          ) : (
            <Animated.View style={starAnimatedStyle}>
              <SymbolView
                tintColor={outfit.isSaved ? theme.tint : theme.textSecondary}
                name={outfit.isSaved ? 'star.fill' : 'star'}
                size={22}
              />
            </Animated.View>
          )}
        </AnimatedPressable>
      </ThemedView>
    </Animated.View>
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
  },
  itemCardInner: {
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
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  wearButtonText: {
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
