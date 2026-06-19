// Average last-spring-frost / first-fall-frost dates by USDA Hardiness Zone.
// Dates are community averages — actual years vary by ±2–3 weeks.
// month is 1-indexed.

const ZONE_FROST: Record<string, { last: [number, number]; first: [number, number] }> = {
  '2a':  { last: [6, 1],  first: [8, 25] },
  '2b':  { last: [5, 25], first: [9, 1]  },
  '3a':  { last: [5, 20], first: [9, 10] },
  '3b':  { last: [5, 10], first: [9, 20] },
  '4a':  { last: [5, 5],  first: [9, 25] },
  '4b':  { last: [4, 25], first: [10, 5] },
  '5a':  { last: [4, 20], first: [10, 10] },
  '5b':  { last: [4, 10], first: [10, 20] },
  '6a':  { last: [4, 5],  first: [10, 25] },
  '6b':  { last: [3, 25], first: [11, 5]  },
  '7a':  { last: [3, 20], first: [11, 10] },
  '7b':  { last: [3, 10], first: [11, 20] },
  '8a':  { last: [3, 5],  first: [11, 22] },
  '8b':  { last: [2, 20], first: [12, 5]  },
  '9a':  { last: [2, 10], first: [11, 28] },
  '9b':  { last: [1, 25], first: [12, 10] },
  '10a': { last: [1, 20], first: [12, 10] },
  '10b': { last: [1, 10], first: [12, 20] },
  '11a': { last: [1, 1],  first: [12, 31] },
  '11b': { last: [1, 1],  first: [12, 31] },
  '12a': { last: [1, 1],  first: [12, 31] },
  '12b': { last: [1, 1],  first: [12, 31] },
};

// Fallback: lookup without the a/b sub-zone
const ZONE_FALLBACK: Record<string, string> = {
  '2': '2b', '3': '3b', '4': '4b', '5': '5b', '6': '6b',
  '7': '7b', '8': '8a', '9': '9a', '10': '10a', '11': '11a', '12': '12a',
};

export interface FrostInfo {
  zone: string;              // e.g. "6b"
  lastFrost: Date;           // average last spring frost
  firstFrost: Date;          // average first fall frost
  growingDays: number;       // days between frosts
  noFrostRisk: boolean;      // zone 10b+ — frost extremely rare
}

export interface PlantingWindow {
  startIndoors: Date | null;
  transplantOutdoors: Date;
  harvestStart: Date | null;
  harvestEnd: Date | null;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function makeDate(month: number, day: number): Date {
  const year = new Date().getFullYear();
  return new Date(year, month - 1, day);
}

export async function fetchZoneForCoords(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://phzmapi.org/${lat.toFixed(4)}/${lng.toFixed(4)}.json`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.zone as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export function getFrostInfo(zone: string): FrostInfo | null {
  const key = zone.toLowerCase().replace('zone', '').trim();
  const entry = ZONE_FROST[key] ?? ZONE_FROST[ZONE_FALLBACK[key.replace(/[ab]$/, '')] ?? ''];
  if (!entry) return null;

  const lastFrost  = makeDate(entry.last[0],  entry.last[1]);
  const firstFrost = makeDate(entry.first[0], entry.first[1]);
  const noFrostRisk = parseFloat(key) >= 10;

  return {
    zone: key,
    lastFrost,
    firstFrost,
    growingDays: Math.round((firstFrost.getTime() - lastFrost.getTime()) / 86_400_000),
    noFrostRisk,
  };
}

export function calcPlantingWindow(
  frost: FrostInfo,
  isWarmSeason: boolean,
  daysToMaturity?: { min: number; max: number },
): PlantingWindow {
  let transplantOutdoors: Date;
  let startIndoors: Date | null = null;

  if (frost.noFrostRisk) {
    // Tropical / year-round — plant whenever, relative to now or Jan 1
    transplantOutdoors = new Date(new Date().getFullYear(), 0, 15);
  } else if (isWarmSeason) {
    transplantOutdoors = addDays(frost.lastFrost, 14); // 2 weeks after last frost
    if ((daysToMaturity?.min ?? 0) >= 60) {
      startIndoors = addDays(transplantOutdoors, -49); // 7 weeks before transplant
    }
  } else {
    // Cool season — can go out 4 weeks before last frost
    transplantOutdoors = addDays(frost.lastFrost, -28);
    if ((daysToMaturity?.min ?? 0) >= 40) {
      startIndoors = addDays(transplantOutdoors, -28);
    }
  }

  return {
    startIndoors,
    transplantOutdoors,
    harvestStart: daysToMaturity ? addDays(transplantOutdoors, daysToMaturity.min) : null,
    harvestEnd:   daysToMaturity ? addDays(transplantOutdoors, daysToMaturity.max) : null,
  };
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export function fmtDate(d: Date): string {
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

// ── Zone utilities ────────────────────────────────────────────────────────────

export function parseZoneNum(zone: string): number {
  const n = parseFloat(zone.toLowerCase().replace(/[ab]$/, ''));
  return isNaN(n) ? 6 : n;
}

// Returns day delta to add to the catalog water interval (negative = water more often)
export function getZoneWaterAdjustment(zone: string): number {
  const n = parseZoneNum(zone);
  if (n <= 5) return 1;   // cooler — soil stays moist longer
  if (n <= 7) return 0;   // temperate baseline
  if (n <= 9) return -1;  // warmer — dries faster
  return -2;              // hot/tropical
}

const TROPICAL_KEYS = new Set([
  'banana','plantain','mango','avocado','papaya','pineapple','coconut','lychee','guava',
  'passion_fruit','dragon_fruit','jackfruit','rambutan','starfruit','mangosteen',
  'soursop','breadfruit','cherimoya','water_spinach','moringa','luffa','snake_gourd',
  'winter_melon','bitter_melon','pandan','vanilla','allspice','black_pepper_vine',
  'heliconia','torch_ginger','bird_of_paradise','plumeria','bougainvillea',
  'cassava','taro','yardlong_bean','pigeon_pea','sorghum','calabash',
]);
const SUBTROPICAL_KEYS = new Set([
  'lemon','lime','orange','grapefruit','tangerine','kumquat','fig','pomegranate',
  'olive','pomelo','feijoa','loquat','carambola','tamarind','jujube',
  'hibiscus','cardamom','galangal','turmeric','ginger','ashwagandha',
]);
const COLD_TENDER_KEYS = new Set([
  'okra','sweet_potato','taro','yam','water_yam','chayote',
  'asian_eggplant','cowpea','mung_bean','adzuki_bean','peanut','lima_bean',
  'rice','water_chestnut','lotus_root',
]);

export interface ZoneViability {
  label: string;
  emoji: string;
  color: string;
}

export function getZoneViability(
  catalogKey: string | null,
  zone: string,
  isCoolSeason: boolean,
): ZoneViability {
  const n = parseZoneNum(zone);
  const key = catalogKey ?? '';

  if (TROPICAL_KEYS.has(key)) {
    if (n >= 10) return { label: 'Ideal for your zone', emoji: '✅', color: '#2b8a3e' };
    if (n >= 9)  return { label: 'Marginal — protect from cold snaps', emoji: '⚠️', color: '#e67700' };
    return { label: 'Not recommended for your zone', emoji: '❌', color: '#c92a2a' };
  }
  if (SUBTROPICAL_KEYS.has(key)) {
    if (n >= 9)  return { label: 'Ideal for your zone', emoji: '✅', color: '#2b8a3e' };
    if (n >= 8)  return { label: 'Marginal — may need frost protection', emoji: '⚠️', color: '#e67700' };
    return { label: 'Not recommended as outdoor perennial', emoji: '❌', color: '#c92a2a' };
  }
  if (COLD_TENDER_KEYS.has(key)) {
    if (n >= 6)  return { label: 'Ideal for your zone', emoji: '✅', color: '#2b8a3e' };
    if (n >= 4)  return { label: 'Marginal — choose a short-season variety', emoji: '⚠️', color: '#e67700' };
    return { label: 'Not recommended — season too short', emoji: '❌', color: '#c92a2a' };
  }
  if (isCoolSeason) {
    if (n <= 7)  return { label: 'Ideal for your zone', emoji: '✅', color: '#2b8a3e' };
    if (n <= 9)  return { label: 'Marginal — grow in spring or fall', emoji: '⚠️', color: '#e67700' };
    return { label: 'Challenging — grows only in cooler months', emoji: '⚠️', color: '#e67700' };
  }
  // Standard warm-season annual
  if (n >= 4)  return { label: 'Ideal for your zone', emoji: '✅', color: '#2b8a3e' };
  if (n >= 3)  return { label: 'Marginal — use a short-season variety', emoji: '⚠️', color: '#e67700' };
  return { label: 'Very short season — challenging', emoji: '⚠️', color: '#e67700' };
}
