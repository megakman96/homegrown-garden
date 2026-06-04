import { Platform } from 'react-native';

export type ActivityType = 'water' | 'harvest';

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  plantId: string;
  plantName: string;
  gardenId?: string;
  date: string;
  grams?: number;
  notes?: string;
}

function storageKey(userId: string) { return `hg_activity_${userId}`; }

async function nativeGet(userId: string): Promise<ActivityEntry[]> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const raw = await AsyncStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function nativeSet(userId: string, entries: ActivityEntry[]): Promise<void> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(entries));
  } catch {}
}

export async function getActivityLogAsync(userId: string): Promise<ActivityEntry[]> {
  if (Platform.OS === 'web') {
    try {
      const raw = localStorage.getItem(storageKey(userId));
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  return nativeGet(userId);
}

export async function clearActivityLogAsync(userId: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.removeItem(storageKey(userId)); } catch {}
  } else {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.removeItem(storageKey(userId));
    } catch {}
  }
}

export async function addActivityEntryAsync(
  userId: string,
  entry: Omit<ActivityEntry, 'id' | 'date'>,
): Promise<void> {
  const newEntry: ActivityEntry = {
    ...entry,
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    date: new Date().toISOString(),
  };
  const log = await getActivityLogAsync(userId);
  log.unshift(newEntry);
  const trimmed = log.slice(0, 500);
  if (Platform.OS === 'web') {
    try { localStorage.setItem(storageKey(userId), JSON.stringify(trimmed)); } catch {}
  } else {
    await nativeSet(userId, trimmed);
  }
}
