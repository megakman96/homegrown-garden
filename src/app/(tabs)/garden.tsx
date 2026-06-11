import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
  FlatList, useWindowDimensions, Animated, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { pb } from '@/lib/pb';
import { offlineList, offlineCreate, offlineUpdate, offlineDelete } from '@/lib/offline-db';
import { useAuth } from '@/hooks/use-auth';
import { usePremium, FREE_LIMITS } from '@/hooks/use-premium';
import { PressableScale } from '@/components/ui/PressableScale';
import { FadeInView } from '@/components/ui/FadeInView';
import { G, Shadow, R } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import { getPlantIcon } from '@/lib/plant-icons';
import {
  layoutFromGarden, makeLayout, resizeLayout,
  TILE_COLORS, TILE_LABELS, TILE_EMOJIS, SUN_CYCLE, activeCount,
  tileSizeInFromGarden, yearFromGarden, serializeLayout,
  DEFAULT_TILE_SIZE_IN, TILE_SIZE_STEP_IN, TILE_SIZE_MIN_IN, TILE_SIZE_MAX_IN,
  formatTileSize, formatTotalSize, sortGardens,
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
import { getActivityLogAsync, addActivityEntryAsync, type ActivityEntry } from '@/lib/activity-log';
import * as ImagePicker from 'expo-image-picker';
import { generateGardenPdf } from '@/lib/garden-pdf';
import ProBanner from '@/components/ui/ProBanner';
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
  const { isDesktop } = useBreakpoint();
  const bg         = isDark ? colors.bg        : G.foam;
  const cardBg     = isDark ? colors.bgCard    : '#fff';
  const textPrim   = isDark ? colors.text      : '#2d6a4f';
  const textSec    = isDark ? colors.textSec   : '#52796f';
  const border     = isDark ? colors.border    : '#b7e4c7';
  const inputBg    = isDark ? colors.bgElement : '#f0f7ee';
  const router = useRouter();
  const { isPremium } = usePremium();
  const { width: screenWidth } = useWindowDimensions();
  const flatListRef = useRef<FlatList>(null);
  const arrowPulse = useRef(new Animated.Value(1)).current;

  const [gardens, setGardens] = useState<Garden[]>([]);
  const [sharedEntries, setSharedEntries] = useState<SharedEntry[]>([]);
  const [gardensLoaded, setGardensLoaded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Cache plants per garden so swiping back is instant
  const [plantsMap, setPlantsMap] = useState<Record<string, Plant[]>>({});

  const allGardens = useMemo(
    () => [...gardens, ...sharedEntries.map(e => e.garden)],
    [gardens, sharedEntries],
  );
  const selectedGarden = allGardens[currentIndex] ?? null;
  const plants = plantsMap[selectedGarden?.id ?? ''] ?? [];

  // Ref for synchronous garden context — set before any modal/handler runs on desktop
  const activeGardenRef = useRef<Garden | null>(null);
  function getActiveGarden(): Garden | null {
    return activeGardenRef.current ?? selectedGarden;
  }
  function getActivePlants(g?: Garden | null): Plant[] {
    const garden = g ?? getActiveGarden();
    return garden ? (plantsMap[garden.id] ?? []) : [];
  }
  function getActiveLayout(g?: Garden | null): GardenLayout | null {
    const garden = g ?? getActiveGarden();
    return garden ? layoutFromGarden(garden) : null;
  }

  // Per-garden display tile size overrides (desktop only)

  // Pulse the arrows continuously while multiple gardens exist
  useEffect(() => {
    if (allGardens.length < 2) return;
    const seq = Animated.sequence([
      Animated.delay(800),
      Animated.loop(
        Animated.sequence([
          Animated.timing(arrowPulse, { toValue: 0.45, duration: 600, useNativeDriver: true }),
          Animated.timing(arrowPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.delay(1200),
        ]),
      ),
    ]);
    seq.start();
    return () => seq.stop();
  }, [allGardens.length]);

  // New garden modal
  const [showNewGarden, setShowNewGarden] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSun, setNewSun] = useState<SunRequirement>('full_sun');

  // Place plant modal
  const [placement, setPlacement] = useState<PlacementInfo | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [placeSun, setPlaceSun] = useState<SunRequirement>('full_sun');
  const [placeWaterDays, setPlaceWaterDays] = useState(3);
  const [placeQuantity, setPlaceQuantity] = useState(1);
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [placeSelected, setPlaceSelected] = useState(false);

  const gardenLayout = selectedGarden ? layoutFromGarden(selectedGarden) : null; // mobile only

  // Plant action sheet (tap on planted tile)
  const [plantAction, setPlantAction] = useState<Plant | null>(null);
  const [showGardenHarvest, setShowGardenHarvest] = useState(false);
  const [gardenHarvestCount, setGardenHarvestCount] = useState(1);
  const [gardenHarvestNotes, setGardenHarvestNotes] = useState('');
  const [savingGardenHarvest, setSavingGardenHarvest] = useState(false);
  const [gardenUploading, setGardenUploading] = useState(false);

  // History modal
  const [showHistory, setShowHistory] = useState(false);
  const [historyLog, setHistoryLog] = useState<ActivityEntry[]>([]);

  // Share garden modal
  const [showShareGarden, setShowShareGarden] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareSaving, setShareSaving] = useState(false);

  async function doShareGarden() {
    const garden = getActiveGarden();
    if (!user || !garden || !shareEmail.trim()) return;
    const email = shareEmail.trim().toLowerCase();
    if (email === user.email?.toLowerCase()) {
      Alert.alert('That\'s you!', 'You can\'t share a garden with yourself.');
      return;
    }
    setShareSaving(true);
    try {
      const existing = await pb.collection('users').getList(1, 1, {
        filter: `email = "${email}"`,
        fields: 'id',
        requestKey: null,
      });
      if (existing.totalItems === 0) {
        Alert.alert('User not found', `No account exists for ${email}. They need to sign up first.`);
        setShareSaving(false);
        return;
      }
      await pb.collection('garden_shares').create({
        garden_id: garden.id,
        owner_id: user.id,
        shared_with_email: email,
        permission: 'edit',
      });
      Alert.alert('Shared!', `${garden.name} has been shared with ${email}.`);
      setShowShareGarden(false);
      setShareEmail('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not share garden');
    } finally {
      setShareSaving(false);
    }
  }

  // Edit garden modal
  const [showEditGarden, setShowEditGarden] = useState(false);
  const [editStep, setEditStep] = useState<'size' | 'shape' | 'sun' | 'location'>('size');
  const [editRows, setEditRows] = useState(6);
  const [editCols, setEditCols] = useState(8);
  const [editTileSize, setEditTileSize] = useState(DEFAULT_TILE_SIZE_IN); // stored in inches
  const [editLayout, setEditLayout] = useState<GardenLayout>(() => makeLayout(6, 8));
  const [editSaving, setEditSaving] = useState(false);
  const [editYear, setEditYear] = useState(new Date().getFullYear());
  const [editLocationQuery, setEditLocationQuery] = useState('');
  const [editLocationResults, setEditLocationResults] = useState<GeoResult[]>([]);
  const [editLocationSearching, setEditLocationSearching] = useState(false);
  const [editSelectedLocation, setEditSelectedLocation] = useState<Location | null>(null);

  useEffect(() => {
    if (!user) return;
    setGardensLoaded(false);

    const ownPromise = offlineList('gardens', user.id, `user_id = "${user.id}"`)
      .then((list) => {
        setGardens(sortGardens(list as any));
        // Preload plants for every garden so icons are ready immediately when switching
        for (const garden of list) {
          offlineList('plants', `${user.id}:${(garden as any).id}`, `garden_id = "${(garden as any).id}"`)
            .then(data => setPlantsMap(prev => ({ ...prev, [(garden as any).id]: data as any })))
            .catch(() => {});
        }
      })
      .catch(() => {});

    // Gardens shared with me — online only (sharing is a connected feature)
    const sharesPromise = pb.collection('garden_shares')
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
          // Load plants for this shared garden immediately
          const gid = (garden as any).id;
          offlineList('plants', `${user.id}:${gid}`, `garden_id = "${gid}"`)
            .then(data => setPlantsMap(prev => ({ ...prev, [gid]: data as any })))
            .catch(() => {});
        }
        setSharedEntries(entries.sort((a, b) => {
          const currentYear = new Date().getFullYear();
          const ya = yearFromGarden(a.garden) ?? currentYear;
          const yb = yearFromGarden(b.garden) ?? currentYear;
          if (yb !== ya) return yb - ya;
          return new Date((b.garden as any).created ?? 0).getTime() - new Date((a.garden as any).created ?? 0).getTime();
        }));
      })
      .catch(() => {});

    Promise.all([ownPromise, sharesPromise]).then(() => setGardensLoaded(true));
  }, [user]);

  // Load plants for a garden the first time it's visited
  const loadPlantsForGarden = useCallback((garden: Garden) => {
    if (plantsMap[garden.id]) return; // already cached
    offlineList('plants', `${user?.id ?? ''}:${garden.id}`, `garden_id = "${garden.id}"`)
      .then(data => setPlantsMap(prev => ({ ...prev, [garden.id]: data as any })))
      .catch(() => {});
  }, [plantsMap, user?.id]);

  async function createGarden() {
    if (!user || !newName.trim()) return;
    const { record: data } = await offlineCreate('gardens', user.id, {
      user_id: user.id, name: newName.trim(), rows: 6, cols: 8, sun_exposure: newSun,
    });
    setGardens(prev => {
      const next = [...prev, data as any];
      // Scroll to the new garden after state settles
      const newIdx = next.length - 1 + sharedEntries.length;
      setTimeout(() => {
        setCurrentIndex(newIdx);
        flatListRef.current?.scrollToIndex({ index: newIdx, animated: true });
      }, 50);
      return next;
    });
    setPlantsMap(prev => ({ ...prev, [(data as any).id]: [] }));
    setShowNewGarden(false);
    setNewName('');
    setNewSun('full_sun');
  }

  function getPlantAt(row: number, col: number) {
    return getActivePlants().find((p) => p.row === row && p.col === col);
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
    const tileSun = (getActiveLayout()?.[row]?.[col] ?? 'full_sun') as TileState;
    setPlacement({ row, col, neighbors, tileSun });
    setPlaceName('');
    setPlaceSelected(false);
    setCatalogueSearch('');
    setPlaceSun(tileSun === 'inactive' ? 'full_sun' : tileSun as SunRequirement);
    setPlaceWaterDays(3);
    setPlaceQuantity(1);
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
    const garden = getActiveGarden();
    if (!user || !garden || !placement || !placeName.trim()) return;
    const isSharedGarden = sharedEntries.some(e => e.garden.id === garden.id);
    if (!isPremium && !isSharedGarden) {
      const ownGardenIds = new Set(gardens.map(g => g.id));
      const ownPlantCount = Object.entries(plantsMap)
        .filter(([gid]) => ownGardenIds.has(gid))
        .reduce((sum, [, arr]) => sum + arr.length, 0);
      if (ownPlantCount >= FREE_LIMITS.plants) {
        setPlacement(null);
        router.push('/subscription' as any);
        return;
      }
    }
    const { record: data } = await offlineCreate('plants', user.id, {
      user_id: user.id,
      garden_id: garden.id,
      name: placeName.trim(),
      row: placement.row,
      col: placement.col,
      health_status: 'healthy',
      sun_requirement: placeSun,
      water_interval_days: placeWaterDays,
      quantity: placeQuantity > 1 ? placeQuantity : null,
      total_yield_grams: 0,
    });
    setPlantsMap(prev => ({
      ...prev,
      [garden.id]: [...(prev[garden.id] ?? []), data as any],
    }));
    emit('plants:changed');
    setPlacement(null);
    setPlaceSelected(false);
    setCatalogueSearch('');
  }

  // ── Plant quick actions (from grid tile) ─────────────────────────────────

  async function gardenMarkWatered() {
    if (!plantAction || !user) return;
    const now = new Date().toISOString();
    const id = plantAction.id;
    const gardenId = plantAction.garden_id;
    await offlineUpdate('plants', user.id, id, { last_watered: now });
    setPlantsMap(prev => ({
      ...prev,
      [gardenId]: (prev[gardenId] ?? []).map(p => p.id === id ? { ...p, last_watered: now } : p),
    }));
    addActivityEntryAsync(user.id, { type: 'water', plantId: id, plantName: plantAction.name, gardenId });
    setPlantAction(null);
    Alert.alert('Watered! 💧', `${plantAction.name} marked as watered.`);
  }

  async function gardenLogHarvest() {
    if (!user || !plantAction || gardenHarvestCount < 1 || savingGardenHarvest) return;
    setSavingGardenHarvest(true);
    const plant = plantAction;
    try {
      const autoNote = `${gardenHarvestCount} piece${gardenHarvestCount !== 1 ? 's' : ''} harvested`;
      const notes = gardenHarvestNotes.trim() || autoNote;
      await offlineCreate('harvests', user.id, {
        plant_id: plant.id, user_id: user.id, yield_grams: gardenHarvestCount, notes,
      });
      addActivityEntryAsync(user.id, {
        type: 'harvest', plantId: plant.id, plantName: plant.name,
        gardenId: plant.garden_id, grams: gardenHarvestCount, notes,
      });
      setShowGardenHarvest(false);
      setPlantAction(null);
      setGardenHarvestCount(1);
      setGardenHarvestNotes('');
      Alert.alert('Logged! 🧺', `${gardenHarvestCount} piece${gardenHarvestCount !== 1 ? 's' : ''} of ${plant.name} saved.`);
    } catch (e: any) {
      Alert.alert('Could not save harvest', e?.message ?? 'Please try again.');
    } finally {
      setSavingGardenHarvest(false);
    }
  }

  async function gardenAddPhoto() {
    if (!user || !plantAction) return;
    Alert.alert('Log Progress Photo', 'How would you like to add a photo?', [
      {
        text: '📷 Take Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access is required.'); return; }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
          if (!result.canceled && result.assets[0]) gardenUploadPhoto(result.assets[0].uri);
        },
      },
      {
        text: '🖼️ Choose from Library',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission needed', 'Photo library access is required.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
          if (!result.canceled && result.assets[0]) gardenUploadPhoto(result.assets[0].uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function gardenUploadPhoto(uri: string) {
    if (!user || !plantAction) return;
    const plant = plantAction;
    setGardenUploading(true);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('photo', blob as any, `photo_${Date.now()}.jpg`);
      } else {
        formData.append('photo', { uri, type: 'image/jpeg', name: `photo_${Date.now()}.jpg` } as any);
      }
      formData.append('plant_id', plant.id);
      formData.append('user_id', user.id);
      await pb.collection('plant_photos').create(formData);
      setPlantAction(null);
      Alert.alert('Saved! 📷', `Progress photo logged for ${plant.name}.`);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Unknown error');
    } finally {
      setGardenUploading(false);
    }
  }

  // ── Plant action handlers ─────────────────────────────────────────────────

  async function unplantPlant() {
    const garden = getActiveGarden();
    if (!plantAction || !garden || !user) return;
    await offlineUpdate('plants', user.id, plantAction.id, { row: null, col: null });
    const gid = garden.id;
    setPlantsMap(prev => ({ ...prev, [gid]: (prev[gid] ?? []).filter(p => p.id !== plantAction.id) }));
    setPlantAction(null);
    emit('plants:changed');
  }

  // ── Edit garden ───────────────────────────────────────────────────────────

  async function openEditGarden() {
    const garden = getActiveGarden();
    if (!garden) return;
    setEditRows(garden.rows);
    setEditCols(garden.cols);
    setEditTileSize(tileSizeInFromGarden(garden));
    setEditLayout(layoutFromGarden(garden));
    setEditStep('size');
    setEditYear(yearFromGarden(garden) ?? new Date().getFullYear());
    setEditLocationQuery('');
    setEditLocationResults([]);
    const savedLoc = await loadGardenLocation(garden);
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
    const garden = getActiveGarden();
    if (!garden) return;
    setEditSaving(true);
    try {
      const { record: updated } = await offlineUpdate('gardens', user?.id ?? '', garden.id, {
        rows: editRows,
        cols: editCols,
        layout: serializeLayout(editLayout, editTileSize * 2.54, editYear),
        location_json: editSelectedLocation ? JSON.stringify(editSelectedLocation) : null,
      });
      if (editSelectedLocation) {
        await saveGardenLocation(garden.id, editSelectedLocation);
        await saveLocation(editSelectedLocation);
      }
      setGardens(prev => prev.map(g => g.id === garden.id ? updated as any : g));
      setSharedEntries(prev => prev.map(e => e.garden.id === garden.id ? { ...e, garden: updated as any } : e));
      setShowEditGarden(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save changes');
    } finally {
      setEditSaving(false);
    }
  }

  // ── Delete garden ─────────────────────────────────────────────────────────

  function confirmDeleteGarden() {
    const garden = getActiveGarden();
    if (!garden) return;
    const gardenPlants = getActivePlants(garden);
    Alert.alert(
      'Delete Garden',
      `Delete "${garden.name}" and all ${gardenPlants.length} plant${gardenPlants.length !== 1 ? 's' : ''} in it? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          const gardenId = garden.id;
          await Promise.all(gardenPlants.map(p => offlineDelete('plants', user?.id ?? '', p.id).catch(() => {})));
          await offlineDelete('gardens', user?.id ?? '', gardenId).catch(() => {});
          activeGardenRef.current = null;
          setPlantsMap(prev => { const n = { ...prev }; delete n[gardenId]; return n; });
          setGardens(prev => prev.filter(g => g.id !== gardenId));
          setCurrentIndex(i => Math.max(0, i - 1));
        }},
      ],
    );
  }

  // ── History ───────────────────────────────────────────────────────────────

  async function openHistory() {
    const garden = getActiveGarden();
    if (!user || !garden) return;
    const all = await getActivityLogAsync(user.id);
    const gardenPlantIds = new Set(getActivePlants(garden).map(p => p.id));
    setHistoryLog(all.filter(e => e.gardenId === garden.id || gardenPlantIds.has(e.plantId)));
    setShowHistory(true);
  }

  // Build compatibility summary for placement modal
  function buildCompatSummary() {
    if (!placement || !placeName.trim()) return null;
    const tileSun = (placement.tileSun === 'inactive'
      ? (getActiveGarden()?.sun_exposure ?? 'full_sun')
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

  // Report preview state — set to show the preview modal before generating
  const [reportPreview, setReportPreview] = useState<{
    garden: Garden; plants: Plant[]; layout: GardenLayout | null;
  } | null>(null);
  const [reportMode, setReportMode] = useState<'single' | 'full'>('single');
  const [generatingReport, setGeneratingReport] = useState(false);

  // Render a single garden page inside the pager
  function renderGardenPage(garden: Garden) {
    const pageGardenLayout = layoutFromGarden(garden);
    const pagePlants = plantsMap[garden.id] ?? [];
    const sharedEntry = sharedEntries.find(e => e.garden.id === garden.id);
    const isOwned = !sharedEntry;
    const availableWidth = isDesktop ? Math.min(screenWidth - 280, 860) : screenWidth;
    const tileSize = Math.max(30, Math.min(56, Math.floor((availableWidth - 48) / garden.cols)));

    function getPagePlantAt(row: number, col: number) {
      return pagePlants.find(p => p.row === row && p.col === col);
    }

    return (
      <ScrollView
        style={isDesktop ? { flex: 1 } : { width: screenWidth }}
        contentContainerStyle={[styles.gridContainer, isDesktop && styles.gridContainerDesktop]}
        showsVerticalScrollIndicator={false}
      >
        {/* Garden header — title row, then buttons below */}
        <View style={styles.gardenHeader}>
          {/* Title row: full width, never truncated */}
          <View style={styles.gardenTitleRow}>
            <Text style={[styles.gardenName, { color: textPrim }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {garden.name}
            </Text>
            <View style={[styles.yearBadge, { backgroundColor: isDark ? colors.bgElement : G.dew, borderColor: isDark ? colors.border : G.mist }]}>
              <Text style={[styles.yearBadgeText, { color: textPrim }]}>{yearFromGarden(garden) ?? new Date().getFullYear()}</Text>
            </View>
            {sharedEntry && (
              <View style={styles.sharedBadge}>
                <Text style={styles.sharedBadgeText}>🤝 Shared</Text>
              </View>
            )}
          </View>

          {/* Meta line */}
          <Text style={[styles.gardenMeta, { color: textSec, marginBottom: 10 }]}>
            {SUN_EMOJIS[garden.sun_exposure as SunRequirement]}{' '}
            {SUN_LABELS[garden.sun_exposure as SunRequirement]} · {garden.rows}×{garden.cols}
            {sharedEntry ? ` · by ${sharedEntry.ownerEmail}` : ''}
          </Text>

          {/* Buttons row: always on its own line, scrolls if needed */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.headerActionsScroll}>
            <View style={styles.headerActions}>
              <GardenBtn emoji="📋" label="History" onPress={openHistory} />
              <GardenBtn emoji="📄" label="Print" onPress={() => {
                if (!isPremium && isOwned) { router.push('/subscription' as any); return; }
                setReportPreview({ garden, plants: pagePlants, layout: pageGardenLayout });
              }} />
              <GardenBtn emoji="✏️" label="Edit" onPress={openEditGarden} />
              {isOwned && (
                <>
                  {isPremium && (
                    <GardenBtn emoji="🤝" label="Share" onPress={() => { setShareEmail(''); setShowShareGarden(true); }} />
                  )}
                  <GardenBtn emoji="🗑" label="Delete" danger onPress={confirmDeleteGarden} />
                </>
              )}
            </View>
          </ScrollView>
        </View>

        {/* Grid — tiles scale to fill screen width, no horizontal scroll needed */}
        <View style={styles.gridWrapper}>
          {Array.from({ length: garden.rows }).map((_, row) => (
            <View key={row} style={styles.gridRow}>
              {Array.from({ length: garden.cols }).map((_, col) => {
                const plant = getPagePlantAt(row, col);
                const tileState = pageGardenLayout?.[row]?.[col] ?? 'inactive';
                const isInactive = tileState === 'inactive';
                const tileBg = plant
                  ? HEALTH_COLORS[plant.health_status]
                  : isInactive ? '#e0e6e3' : TILE_COLORS[tileState];
                return (
                  <TouchableOpacity
                    key={col}
                    style={[styles.cell, { width: tileSize, height: tileSize, backgroundColor: tileBg }, isInactive && styles.inactiveCell]}
                    onPress={() => !isInactive && handleCellTap(row, col)}
                    disabled={isInactive}
                  >
                    {plant ? (
                      <>
                        <Text style={[styles.cellEmoji, { fontSize: tileSize * 0.42 }]}>{getPlantIcon(plant.name).emoji}</Text>
                        {plant.quantity != null && plant.quantity > 1 && (
                          <View style={styles.quantityBadge}>
                            <Text style={styles.quantityBadgeText}>×{plant.quantity}</Text>
                          </View>
                        )}
                        {tileState !== 'inactive' && (
                          <Text style={styles.cellSunEmoji}>{TILE_EMOJIS[tileState]}</Text>
                        )}
                      </>
                    ) : !isInactive ? (
                      <Text style={[styles.cellPlus, { fontSize: tileSize * 0.35 }]}>+</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Legend */}
        <View style={styles.legendSection}>
          <Text style={styles.legendHeading}>Health</Text>
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
          <Text style={styles.legendHeading}>Sunlight</Text>
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
        <ProBanner />
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>

      {!gardensLoaded ? (
        // ── Loading state — wait for both own + shared gardens before deciding empty ─
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={G.sage} />
        </View>
      ) : allGardens.length === 0 ? (
        // ── Empty state ───────────────────────────────────────────────────────
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
      ) : isDesktop ? (
        <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={styles.desktopAllGardensContent} showsVerticalScrollIndicator={false}>
          {allGardens.map((garden, gardenIndex) => {
            const pageLayout = layoutFromGarden(garden);
            const pagePlants = plantsMap[garden.id] ?? [];
            const sharedEntry = sharedEntries.find(e => e.garden.id === garden.id);
            const isOwned = !sharedEntry;
            const tileSize = Math.max(28, Math.min(56, Math.floor((Math.min(screenWidth - 280, 860) - 48) / garden.cols)));

            function activate() {
              activeGardenRef.current = garden;
              setCurrentIndex(gardenIndex);
              if (!plantsMap[garden.id]) loadPlantsForGarden(garden);
            }

            return (
              <View key={garden.id} style={[styles.desktopGardenSection, { backgroundColor: isDark ? colors.bgCard : G.cloud, borderColor: border }]}>
                {/* Section header */}
                <View style={styles.desktopGardenSectionHeader}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.gardenTitleRow}>
                      <Text style={[styles.gardenName, { color: textPrim, fontSize: 20 }]} numberOfLines={1}>{garden.name}</Text>
                      <View style={[styles.yearBadge, { backgroundColor: isDark ? colors.bgElement : G.dew, borderColor: isDark ? colors.border : G.mist }]}>
                        <Text style={[styles.yearBadgeText, { color: textPrim }]}>{yearFromGarden(garden) ?? new Date().getFullYear()}</Text>
                      </View>
                      {sharedEntry && <View style={styles.sharedBadge}><Text style={styles.sharedBadgeText}>🤝 Shared</Text></View>}
                    </View>
                    <Text style={[styles.gardenMeta, { color: textSec }]}>
                      {SUN_EMOJIS[garden.sun_exposure as SunRequirement]} {SUN_LABELS[garden.sun_exposure as SunRequirement]} · {garden.rows}×{garden.cols}
                      {sharedEntry ? ` · by ${sharedEntry.ownerEmail}` : ''}
                      {' · '}{pagePlants.length} plant{pagePlants.length !== 1 ? 's' : ''}
                    </Text>
                  </View>

                  {/* Garden size display */}
                  <View style={styles.desktopTileSizeControl}>
                    <Text style={[styles.desktopTileSizeLabel, { color: textSec }]}>Garden size</Text>
                    <Text style={[styles.desktopTileSizeVal, { color: textPrim, minWidth: 0 }]}>
                      {formatTotalSize(garden.cols, garden.rows, tileSizeInFromGarden(garden))}
                    </Text>
                  </View>
                </View>

                {/* Action buttons */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.headerActionsScroll}>
                  <View style={[styles.headerActions, { paddingHorizontal: 16, paddingBottom: 12 }]}>
                    <GardenBtn emoji="📋" label="History" onPress={() => { activate(); openHistory(); }} />
                    <GardenBtn emoji="📄" label="Print" onPress={() => {
                      if (!isPremium && isOwned) { router.push('/subscription' as any); return; }
                      activate(); setReportPreview({ garden, plants: pagePlants, layout: pageLayout });
                    }} />
                    <GardenBtn emoji="✏️" label="Edit" onPress={() => { activate(); openEditGarden(); }} />
                    {isOwned && (
                      <>
                        {isPremium && (
                          <GardenBtn emoji="🤝" label="Share" onPress={() => { activate(); setShareEmail(''); setShowShareGarden(true); }} />
                        )}
                        <GardenBtn emoji="🗑" label="Delete" danger onPress={() => { activate(); confirmDeleteGarden(); }} />
                      </>
                    )}
                  </View>
                </ScrollView>

                {/* Grid */}
                <ScrollView horizontal showsHorizontalScrollIndicator={tileSize * garden.cols > screenWidth - 340}>
                  <View style={[styles.gridWrapper, { paddingHorizontal: 16, paddingBottom: 16 }]}>
                    {Array.from({ length: garden.rows }).map((_, row) => (
                      <View key={row} style={styles.gridRow}>
                        {Array.from({ length: garden.cols }).map((_, col) => {
                          const plant = pagePlants.find(p => p.row === row && p.col === col);
                          const tileState = pageLayout?.[row]?.[col] ?? 'inactive';
                          const isInactive = tileState === 'inactive';
                          const tileBg = plant
                            ? HEALTH_COLORS[plant.health_status]
                            : isInactive ? '#e0e6e3' : TILE_COLORS[tileState];
                          return (
                            <TouchableOpacity
                              key={col}
                              style={[styles.cell, { width: tileSize, height: tileSize, backgroundColor: tileBg }, isInactive && styles.inactiveCell]}
                              onPress={() => { if (!isInactive) { activate(); handleCellTap(row, col); } }}
                              disabled={isInactive}
                            >
                              {plant ? (
                                <>
                                  <Text style={[styles.cellEmoji, { fontSize: tileSize * 0.42 }]}>{getPlantIcon(plant.name).emoji}</Text>
                                  {tileState !== 'inactive' && <Text style={styles.cellSunEmoji}>{TILE_EMOJIS[tileState]}</Text>}
                                </>
                              ) : !isInactive ? (
                                <Text style={[styles.cellPlus, { fontSize: tileSize * 0.35 }]}>+</Text>
                              ) : null}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </ScrollView>

                {/* Legend */}
                <View style={[styles.desktopLegendRow, { borderTopColor: border, paddingHorizontal: 16 }]}>
                  <View style={styles.legend}>
                    {Object.entries(HEALTH_COLORS).map(([status, color]) => (
                      <View key={status} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: color }]} />
                        <Text style={[styles.legendLabel, { color: textSec }]}>{status.replace('_', ' ')}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={[styles.legend, { marginLeft: 24 }]}>
                    {SUN_CYCLE.map(s => (
                      <View key={s} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: TILE_COLORS[s] }]} />
                        <Text style={[styles.legendLabel, { color: textSec }]}>{TILE_LABELS[s]}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            );
          })}
          <View style={{ height: 80 }} />
        </ScrollView>
      ) : (
        <>
          {/* ── Horizontal garden pager — no overlapping buttons ───────────── */}
          <FlatList
            ref={flatListRef}
            data={allGardens}
            keyExtractor={g => g.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            initialNumToRender={1}
            maxToRenderPerBatch={1}
            windowSize={3}
            style={{ flex: 1 }}
            getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
            onMomentumScrollEnd={e => {
              const i = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
              if (i !== currentIndex) {
                setCurrentIndex(i);
                loadPlantsForGarden(allGardens[i]);
              }
            }}
            renderItem={({ item: garden }) => renderGardenPage(garden)}
          />

          {/* ── Bottom nav bar: arrows + dots + hint ──────────────────────── */}
          <View style={[styles.swipeBar, { backgroundColor: isDark ? colors.bgCard : '#fff', borderTopColor: border }]}>
            <TouchableOpacity
              style={[styles.navArrow, !currentIndex && styles.navArrowHidden]}
              disabled={currentIndex === 0}
              onPress={() => {
                const i = currentIndex - 1;
                setCurrentIndex(i);
                loadPlantsForGarden(allGardens[i]);
                flatListRef.current?.scrollToIndex({ index: i, animated: true });
              }}
            >
              <Text style={[styles.navArrowIcon, { color: textPrim }]}>‹</Text>
              {currentIndex > 0 && (
                <Text style={[styles.navArrowLabel, { color: textSec }]} numberOfLines={1}>
                  {allGardens[currentIndex - 1]?.name}
                </Text>
              )}
            </TouchableOpacity>

            <Animated.View style={[styles.navCenter, { opacity: allGardens.length > 1 ? arrowPulse : 1 }]}>
              <View style={styles.pageDots}>
                {allGardens.map((_, i) => (
                  <View key={i} style={[
                    styles.pageDot,
                    { backgroundColor: isDark ? colors.border : G.mist },
                    i === currentIndex && styles.pageDotActive,
                  ]} />
                ))}
              </View>
              {allGardens.length > 1 && (
                <Text style={[styles.swipeHint, { color: textSec }]}>
                  swipe to switch · {currentIndex + 1} of {allGardens.length}
                </Text>
              )}
            </Animated.View>

            <TouchableOpacity
              style={[styles.navArrow, styles.navArrowRight, currentIndex >= allGardens.length - 1 && styles.navArrowHidden]}
              disabled={currentIndex >= allGardens.length - 1}
              onPress={() => {
                const i = currentIndex + 1;
                setCurrentIndex(i);
                loadPlantsForGarden(allGardens[i]);
                flatListRef.current?.scrollToIndex({ index: i, animated: true });
              }}
            >
              {currentIndex < allGardens.length - 1 && (
                <Text style={[styles.navArrowLabel, { color: textSec }]} numberOfLines={1}>
                  {allGardens[currentIndex + 1]?.name}
                </Text>
              )}
              <Text style={[styles.navArrowIcon, { color: textPrim }]}>›</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── New Garden FAB ────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.fab, isDesktop && styles.fabDesktop, { backgroundColor: isPremium || gardens.length < FREE_LIMITS.gardens ? G.hunter : '#52796f' }]}
        onPress={() => {
          if (!isPremium && gardens.length >= FREE_LIMITS.gardens) {
            router.push('/subscription' as any);
          } else {
            router.push('/new-garden');
          }
        }}
      >
        <Text style={styles.fabIcon}>
          {!isPremium && gardens.length >= FREE_LIMITS.gardens ? '🔒' : '+'}
        </Text>
      </TouchableOpacity>

      {/* ── Report Preview Modal ──────────────────────────────────────── */}
      <Modal visible={!!reportPreview} transparent animationType="slide">
        <View style={[styles.modalBackdrop, isDesktop && styles.modalBackdropCenter]}>
          {!isDesktop && <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setReportPreview(null)} />}
          <View style={[styles.modal, { paddingTop: isDesktop ? 24 : 12, maxHeight: '88%', backgroundColor: cardBg }, isDesktop && styles.modalCenter]}>
            {!isDesktop && <View style={styles.modalHandle} />}
            <Text style={[styles.modalTitle, { color: textPrim }]}>📄 Print Garden Plan</Text>
            <Text style={[styles.fieldLabel, { color: textSec, marginBottom: 14 }]}>
              {reportPreview?.garden.name} · {yearFromGarden(reportPreview?.garden) ?? new Date().getFullYear()}
            </Text>

            {/* Mode picker */}
            <View style={[styles.reportModeRow, { marginBottom: 16 }]}>
              <TouchableOpacity
                style={[styles.reportModeCard, reportMode === 'single' && styles.reportModeCardActive, { backgroundColor: isDark ? colors.bgElement : '#f0f7ee', borderColor: reportMode === 'single' ? G.hunter : border }]}
                onPress={() => setReportMode('single')}
              >
                <View style={[styles.reportModeRadio, reportMode === 'single' && { borderColor: G.hunter, backgroundColor: G.hunter }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reportModeTitle, { color: textPrim }]}>Quick Overview</Text>
                  <Text style={[styles.reportModeDesc, { color: textSec }]}>1 page — grid + plant list + legend</Text>
                </View>
                <Text style={{ fontSize: 20 }}>🗺️</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reportModeCard, reportMode === 'full' && styles.reportModeCardActive, { backgroundColor: isDark ? colors.bgElement : '#f0f7ee', borderColor: reportMode === 'full' ? G.hunter : border }]}
                onPress={() => setReportMode('full')}
              >
                <View style={[styles.reportModeRadio, reportMode === 'full' && { borderColor: G.hunter, backgroundColor: G.hunter }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reportModeTitle, { color: textPrim }]}>Full Report</Text>
                  <Text style={[styles.reportModeDesc, { color: textSec }]}>
                    {2 + (reportPreview?.plants ?? []).filter(p => p.row != null).length} pages — grid, summary & per-plant cards
                  </Text>
                </View>
                <Text style={{ fontSize: 20 }}>📚</Text>
              </TouchableOpacity>
            </View>

            {/* Page list — only shown for full report */}
            {reportMode === 'full' && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
                {[
                  { page: 1, title: 'Garden Grid', desc: `${reportPreview?.garden.rows}×${reportPreview?.garden.cols} grid with health colors, sun indicators, and a legend.`, icon: '🗺️', accent: '#52b788' },
                  { page: 2, title: 'Plant Summary Table', desc: `${(reportPreview?.plants ?? []).filter(p => p.row != null).length} placed plants — position, health, water, sun, harvest date.`, icon: '📋', accent: '#339af0' },
                  ...(reportPreview?.plants ?? []).filter(p => p.row != null).map((p, i) => ({
                    page: i + 3,
                    title: p.name + (p.variety ? ` — ${p.variety}` : ''),
                    desc: `Sowing guide · companions · growing tips`,
                    icon: '🌱',
                    accent: '#a9e34b',
                  })),
                ].map(({ page, title, desc, icon, accent }) => (
                  <View key={page} style={[styles.previewPageRow, { borderLeftColor: accent }]}>
                    <View style={[styles.previewPageNum, { backgroundColor: accent }]}>
                      <Text style={styles.previewPageNumText}>{page}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.previewPageTitle, { color: textPrim }]}>{icon}  {title}</Text>
                      <Text style={[styles.previewPageDesc, { color: textSec }]}>{desc}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={[styles.modalButtons, { marginTop: 12 }]}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setReportPreview(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, generatingReport && { opacity: 0.6 }]}
                disabled={generatingReport}
                onPress={async () => {
                  if (!reportPreview) return;
                  setGeneratingReport(true);
                  try {
                    await generateGardenPdf(reportPreview.garden, reportPreview.plants, reportPreview.layout, reportMode);
                  } finally {
                    setGeneratingReport(false);
                    setReportPreview(null);
                  }
                }}
              >
                <Text style={styles.buttonText}>{generatingReport ? 'Printing…' : '📄 Print'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Plant Action Sheet ─────────────────────────────────────────── */}
      <Modal visible={!!plantAction && !showGardenHarvest} transparent animationType="slide">
        <View style={[styles.modalBackdrop, isDesktop && styles.modalBackdropCenter]}>
          {!isDesktop && <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPlantAction(null)} />}
          <View style={[styles.modal, { paddingTop: isDesktop ? 24 : 12, backgroundColor: cardBg }, isDesktop && styles.modalCenter]}>
            {!isDesktop && <View style={styles.modalHandle} />}
            <Text style={[styles.modalTitle, { color: textPrim }]}>{plantAction?.name ?? ''}</Text>
            <Text style={[styles.fieldLabel, { marginBottom: 14, color: textSec }]}>
              {plantAction?.health_status?.replace('_', ' ')} · {plantAction?.sun_requirement?.replace('_', ' ')}
              {plantAction?.quantity != null && plantAction.quantity > 1 ? ` · ${plantAction.quantity} plants` : ''}
            </Text>

            {/* Quick actions — same UI as plant details screen */}
            <View style={[styles.tileActionsBar, { borderColor: border }]}>
              <TouchableOpacity style={styles.tileActionBtn} onPress={gardenMarkWatered}>
                <Text style={styles.tileActionEmoji}>💧</Text>
                <Text style={[styles.tileActionLabel, { color: textPrim }]}>Water</Text>
              </TouchableOpacity>
              <View style={[styles.tileActionDivider, { backgroundColor: border }]} />
              <TouchableOpacity style={styles.tileActionBtn} onPress={() => setShowGardenHarvest(true)}>
                <Text style={styles.tileActionEmoji}>🧺</Text>
                <Text style={[styles.tileActionLabel, { color: textPrim }]}>Harvest</Text>
              </TouchableOpacity>
              <View style={[styles.tileActionDivider, { backgroundColor: border }]} />
              <TouchableOpacity style={styles.tileActionBtn} onPress={gardenAddPhoto} disabled={gardenUploading}>
                <Text style={styles.tileActionEmoji}>{gardenUploading ? '⏳' : '📷'}</Text>
                <Text style={[styles.tileActionLabel, { color: textPrim }]}>Progress</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.actionRow, { borderBottomColor: isDark ? colors.border : undefined, marginTop: 8 }]} onPress={() => {
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

      {/* ── Garden Harvest Modal ───────────────────────────────────────── */}
      <Modal visible={showGardenHarvest} transparent animationType="slide">
        <View style={[styles.modalBackdrop, isDesktop && styles.modalBackdropCenter]}>
          {!isDesktop && <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowGardenHarvest(false)} />}
          <View style={[styles.modal, { paddingTop: isDesktop ? 24 : 12, backgroundColor: cardBg }, isDesktop && styles.modalCenter]}>
            {!isDesktop && <View style={styles.modalHandle} />}
            <Text style={[styles.modalTitle, { color: textPrim }]}>🧺 Log Harvest — {plantAction?.name ?? ''}</Text>

            <View style={styles.harvestStepper}>
              <TouchableOpacity style={styles.harvestStepBtn} onPress={() => setGardenHarvestCount(v => Math.max(1, v - 1))}>
                <Text style={styles.harvestStepBtnText}>−</Text>
              </TouchableOpacity>
              <View style={styles.harvestStepValueWrap}>
                <Text style={[styles.harvestStepValue, { color: textPrim }]}>{gardenHarvestCount}</Text>
                <Text style={[styles.harvestStepUnit, { color: textSec }]}>{gardenHarvestCount === 1 ? 'piece' : 'pieces'}</Text>
              </View>
              <TouchableOpacity style={styles.harvestStepBtn} onPress={() => setGardenHarvestCount(v => v + 1)}>
                <Text style={styles.harvestStepBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.modalInput, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
              placeholder="Notes (optional)"
              placeholderTextColor={textSec}
              value={gardenHarvestNotes}
              onChangeText={setGardenHarvestNotes}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowGardenHarvest(false)} disabled={savingGardenHarvest}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, savingGardenHarvest && { opacity: 0.5 }]}
                onPress={gardenLogHarvest}
                disabled={savingGardenHarvest}
              >
                <Text style={styles.confirmBtnText}>{savingGardenHarvest ? 'Saving…' : 'Log Harvest'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit Garden Modal ──────────────────────────────────────────── */}
      <Modal visible={showEditGarden} transparent animationType="slide">
        <KeyboardAvoidingView style={[styles.modalBackdrop, isDesktop && styles.modalBackdropCenter]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {!isDesktop && <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowEditGarden(false)} />}
          <View style={[styles.modal, { paddingTop: isDesktop ? 24 : 12, maxHeight: '85%', backgroundColor: cardBg }, isDesktop && styles.modalCenter]}>
            {!isDesktop && <View style={styles.modalHandle} />}

            {/* Year selector — always visible at top of edit modal */}
            <View style={[styles.editYearRow, { borderBottomColor: border }]}>
              <Text style={[styles.editYearLabel, { color: textSec }]}>Season Year</Text>
              <View style={styles.editYearControls}>
                <TouchableOpacity style={styles.editYearBtn} onPress={() => setEditYear(y => y - 1)}>
                  <Text style={[styles.stepBtnText, { color: textPrim }]}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.editYearValue, { color: textPrim }]}>{editYear}</Text>
                <TouchableOpacity style={styles.editYearBtn} onPress={() => setEditYear(y => y + 1)}>
                  <Text style={[styles.stepBtnText, { color: textPrim }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

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

                  {/* Tile size */}
                  <View style={[styles.tileSizeSection, { borderTopColor: isDark ? colors.border : G.mist }]}>
                    <Text style={[styles.editHint, { marginBottom: 4 }]}>Tile size — sets the real-world size of each square.</Text>
                    <EditStepper
                      label="Tile size"
                      value={editTileSize}
                      min={TILE_SIZE_MIN_IN}
                      max={TILE_SIZE_MAX_IN}
                      step={TILE_SIZE_STEP_IN}
                      onChange={d => setEditTileSize(v => Math.max(TILE_SIZE_MIN_IN, Math.min(TILE_SIZE_MAX_IN, v + d)))}
                      unit={formatTileSize(editTileSize)}
                      hideValue
                    />
                    <View style={[styles.tileSizeSummary, { backgroundColor: isDark ? colors.bgElement : '#f0f7ee', borderColor: isDark ? colors.border : G.mist }]}>
                      <Text style={[styles.tileSizeSummaryRow, { color: textPrim }]}>
                        📐 Total: {formatTotalSize(editCols, editRows, editTileSize)}
                      </Text>
                      <Text style={[styles.tileSizeSummaryRow, { color: textSec }]}>
                        Each tile: {formatTileSize(editTileSize)} × {formatTileSize(editTileSize)}
                      </Text>
                    </View>
                  </View>
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
        </KeyboardAvoidingView>
      </Modal>

      {/* Share Garden Modal */}
      <Modal visible={showShareGarden} transparent animationType="fade">
        <KeyboardAvoidingView
          style={[styles.modalBackdrop, styles.modalBackdropCenter]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowShareGarden(false)} />
          <View style={[styles.modal, { paddingTop: 24, paddingBottom: 24, backgroundColor: cardBg }, styles.modalCenter]}>

            <Text style={[styles.modalTitle, { color: textPrim }]}>🤝 Share Garden</Text>
            <Text style={[styles.fieldLabel, { color: textSec, marginBottom: 8 }]}>
              Share "{getActiveGarden()?.name ?? 'Garden'}" — enter the email address of the person you want to invite.
              They'll see this garden in their garden tab and can make edits.
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
              placeholder="friend@example.com"
              placeholderTextColor={textSec}
              value={shareEmail}
              onChangeText={setShareEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoFocus
              onSubmitEditing={doShareGarden}
            />
            <View style={[styles.modalButtons, { marginTop: 16 }]}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowShareGarden(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, (!shareEmail.trim() || shareSaving) && { opacity: 0.5 }]}
                onPress={doShareGarden}
                disabled={!shareEmail.trim() || shareSaving}
              >
                <Text style={styles.buttonText}>{shareSaving ? 'Sharing…' : 'Share Garden'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* New Garden Modal */}
      <Modal visible={showNewGarden} transparent animationType="slide">
        <View style={[styles.modalBackdrop, isDesktop && styles.modalBackdropCenter]}>
          <View style={[styles.modal, { paddingTop: isDesktop ? 24 : 12, backgroundColor: cardBg }, isDesktop && styles.modalCenter]}>
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
          style={[styles.modalBackdrop, isDesktop && styles.modalBackdropCenter]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {!isDesktop && <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPlacement(null)} />}

          <View style={[styles.modal, { paddingTop: isDesktop ? 24 : 12, backgroundColor: cardBg }, isDesktop && styles.modalCenter]}>
            {!isDesktop && <View style={styles.modalHandle} />}

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

                  {/* Companion suggestions — hidden while searching so results appear at top */}
                  {!catalogueSearch.trim() && (() => {
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

                  {/* Quantity */}
                  <View style={styles.waterRow}>
                    <Text style={styles.fieldLabel}>Quantity</Text>
                    <View style={styles.waterStepper}>
                      <TouchableOpacity style={styles.stepBtn} onPress={() => setPlaceQuantity((q) => Math.max(1, q - 1))}>
                        <Text style={styles.stepBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepValue}>{placeQuantity} plant{placeQuantity !== 1 ? 's' : ''}</Text>
                      <TouchableOpacity style={styles.stepBtn} onPress={() => setPlaceQuantity((q) => Math.min(99, q + 1))}>
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
        <View style={[styles.modalBackdrop, isDesktop && styles.modalBackdropCenter]}>
          {!isDesktop && <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowHistory(false)} />}
          <View style={[styles.modal, { paddingTop: isDesktop ? 24 : 12, maxHeight: '80%', backgroundColor: cardBg }, isDesktop && styles.modalCenter]}>
            {!isDesktop && <View style={styles.modalHandle} />}
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

    </View>
  );
}

// ── Edit garden sub-components ───────────────────────────────────────────────

function EditStepper({ label, value, min, max, step = 1, unit, hideValue, onChange }: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; hideValue?: boolean; onChange: (d: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, backgroundColor: G.foam, borderRadius: R.lg, padding: 14 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: G.forest }}>{label}</Text>
        {unit && !hideValue ? <Text style={{ fontSize: 12, color: G.stone, marginTop: 1 }}>{value} {unit}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <TouchableOpacity
          style={{ width: 34, height: 34, borderRadius: R.full, backgroundColor: G.dew, justifyContent: 'center', alignItems: 'center' }}
          onPress={() => onChange(-step)} disabled={value <= min}
        >
          <Text style={{ fontSize: 20, color: G.hunter, lineHeight: 22 }}>−</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: hideValue ? 15 : 20, fontWeight: '800', color: G.forest, minWidth: hideValue ? 52 : 28, textAlign: 'center' }}>
          {hideValue ? unit : value}
        </Text>
        <TouchableOpacity
          style={{ width: 34, height: 34, borderRadius: R.full, backgroundColor: G.dew, justifyContent: 'center', alignItems: 'center' }}
          onPress={() => onChange(step)} disabled={value >= max}
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

function GardenBtn({ emoji, label, onPress, danger = false }: {
  emoji: string; label: string; onPress: () => void; danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[gardenBtnStyles.btn, danger && gardenBtnStyles.danger]}
      onPress={onPress}
    >
      <Text style={gardenBtnStyles.emoji}>{emoji}</Text>
      <Text style={[gardenBtnStyles.label, danger && gardenBtnStyles.dangerLabel]}>{label}</Text>
    </TouchableOpacity>
  );
}

const gardenBtnStyles = StyleSheet.create({
  btn:         { alignItems: 'center', paddingHorizontal: 9, paddingVertical: 6, borderRadius: R.sm, backgroundColor: G.dew, borderWidth: 1, borderColor: G.mist, minWidth: 48 },
  danger:      { backgroundColor: '#fff5f5', borderColor: '#ffc9c9' },
  emoji:       { fontSize: 14, lineHeight: 18 },
  label:       { fontSize: 9, fontWeight: '700', color: G.hunter, marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.3 },
  dangerLabel: { color: '#e03131' },
});

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: G.foam },
  fab:          { position: 'absolute', bottom: 68, right: 18, width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', ...Shadow.card, zIndex: 10 },
  fabDesktop:   { bottom: 24, right: 32 },
  gridContainerDesktop: { maxWidth: 960, width: '100%', alignSelf: 'center', paddingBottom: 60 },
  desktopAllGardensContent: { padding: 24, gap: 24, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  desktopGardenSection: { borderRadius: R.lg, borderWidth: 1, overflow: 'hidden' },
  desktopGardenSectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, padding: 16, paddingBottom: 8 },
  desktopTileSizeControl: { alignItems: 'flex-end', flexShrink: 0 },
  desktopTileSizeLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  desktopTileSizeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  desktopTileSizeBtn: { width: 28, height: 28, borderRadius: R.full, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  desktopTileSizeBtnText: { fontSize: 16, lineHeight: 18, fontWeight: '600' },
  desktopTileSizeVal: { fontSize: 13, fontWeight: '700', minWidth: 36, textAlign: 'center' },
  desktopLegendRow: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 10, borderTopWidth: 1 },
  fabIcon:      { fontSize: 28, color: '#fff', lineHeight: 32, fontWeight: '300' },
  emptyTitle:   { fontSize: 22, fontWeight: '800', color: G.forest, marginBottom: 8, marginTop: 8 },
  emptySub:     { fontSize: 15, color: G.stone, textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  emptyBtn:     { borderRadius: R.lg, overflow: 'hidden', ...Shadow.card },
  emptyBtnGradient: { paddingVertical: 15, paddingHorizontal: 28 },
  emptyBtnText: { color: G.cloud, fontWeight: '700', fontSize: 16 },
  inactiveCell: { opacity: 0.35 },

  navCenter:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navArrow:       { flexDirection: 'row', alignItems: 'center', minWidth: 64, paddingHorizontal: 8 },
  navArrowRight:  { justifyContent: 'flex-end' },
  navArrowHidden: { opacity: 0, pointerEvents: 'none' } as any,
  navArrowIcon:   { fontSize: 28, fontWeight: '300', lineHeight: 32, color: G.hunter },
  navArrowLabel:  { fontSize: 11, fontWeight: '600', maxWidth: 72 },
  pageDots:      { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pageDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: G.mist },
  pageDotActive: { width: 22, height: 8, borderRadius: 4, backgroundColor: G.hunter },
  swipeHint:     { fontSize: 10, fontWeight: '600', marginTop: 4, letterSpacing: 0.2 },
  // Bottom nav bar
  swipeBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1 },

  sharedBadge:    { backgroundColor: '#e7f5ff', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  sharedBadgeText:{ fontSize: 11, color: '#1971c2', fontWeight: '600' },
  yearBadge:      { borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  yearBadgeText:  { fontSize: 13, fontWeight: '700' },
  // Edit modal year row
  editYearRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, marginBottom: 12, borderBottomWidth: 1 },
  editYearLabel:  { fontSize: 14, fontWeight: '600' },
  editYearControls:{ flexDirection: 'row', alignItems: 'center', gap: 16 },
  editYearBtn:    { width: 34, height: 34, borderRadius: R.full, backgroundColor: G.dew, justifyContent: 'center', alignItems: 'center' },
  editYearValue:  { fontSize: 22, fontWeight: '800', minWidth: 56, textAlign: 'center' },
  gridContainer:  { padding: 16, paddingBottom: 40 },
  gridWrapper:    { alignItems: 'center', marginBottom: 12 },
  gardenHeader:   { flexDirection: 'column', marginBottom: 16 },
  gardenTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  headerActionsScroll: { flexGrow: 0 },
  gardenName: { fontSize: 24, fontWeight: '800', color: '#2d6a4f', flex: 1, letterSpacing: -0.3 },
  gardenMeta: { fontSize: 13, color: '#52796f', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 6 },
  headerBtn: { borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: G.dew, borderWidth: 1, borderColor: G.mist },
  headerBtnText: { fontSize: 12, fontWeight: '600', color: G.hunter },
  headerBtnDanger: { backgroundColor: '#fff5f5', borderColor: '#ffc9c9' },
  headerBtnDangerText: { fontSize: 14 },
  // Report preview
  reportModeRow:       { gap: 8 },
  reportModeCard:      { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: R.md, borderWidth: 2, padding: 12 },
  reportModeCardActive:{ },
  reportModeRadio:     { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: G.mist, flexShrink: 0 },
  reportModeTitle:     { fontSize: 14, fontWeight: '700' },
  reportModeDesc:      { fontSize: 11, marginTop: 1 },
  previewPageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12, paddingLeft: 12, borderLeftWidth: 3, borderRadius: 2 },
  previewPageNum: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 2 },
  previewPageNumText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  previewPageTitle: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  previewPageDesc: { fontSize: 12, lineHeight: 17 },
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
  quantityBadge: { position: 'absolute', top: 1, right: 2, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 6, paddingHorizontal: 3, paddingVertical: 1 },
  quantityBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700', lineHeight: 12 },

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
  tileSizeSection: { marginTop: 18, paddingTop: 18, borderTopWidth: 1 },
  tileSizeSummary: { borderRadius: R.md, borderWidth: 1, padding: 12, marginTop: 4 },
  tileSizeSummaryRow: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
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
  modalBackdropCenter: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 32,
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    paddingTop: 12,
  },
  modalCenter: {
    width: '100%',
    maxWidth: 600,
    borderRadius: 20,
    paddingBottom: 24,
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

  // Tile quick actions bar
  tileActionsBar: {
    flexDirection: 'row', borderRadius: R.lg, borderWidth: 1,
    overflow: 'hidden', marginBottom: 4,
  },
  tileActionBtn:      { flex: 1, paddingVertical: 14, alignItems: 'center', gap: 4 },
  tileActionDivider:  { width: 1, marginVertical: 10 },
  tileActionEmoji:    { fontSize: 20 },
  tileActionLabel:    { fontSize: 11, fontWeight: '600', textAlign: 'center' },

  // Garden harvest modal stepper
  harvestStepper:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 20 },
  harvestStepBtn:     { width: 48, height: 48, borderRadius: 24, backgroundColor: G.dew, justifyContent: 'center', alignItems: 'center' },
  harvestStepBtnText: { fontSize: 26, fontWeight: '300', color: G.hunter, lineHeight: 30 },
  harvestStepValueWrap:{ alignItems: 'center', minWidth: 90 },
  harvestStepValue:   { fontSize: 36, fontWeight: '800' },
  harvestStepUnit:    { fontSize: 13, marginTop: 2 },
  modalInput: {
    borderRadius: R.md, padding: 14, fontSize: 16, borderWidth: 1.5, marginBottom: 12,
  },
  confirmBtn:     { backgroundColor: G.hunter, borderRadius: R.md, paddingHorizontal: 24, paddingVertical: 12 },
  confirmBtnText: { color: G.cloud, fontWeight: '600', fontSize: 15 },
});
