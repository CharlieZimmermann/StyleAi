import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { OutfitCard } from '@/components/outfit-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { hasAnyClothingItems } from '@/lib/clothing-items';
import { errorMessage } from '@/lib/errors';
import { generateOutfit, getTodaysOutfit, listEventOutfits } from '@/lib/outfits';
import { getHomeCity, setHomeCity } from '@/lib/profile';
import type { Outfit, WeatherLocation } from '@/types/outfit';

type Status = 'loading' | 'generating' | 'ready' | 'needs-city' | 'error' | 'empty-closet';

/**
 * Where to get the weather: the phone's GPS if the user allows it, otherwise
 * the city saved on their profile. null means we have neither and need to ask.
 */
async function resolveLocation(userId: string): Promise<WeatherLocation | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.granted) {
      // Low accuracy (city-level) is plenty for weather, and faster.
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.LocationAccuracy.Low,
      });
      return { latitude: position.coords.latitude, longitude: position.coords.longitude };
    }
  } catch {
    // Location services off, timed out, etc. -- fall back to the saved city.
  }
  const city = await getHomeCity(userId);
  return city ? { city } : null;
}

export default function TodayScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [cityInput, setCityInput] = useState('');

  const [eventPromptInput, setEventPromptInput] = useState('');
  const [eventGenerating, setEventGenerating] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [eventOutfits, setEventOutfits] = useState<Outfit[]>([]);

  // Refs, not state, so the callbacks below stay stable. A callback whose
  // identity changed every time `outfit` changed would make useFocusEffect
  // re-run and reload in a loop.
  const outfitRef = useRef<Outfit | null>(null);
  const busy = useRef(false);
  const autoTried = useRef(false);

  const applyOutfit = useCallback((next: Outfit | null) => {
    outfitRef.current = next;
    setOutfit(next);
  }, []);

  const generate = useCallback(
    async (options: { regenerate?: boolean; city?: string } = {}) => {
      if (!userId) return;
      setStatus('generating');
      setError(null);
      try {
        const location = options.city ? { city: options.city } : await resolveLocation(userId);
        if (!location) {
          setStatus('needs-city');
          return;
        }
        const next = await generateOutfit({
          location,
          avoidItemIds: options.regenerate
            ? outfitRef.current?.items.map((item) => item.id)
            : undefined,
        });
        applyOutfit(next);
        setStatus('ready');
      } catch (err) {
        setError(errorMessage(err, "Couldn't get today's outfit."));
        setStatus('error');
      }
    },
    [userId, applyOutfit],
  );

  // Show today's outfit if one exists; otherwise generate it once
  // automatically -- unless the closet is empty, in which case generating
  // would just fail, so show a welcoming prompt instead. The closet-emptiness
  // check runs on every focus (not just once), so returning from the Add tab
  // with a first item picks up the auto-generate on the next visit.
  const load = useCallback(async () => {
    if (!userId || busy.current) return;
    busy.current = true;
    try {
      const existing = await getTodaysOutfit();
      if (existing) {
        applyOutfit(existing);
        setStatus('ready');
        return;
      }
      if (outfitRef.current) {
        // Already generated this session (e.g. after a regenerate) -- keep it.
        setStatus('ready');
        return;
      }
      if (!(await hasAnyClothingItems())) {
        setStatus('empty-closet');
        return;
      }
      if (!autoTried.current) {
        autoTried.current = true;
        await generate();
      } else {
        setStatus((current) => (current === 'loading' ? 'ready' : current));
      }
    } catch (err) {
      setError(errorMessage(err, "Couldn't load today's outfit."));
      setStatus('error');
    } finally {
      busy.current = false;
    }
  }, [userId, applyOutfit, generate]);

  const loadEventOutfits = useCallback(async () => {
    try {
      setEventOutfits(await listEventOutfits(5));
    } catch (err) {
      console.error('Failed to load event outfits:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      void loadEventOutfits();
    }, [load, loadEventOutfits]),
  );

  // Buttons go through here so a double-tap can't start two generations.
  async function runGenerate(options: { regenerate?: boolean; city?: string } = {}) {
    if (busy.current) return;
    busy.current = true;
    try {
      await generate(options);
    } finally {
      busy.current = false;
    }
  }

  async function handleSaveCity() {
    const city = cityInput.trim();
    if (!userId || !city) return;
    try {
      await setHomeCity(userId, city);
    } catch (err) {
      Alert.alert('Could not save city', errorMessage(err));
      return;
    }
    await runGenerate({ city });
  }

  async function handleGenerateEvent() {
    const eventPrompt = eventPromptInput.trim();
    if (!eventPrompt || !userId || eventGenerating) return;
    setEventGenerating(true);
    setEventError(null);
    try {
      const location = await resolveLocation(userId);
      if (!location) {
        setEventError('Set your location above first (see "Where are you?").');
        return;
      }
      await generateOutfit({ location, eventPrompt });
      setEventPromptInput('');
      await loadEventOutfits();
    } catch (err) {
      setEventError(errorMessage(err, "Couldn't put that outfit together."));
    } finally {
      setEventGenerating(false);
    }
  }

  function handleEventOutfitChange(next: Outfit) {
    setEventOutfits((prev) => prev.map((item) => (item.id === next.id ? next : item)));
  }

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.four }]}>
          <ThemedText type="title" style={styles.header}>
            Today
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {dateLabel}
          </ThemedText>

          {(status === 'loading' || status === 'generating') && (
            <ThemedView style={styles.centered}>
              <ActivityIndicator />
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                {status === 'generating' ? 'Checking the weather and picking an outfit...' : 'Loading...'}
              </ThemedText>
            </ThemedView>
          )}

          {status === 'empty-closet' && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">Welcome to Closet!</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Add a few items -- at least a top, a bottom (or a dress), and shoes -- and
                you&apos;ll get your first AI-picked outfit for today&apos;s weather.
              </ThemedText>
              <Pressable style={styles.primaryButton} onPress={() => router.push('/add-item')}>
                <ThemedText style={styles.primaryButtonText}>Add an item</ThemedText>
              </Pressable>
            </ThemedView>
          )}

          {status === 'needs-city' && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">Where are you?</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Location access is off, so enter your city to get the weather for your outfit.
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                placeholder="e.g. Boston"
                placeholderTextColor={theme.textSecondary}
                value={cityInput}
                onChangeText={setCityInput}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleSaveCity}
              />
              <Pressable
                style={[styles.primaryButton, !cityInput.trim() && styles.buttonDisabled]}
                onPress={handleSaveCity}
                disabled={!cityInput.trim()}>
                <ThemedText style={styles.primaryButtonText}>Save and get my outfit</ThemedText>
              </Pressable>
            </ThemedView>
          )}

          {status === 'error' && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" style={styles.errorText}>
                {error}
              </ThemedText>
              <Pressable style={styles.primaryButton} onPress={() => runGenerate()}>
                <ThemedText style={styles.primaryButtonText}>Try again</ThemedText>
              </Pressable>
              <Pressable onPress={() => setStatus('needs-city')}>
                <ThemedText type="linkPrimary" style={styles.centerText}>
                  Use a different city
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}

          {status === 'ready' && outfit && (
            <>
              <OutfitCard outfit={outfit} onChange={applyOutfit} showWeather />

              <Pressable onPress={() => runGenerate({ regenerate: true })}>
                <ThemedText type="linkPrimary" style={styles.centerText}>
                  Not feeling it? Get a different outfit
                </ThemedText>
              </Pressable>
            </>
          )}

          {status !== 'empty-closet' && (
            <>
              <ThemedView style={styles.divider} />

              <ThemedText type="smallBold">Outfit for an occasion</ThemedText>
              <ThemedView style={styles.eventRow}>
                <TextInput
                  style={[styles.input, styles.eventInput, { backgroundColor: theme.backgroundElement, color: theme.text }]}
                  placeholder="e.g. job interview, golf outing"
                  placeholderTextColor={theme.textSecondary}
                  value={eventPromptInput}
                  onChangeText={setEventPromptInput}
                  returnKeyType="done"
                  onSubmitEditing={handleGenerateEvent}
                />
                <Pressable
                  style={[
                    styles.eventButton,
                    (!eventPromptInput.trim() || eventGenerating) && styles.buttonDisabled,
                  ]}
                  onPress={handleGenerateEvent}
                  disabled={!eventPromptInput.trim() || eventGenerating}>
                  {eventGenerating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={styles.primaryButtonText}>Get outfit</ThemedText>
                  )}
                </Pressable>
              </ThemedView>
              {eventError && (
                <ThemedText type="small" style={styles.errorText}>
                  {eventError}
                </ThemedText>
              )}

              {eventOutfits.map((eventOutfit) => (
                <OutfitCard key={eventOutfit.id} outfit={eventOutfit} onChange={handleEventOutfitChange} />
              ))}
            </>
          )}

          <ExternalLink href="https://open-meteo.com/">
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              Weather data by Open-Meteo.com
            </ThemedText>
          </ExternalLink>
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
  },
  header: {
    fontSize: 32,
    lineHeight: 40,
    paddingTop: Spacing.three,
  },
  centered: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.six,
  },
  centerText: {
    textAlign: 'center',
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(128,128,128,0.2)',
    marginVertical: Spacing.two,
  },
  eventRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  eventInput: {
    flex: 1,
  },
  eventButton: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    color: '#d33',
  },
});
