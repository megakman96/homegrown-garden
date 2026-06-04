import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { G, R, Shadow } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import { useAuth } from '@/hooks/use-auth';
import { PLANT_CATALOG, SUN_EMOJIS } from '@/lib/plant-catalog';
import type { CatalogEntry, SunRequirement, PlantCategory } from '@/lib/plant-catalog';

const ADMIN_EMAIL = 'kwardthyfault@gmail.com';
const OVERRIDES_KEY = 'gg_catalog_overrides';
const ICONS_KEY = 'gg_icon_overrides';

type PlantOverride = Partial<CatalogEntry> & { emoji?: string; deleted?: boolean };
type OverrideMap = Record<string, PlantOverride>;

async function loadOverrides(): Promise<OverrideMap> {
  try {
    if (Platform.OS === 'web') {
      const raw = localStorage.getItem(OVERRIDES_KEY);
      return raw ? JSON.parse(raw) : {};
    }
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const raw = await AsyncStorage.getItem(OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

async function saveOverrides(overrides: OverrideMap): Promise<void> {
  try {
    const json = JSON.stringify(overrides);
    if (Platform.OS === 'web') {
      localStorage.setItem(OVERRIDES_KEY, json);
    } else {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem(OVERRIDES_KEY, json);
    }
  } catch {}
}

export async function loadMergedCatalog(): Promise<Record<string, CatalogEntry & { emoji?: string }>> {
  const overrides = await loadOverrides();
  const merged: Record<string, CatalogEntry & { emoji?: string }> = {};
  for (const [key, entry] of Object.entries(PLANT_CATALOG)) {
    if (overrides[key]?.deleted) continue;
    merged[key] = { ...entry, ...overrides[key] };
  }
  for (const [key, override] of Object.entries(overrides)) {
    if (!PLANT_CATALOG[key] && !override.deleted) {
      merged[key] = { name: key, aliases: [], category: 'vegetable', sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3, goodCompanions: [], badCompanions: [], ...override } as any;
    }
  }
  return merged;
}

const SUN_OPTIONS: SunRequirement[] = ['full_sun', 'partial_sun', 'shade'];
const CAT_OPTIONS: PlantCategory[] = ['vegetable', 'herb', 'fruit', 'flower'];

interface EditState {
  key: string;
  name: string;
  emoji: string;
  sunRequirement: SunRequirement;
  waterIntervalDays: number;
  category: PlantCategory;
  notes: string;
  isNew: boolean;
}

export default function AdminScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDark, colors } = useAppTheme();

  const bg = isDark ? colors.bg : G.foam;
  const cardBg = isDark ? colors.bgCard : G.cloud;
  const textPrim = isDark ? colors.text : G.forest;
  const textSec = isDark ? colors.textSec : G.stone;
  const border = isDark ? colors.border : G.mist;
  const inputBg = isDark ? colors.bgElement : G.foam;

  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [search, setSearch] = useState('');
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      Alert.alert('Web Only', 'The admin portal is only accessible on the web.');
      router.back();
      return;
    }
    if (user?.email !== ADMIN_EMAIL) {
      Alert.alert('Access Denied', 'This page is for admins only.');
      router.back();
      return;
    }
    loadOverrides().then(o => { setOverrides(o); setLoading(false); });
  }, [user]);

  const allKeys = [
    ...Object.keys(PLANT_CATALOG),
    ...Object.keys(overrides).filter(k => !PLANT_CATALOG[k] && !overrides[k]?.deleted),
  ];
  const uniqueKeys = Array.from(new Set(allKeys));

  const filtered = uniqueKeys.filter(key => {
    if (overrides[key]?.deleted) return false;
    const entry = PLANT_CATALOG[key] ?? overrides[key];
    const name = overrides[key]?.name ?? entry?.name ?? key;
    return name.toLowerCase().includes(search.toLowerCase()) || key.includes(search.toLowerCase());
  });

  function getDisplayName(key: string): string {
    return overrides[key]?.name ?? PLANT_CATALOG[key]?.name ?? key;
  }

  function getDisplayEmoji(key: string): string {
    return overrides[key]?.emoji ?? '🌱';
  }

  function openEdit(key: string, isNew = false) {
    const base = PLANT_CATALOG[key];
    const override = overrides[key] ?? {};
    setEditState({
      key,
      name: override.name ?? base?.name ?? key,
      emoji: override.emoji ?? '🌱',
      sunRequirement: override.sunRequirement ?? base?.sunRequirement ?? 'full_sun',
      waterIntervalDays: override.waterIntervalDays ?? base?.waterIntervalDays ?? 3,
      category: override.category ?? base?.category ?? 'vegetable',
      notes: override.notes ?? base?.notes ?? '',
      isNew,
    });
  }

  function openAddNew() {
    const newKey = `custom_${Date.now()}`;
    setEditState({
      key: newKey,
      name: '',
      emoji: '🌱',
      sunRequirement: 'full_sun',
      waterIntervalDays: 3,
      category: 'vegetable',
      notes: '',
      isNew: true,
    });
  }

  async function saveEdit() {
    if (!editState) return;
    setSaving(true);
    const updated: OverrideMap = {
      ...overrides,
      [editState.key]: {
        ...(overrides[editState.key] ?? {}),
        name: editState.name.trim() || editState.key,
        emoji: editState.emoji,
        sunRequirement: editState.sunRequirement,
        waterIntervalDays: editState.waterIntervalDays,
        category: editState.category,
        notes: editState.notes.trim() || undefined,
      },
    };
    await saveOverrides(updated);
    setOverrides(updated);
    setEditState(null);
    setSaving(false);
  }

  async function deletePlant(key: string) {
    Alert.alert(
      'Remove Plant',
      `Remove "${getDisplayName(key)}" from the catalogue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: async () => {
          const updated = { ...overrides, [key]: { ...overrides[key], deleted: true } };
          await saveOverrides(updated);
          setOverrides(updated);
        }},
      ],
    );
  }

  async function restorePlant(key: string) {
    const updated = { ...overrides };
    if (updated[key]) delete updated[key].deleted;
    if (Object.keys(updated[key] ?? {}).length === 0) delete updated[key];
    await saveOverrides(updated);
    setOverrides(updated);
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={G.hunter} size="large" />
      </View>
    );
  }

  const deletedKeys = uniqueKeys.filter(k => overrides[k]?.deleted);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <LinearGradient colors={[G.forest, G.hunter]} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>⚙️ Plant Catalogue Admin</Text>
        <View style={{ width: 36 }} />
      </LinearGradient>

      <TextInput
        style={[styles.searchInput, { backgroundColor: cardBg, borderColor: border, color: textPrim }]}
        placeholder="Search plants…"
        placeholderTextColor={textSec}
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.addBtn} onPress={openAddNew}>
          <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addBtnGrad}>
            <Text style={styles.addBtnText}>+ Add New Plant</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { color: textSec }]}>PLANTS ({filtered.length})</Text>
        {filtered.map(key => {
          const hasOverride = !!overrides[key] && !overrides[key].deleted;
          const base = PLANT_CATALOG[key];
          return (
            <View key={key} style={[styles.row, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={styles.rowEmoji}>{getDisplayEmoji(key)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowName, { color: textPrim }]}>{getDisplayName(key)}</Text>
                <Text style={[styles.rowMeta, { color: textSec }]}>
                  {SUN_EMOJIS[(overrides[key]?.sunRequirement ?? base?.sunRequirement) as SunRequirement]} ·
                  💧 every {overrides[key]?.waterIntervalDays ?? base?.waterIntervalDays ?? '?'}d ·
                  {overrides[key]?.category ?? base?.category ?? 'vegetable'}
                  {hasOverride ? ' · ✏️ edited' : ''}
                </Text>
              </View>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(key)}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => deletePlant(key)}>
                <Text style={styles.deleteBtnText}>🗑</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {deletedKeys.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: textSec, marginTop: 16 }]}>REMOVED ({deletedKeys.length})</Text>
            {deletedKeys.map(key => (
              <View key={key} style={[styles.row, { backgroundColor: cardBg, borderColor: border, opacity: 0.5 }]}>
                <Text style={styles.rowEmoji}>🗑</Text>
                <Text style={[styles.rowName, { color: textSec, flex: 1 }]}>{PLANT_CATALOG[key]?.name ?? key}</Text>
                <TouchableOpacity style={styles.editBtn} onPress={() => restorePlant(key)}>
                  <Text style={styles.editBtnText}>Restore</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={!!editState} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setEditState(null)} />
          <View style={[styles.modal, { backgroundColor: cardBg }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: textPrim }]}>
              {editState?.isNew ? '🌱 Add Plant' : `✏️ Edit: ${editState?.name || editState?.key}`}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: 480 }}>
              {/* Emoji */}
              <Text style={[styles.fieldLabel, { color: textSec }]}>ICON (EMOJI)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim, fontSize: 28, textAlign: 'center' }]}
                value={editState?.emoji ?? '🌱'}
                onChangeText={v => setEditState(s => s ? { ...s, emoji: v } : s)}
                maxLength={4}
              />

              {/* Name */}
              <Text style={[styles.fieldLabel, { color: textSec }]}>NAME</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
                value={editState?.name ?? ''}
                onChangeText={v => setEditState(s => s ? { ...s, name: v } : s)}
                placeholder="Plant name"
                placeholderTextColor={textSec}
              />

              {/* Category */}
              <Text style={[styles.fieldLabel, { color: textSec }]}>CATEGORY</Text>
              <View style={styles.chipRow}>
                {CAT_OPTIONS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, editState?.category === c && styles.chipActive]}
                    onPress={() => setEditState(s => s ? { ...s, category: c } : s)}
                  >
                    <Text style={[styles.chipText, editState?.category === c && styles.chipTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sun requirement */}
              <Text style={[styles.fieldLabel, { color: textSec }]}>SUNLIGHT</Text>
              <View style={styles.chipRow}>
                {SUN_OPTIONS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, editState?.sunRequirement === s && styles.chipActive]}
                    onPress={() => setEditState(st => st ? { ...st, sunRequirement: s } : st)}
                  >
                    <Text style={[styles.chipText, editState?.sunRequirement === s && styles.chipTextActive]}>
                      {SUN_EMOJIS[s]} {s.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Water interval */}
              <Text style={[styles.fieldLabel, { color: textSec }]}>WATER EVERY (DAYS)</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setEditState(s => s ? { ...s, waterIntervalDays: Math.max(1, s.waterIntervalDays - 1) } : s)}
                >
                  <Text style={styles.stepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.stepValue, { color: textPrim }]}>{editState?.waterIntervalDays ?? 3} days</Text>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setEditState(s => s ? { ...s, waterIntervalDays: Math.min(30, s.waterIntervalDays + 1) } : s)}
                >
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Notes */}
              <Text style={[styles.fieldLabel, { color: textSec }]}>NOTES (optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim, minHeight: 72 }]}
                value={editState?.notes ?? ''}
                onChangeText={v => setEditState(s => s ? { ...s, notes: v } : s)}
                placeholder="Growing tips, companion notes…"
                placeholderTextColor={textSec}
                multiline
              />
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditState(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={saveEdit}
                disabled={saving}
              >
                <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtnGrad}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 16, paddingHorizontal: 20,
  },
  backBtn: { width: 36, height: 36, borderRadius: R.full, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  backText: { color: G.cloud, fontSize: 16, fontWeight: '600' },
  headerTitle: { color: G.cloud, fontSize: 17, fontWeight: '700' },
  searchInput: { margin: 12, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1.5 },
  list: { paddingHorizontal: 12, paddingBottom: 40 },
  addBtn: { marginBottom: 16, borderRadius: R.lg, overflow: 'hidden', ...Shadow.card },
  addBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  addBtnText: { color: G.cloud, fontWeight: '700', fontSize: 15 },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: R.md, borderWidth: 1, marginBottom: 8, padding: 12, gap: 10 },
  rowEmoji: { fontSize: 22, width: 34, textAlign: 'center' },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowMeta: { fontSize: 12, marginTop: 2 },
  editBtn: { backgroundColor: G.dew, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: G.mist },
  editBtnText: { color: G.hunter, fontSize: 13, fontWeight: '600' },
  deleteBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  deleteBtnText: { fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 32 : 20, paddingTop: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#d0d8d4', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginTop: 12 },
  input: { borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1.5, marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: G.foam, borderWidth: 1.5, borderColor: G.mist },
  chipActive: { backgroundColor: G.hunter, borderColor: G.hunter },
  chipText: { color: G.hunter, fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: G.cloud, fontWeight: '700' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 4 },
  stepBtn: { width: 36, height: 36, borderRadius: R.full, backgroundColor: G.dew, justifyContent: 'center', alignItems: 'center' },
  stepBtnText: { fontSize: 22, fontWeight: '700', color: G.hunter, lineHeight: 24 },
  stepValue: { fontSize: 18, fontWeight: '700', minWidth: 80, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, marginTop: 8, borderTopWidth: 1, borderTopColor: G.dew },
  cancelBtn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#fff5f5', borderWidth: 1.5, borderColor: '#ffc9c9' },
  cancelText: { color: '#e03131', fontSize: 15, fontWeight: '700' },
  saveBtn: { borderRadius: R.lg, overflow: 'hidden', ...Shadow.soft },
  saveBtnGrad: { paddingVertical: 12, paddingHorizontal: 28 },
  saveBtnText: { color: G.cloud, fontWeight: '700', fontSize: 15 },
});
