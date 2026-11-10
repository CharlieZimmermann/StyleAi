// Weather via Open-Meteo (https://open-meteo.com): free, no API key, up to
// 10,000 calls/day for non-commercial use, CC BY 4.0 -- the app shows the
// required attribution.

// A hung request here (rather than a clean error) would block
// generate-outfit before it even gets to Gemini, with no feedback to the
// user -- Open-Meteo is normally sub-second, so 10s is generous headroom.
const FETCH_TIMEOUT_MS = 10_000;

export type WeatherSnapshot = {
  temperatureF: number;
  feelsLikeF: number;
  highF: number;
  lowF: number;
  /** Highest chance of precipitation today, 0-100. */
  precipitationChance: number;
  windMph: number;
  condition: string;
  weatherCode: number;
  /** Set when the location came from a city name; null for GPS coordinates. */
  locationName: string | null;
};

// WMO weather interpretation codes, as returned by Open-Meteo.
function describeWeatherCode(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mostly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code === 85 || code === 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorms';
  return 'Unknown';
}

/**
 * Looks up a city by name. Open-Meteo matches on the city name only, so
 * "Boston, MA" is reduced to "Boston".
 */
export async function geocodeCity(
  city: string,
): Promise<{ latitude: number; longitude: number; name: string } | null> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', city.split(',')[0].trim());
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Location lookup failed (${response.status}).`);

  const result = (await response.json()).results?.[0];
  if (!result) return null;

  return {
    latitude: result.latitude,
    longitude: result.longitude,
    name: [result.name, result.admin1].filter(Boolean).join(', '),
  };
}

export async function fetchWeather(
  latitude: number,
  longitude: number,
  locationName: string | null,
): Promise<WeatherSnapshot> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
  );
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  );
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('wind_speed_unit', 'mph');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '1');

  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Weather lookup failed (${response.status}).`);

  const data = await response.json();
  const current = data.current;
  const daily = data.daily;
  if (!current || !daily) throw new Error('Weather service returned an unexpected response.');

  return {
    temperatureF: Math.round(current.temperature_2m),
    feelsLikeF: Math.round(current.apparent_temperature),
    highF: Math.round(daily.temperature_2m_max[0]),
    lowF: Math.round(daily.temperature_2m_min[0]),
    precipitationChance: daily.precipitation_probability_max[0] ?? 0,
    windMph: Math.round(current.wind_speed_10m),
    condition: describeWeatherCode(current.weather_code),
    weatherCode: current.weather_code,
    locationName,
  };
}
