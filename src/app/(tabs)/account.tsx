import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/animated-icon';
import { AnimatedPressable } from '@/components/animated-pressable';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, CardShadow, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { changePassword, deleteMyAccount } from '@/lib/account';
import { errorMessage } from '@/lib/errors';
import { getPreferences, parseTagList, setPreferences } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

const MIN_PASSWORD_LENGTH = 6; // Supabase's own default minimum

export default function AccountScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [signingOut, setSigningOut] = useState(false);

  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [brands, setBrands] = useState('');
  const [styles_, setStyles] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!userId) return;
    getPreferences(userId)
      .then((prefs) => {
        setBudgetMin(prefs.budgetMin?.toString() ?? '');
        setBudgetMax(prefs.budgetMax?.toString() ?? '');
        setBrands(prefs.preferredBrands.join(', '));
        setStyles(prefs.styleTags.join(', '));
      })
      .catch((err) => console.error('Failed to load preferences:', err))
      .finally(() => setLoadingPrefs(false));
  }, [userId]);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    // onAuthStateChange (in AuthProvider) clears the session and
    // Stack.Protected in the root layout swaps back to (auth) -- no
    // manual navigation needed. setSigningOut isn't reset because this
    // screen unmounts once that happens.
  }

  async function handleChangePassword() {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      Alert.alert('Password too short', `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords don't match", 'Check both fields and try again.');
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password updated');
    } catch (err) {
      Alert.alert('Could not update password', errorMessage(err));
    } finally {
      setChangingPassword(false);
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account, closet, outfits, and photos. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteMyAccount();
              await supabase.auth.signOut();
              // onAuthStateChange clears the (already-deleted) session and
              // Stack.Protected swaps to (auth) -- same as a normal sign-out.
            } catch (err) {
              Alert.alert('Could not delete account', errorMessage(err));
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  async function handleSavePreferences() {
    if (!userId) return;
    setSavingPrefs(true);
    try {
      await setPreferences(userId, {
        budgetMin: budgetMin.trim() ? Number(budgetMin) : null,
        budgetMax: budgetMax.trim() ? Number(budgetMax) : null,
        preferredBrands: parseTagList(brands),
        styleTags: parseTagList(styles_),
      });
    } catch (err) {
      Alert.alert('Could not save preferences', errorMessage(err));
    } finally {
      setSavingPrefs(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.four }]}>
          <ThemedView style={styles.heroSection}>
            <AnimatedIcon />
            <ThemedText type="title" style={styles.title}>
              Welcome to&nbsp;StyleAi
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={[styles.card, CardShadow]}>
            <ThemedText type="small" themeColor="textSecondary">
              Signed in as
            </ThemedText>
            <ThemedText type="smallBold">{session?.user.email}</ThemedText>

            <AnimatedPressable
              style={[styles.signOutButton, signingOut && styles.buttonDisabled]}
              onPress={handleSignOut}
              disabled={signingOut}>
              {signingOut ? <ActivityIndicator /> : <ThemedText type="linkPrimary">Sign out</ThemedText>}
            </AnimatedPressable>
          </ThemedView>

          <ThemedView type="backgroundElement" style={[styles.card, CardShadow]}>
            <ThemedText type="smallBold">Style preferences</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Used by the wardrobe gap-finder in the Closet tab to suggest items that fit your
              budget and taste. All optional.
            </ThemedText>

            {loadingPrefs ? (
              <ActivityIndicator style={styles.prefsLoading} />
            ) : (
              <>
                <ThemedText type="small">Budget per item</ThemedText>
                <ThemedView style={styles.budgetRow}>
                  <TextInput
                    style={[styles.input, styles.budgetInput, { backgroundColor: theme.background, color: theme.text }]}
                    placeholder="Min $"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    value={budgetMin}
                    onChangeText={setBudgetMin}
                  />
                  <TextInput
                    style={[styles.input, styles.budgetInput, { backgroundColor: theme.background, color: theme.text }]}
                    placeholder="Max $"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    value={budgetMax}
                    onChangeText={setBudgetMax}
                  />
                </ThemedView>

                <ThemedText type="small">Preferred brands</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                  placeholder="e.g. Uniqlo, J.Crew, Nike"
                  placeholderTextColor={theme.textSecondary}
                  value={brands}
                  onChangeText={setBrands}
                  autoCapitalize="words"
                />

                <ThemedText type="small">Style</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                  placeholder="e.g. minimalist, streetwear"
                  placeholderTextColor={theme.textSecondary}
                  value={styles_}
                  onChangeText={setStyles}
                  autoCapitalize="none"
                />

                <PrimaryButton
                  label="Save preferences"
                  onPress={handleSavePreferences}
                  loading={savingPrefs}
                  style={styles.saveButton}
                />
              </>
            )}
          </ThemedView>

          <ThemedView type="backgroundElement" style={[styles.card, CardShadow]}>
            <ThemedText type="smallBold">Change password</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
              placeholder={`New password (min ${MIN_PASSWORD_LENGTH} characters)`}
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              autoComplete="password-new"
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
              placeholder="Confirm new password"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              autoComplete="password-new"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <PrimaryButton
              label="Update password"
              onPress={handleChangePassword}
              loading={changingPassword}
              disabled={!newPassword || !confirmPassword}
              style={styles.saveButton}
            />
          </ThemedView>

          <ThemedView type="backgroundElement" style={[styles.card, CardShadow]}>
            <ThemedText type="smallBold">Danger zone</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Permanently deletes your account, closet, outfits, and photos. This cannot be undone.
            </ThemedText>
            <PrimaryButton
              label="Delete Account"
              onPress={handleDeleteAccount}
              loading={deleting}
              variant="dangerOutline"
              style={styles.deleteButton}
            />
          </ThemedView>
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
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  signOutButton: {
    marginTop: Spacing.two,
    alignSelf: 'flex-start',
  },
  prefsLoading: {
    marginVertical: Spacing.three,
  },
  budgetRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  budgetInput: {
    flex: 1,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  saveButton: {
    marginTop: Spacing.two,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  deleteButton: {
    marginTop: Spacing.two,
  },
});
