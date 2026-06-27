import { Platform } from 'react-native';
import type { Plant } from './types';
import { loadNotificationSettings } from './notification-settings';
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

// ── Cancel old per-day notification IDs from the previous multi-notification system ──

async function cancelLegacyNotifications() {
  try {
    const Notifications = await import('expo-notifications');
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const legacy = all.filter(n =>
      n.identifier.startsWith('water_day_') ||
      n.identifier.startsWith('harvest_day_') ||
      n.identifier.startsWith('sow_day_')
    );
    await Promise.all(legacy.map(n =>
      Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})
    ));
  } catch {}
}

// ── Daily digest — ONE notification per day ───────────────────────────────────
// Content reflects what's due based on plant data at the time of scheduling.
// Rescheduled on every app open and on every plant change.

async function scheduleDailyDigest(plants: Plant[]) {
  const Notifications = await import('expo-notifications');
  const settings = await loadNotificationSettings();
  const id = 'daily_checkin';

  if (!settings.masterEnabled || !settings.dailyCheckIn.enabled) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    return;
  }

  const now = new Date();
  const todayStr = localDateKey(now);

  // Plants that need water today or are overdue
  const needsWater = plants.filter(p => {
    if (!p.last_watered || !p.water_interval_days) return false;
    const due = new Date(p.last_watered);
    due.setDate(due.getDate() + p.water_interval_days);
    due.setHours(0, 0, 0, 0);
    return localDateKey(due) <= todayStr;
  });

  // Plants approaching or ready for harvest (within 3 days)
  const harvestSoon = plants.filter(p => {
    if (!p.expected_harvest_date) return false;
    const harvestDate = new Date(p.expected_harvest_date);
    harvestDate.setHours(0, 0, 0, 0);
    const daysUntil = Math.round((harvestDate.getTime() - now.setHours(0, 0, 0, 0)) / 86_400_000);
    return daysUntil >= 0 && daysUntil <= 3;
  });

  let title: string;
  let body: string;

  if (needsWater.length > 0 && harvestSoon.length > 0) {
    title = '🌱 Garden needs attention';
    body = `${needsWater.length} plant${needsWater.length > 1 ? 's' : ''} to water · ${harvestSoon.length} ready to harvest`;
  } else if (needsWater.length > 0) {
    title = needsWater.length === 1
      ? `💧 ${needsWater[0].name} needs water`
      : `💧 ${needsWater.length} plants need water`;
    body = needsWater.length === 1
      ? 'Time to give it a drink!'
      : needsWater.map(p => p.name).join(', ');
  } else if (harvestSoon.length > 0) {
    title = harvestSoon.length === 1
      ? `🧺 ${harvestSoon[0].name} is ready to harvest`
      : `🧺 ${harvestSoon.length} plants ready to harvest`;
    body = 'Head to your garden when you get a chance.';
  } else {
    const h = settings.dailyCheckIn.hour;
    const greeting = h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : 'Good evening';
    const firstName = ((pb.authStore.model as any)?.name as string | undefined)?.split(' ')[0]?.trim() || 'gardener';
    title = `🌱 ${greeting}, ${firstName}!`;
    body = 'Time to check on your garden.';
  }

  const h = settings.dailyCheckIn.hour;

  // Only reschedule if time or content changed
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existing = scheduled.find(n => n.identifier === id);
  if (existing) {
    const t = existing.trigger as any;
    const existingTitle = (existing.content as any)?.title ?? '';
    if (t?.hour === h && t?.minute === settings.dailyCheckIn.minute && existingTitle === title) {
      return;
    }
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }

  await scheduleLocal(id, title, body, {
    hour: h,
    minute: settings.dailyCheckIn.minute,
    repeats: true,
  });
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

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const existing = scheduled.find(n => n.identifier === id);
    if (existing) {
      const t = existing.trigger as any;
      const tMonth = t?.month ?? t?.dateComponents?.month;
      const tDay   = t?.day   ?? t?.dateComponents?.day;
      if (tMonth === m && tDay === d) return;
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    }

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

const RESCHEDULE_THROTTLE_KEY = 'gg_last_notify_reschedule';
const RESCHEDULE_THROTTLE_MS = 60 * 60 * 1000; // 1 hour

export async function rescheduleAllNotifications(plants: Plant[], force = false) {
  if (Platform.OS === 'web') return;

  if (!force) {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const last = await AsyncStorage.getItem(RESCHEDULE_THROTTLE_KEY).catch(() => null);
      if (last && Date.now() - Number(last) < RESCHEDULE_THROTTLE_MS) return;
    } catch {}
  }

  await cancelLegacyNotifications();
  await scheduleDailyDigest(plants);
  await scheduleBirthdayNotification();

  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(RESCHEDULE_THROTTLE_KEY, String(Date.now()));
  } catch {}
}

// ── Exported for settings toggle (daily check-in) ────────────────────────────

export async function scheduleDailyCheckIn() {
  // No-op: daily check-in is now part of rescheduleAllNotifications.
  // Kept for import compatibility.
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
