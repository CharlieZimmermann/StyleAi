import type { ClothingItem } from '@/types/clothing';

/** Mirrors WeatherSnapshot in supabase/functions/_shared/weather.ts. */
export type WeatherSnapshot = {
  temperatureF: number;
  feelsLikeF: number;
  highF: number;
  lowF: number;
  precipitationChance: number;
  windMph: number;
  condition: string;
  weatherCode: number;
  locationName: string | null;
};

export type OutfitItem = ClothingItem & { signedUrl: string | null };

export type Outfit = {
  id: string;
  /** YYYY-MM-DD, the device's local date when it was generated. */
  outfitDate: string;
  outfitType: 'daily' | 'event' | 'manual';
  eventPrompt: string | null;
  reason: string | null;
  weather: WeatherSnapshot | null;
  items: OutfitItem[];
  /** True once every item in the outfit has a wear_log entry for today. */
  wornToday: boolean;
};

/** Where the weather should come from: GPS coordinates, or a saved city name. */
export type WeatherLocation = { latitude: number; longitude: number } | { city: string };
