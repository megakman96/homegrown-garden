import { Platform } from 'react-native';
import { PLANT_CATALOG, type CatalogEntry } from '@/lib/plant-catalog';

const STORAGE_KEY = 'hg_garden_plans_v1';

export interface SavedPlan {
  id: string;
  name: string;
  year: number;
  lastFrost: string;
  firstFrost: string;
  plantKeys: string[];
  createdAt: string;
}

export async function loadPlans(): Promise<SavedPlan[]> {
  try {
    if (Platform.OS === 'web') {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    }
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function savePlans(plans: SavedPlan[]): Promise<void> {
  try {
    const json = JSON.stringify(plans);
    if (Platform.OS === 'web') {
      localStorage.setItem(STORAGE_KEY, json);
      return;
    }
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(STORAGE_KEY, json);
  } catch {}
}

const COOL_SEASON = new Set([
  'lettuce', 'spinach', 'kale', 'broccoli', 'cabbage', 'cauliflower',
  'brussels_sprouts', 'pea', 'carrot', 'radish', 'beet', 'turnip', 'parsnip',
  'chard', 'arugula', 'bok_choy', 'collard_greens', 'endive', 'leek',
]);

export interface PlanEntry {
  key: string;
  entry: CatalogEntry;
  seedStartDate: Date | null;
  transplantDate: Date | null;
  directSowDate: Date;
  harvestStart: Date;
  harvestEnd: Date;
}

export function parseMMDD(mmdd: string, year: number): Date | null {
  const parts = mmdd.split('/');
  if (parts.length < 2) return null;
  const m = parseInt(parts[0], 10);
  const d = parseInt(parts[1], 10);
  if (isNaN(m) || isNaN(d)) return null;
  return new Date(year, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function computePlan(keys: string[], year: number, lastFrostStr: string, firstFrostStr: string): PlanEntry[] {
  const lastFrost  = parseMMDD(lastFrostStr, year);
  const firstFrost = parseMMDD(firstFrostStr, year);
  if (!lastFrost || !firstFrost) return [];

  return keys.map((key) => {
    const entry = PLANT_CATALOG[key];
    if (!entry) return null;
    const matMin = entry.daysToMaturity?.min ?? 60;
    const matMax = entry.daysToMaturity?.max ?? 90;
    const isCool = COOL_SEASON.has(key);

    let directSowDate: Date;
    let seedStartDate: Date | null = null;
    let transplantDate: Date | null = null;

    if (isCool) {
      directSowDate = addDays(lastFrost, -42);
    } else {
      directSowDate = lastFrost;
      if (matMin >= 60) { seedStartDate = addDays(lastFrost, -56); transplantDate = lastFrost; }
    }

    return {
      key, entry, seedStartDate, transplantDate, directSowDate,
      harvestStart: addDays(directSowDate, matMin),
      harvestEnd:   addDays(directSowDate, matMax),
    };
  }).filter((e): e is PlanEntry => e !== null);
}
