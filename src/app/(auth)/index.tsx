import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogin() {
    setErrorMessage(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    // On success, onAuthStateChange (in AuthProvider) picks up the new
    // session and Stack.Protected in the root layout swaps to (tabs)
    // automatically -- no manual navigation needed here.
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Log in
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
        />
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          placeholder="Password"
          placeholderTextColor={theme.textSecondary}
          autoComplete="password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {errorMessage && <ThemedText style={{ color: theme.danger }}>{errorMessage}</ThemedText>}

        <Link href="/forgot-password" style={styles.forgotLink}>
          <ThemedText type="link" themeColor="textSecondary">
            Forgot password?
          </ThemedText>
        </Link>

        <PrimaryButton
          label="Log in"
          onPress={handleLogin}
          loading={submitting}
          disabled={!email || !password}
          style={styles.button}
        />

        <Link href="/sign-up" style={styles.link}>
          <ThemedText type="link" themeColor="textSecondary">
            Don&apos;t have an account? <ThemedText type="linkPrimary">Sign up</ThemedText>
          </ThemedText>
        </Link>
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
  forgotLink: {
    alignSelf: 'flex-end',
  },
});
