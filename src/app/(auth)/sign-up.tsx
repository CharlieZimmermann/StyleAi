import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function SignUpScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignUp() {
    setErrorMessage(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setSubmitting(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    // With email confirmation disabled (dev setting), this also returns an
    // active session, so onAuthStateChange signs the user straight in and
    // Stack.Protected swaps to (tabs) -- same as after handleLogin.
    // This is also the moment the supabase/schema.sql trigger fires and
    // creates the matching public.users row.
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Sign up
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
          placeholder="Password (min 6 characters)"
          placeholderTextColor={theme.textSecondary}
          autoComplete="password-new"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {errorMessage && <ThemedText style={styles.error}>{errorMessage}</ThemedText>}

        <Pressable
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleSignUp}
          disabled={submitting || !email || !password}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.buttonText}>Sign up</ThemedText>
          )}
        </Pressable>

        <Link href="/" style={styles.link}>
          <ThemedText type="link" themeColor="textSecondary">
            Already have an account? <ThemedText type="linkPrimary">Log in</ThemedText>
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
    backgroundColor: '#208AEF',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#d33',
  },
  link: {
    alignSelf: 'center',
    marginTop: Spacing.three,
  },
});
