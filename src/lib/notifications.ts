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

// ── Schedule / cancel helpers ─────────────────────────────────────────────────

async function cancelByPrefix(prefix: string) {
  try {
    const Notifications = await import('expo-notifications');
    // Cancel pending (not-yet-delivered) notifications
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter(n => n.identifier.startsWith(prefix))
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
    );
    // Also dismiss already-delivered notifications with this prefix so stale
    // ones don't accumulate in the notification tray across days.
    const presented = await Notifications.getPresentedNotificationsAsync().catch(() => [] as any[]);
    await Promise.all(
      (presented as any[])
        .filter((n: any) => (n.request?.identifier ?? '').startsWith(prefix))
        .map((n: any) => Notifications.dismissNotificationAsync(n.request.identifier).catch(() => {}))
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
    // Without this, the time-of-day from last_watered carries into remindAt and can
    // produce unexpected fire times (e.g. watered at 9 AM → reminder at 7 AM).
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
    // Skip if the reminder time has already passed or is less than 5 minutes away.
    if (remindAt.getTime() - now.getTime() < 5 * 60_000) continue;

    const dayKey = localDateKey(remindAt);
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

    if (remindAt.getTime() - now.getTime() < 5 * 60_000) continue;

    const dayKey = localDateKey(remindAt);
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
      if (remindAt.getTime() - now.getTime() < 5 * 60_000) continue;

      const dayKey = localDateKey(remindAt);
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

export async function rescheduleAllNotifications(plants: Plant[]) {
  if (Platform.OS === 'web') return;
  await scheduleWateringReminders(plants);
  await scheduleHarvestAlerts(plants);
  await scheduleSowingReminders();
  await scheduleDailyCheckIn();
  await scheduleBirthdayNotification();
}

// ── Cancel all ────────────────────────────────────────────────────────────────

export async function cancelAllNotifications() {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}
