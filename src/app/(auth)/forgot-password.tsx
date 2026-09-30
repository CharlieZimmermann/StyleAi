import * as Linking from 'expo-linking';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setError(null);
    setSubmitting(true);
    // createURL adapts to whatever's actually running the app right now --
    // an exp:// URL in Expo Go, or the app's own styleai:// scheme in a real
    // build -- so this works the same way in both without special-casing.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: Linking.createURL('reset-password'),
    });
    setSubmitting(false);
    if (resetError) {
      setError(errorMessage(resetError));
      return;
    }
    setSent(true);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Reset password
        </ThemedText>

        {sent ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              If an account exists for {email}, a reset link is on its way. Open it on this phone
              to set a new password.
            </ThemedText>
            <Pressable style={styles.link} onPress={() => router.replace('/')}>
              <ThemedText type="linkPrimary">Back to log in</ThemedText>
            </Pressable>
          </>
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Enter your account email and we&apos;ll send a link to reset your password.
            </ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
              placeholder="Email"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              returnKeyType="done"
              onSubmitEditing={handleSend}
            />

            {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}

            <PrimaryButton
              label="Send reset link"
              onPress={handleSend}
              loading={submitting}
              disabled={!email}
              style={styles.button}
            />

            <Link href="/" style={styles.link}>
              <ThemedText type="link" themeColor="textSecondary">
                Back to log in
              </ThemedText>
            </Link>
          </>
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
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    marginBottom: Spacing.three,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  button: {
    marginTop: Spacing.two,
  },
  link: {
    alignSelf: 'center',
    marginTop: Spacing.three,
  },
});
