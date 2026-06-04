import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { pb } from '@/lib/pb';
import { useAuth } from '@/hooks/use-auth';
import { PressableScale } from '@/components/ui/PressableScale';
import { FadeInView } from '@/components/ui/FadeInView';
import { G, Shadow, R } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import { getPlantIcon } from '@/lib/plant-icons';
import {
  layoutFromGarden, makeLayout, resizeLayout,
  TILE_COLORS, TILE_LABELS, TILE_EMOJIS, SUN_CYCLE, activeCount,
} from '@/lib/garden-layout';
import { emit } from '@/lib/events';
import type { TileState, GardenLayout } from '@/lib/garden-layout';
import type { Garden, Plant } from '@/lib/types';
import type { SunRequirement } from '@/lib/plant-catalog';
import {
  findPlantKey, getCompatibility, getSunCompatibility,
  PLANT_CATALOG, SUN_LABELS, SUN_EMOJIS, searchPlants,
} from '@/lib/plant-catalog';
import type { CatalogEntry } from '@/lib/plant-catalog';
import { getActivityLogAsync, type ActivityEntry } from '@/lib/activity-log';
import {
  fetchWeather, searchCity, saveGardenLocation, saveLocation, loadGardenLocation,
  type Location, type GeoResult,
} from '@/lib/weather';

const HEALTH_COLORS: Record<string, string> = {
  healthy:     '#52b788',  // green
  needs_water: '#339af0',  // vivid blue (distinct from muted sky-blue shade tiles)
  sick:        '#f03e3e',  // red (distinct from orange partial-sun tiles)
  harvested:   '#a9e34b',  // lime
  dead:        '#adb5bd',  // stone
};

const COMPAT_COLOR = { good: '#52b788', bad: '#ff6b6b', neutral: '#adb5bd', unknown: '#dee2e6' } as const;
const COMPAT_EMOJI = { good: '✅', bad: '❌', neutral: '➖', unknown: '❓' } as const;
const SUN_OPTIONS: SunRequirement[] = ['full_sun', 'partial_sun', 'shade'];

type PlacementInfo = {
  row: number;
  col: number;
  neighbors: Plant[];
  tileSun: TileState;
};

type SharedEntry = { garden: Garden; ownerEmail: string };

export default function GardenScreen() {
  const { user } = useAuth();
  const { isDark, colors } = useAppTheme();
  const bg         = isDark ? colors.bg        : G.foam;
  const cardBg     = isDark ? colors.bgCard    : '#fff';
  const textPrim   = isDark ? colors.text      : '#2d6a4f';
  const textSec    = isDark ? colors.textSec   : '#52796f';
  const border     = isDark ? colors.border    : '#b7e4c7';
  const inputBg    = isDark ? colors.bgElement : '#f0f7ee';
  const router = useRouter();
  const [gardens, setGardens] = useState<Garden[]>([]);        // owned
  const [sharedEntries, setSharedEntries] = useState<SharedEntry[]>([]); // shared with me
  const [selectedGarden, setSelectedGarden] = useState<Garden | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);

  // New garden modal
  const [showNewGarden, setShowNewGarden] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSun, setNewSun] = useState<SunRequirement>('full_sun');

  // Place plant modal
  const [placement, setPlacement] = useState<PlacementInfo | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [placeSun, setPlaceSun] = useState<SunRequirement>('full_sun');
  const [placeWaterDays, setPlaceWaterDays] = useState(3);
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [placeSelected, setPlaceSelected] = useState(false);

  const gardenLayout = selectedGarden ? layoutFromGarden(selectedGarden) : null;

  // Plant action sheet (tap on planted tile)
  const [plantAction, setPlantAction] = useState<Plant | null>(null);

  // Plan modal
  const [showPlan, setShowPlan] = useState(false);
  const [planYear, setPlanYear] = useState(new Date().getFullYear());

  const [planLastFrost, setPlanLastFrost] = useState('04/15');
  const [planFirstFrost, setPlanFirstFrost] = useState('10/15');
  const [planSelectedKeys, setPlanSelectedKeys] = useState<string[]>([]);
  const [planSearch, setPlanSearch] = useState('');

  // History modal
  const [showHistory, setShowHistory] = useState(false);
  const [historyLog, setHistoryLog] = useState<ActivityEntry[]>([]);

  // Edit garden modal
  const [showEditGarden, setShowEditGarden] = useState(false);
  const [editStep, setEditStep] = useState<'size' | 'shape' | 'sun' | 'location'>('size');
  const [editRows, setEditRows] = useState(6);
  const [editCols, setEditCols] = useState(8);
  const [editLayout, setEditLayout] = useState<GardenLayout>(() => makeLayout(6, 8));
  const [editSaving, setEditSaving] = useState(false);
  const [editLocationQuery, setEditLocationQuery] = useState('');
  const [editLocationResults, setEditLocationResults] = useState<GeoResult[]>([]);
  const [editLocationSearching, setEditLocationSearching] = useState(false);
  const [editSelectedLocation, setEditSelectedLocation] = useState<Location | null>(null);

  useEffect(() => {
    if (!user) return;

    // Own gardens
    pb.collection('gardens')
      .getFullList({ filter: `user_id = "${user.id}"` })
      .then((list) => {
        setGardens(list as any);
        if (list.length > 0) setSelectedGarden(list[0] as any);
      })
      .catch(() => {});

    // Gardens shared with me via my email
    pb.collection('garden_shares')
      .getFullList({ filter: `shared_with_email = "${user.email}"` })
      .then(async (shares) => {
        const entries: SharedEntry[] = [];
        for (const share of shares as any[]) {
          const garden = await pb.collection('gardens').getOne(share.garden_id).catch(() => null);
          if (!garden) continue;
          let ownerEmail = 'Shared';
          try {
            const owner = await pb.collection('users').getOne(share.owner_id);
            ownerEmail = (owner as any).email ?? 'Shared';
          } catch {}
          entries.push({ garden: garden as any, ownerEmail });
        }
        setSharedEntries(entries);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!selectedGarden) return;
    pb.collection('plants').getFullList({ filter: `garden_id = "${selectedGarden.id}"` })
      .then((data) => setPlants(data as any));
  }, [selectedGarden]);

  async function createGarden() {
    if (!user || !newName.trim()) return;
    const data = await pb.collection('gardens').create({
      user_id: user.id, name: newName.trim(), rows: 6, cols: 8, sun_exposure: newSun,
    });
    setGardens((g) => [...g, data as any]);
    setSelectedGarden(data as any);
    setShowNewGarden(false);
    setNewName('');
    setNewSun('full_sun');
  }

  function getPlantAt(row: number, col: number) {
    return plants.find((p) => p.row === row && p.col === col);
  }

  function getNeighbors(row: number, col: number): Plant[] {
    const offsets = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
    return offsets
      .map(([dr, dc]) => getPlantAt(row + dr, col + dc))
      .filter((p): p is Plant => p !== undefined);
  }

  function handleCellTap(row: number, col: number) {
    const existing = getPlantAt(row, col);
    if (existing) {
      setPlantAction(existing);
      return;
    }
    const neighbors = getNeighbors(row, col);
    const tileSun = (gardenLayout?.[row]?.[col] ?? 'full_sun') as TileState;
    setPlacement({ row, col, neighbors, tileSun });
    setPlaceName('');
    setPlaceSelected(false);
    setCatalogueSearch('');
    setPlaceSun(tileSun === 'inactive' ? 'full_sun' : tileSun as SunRequirement);
    setPlaceWaterDays(3);
  }

  function selectCatalogueItem(entry: CatalogEntry) {
    setPlaceName(entry.name);
    setPlaceSun(entry.sunRequirement);
    setPlaceWaterDays(entry.waterIntervalDays);
    setPlaceSelected(true);
    setCatalogueSearch('');
  }

  function getNeighborSuggestions(): Array<{ key: string; entry: CatalogEntry }> {
    if (!placement?.neighbors.length) return [];
    const neighborKeys = placement.neighbors
      .map(n => findPlantKey(n.name))
      .filter((k): k is string => k !== null);
    if (!neighborKeys.length) return [];
    return Object.entries(PLANT_CATALOG)
      .map(([key, entry]) => ({ key, entry }))
      .filter(({ key, entry }) => {
        if (neighborKeys.includes(key)) return false;
        const hasBad = neighborKeys.some(nk => {
          const n = PLANT_CATALOG[nk];
          return n?.badCompanions.includes(key) || entry.badCompanions.includes(nk);
        });
        if (hasBad) return false;
        return neighborKeys.some(nk => {
          const n = PLANT_CATALOG[nk];
          return n?.goodCompanions.includes(key) || entry.goodCompanions.includes(nk);
        });
      })
      .slice(0, 8);
  }

  function getCatalogueList(): Array<{ key: string; entry: CatalogEntry }> {
    if (catalogueSearch.trim()) return searchPlants(catalogueSearch, 60);
    return Object.entries(PLANT_CATALOG)
      .map(([key, entry]) => ({ key, entry }))
      .sort((a, b) => a.entry.name.localeCompare(b.entry.name));
  }

  async function placePlant() {
    if (!user || !selectedGarden || !placement || !placeName.trim()) return;
    const data = await pb.collection('plants').create({
      user_id: user.id,
      garden_id: selectedGarden.id,
      name: placeName.trim(),
      row: placement.row,
      col: placement.col,
      health_status: 'healthy',
      sun_requirement: placeSun,
      water_interval_days: placeWaterDays,
      total_yield_grams: 0,
    });
    setPlants((p) => [...p, data as any]);
    emit('plants:changed');
    setPlacement(null);
    setPlaceSelected(false);
    setCatalogueSearch('');
  }

  // ── Plant action handlers ─────────────────────────────────────────────────

  async function unplantPlant() {
    if (!plantAction) return;
    await pb.collection('plants').update(plantAction.id, { row: null, col: null });
    setPlants(prev => prev.filter(p => p.id !== plantAction.id));
    setPlantAction(null);
    emit('plants:changed');
  }

  // ── Edit garden ───────────────────────────────────────────────────────────

  function openEditGarden() {
    if (!selectedGarden) return;
    setEditRows(selectedGarden.rows);
    setEditCols(selectedGarden.cols);
    setEditLayout(layoutFromGarden(selectedGarden));
    setEditStep('size');
    setEditLocationQuery('');
    setEditLocationResults([]);
    const savedLoc = selectedGarden.location_json
      ? (() => { try { return JSON.parse(selectedGarden.location_json as string); } catch { return null; } })()
      : null;
    setEditSelectedLocation(savedLoc);
    setShowEditGarden(true);
  }

  async function searchEditLocation(query: string) {
    setEditLocationQuery(query);
    if (query.length < 2) { setEditLocationResults([]); return; }
    setEditLocationSearching(true);
    const results = await searchCity(query);
    setEditLocationResults(results);
    setEditLocationSearching(false);
  }

  function selectEditLocation(r: GeoResult) {
    const loc: Location = {
      latitude: r.latitude,
      longitude: r.longitude,
      name: r.admin1 ? `${r.name}, ${r.admin1}` : `${r.name}, ${r.country}`,
    };
    setEditSelectedLocation(loc);
    setEditLocationQuery('');
    setEditLocationResults([]);
  }

  function handleEditSizeChange(dim: 'rows' | 'cols', delta: number) {
    if (dim === 'rows') {
      const next = Math.max(3, Math.min(14, editRows + delta));
      setEditRows(next);
      setEditLayout(prev => resizeLayout(prev, next, editCols));
    } else {
      const next = Math.max(3, Math.min(14, editCols + delta));
      setEditCols(next);
      setEditLayout(prev => resizeLayout(prev, editRows, next));
    }
  }

  function toggleEditTile(r: number, c: number) {
    setEditLayout(prev => {
      const next = prev.map(row => [...row]);
      next[r][c] = next[r][c] === 'inactive' ? 'full_sun' : 'inactive';
      return next;
    });
  }

  function cycleEditSun(r: number, c: number) {
    if (editLayout[r][c] === 'inactive') return;
    setEditLayout(prev => {
      const next = prev.map(row => [...row]);
      const curr = next[r][c] as TileState;
      const idx = SUN_CYCLE.indexOf(curr);
      next[r][c] = SUN_CYCLE[(idx + 1) % SUN_CYCLE.length];
      return next;
    });
  }

  async function saveGardenEdit() {
    if (!selectedGarden) return;
    setEditSaving(true);
    try {
      const updated = await pb.collection('gardens').update(selectedGarden.id, {
        rows: editRows,
        cols: editCols,
        layout: JSON.stringify(editLayout),
        location_json: editSelectedLocation ? JSON.stringify(editSelectedLocation) : null,
      });
      if (editSelectedLocation) {
        await saveGardenLocation(selectedGarden.id, editSelectedLocation);
        await saveLocation(editSelectedLocation);
      }
      setGardens(prev => prev.map(g => g.id === selectedGarden.id ? updated as any : g));
      setSelectedGarden(updated as any);
      setShowEditGarden(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save changes');
    } finally {
      setEditSaving(false);
    }
  }

  // ── Delete garden ─────────────────────────────────────────────────────────

  function confirmDeleteGarden() {
    if (!selectedGarden) return;
    Alert.alert(
      'Delete Garden',
      `Delete "${selectedGarden.name}" and all ${plants.length} plant${plants.length !== 1 ? 's' : ''} in it? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          await Promise.all(plants.map(p => pb.collection('plants').delete(p.id).catch(() => {})));
          await pb.collection('gardens').delete(selectedGarden.id).catch(() => {});
          const remaining = gardens.filter(g => g.id !== selectedGarden.id);
          setGardens(remaining);
          setSelectedGarden(remaining[0] ?? null);
          setPlants([]);
        }},
      ],
    );
  }

  // ── History ───────────────────────────────────────────────────────────────

  async function openHistory() {
    if (!user || !selectedGarden) return;
    const all = await getActivityLogAsync(user.id);
    const gardenPlantIds = new Set(plants.map(p => p.id));
    setHistoryLog(all.filter(e => e.gardenId === selectedGarden.id || gardenPlantIds.has(e.plantId)));
    setShowHistory(true);
  }

  // ── Plan ──────────────────────────────────────────────────────────────────

  const COOL_SEASON_KEYS = new Set([
    'lettuce','spinach','kale','broccoli','cabbage','cauliflower',
    'brussels_sprouts','pea','carrot','radish','beet','turnip','parsnip',
    'chard','arugula','bok_choy','collard_greens',
  ]);

  const planItems = useMemo(() => {
    if (!planSelectedKeys.length) return [];
    function parseMMDD(mmdd: string, year: number): Date | null {
      const [m, d] = mmdd.split('/').map(Number);
      if (isNaN(m) || isNaN(d)) return null;
      return new Date(year, m - 1, d);
    }
    const lastFrost = parseMMDD(planLastFrost, planYear);
    const firstFrost = parseMMDD(planFirstFrost, planYear);
    if (!lastFrost || !firstFrost) return [];
    return planSelectedKeys.map(key => {
      const entry = PLANT_CATALOG[key];
      if (!entry) return null;
      const matMin = entry.daysToMaturity?.min ?? 60;
      const matMax = entry.daysToMaturity?.max ?? 90;
      const isCool = COOL_SEASON_KEYS.has(key);
      const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
      const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      let directSow: Date;
      let seedStart: Date | null = null;
      let transplant: Date | null = null;
      if (isCool) {
        directSow = addDays(lastFrost, -42);
      } else {
        directSow = lastFrost;
        if (matMin >= 60) { seedStart = addDays(lastFrost, -56); transplant = lastFrost; }
      }
      return {
        key, entry,
        seedStart: seedStart ? fmt(seedStart) : null,
        transplant: transplant ? fmt(transplant) : null,
        directSow: fmt(directSow),
        harvestRange: `${fmt(addDays(directSow, matMin))} – ${fmt(addDays(directSow, matMax))}`,
      };
    }).filter(Boolean) as NonNullable<typeof planSelectedKeys>[number] extends string ? any[] : any[];
  }, [planSelectedKeys, planYear, planLastFrost, planFirstFrost]);

  const planCatalogueList = useMemo(() => {
    if (planSearch.trim()) return searchPlants(planSearch, 60);
    return Object.entries(PLANT_CATALOG).map(([key, entry]) => ({ key, entry }))
      .sort((a, b) => a.entry.name.localeCompare(b.entry.name));
  }, [planSearch]);

  // Build compatibility summary for placement modal
  function buildCompatSummary() {
    if (!placement || !placeName.trim()) return null;
    const tileSun = (placement.tileSun === 'inactive'
      ? (selectedGarden?.sun_exposure ?? 'full_sun')
      : placement.tileSun) as SunRequirement;
    const plantKey = findPlantKey(placeName);
    const plantInfo = plantKey ? PLANT_CATALOG[plantKey] : null;

    const sunCompat = plantInfo
      ? getSunCompatibility(plantInfo.sunRequirement, tileSun)
      : null;

    const neighborResults = placement.neighbors.map((neighbor) => {
      const compat = getCompatibility(placeName, neighbor.name);
      return { neighbor, compat };
    });

    const hasBad = neighborResults.some((r) => r.compat === 'bad');
    const hasGood = neighborResults.some((r) => r.compat === 'good');
    const overall: 'go' | 'warn' | 'stop' =
      hasBad ? 'stop' : hasGood ? 'go' : 'warn';

    return { sunCompat, neighborResults, plantInfo, overall, tileSun };
  }

  const compatSummary = buildCompatSummary();

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Garden selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gardenPicker}>
        {gardens.map((g) => (
          <TouchableOpacity
            key={g.id}
            style={[styles.gardenChip, { backgroundColor: isDark ? colors.bgCard : '#fff', borderColor: border }, selectedGarden?.id === g.id && styles.gardenChipActive]}
            onPress={() => setSelectedGarden(g)}
          >
            <Text style={[styles.gardenChipText, selectedGarden?.id === g.id && styles.gardenChipTextActive]}>
              {SUN_EMOJIS[g.sun_exposure as SunRequirement] ?? '☀️'} {g.name}
            </Text>
          </TouchableOpacity>
        ))}
        {sharedEntries.map(({ garden: g, ownerEmail }) => (
          <TouchableOpacity
            key={g.id}
            style={[styles.gardenChip, styles.gardenChipShared, { borderColor: isDark ? colors.border : '#a5d8ff' }, selectedGarden?.id === g.id && styles.gardenChipActive]}
            onPress={() => setSelectedGarden(g)}
          >
            <Text style={[styles.gardenChipText, selectedGarden?.id === g.id && styles.gardenChipTextActive]}>
              🤝 {g.name}
            </Text>
            <Text style={styles.gardenChipOwner} numberOfLines={1}>
              {ownerEmail.split('@')[0]}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.gardenChip, { backgroundColor: isDark ? colors.bgCard : '#fff', borderColor: border }]} onPress={() => router.push('/new-garden')}>
          <Text style={[styles.gardenChipText, { color: textPrim }]}>+ New</Text>
        </TouchableOpacity>
      </ScrollView>

      {selectedGarden ? (
        <ScrollView contentContainerStyle={styles.gridContainer} showsVerticalScrollIndicator={false}>
          {(() => {
            const sharedEntry = sharedEntries.find(e => e.garden.id === selectedGarden.id);
            const isOwned = !sharedEntry;
            return (
              <View style={styles.gardenHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={[styles.gardenName, { color: textPrim }]}>{selectedGarden.name}</Text>
                    {sharedEntry && (
                      <View style={styles.sharedBadge}>
                        <Text style={styles.sharedBadgeText}>🤝 Shared</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.gardenMeta, { color: textSec }]}>
                    {SUN_EMOJIS[selectedGarden.sun_exposure as SunRequirement]}{' '}
                    {SUN_LABELS[selectedGarden.sun_exposure as SunRequirement]} · {selectedGarden.rows}×{selectedGarden.cols}
                    {sharedEntry ? ` · by ${sharedEntry.ownerEmail}` : ''}
                  </Text>
                </View>
                <View style={styles.headerActions}>
                  <TouchableOpacity style={styles.headerBtn} onPress={openHistory}>
                    <Text style={styles.headerBtnText}>📋 History</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.headerBtn} onPress={() => setShowPlan(true)}>
                    <Text style={styles.headerBtnText}>🗓️ Plan</Text>
                  </TouchableOpacity>
                  {isOwned && (
                    <>
                      <TouchableOpacity style={styles.headerBtn} onPress={openEditGarden}>
                        <Text style={styles.headerBtnText}>✏️ Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.headerBtn, styles.headerBtnDanger]} onPress={confirmDeleteGarden}>
                        <Text style={styles.headerBtnDangerText}>🗑</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          })()}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.gridScroll}
          >
            <View>
              {Array.from({ length: selectedGarden.rows }).map((_, row) => (
                  <View key={row} style={styles.gridRow}>
                    {Array.from({ length: selectedGarden.cols }).map((_, col) => {
                      const plant = getPlantAt(row, col);
                      const tileState = gardenLayout?.[row]?.[col] ?? 'inactive';
                      const isInactive = tileState === 'inactive';
                      // Planted tiles: health color bg + tile-sun dot overlay
                      // Empty tiles: tile-sun color bg (no overlap with health)
                      const tileBg = plant
                        ? HEALTH_COLORS[plant.health_status]
                        : isInactive ? '#e0e6e3' : TILE_COLORS[tileState];
                      return (
                        <TouchableOpacity
                          key={col}
                          style={[styles.cell, { backgroundColor: tileBg }, isInactive && styles.inactiveCell]}
                          onPress={() => !isInactive && handleCellTap(row, col)}
                          disabled={isInactive}
                        >
                          {plant ? (
                            <>
                              <Text style={styles.cellEmoji}>{getPlantIcon(plant.name).emoji}</Text>
                              {tileState !== 'inactive' && (
                                <Text style={styles.cellSunEmoji}>{TILE_EMOJIS[tileState]}</Text>
                              )}
                            </>
                          ) : !isInactive ? (
                            <Text style={styles.cellPlus}>+</Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
            </View>
          </ScrollView>

          {/* Legend */}
          <View style={styles.legendSection}>
            <Text style={styles.legendHeading}>Plant health (cell color)</Text>
            <View style={styles.legend}>
              {Object.entries(HEALTH_COLORS).map(([status, color]) => (
                <View key={status} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: color }]} />
                  <Text style={[styles.legendLabel, { color: textSec }]}>{status.replace('_', ' ')}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.legendSection}>
            <Text style={styles.legendHeading}>Tile sunlight (emoji in corner)</Text>
            <View style={styles.legend}>
              {SUN_CYCLE.map(s => (
                <View key={s} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: TILE_COLORS[s] }]} />
                  <Text style={styles.legendLabel}>{TILE_LABELS[s]}</Text>
                </View>
              ))}
            </View>
          </View>
          <Text style={styles.hint}>Tap empty cell to plant · Tap plant for options</Text>
        </ScrollView>
      ) : (
        <FadeInView style={styles.empty} from="scale">
          <Text style={styles.emptyEmoji}>🌻</Text>
          <Text style={styles.emptyTitle}>No garden yet</Text>
          <Text style={styles.emptySub}>Let's set one up — it only takes a minute.</Text>
          <PressableScale onPress={() => router.push('/new-garden')} style={styles.emptyBtn}>
            <LinearGradient colors={[G.sage, G.forest]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyBtnGradient}>
              <Text style={styles.emptyBtnText}>🌱  Create my first garden</Text>
            </LinearGradient>
          </PressableScale>
        </FadeInView>
      )}

      {/* ── Plant Action Sheet ─────────────────────────────────────────── */}
      <Modal visible={!!plantAction} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPlantAction(null)} />
          <View style={[styles.modal, { paddingTop: 12, backgroundColor: cardBg }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: textPrim }]}>{plantAction?.name ?? ''}</Text>
            <Text style={[styles.fieldLabel, { marginBottom: 16, color: textSec }]}>
              {plantAction?.health_status?.replace('_', ' ')} · {plantAction?.sun_requirement?.replace('_', ' ')}
            </Text>

            <TouchableOpacity style={[styles.actionRow, { borderBottomColor: isDark ? colors.border : undefined }]} onPress={() => {
              const p = plantAction; setPlantAction(null);
              if (p) router.push(`/plant/${p.id}`);
            }}>
              <Text style={[styles.actionRowText, { color: textPrim }]}>👁  View Plant Details</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionRow, { borderBottomWidth: 0 }]} onPress={unplantPlant}>
              <Text style={[styles.actionRowText, { color: textPrim }]}>⬜  Remove from this square</Text>
              <Text style={[styles.actionRowSub, { color: textSec }]}>Plant stays in your Plants list</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setPlantAction(null)} style={styles.actionCancel}>
              <Text style={[styles.cancelText, { color: textSec }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Edit Garden Modal ──────────────────────────────────────────── */}
      <Modal visible={showEditGarden} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowEditGarden(false)} />
          <View style={[styles.modal, { paddingTop: 12, maxHeight: '85%', backgroundColor: cardBg }]}>
            <View style={styles.modalHandle} />
            <View style={[styles.editStepTabs, { backgroundColor: isDark ? colors.bgElement : G.foam }]}>
              {(['size', 'shape', 'sun', 'location'] as const).map((s, i) => (
                <TouchableOpacity
                  key={s} style={[styles.editTab, editStep === s && styles.editTabActive]}
                  onPress={() => setEditStep(s)}
                >
                  <Text style={[styles.editTabText, editStep === s && styles.editTabTextActive]}>
                    {['📐 Size', '🗺️ Shape', '☀️ Sun', '📍 Location'][i]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {editStep === 'size' && (
                <View style={styles.editSection}>
                  <Text style={styles.editHint}>Adjust garden dimensions. Existing tiles are preserved.</Text>
                  <EditStepper label="Rows" value={editRows} min={3} max={14} onChange={d => handleEditSizeChange('rows', d)} />
                  <EditStepper label="Cols" value={editCols} min={3} max={14} onChange={d => handleEditSizeChange('cols', d)} />
                  <Text style={styles.editCount}>{editRows} × {editCols} = {editRows * editCols} tiles</Text>
                </View>
              )}

              {editStep === 'shape' && (
                <View style={styles.editSection}>
                  <Text style={styles.editHint}>Tap tiles to include/exclude them from your garden.</Text>
                  <View style={styles.editLegendRow}>
                    <LegendDot color="#e0e6e3" label="Excluded" />
                    <LegendDot color={TILE_COLORS.full_sun} label="Included" />
                  </View>
                  <EditTileGrid layout={editLayout} onTap={toggleEditTile} showSun={false} />
                  <Text style={styles.editCount}>{activeCount(editLayout)} active tiles</Text>
                </View>
              )}

              {editStep === 'sun' && (
                <View style={styles.editSection}>
                  <Text style={styles.editHint}>Tap active tiles to cycle sunlight: ☀️ Full → ⛅ Partial → 🌑 Shade</Text>
                  <View style={styles.editLegendRow}>
                    {SUN_CYCLE.map(s => <LegendDot key={s} color={TILE_COLORS[s]} label={TILE_LABELS[s]} />)}
                  </View>
                  <EditTileGrid layout={editLayout} onTap={cycleEditSun} showSun />
                </View>
              )}

              {editStep === 'location' && (
                <View style={styles.editSection}>
                  <Text style={styles.editHint}>Used for weather-aware watering advice on the Schedule tab.</Text>
                  {editSelectedLocation ? (
                    <View style={[styles.locationConfirmed, { borderColor: G.sage }]}>
                      <Text style={styles.locationPin}>📍</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.locationName, { color: textPrim }]}>{editSelectedLocation.name ?? 'Saved location'}</Text>
                        <Text style={[styles.locationCoords, { color: textSec }]}>
                          {editSelectedLocation.latitude?.toFixed(3)}, {editSelectedLocation.longitude?.toFixed(3)}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setEditSelectedLocation(null)} style={styles.changeLoc}>
                        <Text style={styles.changeLocText}>Change</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <TextInput
                        style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
                        placeholder="Search city (e.g. Austin, London)"
                        placeholderTextColor={textSec}
                        value={editLocationQuery}
                        onChangeText={searchEditLocation}
                      />
                      {editLocationSearching && (
                        <Text style={[styles.editHint, { color: textSec }]}>Searching…</Text>
                      )}
                      {editLocationResults.map((r, i) => (
                        <TouchableOpacity
                          key={i}
                          style={[styles.catItem, { borderBottomColor: border }]}
                          onPress={() => selectEditLocation(r)}
                        >
                          <Text style={[styles.catItemName, { color: textPrim }]}>{r.name}</Text>
                          <Text style={[styles.catItemMeta, { color: textSec }]}>
                            {r.admin1 ? `${r.admin1}, ` : ''}{r.country}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={[styles.modalButtons, { paddingTop: 12, borderTopWidth: 1, borderTopColor: border }]}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditGarden(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, editSaving && { opacity: 0.6 }]}
                onPress={saveGardenEdit}
                disabled={editSaving}
              >
                <Text style={styles.buttonText}>{editSaving ? 'Saving…' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* New Garden Modal */}
      <Modal visible={showNewGarden} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { backgroundColor: cardBg }]}>
            <Text style={[styles.modalTitle, { color: textPrim }]}>New Garden</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
              placeholder="Garden name"
              placeholderTextColor={textSec}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <Text style={[styles.fieldLabel, { color: textSec }]}>Sun exposure</Text>
            <View style={styles.sunRow}>
              {SUN_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sunChip, newSun === s && styles.sunChipActive]}
                  onPress={() => setNewSun(s)}
                >
                  <Text style={styles.sunChipText}>{SUN_EMOJIS[s]} {s.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowNewGarden(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={createGarden}>
                <Text style={styles.buttonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Place Plant Modal */}
      <Modal visible={!!placement} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPlacement(null)} />

          <View style={[styles.modal, { backgroundColor: cardBg }]}>
            <View style={styles.modalHandle} />

            <View style={styles.modalTitleRow}>
              <Text style={[styles.modalTitle, { color: textPrim }]}>Plant Here</Text>
              <Text style={[styles.modalTileSun, { color: textSec }]}>
                {placement?.tileSun && placement.tileSun !== 'inactive'
                  ? `${SUN_EMOJIS[placement.tileSun as SunRequirement]} ${SUN_LABELS[placement.tileSun as SunRequirement]}`
                  : ''}
              </Text>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
              style={styles.modalScroll}
            >
              {!placeSelected ? (
                <>
                  {/* Search box — no autoFocus so keyboard doesn't pop up */}
                  <TextInput
                    style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
                    placeholder="Search plants..."
                    placeholderTextColor={textSec}
                    value={catalogueSearch}
                    onChangeText={setCatalogueSearch}
                  />

                  {/* Companion suggestions when neighbors exist */}
                  {(() => {
                    const suggestions = getNeighborSuggestions();
                    if (!suggestions.length) return null;
                    return (
                      <>
                        <Text style={[styles.catSectionLabel, { color: textSec }]}>✅ Goes well here</Text>
                        {suggestions.map(({ key, entry }) => {
                          const tileSun = placement?.tileSun && placement.tileSun !== 'inactive'
                            ? placement.tileSun as SunRequirement
                            : null;
                          const sunCompat = tileSun ? getSunCompatibility(entry.sunRequirement, tileSun) : null;
                          const sunBadge = sunCompat === 'match' ? '✅' : sunCompat === 'tolerable' ? '⚠️' : sunCompat === 'mismatch' ? '❌' : null;
                          return (
                            <TouchableOpacity key={key} style={[styles.catItem, { borderBottomColor: border }]} onPress={() => selectCatalogueItem(entry)}>
                              <Text style={styles.catItemEmoji}>{getPlantIcon(entry.name).emoji}</Text>
                              <View style={styles.catItemContent}>
                                <Text style={[styles.catItemName, { color: textPrim }]}>{entry.name}</Text>
                                <Text style={[styles.catItemMeta, { color: textSec }]}>
                                  {SUN_EMOJIS[entry.sunRequirement]} needs {entry.sunRequirement.replace('_', ' ')} · 💧 every {entry.waterIntervalDays}d
                                </Text>
                              </View>
                              {sunBadge && <Text style={{ fontSize: 16 }}>{sunBadge}</Text>}
                            </TouchableOpacity>
                          );
                        })}
                      </>
                    );
                  })()}

                  {/* Full catalogue */}
                  <Text style={[styles.catSectionLabel, { color: textSec }]}>
                    {catalogueSearch.trim() ? 'Search results' : '🌱 All Plants'}
                  </Text>
                  {getCatalogueList().map(({ key, entry }) => {
                    const tileSun = placement?.tileSun && placement.tileSun !== 'inactive'
                      ? placement.tileSun as SunRequirement
                      : null;
                    const sunCompat = tileSun ? getSunCompatibility(entry.sunRequirement, tileSun) : null;
                    const sunBadge = sunCompat === 'match' ? '✅' : sunCompat === 'tolerable' ? '⚠️' : sunCompat === 'mismatch' ? '❌' : null;
                    return (
                      <TouchableOpacity key={key} style={[styles.catItem, { borderBottomColor: border }]} onPress={() => selectCatalogueItem(entry)}>
                        <Text style={styles.catItemEmoji}>{getPlantIcon(entry.name).emoji}</Text>
                        <View style={styles.catItemContent}>
                          <Text style={[styles.catItemName, { color: textPrim }]}>{entry.name}</Text>
                          <Text style={[styles.catItemMeta, { color: textSec }]}>
                            {SUN_EMOJIS[entry.sunRequirement]} needs {entry.sunRequirement.replace('_', ' ')} · 💧 every {entry.waterIntervalDays}d
                          </Text>
                        </View>
                        {sunBadge && <Text style={{ fontSize: 16 }}>{sunBadge}</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </>
              ) : (
                <>
                  {/* Selected plant header */}
                  <View style={[styles.selectedRow, { borderBottomColor: border }]}>
                    <Text style={styles.selectedEmoji}>{getPlantIcon(placeName).emoji}</Text>
                    <Text style={[styles.selectedName, { color: textPrim }]}>{placeName}</Text>
                    <TouchableOpacity onPress={() => { setPlaceSelected(false); setPlaceName(''); }}>
                      <Text style={[styles.changePlantText, { color: textSec }]}>✕ Change</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Sun / companion warnings */}
                  {compatSummary?.sunCompat === 'mismatch' && (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorBannerText}>
                        ⛔ Sun mismatch — {compatSummary.plantInfo?.name} needs{' '}
                        {SUN_LABELS[compatSummary.plantInfo!.sunRequirement]}, this tile gets{' '}
                        {SUN_LABELS[compatSummary.tileSun as SunRequirement]}
                      </Text>
                    </View>
                  )}
                  {compatSummary?.sunCompat === 'tolerable' && (
                    <View style={styles.warnBanner}>
                      <Text style={styles.warnBannerText}>
                        ⚠️ Marginal sun — {compatSummary.plantInfo?.name} prefers{' '}
                        {SUN_LABELS[compatSummary.plantInfo!.sunRequirement]}, this tile gets{' '}
                        {SUN_LABELS[compatSummary.tileSun as SunRequirement]}
                      </Text>
                    </View>
                  )}
                  {compatSummary?.overall === 'stop' && (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorBannerText}>
                        ⛔ Bad companions nearby:{' '}
                        {compatSummary.neighborResults.filter(r => r.compat === 'bad').map(r => r.neighbor.name).join(', ')}
                      </Text>
                    </View>
                  )}

                  {/* Water interval */}
                  <View style={styles.waterRow}>
                    <Text style={styles.fieldLabel}>Water every</Text>
                    <View style={styles.waterStepper}>
                      <TouchableOpacity style={styles.stepBtn} onPress={() => setPlaceWaterDays((d) => Math.max(1, d - 1))}>
                        <Text style={styles.stepBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepValue}>{placeWaterDays} days</Text>
                      <TouchableOpacity style={styles.stepBtn} onPress={() => setPlaceWaterDays((d) => Math.min(30, d + 1))}>
                        <Text style={styles.stepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Compatibility analysis */}
                  <View style={styles.analysisBox}>
                    <Text style={styles.analysisTitle}>Planting Analysis</Text>
                    {compatSummary?.sunCompat ? (
                      <View style={styles.analysisRow}>
                        <Text style={styles.analysisEmoji}>
                          {compatSummary.sunCompat === 'match' ? '✅' : compatSummary.sunCompat === 'tolerable' ? '⚠️' : '❌'}
                        </Text>
                        <View style={styles.analysisText}>
                          <Text style={styles.analysisLabel}>Sun</Text>
                          <Text style={styles.analysisSub}>
                            {compatSummary.plantInfo
                              ? `Needs ${SUN_LABELS[compatSummary.plantInfo.sunRequirement]}, tile gets ${SUN_LABELS[compatSummary.tileSun as SunRequirement]}`
                              : `Tile gets ${SUN_LABELS[(placement?.tileSun ?? 'full_sun') as SunRequirement]}`}
                          </Text>
                        </View>
                      </View>
                    ) : null}

                    {compatSummary?.plantInfo?.notes && (
                      <View style={[styles.analysisRow, { marginTop: 4 }]}>
                        <Text style={styles.analysisEmoji}>💡</Text>
                        <Text style={[styles.analysisSub, { flex: 1 }]}>{compatSummary.plantInfo.notes}</Text>
                      </View>
                    )}

                    {placement?.neighbors && placement.neighbors.length > 0 ? (
                      <>
                        <Text style={styles.neighborHeader}>Neighbors</Text>
                        {compatSummary?.neighborResults.map(({ neighbor, compat }) => (
                          <View key={neighbor.id} style={styles.neighborRow}>
                            <Text style={[styles.compatBadge, { backgroundColor: COMPAT_COLOR[compat] }]}>
                              {COMPAT_EMOJI[compat]}
                            </Text>
                            <View style={styles.neighbourText}>
                              <Text style={styles.neighbourName}>{neighbor.name}</Text>
                              <Text style={styles.neighbourCompat}>
                                {compat === 'good' ? 'Good companion' :
                                 compat === 'bad' ? 'Bad companion — keep apart' :
                                 compat === 'neutral' ? 'Neutral' : 'Unknown compatibility'}
                              </Text>
                            </View>
                          </View>
                        ))}
                        {compatSummary && (
                          <View style={[styles.verdict, {
                            backgroundColor:
                              compatSummary.overall === 'go' ? '#d8f3dc' :
                              compatSummary.overall === 'stop' ? '#ffe3e3' : '#fff3cd',
                          }]}>
                            <Text style={styles.verdictText}>
                              {compatSummary.overall === 'go' && '🌿 Great spot! Good companions nearby.'}
                              {compatSummary.overall === 'stop' && '⚠️ Bad companions nearby — consider a different spot.'}
                              {compatSummary.overall === 'warn' && '➖ No strong conflicts, but no synergies either.'}
                            </Text>
                          </View>
                        )}
                      </>
                    ) : (
                      <Text style={styles.analysisSub}>No adjacent plants — plant freely!</Text>
                    )}
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPlacement(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.button,
                  !placeSelected && styles.buttonDisabled,
                  placeSelected && (compatSummary?.sunCompat === 'mismatch' || compatSummary?.overall === 'stop')
                    ? styles.buttonDanger
                    : placeSelected && compatSummary?.sunCompat === 'tolerable'
                    ? styles.buttonWarn
                    : null,
                ]}
                onPress={placePlant}
                disabled={!placeSelected}
              >
                <Text style={styles.buttonText}>
                  {placeSelected && (compatSummary?.sunCompat === 'mismatch' || compatSummary?.overall === 'stop')
                    ? 'Plant Anyway ⚠️'
                    : 'Plant It ✓'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── History Modal ─────────────────────────────────────────────── */}
      <Modal visible={showHistory} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowHistory(false)} />
          <View style={[styles.modal, { paddingTop: 12, maxHeight: '80%', backgroundColor: cardBg }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: textPrim }]}>📋 History — {selectedGarden?.name}</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              {historyLog.length === 0 ? (
                <Text style={[styles.analysisSub, { textAlign: 'center', paddingVertical: 24 }]}>
                  No events yet. Water or harvest a plant to start logging.
                </Text>
              ) : historyLog.map(entry => (
                <View key={entry.id} style={[styles.historyRow, { borderBottomColor: border }]}>
                  <View style={[styles.historyDot, { backgroundColor: entry.type === 'water' ? '#74c0fc' : '#a9e34b' }]} />
                  <Text style={styles.historyEmoji}>{getPlantIcon(entry.plantName).emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.catItemName, { color: textPrim }]}>{entry.plantName}</Text>
                    <Text style={[styles.catItemMeta, { color: textSec }]}>
                      {entry.type === 'water' ? '💧 Watered' : `🧺 Harvested${entry.grams ? ` · ${entry.grams}g` : ''}`}
                      {entry.notes ? ` · ${entry.notes}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.catItemMeta, { color: textSec }]}>
                    {new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowHistory(false)} style={[styles.actionCancel]}>
              <Text style={styles.cancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Plan Modal ────────────────────────────────────────────────── */}
      <Modal visible={showPlan} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowPlan(false)} />
          <View style={[styles.modal, { paddingTop: 12, maxHeight: '88%', backgroundColor: cardBg }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: textPrim }]}>🗓️ Season Plan — {selectedGarden?.name}</Text>

            {/* Year picker */}
            <View style={styles.planYearRow}>
              <TouchableOpacity style={styles.planYearBtn} onPress={() => setPlanYear(y => Math.max(new Date().getFullYear() - 1, y - 1))}>
                <Text style={[styles.stepBtnText, { color: textPrim }]}>−</Text>
              </TouchableOpacity>
              <Text style={[styles.planYearVal, { color: textPrim }]}>{planYear}</Text>
              <TouchableOpacity style={styles.planYearBtn} onPress={() => setPlanYear(y => y + 1)}>
                <Text style={[styles.stepBtnText, { color: textPrim }]}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Frost dates */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: textSec }]}>Last Spring Frost</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim, marginBottom: 0 }]}
                  value={planLastFrost} onChangeText={setPlanLastFrost}
                  placeholder="MM/DD" placeholderTextColor={textSec} maxLength={5}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: textSec }]}>First Fall Frost</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim, marginBottom: 0 }]}
                  value={planFirstFrost} onChangeText={setPlanFirstFrost}
                  placeholder="MM/DD" placeholderTextColor={textSec} maxLength={5}
                />
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Plant picker */}
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
                placeholder="Search plants to add to plan..."
                placeholderTextColor={textSec}
                value={planSearch} onChangeText={setPlanSearch}
              />
              {planCatalogueList.slice(0, planSearch.trim() ? 60 : 20).map(({ key, entry }) => {
                const sel = planSelectedKeys.includes(key);
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.catItem, { borderBottomColor: border, backgroundColor: sel ? (isDark ? colors.bgElement : '#d8f3dc') : undefined }]}
                    onPress={() => setPlanSelectedKeys(prev => sel ? prev.filter(k => k !== key) : [...prev, key])}
                  >
                    <Text style={styles.catItemEmoji}>{getPlantIcon(entry.name).emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.catItemName, { color: textPrim }]}>{entry.name}</Text>
                      <Text style={[styles.catItemMeta, { color: textSec }]}>
                        {entry.daysToMaturity?.min ?? '?'}–{entry.daysToMaturity?.max ?? '?'} days
                      </Text>
                    </View>
                    {sel && <Text style={{ fontSize: 16 }}>✅</Text>}
                  </TouchableOpacity>
                );
              })}

              {/* Schedule */}
              {planItems.length > 0 && (
                <>
                  <Text style={[styles.catSectionLabel, { color: textSec, marginTop: 16 }]}>
                    📅 {planYear} Planting Schedule
                  </Text>
                  {planItems.map((item: any) => (
                    <View key={item.key} style={[styles.planCard, { backgroundColor: isDark ? colors.bgElement : '#f8fffe', borderColor: border }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Text style={{ fontSize: 22 }}>{getPlantIcon(item.entry.name).emoji}</Text>
                        <Text style={[styles.catItemName, { color: textPrim, fontSize: 16 }]}>{item.entry.name}</Text>
                      </View>
                      {item.seedStart && <Text style={[styles.catItemMeta, { color: textSec }]}>🏠 Start seeds indoors: {item.seedStart}</Text>}
                      {item.transplant && <Text style={[styles.catItemMeta, { color: textSec }]}>🌱 Transplant outside: {item.transplant}</Text>}
                      {!item.seedStart && <Text style={[styles.catItemMeta, { color: textSec }]}>🌱 Direct sow: {item.directSow}</Text>}
                      <Text style={[styles.catItemMeta, { color: textSec }]}>🧺 Expected harvest: {item.harvestRange}</Text>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>

            <TouchableOpacity onPress={() => setShowPlan(false)} style={[styles.actionCancel]}>
              <Text style={styles.cancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Edit garden sub-components ───────────────────────────────────────────────

function EditStepper({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (d: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, backgroundColor: G.foam, borderRadius: R.lg, padding: 14 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: G.forest }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <TouchableOpacity
          style={{ width: 34, height: 34, borderRadius: R.full, backgroundColor: G.dew, justifyContent: 'center', alignItems: 'center' }}
          onPress={() => onChange(-1)} disabled={value <= min}
        >
          <Text style={{ fontSize: 20, color: G.hunter, lineHeight: 22 }}>−</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '800', color: G.forest, minWidth: 28, textAlign: 'center' }}>{value}</Text>
        <TouchableOpacity
          style={{ width: 34, height: 34, borderRadius: R.full, backgroundColor: G.dew, justifyContent: 'center', alignItems: 'center' }}
          onPress={() => onChange(1)} disabled={value >= max}
        >
          <Text style={{ fontSize: 20, color: G.hunter, lineHeight: 22 }}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function EditTileGrid({ layout, onTap, showSun }: {
  layout: GardenLayout; onTap: (r: number, c: number) => void; showSun: boolean;
}) {
  const cols = layout[0]?.length ?? 0;
  const tileSize = Math.max(20, Math.min(40, Math.floor((320 - cols * 3) / cols)));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        {layout.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {row.map((tile, c) => {
              const isActive = tile !== 'inactive';
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => onTap(r, c)}
                  style={{
                    width: tileSize, height: tileSize, margin: 2, borderRadius: 4,
                    backgroundColor: isActive ? TILE_COLORS[tile] : '#e0e6e3',
                    justifyContent: 'center', alignItems: 'center',
                  }}
                >
                  {showSun && isActive && (
                    <Text style={{ fontSize: tileSize * 0.42, lineHeight: tileSize }}>
                      {TILE_EMOJIS[tile]}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontSize: 11, color: G.stone }}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.foam },
  emptyTitle:  { fontSize: 22, fontWeight: '800', color: G.forest, marginBottom: 8, marginTop: 8 },
  emptySub:    { fontSize: 15, color: G.stone, textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  emptyBtn:    { borderRadius: R.lg, overflow: 'hidden', ...Shadow.card },
  emptyBtnGradient: { paddingVertical: 15, paddingHorizontal: 28 },
  emptyBtnText: { color: G.cloud, fontWeight: '700', fontSize: 16 },
  inactiveCell: { opacity: 0.45 },
  gardenPicker: { flexGrow: 0, paddingHorizontal: 16, paddingVertical: 12 },
  gardenChip: {
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#b7e4c7',
  },
  gardenChipShared: { borderColor: '#a5d8ff', backgroundColor: '#f0f8ff', borderStyle: 'dashed' },
  gardenChipActive: { backgroundColor: '#2d6a4f', borderColor: '#2d6a4f' },
  gardenChipText: { color: '#2d6a4f', fontWeight: '500' },
  gardenChipTextActive: { color: '#fff' },
  gardenChipOwner: { fontSize: 10, color: '#74c0fc', marginTop: 1 },
  sharedBadge: { backgroundColor: '#e7f5ff', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  sharedBadgeText: { fontSize: 11, color: '#1971c2', fontWeight: '600' },
  gridContainer: { padding: 16 },
  gridScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  gardenHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  gardenName: { fontSize: 20, fontWeight: '700', color: '#2d6a4f' },
  gardenMeta: { fontSize: 13, color: '#52796f', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 6, marginLeft: 8 },
  headerBtn: { borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: G.dew, borderWidth: 1, borderColor: G.mist },
  headerBtnText: { fontSize: 12, fontWeight: '600', color: G.hunter },
  headerBtnDanger: { backgroundColor: '#fff5f5', borderColor: '#ffc9c9' },
  headerBtnDangerText: { fontSize: 14 },
  gridRow: { flexDirection: 'row' },
  cell: {
    width: 56, height: 56, margin: 2, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyCell: {
    backgroundColor: '#d8f3dc', borderWidth: 1,
    borderColor: '#b7e4c7', borderStyle: 'dashed',
  },
  cellEmoji: { fontSize: 22, lineHeight: 28 },
  cellSun: { fontSize: 10 },
  cellPlus: { fontSize: 18, color: '#b7e4c7' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 11, color: '#52796f', textTransform: 'capitalize' },
  hint: { fontSize: 12, color: '#74c69d', marginTop: 8, textAlign: 'center' },
  legendSection: { marginTop: 16 },
  legendHeading: { fontSize: 11, fontWeight: '700', color: '#52796f', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },

  // Cell
  cellSunEmoji: { position: 'absolute', bottom: 1, right: 2, fontSize: 11, lineHeight: 14 },

  // Plant action sheet
  actionRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: G.foam },
  actionRowDanger: { borderBottomWidth: 0 },
  actionRowText: { fontSize: 16, color: G.forest, fontWeight: '500' },
  actionRowSub: { fontSize: 12, color: G.stone, marginTop: 2 },
  actionCancel: { paddingVertical: 14, alignItems: 'center' },

  // Edit garden modal
  editStepTabs: { flexDirection: 'row', backgroundColor: G.foam, borderRadius: R.md, padding: 3, marginBottom: 16 },
  editTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: R.sm - 1 },
  editTabActive: { backgroundColor: G.cloud, ...Shadow.soft },
  editTabText: { fontSize: 12, color: G.stone, fontWeight: '500' },
  editTabTextActive: { color: G.forest, fontWeight: '700' },
  editSection: { paddingBottom: 8 },
  editHint: { fontSize: 13, color: G.stone, marginBottom: 14, fontStyle: 'italic' },
  editLegendRow: { flexDirection: 'row', gap: 14, marginBottom: 10 },
  editCount: { fontSize: 12, color: G.stone, marginTop: 10, textAlign: 'center' },
  locationConfirmed: { flexDirection: 'row', alignItems: 'center', borderRadius: R.md, borderWidth: 1.5, padding: 12, gap: 10, marginBottom: 8 },
  locationPin: { fontSize: 22 },
  locationName: { fontSize: 14, fontWeight: '700' },
  locationCoords: { fontSize: 11, marginTop: 2 },
  changeLoc: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.sm, backgroundColor: G.dew },
  changeLocText: { fontSize: 12, color: G.hunter, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#52796f', marginBottom: 20 },
  button: { backgroundColor: '#2d6a4f', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  buttonDisabled: { opacity: 0.4 },
  buttonDanger: { backgroundColor: '#c0392b' },
  buttonWarn: { backgroundColor: '#d97706' },
  buttonText: { color: '#fff', fontWeight: '600' },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTileSun: { fontSize: 12, color: '#52796f', fontWeight: '500' },
  errorBanner: {
    backgroundColor: '#ffe3e3', borderRadius: 10, padding: 12, marginBottom: 10,
    borderLeftWidth: 4, borderLeftColor: '#c0392b',
  },
  errorBannerText: { fontSize: 13, color: '#922b21', fontWeight: '600', lineHeight: 18 },
  warnBanner: {
    backgroundColor: '#fff8e1', borderRadius: 10, padding: 12, marginBottom: 10,
    borderLeftWidth: 4, borderLeftColor: '#d97706',
  },
  warnBannerText: { fontSize: 13, color: '#7d5a00', fontWeight: '600', lineHeight: 18 },
  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    paddingTop: 12,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#d0d8d4',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalScroll: { maxHeight: 460 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#2d6a4f' },
  input: {
    backgroundColor: '#f0f7ee', borderRadius: 12, padding: 14, fontSize: 16,
    borderWidth: 1, borderColor: '#b7e4c7', marginBottom: 12,
  },
  fieldLabel: { fontSize: 13, color: '#52796f', fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  sunRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  sunChip: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#f0f7ee', borderWidth: 1, borderColor: '#b7e4c7',
  },
  sunChipActive: { backgroundColor: '#2d6a4f', borderColor: '#2d6a4f' },
  sunChipText: { color: '#2d6a4f', fontSize: 12, fontWeight: '500' },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f7ee',
  },
  cancelBtn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#fff5f5', borderWidth: 1.5, borderColor: '#ffc9c9' },
  cancelText: { color: '#e03131', fontSize: 15, fontWeight: '700' },
  // Analysis
  analysisBox: {
    backgroundColor: '#f8fffe', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#b7e4c7', marginBottom: 12,
  },
  analysisTitle: { fontSize: 14, fontWeight: '700', color: '#2d6a4f', marginBottom: 10 },
  analysisRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  analysisEmoji: { fontSize: 18, width: 24 },
  analysisText: { flex: 1 },
  analysisLabel: { fontSize: 13, fontWeight: '600', color: '#1b4332' },
  analysisSub: { fontSize: 12, color: '#52796f', marginTop: 1 },
  neighborHeader: { fontSize: 13, fontWeight: '600', color: '#52796f', marginTop: 8, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  neighborRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  compatBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  neighbourText: { flex: 1 },
  neighbourName: { fontSize: 14, fontWeight: '600', color: '#1b4332' },
  neighbourCompat: { fontSize: 12, color: '#52796f' },
  verdict: { borderRadius: 10, padding: 12, marginTop: 8 },
  verdictText: { fontSize: 13, fontWeight: '600', color: '#1b4332' },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  historyDot: { width: 8, height: 8, borderRadius: 4 },
  historyEmoji: { fontSize: 20, width: 28, textAlign: 'center' },
  planYearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 12 },
  planYearBtn: { width: 36, height: 36, borderRadius: R.full, backgroundColor: G.dew, justifyContent: 'center', alignItems: 'center' },
  planYearVal: { fontSize: 26, fontWeight: '800', minWidth: 70, textAlign: 'center' },
  planCard: { borderRadius: R.md, padding: 12, marginBottom: 8, borderWidth: 1, gap: 4 },
  catSectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 12, marginBottom: 4 },
  catItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2, borderBottomWidth: 1, gap: 10 },
  catItemEmoji: { fontSize: 24, width: 34, textAlign: 'center' },
  catItemContent: { flex: 1 },
  catItemName: { fontSize: 15, fontWeight: '600' },
  catItemMeta: { fontSize: 12, marginTop: 1 },
  selectedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, marginBottom: 10, borderBottomWidth: 1, gap: 8 },
  selectedEmoji: { fontSize: 26 },
  selectedName: { flex: 1, fontSize: 18, fontWeight: '700' },
  changePlantText: { fontSize: 13, fontWeight: '600' },
  waterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  waterStepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#d8f3dc', justifyContent: 'center', alignItems: 'center' },
  stepBtnText: { fontSize: 18, fontWeight: '700', color: '#2d6a4f', lineHeight: 20 },
  stepValue: { fontSize: 15, fontWeight: '600', color: '#1b4332', minWidth: 60, textAlign: 'center' },
});
