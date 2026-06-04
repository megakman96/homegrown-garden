import { Platform } from 'react-native';

export interface WateringReminderSettings {
  enabled: boolean;
  hoursBefore: number;   // remind X hours before plant is due
  hour: number;          // time of day (fallback if hoursBefore puts it overnight)
  minute: number;
}

export interface HarvestAlertSettings {
  enabled: boolean;
  daysBefore: number;    // remind X days before expected harvest
}

export interface DailyCheckInSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

export interface SowingReminderSettings {
  enabled: boolean;
  weeksBefore: number;
}

export interface WeatherAlertSettings {
  enabled: boolean;     // "Rain forecast — consider skipping watering"
}

export interface NotificationSettings {
  masterEnabled: boolean;
  watering: WateringReminderSettings;
  harvest: HarvestAlertSettings;
  dailyCheckIn: DailyCheckInSettings;
  sowing: SowingReminderSettings;
  weather: WeatherAlertSettings;
}

export const DEFAULT_SETTINGS: NotificationSettings = {
  masterEnabled: true,
  watering: { enabled: true,  hoursBefore: 2,  hour: 8,  minute: 0 },
  harvest:  { enabled: true,  daysBefore: 3 },
  dailyCheckIn: { enabled: false, hour: 8, minute: 0 },
  sowing:   { enabled: true,  weeksBefore: 2 },
  weather:  { enabled: false },
};

const STORAGE_KEY = 'gg_notification_settings';

async function getStorage() {
  if (Platform.OS === 'web') return null;
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  return AsyncStorage;
}

export async function loadNotificationSettings(): Promise<NotificationSettings> {
  try {
    if (Platform.OS === 'web') {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    }
    const store = await getStorage();
    const raw = await store?.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    const json = JSON.stringify(settings);
    if (Platform.OS === 'web') {
      localStorage.setItem(STORAGE_KEY, json);
    } else {
      const store = await getStorage();
      await store?.setItem(STORAGE_KEY, json);
    }
  } catch {}
}
