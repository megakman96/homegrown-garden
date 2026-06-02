import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView,
  useWindowDimensions, Alert, ActivityIndicator, Platform,
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
  SUN_CYCLE, activeCount,
  type TileState, type GardenLayout,
} from '@/lib/garden-layout';

type Step = 'name' | 'size' | 'shape' | 'sun';
const STEPS: Step[] = ['name', 'size', 'shape', 'sun'];
const STEP_TITLES: Record<Step, string> = {
  name:  'Name your garden',
  size:  'How big is it?',
  shape: 'Draw your garden',
  sun:   'Set the sunlight',
};
const STEP_SUBS: Record<Step, string> = {
  name:  'Give your garden a name you\'ll remember.',
  size:  'Set the grid dimensions. You can adjust this later.',
  shape: 'Tap tiles to include them in your garden.',
  sun:   'Tap each tile to set its sunlight.',
};
const STEP_EMOJIS: Record<Step, string> = {
  name:  '🌱',
  size:  '📐',
  shape: '🗺️',
  sun:   '☀️',
};

const MIN_SIZE = 3;
const MAX_ROWS = 14;
const MAX_COLS = 14;

export default function NewGardenScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(8);
  const [layout, setLayout] = useState<GardenLayout>(() => makeLayout(6, 8));
  const [saving, setSaving] = useState(false);

  // Animation between steps
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

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      await pb.collection('gardens').create({
        user_id: user.id,
        name: name.trim() || 'My Garden',
        rows,
        cols,
        sun_exposure: 'full_sun',
        layout: JSON.stringify(layout),
      });
      router.replace('/(tabs)/garden');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save garden');
    } finally {
      setSaving(false);
    }
  }

  // Tile size: fill available width
  const gridPadding = 32;
  const maxGridWidth = Math.min(width - gridPadding * 2, 520);
  const tileSize = Math.max(22, Math.min(46, Math.floor((maxGridWidth - cols * 3) / cols)));
  const activeTiles = activeCount(layout);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={[G.forest, G.hunter]} style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.backBtn} haptic={false}>
          <Text style={styles.backText}>✕</Text>
        </PressableScale>
        <Text style={styles.headerTitle}>New Garden</Text>
        <View style={{ width: 36 }} />
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
          {/* Step emoji + title */}
          <Text style={styles.stepEmoji}>{STEP_EMOJIS[step]}</Text>
          <Text style={styles.stepTitle}>{STEP_TITLES[step]}</Text>
          <Text style={styles.stepSub}>{STEP_SUBS[step]}</Text>

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
                onSubmitEditing={() => transitionTo('size')}
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
              {/* Mini preview */}
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
              <Text style={styles.previewCount}>{rows} × {cols} = {rows * cols} tiles</Text>
            </View>
          )}

          {/* ── Step: shape ── */}
          {step === 'shape' && (
            <View style={styles.gridStep}>
              <View style={styles.legend}>
                <LegendItem color={TILE_COLORS.inactive} label="Path / unused" />
                <LegendItem color={TILE_COLORS.full_sun} label="Garden tile" />
              </View>
              <TileGrid
                layout={layout}
                tileSize={tileSize}
                onTap={toggleTile}
                showSun={false}
              />
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
              <Text style={styles.sunHint}>Tap a tile to cycle sunlight</Text>
              <TileGrid
                layout={layout}
                tileSize={tileSize}
                onTap={cycleSun}
                showSun
              />
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

          {step !== 'sun' ? (
            <PressableScale
              onPress={() => {
                if (step === 'name' && !name.trim()) {
                  setName('My Garden');
                }
                transitionTo(STEPS[stepIndex + 1]);
              }}
              style={styles.nextBtn}
            >
              <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.nextBtnGradient}>
                <Text style={styles.nextBtnText}>
                  {step === 'shape' && activeTiles === 0 ? 'Skip →' : 'Continue →'}
                </Text>
              </LinearGradient>
            </PressableScale>
          ) : (
            <PressableScale onPress={save} style={[styles.nextBtn, saving && { opacity: 0.7 }]} disabled={saving}>
              <LinearGradient colors={[G.sage, G.forest]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.nextBtnGradient}>
                {saving
                  ? <ActivityIndicator color={G.cloud} />
                  : <Text style={styles.nextBtnText}>🌱  Create Garden</Text>
                }
              </LinearGradient>
            </PressableScale>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SizeStepper({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number;
  onChange: (delta: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <PressableScale onPress={() => onChange(-1)} style={[styles.stepBtn, value <= min && styles.stepBtnDisabled]} disabled={value <= min}>
          <Text style={styles.stepBtnText}>−</Text>
        </PressableScale>
        <Text style={styles.stepperValue}>{value}</Text>
        <PressableScale onPress={() => onChange(1)} style={[styles.stepBtn, value >= max && styles.stepBtnDisabled]} disabled={value >= max}>
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
              const bg = TILE_COLORS[tile];
              return (
                <PressableScale
                  key={c}
                  onPress={() => onTap(r, c)}
                  scaleDown={0.88}
                  style={[
                    styles.tile,
                    { width: tileSize, height: tileSize, backgroundColor: bg },
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
  backBtn:      { width: 36, height: 36, borderRadius: R.full, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  backText:     { color: G.cloud, fontSize: 16, fontWeight: '600' },
  headerTitle:  { color: G.cloud, fontSize: 17, fontWeight: '700' },
  stepRow:      { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 40 },
  stepDotWrap:  { flexDirection: 'row', alignItems: 'center' },
  stepDot:      { width: 10, height: 10, borderRadius: R.full, backgroundColor: G.mist },
  stepDotActive:{ backgroundColor: G.sage },
  stepLine:     { width: 32, height: 2, backgroundColor: G.mist, marginHorizontal: 4 },
  stepLineActive:{ backgroundColor: G.sage },
  scroll:       { paddingHorizontal: 24, paddingBottom: 48 },
  stepContent:  { alignItems: 'center', paddingTop: 8 },
  stepEmoji:    { fontSize: 48, marginBottom: 12 },
  stepTitle:    { fontSize: 22, fontWeight: '800', color: G.forest, textAlign: 'center', marginBottom: 6 },
  stepSub:      { fontSize: 14, color: G.stone, textAlign: 'center', marginBottom: 28, lineHeight: 20 },

  // Name step
  nameStep:     { width: '100%', maxWidth: 420 },
  nameInput: {
    backgroundColor: G.cloud, borderRadius: R.lg, paddingHorizontal: 18, paddingVertical: 16,
    fontSize: 17, color: G.ink, borderWidth: 2, borderColor: G.mist,
    textAlign: 'center', fontWeight: '600',
    ...Shadow.soft,
  },

  // Size step
  sizeStep:     { width: '100%', maxWidth: 380, alignItems: 'center' },
  stepper:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 16, backgroundColor: G.cloud, borderRadius: R.lg, padding: 16, ...Shadow.soft },
  stepperLabel: { fontSize: 15, fontWeight: '700', color: G.forest },
  stepperControls:{ flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn:      { width: 36, height: 36, borderRadius: R.full, backgroundColor: G.dew, justifyContent: 'center', alignItems: 'center' },
  stepBtnDisabled: { opacity: 0.35 },
  stepBtnText:  { fontSize: 22, fontWeight: '700', color: G.hunter, lineHeight: 24 },
  stepperValue: { fontSize: 20, fontWeight: '800', color: G.forest, minWidth: 30, textAlign: 'center' },
  previewLabel: { fontSize: 12, fontWeight: '700', color: G.stone, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8, marginBottom: 8 },
  previewGrid:  { borderRadius: R.sm, overflow: 'hidden', gap: 2 },
  previewRow:   { flexDirection: 'row', gap: 2 },
  previewTile:  { width: 12, height: 12, backgroundColor: G.mist, borderRadius: 2 },
  previewCount: { fontSize: 12, color: G.stone, marginTop: 8 },

  // Grid steps
  gridStep:     { width: '100%', alignItems: 'center' },
  legend:       { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 16 },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 20, height: 20, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  legendLabel:  { fontSize: 12, color: G.slate, fontWeight: '500' },
  tile: {
    margin: 2, borderRadius: 4,
    justifyContent: 'center', alignItems: 'center',
  },
  tileActive:   { ...Shadow.soft },
  tileCount:    { fontSize: 13, color: G.stone, marginTop: 14, fontWeight: '600' },
  sunHint:      { fontSize: 12, color: G.stone, marginBottom: 12, fontStyle: 'italic' },

  // CTA
  ctaRow:       { flexDirection: 'row', gap: 12, marginTop: 32, justifyContent: 'center' },
  backStepBtn:  { backgroundColor: G.cloud, borderRadius: R.lg, paddingVertical: 14, paddingHorizontal: 20, borderWidth: 1.5, borderColor: G.mist, ...Shadow.soft },
  backStepText: { color: G.stone, fontWeight: '700', fontSize: 15 },
  nextBtn:      { flex: 1, maxWidth: 280, borderRadius: R.lg, overflow: 'hidden', ...Shadow.card },
  nextBtnGradient: { paddingVertical: 15, alignItems: 'center' },
  nextBtnText:  { color: G.cloud, fontWeight: '800', fontSize: 16 },
});
