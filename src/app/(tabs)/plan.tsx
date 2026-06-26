import { useState, useMemo, useEffect } from 'react';
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
import PlantAvatar from '@/components/PlantAvatar';
import { PLANT_CATALOG, SUN_EMOJIS, searchPlants } from '@/lib/plant-catalog';
import { getPlantIcon } from '@/lib/plant-icons';
import { pb } from '@/lib/pb';
import {
  type SavedPlan, type PlanEntry, loadPlans, savePlans, computePlan,
} from '@/lib/garden-plan';
import { emit } from '@/lib/events';

// ─── Web-safe alerts ──────────────────────────────────────────────────────────

function alertOk(title: string, message: string) {
  if (Platform.OS === 'web') { window.alert(`${title}\n\n${message}`); }
  else Alert.alert(title, message);
}

function alertConfirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

// ─── Plan computation ─────────────────────────────────────────────────────────

function fmt(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

  // Garden wizard
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<'details' | 'placement' | 'review'>('details');
  const [wizardName, setWizardName] = useState('');
  const [wizardRows, setWizardRows] = useState(6);
  const [wizardCols, setWizardCols] = useState(8);
  const [wizardSun, setWizardSun] = useState<'full_sun' | 'partial_sun' | 'shade'>('full_sun');
  // cellKey `${row}_${col}` → plantKey
  const [wizardPlacements, setWizardPlacements] = useState<Record<string, string>>({});
  const [wizardActivePlant, setWizardActivePlant] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    loadPlans().then(plans => setSavedPlans([...plans].sort((a, b) => b.year - a.year)));
  }, []);

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

  // Derived data for the review step
  const REVIEW_CELL = 28;
  const REVIEW_SUN_EMOJI: Record<string, string> = { full_sun: '☀️', partial_sun: '⛅', shade: '🌑' };
  const REVIEW_SUN_LBL:   Record<string, string> = { full_sun: 'Full Sun', partial_sun: 'Partial Sun', shade: 'Shade' };
  const placedKeys = useMemo(() => [...new Set(Object.values(wizardPlacements))], [wizardPlacements]);
  const reviewEntries = useMemo(() => plan.filter(p => placedKeys.includes(p.key)), [plan, placedKeys]);
  function cellsForKey(k: string) {
    return Object.entries(wizardPlacements)
      .filter(([, v]) => v === k)
      .map(([ck]) => { const [r, c] = ck.split('_'); return `R${+r+1}C${+c+1}`; })
      .join(', ');
  }

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
    if (!planName.trim()) {
      alertOk('Name required', 'Give your plan a name before saving.');
      return;
    }
    // Duplicate name+year check (excluding the plan currently being edited)
    const duplicate = savedPlans.find(
      p => p.id !== activeId && p.name.trim().toLowerCase() === planName.trim().toLowerCase() && p.year === planYear
    );
    if (duplicate) {
      alertOk('Duplicate plan', `A plan named "${planName.trim()}" for ${planYear} already exists. Use a different name or year.`);
      return;
    }
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
    const unsorted = activeId
      ? savedPlans.map(p => p.id === activeId ? updated : p)
      : [...savedPlans, updated];
    const next = [...unsorted].sort((a, b) => b.year - a.year);
    setSavedPlans(next);
    setActiveId(updated.id);
    await savePlans(next);
    emit('plans:changed');
    alertOk('Saved!', `"${updated.name}" saved to your plans.`);
  }

  async function deletePlan(id: string) {
    alertConfirm('Delete Plan', 'Remove this plan?', async () => {
      const next = savedPlans.filter(p => p.id !== id);
      setSavedPlans(next);
      await savePlans(next);
      emit('plans:changed');
      if (activeId === id) newPlan();
    });
  }

  // ── Garden wizard ─────────────────────────────────────────────────────────

  function openWizard() {
    if (!user) { alertOk('Sign in required', 'You must be signed in to create a garden.'); return; }
    if (selectedKeys.length === 0) { alertOk('No plants', 'Add plants to your plan first.'); return; }
    setWizardName(planName);
    setWizardStep('details');
    setWizardRows(6);
    setWizardCols(8);
    setWizardSun('full_sun');
    setWizardPlacements({});
    setWizardActivePlant(selectedKeys[0] ?? null);
    setShowWizard(true);
  }

  function handleCellPress(row: number, col: number) {
    const key = `${row}_${col}`;
    if (!wizardActivePlant) {
      setWizardPlacements(prev => { const n = { ...prev }; delete n[key]; return n; });
      return;
    }
    setWizardPlacements(prev =>
      prev[key] === wizardActivePlant
        ? (() => { const n = { ...prev }; delete n[key]; return n; })()
        : { ...prev, [key]: wizardActivePlant }
    );
  }

  const placedCount = Object.keys(wizardPlacements).length;

  async function convertToGarden() {
    if (!user || !wizardName.trim()) return;
    if (placedCount === 0) {
      alertOk('No plants placed', 'Tap a plant, then tap grid cells to place it before creating the garden.');
      return;
    }
    setConverting(true);
    try {
      const garden = await pb.collection('gardens').create({
        user_id: user.id,
        name: wizardName.trim(),
        rows: wizardRows,
        cols: wizardCols,
        sun_exposure: wizardSun,
        year: planYear,
      });

      for (const [cellKey, plantKey] of Object.entries(wizardPlacements)) {
        const [rowStr, colStr] = cellKey.split('_');
        const entry = PLANT_CATALOG[plantKey];
        if (!entry) continue;
        await pb.collection('plants').create({
          garden_id: garden.id,
          user_id:   user.id,
          name:      entry.name,
          row:       parseInt(rowStr, 10),
          col:       parseInt(colStr, 10),
          health_status: 'healthy',
          total_yield_grams: 0,
        }).catch(() => {});
      }

      setShowWizard(false);
      setWizardPlacements({});
      if (Platform.OS === 'web') {
        if (window.confirm(`"${wizardName.trim()}" created with ${placedCount} plant${placedCount !== 1 ? 's' : ''}!\n\nGo to Garden view?`)) {
          router.push('/(tabs)/garden');
        }
      } else {
        Alert.alert('Garden created!', `"${wizardName.trim()}" has been added to your gardens.`, [
          { text: 'Go to Garden', onPress: () => router.push('/(tabs)/garden') },
          { text: 'Stay here' },
        ]);
      }
    } catch (e: any) {
      const msg = e?.message ?? 'Could not create garden.';
      if (Platform.OS === 'web') { window.alert(`Error: ${msg}`); }
      else Alert.alert('Error', msg);
    } finally {
      setConverting(false);
    }
  }

  // ── Picker modal ──────────────────────────────────────────────────────────

  const GARDEN_GOALS = [
    {
      id: 'butterfly',
      emoji: '🦋',
      label: 'Butterfly Garden',
      keys: ['zinnia', 'echinacea', 'black_eyed_susan', 'lavender', 'bee_balm', 'agastache', 'cosmos', 'marigold', 'verbena', 'parsley', 'dill'],
    },
    {
      id: 'pollinator',
      emoji: '🐝',
      label: 'Pollinator Garden',
      keys: ['lavender', 'borage', 'nasturtium', 'calendula', 'sweet_alyssum', 'sunflower', 'marigold', 'cosmos', 'bee_balm', 'agastache', 'echinacea'],
    },
    {
      id: 'salad',
      emoji: '🥗',
      label: 'Salad Garden',
      keys: ['lettuce', 'spinach', 'arugula', 'radish', 'cucumber', 'tomato', 'carrot', 'chive', 'parsley'],
    },
    {
      id: 'herbs',
      emoji: '🌿',
      label: 'Herb Garden',
      keys: ['basil', 'parsley', 'cilantro', 'dill', 'thyme', 'rosemary', 'sage', 'chive', 'mint', 'lavender', 'oregano'],
    },
  ];

  const pickerModal = (
    <Modal visible={showPicker} transparent animationType="slide">
      <View style={[styles.modalBackdrop, isDesktop && styles.modalBackdropCenter]}>
        {!isDesktop && <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowPicker(false)} />}
        <View style={[styles.modal, { backgroundColor: cardBg }, isDesktop && styles.modalCenter]}>
          {!isDesktop && <View style={styles.modalHandle} />}
          <Text style={[styles.modalTitle, { color: textPrim }]}>Choose Plants</Text>

          {/* Garden Goals quick-start */}
          <Text style={[styles.goalLabel, { color: textSec }]}>START WITH A GOAL</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.goalRow} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
            {GARDEN_GOALS.map(goal => (
              <TouchableOpacity
                key={goal.id}
                style={[styles.goalChip, { backgroundColor: isDark ? colors.bgElement : '#e8f5e9', borderColor: isDark ? colors.border : '#a5d6a7' }]}
                onPress={() => setSelectedKeys(prev => [...new Set([...prev, ...goal.keys])])}
              >
                <Text style={styles.goalEmoji}>{goal.emoji}</Text>
                <Text style={[styles.goalChipText, { color: textPrim }]}>{goal.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
            placeholder="Search plants..."
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
                  <PlantAvatar name={entry.name} size={32} />
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

  // ── Garden wizard modal ───────────────────────────────────────────────────

  const CELL = 36;

  const wizardModal = (
    <Modal visible={showWizard} transparent animationType="fade">
      <View style={styles.wizardBackdrop}>
        <View style={[styles.wizardSheet, { backgroundColor: cardBg }]}>

          {wizardStep === 'details' ? (
            <>
              <Text style={[styles.wizardTitle, { color: textPrim }]}>🌻 Create Garden from Plan</Text>
              <Text style={[styles.wizardSub, { color: textSec }]}>
                {selectedKeys.length} plants from "{planName}" will be placed in a new garden.
              </Text>

              <Text style={[styles.configLabel, { color: textSec, marginTop: 16, marginBottom: 6 }]}>Garden name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
                value={wizardName}
                onChangeText={setWizardName}
                placeholder={`My ${planYear} Garden`}
                placeholderTextColor={textSec}
                autoFocus
              />

              <Text style={[styles.configLabel, { color: textSec, marginTop: 14, marginBottom: 10 }]}>Grid size</Text>
              <View style={styles.gridSizeRow}>
                <View style={styles.gridSizeGroup}>
                  <Text style={[styles.gridSizeLabel, { color: textSec }]}>Rows</Text>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity style={[styles.stepperBtn, { backgroundColor: inputBg }]} onPress={() => setWizardRows(r => Math.max(2, r - 1))}>
                      <Text style={[styles.stepperBtnText, { color: textPrim }]}>−</Text>
                    </TouchableOpacity>
                    <Text style={[styles.stepperVal, { color: textPrim }]}>{wizardRows}</Text>
                    <TouchableOpacity style={[styles.stepperBtn, { backgroundColor: inputBg }]} onPress={() => setWizardRows(r => Math.min(16, r + 1))}>
                      <Text style={[styles.stepperBtnText, { color: textPrim }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={[{ color: textSec, fontSize: 20, alignSelf: 'flex-end', paddingBottom: 6, paddingHorizontal: 8 }]}>×</Text>
                <View style={styles.gridSizeGroup}>
                  <Text style={[styles.gridSizeLabel, { color: textSec }]}>Columns</Text>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity style={[styles.stepperBtn, { backgroundColor: inputBg }]} onPress={() => setWizardCols(c => Math.max(2, c - 1))}>
                      <Text style={[styles.stepperBtnText, { color: textPrim }]}>−</Text>
                    </TouchableOpacity>
                    <Text style={[styles.stepperVal, { color: textPrim }]}>{wizardCols}</Text>
                    <TouchableOpacity style={[styles.stepperBtn, { backgroundColor: inputBg }]} onPress={() => setWizardCols(c => Math.min(20, c + 1))}>
                      <Text style={[styles.stepperBtnText, { color: textPrim }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <Text style={[styles.configLabel, { color: textSec, marginTop: 18, marginBottom: 10 }]}>Sun exposure</Text>
              <View style={styles.sunRow}>
                {([
                  { key: 'full_sun',    emoji: '☀️',  label: 'Full Sun' },
                  { key: 'partial_sun', emoji: '⛅',  label: 'Partial' },
                  { key: 'shade',       emoji: '🌑',  label: 'Shade' },
                ] as { key: 'full_sun' | 'partial_sun' | 'shade'; emoji: string; label: string }[]).map(({ key, emoji, label }) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.sunBtn, { borderColor: wizardSun === key ? G.sage : border, backgroundColor: wizardSun === key ? (isDark ? '#1a3a1a' : '#d8f3dc') : inputBg }]}
                    onPress={() => setWizardSun(key)}
                  >
                    <Text style={{ fontSize: 22 }}>{emoji}</Text>
                    <Text style={[styles.sunBtnLabel, { color: wizardSun === key ? G.hunter : textSec }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.wizardFooter, { marginTop: 24 }]}>
                <TouchableOpacity style={[styles.cancelBtn, { borderColor: border }]} onPress={() => setShowWizard(false)}>
                  <Text style={[styles.cancelBtnText, { color: textSec }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nextBtn, !wizardName.trim() && { opacity: 0.4 }]}
                  onPress={() => setWizardStep('placement')}
                  disabled={!wizardName.trim()}
                >
                  <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.nextBtnGrad}>
                    <Text style={styles.nextBtnText}>Next: Place Plants →</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          ) : wizardStep === 'placement' ? (
            <>
              <View style={styles.wizardPlacementHeader}>
                <Text style={[styles.wizardTitle, { color: textPrim }]}>📍 Place Plants</Text>
                <Text style={[styles.wizardSub, { color: textSec }]}>
                  Tap a plant below, then tap grid cells to place it. Tap a placed cell again to remove.
                </Text>
              </View>

              {/* Plant palette */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.palette} contentContainerStyle={styles.paletteContent}>
                <TouchableOpacity
                  style={[styles.paletteChip, { backgroundColor: inputBg, borderColor: wizardActivePlant === null ? '#e03131' : border }]}
                  onPress={() => setWizardActivePlant(null)}
                >
                  <Text style={{ fontSize: 18 }}>🗑️</Text>
                  <Text style={[styles.paletteChipLabel, { color: textSec }]}>Erase</Text>
                </TouchableOpacity>
                {selectedKeys.map(k => {
                  const entry = PLANT_CATALOG[k];
                  if (!entry) return null;
                  const count = Object.values(wizardPlacements).filter(v => v === k).length;
                  const isActive = wizardActivePlant === k;
                  return (
                    <TouchableOpacity
                      key={k}
                      style={[styles.paletteChip, { backgroundColor: isActive ? (isDark ? '#1a3a1a' : '#d8f3dc') : inputBg, borderColor: isActive ? G.sage : border }]}
                      onPress={() => setWizardActivePlant(isActive ? null : k)}
                    >
                      <Text style={{ fontSize: 20 }}>{getPlantIcon(entry.name).emoji}</Text>
                      <Text style={[styles.paletteChipLabel, { color: textPrim }]} numberOfLines={1}>{entry.name}</Text>
                      {count > 0 && (
                        <View style={styles.paletteCount}>
                          <Text style={styles.paletteCountText}>×{count}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Grid */}
              <ScrollView horizontal showsHorizontalScrollIndicator style={styles.gridScroll}>
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
                  {Array.from({ length: wizardRows }, (_, row) => (
                    <View key={row} style={styles.gridRow}>
                      {Array.from({ length: wizardCols }, (_, col) => {
                        const cellKey = `${row}_${col}`;
                        const plantKey = wizardPlacements[cellKey];
                        const plantEntry = plantKey ? PLANT_CATALOG[plantKey] : null;
                        return (
                          <TouchableOpacity
                            key={col}
                            style={[
                              styles.gridCell,
                              { width: CELL, height: CELL, borderColor: isDark ? colors.border : G.mist },
                              plantEntry && { backgroundColor: isDark ? '#1a3a1a' : '#d8f3dc' },
                            ]}
                            onPress={() => handleCellPress(row, col)}
                            activeOpacity={0.7}
                          >
                            {plantEntry ? (
                              <Text style={{ fontSize: CELL * 0.52, lineHeight: CELL }}>
                                {getPlantIcon(plantEntry.name).emoji}
                              </Text>
                            ) : wizardActivePlant ? (
                              <Text style={{ fontSize: 14, color: isDark ? colors.border : G.mist }}>+</Text>
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </ScrollView>
              </ScrollView>

              <Text style={[styles.wizardPlacedCount, { color: textSec }]}>
                {placedCount === 0 ? 'No plants placed yet' : `${placedCount} plant${placedCount !== 1 ? 's' : ''} placed in ${wizardName}`}
              </Text>

              <View style={styles.wizardFooter}>
                <TouchableOpacity style={[styles.cancelBtn, { borderColor: border }]} onPress={() => setWizardStep('details')}>
                  <Text style={[styles.cancelBtnText, { color: textSec }]}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nextBtn, placedCount === 0 && { opacity: 0.4 }]}
                  onPress={() => setWizardStep('review')}
                  disabled={placedCount === 0}
                >
                  <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.nextBtnGrad}>
                    <Text style={styles.nextBtnText}>Review Plan ({placedCount}) →</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          ) : wizardStep === 'review' ? (
              <>
                <Text style={[styles.wizardTitle, { color: textPrim }]}>📋 Plan Review</Text>
                <Text style={[styles.wizardSub, { color: textSec }]}>
                  {wizardName} · {planYear} · {REVIEW_SUN_EMOJI[wizardSun]} {REVIEW_SUN_LBL[wizardSun]} · {wizardRows}×{wizardCols}
                </Text>

                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 12 }}>
                  {/* Grid */}
                  <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginBottom: 16 }}>
                    <View>
                      {Array.from({ length: wizardRows }, (_, row) => (
                        <View key={row} style={{ flexDirection: 'row' }}>
                          {Array.from({ length: wizardCols }, (_, col) => {
                            const pk = wizardPlacements[`${row}_${col}`];
                            const pe = pk ? PLANT_CATALOG[pk] : null;
                            return (
                              <View
                                key={col}
                                style={[
                                  styles.gridCell,
                                  { width: REVIEW_CELL, height: REVIEW_CELL, borderColor: isDark ? colors.border : G.mist },
                                  pe && { backgroundColor: isDark ? '#1a3a1a' : '#d8f3dc' },
                                ]}
                              >
                                {pe && <Text style={{ fontSize: REVIEW_CELL * 0.54, lineHeight: REVIEW_CELL }}>{getPlantIcon(pe.name).emoji}</Text>}
                              </View>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  </ScrollView>

                  {/* Plant schedule */}
                  <Text style={[styles.sectionTitle, { color: textPrim, marginBottom: 10 }]}>🌱 Planting Schedule</Text>
                  {reviewEntries.map(({ key, entry, seedStartDate, transplantDate, directSowDate, harvestStart, harvestEnd }) => (
                    <View key={key} style={[styles.reviewCard, { backgroundColor: isDark ? colors.bgElement : '#f0f7ee', borderColor: border }]}>
                      <View style={styles.reviewCardHeader}>
                        <Text style={{ fontSize: 24 }}>{getPlantIcon(entry.name).emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.reviewCardName, { color: textPrim }]}>{entry.name}</Text>
                          <Text style={[styles.reviewCardPos, { color: textSec }]}>{cellsForKey(key)}</Text>
                        </View>
                        <Text style={[styles.reviewCardCount, { color: G.sage }]}>
                          ×{Object.values(wizardPlacements).filter(v => v === key).length}
                        </Text>
                      </View>
                      <View style={styles.reviewTimeline}>
                        {seedStartDate && (
                          <View style={styles.reviewRow}>
                            <View style={[styles.reviewDot, { backgroundColor: '#74c0fc' }]} />
                            <Text style={[styles.reviewRowLabel, { color: textSec }]}>Start seeds indoors</Text>
                            <Text style={[styles.reviewRowDate, { color: textPrim }]}>{fmt(seedStartDate)}</Text>
                          </View>
                        )}
                        {transplantDate && (
                          <View style={styles.reviewRow}>
                            <View style={[styles.reviewDot, { backgroundColor: '#52b788' }]} />
                            <Text style={[styles.reviewRowLabel, { color: textSec }]}>Transplant outside</Text>
                            <Text style={[styles.reviewRowDate, { color: textPrim }]}>{fmt(transplantDate)}</Text>
                          </View>
                        )}
                        {!seedStartDate && (
                          <View style={styles.reviewRow}>
                            <View style={[styles.reviewDot, { backgroundColor: '#52b788' }]} />
                            <Text style={[styles.reviewRowLabel, { color: textSec }]}>Direct sow</Text>
                            <Text style={[styles.reviewRowDate, { color: textPrim }]}>{fmt(directSowDate)}</Text>
                          </View>
                        )}
                        <View style={styles.reviewRow}>
                          <View style={[styles.reviewDot, { backgroundColor: '#a9e34b' }]} />
                          <Text style={[styles.reviewRowLabel, { color: textSec }]}>Expected harvest</Text>
                          <Text style={[styles.reviewRowDate, { color: textPrim }]}>{fmt(harvestStart)} – {fmt(harvestEnd)}</Text>
                        </View>
                      </View>
                      {entry.notes && (
                        <Text style={[styles.reviewNote, { color: textSec }]}>💡 {entry.notes}</Text>
                      )}
                    </View>
                  ))}
                  <View style={{ height: 8 }} />
                </ScrollView>

                <View style={[styles.wizardFooter, { marginTop: 8 }]}>
                  <TouchableOpacity style={[styles.cancelBtn, { borderColor: border }]} onPress={() => setWizardStep('placement')}>
                    <Text style={[styles.cancelBtnText, { color: textSec }]}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.printBtn, { borderColor: G.sage }]}
                    onPress={() => {
                      import('@/lib/garden-pdf').then(m => m.printPlannerReport({
                        gardenName: wizardName, year: planYear, sun: wizardSun,
                        rows: wizardRows, cols: wizardCols,
                        placements: wizardPlacements,
                        lastFrost, firstFrost,
                        planEntries: reviewEntries,
                      }));
                    }}
                  >
                    <Text style={[styles.printBtnText, { color: G.hunter }]}>🖨️ Print</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.nextBtn, converting && { opacity: 0.4 }]}
                    onPress={convertToGarden}
                    disabled={converting}
                  >
                    <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.nextBtnGrad}>
                      <Text style={styles.nextBtnText}>{converting ? 'Creating…' : '🌱 Create Garden'}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
          ) : null}
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
      <TouchableOpacity style={[styles.saveBtn, { borderColor: G.sage, marginTop: 16 }]} onPress={savePlan}>
        <Text style={[styles.saveBtnText, { color: G.hunter }]}>💾 Save Plan</Text>
      </TouchableOpacity>
      {selectedKeys.length > 0 && (
        <TouchableOpacity style={[styles.convertBtn, { marginTop: 8 }]} onPress={openWizard}>
          <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.convertBtnGrad}>
            <Text style={styles.convertBtnText}>🌻 Convert to Garden…</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
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
        {wizardModal}
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
      {wizardModal}
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

  saveBtn:           { borderRadius: R.md, borderWidth: 2, paddingVertical: 12, alignItems: 'center' },
  saveBtnText:       { fontSize: 15, fontWeight: '700' },
  convertBtn:        { borderRadius: R.lg, overflow: 'hidden', ...Shadow.card },
  convertBtnGrad:    { paddingVertical: 13, alignItems: 'center' },
  convertBtnText:    { color: G.cloud, fontWeight: '700', fontSize: 15 },

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

  // Garden Goals
  goalLabel:    { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6, marginTop: 2 },
  goalRow:      { marginBottom: 10, flexGrow: 0 },
  goalChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: R.full, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 7 },
  goalEmoji:    { fontSize: 16 },
  goalChipText: { fontSize: 13, fontWeight: '600' },

  // Modals (picker)
  modalBackdrop:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBackdropCenter: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modal:               { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 32 : 20, paddingTop: 16, maxHeight: '88%' },
  modalCenter:         { width: '100%', maxWidth: 480, borderRadius: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHandle:         { width: 40, height: 4, borderRadius: 2, backgroundColor: '#d0d8d4', alignSelf: 'center', marginBottom: 16 },
  modalTitle:          { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  input:               { borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1.5, marginBottom: 8 },
  pickerRow:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, gap: 10, borderRadius: 6 },
  pickerEmoji:         { fontSize: 22, width: 32, textAlign: 'center' },
  pickerName:          { fontSize: 15, fontWeight: '600' },
  pickerMeta:          { fontSize: 12, marginTop: 2 },
  doneBtn:             { marginTop: 12, borderRadius: R.lg, overflow: 'hidden', ...Shadow.soft },
  doneBtnGrad:         { paddingVertical: 13, alignItems: 'center' },
  doneBtnText:         { color: G.cloud, fontWeight: '700', fontSize: 15 },

  // Garden wizard
  wizardBackdrop:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  wizardSheet:            { width: '100%', maxWidth: 600, borderRadius: 20, padding: 24, maxHeight: '92%' },
  wizardTitle:            { fontSize: 19, fontWeight: '800', marginBottom: 4 },
  wizardSub:              { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  wizardPlacementHeader:  { marginBottom: 10 },
  wizardPlacedCount:      { fontSize: 12, textAlign: 'center', marginTop: 8 },
  wizardFooter:           { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn:              { borderRadius: R.md, borderWidth: 1.5, paddingVertical: 11, paddingHorizontal: 18, justifyContent: 'center' },
  cancelBtnText:          { fontSize: 14, fontWeight: '600' },
  nextBtn:                { flex: 1, borderRadius: R.lg, overflow: 'hidden', ...Shadow.card },
  nextBtnGrad:            { paddingVertical: 12, alignItems: 'center' },
  nextBtnText:            { color: G.cloud, fontWeight: '700', fontSize: 15 },

  // Sun exposure picker
  sunRow:      { flexDirection: 'row', gap: 8 },
  sunBtn:      { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: R.md, borderWidth: 2, gap: 4 },
  sunBtnLabel: { fontSize: 11, fontWeight: '600' },

  // Grid size steppers
  gridSizeRow:   { flexDirection: 'row', alignItems: 'center' },
  gridSizeGroup: { flex: 1 },
  gridSizeLabel: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  stepperRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperBtn:    { width: 34, height: 34, borderRadius: R.full, justifyContent: 'center', alignItems: 'center' },
  stepperBtnText:{ fontSize: 20, fontWeight: '700', lineHeight: 22 },
  stepperVal:    { fontSize: 20, fontWeight: '800', minWidth: 32, textAlign: 'center' },

  // Plant palette (horizontal chip row)
  palette:        { marginVertical: 10 },
  paletteContent: { gap: 8, paddingVertical: 2 },
  paletteChip:    { alignItems: 'center', borderRadius: R.md, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 6, minWidth: 64 },
  paletteChipLabel:{ fontSize: 10, fontWeight: '600', marginTop: 2, maxWidth: 60, textAlign: 'center' },
  paletteCount:   { position: 'absolute', top: -4, right: -4, backgroundColor: G.sage, borderRadius: 8, paddingHorizontal: 4 },
  paletteCountText:{ fontSize: 10, color: '#fff', fontWeight: '700' },

  // Review step
  reviewCard:       { borderRadius: R.md, borderWidth: 1, padding: 12, marginBottom: 10 },
  reviewCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewCardName:   { fontSize: 15, fontWeight: '700' },
  reviewCardPos:    { fontSize: 11, marginTop: 1 },
  reviewCardCount:  { fontSize: 13, fontWeight: '700' },
  reviewTimeline:   { gap: 6 },
  reviewRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewDot:        { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  reviewRowLabel:   { flex: 1, fontSize: 12 },
  reviewRowDate:    { fontSize: 12, fontWeight: '600' },
  reviewNote:       { fontSize: 11, fontStyle: 'italic', marginTop: 8, lineHeight: 16 },
  printBtn:         { borderRadius: R.md, borderWidth: 2, paddingVertical: 11, paddingHorizontal: 14, justifyContent: 'center' },
  printBtnText:     { fontSize: 14, fontWeight: '700' },

  // Garden grid
  gridScroll:     { marginVertical: 4 },
  gridRow:        { flexDirection: 'row' },
  gridCell:       { borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
});
