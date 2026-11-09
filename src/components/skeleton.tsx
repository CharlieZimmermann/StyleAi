import { useEffect } from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  width?: DimensionValue;
  /** Omit for a shape sized by `style` instead (e.g. an aspectRatio square). */
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * A pulsing placeholder block for loading states. Swap in instead of a bare
 * ActivityIndicator wherever the eventual content has a known shape (a card,
 * a grid, a line of text) -- the loading state then previews the layout
 * instead of just spinning in empty space. Compose a few of these into a
 * `*Skeleton` component shaped like the real content (see
 * `OutfitCardSkeleton` in outfit-card.tsx).
 */
export function Skeleton({ width = '100%', height, borderRadius = Spacing.one, style }: Props) {
  const theme = useTheme();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    // .set(), not .value = -- see the note in animated-pressable.tsx.
    opacity.set(withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      style={[
        { width, borderRadius, backgroundColor: theme.backgroundSelected },
        height !== undefined && { height },
        animatedStyle,
        style,
      ]}
    />
  );
}
