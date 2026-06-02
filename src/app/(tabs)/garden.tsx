import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
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
};

export default function GardenScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [gardens, setGardens] = useState<Garden[]>([]);
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

  useEffect(() => {
    if (!user) return;
    supabase
      .from('gardens')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const list = data ?? [];
        setGardens(list);
        if (list.length > 0) setSelectedGarden(list[0]);
      });
  }, [user]);

  useEffect(() => {
    if (!selectedGarden) return;
    supabase
      .from('plants')
      .select('*')
      .eq('garden_id', selectedGarden.id)
      .then(({ data }) => setPlants(data ?? []));
  }, [selectedGarden]);

  async function createGarden() {
    if (!user || !newName.trim()) return;
    const { data } = await supabase
      .from('gardens')
      .insert({ user_id: user.id, name: newName.trim(), rows: 6, cols: 8, sun_exposure: newSun })
      .select()
      .single();
    if (data) {
      setGardens((g) => [...g, data]);
      setSelectedGarden(data);
    }
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
      router.push(`/plant/${existing.id}`);
      return;
    }
    const neighbors = getNeighbors(row, col);
    setPlacement({ row, col, neighbors });
    setPlaceName('');
    setPlaceSuggestions([]);
    setPlaceSun(selectedGarden?.sun_exposure ?? 'full_sun');
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
    const { data } = await supabase
      .from('plants')
      .insert({
        user_id: user.id,
        garden_id: selectedGarden.id,
        name: placeName.trim(),
        row: placement.row,
        col: placement.col,
        health_status: 'healthy',
        sun_requirement: placeSun,
        water_interval_days: placeWaterDays,
      })
      .select()
      .single();
    if (data) setPlants((p) => [...p, data]);
    setPlacement(null);
    setPlaceSuggestions([]);
  }

  // Build compatibility summary for placement modal
  function buildCompatSummary() {
    if (!placement || !placeName.trim()) return null;
    const gardenSun = selectedGarden?.sun_exposure ?? 'full_sun';
    const plantKey = findPlantKey(placeName);
    const plantInfo = plantKey ? PLANT_CATALOG[plantKey] : null;

    const sunCompat = plantInfo
      ? getSunCompatibility(plantInfo.sunRequirement, gardenSun as SunRequirement)
      : null;

    const neighborResults = placement.neighbors.map((neighbor) => {
      const compat = getCompatibility(placeName, neighbor.name);
      return { neighbor, compat };
    });

    const hasBad = neighborResults.some((r) => r.compat === 'bad');
    const hasGood = neighborResults.some((r) => r.compat === 'good');
    const overall: 'go' | 'warn' | 'stop' =
      hasBad ? 'stop' : hasGood ? 'go' : 'warn';

    return { sunCompat, neighborResults, plantInfo, overall };
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
        <TouchableOpacity style={styles.gardenChip} onPress={() => setShowNewGarden(true)}>
          <Text style={styles.gardenChipText}>+ New</Text>
        </TouchableOpacity>
      </ScrollView>

      {selectedGarden ? (
        <ScrollView contentContainerStyle={styles.gridContainer}>
          <View style={styles.gardenHeader}>
            <View>
              <Text style={styles.gardenName}>{selectedGarden.name}</Text>
              <Text style={styles.gardenMeta}>
                {SUN_EMOJIS[selectedGarden.sun_exposure as SunRequirement]}{' '}
                {SUN_LABELS[selectedGarden.sun_exposure as SunRequirement]} · {selectedGarden.rows}×{selectedGarden.cols}
              </Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {Array.from({ length: selectedGarden.rows }).map((_, row) => (
                <View key={row} style={styles.gridRow}>
                  {Array.from({ length: selectedGarden.cols }).map((_, col) => {
                    const plant = getPlantAt(row, col);
                    return (
                      <TouchableOpacity
                        key={col}
                        style={[
                          styles.cell,
                          plant
                            ? { backgroundColor: HEALTH_COLORS[plant.health_status] }
                            : styles.emptyCell,
                        ]}
                        onPress={() => handleCellTap(row, col)}
                      >
                        {plant && (
                          <>
                            <Text style={styles.cellText} numberOfLines={1}>{plant.name.slice(0, 5)}</Text>
                            {plant.sun_requirement && (
                              <Text style={styles.cellSun}>{SUN_EMOJIS[plant.sun_requirement as SunRequirement]}</Text>
                            )}
                          </>
                        )}
                        {!plant && <Text style={styles.cellPlus}>+</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Legend */}
          <View style={styles.legend}>
            {Object.entries(HEALTH_COLORS).map(([status, color]) => (
              <View key={status} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendLabel}>{status.replace('_', ' ')}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.hint}>Tap an empty cell to plant · Tap a plant to view details</Text>
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🏡</Text>
          <Text style={styles.emptyText}>No gardens yet</Text>
          <TouchableOpacity style={styles.button} onPress={() => setShowNewGarden(true)}>
            <Text style={styles.buttonText}>Create a garden</Text>
          </TouchableOpacity>
        </View>
      )}

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
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>
                Plant Here (row {(placement?.row ?? 0) + 1}, col {(placement?.col ?? 0) + 1})
              </Text>

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

              <View style={[styles.modalButtons, { marginTop: 16 }]}>
                <TouchableOpacity onPress={() => setPlacement(null)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, !placeName.trim() && styles.buttonDisabled]}
                  onPress={placePlant}
                  disabled={!placeName.trim()}
                >
                  <Text style={styles.buttonText}>Plant It</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f7ee' },
  gardenPicker: { flexGrow: 0, paddingHorizontal: 16, paddingVertical: 12 },
  gardenChip: {
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#b7e4c7',
  },
  gardenChipActive: { backgroundColor: '#2d6a4f', borderColor: '#2d6a4f' },
  gardenChipText: { color: '#2d6a4f', fontWeight: '500' },
  gardenChipTextActive: { color: '#fff' },
  gridContainer: { padding: 16 },
  gardenHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  gardenName: { fontSize: 20, fontWeight: '700', color: '#2d6a4f' },
  gardenMeta: { fontSize: 13, color: '#52796f', marginTop: 2 },
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
  hint: { fontSize: 12, color: '#74c69d', marginTop: 12, textAlign: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#52796f', marginBottom: 20 },
  button: { backgroundColor: '#2d6a4f', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: '600' },
  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalScroll: { justifyContent: 'flex-end', flexGrow: 1 },
  modal: { backgroundColor: '#fff', borderRadius: 20, padding: 24, margin: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#2d6a4f', marginBottom: 16 },
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
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
