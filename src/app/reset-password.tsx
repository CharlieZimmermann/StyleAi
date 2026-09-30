import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

const MIN_PASSWORD_LENGTH = 6; // Supabase's own default minimum

/**
 * Reached only via a password-recovery deep link (see src/app/_layout.tsx's
 * recoveryMode guard and src/context/auth-context.tsx). The recovery link
 * already established a real session by the time this screen shows, so
 * updateUser works directly -- no separate "current password" needed.
 */
export default function ResetPasswordScreen() {
  const theme = useTheme();
  const { exitRecoveryMode } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setSubmitting(false);
    if (updateError) {
      setError(errorMessage(updateError));
      return;
    }
    // Now a normal signed-in session -- let the root layout route to (tabs).
    exitRecoveryMode();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Set a new password
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Choose a new password for your account.
        </ThemedText>

        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          placeholder={`New password (min ${MIN_PASSWORD_LENGTH} characters)`}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          autoComplete="password-new"
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          placeholder="Confirm new password"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          autoComplete="password-new"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}

        <PrimaryButton
          label="Set password"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!newPassword || !confirmPassword}
          style={styles.button}
        />
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
    marginBottom: Spacing.one,
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
});
