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

function webKey(userId: string) {
  return `hg_activity_${userId}`;
}

async function nativePath(userId: string): Promise<string> {
  const FileSystem = await import('expo-file-system');
  const dir = (FileSystem as any).documentDirectory ?? (FileSystem.default as any)?.documentDirectory ?? '';
  return `${dir}hg_activity_${userId}.json`;
}

export async function getActivityLogAsync(userId: string): Promise<ActivityEntry[]> {
  if (Platform.OS === 'web') {
    try {
      const raw = localStorage.getItem(webKey(userId));
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  try {
    const FileSystem = await import('expo-file-system');
    const path = await nativePath(userId);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(path);
    return JSON.parse(raw);
  } catch { return []; }
}

export async function addActivityEntryAsync(
  userId: string,
  entry: Omit<ActivityEntry, 'id' | 'date'>,
): Promise<void> {
  const log = await getActivityLogAsync(userId);
  log.unshift({
    ...entry,
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    date: new Date().toISOString(),
  });
  const trimmed = log.slice(0, 500);
  if (Platform.OS === 'web') {
    try { localStorage.setItem(webKey(userId), JSON.stringify(trimmed)); } catch {}
  } else {
    try {
      const FileSystem = await import('expo-file-system');
      const path = await nativePath(userId);
      await FileSystem.writeAsStringAsync(path, JSON.stringify(trimmed));
    } catch {}
  }
}
