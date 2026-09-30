import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Pressable, StyleSheet, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/context/auth-context';

SplashScreen.preventAutoHideAsync();

/**
 * Expo Router auto-wraps the whole routed tree in a boundary that renders
 * this on any uncaught render error, instead of a hard crash. Exported by
 * name from a layout file -- that's the whole wiring, no manual <Try> needed.
 * See https://docs.expo.dev/router/error-handling/
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <ThemedView style={errorStyles.container}>
      <ThemedText type="title" style={errorStyles.title}>
        Something went wrong
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={errorStyles.message}>
        {error.message || 'An unexpected error occurred.'}
      </ThemedText>
      <Pressable style={errorStyles.button} onPress={() => void retry()}>
        <ThemedText style={errorStyles.buttonText}>Try again</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
  // Hardcoded, not theme.tint: this screen exists to render when something
  // has already gone wrong, so it deliberately doesn't depend on the theme
  // system (or anything else) being in a working state.
  button: {
    backgroundColor: '#3A5A78',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

function RootNavigator() {
  const { session, loading, recoveryMode } = useAuth();

  // Render nothing while the initial "am I already logged in?" check runs.
  // AnimatedSplashOverlay (rendered alongside this in RootLayout) covers
  // the screen until then, so this doesn't cause a visible blank flash.
  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Takes priority over the session-based routes below: a recovery
          link creates a real session, but the user must set a new password
          before landing in the main app, not skip straight past this. */}
      <Stack.Protected guard={recoveryMode}>
        <Stack.Screen name="reset-password" />
      </Stack.Protected>

      <Stack.Protected guard={!recoveryMode && !session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={!recoveryMode && !!session}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
