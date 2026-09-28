import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';
import { generateOutfit, getTodaysOutfit, logWorn } from '@/lib/outfits';
import { getHomeCity, setHomeCity } from '@/lib/profile';
import { CATEGORY_LABELS } from '@/types/clothing';
import type { Outfit, WeatherLocation, WeatherSnapshot } from '@/types/outfit';

type Status = 'loading' | 'generating' | 'ready' | 'needs-city' | 'error';

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
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [cityInput, setCityInput] = useState('');
  const [wearing, setWearing] = useState(false);

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

  // Show today's outfit if one exists; otherwise generate it once automatically.
  const load = useCallback(async () => {
    if (!userId || busy.current) return;
    busy.current = true;
    try {
      const existing = await getTodaysOutfit();
      if (existing) {
        applyOutfit(existing);
        setStatus('ready');
      } else if (!autoTried.current) {
        autoTried.current = true;
        await generate();
      } else if (outfitRef.current === null) {
        setStatus((current) => (current === 'loading' ? 'ready' : current));
      }
    } catch (err) {
      setError(errorMessage(err, "Couldn't load today's outfit."));
      setStatus('error');
    } finally {
      busy.current = false;
    }
  }, [userId, applyOutfit, generate]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
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

  async function handleWear() {
    if (!userId || !outfit) return;
    setWearing(true);
    try {
      await logWorn(
        userId,
        outfit.items.map((item) => item.id),
      );
      applyOutfit({ ...outfit, wornToday: true });
    } catch (err) {
      Alert.alert('Could not log outfit', errorMessage(err));
    } finally {
      setWearing(false);
    }
  }

  const cardWidth = (width - Spacing.four * 2 - Spacing.three) / 2;
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
              {outfit.weather && <WeatherCard weather={outfit.weather} />}

              <ThemedView style={styles.grid}>
                {outfit.items.map((item) => (
                  <ThemedView
                    key={item.id}
                    type="backgroundElement"
                    style={[styles.itemCard, { width: cardWidth }]}>
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
                        {CATEGORY_LABELS[item.category]}
                      </ThemedText>
                      {item.color && (
                        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                          {item.color}
                        </ThemedText>
                      )}
                    </ThemedView>
                  </ThemedView>
                ))}
              </ThemedView>

              {outfit.reason && (
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="small">{outfit.reason}</ThemedText>
                </ThemedView>
              )}

              <Pressable
                style={[styles.primaryButton, (outfit.wornToday || wearing) && styles.buttonDisabled]}
                onPress={handleWear}
                disabled={outfit.wornToday || wearing}>
                {wearing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>
                    {outfit.wornToday ? 'Worn today ✓' : 'Wear this'}
                  </ThemedText>
                )}
              </Pressable>

              <Pressable onPress={() => runGenerate({ regenerate: true })}>
                <ThemedText type="linkPrimary" style={styles.centerText}>
                  Not feeling it? Get a different outfit
                </ThemedText>
              </Pressable>
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

function WeatherCard({ weather }: { weather: WeatherSnapshot }) {
  return (
    <ThemedView type="backgroundElement" style={[styles.card, styles.weatherCard]}>
      <ThemedView style={styles.weatherMain}>
        <ThemedText type="title">{weather.temperatureF}°</ThemedText>
        <ThemedView style={styles.weatherDetails}>
          <ThemedText type="smallBold">{weather.condition}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Feels like {weather.feelsLikeF}° · H {weather.highF}° L {weather.lowF}°
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {weather.precipitationChance}% precipitation · {weather.windMph} mph wind
          </ThemedText>
          {weather.locationName && (
            <ThemedText type="small" themeColor="textSecondary">
              {weather.locationName}
            </ThemedText>
          )}
        </ThemedView>
      </ThemedView>
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
  weatherCard: {
    padding: Spacing.four,
  },
  weatherMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    backgroundColor: 'transparent',
  },
  weatherDetails: {
    flex: 1,
    gap: 2,
    backgroundColor: 'transparent',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  itemCard: {
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
