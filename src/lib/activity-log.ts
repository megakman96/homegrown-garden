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

function logKey(userId: string) {
  return `hg_activity_${userId}`;
}

export function getActivityLog(userId: string): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(logKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addActivityEntry(userId: string, entry: Omit<ActivityEntry, 'id' | 'date'>): void {
  const log = getActivityLog(userId);
  const newEntry: ActivityEntry = {
    ...entry,
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    date: new Date().toISOString(),
  };
  log.unshift(newEntry);
  try {
    localStorage.setItem(logKey(userId), JSON.stringify(log.slice(0, 500)));
  } catch {}
}
