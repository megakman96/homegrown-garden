import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { G, R, Shadow } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useAuth } from '@/hooks/use-auth';
import { PressableScale } from '@/components/ui/PressableScale';
import { PLANT_CATALOG, SUN_EMOJIS, searchPlants } from '@/lib/plant-catalog';
import { getPlantIcon } from '@/lib/plant-icons';
import { pb } from '@/lib/pb';
import type { CatalogEntry } from '@/lib/plant-catalog';

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'hg_garden_plans_v1';

export interface SavedPlan {
  id: string;
  name: string;
  year: number;
  lastFrost: string;
  firstFrost: string;
  plantKeys: string[];
  createdAt: string;
}

async function loadPlans(): Promise<SavedPlan[]> {
  try {
    if (Platform.OS === 'web') {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    }
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function savePlans(plans: SavedPlan[]): Promise<void> {
  try {
    const json = JSON.stringify(plans);
    if (Platform.OS === 'web') {
      localStorage.setItem(STORAGE_KEY, json);
      return;
    }
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(STORAGE_KEY, json);
  } catch {}
}

// ─── Plan computation ─────────────────────────────────────────────────────────

const COOL_SEASON = new Set([
  'lettuce', 'spinach', 'kale', 'broccoli', 'cabbage', 'cauliflower',
  'brussels_sprouts', 'pea', 'carrot', 'radish', 'beet', 'turnip', 'parsnip',
  'chard', 'arugula', 'bok_choy', 'collard_greens', 'endive', 'leek',
]);

interface PlanEntry {
  key: string;
  entry: CatalogEntry;
  seedStartDate: Date | null;
  transplantDate: Date | null;
  directSowDate: Date;
  harvestStart: Date;
  harvestEnd: Date;
}

function parseMMDD(mmdd: string, year: number): Date | null {
  const parts = mmdd.split('/');
  if (parts.length < 2) return null;
  const m = parseInt(parts[0], 10);
  const d = parseInt(parts[1], 10);
  if (isNaN(m) || isNaN(d)) return null;
  return new Date(year, m - 1, d);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmt(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function computePlan(keys: string[], year: number, lastFrostStr: string, firstFrostStr: string): PlanEntry[] {
  const lastFrost  = parseMMDD(lastFrostStr, year);
  const firstFrost = parseMMDD(firstFrostStr, year);
  if (!lastFrost || !firstFrost) return [];

  return keys.map((key) => {
    const entry = PLANT_CATALOG[key];
    if (!entry) return null;
    const matMin = entry.daysToMaturity?.min ?? 60;
    const matMax = entry.daysToMaturity?.max ?? 90;
    const isCool = COOL_SEASON.has(key);

    let directSowDate: Date;
    let seedStartDate: Date | null = null;
    let transplantDate: Date | null = null;

    if (isCool) {
      directSowDate = addDays(lastFrost, -42);
    } else {
      directSowDate = lastFrost;
      if (matMin >= 60) { seedStartDate = addDays(lastFrost, -56); transplantDate = lastFrost; }
    }

    return {
      key, entry, seedStartDate, transplantDate, directSowDate,
      harvestStart: addDays(directSowDate, matMin),
      harvestEnd:   addDays(directSowDate, matMax),
    };
  }).filter((e): e is PlanEntry => e !== null);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlanScreen() {
  const { user }      = useAuth();
  const router        = useRouter();
  const { isDark, colors } = useAppTheme();
  const { isDesktop } = useBreakpoint();
  const bg      = isDark ? colors.bg      : G.foam;
  const cardBg  = isDark ? colors.bgCard  : G.cloud;
  const textPrim= isDark ? colors.text    : G.forest;
  const textSec = isDark ? colors.textSec : G.stone;
  const border  = isDark ? colors.border  : G.mist;
  const inputBg = isDark ? colors.bgElement : G.foam;

  // Saved plans
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Active plan settings
  const nextYear = new Date().getFullYear() + 1;
  const [planName,   setPlanName]   = useState(`Spring ${nextYear} Plan`);
  const [planYear,   setPlanYear]   = useState(nextYear);
  const [lastFrost,  setLastFrost]  = useState('04/15');
  const [firstFrost, setFirstFrost] = useState('10/15');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // Plant picker modal
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // Convert modal
  const [showConvert, setShowConvert] = useState(false);
  const [convertName, setConvertName] = useState('');
  const [converting, setConverting]   = useState(false);

  useEffect(() => { loadPlans().then(setSavedPlans); }, []);

  const pickerItems = useMemo(() => {
    if (pickerSearch.trim()) return searchPlants(pickerSearch, 60);
    return Object.entries(PLANT_CATALOG)
      .map(([key, entry]) => ({ key, entry }))
      .sort((a, b) => a.entry.name.localeCompare(b.entry.name));
  }, [pickerSearch]);

  const plan = useMemo(
    () => computePlan(selectedKeys, planYear, lastFrost, firstFrost),
    [selectedKeys, planYear, lastFrost, firstFrost],
  );

  function togglePlant(key: string) {
    setSelectedKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  function loadPlan(p: SavedPlan) {
    setActiveId(p.id);
    setPlanName(p.name);
    setPlanYear(p.year);
    setLastFrost(p.lastFrost);
    setFirstFrost(p.firstFrost);
    setSelectedKeys(p.plantKeys);
  }

  function newPlan() {
    const year = new Date().getFullYear() + 1;
    setActiveId(null);
    setPlanName(`Spring ${year} Plan`);
    setPlanYear(year);
    setLastFrost('04/15');
    setFirstFrost('10/15');
    setSelectedKeys([]);
  }

  async function savePlan() {
    if (!planName.trim()) { Alert.alert('Name required', 'Give your plan a name before saving.'); return; }
    const updated: SavedPlan = {
      id: activeId ?? `plan_${Date.now()}`,
      name: planName.trim(),
      year: planYear,
      lastFrost, firstFrost,
      plantKeys: selectedKeys,
      createdAt: activeId
        ? (savedPlans.find(p => p.id === activeId)?.createdAt ?? new Date().toISOString())
        : new Date().toISOString(),
    };
    const next = activeId
      ? savedPlans.map(p => p.id === activeId ? updated : p)
      : [...savedPlans, updated];
    setSavedPlans(next);
    setActiveId(updated.id);
    await savePlans(next);
    Alert.alert('Saved!', `"${updated.name}" saved to your plans.`);
  }

  async function deletePlan(id: string) {
    Alert.alert('Delete Plan', 'Remove this plan?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const next = savedPlans.filter(p => p.id !== id);
        setSavedPlans(next);
        await savePlans(next);
        if (activeId === id) newPlan();
      }},
    ]);
  }

  async function convertToGarden() {
    if (!user || !convertName.trim()) return;
    setConverting(true);
    try {
      const garden = await pb.collection('gardens').create({
        user_id: user.id,
        name: convertName.trim(),
        rows: 6,
        cols: 8,
        sun_exposure: 'full_sun',
        year: planYear,
      });

      // Add each plant to the garden
      let row = 0;
      let col = 0;
      for (const key of selectedKeys) {
        const entry = PLANT_CATALOG[key];
        if (!entry) continue;
        await pb.collection('plants').create({
          garden_id: garden.id,
          user_id:   user.id,
          name:      entry.name,
          row, col,
          water_interval_days: entry.waterIntervalDays,
          health_status: 'healthy',
          total_yield_grams: 0,
        }).catch(() => {});
        col++;
        if (col >= 8) { col = 0; row++; }
      }

      setShowConvert(false);
      setConvertName('');
      Alert.alert('Garden created!', `"${convertName.trim()}" has been added to your gardens.`, [
        { text: 'Go to Garden', onPress: () => router.push('/(tabs)/garden') },
        { text: 'Stay here' },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not create garden');
    } finally {
      setConverting(false);
    }
  }

  // ── Picker modal ──────────────────────────────────────────────────────────

  const pickerModal = (
    <Modal visible={showPicker} transparent animationType="slide">
      <View style={[styles.modalBackdrop, isDesktop && styles.modalBackdropCenter]}>
        {!isDesktop && <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowPicker(false)} />}
        <View style={[styles.modal, { backgroundColor: cardBg }, isDesktop && styles.modalCenter]}>
          {!isDesktop && <View style={styles.modalHandle} />}
          <Text style={[styles.modalTitle, { color: textPrim }]}>Choose Plants</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
            placeholder="Search..."
            placeholderTextColor={textSec}
            value={pickerSearch}
            onChangeText={setPickerSearch}
          />
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {pickerItems.map(({ key, entry }) => {
              const selected = selectedKeys.includes(key);
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.pickerRow, { borderBottomColor: border }, selected && { backgroundColor: isDark ? colors.bgElement : '#d8f3dc' }]}
                  onPress={() => togglePlant(key)}
                >
                  <Text style={styles.pickerEmoji}>{getPlantIcon(entry.name).emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickerName, { color: textPrim }]}>{entry.name}</Text>
                    <Text style={[styles.pickerMeta, { color: textSec }]}>
                      {SUN_EMOJIS[entry.sunRequirement]} · {entry.daysToMaturity?.min ?? '?'}–{entry.daysToMaturity?.max ?? '?'} days
                    </Text>
                  </View>
                  {selected && <Text style={{ fontSize: 18 }}>✅</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={styles.doneBtn} onPress={() => { setShowPicker(false); setPickerSearch(''); }}>
            <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.doneBtnGrad}>
              <Text style={styles.doneBtnText}>Done ({selectedKeys.length} selected)</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ── Convert modal ─────────────────────────────────────────────────────────

  const convertModal = (
    <Modal visible={showConvert} transparent animationType="fade">
      <View style={[styles.modalBackdrop, styles.modalBackdropCenter]}>
        <View style={[styles.modal, { backgroundColor: cardBg }, styles.modalCenter]}>
          <Text style={[styles.modalTitle, { color: textPrim }]}>🌱 Create Garden from Plan</Text>
          <Text style={[styles.convertHint, { color: textSec }]}>
            {selectedKeys.length} plants will be added to a new {planYear} garden.
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
            placeholder="Garden name (e.g. Backyard 2026)"
            placeholderTextColor={textSec}
            value={convertName}
            onChangeText={setConvertName}
            autoFocus
          />
          <View style={styles.convertButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowConvert(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, (converting || !convertName.trim()) && { opacity: 0.5 }]}
              onPress={convertToGarden}
              disabled={converting || !convertName.trim()}
            >
              <Text style={styles.buttonText}>{converting ? 'Creating…' : 'Create Garden'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ── Saved plans list ──────────────────────────────────────────────────────

  const savedPlansList = savedPlans.length > 0 && (
    <View style={[styles.savedSection, isDesktop ? styles.savedSectionDesktop : { marginHorizontal: 16 }]}>
      <Text style={[styles.sectionTitle, { color: textPrim }]}>📂 Saved Plans</Text>
      <ScrollView horizontal={!isDesktop} showsHorizontalScrollIndicator={false}>
        <View style={isDesktop ? styles.savedGridDesktop : styles.savedGrid}>
          {savedPlans.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.savedCard,
                { backgroundColor: cardBg, borderColor: p.id === activeId ? G.sage : border },
                p.id === activeId && { borderWidth: 2 },
              ]}
              onPress={() => loadPlan(p)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={[styles.savedName, { color: textPrim }]} numberOfLines={1}>{p.name}</Text>
                <TouchableOpacity onPress={() => deletePlan(p.id)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Text style={{ color: textSec, fontSize: 14 }}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.savedMeta, { color: textSec }]}>
                {p.year} · {p.plantKeys.length} plant{p.plantKeys.length !== 1 ? 's' : ''}
              </Text>
              {p.id === activeId && (
                <Text style={[styles.savedActive, { color: G.sage }]}>● Editing</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  // ── Plan results ──────────────────────────────────────────────────────────

  const planResults = plan.length > 0 ? (
    <>
      <Text style={[styles.sectionTitle, { color: textPrim, marginTop: isDesktop ? 0 : 16, marginBottom: 12 }]}>
        📅 {planYear} Planting Schedule
      </Text>
      <View style={isDesktop ? styles.planGrid : undefined}>
        {plan.map(({ key, entry, seedStartDate, transplantDate, directSowDate, harvestStart, harvestEnd }) => (
          <View key={key} style={[styles.planCard, { backgroundColor: cardBg, borderColor: border }, isDesktop && styles.planCardDesktop]}>
            <View style={styles.planHeader}>
              <Text style={styles.planEmoji}>{getPlantIcon(entry.name).emoji}</Text>
              <Text style={[styles.planName, { color: textPrim }]}>{entry.name}</Text>
              <Text style={[styles.planCategory, { color: textSec }]}>{entry.category}</Text>
            </View>
            <View style={styles.timeline}>
              {seedStartDate && <TimelineRow emoji="🏠" label="Start seeds indoors" date={fmt(seedStartDate)} color="#74c0fc" />}
              {transplantDate && <TimelineRow emoji="🌱" label="Transplant outside" date={fmt(transplantDate)} color="#52b788" />}
              {!seedStartDate && <TimelineRow emoji="🌱" label="Direct sow" date={fmt(directSowDate)} color="#52b788" />}
              <TimelineRow emoji="🧺" label="Expected harvest" date={`${fmt(harvestStart)} – ${fmt(harvestEnd)}`} color="#a9e34b" />
            </View>
            {entry.notes && <Text style={[styles.planNote, { color: textSec }]}>💡 {entry.notes}</Text>}
          </View>
        ))}
      </View>
    </>
  ) : selectedKeys.length > 0 ? (
    <View style={styles.emptyPlan}>
      <Text style={[styles.emptyText, { color: textSec }]}>Check your frost dates — enter them in MM/DD format (e.g. 04/15).</Text>
    </View>
  ) : (
    <View style={styles.emptyPlan}>
      <Text style={styles.emptyEmoji}>🗓️</Text>
      <Text style={[styles.emptyTitle, { color: textPrim }]}>Plan a future season</Text>
      <Text style={[styles.emptyText, { color: textSec }]}>
        Set your year and frost dates, pick plants, and get a personalized planting calendar you can save and convert to a real garden.
      </Text>
    </View>
  );

  // ── Config panel (shared between mobile + desktop) ────────────────────────

  const configContent = (
    <>
      <TextInput
        style={[styles.nameInput, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
        value={planName}
        onChangeText={setPlanName}
        placeholder="Plan name"
        placeholderTextColor={textSec}
      />

      <Text style={[styles.sectionTitle, { color: textPrim, marginTop: 16 }]}>⚙️ Season Settings</Text>

      <Text style={[styles.configLabel, { color: textSec, marginBottom: 6, marginTop: 8 }]}>Plan Year</Text>
      <View style={[styles.yearRow, { marginBottom: 16 }]}>
        <TouchableOpacity style={[styles.yearBtn, { backgroundColor: isDark ? colors.bgElement : G.foam }]} onPress={() => setPlanYear(y => Math.max(new Date().getFullYear(), y - 1))}>
          <Text style={[styles.yearBtnText, { color: textPrim }]}>−</Text>
        </TouchableOpacity>
        <Text style={[styles.yearValue, { color: textPrim }]}>{planYear}</Text>
        <TouchableOpacity style={[styles.yearBtn, { backgroundColor: isDark ? colors.bgElement : G.foam }]} onPress={() => setPlanYear(y => y + 1)}>
          <Text style={[styles.yearBtnText, { color: textPrim }]}>+</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.configLabel, { color: textSec, marginBottom: 6 }]}>Last Spring Frost</Text>
      <TextInput
        style={[styles.frostInput, { backgroundColor: inputBg, borderColor: border, color: textPrim, width: '100%', marginBottom: 12 }]}
        value={lastFrost} onChangeText={setLastFrost}
        placeholder="MM/DD" placeholderTextColor={textSec} maxLength={5}
      />

      <Text style={[styles.configLabel, { color: textSec, marginBottom: 6 }]}>First Fall Frost</Text>
      <TextInput
        style={[styles.frostInput, { backgroundColor: inputBg, borderColor: border, color: textPrim, width: '100%', marginBottom: 16 }]}
        value={firstFrost} onChangeText={setFirstFrost}
        placeholder="MM/DD" placeholderTextColor={textSec} maxLength={5}
      />

      <PressableScale onPress={() => setShowPicker(true)} style={styles.addPlantsBtn}>
        <LinearGradient colors={[G.sage, G.forest]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addPlantsBtnGrad}>
          <Text style={styles.addPlantsBtnText}>
            🌱 {selectedKeys.length === 0 ? 'Choose Plants' : `${selectedKeys.length} Plant${selectedKeys.length !== 1 ? 's' : ''} Selected`}
          </Text>
        </LinearGradient>
      </PressableScale>

      {selectedKeys.length > 0 && (
        <View style={{ marginTop: 12, gap: 6 }}>
          {selectedKeys.map(k => (
            <View key={k} style={[styles.selectedChip, { backgroundColor: isDark ? colors.bgElement : '#d8f3dc', borderColor: border }]}>
              <Text style={{ fontSize: 16 }}>{getPlantIcon(PLANT_CATALOG[k]?.name ?? k).emoji}</Text>
              <Text style={[styles.selectedChipText, { color: textPrim }]}>{PLANT_CATALOG[k]?.name ?? k}</Text>
              <TouchableOpacity onPress={() => togglePlant(k)}>
                <Text style={{ color: textSec, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Save + Convert buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.saveBtn, { borderColor: G.sage }]} onPress={savePlan}>
          <Text style={[styles.saveBtnText, { color: G.hunter }]}>💾 Save Plan</Text>
        </TouchableOpacity>
        {selectedKeys.length > 0 && (
          <TouchableOpacity
            style={styles.convertBtn}
            onPress={() => { setConvertName(planName); setShowConvert(true); }}
          >
            <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.convertBtnGrad}>
              <Text style={styles.convertBtnText}>🌻 Convert to Garden</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  if (isDesktop) {
    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
        <View style={[styles.header, { borderBottomColor: border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={[styles.pageTitle, { color: textPrim }]}>🗓️ Garden Plans</Text>
              <Text style={[styles.pageSub, { color: textSec }]}>Plan future seasons, save them, convert to gardens</Text>
            </View>
            <TouchableOpacity style={[styles.newPlanBtn, { borderColor: border }]} onPress={newPlan}>
              <Text style={[styles.newPlanBtnText, { color: textPrim }]}>+ New Plan</Text>
            </TouchableOpacity>
          </View>
          {savedPlans.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }} contentContainerStyle={{ gap: 8 }}>
              {savedPlans.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.savedTab, { borderColor: p.id === activeId ? G.sage : border, backgroundColor: p.id === activeId ? (isDark ? colors.bgElement : '#d8f3dc') : cardBg }]}
                  onPress={() => loadPlan(p)}
                >
                  <Text style={[styles.savedTabText, { color: textPrim }]}>{p.name}</Text>
                  <Text style={[styles.savedTabMeta, { color: textSec }]}>{p.year} · {p.plantKeys.length}🌱</Text>
                  <TouchableOpacity onPress={() => deletePlan(p.id)} hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}>
                    <Text style={{ color: textSec, fontSize: 12, marginLeft: 6 }}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
        <View style={styles.desktopLayout}>
          <View style={[styles.desktopLeftPanel, { backgroundColor: cardBg, borderRightColor: border }]}>
            <ScrollView contentContainerStyle={styles.desktopLeftContent} showsVerticalScrollIndicator={false}>
              {configContent}
            </ScrollView>
          </View>
          <ScrollView style={styles.desktopRightPanel} contentContainerStyle={styles.desktopRightContent} showsVerticalScrollIndicator={false}>
            {planResults}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
        {pickerModal}
        {convertModal}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.mobileHeader}>
          <Text style={[styles.pageTitle, { color: textPrim }]}>🗓️ Garden Plans</Text>
          <TouchableOpacity style={[styles.newPlanBtn, { borderColor: border }]} onPress={newPlan}>
            <Text style={[styles.newPlanBtnText, { color: textPrim }]}>+ New</Text>
          </TouchableOpacity>
        </View>

        {savedPlansList}

        <View style={[styles.configCard, { backgroundColor: cardBg, borderColor: border }]}>
          {configContent}
        </View>

        {planResults}
        <View style={{ height: 40 }} />
      </ScrollView>
      {pickerModal}
      {convertModal}
    </View>
  );
}

function TimelineRow({ emoji, label, date, color }: { emoji: string; label: string; date: string; color: string }) {
  return (
    <View style={styles.timelineRow}>
      <View style={[styles.timelineDot, { backgroundColor: color }]} />
      <Text style={styles.timelineEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.timelineLabel}>{label}</Text>
      </View>
      <Text style={styles.timelineDate}>{date}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { paddingHorizontal: 32, paddingTop: 28, paddingBottom: 16, borderBottomWidth: 1 },
  pageTitle:      { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  pageSub:        { fontSize: 13, marginTop: 3 },
  mobileHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  content:        { padding: 16, paddingBottom: 40 },

  newPlanBtn:     { borderRadius: R.md, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 6 },
  newPlanBtnText: { fontSize: 13, fontWeight: '700' },

  // Saved plans
  savedSection:       { marginBottom: 12 },
  savedSectionDesktop:{ paddingHorizontal: 32, paddingTop: 8, paddingBottom: 12, marginBottom: 0 },
  savedGrid:          { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  savedGridDesktop:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  savedCard:          { borderRadius: R.md, borderWidth: 1, padding: 12, minWidth: 140, maxWidth: 180, ...Shadow.soft },
  savedName:          { fontSize: 13, fontWeight: '700', flex: 1, marginRight: 4 },
  savedMeta:          { fontSize: 11, marginTop: 2 },
  savedActive:        { fontSize: 10, marginTop: 4, fontWeight: '600' },

  // Desktop saved tabs (in header)
  savedTab:       { flexDirection: 'row', alignItems: 'center', borderRadius: R.md, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 6, gap: 4 },
  savedTabText:   { fontSize: 13, fontWeight: '600' },
  savedTabMeta:   { fontSize: 11 },

  // Desktop layout
  desktopLayout:      { flex: 1, flexDirection: 'row' },
  desktopLeftPanel:   { width: 300, borderRightWidth: 1, flexShrink: 0 },
  desktopLeftContent: { padding: 24, paddingBottom: 40 },
  desktopRightPanel:  { flex: 1 },
  desktopRightContent:{ padding: 32, paddingBottom: 48, maxWidth: 900, width: '100%', alignSelf: 'center' },

  // Config card (mobile only wrapper)
  configCard: { borderRadius: R.lg, padding: 16, marginBottom: 16, borderWidth: 1, ...Shadow.soft },

  nameInput:    { borderRadius: R.md, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  configLabel:  { fontSize: 13, fontWeight: '500' },
  yearRow:      { flexDirection: 'row', alignItems: 'center', gap: 14 },
  yearBtn:      { width: 34, height: 34, borderRadius: R.full, justifyContent: 'center', alignItems: 'center' },
  yearBtnText:  { fontSize: 20, fontWeight: '700', lineHeight: 22 },
  yearValue:    { fontSize: 20, fontWeight: '800', minWidth: 52, textAlign: 'center' },
  frostInput:   { borderWidth: 1.5, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, textAlign: 'center' },

  addPlantsBtn:      { marginTop: 4, borderRadius: R.lg, overflow: 'hidden', ...Shadow.card },
  addPlantsBtnGrad:  { paddingVertical: 13, alignItems: 'center' },
  addPlantsBtnText:  { color: G.cloud, fontWeight: '700', fontSize: 15 },
  selectedChip:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: R.md, borderWidth: 1, padding: 10 },
  selectedChipText:  { flex: 1, fontSize: 14, fontWeight: '600' },

  actionRow:         { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  saveBtn:           { flex: 1, borderRadius: R.md, borderWidth: 1.5, paddingVertical: 11, alignItems: 'center' },
  saveBtnText:       { fontSize: 14, fontWeight: '700' },
  convertBtn:        { flex: 2, borderRadius: R.lg, overflow: 'hidden', ...Shadow.soft },
  convertBtnGrad:    { paddingVertical: 11, alignItems: 'center' },
  convertBtnText:    { color: G.cloud, fontWeight: '700', fontSize: 14 },

  // Plan cards
  planGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  planCardDesktop:   { width: '47%', flexGrow: 1 },
  planCard:          { borderRadius: R.lg, padding: 14, marginBottom: 12, borderWidth: 1, ...Shadow.soft },
  planHeader:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  planEmoji:         { fontSize: 26 },
  planName:          { fontSize: 16, fontWeight: '700', flex: 1 },
  planCategory:      { fontSize: 12, textTransform: 'capitalize' },
  timeline:          { gap: 8 },
  timelineRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timelineDot:       { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  timelineEmoji:     { fontSize: 16, width: 22, textAlign: 'center' },
  timelineLabel:     { fontSize: 13, color: G.stone },
  timelineDate:      { fontSize: 13, fontWeight: '600', color: G.forest },
  planNote:          { fontSize: 12, marginTop: 10, fontStyle: 'italic', lineHeight: 18 },

  emptyPlan:  { paddingTop: 48, alignItems: 'center', paddingHorizontal: 24 },
  emptyEmoji: { fontSize: 52, marginBottom: 14 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptyText:  { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Modals
  modalBackdrop:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBackdropCenter: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modal:               { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 32 : 20, paddingTop: 16, maxHeight: '88%' },
  modalCenter:         { width: '100%', maxWidth: 480, borderRadius: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHandle:         { width: 40, height: 4, borderRadius: 2, backgroundColor: '#d0d8d4', alignSelf: 'center', marginBottom: 16 },
  modalTitle:          { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  convertHint:         { fontSize: 13, lineHeight: 18, marginBottom: 14 },
  convertButtons:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  cancelBtn:           { borderRadius: R.md, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#fff5f5', borderWidth: 1.5, borderColor: '#ffc9c9' },
  cancelText:          { color: '#e03131', fontSize: 15, fontWeight: '700' },
  button:              { backgroundColor: G.hunter, borderRadius: R.md, paddingHorizontal: 24, paddingVertical: 12 },
  buttonText:          { color: '#fff', fontWeight: '600', fontSize: 15 },
  input:               { borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1.5, marginBottom: 8 },
  pickerRow:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, gap: 10, borderRadius: 6 },
  pickerEmoji:         { fontSize: 22, width: 32, textAlign: 'center' },
  pickerName:          { fontSize: 15, fontWeight: '600' },
  pickerMeta:          { fontSize: 12, marginTop: 2 },
  doneBtn:             { marginTop: 12, borderRadius: R.lg, overflow: 'hidden', ...Shadow.soft },
  doneBtnGrad:         { paddingVertical: 13, alignItems: 'center' },
  doneBtnText:         { color: G.cloud, fontWeight: '700', fontSize: 15 },
});
