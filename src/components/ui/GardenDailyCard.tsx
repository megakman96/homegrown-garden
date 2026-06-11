import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, formatTemp } from '@/contexts/theme-context';
import { G, R, Shadow } from '@/constants/theme';
import type { WeatherData, WeatherDay } from '@/lib/weather';
import { getMoonPhase, getMoonSign, getSunSign, getGardeningTip } from '@/lib/astronomy';

// ─── Fun facts ────────────────────────────────────────────────────────────────

const FACTS = [
  'A teaspoon of healthy garden soil contains more microorganisms than there are people on Earth.',
  'Talking to your plants works — the CO₂ you exhale and the vibrations of your voice can stimulate growth.',
  'Bees are responsible for pollinating about ⅓ of everything humans eat.',
  'Sunflowers track the sun across the sky each day — a behavior called heliotropism.',
  'Tomatoes have roughly 35,000 genes, more than the human genome\'s ~20,500.',
  'Grass releases chemical signals when cut that act as a distress call to neighboring plants.',
  'The smell of rain on dry earth is called petrichor, produced by soil bacteria called actinomycetes.',
  'Bamboo is the world\'s fastest-growing plant — some species grow 91 cm (36 inches) in a single day.',
  'Plants communicate through underground fungal networks called mycorrhizae — the "wood wide web."',
  'A mature oak tree can release up to 40,000 gallons of water into the air each year.',
  'Carrots were originally purple and yellow — orange varieties were bred in the Netherlands in the 17th century.',
  'Cucumbers are 96% water by weight — one of the most hydrating vegetables you can grow.',
  'Strawberries are the only fruit with seeds on the outside, and they\'re not technically berries.',
  'Lavender\'s scent has been shown to reduce anxiety and promote deeper sleep.',
  'A single mature tree absorbs about 48 pounds of CO₂ per year.',
  'Earthworms create castings that are 5× richer in nitrogen than the surrounding topsoil.',
  'Companion planting basil near tomatoes is believed to repel aphids and improve flavor.',
  'The world\'s oldest living tree — a Great Basin bristlecone pine — is over 5,000 years old.',
  'Potatoes were the first vegetable grown in space, aboard Space Shuttle Columbia in 1995.',
  'Mint grows so aggressively that gardeners often plant it in buried containers to prevent takeover.',
  'Watermelons are 92% water — their Latin name, Citrullus lanatus, hints at their citrus-fresh taste.',
  'Garlic has natural antibacterial properties and was used as an antibiotic before penicillin.',
  'Bees see ultraviolet nectar guides on flower petals — patterns completely invisible to human eyes.',
  'A healthy rose bush can live for over 30 years with consistent pruning and care.',
  'Peas were among the first cultivated vegetables, farmed over 10,000 years ago in the Near East.',
  'Zucchini is technically a fruit — it grows from a pollinated flower, just like any other berry.',
  'Compost can be ready in as little as 18 days with the right 30:1 carbon-to-nitrogen ratio.',
  'Fireflies create light through bioluminescence — a cold chemical reaction that produces almost no heat.',
  'Butterfly wings are transparent — the colorful scales layered on top create all the patterns we see.',
  'A single sunflower head is actually made up of up to 2,000 tiny individual flowers called florets.',
  'Sweet corn is best eaten within hours of picking — its sugars convert to starch remarkably fast.',
  'Tomato plants release solanine — a natural toxin in their leaves — to deter insects and grazing animals.',
  'Bumblebees vibrate their flight muscles at exactly the right frequency to shake pollen loose: "buzz pollination."',
  'Asparagus can take 3 years before it produces a first harvest — but then yields for 20+ years.',
  'Marigolds release a compound from their roots that repels nematodes and whiteflies from nearby plants.',
];

// ─── Scene configuration ──────────────────────────────────────────────────────

type TimeOfDay = 'night' | 'dawn' | 'morning' | 'afternoon' | 'evening' | 'dusk';

interface SceneConfig {
  grad: readonly [string, string, string];
  orb: string;
  floaters: string[];
}

const SCENES: Record<TimeOfDay, SceneConfig> = {
  night: {
    grad:     ['#0c1a2e', '#172840', '#0a1520'] as const,
    orb:      '🌙',
    floaters: ['⭐', '✨', '🌟', '⭐', '💫', '✨'],
  },
  dawn: {
    grad:     ['#b04060', '#e07840', '#f4b840'] as const,
    orb:      '🌅',
    floaters: ['🌸', '🌿', '🐦', '🌸', '💧', '🍃'],
  },
  morning: {
    grad:     ['#5ab070', '#a0cc70', '#f0e870'] as const,
    orb:      '☀️',
    floaters: ['🐝', '🦋', '🌸', '🍃', '🐝', '🌼'],
  },
  afternoon: {
    grad:     ['#58aee0', '#80c898', '#b8de68'] as const,
    orb:      '☀️',
    floaters: ['🦋', '🌺', '🍃', '🌻', '🐛', '🌿'],
  },
  evening: {
    grad:     ['#c04030', '#983060', '#601880'] as const,
    orb:      '🌇',
    floaters: ['🦋', '🌸', '🍃', '✨', '💫', '🌙'],
  },
  dusk: {
    grad:     ['#381050', '#783070', '#b06090'] as const,
    orb:      '🌙',
    floaters: ['✨', '💫', '⭐', '🌙', '✨', '🌟'],
  },
};

function getTimeOfDay(h: number): TimeOfDay {
  if (h < 5)  return 'night';
  if (h < 7)  return 'dawn';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 20) return 'evening';
  return 'dusk';
}

// Approximate sky position of the orb as a left-% (0–84)
function orbLeftPct(h: number): number {
  if (h < 5 || h >= 20) return 72;   // moon — upper right
  if (h < 7)  return 12 + (h - 5) * 8;
  if (h <= 13) return 25 + (h - 7) * 9;
  return Math.max(10, 79 - (h - 13) * 7);
}

// ─── Element layout (randomised once per mount) ───────────────────────────────

interface Floater {
  emoji: string;
  leftPct: number;
  topPct: number;
  size: number;
  delayMs: number;
  durationMs: number;
  amp: number;
  dir: 1 | -1;
}

function makeFloaters(emojis: string[]): Floater[] {
  // Spread elements across 6 horizontal zones to avoid clustering
  const zones = [0, 16, 30, 48, 62, 78];
  return emojis.map((emoji, i) => ({
    emoji,
    leftPct:    zones[i % zones.length] + (Math.random() * 12 | 0),
    topPct:     10 + (Math.random() * 58 | 0),
    size:       13 + (Math.random() * 11 | 0),
    delayMs:    i * 280 + (Math.random() * 320 | 0),
    durationMs: 2100 + (Math.random() * 1600 | 0),
    amp:        6  + (Math.random() * 8  | 0),
    dir:        (Math.random() > 0.5 ? 1 : -1) as 1 | -1,
  }));
}

// ─── Time formatting ──────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  const t = iso.split('T')[1];
  if (!t) return '';
  const [hh, mm] = t.split(':').map(Number);
  const period = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${String(mm).padStart(2, '0')} ${period}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  weather: WeatherData | null;
  tempUnit: 'C' | 'F';
  onPressWeather?: () => void;
}

export default function GardenDailyCard({ weather, tempUnit, onPressWeather }: Props) {
  const { isDark, colors } = useAppTheme();
  const cardBg    = isDark ? colors.bgCard    : G.cloud;
  const textPrim  = isDark ? colors.text      : G.forest;
  const textSec   = isDark ? colors.textSec   : G.stone;
  const borderCol = isDark ? colors.border    : G.mist;

  const hour = new Date().getHours();
  const tod  = getTimeOfDay(hour);
  const conf = SCENES[tod];

  // Celestial data — computed once on mount, stable for the session
  const [moonPhase] = useState(() => getMoonPhase());
  const [moonSign]  = useState(() => getMoonSign());
  const [sunSign]   = useState(() => getSunSign());
  const [gardenTip] = useState(() => getGardeningTip(getMoonPhase(), getMoonSign()));

  // Use actual moon phase emoji in night/dusk scenes
  const effectiveConf = (tod === 'night' || tod === 'dusk')
    ? { ...conf, orb: moonPhase.emoji }
    : conf;

  const [floaters] = useState<Floater[]>(() => makeFloaters(effectiveConf.floaters));
  const [fact]     = useState<string>(
    () => FACTS[Math.floor(Math.random() * FACTS.length)],
  );

  // Animated values
  const fadeIn   = useRef(new Animated.Value(0)).current;
  const orbScale = useRef(new Animated.Value(1)).current;
  const floatY   = useRef(floaters.map(() => new Animated.Value(0))).current;
  const driftX   = useRef(floaters.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 650, useNativeDriver: true }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale, { toValue: 1.14, duration: 2900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(orbScale, { toValue: 0.93, duration: 2900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();

    floaters.forEach((el, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(el.delayMs),
          Animated.timing(floatY[i], { toValue: -el.amp,       duration: el.durationMs,       easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(floatY[i], { toValue:  el.amp * 0.55, duration: el.durationMs,       easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.delay(el.delayMs * 0.5),
          Animated.timing(driftX[i], { toValue:  6 * el.dir, duration: el.durationMs * 1.6, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(driftX[i], { toValue: -4 * el.dir, duration: el.durationMs * 1.6, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ).start();
    });
  }, []);

  const todayStr  = new Date().toISOString().slice(0, 10);
  const todayWx: WeatherDay | undefined = weather?.days.find(d => d.date === todayStr);
  const sunriseStr = todayWx?.sunrise ? fmtTime(todayWx.sunrise) : null;
  const sunsetStr  = todayWx?.sunset  ? fmtTime(todayWx.sunset)  : null;
  const next3Rain  = weather?.days.filter(d => d.isFuture && d.isRainy).slice(0, 3) ?? [];

  const orbX = orbLeftPct(hour);

  return (
    <Animated.View style={[styles.card, { backgroundColor: cardBg, borderColor: borderCol, opacity: fadeIn }]}>

      {/* ── Animated scene ── */}
      <LinearGradient
        colors={effectiveConf.grad as unknown as [string, string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.scene}
      >
        {/* Floating elements */}
        {floaters.map((el, i) => (
          <Animated.Text
            key={i}
            style={[
              styles.floater,
              {
                left:     `${el.leftPct}%` as any,
                top:      `${el.topPct}%`  as any,
                fontSize: el.size,
                transform: [
                  { translateY: floatY[i] },
                  { translateX: driftX[i] },
                ],
              },
            ]}
          >
            {el.emoji}
          </Animated.Text>
        ))}

        {/* Orb (sun / moon — uses real phase emoji at night) */}
        <Animated.Text
          style={[
            styles.orb,
            {
              left:      `${orbX}%` as any,
              transform: [{ scale: orbScale }],
            },
          ]}
        >
          {effectiveConf.orb}
        </Animated.Text>

        {/* Subtle bottom vignette */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.28)']}
          style={styles.vignette}
          pointerEvents="none"
        />
      </LinearGradient>

      {/* ── Info section ── */}
      <View style={styles.infoSection}>

        {/* Sunrise / Sunset / Temp chips */}
        {(sunriseStr || sunsetStr || todayWx) && (
          <View style={styles.chipsRow}>
            {sunriseStr && (
              <View style={[styles.chip, { backgroundColor: isDark ? colors.bgElement : '#fffbeb', borderColor: isDark ? colors.border : '#fde68a' }]}>
                <Text style={styles.chipEmoji}>🌅</Text>
                <View>
                  <Text style={[styles.chipLabel, { color: textSec }]}>SUNRISE</Text>
                  <Text style={[styles.chipVal,   { color: textPrim }]}>{sunriseStr}</Text>
                </View>
              </View>
            )}
            {sunsetStr && (
              <View style={[styles.chip, { backgroundColor: isDark ? colors.bgElement : '#fff4e6', borderColor: isDark ? colors.border : '#fdb76a' }]}>
                <Text style={styles.chipEmoji}>🌇</Text>
                <View>
                  <Text style={[styles.chipLabel, { color: textSec }]}>SUNSET</Text>
                  <Text style={[styles.chipVal,   { color: textPrim }]}>{sunsetStr}</Text>
                </View>
              </View>
            )}
            {todayWx && (
              <TouchableOpacity
                style={[styles.chip, { backgroundColor: isDark ? colors.bgElement : '#f0fdf4', borderColor: isDark ? colors.border : '#a5d6a7' }]}
                onPress={onPressWeather}
                activeOpacity={onPressWeather ? 0.7 : 1}
              >
                <Text style={styles.chipEmoji}>{todayWx.isRainy ? '🌧️' : todayWx.tempMaxC >= 30 ? '🥵' : '☀️'}</Text>
                <View>
                  <Text style={[styles.chipLabel, { color: textSec }]}>TODAY</Text>
                  <Text style={[styles.chipVal,   { color: textPrim }]}>
                    {formatTemp(todayWx.tempMaxC, tempUnit)} / {formatTemp(todayWx.tempMinC, tempUnit)}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Rain forecast — only if upcoming rain */}
        {next3Rain.length > 0 && (
          <View style={[styles.rainBanner, { backgroundColor: isDark ? colors.bgElement : '#e7f5ff', borderColor: isDark ? colors.border : '#74c0fc' }]}>
            <Text style={[styles.rainText, { color: isDark ? '#74c0fc' : '#1971c2' }]}>
              🌧️ Rain expected {next3Rain.map(d =>
                new Date(d.date + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' })
              ).join(', ')}
            </Text>
          </View>
        )}

        {/* No location prompt */}
        {!weather && (
          <TouchableOpacity onPress={onPressWeather} activeOpacity={0.7}>
            <View style={[styles.rainBanner, { backgroundColor: isDark ? colors.bgElement : G.foam, borderColor: borderCol }]}>
              <Text style={[styles.rainText, { color: textSec }]}>
                📍 Add a location in the Schedule tab to see sunrise, sunset & weather
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Celestial — moon phase, moon sign, sun sign */}
        <View style={[styles.celestialBox, { backgroundColor: isDark ? '#1a1030' : '#f5f0ff', borderColor: isDark ? '#3a2060' : '#d4b8ff' }]}>
          <Text style={[styles.celestialTitle, { color: isDark ? '#c8a8ff' : '#6b3fa0' }]}>✨ Tonight's Sky</Text>
          <View style={styles.chipsRow}>
            <View style={[styles.chip, { backgroundColor: isDark ? '#2a1848' : '#ede0ff', borderColor: isDark ? '#4a2880' : '#c4a0e8' }]}>
              <Text style={styles.chipEmoji}>{moonPhase.emoji}</Text>
              <View>
                <Text style={[styles.chipLabel, { color: isDark ? '#c8a8ff' : '#6b3fa0' }]}>MOON</Text>
                <Text style={[styles.chipVal, { color: isDark ? '#f0e8ff' : '#3d1a6b' }]}>{moonPhase.name}</Text>
                <Text style={[styles.chipSub, { color: isDark ? '#a080d0' : '#8b5fcf' }]}>{moonPhase.illumination}% lit</Text>
              </View>
            </View>
            <View style={[styles.chip, { backgroundColor: isDark ? '#1a2040' : '#e8eeff', borderColor: isDark ? '#304080' : '#a0b4e8' }]}>
              <Text style={styles.chipEmoji}>{moonSign.emoji}</Text>
              <View>
                <Text style={[styles.chipLabel, { color: isDark ? '#a0b8ff' : '#2a4090' }]}>MOON IN</Text>
                <Text style={[styles.chipVal, { color: isDark ? '#e0e8ff' : '#1a306b' }]}>{moonSign.name}</Text>
                <Text style={[styles.chipSub, { color: isDark ? '#8090c0' : '#5060a0' }]}>{moonSign.element}</Text>
              </View>
            </View>
            <View style={[styles.chip, { backgroundColor: isDark ? '#201818' : '#fff3e0', borderColor: isDark ? '#604030' : '#ffb74d' }]}>
              <Text style={styles.chipEmoji}>{sunSign.emoji}</Text>
              <View>
                <Text style={[styles.chipLabel, { color: isDark ? '#ffb080' : '#bf6000' }]}>SUN IN</Text>
                <Text style={[styles.chipVal, { color: isDark ? '#ffe0b8' : '#6b3000' }]}>{sunSign.name}</Text>
                <Text style={[styles.chipSub, { color: isDark ? '#c09060' : '#a06030' }]}>{sunSign.element}</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.gardenTip, { color: isDark ? '#b898e8' : '#5a3890' }]}>{gardenTip}</Text>
        </View>

        {/* Fun fact */}
        <View style={[styles.factBox, { backgroundColor: isDark ? colors.bgElement : G.foam, borderColor: borderCol }]}>
          <Text style={[styles.factLabel, { color: G.sage }]}>🌿 Garden Fact</Text>
          <Text style={[styles.factText, { color: textPrim }]}>{fact}</Text>
        </View>

      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: R.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadow.card,
  },

  // Scene
  scene: {
    height: 158,
    overflow: 'hidden',
  },
  floater: {
    position: 'absolute',
    opacity: 0.82,
  },
  orb: {
    position: 'absolute',
    top: '12%' as any,
    fontSize: 40,
  },
  vignette: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
  },

  // Info section
  infoSection: {
    padding: 14,
    gap: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    flex: 1,
    minWidth: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: R.md,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipEmoji: { fontSize: 20 },
  chipLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  chipVal:   { fontSize: 14, fontWeight: '800', marginTop: 1 },

  rainBanner: {
    borderRadius: R.md,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rainText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },

  factBox: {
    borderRadius: R.md,
    borderWidth: 1,
    padding: 12,
  },
  factLabel: { fontSize: 11, fontWeight: '700', marginBottom: 5, letterSpacing: 0.3 },
  factText:  { fontSize: 13, lineHeight: 19 },

  celestialBox: {
    borderRadius: R.md,
    borderWidth: 1.5,
    padding: 12,
    gap: 10,
  },
  celestialTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  chipSub:  { fontSize: 9, marginTop: 1 },
  gardenTip: { fontSize: 12, lineHeight: 18, fontStyle: 'italic' },
});
