import { Platform } from 'react-native';

const KEY = 'gg_archived_garden_ids';

async function getIds(): Promise<string[]> {
  try {
    if (Platform.OS === 'web') {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    }
    const AS = (await import('@react-native-async-storage/async-storage')).default;
    const raw = await AS.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveIds(ids: string[]): Promise<void> {
  try {
    const json = JSON.stringify(ids);
    if (Platform.OS === 'web') { localStorage.setItem(KEY, json); return; }
    const AS = (await import('@react-native-async-storage/async-storage')).default;
    await AS.setItem(KEY, json);
  } catch {}
}

export async function getArchivedGardenIds(): Promise<Set<string>> {
  return new Set(await getIds());
}

export async function archiveGarden(id: string): Promise<void> {
  const ids = await getIds();
  if (!ids.includes(id)) await saveIds([...ids, id]);
}

export async function unarchiveGarden(id: string): Promise<void> {
  const ids = await getIds();
  await saveIds(ids.filter(i => i !== id));
}
