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

export function layoutFromGarden(garden: any): GardenLayout {
  if (garden?.layout) {
    try {
      const parsed = typeof garden.layout === 'string'
        ? JSON.parse(garden.layout)
        : garden.layout;
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  // Fall back: all tiles get the garden's sun_exposure
  const sun = (garden?.sun_exposure ?? 'full_sun') as TileState;
  return makeLayout(garden?.rows ?? 6, garden?.cols ?? 8, sun);
}
