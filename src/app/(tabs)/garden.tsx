import { useEffect, useState } from 'react';
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
import {
  layoutFromGarden, makeLayout, resizeLayout,
  TILE_COLORS, TILE_LABELS, TILE_EMOJIS, SUN_CYCLE, activeCount,
} from '@/lib/garden-layout';
import type { TileState, GardenLayout } from '@/lib/garden-layout';
import type { Garden, Plant } from '@/lib/types';
import type { SunRequirement } from '@/lib/plant-catalog';
import {
  findPlantKey, getCompatibility, getSunCompatibility,
  PLANT_CATALOG, SUN_LABELS, SUN_EMOJIS, searchPlants,
} from '@/lib/plant-catalog';
import type { CatalogEntry } from '@/lib/plant-catalog';

const HEALTH_COLORS: Record<string, string> = {
  healthy: '#52b788',
  needs_water: '#74c0fc',
  sick: '#ffa94d',
  harvested: '#a9e34b',
  dead: '#adb5bd',
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
  const [placeSuggestions, setPlaceSuggestions] = useState<Array<{ key: string; entry: CatalogEntry }>>([]);

  const gardenLayout = selectedGarden ? layoutFromGarden(selectedGarden) : null;

  // Plant action sheet (tap on planted tile)
  const [plantAction, setPlantAction] = useState<Plant | null>(null);

  // Edit garden modal
  const [showEditGarden, setShowEditGarden] = useState(false);
  const [editStep, setEditStep] = useState<'size' | 'shape' | 'sun'>('size');
  const [editRows, setEditRows] = useState(6);
  const [editCols, setEditCols] = useState(8);
  const [editLayout, setEditLayout] = useState<GardenLayout>(() => makeLayout(6, 8));
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Own gardens
    pb.collection('gardens')
      .getFullList({ filter: `user_id = "${user.id}"` })
      .then((list) => {
        setGardens(list as any);
        if (list.length > 0) setSelectedGarden(list[0] as any);
      });

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
    setPlaceSuggestions([]);
    setPlaceSun(tileSun === 'inactive' ? 'full_sun' : tileSun as SunRequirement);
    setPlaceWaterDays(3);
  }

  function onPlaceNameChange(name: string) {
    setPlaceName(name);
    const key = findPlantKey(name);
    const entry = key ? PLANT_CATALOG[key] : null;
    if (entry) {
      setPlaceSun(entry.sunRequirement);
      setPlaceWaterDays(entry.waterIntervalDays);
    }
    setPlaceSuggestions(name.length > 1 ? searchPlants(name, 5) : []);
  }

  function selectPlaceSuggestion(entry: CatalogEntry) {
    setPlaceName(entry.name);
    setPlaceSun(entry.sunRequirement);
    setPlaceWaterDays(entry.waterIntervalDays);
    setPlaceSuggestions([]);
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
    setPlacement(null);
    setPlaceSuggestions([]);
  }

  // ── Plant action handlers ─────────────────────────────────────────────────

  async function unplantPlant() {
    if (!plantAction) return;
    await pb.collection('plants').update(plantAction.id, { row: null, col: null });
    setPlants(prev => prev.filter(p => p.id !== plantAction.id));
    setPlantAction(null);
  }

  function confirmDeletePlant() {
    if (!plantAction) return;
    Alert.alert(
      'Delete Plant',
      `Permanently delete "${plantAction.name}"? This removes all its data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          await pb.collection('plants').delete(plantAction.id).catch(() => {});
          setPlants(prev => prev.filter(p => p.id !== plantAction.id));
          setPlantAction(null);
        }},
      ],
    );
  }

  // ── Edit garden ───────────────────────────────────────────────────────────

  function openEditGarden() {
    if (!selectedGarden) return;
    setEditRows(selectedGarden.rows);
    setEditCols(selectedGarden.cols);
    setEditLayout(layoutFromGarden(selectedGarden));
    setEditStep('size');
    setShowEditGarden(true);
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
      });
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
    <View style={styles.container}>
      {/* Garden selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gardenPicker}>
        {gardens.map((g) => (
          <TouchableOpacity
            key={g.id}
            style={[styles.gardenChip, selectedGarden?.id === g.id && styles.gardenChipActive]}
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
            style={[styles.gardenChip, styles.gardenChipShared, selectedGarden?.id === g.id && styles.gardenChipActive]}
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
        <TouchableOpacity style={styles.gardenChip} onPress={() => router.push('/new-garden')}>
          <Text style={styles.gardenChipText}>+ New</Text>
        </TouchableOpacity>
      </ScrollView>

      {selectedGarden ? (
        <ScrollView contentContainerStyle={styles.gridContainer}>
          {(() => {
            const sharedEntry = sharedEntries.find(e => e.garden.id === selectedGarden.id);
            const isOwned = !sharedEntry;
            return (
              <View style={styles.gardenHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={styles.gardenName}>{selectedGarden.name}</Text>
                    {sharedEntry && (
                      <View style={styles.sharedBadge}>
                        <Text style={styles.sharedBadgeText}>🤝 Shared</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.gardenMeta}>
                    {SUN_EMOJIS[selectedGarden.sun_exposure as SunRequirement]}{' '}
                    {SUN_LABELS[selectedGarden.sun_exposure as SunRequirement]} · {selectedGarden.rows}×{selectedGarden.cols}
                    {sharedEntry ? ` · by ${sharedEntry.ownerEmail}` : ''}
                  </Text>
                </View>
                {isOwned && (
                  <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.headerBtn} onPress={openEditGarden}>
                      <Text style={styles.headerBtnText}>✏️ Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.headerBtn, styles.headerBtnDanger]} onPress={confirmDeleteGarden}>
                      <Text style={styles.headerBtnDangerText}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })()}

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                              <Text style={styles.cellText} numberOfLines={1}>{plant.name.slice(0, 5)}</Text>
                              {/* Tile-sun dot in bottom-right — distinct from health color */}
                              {tileState !== 'inactive' && (
                                <View style={[styles.cellSunDot, { backgroundColor: TILE_COLORS[tileState] }]} />
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
                  <Text style={styles.legendLabel}>{status.replace('_', ' ')}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.legendSection}>
            <Text style={styles.legendHeading}>Tile sunlight (dot in corner)</Text>
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
          <View style={[styles.modal, { paddingTop: 12 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{plantAction?.name ?? ''}</Text>
            <Text style={[styles.fieldLabel, { marginBottom: 16 }]}>
              {plantAction?.health_status?.replace('_', ' ')} · {plantAction?.sun_requirement?.replace('_', ' ')}
            </Text>

            <TouchableOpacity style={styles.actionRow} onPress={() => {
              const p = plantAction; setPlantAction(null);
              if (p) router.push(`/plant/${p.id}`);
            }}>
              <Text style={styles.actionRowText}>👁  View Plant Details</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={unplantPlant}>
              <Text style={styles.actionRowText}>⬜  Remove from Garden Grid</Text>
              <Text style={styles.actionRowSub}>Plant stays in your Plants list</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionRow, styles.actionRowDanger]} onPress={confirmDeletePlant}>
              <Text style={[styles.actionRowText, { color: '#c0392b' }]}>🗑  Delete Plant Permanently</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setPlantAction(null)} style={styles.actionCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Edit Garden Modal ──────────────────────────────────────────── */}
      <Modal visible={showEditGarden} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowEditGarden(false)} />
          <View style={[styles.modal, { paddingTop: 12, maxHeight: '85%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.editStepTabs}>
              {(['size', 'shape', 'sun'] as const).map((s, i) => (
                <TouchableOpacity
                  key={s} style={[styles.editTab, editStep === s && styles.editTabActive]}
                  onPress={() => setEditStep(s)}
                >
                  <Text style={[styles.editTabText, editStep === s && styles.editTabTextActive]}>
                    {['📐 Size', '🗺️ Shape', '☀️ Sun'][i]}
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
            </ScrollView>

            <View style={[styles.modalButtons, { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f7ee' }]}>
              <TouchableOpacity onPress={() => setShowEditGarden(false)}>
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
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New Garden</Text>
            <TextInput
              style={styles.input}
              placeholder="Garden name"
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <Text style={styles.fieldLabel}>Sun exposure</Text>
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
              <TouchableOpacity onPress={() => setShowNewGarden(false)}>
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
          {/* Tap-to-dismiss area above the card */}
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPlacement(null)} />

          <View style={styles.modal}>
            {/* Drag handle */}
            <View style={styles.modalHandle} />

            {/* Scrollable content */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
              style={styles.modalScroll}
            >
              <View style={styles.modalTitleRow}>
                <Text style={styles.modalTitle}>Plant Here</Text>
                <Text style={styles.modalTileSun}>
                  Tile: {placement?.tileSun && placement.tileSun !== 'inactive'
                    ? `${SUN_EMOJIS[placement.tileSun as SunRequirement]} ${SUN_LABELS[placement.tileSun as SunRequirement]}`
                    : '—'
                  }
                </Text>
              </View>

              {/* Sun mismatch error */}
              {compatSummary?.sunCompat === 'mismatch' && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>
                    ⛔ Sun mismatch — {compatSummary.plantInfo?.name} needs{' '}
                    {SUN_LABELS[compatSummary.plantInfo!.sunRequirement]}, but this tile gets{' '}
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

              {/* Bad companion error */}
              {compatSummary?.overall === 'stop' && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>
                    ⛔ Bad companions nearby:{' '}
                    {compatSummary.neighborResults
                      .filter(r => r.compat === 'bad')
                      .map(r => r.neighbor.name)
                      .join(', ')}
                  </Text>
                </View>
              )}

              <TextInput
                style={styles.input}
                placeholder="What are you planting? (e.g. Tomato)"
                value={placeName}
                onChangeText={onPlaceNameChange}
                autoFocus
              />

              {/* Catalog suggestions */}
              {placeSuggestions.length > 0 && (
                <View style={styles.suggestions}>
                  {placeSuggestions.map(({ key, entry }) => (
                    <TouchableOpacity
                      key={key}
                      style={styles.suggestionRow}
                      onPress={() => selectPlaceSuggestion(entry)}
                    >
                      <Text style={styles.suggestionName}>{entry.name}</Text>
                      <Text style={styles.suggestionMeta}>
                        {SUN_EMOJIS[entry.sunRequirement]} {entry.sunRequirement.replace('_', ' ')} · 💧 every {entry.waterIntervalDays}d
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Sun requirement */}
              <Text style={styles.fieldLabel}>Sun requirement</Text>
              <View style={styles.sunRow}>
                {SUN_OPTIONS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.sunChip, placeSun === s && styles.sunChipActive]}
                    onPress={() => setPlaceSun(s)}
                  >
                    <Text style={styles.sunChipText}>{SUN_EMOJIS[s]} {s.replace('_', ' ')}</Text>
                  </TouchableOpacity>
                ))}
              </View>

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
              {placeName.trim().length > 1 && (
                <View style={styles.analysisBox}>
                  <Text style={styles.analysisTitle}>Planting Analysis</Text>

                  {/* Sun match */}
                  {compatSummary?.sunCompat ? (
                    <View style={styles.analysisRow}>
                      <Text style={styles.analysisEmoji}>
                        {compatSummary.sunCompat === 'match' ? '✅' : compatSummary.sunCompat === 'tolerable' ? '⚠️' : '❌'}
                      </Text>
                      <View style={styles.analysisText}>
                        <Text style={styles.analysisLabel}>Sun</Text>
                        <Text style={styles.analysisSub}>
                          {compatSummary.plantInfo
                            ? `Needs ${SUN_LABELS[compatSummary.plantInfo.sunRequirement]}, garden gets ${SUN_LABELS[(selectedGarden?.sun_exposure ?? 'full_sun') as SunRequirement]}`
                            : `Garden gets ${SUN_LABELS[(selectedGarden?.sun_exposure ?? 'full_sun') as SunRequirement]}`}
                          {compatSummary.sunCompat === 'mismatch' && ' — not ideal'}
                          {compatSummary.sunCompat === 'tolerable' && ' — manageable'}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.analysisRow}>
                      <Text style={styles.analysisEmoji}>
                        {getSunCompatibility(placeSun, (selectedGarden?.sun_exposure ?? 'full_sun') as SunRequirement) === 'match' ? '✅' : '⚠️'}
                      </Text>
                      <View style={styles.analysisText}>
                        <Text style={styles.analysisLabel}>Sun</Text>
                        <Text style={styles.analysisSub}>
                          Garden gets {SUN_LABELS[selectedGarden?.sun_exposure as SunRequirement ?? 'full_sun']}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Companion notes */}
                  {compatSummary?.plantInfo?.notes && (
                    <View style={[styles.analysisRow, { marginTop: 4 }]}>
                      <Text style={styles.analysisEmoji}>💡</Text>
                      <Text style={[styles.analysisSub, { flex: 1 }]}>{compatSummary.plantInfo.notes}</Text>
                    </View>
                  )}

                  {/* Neighbors */}
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

                      {/* Overall verdict */}
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
              )}

            </ScrollView>

            {/* Buttons pinned outside scroll — always visible above keyboard */}
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setPlacement(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.button,
                  !placeName.trim() && styles.buttonDisabled,
                  compatSummary?.sunCompat === 'mismatch' || compatSummary?.overall === 'stop'
                    ? styles.buttonDanger
                    : compatSummary?.sunCompat === 'tolerable'
                    ? styles.buttonWarn
                    : null,
                ]}
                onPress={placePlant}
                disabled={!placeName.trim()}
              >
                <Text style={styles.buttonText}>
                  {compatSummary?.sunCompat === 'mismatch' || compatSummary?.overall === 'stop'
                    ? 'Plant Anyway ⚠️'
                    : 'Plant It ✓'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  cellText: { fontSize: 9, fontWeight: '700', color: '#1b4332', textAlign: 'center' },
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
  cellSunDot: { position: 'absolute', bottom: 3, right: 3, width: 10, height: 10, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },

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
  cancelText: { color: '#52796f', fontSize: 16 },
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
  suggestions: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#b7e4c7', marginBottom: 12, overflow: 'hidden' },
  suggestionRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f7ee' },
  suggestionName: { fontSize: 15, fontWeight: '600', color: '#1b4332' },
  suggestionMeta: { fontSize: 12, color: '#52796f', marginTop: 2 },
  waterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  waterStepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#d8f3dc', justifyContent: 'center', alignItems: 'center' },
  stepBtnText: { fontSize: 18, fontWeight: '700', color: '#2d6a4f', lineHeight: 20 },
  stepValue: { fontSize: 15, fontWeight: '600', color: '#1b4332', minWidth: 60, textAlign: 'center' },
});
