import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { pb } from '@/lib/pb';
import { offlineList, offlineOne, offlineCreate } from '@/lib/offline-db';
import { useAuth } from '@/hooks/use-auth';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { PressableScale } from '@/components/ui/PressableScale';
import { FadeInView } from '@/components/ui/FadeInView';
import { G, Shadow, R } from '@/constants/theme';
import { layoutFromGarden, TILE_COLORS, TILE_EMOJIS, type GardenLayout } from '@/lib/garden-layout';
import { useAppTheme } from '@/contexts/theme-context';
import type { Plant, Garden, HealthStatus } from '@/lib/types';
import type { SunRequirement } from '@/lib/plant-catalog';
import { Platform } from 'react-native';
import { PLANT_CATALOG, SUN_EMOJIS, SUN_LABELS, searchPlants, getSunCompatibility } from '@/lib/plant-catalog';
import { subscribe } from '@/lib/events';
import type { CatalogEntry } from '@/lib/plant-catalog';
import PlantAvatar from '@/components/PlantAvatar';
import { getPlantIcon } from '@/lib/plant-icons';

const HEALTH_LABELS: Record<HealthStatus, string> = {
  healthy: '🟢 Healthy',
  needs_water: '💧 Needs water',
  sick: '🟠 Sick',
  harvested: '🧺 Harvested',
  dead: '⚫ Dead',
};

export default function PlantsScreen() {
  const { user } = useAuth();
  const { isDesktop } = useBreakpoint();
  const { isDark, colors } = useAppTheme();
  const bg      = isDark ? colors.bg        : G.foam;
  const cardBg  = isDark ? colors.bgCard    : G.cloud;
  const textPrim= isDark ? colors.text      : G.forest;
  const textSec = isDark ? colors.textSec   : G.stone;
  const border  = isDark ? colors.border    : G.mist;
  const inputBg = isDark ? colors.bgElement : G.foam;
  const router = useRouter();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', variety: '', gardenId: '', sunRequirement: 'full_sun' as SunRequirement, waterIntervalDays: 3 });

  const loadData = useCallback(async () => {
    if (!user) return;
    const [plantsData, gardensData] = await Promise.all([
      offlineList('plants', user.id, `user_id = "${user.id}"`),
      offlineList('gardens', user.id, `user_id = "${user.id}"`),
    ]);
    setPlants(plantsData as any);
    setGardens(gardensData as any ?? []);
    if (gardensData?.length) setForm((f) => ({ ...f, gardenId: f.gardenId || gardensData[0].id }));
  }, [user]);

  // Refresh on focus (catches plants added from garden view on mobile)
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Sync plants added from garden tab (works on native where WebSocket realtime may be unavailable)
  useEffect(() => subscribe('plants:changed', () => loadData()), [loadData]);

  // Realtime subscription — web only (native lacks EventSource/SSE; useFocusEffect handles refresh)
  useEffect(() => {
    if (!user || Platform.OS !== 'web') return;
    let cancel: (() => void) | null = null;
    pb.collection('plants').subscribe('*', (e) => {
      if ((e.record as any).user_id !== user.id) return;
      if (e.action === 'create') {
        setPlants(prev => prev.find(p => p.id === e.record.id) ? prev : [e.record as any, ...prev]);
      } else if (e.action === 'update') {
        setPlants(prev => prev.map(p => p.id === e.record.id ? (e.record as any) : p));
      } else if (e.action === 'delete') {
        setPlants(prev => prev.filter(p => p.id !== e.record.id));
      }
    }).then(fn => { cancel = fn; }).catch(() => {});
    return () => { cancel?.(); };
  }, [user]);

  const [catalogueSelected, setCatalogueSelected] = useState(false);
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [step, setStep] = useState<'search' | 'details' | 'tile'>('search');
  const [tileRow, setTileRow] = useState<number | null>(null);
  const [tileCol, setTileCol] = useState<number | null>(null);
  const [gardenPlants, setGardenPlants] = useState<Plant[]>([]);
  const [gardenLayout, setGardenLayout] = useState<GardenLayout | null>(null);

  function selectFromCatalogue(key: string, entry: CatalogEntry) {
    setCatalogueSelected(true);
    setCatalogueSearch('');
    setForm((f) => ({
      ...f,
      name: entry.name,
      sunRequirement: entry.sunRequirement,
      waterIntervalDays: entry.waterIntervalDays,
    }));
  }

  function getCatalogueItems(): Array<{ key: string; entry: CatalogEntry }> {
    if (catalogueSearch.trim()) return searchPlants(catalogueSearch, 60);
    return Object.entries(PLANT_CATALOG)
      .map(([key, entry]) => ({ key, entry }))
      .sort((a, b) => a.entry.name.localeCompare(b.entry.name));
  }

  async function loadGardenPlants(gardenId: string) {
    try {
      const [ps, garden] = await Promise.all([
        offlineList('plants', user?.id ?? '', `garden_id = "${gardenId}"`),
        offlineOne('gardens', gardenId),
      ]);
      setGardenPlants(ps as any);
      setGardenLayout(garden ? layoutFromGarden(garden) : null);
    } catch {
      setGardenPlants([]);
      setGardenLayout(null);
    }
  }

  async function addPlant() {
    if (!user || !form.name.trim()) return;
    setAdding(true);
    try {
      let gardenId = form.gardenId || gardens[0]?.id;
      if (!gardenId) {
        const { record: newGarden } = await offlineCreate('gardens', user.id, {
          user_id: user.id, name: 'My Garden', sun_exposure: 'full_sun', rows: 6, cols: 8,
        });
        gardenId = newGarden.id;
        setGardens((g) => [...g, newGarden as any]);
        setForm((f) => ({ ...f, gardenId: newGarden.id }));
      }
      const { record: data } = await offlineCreate('plants', user.id, {
        user_id: user.id,
        garden_id: gardenId,
        name: form.name.trim(),
        variety: form.variety.trim() || null,
        health_status: 'healthy',
        sun_requirement: form.sunRequirement,
        water_interval_days: form.waterIntervalDays,
        total_yield_grams: 0,
        row: tileRow,
        col: tileCol,
      });
      setPlants((p) => [data as any, ...p]);
      closeAdd();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not add plant');
    } finally {
      setAdding(false);
    }
  }

  function closeAdd() {
    setShowAdd(false);
    setCatalogueSelected(false);
    setCatalogueSearch('');
    setStep('search');
    setTileRow(null);
    setTileCol(null);
    setGardenPlants([]);
    setGardenLayout(null);
    setForm((f) => ({ ...f, name: '', variety: '', sunRequirement: 'full_sun', waterIntervalDays: 3 }));
  }

  const selectedGarden = gardens.find(g => g.id === form.gardenId);
  const gridRows = selectedGarden?.rows ?? 6;
  const gridCols = selectedGarden?.cols ?? 8;
  const occupiedCells = new Set(
    gardenPlants.filter(p => p.row != null && p.col != null).map(p => `${p.row},${p.col}`)
  );

  const addModal = (
    <Modal visible={showAdd} transparent animationType="slide">
      <KeyboardAvoidingView
        style={[styles.modalBackdrop, isDesktop && styles.modalBackdropCenter]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <View style={[styles.modal, { backgroundColor: cardBg }, isDesktop && styles.modalCenter]}>

          {/* Step indicator */}
          <View style={styles.stepBar}>
            {['Plant', 'Details', 'Place'].map((label, i) => {
              const stepNames = ['search', 'details', 'tile'] as const;
              const active = step === stepNames[i];
              const done = (step === 'details' && i === 0) || (step === 'tile' && i <= 1);
              return (
                <View key={label} style={styles.stepBarItem}>
                  <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
                    <Text style={[styles.stepDotText, (active || done) && styles.stepDotTextActive]}>
                      {done ? '✓' : i + 1}
                    </Text>
                  </View>
                  <Text style={[styles.stepLabel, { color: active ? textPrim : textSec }]}>{label}</Text>
                </View>
              );
            })}
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.modalTitle, { color: textPrim }]}>
              {step === 'search' ? '🌱 Add Plant' : step === 'details' ? '📋 Details' : '📍 Choose a Tile'}
            </Text>

            {/* ── Step 1: Catalog search ─────────────────────────────── */}
            {step === 'search' && (
              <>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
                  placeholder="Search plants..."
                  placeholderTextColor={textSec}
                  value={catalogueSearch}
                  onChangeText={setCatalogueSearch}
                />
                <Text style={[styles.fieldLabel, { color: textSec, marginBottom: 6 }]}>Choose from catalogue</Text>
                {getCatalogueItems().map(({ key, entry }) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.catItem, { borderBottomColor: border }]}
                    onPress={() => { selectFromCatalogue(key, entry); setStep('details'); }}
                  >
                    <Text style={styles.catItemEmoji}>{getPlantIcon(entry.name).emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.catItemName, { color: textPrim }]}>{entry.name}</Text>
                      <Text style={[styles.catItemMeta, { color: textSec }]}>
                        {SUN_EMOJIS[entry.sunRequirement]} · 💧 every {entry.waterIntervalDays}d · {entry.category}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* ── Step 2: Details ───────────────────────────────────── */}
            {step === 'details' && (
              <>
                <View style={[styles.selectedRow, { borderBottomColor: border }]}>
                  <Text style={{ fontSize: 26 }}>{getPlantIcon(form.name).emoji}</Text>
                  <Text style={[styles.catItemName, { color: textPrim, flex: 1, fontSize: 18 }]}>{form.name}</Text>
                  <TouchableOpacity onPress={() => { setCatalogueSelected(false); setForm(f => ({ ...f, name: '' })); setStep('search'); }}>
                    <Text style={{ color: textSec, fontSize: 13, fontWeight: '600' }}>✕ Change</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim, marginTop: 12 }]}
                  placeholder="Variety (optional)"
                  placeholderTextColor={textSec}
                  value={form.variety}
                  onChangeText={(v) => setForm((f) => ({ ...f, variety: v }))}
                />
                <View style={styles.waterRow}>
                  <Text style={[styles.fieldLabel, { color: textSec }]}>Water every</Text>
                  <View style={styles.waterStepper}>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => setForm((f) => ({ ...f, waterIntervalDays: Math.max(1, f.waterIntervalDays - 1) }))}>
                      <Text style={styles.stepBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={[styles.stepValue, { color: textPrim }]}>{form.waterIntervalDays} days</Text>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => setForm((f) => ({ ...f, waterIntervalDays: Math.min(30, f.waterIntervalDays + 1) }))}>
                      <Text style={styles.stepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {gardens.length > 1 && (
                  <>
                    <Text style={[styles.fieldLabel, { color: textSec }]}>Garden</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gardenPicker}>
                      {gardens.map((g) => (
                        <TouchableOpacity
                          key={g.id}
                          style={[styles.gardenChip, form.gardenId === g.id && styles.gardenChipActive]}
                          onPress={() => setForm((f) => ({ ...f, gardenId: g.id }))}
                        >
                          <Text style={[styles.gardenChipText, form.gardenId === g.id && styles.gardenChipTextActive]}>
                            {g.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}
              </>
            )}

            {/* ── Step 3: Tile picker ───────────────────────────────── */}
            {step === 'tile' && (
              <>
                {selectedGarden && (
                  <Text style={[styles.tileHint, { color: textSec }]}>
                    {selectedGarden.name} · {gridCols}×{gridRows} — tap an empty cell
                  </Text>
                )}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tileScrollContent}
                >
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.tileGrid}
                  >
                    {Array.from({ length: gridRows }).map((_, r) => (
                      <View key={r} style={styles.tileRow}>
                        {Array.from({ length: gridCols }).map((_, c) => {
                          const key = `${r},${c}`;
                          const tileState = gardenLayout?.[r]?.[c] ?? 'full_sun';
                          const isPath = tileState === 'inactive';
                          const occupied = occupiedCells.has(key);
                          const selected = tileRow === r && tileCol === c;
                          const oPlant = gardenPlants.find(p => p.row === r && p.col === c);
                          const disabled = isPath || occupied;

                          let bg = TILE_COLORS[tileState];
                          if (occupied) bg = '#c8e6c9';
                          if (selected) bg = G.hunter;

                          return (
                            <TouchableOpacity
                              key={key}
                              activeOpacity={disabled ? 1 : 0.65}
                              disabled={disabled}
                              onPress={() => { setTileRow(r); setTileCol(c); }}
                              style={[styles.tileCell, { backgroundColor: bg }, isPath && styles.tileCellPath]}
                            >
                              {selected
                                ? <Text style={styles.tileCellCheck}>✓</Text>
                                : occupied && oPlant
                                  ? <Text style={styles.tileCellEmoji}>{getPlantIcon(oPlant.name).emoji}</Text>
                                  : !isPath
                                    ? <Text style={styles.tileSunEmoji}>{TILE_EMOJIS[tileState]}</Text>
                                    : null
                              }
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ))}
                  </ScrollView>
                </ScrollView>
                {/* Legend */}
                <View style={styles.tileLegend}>
                  {[
                    { color: TILE_COLORS.full_sun,    emoji: TILE_EMOJIS.full_sun,    label: 'Full Sun' },
                    { color: TILE_COLORS.partial_sun, emoji: TILE_EMOJIS.partial_sun, label: 'Partial' },
                    { color: TILE_COLORS.shade,       emoji: TILE_EMOJIS.shade,       label: 'Shade' },
                    { color: TILE_COLORS.inactive,    emoji: '',                      label: 'Path' },
                  ].map(({ color, emoji, label }) => (
                    <View key={label} style={styles.tileLegendItem}>
                      <View style={[styles.tileLegendDot, { backgroundColor: color }]}>
                        {emoji ? <Text style={{ fontSize: 9 }}>{emoji}</Text> : null}
                      </View>
                      <Text style={[styles.tileLegendLabel, { color: textSec }]}>{label}</Text>
                    </View>
                  ))}
                </View>

                {/* Sun compatibility warning */}
                {tileRow != null && tileCol != null && (() => {
                  const tileState = gardenLayout?.[tileRow]?.[tileCol];
                  if (!tileState || tileState === 'inactive') return null;
                  const compat = getSunCompatibility(form.sunRequirement, tileState as any);
                  if (compat === 'match') return (
                    <View style={[styles.tileWarning, { backgroundColor: '#d8f3dc', borderColor: '#74c69d' }]}>
                      <Text style={[styles.tileWarningText, { color: '#1b4332' }]}>
                        ✅ Great match — {SUN_LABELS[tileState]} suits {form.name}
                      </Text>
                    </View>
                  );
                  if (compat === 'tolerable') return (
                    <View style={[styles.tileWarning, { backgroundColor: '#fff3bf', borderColor: '#fcc419' }]}>
                      <Text style={[styles.tileWarningText, { color: '#5c3d00' }]}>
                        ⚠️ Not ideal — {form.name} prefers {SUN_LABELS[form.sunRequirement]}, this tile is {SUN_LABELS[tileState]}. It'll grow but may underperform.
                      </Text>
                    </View>
                  );
                  return (
                    <View style={[styles.tileWarning, { backgroundColor: '#ffe3e3', borderColor: '#ff8787' }]}>
                      <Text style={[styles.tileWarningText, { color: '#7a0000' }]}>
                        ❌ Sun mismatch — {form.name} needs {SUN_LABELS[form.sunRequirement]} but this tile gets {SUN_LABELS[tileState]}. Consider a different tile.
                      </Text>
                    </View>
                  );
                })()}

                {tileRow != null && tileCol != null && (
                  <Text style={[styles.tileSelected, { color: textPrim }]}>
                    {getPlantIcon(form.name).emoji} {form.name} → row {tileRow + 1}, col {tileCol + 1}
                  </Text>
                )}
              </>
            )}
          </ScrollView>

          {/* ── Bottom buttons ──────────────────────────────────────── */}
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => step === 'tile' ? setStep('details') : step === 'details' ? setStep('search') : closeAdd()}
              disabled={adding}
            >
              <Text style={styles.cancelText}>{step === 'search' ? 'Cancel' : '← Back'}</Text>
            </TouchableOpacity>

            {step === 'search' ? null : step === 'details' ? (
              <PressableScale
                style={styles.addBtn}
                onPress={() => {
                  setTileRow(null); setTileCol(null);
                  loadGardenPlants(form.gardenId || gardens[0]?.id);
                  setStep('tile');
                }}
              >
                <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addBtnGradient}>
                  <Text style={styles.addBtnText}>Next →</Text>
                </LinearGradient>
              </PressableScale>
            ) : (
              <PressableScale
                style={[styles.addBtn, (adding || (tileRow == null)) && { opacity: 0.4 }]}
                onPress={addPlant}
                disabled={adding || tileRow == null}
              >
                <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addBtnGradient}>
                  {adding
                    ? <ActivityIndicator color={G.cloud} size="small" />
                    : <Text style={styles.addBtnText}>Plant Here</Text>
                  }
                </LinearGradient>
              </PressableScale>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // Group plants by name to avoid duplicate cards
  const plantsByName = plants.reduce<Record<string, Plant[]>>((acc, p) => {
    const key = p.name.toLowerCase().trim();
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});
  const uniquePlants = Object.values(plantsByName).map(group => group[0]);

  const plantCards = uniquePlants.map((plant, i) => {
    const count = plantsByName[plant.name.toLowerCase().trim()].length;
    return (
      <FadeInView key={plant.id} delay={i * 40} from="bottom" style={isDesktop ? styles.desktopCardWrap : undefined}>
        <PressableScale
          style={[isDesktop ? styles.desktopCard : styles.card, { backgroundColor: cardBg }]}
          onPress={() => router.push(`/plant/${plant.id}`)}
        >
          <View style={[styles.cardAccent, { backgroundColor: HEALTH_COLORS[plant.health_status] }]} />
          <View style={isDesktop ? styles.desktopCardInner : styles.cardRow}>
            <PlantAvatar name={plant.name} size={isDesktop ? 44 : 52} />
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Text style={[styles.plantName, { color: textPrim }]} numberOfLines={1}>{plant.name}</Text>
                <View style={styles.cardBadges}>
                  {count > 1 && (
                    <View style={[styles.countBadge, { backgroundColor: textSec }]}>
                      <Text style={styles.countBadgeText}>×{count}</Text>
                    </View>
                  )}
                  {plant.sun_requirement && (
                    <Text style={styles.sunBadge}>{SUN_EMOJIS[plant.sun_requirement as SunRequirement]}</Text>
                  )}
                </View>
              </View>
              {plant.variety && <Text style={styles.variety} numberOfLines={1}>{plant.variety}</Text>}
              <View style={styles.cardMeta}>
                <Text style={styles.healthLabel}>{HEALTH_LABELS[plant.health_status]}</Text>
                {plant.expected_harvest_date && (
                  <Text style={styles.metaText}>
                    🧺 {new Date(plant.expected_harvest_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                )}
                {plant.total_yield_grams > 0 && (
                  <Text style={styles.metaText}>⚖️ {plant.total_yield_grams}g</Text>
                )}
              </View>
            </View>
          </View>
        </PressableScale>
      </FadeInView>
    );
  });

  if (isDesktop) {
    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
        <View style={[styles.desktopTopBar, { backgroundColor: bg, borderBottomColor: border }]}>
          <View>
            <Text style={[styles.desktopPageTitle, { color: textPrim }]}>🌿 Plants</Text>
            <Text style={[styles.desktopPageSub, { color: textSec }]}>{plants.length} plant{plants.length !== 1 ? 's' : ''} in your collection</Text>
          </View>
          <PressableScale onPress={() => setShowAdd(true)} style={styles.desktopAddBtn}>
            <LinearGradient
              colors={[G.sage, G.hunter]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.desktopAddBtnGradient}
            >
              <Text style={styles.desktopAddBtnText}>+ Add Plant</Text>
            </LinearGradient>
          </PressableScale>
        </View>
        <ScrollView contentContainerStyle={styles.desktopGrid} showsVerticalScrollIndicator={false}>
          {plants.length === 0 ? (
            <FadeInView style={styles.empty} from="scale">
              <Text style={styles.emptyEmoji}>🌱</Text>
              <Text style={styles.emptyTitle}>No plants yet</Text>
              <Text style={styles.emptyText}>Click "Add Plant" to start your garden journal.</Text>
            </FadeInView>
          ) : plantCards}
        </ScrollView>
        {addModal}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <PressableScale onPress={() => setShowAdd(true)} style={styles.addButton}>
        <LinearGradient
          colors={[G.sage, G.hunter]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.addButtonGradient}
        >
          <Text style={styles.addButtonText}>🌱  Add Plant</Text>
        </LinearGradient>
      </PressableScale>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {plants.length === 0 ? (
          <FadeInView style={styles.empty} from="scale">
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>No plants yet</Text>
            <Text style={styles.emptyText}>Tap "Add Plant" to start your garden journal.</Text>
          </FadeInView>
        ) : plantCards}
      </ScrollView>
      {addModal}
    </View>
  );
}

const HEALTH_COLORS: Record<HealthStatus, string> = {
  healthy:    G.sage,
  needs_water: G.bloom,
  sick:       G.warning,
  harvested:  G.sun,
  dead:       G.stone,
};

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: G.foam },

  // Desktop
  desktopTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: G.mist,
    backgroundColor: G.foam,
  },
  desktopPageTitle: { fontSize: 28, fontWeight: '800', color: G.forest, letterSpacing: -0.5 },
  desktopPageSub: { fontSize: 13, color: G.stone, marginTop: 3 },
  desktopAddBtn: { borderRadius: R.md, overflow: 'hidden', ...Shadow.card },
  desktopAddBtnGradient: { paddingVertical: 11, paddingHorizontal: 22 },
  desktopAddBtnText: { color: G.cloud, fontWeight: '700', fontSize: 14 },
  desktopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    padding: 28,
    paddingBottom: 48,
  },
  desktopCardWrap: { width: '31.5%' },
  desktopCard: {
    backgroundColor: G.cloud,
    borderRadius: R.lg,
    overflow: 'hidden',
    ...Shadow.soft,
    flex: 1,
  },
  desktopCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },

  // Mobile
  addButton:       { margin: 16, borderRadius: R.lg, overflow: 'hidden', ...Shadow.card },
  addButtonGradient: { paddingVertical: 14, alignItems: 'center' },
  addButtonText:   { color: G.cloud, fontWeight: '700', fontSize: 16 },
  list:            { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    backgroundColor: G.cloud,
    borderRadius: R.lg,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    ...Shadow.soft,
  },
  cardAccent:      { width: 5 },
  cardRow:         { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14 },
  cardContent:     { flex: 1, marginLeft: 12 },
  cardHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBadges:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sunBadge:        { fontSize: 16 },
  plantName:       { fontSize: 17, fontWeight: '700', color: G.ink, flex: 1 },
  healthLabel:     { fontSize: 12, color: G.stone },
  variety:         { fontSize: 13, color: G.stone, marginTop: 2 },
  cardMeta:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  metaText:        { fontSize: 12, color: G.fern, fontWeight: '500' },
  fieldLabel:      { fontSize: 11, color: G.stone, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  sunRow:          { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  sunChip:         { borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: G.foam, borderWidth: 1.5, borderColor: G.mist },
  sunChipActive:   { backgroundColor: G.hunter, borderColor: G.hunter },
  sunChipText:     { color: G.hunter, fontSize: 12, fontWeight: '600' },
  sunChipTextActive: { color: G.cloud },
  catItem:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2, borderBottomWidth: 1, gap: 10 },
  catItemEmoji:    { fontSize: 24, width: 34, textAlign: 'center' },
  catItemName:     { fontSize: 15, fontWeight: '600', color: G.forest },
  catItemMeta:     { fontSize: 12, color: G.stone, marginTop: 1 },
  selectedRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, marginBottom: 4, borderBottomWidth: 1, gap: 8 },
  waterRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  waterStepper:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn:         { width: 34, height: 34, borderRadius: R.full, backgroundColor: G.dew, justifyContent: 'center', alignItems: 'center' },
  stepBtnText:     { fontSize: 20, fontWeight: '700', color: G.hunter, lineHeight: 22 },
  stepValue:       { fontSize: 15, fontWeight: '700', color: G.forest, minWidth: 62, textAlign: 'center' },
  empty:           { paddingTop: 64, alignItems: 'center', paddingHorizontal: 32 },
  emptyEmoji:      { fontSize: 56, marginBottom: 12 },
  emptyTitle:      { fontSize: 20, fontWeight: '800', color: G.forest, marginBottom: 8 },
  emptyText:       { fontSize: 14, color: G.stone, textAlign: 'center' },
  modalBackdrop:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBackdropCenter: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 32 },
  modal:               { backgroundColor: G.cloud, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, maxHeight: '88%', ...Shadow.float },
  modalCenter:         { width: '100%', maxWidth: 560, borderRadius: R.xl, },
  modalScroll:     { flexShrink: 1 },
  modalContent:    { padding: 24, paddingBottom: 8 },
  modalTitle:      { fontSize: 20, fontWeight: '800', color: G.forest, marginBottom: 18 },
  input: {
    backgroundColor: G.foam,
    borderRadius: R.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: G.ink,
    borderWidth: 1.5,
    borderColor: G.mist,
    marginBottom: 14,
  },
  gardenPicker:       { flexGrow: 0, marginBottom: 16 },
  gardenChip:         { borderRadius: R.full, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, backgroundColor: G.foam, borderWidth: 1.5, borderColor: G.mist },
  gardenChipActive:   { backgroundColor: G.hunter, borderColor: G.hunter },
  gardenChipText:     { color: G.hunter, fontWeight: '600' },
  gardenChipTextActive: { color: G.cloud },

  // Step indicator
  stepBar:            { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 32, paddingVertical: 14, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: G.dew },
  stepBarItem:        { alignItems: 'center', gap: 4 },
  stepDot:            { width: 26, height: 26, borderRadius: 13, backgroundColor: G.foam, borderWidth: 2, borderColor: G.mist, justifyContent: 'center', alignItems: 'center' },
  stepDotActive:      { borderColor: G.hunter, backgroundColor: G.hunter },
  stepDotDone:        { borderColor: G.sage, backgroundColor: G.sage },
  stepDotText:        { fontSize: 12, fontWeight: '700', color: G.stone },
  stepDotTextActive:  { color: '#fff' },
  stepLabel:          { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Tile picker
  tileHint:           { fontSize: 13, marginBottom: 12, color: G.stone },
  tileScrollContent:  { flexGrow: 1, justifyContent: 'center', alignItems: 'center', minWidth: '100%' },
  tileGrid:           { gap: 3, paddingBottom: 4, alignItems: 'center' },
  tileRow:            { flexDirection: 'row', gap: 3 },
  tileCell:           { width: 36, height: 36, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', justifyContent: 'center', alignItems: 'center' },
  tileCellPath:       { opacity: 0.45 },
  tileCellEmoji:      { fontSize: 17 },
  tileCellCheck:      { fontSize: 17, color: '#fff', fontWeight: '700' },
  tileSunEmoji:       { fontSize: 13, opacity: 0.8 },
  tileSelected:       { marginTop: 8, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  tileWarning:        { borderRadius: R.md, borderWidth: 1.5, padding: 10, marginTop: 10 },
  tileWarningText:    { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  tileLegend:         { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' },
  tileLegendItem:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tileLegendDot:      { width: 18, height: 18, borderRadius: 4, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  tileLegendLabel:    { fontSize: 11, fontWeight: '500' },
  modalButtons:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: G.dew },
  cancelBtn:       { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#fff5f5', borderWidth: 1.5, borderColor: '#ffc9c9' },
  cancelText:      { color: '#e03131', fontSize: 15, fontWeight: '700' },
  countBadge:      { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4 },
  countBadgeText:  { color: '#fff', fontSize: 11, fontWeight: '700' },
  addBtn:          { borderRadius: R.lg, overflow: 'hidden', ...Shadow.soft },
  addBtnGradient:  { paddingVertical: 12, paddingHorizontal: 28 },
  addBtnText:      { color: G.cloud, fontWeight: '700', fontSize: 15 },
});
