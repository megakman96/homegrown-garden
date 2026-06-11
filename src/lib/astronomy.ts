// Astronomical calculations — no API, pure math
// Algorithms from Jean Meeus "Astronomical Algorithms" (simplified)

function toRad(deg: number) { return deg * (Math.PI / 180); }
function norm(deg: number)  { return ((deg % 360) + 360) % 360; }

function julianDay(date: Date): number {
  const y = date.getUTCFullYear();
  let m = date.getUTCMonth() + 1;
  const d = date.getUTCDate() + (date.getUTCHours() + date.getUTCMinutes() / 60) / 24;
  if (m <= 2) { m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

// ── Zodiac signs ──────────────────────────────────────────────────────────────

export type Element = 'Fire' | 'Earth' | 'Air' | 'Water';

export interface ZodiacSign {
  name: string;
  emoji: string;
  element: Element;
  symbol: string;
}

const SIGNS: ZodiacSign[] = [
  { name: 'Aries',       emoji: '♈', element: 'Fire',  symbol: '♈' },
  { name: 'Taurus',      emoji: '♉', element: 'Earth', symbol: '♉' },
  { name: 'Gemini',      emoji: '♊', element: 'Air',   symbol: '♊' },
  { name: 'Cancer',      emoji: '♋', element: 'Water', symbol: '♋' },
  { name: 'Leo',         emoji: '♌', element: 'Fire',  symbol: '♌' },
  { name: 'Virgo',       emoji: '♍', element: 'Earth', symbol: '♍' },
  { name: 'Libra',       emoji: '♎', element: 'Air',   symbol: '♎' },
  { name: 'Scorpio',     emoji: '♏', element: 'Water', symbol: '♏' },
  { name: 'Sagittarius', emoji: '♐', element: 'Fire',  symbol: '♐' },
  { name: 'Capricorn',   emoji: '♑', element: 'Earth', symbol: '♑' },
  { name: 'Aquarius',    emoji: '♒', element: 'Air',   symbol: '♒' },
  { name: 'Pisces',      emoji: '♓', element: 'Water', symbol: '♓' },
];

function longitudeToSign(lon: number): ZodiacSign {
  return SIGNS[Math.floor(norm(lon) / 30) % 12];
}

// ── Moon phase ────────────────────────────────────────────────────────────────

export interface MoonPhase {
  emoji: string;
  name: string;
  /** 0 = new moon, 0.5 = full moon, 1 = back to new */
  pct: number;
  /** 0–100 percent illuminated */
  illumination: number;
  /** True if waxing */
  waxing: boolean;
}

const SYNODIC_PERIOD  = 29.53058867;
const KNOWN_NEW_MOON  = 2451550.259722; // Jan 6 2000 18:14 UTC

export function getMoonPhase(date: Date = new Date()): MoonPhase {
  const jd = julianDay(date);
  const age = ((jd - KNOWN_NEW_MOON) % SYNODIC_PERIOD + SYNODIC_PERIOD) % SYNODIC_PERIOD;
  const pct = age / SYNODIC_PERIOD;
  const illumination = Math.round((1 - Math.cos(toRad(pct * 360))) / 2 * 100);
  const waxing = pct < 0.5;

  let emoji: string;
  let name: string;
  if      (pct < 0.025 || pct >= 0.975) { emoji = '🌑'; name = 'New Moon'; }
  else if (pct < 0.25)                   { emoji = '🌒'; name = 'Waxing Crescent'; }
  else if (pct < 0.275)                  { emoji = '🌓'; name = 'First Quarter'; }
  else if (pct < 0.5)                    { emoji = '🌔'; name = 'Waxing Gibbous'; }
  else if (pct < 0.525)                  { emoji = '🌕'; name = 'Full Moon'; }
  else if (pct < 0.75)                   { emoji = '🌖'; name = 'Waning Gibbous'; }
  else if (pct < 0.775)                  { emoji = '🌗'; name = 'Last Quarter'; }
  else                                   { emoji = '🌘'; name = 'Waning Crescent'; }

  return { emoji, name, pct, illumination, waxing };
}

// ── Moon's zodiac sign ────────────────────────────────────────────────────────

export function getMoonSign(date: Date = new Date()): ZodiacSign {
  const jd = julianDay(date);
  const T  = (jd - 2451545.0) / 36525; // Julian centuries from J2000.0

  const Lm = norm(218.3165 + 481267.8813 * T);
  const Mm = norm(134.9629 + 477198.8676 * T);
  const D  = norm(297.8502 + 445267.1115 * T);
  const Ms = norm(357.5291 +  35999.0503 * T);
  const Fm = norm( 93.2720 + 483202.0175 * T);

  const lambda = Lm
    + 6.2888 * Math.sin(toRad(Mm))
    + 1.2740 * Math.sin(toRad(2*D - Mm))
    - 0.6583 * Math.sin(toRad(2*D))
    + 0.2136 * Math.sin(toRad(2*Mm))
    - 0.1851 * Math.sin(toRad(Ms))
    - 0.1143 * Math.sin(toRad(2*Fm))
    + 0.0588 * Math.sin(toRad(2*D - 2*Mm))
    + 0.0572 * Math.sin(toRad(2*D - Ms - Mm))
    + 0.0533 * Math.sin(toRad(2*D + Mm));

  return longitudeToSign(lambda);
}

// ── Sun's zodiac sign ─────────────────────────────────────────────────────────

export function getSunSign(date: Date = new Date()): ZodiacSign {
  const jd = julianDay(date);
  const T  = (jd - 2451545.0) / 36525;

  const L = norm(280.46646 + 36000.76983 * T);
  const M = norm(357.52911 + 35999.05029 * T - 0.0001537 * T * T);

  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(toRad(M))
           + (0.019993 - 0.000101 * T) * Math.sin(toRad(2 * M))
           + 0.000289 * Math.sin(toRad(3 * M));

  return longitudeToSign(L + C);
}

// ── Biodynamic gardening tip ──────────────────────────────────────────────────

const ELEMENT_TIPS: Record<Element, string> = {
  Fire:  'Fire sign — focus on fruits and seeds.',
  Earth: 'Earth sign — ideal for root crops.',
  Air:   'Air sign — flowers and aromatics thrive.',
  Water: 'Water sign — great for leafy greens and watering.',
};

export function getGardeningTip(phase: MoonPhase, moonSign: ZodiacSign): string {
  const { pct } = phase;
  let base: string;

  if (pct < 0.025 || pct >= 0.975) {
    base = 'New moon — a resting period. Great for planning, soil prep, and compost turning.';
  } else if (pct < 0.25) {
    base = 'Waxing crescent — energy is building. Plant leafy greens, herbs, and fast-growing crops.';
  } else if (pct < 0.275) {
    base = 'First quarter — strong growth energy. Excellent for planting fruiting crops like tomatoes and peppers.';
  } else if (pct < 0.5) {
    base = 'Waxing gibbous — near peak. Fertilize, water generously, and plant transplants.';
  } else if (pct < 0.525) {
    base = 'Full moon — peak energy. Best time to plant, transplant, and harvest for storage.';
  } else if (pct < 0.75) {
    base = 'Waning gibbous — harvest time. Pull root vegetables and prune for vigorous regrowth.';
  } else if (pct < 0.775) {
    base = 'Last quarter — wind down. Weed, turn compost, and prepare beds for the next cycle.';
  } else {
    base = 'Waning crescent — rest and prepare. Store harvests and plan for the new cycle ahead.';
  }

  return `🌙 ${base} ${ELEMENT_TIPS[moonSign.element]}`;
}
