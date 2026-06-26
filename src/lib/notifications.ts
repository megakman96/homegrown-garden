import { Platform } from 'react-native';
import type { Plant } from './types';
import { loadNotificationSettings } from './notification-settings';
import { loadPlans, computePlan } from './garden-plan';
import { logError } from './error-log';
import { pb } from './pb';

// ── Permission ────────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const Notifications = await import('expo-notifications');
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    logError(e, 'notifications:requestPermission');
    return false;
  }
}

export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const Notifications = await import('expo-notifications');
    const { data } = await Notifications.getExpoPushTokenAsync({
      projectId: '2688ec85-48b4-473e-8c20-f52b516c10cb',
    });
    return data;
  } catch { return null; }
}

// ── Notification channel (Android) ───────────────────────────────────────────

export async function setupNotificationChannel() {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('garden', {
        name: 'GreenPlot',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#52b788',
      });
    }
  } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Schedule helper ───────────────────────────────────────────────────────────
// Does NOT cancel the existing notification before scheduling — Expo replaces
// same-identifier notifications atomically. Pre-cancelling then immediately
// rescheduling the same alarm causes immediate delivery on certain Android OEMs.

async function scheduleLocal(
  id: string,
  title: string,
  body: string,
  trigger: Record<string, unknown>,
) {
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body, sound: true, data: {} },
      trigger: { ...trigger, channelId: 'garden' } as any,
    });
  } catch (e) {
    logError(e, `notifications:scheduleLocal:${id}`);
  }
}

// Returns the scheduled trigger timestamp (ms) for a notification whose trigger
// is a date-type alarm, or 0 if it can't be determined.
function scheduledTriggerMs(trigger: unknown): number {
  const t = trigger as any;
  // Android returns { type: 'date', value: <ms> } or { type: 'date', timestamp: <ms> }
  // iOS may use { type: 'date', value: <ms> } as well.
  return t?.value ?? t?.timestamp ?? 0;
}

// ── Watering reminders — one grouped notification per due date ────────────────

async function scheduleWateringReminders(plants: Plant[]) {
  const Notifications = await import('expo-notifications');
  const settings = await loadNotificationSettings();

  // Get the existing scheduled water notifications so we can diff.
  const allScheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  const scheduledWater = allScheduled.filter(n => n.identifier.startsWith('water_day_'));

  if (!settings.masterEnabled || !settings.watering.enabled) {
    await Promise.all(scheduledWater.map(n =>
      Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})));
    return;
  }

  const byDay: Record<string, { remindAt: Date; names: string[] }> = {};
  const now = new Date();

  // Pre-fetch weather per garden so we can skip notifications when rain is expected
  const gardenIds = [...new Set(plants.map((p: any) => p.garden_id).filter(Boolean))] as string[];
  const weatherByGarden: Record<string, any> = {};
  try {
    const { fetchWeather, loadGardenLocation } = await import('./weather');
    await Promise.all(gardenIds.map(async gid => {
      const loc = await loadGardenLocation({ id: gid } as any).catch(() => null);
      weatherByGarden[gid] = loc ? await fetchWeather(loc).catch(() => null) : null;
    }));
  } catch {}

  for (const plant of plants) {
    if (!plant.last_watered || !plant.water_interval_days) continue;

    const due = new Date(plant.last_watered);
    due.setDate(due.getDate() + plant.water_interval_days);
    // Treat water_interval_days as a calendar-day count, not an exact hour offset.
    due.setHours(0, 0, 0, 0);

    // Skip if ≥10 mm of rain is forecast on the due day
    const gid = (plant as any).garden_id as string | undefined;
    if (gid) {
      const wx = weatherByGarden[gid];
      if (wx?.days) {
        const dueDateStr = localDateKey(due);
        if (wx.days.find((day: any) => day.date === dueDateStr && day.precipMm >= 10)) continue;
      }
    }

    const remindAt = new Date(due);
    remindAt.setHours(settings.watering.hour, settings.watering.minute, 0, 0);
    if (remindAt.getTime() - now.getTime() < 5 * 60_000) continue;

    const dayKey = localDateKey(remindAt);
    if (!byDay[dayKey]) byDay[dayKey] = { remindAt, names: [] };
    byDay[dayKey].names.push(plant.name);
  }

  const targetIds = new Set(Object.keys(byDay).map(k => `water_day_${k}`));
  const scheduledMap = new Map(scheduledWater.map(n => [n.identifier, n]));

  // Cancel stale notifications (no longer needed)
  await Promise.all(
    scheduledWater
      .filter(n => !targetIds.has(n.identifier))
      .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
  );

  // Schedule only notifications that aren't already set for the right time.
  // Skipping the cancel+reschedule cycle prevents immediate delivery on Android OEMs.
  for (const [dayKey, { remindAt, names }] of Object.entries(byDay)) {
    const id = `water_day_${dayKey}`;
    const existing = scheduledMap.get(id);
    if (existing) {
      const existingMs = scheduledTriggerMs(existing.trigger);
      if (existingMs > 0 && Math.abs(existingMs - remindAt.getTime()) < 60_000) continue;
    }

    const count = names.length;
    const title = count === 1
      ? `💧 Time to water ${names[0]}`
      : `💧 ${count} plants need watering`;
    const body = count === 1
      ? `${names[0]} is due for water today. Don't let it get thirsty!`
      : names.join(', ');

    await scheduleLocal(id, title, body, { date: remindAt });
  }
}

// ── Harvest alerts — one grouped notification per reminder date ───────────────

async function scheduleHarvestAlerts(plants: Plant[]) {
  const Notifications = await import('expo-notifications');
  const settings = await loadNotificationSettings();

  const allScheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  const scheduledHarvest = allScheduled.filter(n => n.identifier.startsWith('harvest_day_'));

  if (!settings.masterEnabled || !settings.harvest.enabled) {
    await Promise.all(scheduledHarvest.map(n =>
      Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})));
    return;
  }

  const byDay: Record<string, { remindAt: Date; names: string[]; harvestDate: Date }> = {};
  const now = new Date();

  for (const plant of plants) {
    if (!plant.expected_harvest_date) continue;

    const harvestDate = new Date(plant.expected_harvest_date);
    const remindAt = new Date(harvestDate.getTime() - settings.harvest.daysBefore * 86_400_000);
    remindAt.setHours(settings.harvest.hour, settings.harvest.minute, 0, 0);

    if (remindAt.getTime() - now.getTime() < 5 * 60_000) continue;

    const dayKey = localDateKey(remindAt);
    if (!byDay[dayKey]) byDay[dayKey] = { remindAt, names: [], harvestDate };
    byDay[dayKey].names.push(plant.name);
  }

  const targetIds = new Set(Object.keys(byDay).map(k => `harvest_day_${k}`));
  const scheduledMap = new Map(scheduledHarvest.map(n => [n.identifier, n]));

  await Promise.all(
    scheduledHarvest
      .filter(n => !targetIds.has(n.identifier))
      .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
  );

  for (const [dayKey, { remindAt, names, harvestDate }] of Object.entries(byDay)) {
    const id = `harvest_day_${dayKey}`;
    const existing = scheduledMap.get(id);
    if (existing) {
      const existingMs = scheduledTriggerMs(existing.trigger);
      if (existingMs > 0 && Math.abs(existingMs - remindAt.getTime()) < 60_000) continue;
    }

    const count = names.length;
    const daysText = settings.harvest.daysBefore === 1 ? 'tomorrow' : `in ${settings.harvest.daysBefore} days`;
    const dateStr = harvestDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    const title = count === 1
      ? `🧺 ${names[0]} ready to harvest ${daysText}!`
      : `🧺 ${count} plants ready to harvest ${daysText}!`;
    const body = count === 1
      ? `Your ${names[0]} is almost ready. Prepare for harvest on ${dateStr}.`
      : names.join(', ');

    await scheduleLocal(id, title, body, { date: remindAt });
  }
}

// ── Sowing reminders — for saved "Plan a Future Garden" entries ───────────────

async function scheduleSowingReminders() {
  const Notifications = await import('expo-notifications');
  const settings = await loadNotificationSettings();

  const allScheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  const scheduledSow = allScheduled.filter(n => n.identifier.startsWith('sow_day_'));

  if (!settings.masterEnabled || !settings.sowing.enabled) {
    await Promise.all(scheduledSow.map(n =>
      Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})));
    return;
  }

  const byDay: Record<string, { remindAt: Date; names: string[] }> = {};
  const now = new Date();

  const plans = await loadPlans();
  for (const plan of plans) {
    const entries = computePlan(plan.plantKeys, plan.year, plan.lastFrost, plan.firstFrost);
    for (const entry of entries) {
      const sowDate = entry.seedStartDate ?? entry.directSowDate;
      const remindAt = new Date(sowDate.getTime() - settings.sowing.weeksBefore * 7 * 86_400_000);
      remindAt.setHours(8, 0, 0, 0);
      if (remindAt.getTime() - now.getTime() < 5 * 60_000) continue;

      const dayKey = localDateKey(remindAt);
      if (!byDay[dayKey]) byDay[dayKey] = { remindAt, names: [] };
      byDay[dayKey].names.push(entry.entry.name);
    }
  }

  const targetIds = new Set(Object.keys(byDay).map(k => `sow_day_${k}`));
  const scheduledMap = new Map(scheduledSow.map(n => [n.identifier, n]));

  await Promise.all(
    scheduledSow
      .filter(n => !targetIds.has(n.identifier))
      .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
  );

  for (const [dayKey, { remindAt, names }] of Object.entries(byDay)) {
    const id = `sow_day_${dayKey}`;
    const existing = scheduledMap.get(id);
    if (existing) {
      const existingMs = scheduledTriggerMs(existing.trigger);
      if (existingMs > 0 && Math.abs(existingMs - remindAt.getTime()) < 60_000) continue;
    }

    const count = names.length;
    const title = count === 1 ? `📅 Time to sow ${names[0]}` : `📅 ${count} plants ready to sow`;
    const body = count === 1
      ? `Your plan has ${names[0]} starting around now.`
      : names.join(', ');

    await scheduleLocal(id, title, body, { date: remindAt });
  }
}

// ── Daily check-in ────────────────────────────────────────────────────────────

export async function scheduleDailyCheckIn() {
  if (Platform.OS === 'web') return;
  const settings = await loadNotificationSettings();
  const id = 'daily_checkin';

  try {
    const Notifications = await import('expo-notifications');

    if (!settings.masterEnabled || !settings.dailyCheckIn.enabled) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      return;
    }

    const h = settings.dailyCheckIn.hour;
    const greeting = h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : 'Good evening';
    const firstName = ((pb.authStore.model as any)?.name as string | undefined)?.split(' ')[0]?.trim() || 'gardener';
    const expectedTitle = `🌱 ${greeting}, ${firstName}!`;

    // Skip only when time AND greeting already match — avoids spurious immediate
    // delivery on Android and ensures the greeting stays correct for the hour.
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const existing = scheduled.find(n => n.identifier === id);
    if (existing) {
      const t = existing.trigger as any;
      const existingTitle = (existing.content as any)?.title ?? '';
      if (t?.hour === h && t?.minute === settings.dailyCheckIn.minute && existingTitle === expectedTitle) {
        return;
      }
    }

    await scheduleLocal(
      id,
      expectedTitle,
      'Time to check on your garden. Anything thirsty today?',
      { hour: h, minute: settings.dailyCheckIn.minute, repeats: true },
    );
  } catch {}
}

// ── Birthday notification ─────────────────────────────────────────────────────

export async function scheduleBirthdayNotification() {
  if (Platform.OS === 'web') return;
  const id = 'birthday_annual';

  try {
    const Notifications = await import('expo-notifications');
    const settings = await loadNotificationSettings();

    if (!settings.masterEnabled) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      return;
    }

    const userId = (pb.authStore.model as any)?.id as string | undefined;
    if (!userId) { await Notifications.cancelScheduledNotificationAsync(id).catch(() => {}); return; }

    const { getItemAsync } = await import('expo-secure-store');
    const mmdd = await getItemAsync(`hg_bday_${userId}`).catch(() => null);
    if (!mmdd) { await Notifications.cancelScheduledNotificationAsync(id).catch(() => {}); return; }

    const [m, d] = mmdd.split('/').map(Number);
    if (!m || !d || m < 1 || m > 12 || d < 1 || d > 31) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      return;
    }

    const firstName = ((pb.authStore.model as any)?.name as string | undefined)?.split(' ')[0]?.trim() || null;
    const title = firstName ? `🎂 Happy Birthday, ${firstName}!` : '🎂 Happy Birthday!';
    const body = "Hope your garden grows as beautifully as you do. Have a wonderful day! 🌸";

    // Check if already scheduled for the correct month/day — leave it alone if so.
    // This avoids the cancel+reschedule cycle that causes immediate delivery on Android.
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const existing = scheduled.find(n => n.identifier === id);
    if (existing) {
      const t = existing.trigger as any;
      // Yearly trigger (Android): { type: 'yearly', month, day, ... }
      // Calendar trigger (iOS):   dateComponents.month / dateComponents.day
      const tMonth = t?.month ?? t?.dateComponents?.month;
      const tDay   = t?.day   ?? t?.dateComponents?.day;
      if (tMonth === m && tDay === d) return; // already correct — do nothing
      // Otherwise fall through: the stored month/day is wrong, reschedule.
    }

    // Use a platform-specific yearly repeating trigger so the notification fires
    // automatically every year on the birthday — no rescheduling loop needed.
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    const trigger: Record<string, unknown> = Platform.OS === 'ios'
      ? { type: 'calendar', month: m, day: d, hour: 9, minute: 0, repeats: true, channelId: 'garden' }
      : { type: 'yearly',   month: m, day: d, hour: 9, minute: 0, channelId: 'garden' };

    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body, sound: true, data: {} },
      trigger: trigger as any,
    });
  } catch {}
}

// ── Reschedule all notifications ──────────────────────────────────────────────
// force=false (default): throttled to once per hour — used by on-open sync.
// force=true: always runs — used by plants:changed, settings changes, and toggle.

const RESCHEDULE_THROTTLE_KEY = 'gg_last_notify_reschedule';
const RESCHEDULE_THROTTLE_MS = 60 * 60 * 1000; // 1 hour

export async function rescheduleAllNotifications(plants: Plant[], force = false) {
  if (Platform.OS === 'web') return;

  try {
    const Notifications = await import('expo-notifications');
    // Always clear delivered notifications from the tray so stale ones don't
    // accumulate and appear as a "blast" after an OTA update or notification toggle.
    await Notifications.dismissAllNotificationsAsync().catch(() => {});
  } catch {}

  if (!force) {
    // Throttle on-open calls to prevent the scheduling cycle from running on
    // every single app open. plants:changed and settings changes pass force=true.
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const last = await AsyncStorage.getItem(RESCHEDULE_THROTTLE_KEY).catch(() => null);
      if (last && Date.now() - Number(last) < RESCHEDULE_THROTTLE_MS) return;
    } catch {}
  }

  await scheduleWateringReminders(plants);
  await scheduleHarvestAlerts(plants);
  await scheduleSowingReminders();
  await scheduleDailyCheckIn();
  await scheduleBirthdayNotification();

  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(RESCHEDULE_THROTTLE_KEY, String(Date.now()));
  } catch {}
}

// ── Cancel all ────────────────────────────────────────────────────────────────

export async function cancelAllNotifications() {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync().catch(() => {});
  } catch {}
}
