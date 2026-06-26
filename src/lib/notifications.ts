import { Platform } from 'react-native';
import type { Plant } from './types';
import { loadNotificationSettings } from './notification-settings';
import { loadPlans, computePlan } from './garden-plan';
import { logError } from './error-log';

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
        name: 'GardenGrid',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#52b788',
      });
    }
  } catch {}
}

// ── Schedule / cancel helpers ─────────────────────────────────────────────────

async function cancelByPrefix(prefix: string) {
  try {
    const Notifications = await import('expo-notifications');
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter(n => n.identifier.startsWith(prefix))
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
    );
  } catch {}
}

async function scheduleLocal(
  id: string,
  title: string,
  body: string,
  trigger: Record<string, unknown>,
) {
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body, sound: true, data: {} },
      trigger: { ...trigger, channelId: 'garden' } as any,
    });
  } catch (e) {
    logError(e, `notifications:scheduleLocal:${id}`);
  }
}

// ── Watering reminders — one grouped notification per due date ────────────────

async function scheduleWateringReminders(plants: Plant[]) {
  await cancelByPrefix('water_day_');

  const settings = await loadNotificationSettings();
  if (!settings.masterEnabled || !settings.watering.enabled) return;

  // Group plants by the calendar day their reminder fires
  const byDay: Record<string, { remindAt: Date; names: string[] }> = {};
  const now = new Date();

  for (const plant of plants) {
    if (!plant.last_watered || !plant.water_interval_days) continue;

    const due = new Date(plant.last_watered);
    due.setDate(due.getDate() + plant.water_interval_days);

    const remindAt = new Date(due.getTime() - settings.watering.hoursBefore * 3_600_000);
    // hoursBefore can push the reminder into the middle of the night — fall back
    // to the user's chosen time of day (same calendar day) when that happens.
    if (remindAt.getHours() < 6 || remindAt.getHours() >= 22) {
      remindAt.setHours(settings.watering.hour, settings.watering.minute, 0, 0);
    }
    if (remindAt <= now) continue;

    const dayKey = remindAt.toISOString().slice(0, 10); // YYYY-MM-DD
    if (!byDay[dayKey]) byDay[dayKey] = { remindAt, names: [] };
    byDay[dayKey].names.push(plant.name);
  }

  for (const [dayKey, { remindAt, names }] of Object.entries(byDay)) {
    const count = names.length;
    const title = count === 1
      ? `💧 Time to water ${names[0]}`
      : `💧 ${count} plants need watering`;
    const body = count === 1
      ? `${names[0]} is due for water today. Don't let it get thirsty!`
      : names.join(', ');

    await scheduleLocal(`water_day_${dayKey}`, title, body, { date: remindAt });
  }
}

// ── Harvest alerts — one grouped notification per reminder date ───────────────

async function scheduleHarvestAlerts(plants: Plant[]) {
  await cancelByPrefix('harvest_day_');

  const settings = await loadNotificationSettings();
  if (!settings.masterEnabled || !settings.harvest.enabled) return;

  const byDay: Record<string, { remindAt: Date; names: string[]; harvestDate: Date }> = {};
  const now = new Date();

  for (const plant of plants) {
    if (!plant.expected_harvest_date) continue;

    const harvestDate = new Date(plant.expected_harvest_date);
    const remindAt = new Date(harvestDate.getTime() - settings.harvest.daysBefore * 86_400_000);
    remindAt.setHours(settings.harvest.hour, settings.harvest.minute, 0, 0);

    if (remindAt <= now) continue;

    const dayKey = remindAt.toISOString().slice(0, 10);
    if (!byDay[dayKey]) byDay[dayKey] = { remindAt, names: [], harvestDate };
    byDay[dayKey].names.push(plant.name);
  }

  for (const [dayKey, { remindAt, names, harvestDate }] of Object.entries(byDay)) {
    const count = names.length;
    const daysText = settings.harvest.daysBefore === 1 ? 'tomorrow' : `in ${settings.harvest.daysBefore} days`;
    const dateStr = harvestDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    const title = count === 1
      ? `🧺 ${names[0]} ready to harvest ${daysText}!`
      : `🧺 ${count} plants ready to harvest ${daysText}!`;
    const body = count === 1
      ? `Your ${names[0]} is almost ready. Prepare for harvest on ${dateStr}.`
      : names.join(', ');

    await scheduleLocal(`harvest_day_${dayKey}`, title, body, { date: remindAt });
  }
}

// ── Sowing reminders — for saved "Plan a Future Garden" entries ───────────────

async function scheduleSowingReminders() {
  await cancelByPrefix('sow_day_');

  const settings = await loadNotificationSettings();
  if (!settings.masterEnabled || !settings.sowing.enabled) return;

  const byDay: Record<string, { remindAt: Date; names: string[] }> = {};
  const now = new Date();

  const plans = await loadPlans();
  for (const plan of plans) {
    const entries = computePlan(plan.plantKeys, plan.year, plan.lastFrost, plan.firstFrost);
    for (const entry of entries) {
      const sowDate = entry.seedStartDate ?? entry.directSowDate;
      const remindAt = new Date(sowDate.getTime() - settings.sowing.weeksBefore * 7 * 86_400_000);
      remindAt.setHours(8, 0, 0, 0);
      if (remindAt <= now) continue;

      const dayKey = remindAt.toISOString().slice(0, 10);
      if (!byDay[dayKey]) byDay[dayKey] = { remindAt, names: [] };
      byDay[dayKey].names.push(entry.entry.name);
    }
  }

  for (const [dayKey, { remindAt, names }] of Object.entries(byDay)) {
    const count = names.length;
    const title = count === 1
      ? `📅 Time to sow ${names[0]}`
      : `📅 ${count} plants ready to sow`;
    const body = count === 1
      ? `Your plan has ${names[0]} starting around now.`
      : names.join(', ');

    await scheduleLocal(`sow_day_${dayKey}`, title, body, { date: remindAt });
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

    // Skip cancel+reschedule if already set to the same time — avoids spurious
    // immediate delivery on Android when the trigger is rebuilt unnecessarily.
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const existing = scheduled.find(n => n.identifier === id);
    if (existing) {
      const t = existing.trigger as any;
      if (t?.hour === settings.dailyCheckIn.hour && t?.minute === settings.dailyCheckIn.minute) {
        return;
      }
    }

    const h = settings.dailyCheckIn.hour;
    const greeting = h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : 'Good evening';

    await scheduleLocal(
      id,
      `🌱 ${greeting}, gardener!`,
      'Time to check on your garden. Anything thirsty today?',
      { hour: settings.dailyCheckIn.hour, minute: settings.dailyCheckIn.minute, repeats: true },
    );
  } catch {}
}

// ── Reschedule all notifications ──────────────────────────────────────────────

export async function rescheduleAllNotifications(plants: Plant[]) {
  if (Platform.OS === 'web') return;
  await scheduleWateringReminders(plants);
  await scheduleHarvestAlerts(plants);
  await scheduleSowingReminders();
  await scheduleDailyCheckIn();
}

// ── Cancel all ────────────────────────────────────────────────────────────────

export async function cancelAllNotifications() {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}
