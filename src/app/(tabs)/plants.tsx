import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { pb } from '@/lib/pb';
import { useAuth } from '@/hooks/use-auth';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { PressableScale } from '@/components/ui/PressableScale';
import { FadeInView } from '@/components/ui/FadeInView';
import { G, Shadow, R } from '@/constants/theme';
import type { Plant, Garden, HealthStatus } from '@/lib/types';
import type { SunRequirement } from '@/lib/plant-catalog';
import { findPlantKey, PLANT_CATALOG, SUN_EMOJIS, searchPlants } from '@/lib/plant-catalog';
import type { CatalogEntry } from '@/lib/plant-catalog';
import PlantAvatar from '@/components/PlantAvatar';

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
  const router = useRouter();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', variety: '', gardenId: '', sunRequirement: 'full_sun' as SunRequirement, waterIntervalDays: 3 });
  const [suggestions, setSuggestions] = useState<Array<{ key: string; entry: CatalogEntry }>>([]);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [plantsData, gardensData] = await Promise.all([
      pb.collection('plants').getFullList({ filter: `user_id = "${user.id}"`, sort: '-created' }),
      pb.collection('gardens').getFullList({ filter: `user_id = "${user.id}"` }),
    ]);
    setPlants(plantsData as any);
    setGardens(gardensData as any);
    if (gardensData.length) setForm((f) => ({ ...f, gardenId: f.gardenId || gardensData[0].id }));
  }, [user]);

  // Refresh every time this tab comes into focus (catches plants added from garden view)
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  function onNameChange(name: string) {
    const key = findPlantKey(name);
    const entry = key ? PLANT_CATALOG[key] : null;
    setSuggestions(name.length > 1 ? searchPlants(name, 6) : []);
    setForm((f) => ({
      ...f,
      name,
      sunRequirement: entry?.sunRequirement ?? f.sunRequirement,
      waterIntervalDays: entry?.waterIntervalDays ?? f.waterIntervalDays,
    }));
  }

  function selectSuggestion(key: string, entry: CatalogEntry) {
    setSuggestions([]);
    setForm((f) => ({
      ...f,
      name: entry.name,
      sunRequirement: entry.sunRequirement,
      waterIntervalDays: entry.waterIntervalDays,
    }));
  }

  async function addPlant() {
    if (!user || !form.name.trim()) return;
    setAdding(true);
    try {
      let gardenId = form.gardenId || gardens[0]?.id;
      if (!gardenId) {
        const newGarden = await pb.collection('gardens').create({
          user_id: user.id, name: 'My Garden', sun_exposure: 'full_sun', rows: 6, cols: 8,
        });
        gardenId = newGarden.id;
        setGardens((g) => [...g, newGarden as any]);
        setForm((f) => ({ ...f, gardenId: newGarden.id }));
      }
      const data = await pb.collection('plants').create({
        user_id: user.id,
        garden_id: gardenId,
        name: form.name.trim(),
        variety: form.variety.trim() || null,
        health_status: 'healthy',
        sun_requirement: form.sunRequirement,
        water_interval_days: form.waterIntervalDays,
        total_yield_grams: 0,
      });
      setPlants((p) => [data as any, ...p]);
      setSuggestions([]);
      setShowAdd(false);
      setForm((f) => ({ ...f, name: '', variety: '', sunRequirement: 'full_sun', waterIntervalDays: 3 }));
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not add plant');
    } finally {
      setAdding(false);
    }
  }

  const addModal = (
    <Modal visible={showAdd} transparent animationType="slide">
      <View style={styles.modalBackdrop}>
        <View style={styles.modal}>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.modalTitle}>🌱 Add Plant</Text>
            <TextInput
              style={styles.input}
              placeholder="Plant name (e.g. Tomato) *"
              placeholderTextColor={G.stone}
              value={form.name}
              onChangeText={onNameChange}
              autoFocus
            />
            {suggestions.length > 0 && (
              <View style={styles.suggestions}>
                {suggestions.slice(0, 4).map(({ key, entry }) => (
                  <TouchableOpacity
                    key={key}
                    style={styles.suggestionRow}
                    onPress={() => selectSuggestion(key, entry)}
                  >
                    <Text style={styles.suggestionName}>{entry.name}</Text>
                    <Text style={styles.suggestionMeta}>
                      {SUN_EMOJIS[entry.sunRequirement]} · 💧 every {entry.waterIntervalDays}d · {entry.category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TextInput
              style={styles.input}
              placeholder="Variety (optional)"
              placeholderTextColor={G.stone}
              value={form.variety}
              onChangeText={(v) => setForm((f) => ({ ...f, variety: v }))}
            />
            <Text style={styles.fieldLabel}>Sun requirement</Text>
            <View style={styles.sunRow}>
              {(['full_sun', 'partial_sun', 'shade'] as SunRequirement[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sunChip, form.sunRequirement === s && styles.sunChipActive]}
                  onPress={() => setForm((f) => ({ ...f, sunRequirement: s }))}
                >
                  <Text style={[styles.sunChipText, form.sunRequirement === s && styles.sunChipTextActive]}>
                    {SUN_EMOJIS[s]} {s.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.waterRow}>
              <Text style={styles.fieldLabel}>Water every</Text>
              <View style={styles.waterStepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setForm((f) => ({ ...f, waterIntervalDays: Math.max(1, f.waterIntervalDays - 1) }))}>
                  <Text style={styles.stepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepValue}>{form.waterIntervalDays} days</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setForm((f) => ({ ...f, waterIntervalDays: Math.min(30, f.waterIntervalDays + 1) }))}>
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            {gardens.length > 1 && (
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
            )}
          </ScrollView>
          <View style={styles.modalButtons}>
            <TouchableOpacity onPress={() => { setSuggestions([]); setShowAdd(false); }} disabled={adding}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <PressableScale
              style={[styles.addBtn, adding && { opacity: 0.6 }]}
              onPress={addPlant}
              disabled={adding}
            >
              <LinearGradient
                colors={[G.sage, G.hunter]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.addBtnGradient}
              >
                {adding
                  ? <ActivityIndicator color={G.cloud} size="small" />
                  : <Text style={styles.addBtnText}>Add Plant</Text>
                }
              </LinearGradient>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );

  const plantCards = plants.map((plant, i) => (
    <FadeInView key={plant.id} delay={i * 40} from="bottom" style={isDesktop ? styles.desktopCardWrap : undefined}>
      <PressableScale
        style={isDesktop ? styles.desktopCard : styles.card}
        onPress={() => router.push(`/plant/${plant.id}`)}
      >
        <View style={[styles.cardAccent, { backgroundColor: HEALTH_COLORS[plant.health_status] }]} />
        <View style={isDesktop ? styles.desktopCardInner : styles.cardRow}>
          <PlantAvatar name={plant.name} size={isDesktop ? 44 : 52} />
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.plantName} numberOfLines={1}>{plant.name}</Text>
              <View style={styles.cardBadges}>
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
  ));

  if (isDesktop) {
    return (
      <View style={styles.container}>
        <View style={styles.desktopTopBar}>
          <View>
            <Text style={styles.desktopPageTitle}>🌿 Plants</Text>
            <Text style={styles.desktopPageSub}>{plants.length} plant{plants.length !== 1 ? 's' : ''} in your collection</Text>
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
    <View style={styles.container}>
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
  suggestions:     { backgroundColor: G.cloud, borderRadius: R.md, borderWidth: 1, borderColor: G.mist, marginBottom: 12, overflow: 'hidden', ...Shadow.soft },
  suggestionRow:   { padding: 12, borderBottomWidth: 1, borderBottomColor: G.foam },
  suggestionName:  { fontSize: 15, fontWeight: '700', color: G.forest },
  suggestionMeta:  { fontSize: 12, color: G.stone, marginTop: 2 },
  waterRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  waterStepper:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn:         { width: 34, height: 34, borderRadius: R.full, backgroundColor: G.dew, justifyContent: 'center', alignItems: 'center' },
  stepBtnText:     { fontSize: 20, fontWeight: '700', color: G.hunter, lineHeight: 22 },
  stepValue:       { fontSize: 15, fontWeight: '700', color: G.forest, minWidth: 62, textAlign: 'center' },
  empty:           { paddingTop: 64, alignItems: 'center', paddingHorizontal: 32 },
  emptyEmoji:      { fontSize: 56, marginBottom: 12 },
  emptyTitle:      { fontSize: 20, fontWeight: '800', color: G.forest, marginBottom: 8 },
  emptyText:       { fontSize: 14, color: G.stone, textAlign: 'center' },
  modalBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal:           { backgroundColor: G.cloud, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, maxHeight: '88%', ...Shadow.float },
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
  modalButtons:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: G.dew },
  cancelText:      { color: G.stone, fontSize: 16, fontWeight: '600' },
  addBtn:          { borderRadius: R.lg, overflow: 'hidden', ...Shadow.soft },
  addBtnGradient:  { paddingVertical: 12, paddingHorizontal: 28 },
  addBtnText:      { color: G.cloud, fontWeight: '700', fontSize: 15 },
});
