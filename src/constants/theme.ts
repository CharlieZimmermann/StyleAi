/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// A quieter, more editorial palette than a default bright "tech blue": warm
// off-white/off-black instead of stark #fff/#000, and a muted slate-blue
// accent instead of a saturated primary. Same shape as before so every
// screen consuming these tokens via useTheme() picks it up automatically.
export const Colors = {
  light: {
    text: '#1C1C1E',
    background: '#FAFAF8',
    backgroundElement: '#F1F0EC',
    backgroundSelected: '#E5E2DA',
    textSecondary: '#6E6D68',
    tint: '#3A5A78',
    tintText: '#ffffff',
    danger: '#B3483C',
  },
  dark: {
    text: '#F2F1ED',
    background: '#141414',
    backgroundElement: '#1F1F1E',
    backgroundSelected: '#2A2A28',
    textSecondary: '#9C9A94',
    tint: '#4F7595',
    tintText: '#ffffff',
    danger: '#D97B6C',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// Subtle depth for cards on top of the flat backgroundElement fills --
// spread into a card's style. iOS uses real shadow props; Android (which
// ignores those) uses elevation instead. Deliberately understated (this is
// a light UI, not a heavy skeuomorphic one).
export const CardShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: {
    elevation: 3,
  },
  default: {},
});

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
