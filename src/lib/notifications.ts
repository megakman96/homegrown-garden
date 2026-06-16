import { Platform } from 'react-native';
import type { Plant } from './types';
import { loadNotificationSettings } from './notification-settings';

// ── Permission ────────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const Notifications = await import('expo-notifications');
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch { return false; }
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

async function cancelByIdentifier(id: string) {
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
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
      content: {
        title,
        body,
        sound: true,
        data: {},
      },
      trigger: { ...trigger, channelId: 'garden' } as any,
    });
  } catch {}
}

// ── Watering reminders ────────────────────────────────────────────────────────

export async function scheduleWateringReminder(plant: Plant) {
  if (Platform.OS === 'web') return;
  const settings = await loadNotificationSettings();
  const id = `water_${plant.id}`;

  if (!settings.masterEnabled || !settings.watering.enabled) {
    await cancelByIdentifier(id);
    return;
  }
  if (!plant.last_watered || !plant.water_interval_days) {
    await cancelByIdentifier(id);
    return;
  }

  const due = new Date(plant.last_watered);
  due.setDate(due.getDate() + plant.water_interval_days);

  // Remind X hours before due, but not in the past
  const remindAt = new Date(due.getTime() - settings.watering.hoursBefore * 3_600_000);
  if (remindAt <= new Date()) {
    await cancelByIdentifier(id);
    return;
  }

  await scheduleLocal(
    id,
    `💧 Time to water ${plant.name}`,
    `${plant.name} is due for water${settings.watering.hoursBefore > 0 ? ` in ${settings.watering.hoursBefore}h` : ''}. Don't let it get thirsty!`,
    { type: 'date', date: remindAt },
  );
}

export async function cancelWateringReminder(plantId: string) {
  await cancelByIdentifier(`water_${plantId}`);
}

// ── Harvest alerts ────────────────────────────────────────────────────────────

export async function scheduleHarvestAlert(plant: Plant) {
  if (Platform.OS === 'web') return;
  const settings = await loadNotificationSettings();
  const id = `harvest_${plant.id}`;

  if (!settings.masterEnabled || !settings.harvest.enabled || !plant.expected_harvest_date) {
    await cancelByIdentifier(id);
    return;
  }

  const harvestDate = new Date(plant.expected_harvest_date);
  const remindAt = new Date(harvestDate.getTime() - settings.harvest.daysBefore * 86_400_000);
  remindAt.setHours(8, 0, 0, 0);

  if (remindAt <= new Date()) {
    await cancelByIdentifier(id);
    return;
  }

  const daysText = settings.harvest.daysBefore === 1 ? 'tomorrow' : `in ${settings.harvest.daysBefore} days`;
  await scheduleLocal(
    id,
    `🧺 ${plant.name} ready to harvest ${daysText}!`,
    `Your ${plant.name} is almost ready. Prepare for harvest on ${harvestDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.`,
    { type: 'date', date: remindAt },
  );
}

export async function cancelHarvestAlert(plantId: string) {
  await cancelByIdentifier(`harvest_${plantId}`);
}

// ── Daily check-in ────────────────────────────────────────────────────────────

export async function scheduleDailyCheckIn() {
  if (Platform.OS === 'web') return;
  const settings = await loadNotificationSettings();
  const id = 'daily_checkin';

  if (!settings.masterEnabled || !settings.dailyCheckIn.enabled) {
    await cancelByIdentifier(id);
    return;
  }

  await scheduleLocal(
    id,
    '🌱 Good morning, gardener!',
    'Time to check on your garden. Anything thirsty today?',
    { type: 'daily', hour: settings.dailyCheckIn.hour, minute: settings.dailyCheckIn.minute },
  );
}

export async function cancelDailyCheckIn() {
  await cancelByIdentifier('daily_checkin');
}

// ── Reschedule all notifications for a user's plants ─────────────────────────

export async function rescheduleAllNotifications(plants: Plant[]) {
  if (Platform.OS === 'web') return;
  for (const plant of plants) {
    await scheduleWateringReminder(plant);
    await scheduleHarvestAlert(plant);
  }
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
