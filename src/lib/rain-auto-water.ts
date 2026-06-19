import { Platform } from 'react-native';
import { offlineList, offlineUpdate } from './offline-db';
import { loadNotificationSettings } from './notification-settings';
import { fetchWeather, loadGardenLocation } from './weather';
import { addActivityEntryAsync } from './activity-log';

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

/**
 * If weather-aware watering is enabled, checks whether it rained today at each
 * garden's location. Plants that were due for water today are auto-marked as
 * watered when precipitation >= 2 mm. Runs at most once per calendar day.
 */
export async function checkRainAutoWater(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const settings = await loadNotificationSettings();
  if (!settings.weather.enabled) return;

  const today = new Date().toISOString().slice(0, 10);
  const lastRun = await getLastRunDate();
  if (lastRun === today) return; // already ran today
  await setLastRunDate(today);

  try {
    const gardens = await offlineList('gardens', userId, `user_id = "${userId}"`);
    const plants  = await offlineList('plants',  userId, `user_id = "${userId}"`);

    const todayMs = new Date(today + 'T00:00:00').getTime();

    for (const garden of gardens) {
      const loc = await loadGardenLocation(garden as any).catch(() => null);
      if (!loc) continue;

      const weather = await fetchWeather(loc).catch(() => null);
      if (!weather) continue;

      const todayWeather = weather.days.find(d => d.date === today);
      if (!todayWeather || !todayWeather.isRainy) continue; // no rain today here

      // Find plants in this garden that are due today and haven't been watered
      const gardenPlants = plants.filter((p: any) => p.garden_id === (garden as any).id);
      for (const plant of gardenPlants) {
        const p = plant as any;
        if (!p.water_interval_days || p.water_interval_days < 1) continue;

        const lastWatered = p.last_watered ? new Date(p.last_watered).getTime() : 0;
        const dueMs = lastWatered + p.water_interval_days * 86_400_000;

        if (dueMs <= todayMs + 86_400_000) {
          // Due today or overdue — rain counts as watering
          const nowISO = new Date(today + 'T12:00:00').toISOString();
          await offlineUpdate('plants', userId, p.id, { last_watered: nowISO });
          addActivityEntryAsync(userId, {
            type: 'water',
            plantId: p.id,
            plantName: p.name,
            gardenId: p.garden_id,
            notes: `Auto-watered by rain (${todayWeather.precipMm.toFixed(1)} mm)`,
          }).catch(() => {});
        }
      }
    }
  } catch {}
}
