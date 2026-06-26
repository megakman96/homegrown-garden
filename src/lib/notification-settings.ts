import { Platform } from 'react-native';

export interface WateringReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

export interface HarvestAlertSettings {
  enabled: boolean;
  daysBefore: number;    // remind X days before expected harvest
  hour: number;          // time of day the alert fires
  minute: number;
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
  watering: { enabled: true,  hour: 8,  minute: 0 },
  harvest:  { enabled: false, daysBefore: 3,  hour: 8,  minute: 0 },
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

function mergeWithDefaults(saved: Partial<NotificationSettings>): NotificationSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    watering: { ...DEFAULT_SETTINGS.watering, ...saved.watering },
    harvest: { ...DEFAULT_SETTINGS.harvest, ...saved.harvest },
    dailyCheckIn: { ...DEFAULT_SETTINGS.dailyCheckIn, ...saved.dailyCheckIn },
    sowing: { ...DEFAULT_SETTINGS.sowing, ...saved.sowing },
    weather: { ...DEFAULT_SETTINGS.weather, ...saved.weather },
  };
}

export async function loadNotificationSettings(): Promise<NotificationSettings> {
  try {
    let raw: string | null;
    if (Platform.OS === 'web') {
      raw = localStorage.getItem(STORAGE_KEY);
    } else {
      const store = await getStorage();
      raw = (await store?.getItem(STORAGE_KEY)) ?? null;
    }
    return raw ? mergeWithDefaults(JSON.parse(raw)) : DEFAULT_SETTINGS;
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
