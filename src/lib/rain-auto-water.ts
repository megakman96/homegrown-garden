import { Platform } from 'react-native';
import { offlineList, offlineUpdate } from './offline-db';
import { loadNotificationSettings } from './notification-settings';
import { fetchWeather, loadGardenLocation } from './weather';
import { addActivityEntryAsync } from './activity-log';
import { getArchivedGardenIds } from './garden-archive';

const LAST_RUN_KEY = 'gg_rain_check_date';

async function getLastRunDate(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return localStorage.getItem(LAST_RUN_KEY);
    const AS = (await import('@react-native-async-storage/async-storage')).default;
    return AS.getItem(LAST_RUN_KEY);
  } catch { return null; }
}

async function setLastRunDate(date: string): Promise<void> {
  try {
    if (Platform.OS === 'web') { localStorage.setItem(LAST_RUN_KEY, date); return; }
    const AS = (await import('@react-native-async-storage/async-storage')).default;
    await AS.setItem(LAST_RUN_KEY, date);
  } catch {}
}

const RAIN_AUTO_MM = 10; // "a lot of rain" threshold for auto-marking

/**
 * Checks today's actual rain AND the next 2-day forecast at each garden's
 * location. Plants due within that window are auto-marked as watered when
 * precipitation >= 10 mm. Runs at most once per calendar day.
 * Requires a location to be set on the garden — no settings toggle needed.
 */
export async function checkRainAutoWater(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const today = new Date().toISOString().slice(0, 10);
  const lastRun = await getLastRunDate();
  if (lastRun === today) return; // already ran today
  await setLastRunDate(today);

  try {
    const archivedIds = await getArchivedGardenIds();
    const gardens = await offlineList('gardens', userId, `user_id = "${userId}"`);
    const plants  = await offlineList('plants',  userId, `user_id = "${userId}"`);

    // Build a date string 2 days from now for the forecast window
    const windowEnd = new Date(today + 'T00:00:00');
    windowEnd.setDate(windowEnd.getDate() + 2);
    const windowEndStr = windowEnd.toISOString().slice(0, 10);

    for (const garden of gardens) {
      if (archivedIds.has((garden as any).id)) continue;

      const loc = await loadGardenLocation(garden as any).catch(() => null);
      if (!loc) continue;

      const weather = await fetchWeather(loc).catch(() => null);
      if (!weather) continue;

      // Days with significant rain in today..+2 window
      const rainDays = weather.days.filter(
        d => d.date >= today && d.date <= windowEndStr && d.precipMm >= RAIN_AUTO_MM
      );
      if (rainDays.length === 0) continue;

      const gardenPlants = plants.filter((p: any) => p.garden_id === (garden as any).id);
      const marked = new Set<string>();

      for (const rainDay of rainDays) {
        const rainDayMs = new Date(rainDay.date + 'T00:00:00').getTime();

        for (const plant of gardenPlants) {
          const p = plant as any;
          if (marked.has(p.id)) continue;
          if (!p.water_interval_days || p.water_interval_days < 1) continue;

          const lastWatered = p.last_watered ? new Date(p.last_watered).getTime() : 0;
          const dueMs = lastWatered + p.water_interval_days * 86_400_000;

          // Due on or before this rain day
          if (dueMs <= rainDayMs + 86_400_000) {
            marked.add(p.id);
            const wateredISO = new Date(rainDay.date + 'T12:00:00').toISOString();
            await offlineUpdate('plants', userId, p.id, { last_watered: wateredISO });
            const label = rainDay.date === today ? 'today' : rainDay.date === new Date(today + 'T00:00:00').toISOString().slice(0, 10) ? 'tomorrow' : rainDay.date;
            addActivityEntryAsync(userId, {
              type: 'water',
              plantId: p.id,
              plantName: p.name,
              gardenId: p.garden_id,
              notes: `Auto-watered: ${rainDay.precipMm.toFixed(0)} mm rain ${rainDay.date === today ? '(today)' : `forecast ${label}`}`,
            }).catch(() => {});
          }
        }
      }
    }
  } catch {}
}
