// Open-Meteo — free, no API key required
// Docs: https://open-meteo.com/en/docs

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string; // state/region
}

export async function searchCity(query: string): Promise<GeoResult[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({ name: query.trim(), count: '6', language: 'en', format: 'json' });
  const res = await fetch(`${GEO_URL}?${params}`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.results ?? []).map((r: any) => ({
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    country: r.country,
    admin1: r.admin1,
  }));
}

export interface WeatherDay {
  date: string;             // YYYY-MM-DD
  precipMm: number;         // total precipitation mm
  tempMaxC: number;
  tempMinC: number;
  evapotranspirationMm: number; // water lost from soil/plants
  isRainy: boolean;         // precipMm > 2
  isFuture: boolean;
}

export interface WeatherData {
  timezone: string;
  latitude: number;
  longitude: number;
  days: WeatherDay[];
  locationName?: string;
}

export interface Location {
  latitude: number;
  longitude: number;
  name?: string;
}

export async function fetchWeather(location: Location): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: location.latitude.toFixed(4),
    longitude: location.longitude.toFixed(4),
    daily: [
      'precipitation_sum',
      'temperature_2m_max',
      'temperature_2m_min',
      'et0_fao_evapotranspiration',
    ].join(','),
    timezone: 'auto',
    past_days: '7',
    forecast_days: '14',
  });

  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
  const json = await res.json();

  const today = new Date().toISOString().slice(0, 10);

  const days: WeatherDay[] = (json.daily.time as string[]).map((date, i) => {
    const precip = json.daily.precipitation_sum[i] ?? 0;
    return {
      date,
      precipMm: precip,
      tempMaxC: json.daily.temperature_2m_max[i] ?? 0,
      tempMinC: json.daily.temperature_2m_min[i] ?? 0,
      evapotranspirationMm: json.daily.et0_fao_evapotranspiration[i] ?? 0,
      isRainy: precip > 2,
      isFuture: date >= today,
    };
  });

  return {
    timezone: json.timezone,
    latitude: json.latitude,
    longitude: json.longitude,
    days,
    locationName: location.name,
  };
}

export function getBrowserLocation(): Promise<Location> {
  return new Promise((resolve, reject) => {
    if (!navigator?.geolocation) {
      reject(new Error('Geolocation not available'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 10000 }
    );
  });
}

const LOCATION_KEY = 'garden_weather_location';

export async function saveLocation(loc: Location): Promise<void> {
  try {
    const { setItemAsync } = await import('expo-secure-store');
    await setItemAsync(LOCATION_KEY, JSON.stringify(loc));
  } catch {
    // web fallback
    try { localStorage.setItem(LOCATION_KEY, JSON.stringify(loc)); } catch {}
  }
}

export async function loadSavedLocation(): Promise<Location | null> {
  try {
    const { getItemAsync } = await import('expo-secure-store');
    const raw = await getItemAsync(LOCATION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    try {
      const raw = localStorage.getItem(LOCATION_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  return null;
}

export async function clearSavedLocation(): Promise<void> {
  try {
    const { deleteItemAsync } = await import('expo-secure-store');
    await deleteItemAsync(LOCATION_KEY);
  } catch {
    try { localStorage.removeItem(LOCATION_KEY); } catch {}
  }
}

// ─── WATERING LOGIC ───────────────────────────────────────────────────────────

export interface WateringAdvice {
  nextWateringDate: Date;
  skipReason: string | null;        // null means water as scheduled
  rainDelayDays: number;
  recentRainMm: number;             // last 3 days
  forecastRainMm: number;           // next 3 days
  adjustedIntervalDays: number;     // after heat/rain adjustment
}

/**
 * Given a plant's last watered date, base interval, and weather data,
 * returns smart watering advice.
 */
export function calculateWateringAdvice(
  lastWateredISO: string | null,
  baseIntervalDays: number,
  weather: WeatherData,
): WateringAdvice {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastWatered = lastWateredISO
    ? new Date(lastWateredISO)
    : new Date(today.getTime() - baseIntervalDays * 86_400_000);

  // Recent rain (last 3 days) — reduces need
  const past3 = weather.days.filter((d) => !d.isFuture).slice(-3);
  const recentRainMm = past3.reduce((s, d) => s + d.precipMm, 0);

  // Upcoming rain (next 3 days) — can delay watering
  const next3 = weather.days.filter((d) => d.isFuture).slice(0, 3);
  const forecastRainMm = next3.reduce((s, d) => s + d.precipMm, 0);

  // Heat adjustment: high temp speeds up drying
  const todayData = weather.days.find((d) => d.date === today.toISOString().slice(0, 10));
  const avgTempMax = weather.days
    .filter((d) => d.isFuture)
    .slice(0, 3)
    .reduce((s, d) => s + d.tempMaxC, 0) / 3;

  let adjustedInterval = baseIntervalDays;
  // Hot weather: reduce interval
  if (avgTempMax > 32) adjustedInterval = Math.max(1, adjustedInterval - 1);
  else if (avgTempMax > 27) adjustedInterval = Math.max(1, adjustedInterval - 0.5);
  // Cool weather: increase interval
  if (avgTempMax < 15) adjustedInterval = adjustedInterval + 1;

  // Rain reduction: significant recent rain adds ~3 days
  let rainDelayDays = 0;
  if (recentRainMm > 20) rainDelayDays = 3;
  else if (recentRainMm > 10) rainDelayDays = 2;
  else if (recentRainMm > 5) rainDelayDays = 1;

  const baseNextDate = new Date(lastWatered.getTime() + adjustedInterval * 86_400_000);
  const nextWateringDate = new Date(baseNextDate.getTime() + rainDelayDays * 86_400_000);

  // Check if rain is forecast before next watering
  let skipReason: string | null = null;
  if (forecastRainMm > 10) {
    const rainDay = next3.find((d) => d.precipMm > 3);
    if (rainDay && new Date(rainDay.date) <= nextWateringDate) {
      skipReason = `${rainDay.precipMm.toFixed(0)}mm rain forecast ${formatDate(rainDay.date)}`;
    }
  }
  if (recentRainMm > 15 && rainDelayDays > 0) {
    skipReason = skipReason ?? `${recentRainMm.toFixed(0)}mm rainfall in last 3 days`;
  }

  return {
    nextWateringDate,
    skipReason,
    rainDelayDays,
    recentRainMm,
    forecastRainMm,
    adjustedIntervalDays: Math.round(adjustedInterval),
  };
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatDateShort(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
  if (d < today) {
    const daysAgo = Math.round((today.getTime() - d.getTime()) / 86_400_000);
    return `${daysAgo}d overdue`;
  }
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
