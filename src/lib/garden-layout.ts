export type TileState = 'inactive' | 'full_sun' | 'partial_sun' | 'shade';
export type GardenLayout = TileState[][];

export const TILE_COLORS: Record<TileState, string> = {
  inactive:    '#dde3e0',
  full_sun:    '#ffd166',
  partial_sun: '#f4a261',
  shade:       '#90c4e8',
};

export const TILE_LABELS: Record<TileState, string> = {
  inactive:    'Path',
  full_sun:    'Full Sun',
  partial_sun: 'Partial Sun',
  shade:       'Shade',
};

export const TILE_EMOJIS: Record<TileState, string> = {
  inactive:    '▫️',
  full_sun:    '☀️',
  partial_sun: '⛅',
  shade:       '🌑',
};

export const SUN_CYCLE: TileState[] = ['full_sun', 'partial_sun', 'shade'];

export function makeLayout(rows: number, cols: number, fill: TileState = 'inactive'): GardenLayout {
  return Array.from({ length: rows }, () => Array(cols).fill(fill));
}

export function resizeLayout(layout: GardenLayout, rows: number, cols: number): GardenLayout {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => layout[r]?.[c] ?? 'inactive')
  );
}

export function activeCount(layout: GardenLayout): number {
  return layout.flat().filter(t => t !== 'inactive').length;
}

export function sunSetCount(layout: GardenLayout): number {
  return layout.flat().filter(t => t !== 'inactive').length;
}

export const DEFAULT_TILE_SIZE_CM = 30; // 1 square foot ≈ 30 cm
export const DEFAULT_TILE_SIZE_IN = 12; // default tile = 1 ft
export const TILE_SIZE_STEP_IN = 6;    // step in 6-inch increments
export const TILE_SIZE_MIN_IN  = 6;
export const TILE_SIZE_MAX_IN  = 48;

// Returns the tile size for a garden in whole inches (for UI use)
export function tileSizeInFromGarden(garden: any): number {
  const cm = tileSizeFromGarden(garden);
  return Math.round(cm / 2.54 / TILE_SIZE_STEP_IN) * TILE_SIZE_STEP_IN || DEFAULT_TILE_SIZE_IN;
}

// e.g. 6 → '6"', 12 → '1 ft', 18 → '1½ ft', 24 → '2 ft'
export function formatTileSize(inches: number): string {
  if (inches < 12) return `${inches}"`;
  const whole = Math.floor(inches / 12);
  const rem = inches % 12;
  if (rem === 0) return `${whole} ft`;
  if (rem === 6)  return `${whole}½ ft`;
  return `${whole} ft ${rem}"`;
}

// e.g. total inches → '4 ft', '4 ft 6"', '3½ ft'
export function formatTotalSize(cols: number, rows: number, tileSizeIn: number): string {
  const w = cols * tileSizeIn;
  const h = rows * tileSizeIn;
  const fmt = (n: number) => {
    const ft = Math.floor(n / 12);
    const rem = n % 12;
    if (rem === 0) return `${ft} ft`;
    return `${ft} ft ${rem}"`;
  };
  return `${fmt(w)} × ${fmt(h)}`;
}

export function layoutFromGarden(garden: any): GardenLayout {
  if (garden?.layout) {
    try {
      const parsed = typeof garden.layout === 'string'
        ? JSON.parse(garden.layout)
        : garden.layout;
      if (Array.isArray(parsed)) return parsed;            // legacy: bare 2-D array
      if (Array.isArray(parsed?.tiles)) return parsed.tiles; // new: {tiles, tile_size_cm}
    } catch {}
  }
  const sun = (garden?.sun_exposure ?? 'full_sun') as TileState;
  return makeLayout(garden?.rows ?? 6, garden?.cols ?? 8, sun);
}

function parsedLayout(garden: any): any | null {
  if (!garden?.layout) return null;
  try {
    const p = typeof garden.layout === 'string' ? JSON.parse(garden.layout) : garden.layout;
    return Array.isArray(p) ? null : p; // null for legacy bare-array format
  } catch { return null; }
}

export function tileSizeFromGarden(garden: any): number {
  return Number(parsedLayout(garden)?.tile_size_cm) || DEFAULT_TILE_SIZE_CM;
}

export function yearFromGarden(garden: any): number | null {
  // Prefer layout JSON (no schema field needed); fall back to top-level field
  const fromLayout = parsedLayout(garden)?.year;
  if (fromLayout != null && Number(fromLayout)) return Number(fromLayout);
  const fromField = (garden as any)?.year;
  if (fromField != null && Number(fromField)) return Number(fromField);
  return null;
}

export function sortGardens<T extends { created?: string }>(gardens: T[]): T[] {
  const currentYear = new Date().getFullYear();
  return [...gardens].sort((a, b) => {
    const ya = (yearFromGarden(a) ?? currentYear);
    const yb = (yearFromGarden(b) ?? currentYear);
    if (yb !== ya) return ya - yb;
    return new Date(b.created ?? 0).getTime() - new Date(a.created ?? 0).getTime();
  });
}

export function serializeLayout(layout: GardenLayout, tileSizeCm: number, year?: number | null): string {
  return JSON.stringify({ tiles: layout, tile_size_cm: tileSizeCm, ...(year != null ? { year } : {}) });
}

export function cmToIn(cm: number): string {
  return `${(cm / 2.54).toFixed(1)}"`;
}
