/**
 * Custom plant icon images stored in PocketBase `plant_icons` collection.
 *
 * Required PocketBase collection setup (one-time, in your PB admin at /_/):
 *   Name:   plant_icons
 *   Fields:
 *     - plant_key  (Plain text, required, unique)
 *     - image      (File, max 1 file, accept image/*)
 *   Rules: listRule = "", viewRule = "" (public read so app can fetch)
 *          createRule / updateRule / deleteRule = @request.auth.id != "" (auth required to write)
 */

import { pb, fileUrl } from './pb';
import { Platform } from 'react-native';

const CACHE_KEY = 'gg_plant_icon_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

export interface PlantIconRecord {
  id: string;
  plant_key: string;
  image: string;
  imageUrl: string;
}

// In-memory cache keyed by plant_key → image URL
let memCache: Record<string, string> | null = null;
let cacheLoadedAt = 0;

export async function loadPlantIconOverrides(): Promise<Record<string, string>> {
  const now = Date.now();
  if (memCache && now - cacheLoadedAt < CACHE_TTL_MS) return memCache;

  try {
    const records = await pb.collection('plant_icons').getFullList({ requestKey: null });
    const map: Record<string, string> = {};
    for (const rec of records as any[]) {
      if (rec.plant_key && rec.image) {
        map[rec.plant_key] = fileUrl(rec, rec.image);
      }
    }
    memCache = map;
    cacheLoadedAt = now;
    return map;
  } catch {
    // Collection doesn't exist yet or network error — return empty
    memCache = {};
    cacheLoadedAt = now;
    return {};
  }
}

export function getCustomIconUrl(plantKey: string): string | null {
  return memCache?.[plantKey] ?? null;
}

export function invalidateIconCache() {
  memCache = null;
  cacheLoadedAt = 0;
}

/** True if the in-memory cache is stale or empty (used by PlantAvatar). */
export function isIconCacheStale(): boolean {
  return !memCache || Date.now() - cacheLoadedAt >= CACHE_TTL_MS;
}

/** Upsert a custom icon for a plant. Returns the image URL. */
export async function uploadPlantIcon(
  plantKey: string,
  fileData: { uri: string; name: string; type: string },
): Promise<string> {
  // Check for existing record
  let existing: any = null;
  try {
    const results = await pb.collection('plant_icons').getList(1, 1, {
      filter: `plant_key = "${plantKey}"`,
      requestKey: null,
    });
    if (results.items.length > 0) existing = results.items[0];
  } catch {}

  const formData = new FormData();
  formData.append('plant_key', plantKey);

  if (Platform.OS === 'web') {
    // On web, fileData.uri is a blob URL or data URL
    const response = await fetch(fileData.uri);
    const blob = await response.blob();
    formData.append('image', blob, fileData.name);
  } else {
    // On native (not used since admin is web-only, but kept for completeness)
    formData.append('image', { uri: fileData.uri, name: fileData.name, type: fileData.type } as any);
  }

  let record: any;
  if (existing) {
    record = await pb.collection('plant_icons').update(existing.id, formData);
  } else {
    record = await pb.collection('plant_icons').create(formData);
  }

  const url = fileUrl(record, record.image);
  if (!memCache) memCache = {};
  memCache[plantKey] = url;
  return url;
}

/** Delete a custom icon for a plant. */
export async function deletePlantIcon(plantKey: string): Promise<void> {
  try {
    const results = await pb.collection('plant_icons').getList(1, 1, {
      filter: `plant_key = "${plantKey}"`,
      requestKey: null,
    });
    if (results.items.length > 0) {
      await pb.collection('plant_icons').delete(results.items[0].id);
    }
    if (memCache) delete memCache[plantKey];
  } catch {}
}
