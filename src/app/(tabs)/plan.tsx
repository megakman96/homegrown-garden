import { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { G, R, Shadow } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { PressableScale } from '@/components/ui/PressableScale';
import { PLANT_CATALOG, SUN_EMOJIS, searchPlants } from '@/lib/plant-catalog';
import { getPlantIcon } from '@/lib/plant-icons';
import type { CatalogEntry } from '@/lib/plant-catalog';

// Cool season crops can tolerate frost; warm season cannot
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

function computePlan(
  keys: string[],
  planYear: number,
  lastFrostMMDD: string,
  firstFrostMMDD: string,
): PlanEntry[] {
  const lastFrost = parseMMDD(lastFrostMMDD, planYear);
  const firstFrost = parseMMDD(firstFrostMMDD, planYear);
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
      // Cool season: direct sow 4–6 weeks before last frost, or 8 weeks before first fall frost
      directSowDate = addDays(lastFrost, -42);
    } else {
      // Warm season: direct sow on last frost date; start indoors 6–8 weeks before
      directSowDate = lastFrost;
      if (matMin >= 60) {
        seedStartDate = addDays(lastFrost, -56);
        transplantDate = lastFrost;
      }
    }

    const harvestStart = addDays(directSowDate, matMin);
    const harvestEnd = addDays(directSowDate, matMax);

    return { key, entry, seedStartDate, transplantDate, directSowDate, harvestStart, harvestEnd };
  }).filter((e): e is PlanEntry => e !== null);
}

export default function PlanScreen() {
  const { isDark, colors } = useAppTheme();
  const { isDesktop } = useBreakpoint();
  const bg      = isDark ? colors.bg     : G.foam;
  const cardBg  = isDark ? colors.bgCard : G.cloud;
  const textPrim= isDark ? colors.text   : G.forest;
  const textSec = isDark ? colors.textSec: G.stone;
  const border  = isDark ? colors.border : G.mist;
  const inputBg = isDark ? colors.bgElement : G.foam;

  const nextYear = new Date().getFullYear() + 1;
  const [planYear, setPlanYear] = useState(nextYear);
  const [lastFrost, setLastFrost] = useState('04/15');
  const [firstFrost, setFirstFrost] = useState('10/15');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

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
    setSelectedKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    );
  }

  const pickerModal = (
    <Modal visible={showPicker} transparent animationType="slide">
      <View style={styles.modalBackdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowPicker(false)} />
        <View style={[styles.modal, { backgroundColor: cardBg }]}>
          <View style={styles.modalHandle} />
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
          <TouchableOpacity
            style={[styles.doneBtn]}
            onPress={() => { setShowPicker(false); setPickerSearch(''); }}
          >
            <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.doneBtnGrad}>
              <Text style={styles.doneBtnText}>Done ({selectedKeys.length} selected)</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {isDesktop && (
        <View style={[styles.header, { borderBottomColor: border }]}>
          <Text style={[styles.pageTitle, { color: textPrim }]}>🗓️ Garden Plan</Text>
          <Text style={[styles.pageSub, { color: textSec }]}>Plan your future seasons</Text>
        </View>
      )}
      <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]} showsVerticalScrollIndicator={false}>

        {/* Config card */}
        <View style={[styles.configCard, { backgroundColor: cardBg, borderColor: border }]}>
          <Text style={[styles.sectionTitle, { color: textPrim }]}>⚙️ Season Settings</Text>

          {/* Year */}
          <View style={styles.configRow}>
            <Text style={[styles.configLabel, { color: textSec }]}>Plan Year</Text>
            <View style={styles.yearRow}>
              <TouchableOpacity style={styles.yearBtn} onPress={() => setPlanYear(y => Math.max(new Date().getFullYear(), y - 1))}>
                <Text style={[styles.yearBtnText, { color: textPrim }]}>−</Text>
              </TouchableOpacity>
              <Text style={[styles.yearValue, { color: textPrim }]}>{planYear}</Text>
              <TouchableOpacity style={styles.yearBtn} onPress={() => setPlanYear(y => y + 1)}>
                <Text style={[styles.yearBtnText, { color: textPrim }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Frost dates */}
          <View style={styles.configRow}>
            <Text style={[styles.configLabel, { color: textSec }]}>Last Spring Frost</Text>
            <TextInput
              style={[styles.frostInput, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
              value={lastFrost}
              onChangeText={setLastFrost}
              placeholder="MM/DD"
              placeholderTextColor={textSec}
              maxLength={5}
            />
          </View>
          <View style={styles.configRow}>
            <Text style={[styles.configLabel, { color: textSec }]}>First Fall Frost</Text>
            <TextInput
              style={[styles.frostInput, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
              value={firstFrost}
              onChangeText={setFirstFrost}
              placeholder="MM/DD"
              placeholderTextColor={textSec}
              maxLength={5}
            />
          </View>
          <Text style={[styles.frostHint, { color: textSec }]}>
            Not sure? Find your average frost dates at a local gardening resource.
          </Text>
        </View>

        {/* Plant selector */}
        <PressableScale onPress={() => setShowPicker(true)} style={styles.addPlantsBtn}>
          <LinearGradient colors={[G.sage, G.forest]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addPlantsBtnGrad}>
            <Text style={styles.addPlantsBtnText}>
              🌱 {selectedKeys.length === 0 ? 'Choose Plants to Plan' : `${selectedKeys.length} Plant${selectedKeys.length !== 1 ? 's' : ''} Selected — Tap to Change`}
            </Text>
          </LinearGradient>
        </PressableScale>

        {/* Plan output */}
        {plan.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: textPrim, marginTop: 8, marginBottom: 12 }]}>
              📅 {planYear} Planting Schedule
            </Text>
            {plan.map(({ key, entry, seedStartDate, transplantDate, directSowDate, harvestStart, harvestEnd }) => (
              <View key={key} style={[styles.planCard, { backgroundColor: cardBg, borderColor: border }]}>
                <View style={styles.planHeader}>
                  <Text style={styles.planEmoji}>{getPlantIcon(entry.name).emoji}</Text>
                  <Text style={[styles.planName, { color: textPrim }]}>{entry.name}</Text>
                  <Text style={[styles.planCategory, { color: textSec }]}>{entry.category}</Text>
                </View>
                <View style={styles.timeline}>
                  {seedStartDate && (
                    <TimelineRow
                      emoji="🏠"
                      label="Start seeds indoors"
                      date={fmt(seedStartDate)}
                      color="#74c0fc"
                    />
                  )}
                  {transplantDate && (
                    <TimelineRow
                      emoji="🌱"
                      label="Transplant outside"
                      date={fmt(transplantDate)}
                      color="#52b788"
                    />
                  )}
                  {!seedStartDate && (
                    <TimelineRow
                      emoji="🌱"
                      label="Direct sow"
                      date={fmt(directSowDate)}
                      color="#52b788"
                    />
                  )}
                  <TimelineRow
                    emoji="🧺"
                    label="Expected harvest"
                    date={`${fmt(harvestStart)} – ${fmt(harvestEnd)}`}
                    color="#a9e34b"
                  />
                </View>
                {entry.notes && (
                  <Text style={[styles.planNote, { color: textSec }]}>💡 {entry.notes}</Text>
                )}
              </View>
            ))}
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
              Set your year and frost dates, pick plants, and get a personalized planting calendar.
            </Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
      {pickerModal}
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
  header:         { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 20, borderBottomWidth: 1 },
  pageTitle:      { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  pageSub:        { fontSize: 13, marginTop: 3 },
  content:        { padding: 16, paddingBottom: 40 },
  contentDesktop: { maxWidth: 800, width: '100%', alignSelf: 'center', paddingHorizontal: 32 },

  configCard:     { borderRadius: R.lg, padding: 16, marginBottom: 16, borderWidth: 1, ...Shadow.soft },
  sectionTitle:   { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  configRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  configLabel:    { fontSize: 14, fontWeight: '500' },
  yearRow:        { flexDirection: 'row', alignItems: 'center', gap: 14 },
  yearBtn:        { width: 34, height: 34, borderRadius: R.full, backgroundColor: G.dew, justifyContent: 'center', alignItems: 'center' },
  yearBtnText:    { fontSize: 20, fontWeight: '700', lineHeight: 22 },
  yearValue:      { fontSize: 20, fontWeight: '800', minWidth: 52, textAlign: 'center' },
  frostInput:     { borderWidth: 1.5, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, width: 90, textAlign: 'center' },
  frostHint:      { fontSize: 12, marginTop: 4, fontStyle: 'italic' },

  addPlantsBtn:   { marginBottom: 16, borderRadius: R.lg, overflow: 'hidden', ...Shadow.card },
  addPlantsBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  addPlantsBtnText: { color: G.cloud, fontWeight: '700', fontSize: 15 },

  planCard:       { borderRadius: R.lg, padding: 14, marginBottom: 12, borderWidth: 1, ...Shadow.soft },
  planHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  planEmoji:      { fontSize: 26 },
  planName:       { fontSize: 16, fontWeight: '700', flex: 1 },
  planCategory:   { fontSize: 12, textTransform: 'capitalize' },
  timeline:       { gap: 8 },
  timelineRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timelineDot:    { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  timelineEmoji:  { fontSize: 16, width: 22, textAlign: 'center' },
  timelineLabel:  { fontSize: 13, color: G.stone },
  timelineDate:   { fontSize: 13, fontWeight: '600', color: G.forest },
  planNote:       { fontSize: 12, marginTop: 10, fontStyle: 'italic', lineHeight: 18 },

  emptyPlan:      { paddingTop: 48, alignItems: 'center', paddingHorizontal: 24 },
  emptyEmoji:     { fontSize: 52, marginBottom: 14 },
  emptyTitle:     { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptyText:      { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  modalBackdrop:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal:          { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 32 : 20, paddingTop: 12, maxHeight: '88%' },
  modalHandle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: '#d0d8d4', alignSelf: 'center', marginBottom: 16 },
  modalTitle:     { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  input:          { borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1.5, marginBottom: 8 },
  pickerRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, gap: 10, borderRadius: 6 },
  pickerEmoji:    { fontSize: 22, width: 32, textAlign: 'center' },
  pickerName:     { fontSize: 15, fontWeight: '600' },
  pickerMeta:     { fontSize: 12, marginTop: 2 },
  doneBtn:        { marginTop: 12, borderRadius: R.lg, overflow: 'hidden', ...Shadow.soft },
  doneBtnGrad:    { paddingVertical: 13, alignItems: 'center' },
  doneBtnText:    { color: G.cloud, fontWeight: '700', fontSize: 15 },
});
