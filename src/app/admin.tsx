/**
 * Web-only admin portal for the plant catalogue.
 *
 * FIRST-TIME SETUP — create this PocketBase collection once in your PB admin (/_/):
 *   Name:   plant_icons
 *   Fields:
 *     plant_key  → Plain text, required
 *     image      → File, max 1 file, accept: image/*
 *   List/View rules: "" (public read)
 *   Create/Update/Delete rules: @request.auth.id != "" (authenticated write)
 */

import { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, Platform, ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { G, R, Shadow } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import { useAuth } from '@/hooks/use-auth';
import { PLANT_CATALOG, SUN_EMOJIS } from '@/lib/plant-catalog';
import type { CatalogEntry, SunRequirement, PlantCategory } from '@/lib/plant-catalog';
import { getPlantIcon } from '@/lib/plant-icons';
import {
  loadPlantIconOverrides, getCustomIconUrl,
  uploadPlantIcon, deletePlantIcon, invalidateIconCache,
} from '@/lib/plant-icon-overrides';

const ADMIN_EMAIL = 'kwardthyfault@gmail.com';
const OVERRIDES_KEY = 'gg_catalog_overrides';

type PlantOverride = Partial<CatalogEntry> & { emoji?: string; deleted?: boolean };
type OverrideMap = Record<string, PlantOverride>;

async function loadOverrides(): Promise<OverrideMap> {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

async function saveOverrides(overrides: OverrideMap): Promise<void> {
  try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides)); } catch {}
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
      merged[key] = {
        name: key, aliases: [], category: 'vegetable',
        sunRequirement: 'full_sun', waterNeeds: 'medium',
        waterIntervalDays: 3, goodCompanions: [], badCompanions: [],
        ...override,
      } as any;
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

  const bg      = isDark ? colors.bg        : G.foam;
  const cardBg  = isDark ? colors.bgCard    : G.cloud;
  const textPrim= isDark ? colors.text      : G.forest;
  const textSec = isDark ? colors.textSec   : G.stone;
  const border  = isDark ? colors.border    : G.mist;
  const inputBg = isDark ? colors.bgElement : G.foam;

  const [overrides, setOverrides]   = useState<OverrideMap>({});
  const [iconUrls, setIconUrls]     = useState<Record<string, string>>({});
  const [search, setSearch]         = useState('');
  const [editState, setEditState]   = useState<EditState | null>(null);
  const [saving, setSaving]         = useState(false);
  const [loading, setLoading]       = useState(true);
  const [collectionOk, setCollectionOk] = useState<boolean | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingUploadKey = useRef<string | null>(null);

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
    Promise.all([
      loadOverrides(),
      loadPlantIconOverrides(),
    ]).then(([o, icons]) => {
      setOverrides(o);
      setIconUrls(icons);
      setCollectionOk(true);
      setLoading(false);
    }).catch(() => {
      setCollectionOk(false);
      setLoading(false);
    });
  }, [user]);

  // Wire up the hidden file input (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      const key = pendingUploadKey.current;
      if (!file || !key) return;
      setUploadingKey(key);
      try {
        const objectUrl = URL.createObjectURL(file);
        const url = await uploadPlantIcon(key, {
          uri: objectUrl,
          name: file.name,
          type: file.type,
        });
        setIconUrls(prev => ({ ...prev, [key]: url }));
        URL.revokeObjectURL(objectUrl);
      } catch (e: any) {
        Alert.alert('Upload failed', e?.message ?? 'Could not upload icon. Make sure the plant_icons collection exists in PocketBase.');
      } finally {
        setUploadingKey(null);
        pendingUploadKey.current = null;
        input.value = '';
      }
    });
    document.body.appendChild(input);
    fileInputRef.current = input as any;
    return () => { input.remove(); };
  }, []);

  function triggerUpload(key: string) {
    pendingUploadKey.current = key;
    (fileInputRef.current as any)?.click();
  }

  async function removeCustomIcon(key: string) {
    setUploadingKey(key);
    try {
      await deletePlantIcon(key);
      invalidateIconCache();
      setIconUrls(prev => { const n = { ...prev }; delete n[key]; return n; });
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not remove icon');
    } finally {
      setUploadingKey(null);
    }
  }

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

  function openEdit(key: string, isNew = false) {
    const base = PLANT_CATALOG[key];
    const override = overrides[key] ?? {};
    setEditState({
      key,
      name: override.name ?? base?.name ?? key,
      emoji: override.emoji ?? getPlantIcon(override.name ?? base?.name ?? key).emoji,
      sunRequirement: override.sunRequirement ?? base?.sunRequirement ?? 'full_sun',
      waterIntervalDays: override.waterIntervalDays ?? base?.waterIntervalDays ?? 3,
      category: override.category ?? base?.category ?? 'vegetable',
      notes: override.notes ?? base?.notes ?? '',
      isNew,
    });
  }

  function openAddNew() {
    setEditState({
      key: `custom_${Date.now()}`,
      name: '', emoji: '🌱', sunRequirement: 'full_sun',
      waterIntervalDays: 3, category: 'vegetable', notes: '', isNew: true,
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
    Alert.alert('Remove Plant', `Remove "${getDisplayName(key)}" from the catalogue?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const updated = { ...overrides, [key]: { ...overrides[key], deleted: true } };
        await saveOverrides(updated);
        setOverrides(updated);
      }},
    ]);
  }

  async function restorePlant(key: string) {
    const updated = { ...overrides };
    if (updated[key]) { delete updated[key].deleted; }
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
      <LinearGradient colors={[G.forest, G.hunter]} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>⚙️ Plant Catalogue Admin</Text>
        <View style={{ width: 36 }} />
      </LinearGradient>

      {/* Collection setup banner */}
      {collectionOk === false && (
        <View style={styles.setupBanner}>
          <Text style={styles.setupTitle}>📋 One-time setup required</Text>
          <Text style={styles.setupBody}>
            Create a <Text style={styles.setupCode}>plant_icons</Text> collection in your PocketBase admin{'\n'}
            with fields: <Text style={styles.setupCode}>plant_key</Text> (text) and <Text style={styles.setupCode}>image</Text> (file).{'\n'}
            Set list/view rules to <Text style={styles.setupCode}>""</Text> and write rules to <Text style={styles.setupCode}>@request.auth.id != ""</Text>
          </Text>
        </View>
      )}

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
          const customUrl = iconUrls[key];
          const defaultIcon = getPlantIcon(getDisplayName(key));
          const isUploading = uploadingKey === key;

          return (
            <View key={key} style={[styles.row, { backgroundColor: cardBg, borderColor: border }]}>
              {/* Icon preview */}
              <TouchableOpacity style={styles.iconWrap} onPress={() => triggerUpload(key)} disabled={isUploading}>
                {isUploading ? (
                  <ActivityIndicator color={G.hunter} size="small" />
                ) : customUrl ? (
                  <Image source={{ uri: customUrl }} style={styles.iconImg} />
                ) : (
                  <View style={[styles.iconEmoji, { backgroundColor: defaultIcon.bg }]}>
                    <Text style={styles.iconEmojiText}>{defaultIcon.emoji}</Text>
                  </View>
                )}
                <Text style={styles.iconEditHint}>{customUrl ? '✏️' : '📷'}</Text>
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text style={[styles.rowName, { color: textPrim }]}>{getDisplayName(key)}</Text>
                <Text style={[styles.rowMeta, { color: textSec }]}>
                  {SUN_EMOJIS[(overrides[key]?.sunRequirement ?? base?.sunRequirement) as SunRequirement]} ·
                  💧 every {overrides[key]?.waterIntervalDays ?? base?.waterIntervalDays ?? '?'}d ·
                  {overrides[key]?.category ?? base?.category ?? 'vegetable'}
                  {hasOverride ? ' · ✏️' : ''}{customUrl ? ' · 🖼️' : ''}
                </Text>
              </View>

              <View style={styles.rowActions}>
                {customUrl && (
                  <TouchableOpacity style={styles.removeIconBtn} onPress={() => removeCustomIcon(key)} disabled={isUploading}>
                    <Text style={styles.removeIconText}>✕ icon</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(key)}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deletePlant(key)}>
                  <Text style={styles.deleteBtnText}>🗑</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {deletedKeys.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: textSec, marginTop: 16 }]}>REMOVED ({deletedKeys.length})</Text>
            {deletedKeys.map(key => (
              <View key={key} style={[styles.row, { backgroundColor: cardBg, borderColor: border, opacity: 0.5 }]}>
                <View style={[styles.iconWrap, { justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 20 }}>🗑</Text>
                </View>
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

      {/* Edit / Add Modal */}
      <Modal visible={!!editState} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setEditState(null)} />
          <View style={[styles.modal, { backgroundColor: cardBg }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: textPrim }]}>
              {editState?.isNew ? '🌱 Add Plant' : `✏️ Edit: ${editState?.name || editState?.key}`}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: 480 }}>

              <Text style={[styles.fieldLabel, { color: textSec }]}>FALLBACK EMOJI (used when no image is uploaded)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim, fontSize: 28, textAlign: 'center' }]}
                value={editState?.emoji ?? '🌱'}
                onChangeText={v => setEditState(s => s ? { ...s, emoji: v } : s)}
                maxLength={4}
              />

              <Text style={[styles.fieldLabel, { color: textSec }]}>NAME</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
                value={editState?.name ?? ''}
                onChangeText={v => setEditState(s => s ? { ...s, name: v } : s)}
                placeholder="Plant name"
                placeholderTextColor={textSec}
              />

              <Text style={[styles.fieldLabel, { color: textSec }]}>CATEGORY</Text>
              <View style={styles.chipRow}>
                {CAT_OPTIONS.map(c => (
                  <TouchableOpacity key={c}
                    style={[styles.chip, editState?.category === c && styles.chipActive]}
                    onPress={() => setEditState(s => s ? { ...s, category: c } : s)}
                  >
                    <Text style={[styles.chipText, editState?.category === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: textSec }]}>SUNLIGHT</Text>
              <View style={styles.chipRow}>
                {SUN_OPTIONS.map(s => (
                  <TouchableOpacity key={s}
                    style={[styles.chip, editState?.sunRequirement === s && styles.chipActive]}
                    onPress={() => setEditState(st => st ? { ...st, sunRequirement: s } : st)}
                  >
                    <Text style={[styles.chipText, editState?.sunRequirement === s && styles.chipTextActive]}>
                      {SUN_EMOJIS[s]} {s.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: textSec }]}>WATER EVERY (DAYS)</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity style={styles.stepBtn}
                  onPress={() => setEditState(s => s ? { ...s, waterIntervalDays: Math.max(1, s.waterIntervalDays - 1) } : s)}>
                  <Text style={styles.stepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.stepValue, { color: textPrim }]}>{editState?.waterIntervalDays ?? 3} days</Text>
                <TouchableOpacity style={styles.stepBtn}
                  onPress={() => setEditState(s => s ? { ...s, waterIntervalDays: Math.min(30, s.waterIntervalDays + 1) } : s)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { color: textSec }]}>NOTES (optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim, minHeight: 72 }]}
                value={editState?.notes ?? ''}
                onChangeText={v => setEditState(s => s ? { ...s, notes: v } : s)}
                placeholder="Growing tips…"
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
  container:    { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 16, paddingHorizontal: 20,
  },
  backBtn:      { width: 36, height: 36, borderRadius: R.full, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  backText:     { color: G.cloud, fontSize: 16, fontWeight: '600' },
  headerTitle:  { color: G.cloud, fontSize: 17, fontWeight: '700' },

  setupBanner:  { backgroundColor: '#fff8e1', padding: 14, marginHorizontal: 12, marginTop: 10, borderRadius: R.md, borderLeftWidth: 4, borderLeftColor: '#f59e0b' },
  setupTitle:   { fontWeight: '700', color: '#92400e', marginBottom: 6, fontSize: 14 },
  setupBody:    { fontSize: 12, color: '#78350f', lineHeight: 18 },
  setupCode:    { fontFamily: 'monospace', backgroundColor: '#fef3c7', color: '#92400e' },

  searchInput:  { margin: 12, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1.5 },
  list:         { paddingHorizontal: 12, paddingBottom: 40 },
  addBtn:       { marginBottom: 16, borderRadius: R.lg, overflow: 'hidden', ...Shadow.card },
  addBtnGrad:   { paddingVertical: 14, alignItems: 'center' },
  addBtnText:   { color: G.cloud, fontWeight: '700', fontSize: 15 },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },

  row:          { flexDirection: 'row', alignItems: 'center', borderRadius: R.md, borderWidth: 1, marginBottom: 8, padding: 10, gap: 10 },
  iconWrap:     { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer' } as any,
  iconImg:      { width: 48, height: 48, borderRadius: R.sm },
  iconEmoji:    { width: 48, height: 48, borderRadius: R.sm, justifyContent: 'center', alignItems: 'center' },
  iconEmojiText:{ fontSize: 26, lineHeight: 48, textAlign: 'center' },
  iconEditHint: { position: 'absolute', bottom: -2, right: -2, fontSize: 12 },
  rowName:      { fontSize: 15, fontWeight: '600' },
  rowMeta:      { fontSize: 12, marginTop: 2 },
  rowActions:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  removeIconBtn:{ backgroundColor: '#fff5f5', borderRadius: R.sm, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: '#ffc9c9' },
  removeIconText:{ color: '#e03131', fontSize: 11, fontWeight: '600' },
  editBtn:      { backgroundColor: G.dew, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: G.mist },
  editBtnText:  { color: G.hunter, fontSize: 13, fontWeight: '600' },
  deleteBtn:    { paddingHorizontal: 6, paddingVertical: 6 },
  deleteBtnText:{ fontSize: 16 },

  modalBackdrop:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modal:        { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 32 : 20, paddingTop: 12 },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: '#d0d8d4', alignSelf: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  fieldLabel:   { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginTop: 12 },
  input:        { borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1.5, marginBottom: 4 },
  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip:         { borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: G.foam, borderWidth: 1.5, borderColor: G.mist },
  chipActive:   { backgroundColor: G.hunter, borderColor: G.hunter },
  chipText:     { color: G.hunter, fontSize: 13, fontWeight: '500' },
  chipTextActive:{ color: G.cloud, fontWeight: '700' },
  stepperRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 4 },
  stepBtn:      { width: 36, height: 36, borderRadius: R.full, backgroundColor: G.dew, justifyContent: 'center', alignItems: 'center' },
  stepBtnText:  { fontSize: 22, fontWeight: '700', color: G.hunter, lineHeight: 24 },
  stepValue:    { fontSize: 18, fontWeight: '700', minWidth: 80, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, marginTop: 8, borderTopWidth: 1, borderTopColor: G.dew },
  cancelBtn:    { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#fff5f5', borderWidth: 1.5, borderColor: '#ffc9c9' },
  cancelText:   { color: '#e03131', fontSize: 15, fontWeight: '700' },
  saveBtn:      { borderRadius: R.lg, overflow: 'hidden', ...Shadow.soft },
  saveBtnGrad:  { paddingVertical: 12, paddingHorizontal: 28 },
  saveBtnText:  { color: G.cloud, fontWeight: '700', fontSize: 15 },
});
