import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  View, Text, StyleSheet, TextInput, ScrollView,
  useWindowDimensions, Alert, ActivityIndicator, Platform,
  TouchableOpacity, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { pb } from '@/lib/pb';
import { useAuth } from '@/hooks/use-auth';
import { PressableScale } from '@/components/ui/PressableScale';
import { G, Shadow, R, Spring } from '@/constants/theme';
import {
  makeLayout, resizeLayout, TILE_COLORS, TILE_EMOJIS, TILE_LABELS,
  SUN_CYCLE, activeCount, serializeLayout,
  DEFAULT_TILE_SIZE_IN, TILE_SIZE_STEP_IN, TILE_SIZE_MIN_IN, TILE_SIZE_MAX_IN,
  formatTileSize, formatTotalSize,
  type TileState, type GardenLayout,
} from '@/lib/garden-layout';
import {
  searchCity, saveLocation, saveGardenLocation,
  type Location, type GeoResult,
} from '@/lib/weather';

type Step = 'year' | 'name' | 'size' | 'shape' | 'sun' | 'location';
const STEPS: Step[] = ['name', 'year', 'size', 'shape', 'sun', 'location'];

const STEP_TITLES: Record<Step, string> = {
  year:     'Which season is this for?',
  name:     'Name your garden',
  size:     'How big is it?',
  shape:    'Draw your garden',
  sun:      'Set the sunlight',
  location: 'Where is your garden?',
};
const STEP_SUBS: Record<Step, string> = {
  year:     'Current year = active garden. A future year means it\'s a planning-phase layout.',
  name:     "Give your garden a name you'll recognize.",
  size:     'Set the grid dimensions. Each tile is ~30×30 cm (1 sq ft). You can adjust later.',
  shape:    'Tap tiles to include them in your garden.',
  sun:      'Tap each tile to set its sunlight level.',
  location: 'Used for weather-aware watering reminders. You can skip this and add it later.',
};
const STEP_EMOJIS: Record<Step, string> = {
  year:     '📅',
  name:     '🌱',
  size:     '📐',
  shape:    '🗺️',
  sun:      '☀️',
  location: '📍',
};

const MIN_SIZE = 3;
const MAX_ROWS = 14;
const MAX_COLS = 14;

export default function NewGardenScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { noSkip } = useLocalSearchParams<{ noSkip?: string }>();
  const showSkip = !noSkip;
  const { width } = useWindowDimensions();

  const [step, setStep] = useState<Step>('name');
  const [year, setYear] = useState(new Date().getFullYear());
  const [name, setName] = useState('');
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(8);
  const [tileSizeIn, setTileSizeIn] = useState(DEFAULT_TILE_SIZE_IN);
  const [layout, setLayout] = useState<GardenLayout>(() => makeLayout(6, 8));
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<GeoResult[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);

  const currentYear = new Date().getFullYear();
  const isPlanningYear = year > currentYear;

  const slideX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const stepIndex = STEPS.indexOf(step);

  function transitionTo(nextStep: Step) {
    const forward = STEPS.indexOf(nextStep) > stepIndex;
    opacity.value = withTiming(0, { duration: 160 }, () => {
      slideX.value = forward ? 40 : -40;
      runOnJS(setStep)(nextStep);
      slideX.value = withSpring(0, Spring.gentle);
      opacity.value = withTiming(1, { duration: 200 });
    });
  }

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: slideX.value }],
  }));

  function handleSizeChange(dim: 'rows' | 'cols', delta: number) {
    if (dim === 'rows') {
      const next = Math.max(MIN_SIZE, Math.min(MAX_ROWS, rows + delta));
      setRows(next);
      setLayout(prev => resizeLayout(prev, next, cols));
    } else {
      const next = Math.max(MIN_SIZE, Math.min(MAX_COLS, cols + delta));
      setCols(next);
      setLayout(prev => resizeLayout(prev, rows, next));
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function toggleTile(r: number, c: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLayout(prev => {
      const next = prev.map(row => [...row]);
      next[r][c] = next[r][c] === 'inactive' ? 'full_sun' : 'inactive';
      return next;
    });
  }

  function cycleSun(r: number, c: number) {
    if (layout[r][c] === 'inactive') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLayout(prev => {
      const next = prev.map(row => [...row]);
      const curr = next[r][c] as TileState;
      const idx = SUN_CYCLE.indexOf(curr);
      next[r][c] = SUN_CYCLE[(idx + 1) % SUN_CYCLE.length];
      return next;
    });
  }

  async function searchLocation(q: string) {
    setLocationQuery(q);
    if (q.length < 2) { setLocationResults([]); return; }
    setLocationSearching(true);
    const results = await searchCity(q);
    setLocationResults(results);
    setLocationSearching(false);
  }

  function selectLocation(r: GeoResult) {
    const loc: Location = {
      latitude: r.latitude,
      longitude: r.longitude,
      name: r.admin1 ? `${r.name}, ${r.admin1}` : `${r.name}, ${r.country}`,
    };
    setLocation(loc);
    setLocationQuery('');
    setLocationResults([]);
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      const garden = await pb.collection('gardens').create({
        user_id: user.id,
        name: name.trim() || 'My Garden',
        rows,
        cols,
        sun_exposure: 'full_sun',
        layout: serializeLayout(layout, tileSizeIn * 2.54, year),
        location_json: location ? JSON.stringify(location) : null,
      });
      if (location) {
        await saveGardenLocation(garden.id, location).catch(() => {});
        await saveLocation(location).catch(() => {});
      }
      router.replace('/(tabs)/garden');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save garden');
    } finally {
      setSaving(false);
    }
  }

  const gridPadding = 32;
  const maxGridWidth = Math.min(width - gridPadding * 2, 520);
  const tileSize = Math.max(22, Math.min(46, Math.floor((maxGridWidth - cols * 3) / cols)));
  const activeTiles = activeCount(layout);


  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient colors={[G.forest, G.hunter]} style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.backBtn} haptic={false}>
          <Text style={styles.backText}>✕</Text>
        </PressableScale>
        <Text style={styles.headerTitle}>New Garden</Text>
        {showSkip && (
          <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* Step indicator */}
      <View style={styles.stepRow}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.stepDotWrap}>
            <View style={[styles.stepDot, i <= stepIndex && styles.stepDotActive]} />
            {i < STEPS.length - 1 && (
              <View style={[styles.stepLine, i < stepIndex && styles.stepLineActive]} />
            )}
          </View>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.stepContent, contentStyle]}>
          <Text style={styles.stepEmoji}>{STEP_EMOJIS[step]}</Text>
          <Text style={styles.stepTitle}>{STEP_TITLES[step]}</Text>
          <Text style={styles.stepSub}>{STEP_SUBS[step]}</Text>

          {/* ── Step: year ── */}
          {step === 'year' && (
            <View style={styles.yearStep}>
              <View style={styles.yearStepper}>
                <PressableScale onPress={() => setYear(y => Math.max(currentYear - 1, y - 1))} style={styles.yearBtn}>
                  <Text style={styles.yearBtnText}>−</Text>
                </PressableScale>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={styles.yearValue}>{year}</Text>
                  {isPlanningYear && (
                    <View style={styles.planningBadge}>
                      <Text style={styles.planningBadgeText}>📋 Planning Phase</Text>
                    </View>
                  )}
                  {!isPlanningYear && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>🌿 Active Season</Text>
                    </View>
                  )}
                </View>
                <PressableScale onPress={() => setYear(y => y + 1)} style={styles.yearBtn}>
                  <Text style={styles.yearBtnText}>+</Text>
                </PressableScale>
              </View>
              {isPlanningYear && (
                <Text style={styles.planningNote}>
                  Planting a future garden lets you plan ahead — it won't appear in your watering schedule until that season starts.
                </Text>
              )}
            </View>
          )}

          {/* ── Step: name ── */}
          {step === 'name' && (
            <View style={styles.nameStep}>
              <TextInput
                style={styles.nameInput}
                placeholder="e.g. Backyard Garden"
                placeholderTextColor={G.stone}
                value={name}
                onChangeText={setName}
                autoFocus
                maxLength={40}
                returnKeyType="next"
                onSubmitEditing={() => transitionTo('year')}
              />
            </View>
          )}

          {/* ── Step: size ── */}
          {step === 'size' && (
            <View style={styles.sizeStep}>
              <SizeStepper label="Rows" value={rows} min={MIN_SIZE} max={MAX_ROWS}
                onChange={d => handleSizeChange('rows', d)} />
              <SizeStepper label="Columns" value={cols} min={MIN_SIZE} max={MAX_COLS}
                onChange={d => handleSizeChange('cols', d)} />
              <SizeStepper
                label="Tile size"
                value={tileSizeIn}
                min={TILE_SIZE_MIN_IN}
                max={TILE_SIZE_MAX_IN}
                step={TILE_SIZE_STEP_IN}
                displayValue={formatTileSize(tileSizeIn)}
                onChange={d => setTileSizeIn(v => Math.max(TILE_SIZE_MIN_IN, Math.min(TILE_SIZE_MAX_IN, v + d)))}
              />
              <View style={styles.tileSizeNote}>
                <Text style={styles.tileSizeText}>
                  📐 {formatTotalSize(cols, rows, tileSizeIn)} total · {formatTileSize(tileSizeIn)} per tile
                </Text>
              </View>
              <Text style={styles.previewLabel}>Preview</Text>
              <View style={styles.previewGrid}>
                {Array.from({ length: rows }, (_, r) => (
                  <View key={r} style={styles.previewRow}>
                    {Array.from({ length: cols }, (_, c) => (
                      <View key={c} style={styles.previewTile} />
                    ))}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Step: shape ── */}
          {step === 'shape' && (
            <View style={styles.gridStep}>
              <View style={styles.legend}>
                <LegendItem color={TILE_COLORS.inactive} label="Path / unused" />
                <LegendItem color={TILE_COLORS.full_sun} label="Garden tile" />
              </View>
              <TileGrid layout={layout} tileSize={tileSize} onTap={toggleTile} showSun={false} />
              <Text style={styles.tileCount}>
                {activeTiles} of {rows * cols} tiles selected
              </Text>
            </View>
          )}

          {/* ── Step: sun ── */}
          {step === 'sun' && (
            <View style={styles.gridStep}>
              <View style={styles.legend}>
                {SUN_CYCLE.map(s => (
                  <LegendItem key={s} color={TILE_COLORS[s]} label={TILE_LABELS[s]}
                    emoji={TILE_EMOJIS[s]} />
                ))}
              </View>
              <Text style={styles.sunHint}>Tap a tile to cycle through Full Sun → Partial Sun → Shade</Text>
              <TileGrid layout={layout} tileSize={tileSize} onTap={cycleSun} showSun />
            </View>
          )}

          {/* ── Step: location ── */}
          {step === 'location' && (
            <View style={styles.locationStep}>
              {location ? (
                <View style={styles.locationConfirmed}>
                  <View style={styles.locationConfirmedInner}>
                    <Text style={styles.locationPin}>📍</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.locationName}>{location.name}</Text>
                      <Text style={styles.locationCoords}>
                        {location.latitude.toFixed(3)}, {location.longitude.toFixed(3)}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setLocation(null)} style={styles.changeLoc}>
                      <Text style={styles.changeLocText}>Change</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.cityInput}
                    placeholder="Search city (e.g. Austin, London)"
                    placeholderTextColor={G.stone}
                    value={locationQuery}
                    onChangeText={searchLocation}
                    autoCapitalize="words"
                    returnKeyType="search"
                  />
                  {locationSearching && (
                    <ActivityIndicator color={G.sage} style={{ marginVertical: 8 }} />
                  )}
                  {locationResults.length > 0 && (
                    <View style={styles.cityResults}>
                      {locationResults.map((r, i) => (
                        <TouchableOpacity
                          key={i}
                          style={[styles.cityRow, i < locationResults.length - 1 && styles.cityRowBorder]}
                          onPress={() => selectLocation(r)}
                        >
                          <Text style={styles.cityName}>{r.name}</Text>
                          <Text style={styles.cityRegion}>{r.admin1 ? `${r.admin1}, ` : ''}{r.country}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </Animated.View>

        {/* CTA buttons */}
        <View style={styles.ctaRow}>
          {stepIndex > 0 && (
            <PressableScale
              onPress={() => transitionTo(STEPS[stepIndex - 1])}
              style={styles.backStepBtn}
            >
              <Text style={styles.backStepText}>← Back</Text>
            </PressableScale>
          )}

          {step !== 'location' ? (
            <PressableScale
              onPress={() => {
                if (step === 'name' && !name.trim()) setName('My Garden');
                transitionTo(STEPS[stepIndex + 1]);
              }}
              style={styles.nextBtn}
            >
              <LinearGradient
                colors={[G.sage, G.hunter]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.nextBtnGradient}
              >
                <Text style={styles.nextBtnText}>
                  {step === 'shape' && activeTiles === 0 ? 'Skip →' : 'Continue →'}
                </Text>
              </LinearGradient>
            </PressableScale>
          ) : (
            <>
              {!location && (
                <PressableScale onPress={save} style={styles.backStepBtn} disabled={saving}>
                  <Text style={styles.backStepText}>Skip →</Text>
                </PressableScale>
              )}
              <PressableScale
                onPress={save}
                style={[styles.nextBtn, saving && { opacity: 0.7 }]}
                disabled={saving}
              >
                <LinearGradient
                  colors={[G.sage, G.forest]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.nextBtnGradient}
                >
                  {saving
                    ? <ActivityIndicator color={G.cloud} />
                    : <Text style={styles.nextBtnText} numberOfLines={1}>🌱 Create Garden</Text>
                  }
                </LinearGradient>
              </PressableScale>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SizeStepper({ label, value, min, max, step = 1, displayValue, onChange }: {
  label: string; value: number; min: number; max: number;
  step?: number; displayValue?: string; onChange: (delta: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <PressableScale onPress={() => onChange(-step)} style={[styles.stepBtn, value <= min && styles.stepBtnDisabled]} disabled={value <= min}>
          <Text style={styles.stepBtnText}>−</Text>
        </PressableScale>
        <Text style={[styles.stepperValue, displayValue ? { fontSize: 16, minWidth: 52 } : {}]}>
          {displayValue ?? value}
        </Text>
        <PressableScale onPress={() => onChange(step)} style={[styles.stepBtn, value >= max && styles.stepBtnDisabled]} disabled={value >= max}>
          <Text style={styles.stepBtnText}>+</Text>
        </PressableScale>
      </View>
    </View>
  );
}

function TileGrid({ layout, tileSize, onTap, showSun }: {
  layout: GardenLayout; tileSize: number;
  onTap: (r: number, c: number) => void; showSun: boolean;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        {layout.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {row.map((tile, c) => {
              const isActive = tile !== 'inactive';
              return (
                <PressableScale
                  key={c}
                  onPress={() => onTap(r, c)}
                  scaleDown={0.88}
                  style={[
                    styles.tile,
                    { width: tileSize, height: tileSize, backgroundColor: TILE_COLORS[tile] },
                    isActive && styles.tileActive,
                  ]}
                >
                  {showSun && isActive && (
                    <Text style={{ fontSize: tileSize * 0.42, lineHeight: tileSize }}>
                      {TILE_EMOJIS[tile]}
                    </Text>
                  )}
                </PressableScale>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function LegendItem({ color, label, emoji }: { color: string; label: string; emoji?: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]}>
        {emoji && <Text style={{ fontSize: 10 }}>{emoji}</Text>}
      </View>
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: G.foam },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 16, paddingHorizontal: 20,
  },
  backBtn:       { width: 36, height: 36, borderRadius: R.full, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  backText:      { color: G.cloud, fontSize: 16, fontWeight: '600' },
  skipBtn:       { paddingHorizontal: 12, paddingVertical: 6 },
  skipText:      { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },
  headerTitle:   { color: G.cloud, fontSize: 17, fontWeight: '700' },
  stepRow:       { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 40 },
  stepDotWrap:   { flexDirection: 'row', alignItems: 'center' },
  stepDot:       { width: 10, height: 10, borderRadius: R.full, backgroundColor: G.mist },
  stepDotActive: { backgroundColor: G.sage },
  stepLine:      { width: 24, height: 2, backgroundColor: G.mist, marginHorizontal: 4 },
  stepLineActive:{ backgroundColor: G.sage },
  scroll:        { paddingHorizontal: 24, paddingBottom: 48 },
  stepContent:   { alignItems: 'center', paddingTop: 8 },
  stepEmoji:     { fontSize: 48, marginBottom: 12 },
  stepTitle:     { fontSize: 22, fontWeight: '800', color: G.forest, textAlign: 'center', marginBottom: 6 },
  stepSub:       { fontSize: 14, color: G.stone, textAlign: 'center', marginBottom: 28, lineHeight: 20 },

  // Year step
  yearStep:       { width: '100%', maxWidth: 360, alignItems: 'center' },
  yearStepper:    { flexDirection: 'row', alignItems: 'center', backgroundColor: G.cloud, borderRadius: R.xl, padding: 16, width: '100%', ...Shadow.soft, marginBottom: 16 },
  yearBtn:        { width: 48, height: 48, borderRadius: R.full, backgroundColor: G.dew, justifyContent: 'center', alignItems: 'center' },
  yearBtnText:    { fontSize: 26, fontWeight: '300', color: G.hunter, lineHeight: 30 },
  yearValue:      { fontSize: 42, fontWeight: '800', color: G.forest, textAlign: 'center' },
  activeBadge:    { backgroundColor: '#d8f3dc', borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 4, marginTop: 6 },
  activeBadgeText:{ fontSize: 12, fontWeight: '700', color: '#2b8a3e' },
  planningBadge:  { backgroundColor: '#fff3bf', borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 4, marginTop: 6 },
  planningBadgeText:{ fontSize: 12, fontWeight: '700', color: '#e67700' },
  planningNote:   { fontSize: 13, color: G.stone, textAlign: 'center', lineHeight: 19, backgroundColor: '#fff9db', borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: '#ffe066' },

  // Name step
  nameStep:  { width: '100%', maxWidth: 420 },
  nameInput: {
    backgroundColor: G.cloud, borderRadius: R.lg, paddingHorizontal: 18, paddingVertical: 16,
    fontSize: 17, color: G.ink, borderWidth: 2, borderColor: G.mist,
    textAlign: 'center', fontWeight: '600', ...Shadow.soft,
  },

  // Location step
  locationStep: { width: '100%', maxWidth: 440 },
  locationConfirmed: {
    backgroundColor: G.cloud, borderRadius: R.lg, overflow: 'hidden', ...Shadow.soft,
  },
  locationConfirmedInner: {
    flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12,
    borderLeftWidth: 4, borderLeftColor: G.sage,
  },
  locationPin:    { fontSize: 24 },
  locationName:   { fontSize: 15, fontWeight: '700', color: G.forest },
  locationCoords: { fontSize: 11, color: G.stone, marginTop: 2 },
  changeLoc:      { paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.sm, backgroundColor: G.dew },
  changeLocText:  { fontSize: 12, color: G.hunter, fontWeight: '600' },
  gpsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: G.dew, borderRadius: R.lg, paddingVertical: 14, paddingHorizontal: 20,
    gap: 8, marginBottom: 8, borderWidth: 1.5, borderColor: G.mist,
  },
  gpsBtnIcon: { fontSize: 18 },
  gpsBtnText: { color: G.hunter, fontWeight: '700', fontSize: 15 },
  gpsError:   { color: G.danger, fontSize: 13, textAlign: 'center', marginBottom: 10, lineHeight: 18 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 },
  dividerLine:{ flex: 1, height: 1, backgroundColor: G.mist },
  dividerText:{ fontSize: 12, color: G.stone },
  cityInput: {
    backgroundColor: G.cloud, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: G.ink, borderWidth: 1.5, borderColor: G.mist, marginBottom: 8,
  },
  cityResults:   { backgroundColor: G.cloud, borderRadius: R.md, overflow: 'hidden', ...Shadow.soft },
  cityRow:       { padding: 14 },
  cityRowBorder: { borderBottomWidth: 1, borderBottomColor: G.foam },
  cityName:      { fontSize: 15, fontWeight: '600', color: G.forest },
  cityRegion:    { fontSize: 12, color: G.stone, marginTop: 2 },

  // Size step
  sizeStep:      { width: '100%', maxWidth: 380, alignItems: 'center' },
  tileSizeNote:  { backgroundColor: G.dew, borderRadius: R.md, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: G.mist },
  tileSizeText:  { fontSize: 13, color: G.hunter, fontWeight: '600', textAlign: 'center' },
  stepper:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 16, backgroundColor: G.cloud, borderRadius: R.lg, padding: 16, ...Shadow.soft },
  stepperLabel:  { fontSize: 15, fontWeight: '700', color: G.forest },
  stepperControls:{ flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn:       { width: 36, height: 36, borderRadius: R.full, backgroundColor: G.dew, justifyContent: 'center', alignItems: 'center' },
  stepBtnDisabled:{ opacity: 0.35 },
  stepBtnText:   { fontSize: 22, fontWeight: '700', color: G.hunter, lineHeight: 24 },
  stepperValue:  { fontSize: 20, fontWeight: '800', color: G.forest, minWidth: 30, textAlign: 'center' },
  previewLabel:  { fontSize: 12, fontWeight: '700', color: G.stone, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8, marginBottom: 8 },
  previewGrid:   { borderRadius: R.sm, overflow: 'hidden', gap: 2 },
  previewRow:    { flexDirection: 'row', gap: 2 },
  previewTile:   { width: 12, height: 12, backgroundColor: G.mist, borderRadius: 2 },
  previewCount:  { fontSize: 12, color: G.stone, marginTop: 8 },

  // Grid steps
  gridStep:      { width: '100%', alignItems: 'center' },
  legend:        { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 16 },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch:  { width: 20, height: 20, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  legendLabel:   { fontSize: 12, color: G.slate, fontWeight: '500' },
  tile:          { margin: 2, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  tileActive:    { ...Shadow.soft },
  tileCount:     { fontSize: 13, color: G.stone, marginTop: 14, fontWeight: '600' },
  sunHint:       { fontSize: 12, color: G.stone, marginBottom: 12, fontStyle: 'italic', textAlign: 'center' },

  // CTA
  ctaRow:          { flexDirection: 'row', gap: 12, marginTop: 32, justifyContent: 'center' },
  backStepBtn:     { backgroundColor: G.cloud, borderRadius: R.lg, paddingVertical: 14, paddingHorizontal: 20, borderWidth: 1.5, borderColor: G.mist, ...Shadow.soft },
  backStepText:    { color: G.stone, fontWeight: '700', fontSize: 15 },
  nextBtn:         { flex: 1, maxWidth: 280, borderRadius: R.lg, overflow: 'hidden', ...Shadow.card },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnGradient: { paddingVertical: 15, paddingHorizontal: 16, alignItems: 'center' },
  nextBtnText:     { color: G.cloud, fontWeight: '800', fontSize: 16 },
});
