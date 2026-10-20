/**
 * Weather from Open-Meteo (https://open-meteo.com): free for non-commercial
 * use, no API key, forecasts from the national weather models for the home's
 * coordinates. The place is chosen once per hub by name through Open-Meteo's
 * geocoder, so Butter needs no location permission.
 */

export interface Place {
  name: string;
  /** Region or county, when the geocoder knows one. */
  region?: string;
  country?: string;
  lat: number;
  lon: number;
}

export interface CurrentWeather {
  time: number;
  temperature: number;
  feelsLike: number;
  humidity: number;
  precipitation: number;
  code: number;
  isDay: boolean;
  windSpeed: number;
  windDirection: number;
}

export interface HourPoint {
  time: number;
  temperature: number;
  code: number;
  isDay: boolean;
  rainChance: number;
  precipitation: number;
}

export interface DayPoint {
  time: number;
  code: number;
  max: number;
  min: number;
  rainChance: number;
  precipitationSum: number;
  sunrise: number;
  sunset: number;
}

export interface Forecast {
  place: Place;
  fetchedAt: number;
  timezone: string;
  /** Seconds to add to a UTC timestamp to get the place's local time. */
  utcOffset: number;
  current: CurrentWeather;
  hourly: HourPoint[];
  daily: DayPoint[];
}

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

interface RawForecast {
  timezone: string;
  utc_offset_seconds: number;
  current: {
    time: number;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    is_day: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
  };
  hourly: {
    time: number[];
    temperature_2m: (number | null)[];
    weather_code: (number | null)[];
    is_day: (number | null)[];
    precipitation_probability: (number | null)[];
    precipitation: (number | null)[];
  };
  daily: {
    time: number[];
    weather_code: (number | null)[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_probability_max: (number | null)[];
    precipitation_sum: (number | null)[];
    sunrise: number[];
    sunset: number[];
  };
}

function num(v: number | null | undefined, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export async function fetchForecast(place: Place, timeoutMs = 10_000): Promise<Forecast> {
  const q = new URLSearchParams({
    latitude: place.lat.toFixed(4),
    longitude: place.lon.toFixed(4),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
    hourly: 'temperature_2m,weather_code,is_day,precipitation_probability,precipitation',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset',
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: '7',
  });
  const raw = await getJson<RawForecast>(`${FORECAST_URL}?${q}`, timeoutMs);
  const cur = raw.current;
  return {
    place,
    fetchedAt: Date.now(),
    timezone: raw.timezone,
    utcOffset: num(raw.utc_offset_seconds),
    current: {
      time: cur.time,
      temperature: num(cur.temperature_2m),
      feelsLike: num(cur.apparent_temperature, num(cur.temperature_2m)),
      humidity: num(cur.relative_humidity_2m),
      precipitation: num(cur.precipitation),
      code: num(cur.weather_code),
      isDay: cur.is_day !== 0,
      windSpeed: num(cur.wind_speed_10m),
      windDirection: num(cur.wind_direction_10m),
    },
    hourly: raw.hourly.time.map((time, i) => ({
      time,
      temperature: num(raw.hourly.temperature_2m[i]),
      code: num(raw.hourly.weather_code[i]),
      isDay: num(raw.hourly.is_day[i], 1) !== 0,
      rainChance: num(raw.hourly.precipitation_probability[i]),
      precipitation: num(raw.hourly.precipitation[i]),
    })),
    daily: raw.daily.time.map((time, i) => ({
      time,
      code: num(raw.daily.weather_code[i]),
      max: num(raw.daily.temperature_2m_max[i]),
      min: num(raw.daily.temperature_2m_min[i]),
      rainChance: num(raw.daily.precipitation_probability_max[i]),
      precipitationSum: num(raw.daily.precipitation_sum[i]),
      sunrise: raw.daily.sunrise[i],
      sunset: raw.daily.sunset[i],
    })),
  };
}

interface RawPlace {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

/** Places matching a typed name, best match first. */
export async function searchPlaces(query: string, timeoutMs = 8_000): Promise<Place[]> {
  const name = query.trim();
  if (name.length < 2) return [];
  const q = new URLSearchParams({ name, count: '8', language: 'en', format: 'json' });
  const raw = await getJson<{ results?: RawPlace[] }>(`${GEOCODE_URL}?${q}`, timeoutMs);
  return (raw.results ?? []).map((r) => ({ name: r.name, region: r.admin1, country: r.country, lat: r.latitude, lon: r.longitude }));
}

async function getJson<T>(url: string, timeoutMs: number): Promise<T> {
  const signal = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(timeoutMs) : undefined;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`weather service answered ${res.status}`);
  return (await res.json()) as T;
}

// ----- presentation helpers ----------------------------------------------------------

export interface Condition {
  label: string;
  /** MaterialCommunityIcons name */
  icon: string;
}

/** WMO weather code to words and an icon. */
export function describeCode(code: number, isDay = true): Condition {
  switch (code) {
    case 0:
      return { label: 'Clear', icon: isDay ? 'weather-sunny' : 'weather-night' };
    case 1:
      return { label: 'Mainly clear', icon: isDay ? 'weather-sunny' : 'weather-night' };
    case 2:
      return { label: 'Partly cloudy', icon: isDay ? 'weather-partly-cloudy' : 'weather-night-partly-cloudy' };
    case 3:
      return { label: 'Overcast', icon: 'weather-cloudy' };
    case 45:
    case 48:
      return { label: 'Fog', icon: 'weather-fog' };
    case 51:
    case 53:
    case 55:
      return { label: 'Drizzle', icon: 'weather-rainy' };
    case 56:
    case 57:
      return { label: 'Freezing drizzle', icon: 'weather-snowy-rainy' };
    case 61:
      return { label: 'Light rain', icon: 'weather-rainy' };
    case 63:
      return { label: 'Rain', icon: 'weather-rainy' };
    case 65:
      return { label: 'Heavy rain', icon: 'weather-pouring' };
    case 66:
    case 67:
      return { label: 'Freezing rain', icon: 'weather-snowy-rainy' };
    case 71:
      return { label: 'Light snow', icon: 'weather-snowy' };
    case 73:
      return { label: 'Snow', icon: 'weather-snowy' };
    case 75:
      return { label: 'Heavy snow', icon: 'weather-snowy-heavy' };
    case 77:
      return { label: 'Snow grains', icon: 'weather-snowy' };
    case 80:
      return { label: 'Light showers', icon: isDay ? 'weather-partly-rainy' : 'weather-rainy' };
    case 81:
      return { label: 'Showers', icon: 'weather-rainy' };
    case 82:
      return { label: 'Heavy showers', icon: 'weather-pouring' };
    case 85:
      return { label: 'Snow showers', icon: 'weather-partly-snowy' };
    case 86:
      return { label: 'Heavy snow showers', icon: 'weather-snowy-heavy' };
    case 95:
      return { label: 'Thunderstorm', icon: 'weather-lightning' };
    case 96:
    case 99:
      return { label: 'Thunderstorm, hail', icon: 'weather-lightning-rainy' };
    default:
      return { label: 'Cloudy', icon: 'weather-cloudy' };
  }
}

export function compass(degrees: number): string {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

/** Hour of day (0–23) at the place, for a UTC timestamp. */
export function localHour(time: number, utcOffset: number): number {
  return new Date((time + utcOffset) * 1000).getUTCHours();
}

/** Short weekday at the place, or "Today" for the current day. */
export function dayLabel(time: number, utcOffset: number, now = Date.now() / 1000): string {
  const d = new Date((time + utcOffset) * 1000);
  const today = new Date((now + utcOffset) * 1000);
  if (d.getUTCDate() === today.getUTCDate() && d.getUTCMonth() === today.getUTCMonth()) return 'Today';
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
}

export function placeLabel(place: Place): string {
  return [place.name, place.country].filter(Boolean).join(', ');
}
