import { useEffect, useState, useRef, useCallback } from 'react';
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
  loadPlantIconOverrides,
  uploadPlantIcon, deletePlantIcon, invalidateIconCache,
} from '@/lib/plant-icon-overrides';
import { pb } from '@/lib/pb';

const ADMIN_EMAIL = 'kwardthyfault@gmail.com';
const OVERRIDES_KEY = 'gg_catalog_overrides';

type AdminTab = 'plants' | 'premium';
type PremiumDuration = 'week' | 'month' | 'year' | 'forever';

interface PremiumUser {
  id: string;
  email: string;
  name: string;
  promo_expires: string | null;
}

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

  const bg      = isDark ? colors.bg        : '#f8fafc';
  const cardBg  = isDark ? colors.bgCard    : '#ffffff';
  const textPrim= isDark ? colors.text      : '#1e293b';
  const textSec = isDark ? colors.textSec   : '#64748b';
  const border  = isDark ? colors.border    : '#e2e8f0';
  const inputBg = isDark ? colors.bgElement : '#f1f5f9';

  const [activeTab, setActiveTab]   = useState<AdminTab>('plants');

  // Plant catalogue state
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

  // Premium users state
  const [premiumUsers, setPremiumUsers]       = useState<PremiumUser[]>([]);
  const [premiumLoading, setPremiumLoading]   = useState(false);
  const [premiumSearch, setPremiumSearch]     = useState('');
  const [actingOn, setActingOn]               = useState<string | null>(null);
  const [grantingFor, setGrantingFor]         = useState<string | null>(null);

  // Add user modal state
  const [addUserOpen, setAddUserOpen]         = useState(false);
  const [newEmail, setNewEmail]               = useState('');
  const [newDuration, setNewDuration]         = useState<PremiumDuration | 'none'>('none');
  const [addingUser, setAddingUser]           = useState(false);
  const [addUserError, setAddUserError]       = useState<string | null>(null);

  const fetchPremiumUsers = useCallback(async () => {
    setPremiumLoading(true);
    try {
      const res = await pb.send('/api/admin/premium-users', { method: 'GET' });
      setPremiumUsers(res.users ?? []);
    } catch {
      Alert.alert('Error', 'Could not load users.');
    } finally {
      setPremiumLoading(false);
    }
  }, []);

  async function grantRevoke(userId: string, action: 'grant' | 'revoke', duration?: PremiumDuration) {
    setActingOn(userId);
    setGrantingFor(null);
    try {
      await pb.send('/api/admin/grant-premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, action, duration }),
      });
      await fetchPremiumUsers();
    } catch {
      Alert.alert('Error', 'Action failed. Try again.');
    } finally {
      setActingOn(null);
    }
  }

  function closeAddUser() {
    setAddUserOpen(false);
    setNewEmail('');
    setNewDuration('none');
    setAddUserError(null);
  }

  async function addUser() {
    if (!newEmail.trim()) return;
    setAddingUser(true);
    setAddUserError(null);
    try {
      await pb.send('/api/admin/grant-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim(), duration: newDuration }),
      });
      closeAddUser();
    } catch (e: any) {
      setAddUserError(e?.response?.message ?? e?.message ?? 'No account found with that email.');
    } finally {
      setAddingUser(false);
    }
  }

  function goBack() {
    try { router.back(); } catch {}
    router.replace('/(tabs)/profile' as any);
  }

  useEffect(() => {
    if (Platform.OS !== 'web') {
      Alert.alert('Web Only', 'The admin portal is only accessible on the web.');
      goBack();
      return;
    }
    if (!user) {
      Alert.alert('Access Denied', 'You must be logged in.');
      goBack();
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

  useEffect(() => {
    if (activeTab === 'premium' && premiumUsers.length === 0) {
      fetchPremiumUsers();
    }
  }, [activeTab]);

  // Wire up the hidden file input (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml';
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
    const name = getDisplayName(key);
    if (Platform.OS === 'web') {
      if (!window.confirm(`Remove "${name}" from the catalogue?`)) return;
      const updated = { ...overrides, [key]: { ...overrides[key], deleted: true } };
      await saveOverrides(updated);
      setOverrides(updated);
    } else {
      Alert.alert('Remove Plant', `Remove "${name}" from the catalogue?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: async () => {
          const updated = { ...overrides, [key]: { ...overrides[key], deleted: true } };
          await saveOverrides(updated);
          setOverrides(updated);
        }},
      ]);
    }
  }

  async function restorePlant(key: string) {
    const updated = { ...overrides };
    if (updated[key]) { delete updated[key].deleted; }
    if (Object.keys(updated[key] ?? {}).length === 0) delete updated[key];
    await saveOverrides(updated);
    setOverrides(updated);
  }

  async function patchOverride(key: string, field: 'sunRequirement' | 'waterIntervalDays', value: string | number) {
    const updated: OverrideMap = {
      ...overrides,
      [key]: { ...(overrides[key] ?? {}), [field]: value },
    };
    await saveOverrides(updated);
    setOverrides(updated);
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={G.hunter} size="large" />
        <Text style={[styles.loadingText, { color: textSec }]}>Loading catalogue…</Text>
      </View>
    );
  }

  const deletedKeys = uniqueKeys.filter(k => overrides[k]?.deleted);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>

      {/* Top nav bar */}
      <View style={[styles.topNav, { backgroundColor: cardBg, borderBottomColor: border }]}>
        <View style={styles.topNavInner}>
          <TouchableOpacity onPress={goBack} style={[styles.navBackBtn, { borderColor: border }]}>
            <Text style={[styles.navBackArrow, { color: textPrim }]}>←</Text>
            <Text style={[styles.navBackLabel, { color: textPrim }]}>Back to Profile</Text>
          </TouchableOpacity>
          <View style={styles.navBrand}>
            <Text style={[styles.navTitle, { color: textPrim }]}>Admin</Text>
            <Text style={[styles.navSub, { color: textSec }]}>
              {activeTab === 'plants' ? `Plant Catalogue · ${filtered.length} plants` : `Premium Users`}
            </Text>
          </View>
          <View style={[styles.tabSwitcher, { borderColor: border }]}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'plants' && styles.tabBtnActive]}
              onPress={() => setActiveTab('plants')}
            >
              <Text style={[styles.tabBtnText, { color: activeTab === 'plants' ? '#fff' : textSec }]}>Plants</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'premium' && styles.tabBtnActive]}
              onPress={() => setActiveTab('premium')}
            >
              <Text style={[styles.tabBtnText, { color: activeTab === 'premium' ? '#fff' : textSec }]}>Premium</Text>
            </TouchableOpacity>
          </View>
          {activeTab === 'plants' && (
            <TouchableOpacity onPress={openAddNew} style={styles.navAddBtn}>
              <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.navAddGrad}>
                <Text style={styles.navAddText}>+ Add Plant</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          {activeTab === 'premium' && (
            <>
              <TouchableOpacity onPress={fetchPremiumUsers} style={styles.navAddBtn}>
                <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.navAddGrad}>
                  <Text style={styles.navAddText}>↻ Refresh</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setAddUserError(null); setNewEmail(''); setNewDuration('none'); setAddUserOpen(true); }} style={styles.navAddBtn}>
                <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.navAddGrad}>
                  <Text style={styles.navAddText}>+ Add User</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Main content */}
      <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>

        {/* ── Premium Users Tab ── */}
        {activeTab === 'premium' && (
          <View>
            {/* Search */}
            <View style={[styles.toolbar, { backgroundColor: cardBg, borderColor: border }]}>
              <TextInput
                style={[styles.searchInput, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
                placeholder="Search by email or name…"
                placeholderTextColor={textSec}
                value={premiumSearch}
                onChangeText={setPremiumSearch}
              />
              <Text style={[styles.toolbarCount, { color: textSec }]}>
                {premiumUsers.length} users
              </Text>
            </View>

            {premiumLoading ? (
              <View style={{ alignItems: 'center', padding: 48 }}>
                <ActivityIndicator color={G.hunter} size="large" />
                <Text style={[styles.loadingText, { color: textSec }]}>Loading users…</Text>
              </View>
            ) : (
              <View style={[styles.table, { backgroundColor: cardBg, borderColor: border }]}>
                {/* Header */}
                <View style={[styles.tableHeader, { borderBottomColor: border }]}>
                  <Text style={[styles.thName, { color: textSec }]}>User</Text>
                  <Text style={[styles.thMeta, { color: textSec, width: 100 }]}>Status</Text>
                  <Text style={[styles.thMeta, { color: textSec, width: 160 }]}>Expires</Text>
                  <Text style={[styles.thActions, { color: textSec }]}>Actions</Text>
                </View>

                {premiumUsers
                  .filter(u => {
                    const q = premiumSearch.toLowerCase();
                    return !q || u.email.toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q);
                  })
                  .map((u, idx) => {
                    const isPremium = !!u.promo_expires && new Date(u.promo_expires) > new Date();
                    const expiry = u.promo_expires
                      ? isPremium && u.promo_expires.startsWith('2099') ? 'Lifetime' : new Date(u.promo_expires).toLocaleDateString()
                      : '—';
                    const isEven = idx % 2 === 0;
                    const acting = actingOn === u.id;
                    return (
                      <View
                        key={u.id}
                        style={[
                          styles.tableRow,
                          { borderBottomColor: border },
                          isEven && { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fafafa' },
                        ]}
                      >
                        <View style={styles.tdName}>
                          <Text style={[styles.plantName, { color: textPrim }]} numberOfLines={1}>{u.email}</Text>
                          {!!u.name && <Text style={[styles.plantKey, { color: textSec }]}>{u.name}</Text>}
                        </View>
                        <View style={[styles.tdMeta, { width: 100 }]}>
                          <View style={[styles.statusBadge, isPremium ? styles.statusPremium : styles.statusFree]}>
                            <Text style={[styles.statusText, { color: isPremium ? '#166534' : '#92400e' }]}>
                              {isPremium ? 'Premium' : 'Free'}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.tdMeta, { color: textSec, width: 160 }]}>{expiry}</Text>
                        <View style={styles.tdActions}>
                          {acting ? (
                            <ActivityIndicator color={G.hunter} size="small" />
                          ) : grantingFor === u.id ? (
                            <>
                              {(['week', 'month', 'year', 'forever'] as PremiumDuration[]).map(d => (
                                <TouchableOpacity
                                  key={d}
                                  style={[styles.actionBtn, styles.actionBtnGrant, { paddingHorizontal: 6 }]}
                                  onPress={() => grantRevoke(u.id, 'grant', d)}
                                >
                                  <Text style={[styles.actionBtnGrantText, { fontSize: 11 }]}>
                                    {d === 'week' ? '1 wk' : d === 'month' ? '1 mo' : d === 'year' ? '1 yr' : '∞'}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                              <TouchableOpacity
                                style={[styles.actionBtn, { borderColor: border, paddingHorizontal: 7 }]}
                                onPress={() => setGrantingFor(null)}
                              >
                                <Text style={{ fontSize: 12, color: textSec }}>✕</Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <>
                              {isPremium && (
                                <TouchableOpacity
                                  style={[styles.actionBtn, styles.actionBtnDanger]}
                                  onPress={() => {
                                    if (Platform.OS === 'web') {
                                      if (window.confirm(`Remove premium from ${u.email}?`)) grantRevoke(u.id, 'revoke');
                                    } else {
                                      Alert.alert('Revoke Premium', `Remove premium from ${u.email}?`, [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Revoke', style: 'destructive', onPress: () => grantRevoke(u.id, 'revoke') },
                                      ]);
                                    }
                                  }}
                                >
                                  <Text style={styles.actionBtnDangerText}>Revoke</Text>
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity
                                style={[styles.actionBtn, styles.actionBtnGrant]}
                                onPress={() => setGrantingFor(u.id)}
                              >
                                <Text style={styles.actionBtnGrantText}>{isPremium ? 'Modify ▾' : 'Grant ▾'}</Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </View>
                    );
                  })}

                {premiumUsers.length === 0 && (
                  <View style={styles.emptyRow}>
                    <Text style={[styles.emptyText, { color: textSec }]}>No users found.</Text>
                  </View>
                )}
              </View>
            )}
            <View style={{ height: 60 }} />
          </View>
        )}

        {/* ── Plant Catalogue Tab ── */}
        {activeTab === 'plants' && <>

        {/* Setup banner */}
        {collectionOk === false && (
          <View style={styles.setupBanner}>
            <Text style={styles.setupTitle}>📋 One-time PocketBase setup required</Text>
            <Text style={styles.setupBody}>
              Create a <Text style={styles.setupCode}>plant_icons</Text> collection with fields:{' '}
              <Text style={styles.setupCode}>plant_key</Text> (text) and{' '}
              <Text style={styles.setupCode}>image</Text> (file).{'\n'}
              Set list/view rules to <Text style={styles.setupCode}>""</Text> and write rules to{' '}
              <Text style={styles.setupCode}>{'@request.auth.id != ""'}</Text>
            </Text>
          </View>
        )}

        {/* Search + stats bar */}
        <View style={[styles.toolbar, { backgroundColor: cardBg, borderColor: border }]}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
            placeholder="Search plants by name or key…"
            placeholderTextColor={textSec}
            value={search}
            onChangeText={setSearch}
          />
          <Text style={[styles.toolbarCount, { color: textSec }]}>
            {filtered.length} of {uniqueKeys.length} plants
          </Text>
        </View>

        {/* Plants table */}
        <View style={[styles.table, { backgroundColor: cardBg, borderColor: border }]}>
          {/* Table header */}
          <View style={[styles.tableHeader, { borderBottomColor: border }]}>
            <Text style={[styles.thIcon, { color: textSec }]}>Icon</Text>
            <Text style={[styles.thName, { color: textSec }]}>Plant</Text>
            <Text style={[styles.thMeta, { color: textSec }]}>Sun</Text>
            <Text style={[styles.thMeta, { color: textSec }]}>Water</Text>
            <Text style={[styles.thMeta, { color: textSec }]}>Category</Text>
            <Text style={[styles.thActions, { color: textSec }]}>Actions</Text>
          </View>

          {filtered.length === 0 && (
            <View style={styles.emptyRow}>
              <Text style={[styles.emptyText, { color: textSec }]}>No plants match your search.</Text>
            </View>
          )}

          {filtered.map((key, idx) => {
            const hasOverride = !!overrides[key] && !overrides[key].deleted;
            const base = PLANT_CATALOG[key];
            const customUrl = iconUrls[key];
            const defaultIcon = getPlantIcon(getDisplayName(key));
            const isUploading = uploadingKey === key;
            const sun = overrides[key]?.sunRequirement ?? base?.sunRequirement;
            const water = overrides[key]?.waterIntervalDays ?? base?.waterIntervalDays;
            const cat = overrides[key]?.category ?? base?.category;
            const isEven = idx % 2 === 0;

            return (
              <View
                key={key}
                style={[
                  styles.tableRow,
                  { borderBottomColor: border },
                  isEven && { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fafafa' },
                ]}
              >
                {/* Icon */}
                <TouchableOpacity style={styles.tdIcon} onPress={() => triggerUpload(key)} disabled={isUploading}>
                  {isUploading ? (
                    <ActivityIndicator color={G.hunter} size="small" />
                  ) : customUrl ? (
                    <Image source={{ uri: customUrl }} style={styles.iconImg} />
                  ) : (
                    <View style={[styles.iconEmoji, { backgroundColor: defaultIcon.bg }]}>
                      <Text style={styles.iconEmojiText}>{defaultIcon.emoji}</Text>
                    </View>
                  )}
                  <Text style={styles.iconHint}>{customUrl ? '✏️' : '📷'}</Text>
                </TouchableOpacity>

                {/* Name */}
                <View style={styles.tdName}>
                  <Text style={[styles.plantName, { color: textPrim }]} numberOfLines={1}>{getDisplayName(key)}</Text>
                  <Text style={[styles.plantKey, { color: textSec }]}>{key}{hasOverride ? ' · edited' : ''}{customUrl ? ' · custom icon' : ''}</Text>
                </View>

                {/* Sun — tap to cycle */}
                <TouchableOpacity
                  style={[styles.tdMeta, styles.inlineEditCell]}
                  onPress={() => {
                    const cur: SunRequirement = (sun as SunRequirement) ?? 'full_sun';
                    const next = SUN_OPTIONS[(SUN_OPTIONS.indexOf(cur) + 1) % SUN_OPTIONS.length];
                    patchOverride(key, 'sunRequirement', next);
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{sun ? SUN_EMOJIS[sun as SunRequirement] : '—'}</Text>
                  <Text style={[styles.inlineEditHint, { color: textSec }]}>tap</Text>
                </TouchableOpacity>

                {/* Water — inline +/- */}
                <View style={[styles.tdMeta, styles.inlineEditCell]}>
                  <TouchableOpacity
                    style={styles.inlineBtn}
                    onPress={() => patchOverride(key, 'waterIntervalDays', Math.max(1, (water ?? 3) - 1))}
                  >
                    <Text style={[styles.inlineBtnText, { color: textPrim }]}>−</Text>
                  </TouchableOpacity>
                  <Text style={[styles.inlineVal, { color: textPrim }]}>{water ?? '—'}</Text>
                  <TouchableOpacity
                    style={styles.inlineBtn}
                    onPress={() => patchOverride(key, 'waterIntervalDays', (water ?? 3) + 1)}
                  >
                    <Text style={[styles.inlineBtnText, { color: textPrim }]}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* Category */}
                <Text style={[styles.tdMeta, { color: textSec }]}>
                  {cat ?? '—'}
                </Text>

                {/* Actions */}
                <View style={styles.tdActions}>
                  {customUrl && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnDanger]}
                      onPress={() => removeCustomIcon(key)}
                      disabled={isUploading}
                    >
                      <Text style={styles.actionBtnDangerText}>Remove icon</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: border }]}
                    onPress={() => openEdit(key)}
                  >
                    <Text style={[styles.actionBtnText, { color: textPrim }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnIcon]}
                    onPress={() => deletePlant(key)}
                  >
                    <Text style={{ fontSize: 14 }}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* Deleted plants */}
        {deletedKeys.length > 0 && (
          <View style={[styles.table, { backgroundColor: cardBg, borderColor: border, marginTop: 24, opacity: 0.7 }]}>
            <View style={[styles.tableHeader, { borderBottomColor: border }]}>
              <Text style={[styles.thName, { color: textSec, flex: 1 }]}>Removed Plants ({deletedKeys.length})</Text>
              <Text style={[styles.thActions, { color: textSec }]}>Actions</Text>
            </View>
            {deletedKeys.map(key => (
              <View key={key} style={[styles.tableRow, { borderBottomColor: border }]}>
                <View style={styles.tdName}>
                  <Text style={[styles.plantName, { color: textSec }]}>🗑 {PLANT_CATALOG[key]?.name ?? key}</Text>
                </View>
                <View style={[styles.tdActions, { flex: 1, justifyContent: 'flex-end' }]}>
                  <TouchableOpacity style={[styles.actionBtn, { borderColor: G.sage }]} onPress={() => restorePlant(key)}>
                    <Text style={[styles.actionBtnText, { color: G.hunter }]}>Restore</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 60 }} />
        </> /* end plants tab */}
      </ScrollView>

      {/* Add User Modal */}
      <Modal visible={addUserOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeAddUser} />
          <View style={[styles.modalDialog, { backgroundColor: cardBg, borderColor: border, maxWidth: 440 }]}>
            <View style={[styles.modalHeader, { borderBottomColor: border }]}>
              <Text style={[styles.modalTitle, { color: textPrim }]}>Send Access Email</Text>
              <TouchableOpacity onPress={closeAddUser} style={[styles.modalClose, { borderColor: border }]}>
                <Text style={[styles.modalCloseText, { color: textSec }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {addUserError && (
                <View style={{ backgroundColor: '#fff5f5', borderRadius: R.md, padding: 12, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: '#e03131' }}>
                  <Text style={{ fontSize: 13, color: '#c0392b' }}>⚠️ {addUserError}</Text>
                </View>
              )}
              <Text style={[styles.fieldLabel, { color: textSec, marginTop: 0 }]}>Email</Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
                value={newEmail} onChangeText={setNewEmail}
                placeholder="user@example.com" placeholderTextColor={textSec}
                autoCapitalize="none" keyboardType="email-address" autoFocus
                returnKeyType="go" onSubmitEditing={addUser}
              />
              <Text style={[styles.fieldLabel, { color: textSec }]}>Grant Premium</Text>
              <View style={styles.chipRow}>
                {(['none', 'week', 'month', 'year', 'forever'] as const).map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.chip, { borderColor: border }, newDuration === d && styles.chipActive]}
                    onPress={() => setNewDuration(d)}
                  >
                    <Text style={[styles.chipText, { color: textSec }, newDuration === d && styles.chipTextActive]}>
                      {d === 'none' ? 'None' : d === 'week' ? '1 Week' : d === 'month' ? '1 Month' : d === 'year' ? '1 Year' : 'Lifetime'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={[styles.modalFooter, { borderTopColor: border }]}>
              <TouchableOpacity style={[styles.footerBtn, styles.footerBtnCancel, { borderColor: border }]} onPress={closeAddUser}>
                <Text style={[styles.footerBtnCancelText, { color: textSec }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerBtn, styles.footerBtnSave, (addingUser || !newEmail.trim()) && { opacity: 0.5 }]}
                onPress={addUser} disabled={addingUser || !newEmail.trim()}
              >
                <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.footerBtnGrad}>
                  <Text style={styles.footerBtnSaveText}>{addingUser ? 'Sending…' : 'Send Email'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit / Add Modal — centered dialog */}
      <Modal visible={!!editState} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setEditState(null)} />
          <View style={[styles.modalDialog, { backgroundColor: cardBg, borderColor: border }]}>
            {/* Modal header */}
            <View style={[styles.modalHeader, { borderBottomColor: border }]}>
              <Text style={[styles.modalTitle, { color: textPrim }]}>
                {editState?.isNew ? '🌱 Add Plant' : `✏️ ${editState?.name || editState?.key}`}
              </Text>
              <TouchableOpacity onPress={() => setEditState(null)} style={[styles.modalClose, { borderColor: border }]}>
                <Text style={[styles.modalCloseText, { color: textSec }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalBody}
            >
              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={[styles.fieldLabel, { color: textSec }]}>Fallback Emoji</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim, fontSize: 28, textAlign: 'center', width: 80 }]}
                    value={editState?.emoji ?? '🌱'}
                    onChangeText={v => setEditState(s => s ? { ...s, emoji: v } : s)}
                    maxLength={4}
                  />
                </View>
                <View style={[styles.formCol, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: textSec }]}>Plant Name</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
                    value={editState?.name ?? ''}
                    onChangeText={v => setEditState(s => s ? { ...s, name: v } : s)}
                    placeholder="e.g. Tomato"
                    placeholderTextColor={textSec}
                  />
                </View>
              </View>

              <Text style={[styles.fieldLabel, { color: textSec }]}>Category</Text>
              <View style={styles.chipRow}>
                {CAT_OPTIONS.map(c => (
                  <TouchableOpacity key={c}
                    style={[styles.chip, { borderColor: border }, editState?.category === c && styles.chipActive]}
                    onPress={() => setEditState(s => s ? { ...s, category: c } : s)}
                  >
                    <Text style={[styles.chipText, { color: textSec }, editState?.category === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: textSec }]}>Sunlight</Text>
              <View style={styles.chipRow}>
                {SUN_OPTIONS.map(s => (
                  <TouchableOpacity key={s}
                    style={[styles.chip, { borderColor: border }, editState?.sunRequirement === s && styles.chipActive]}
                    onPress={() => setEditState(st => st ? { ...st, sunRequirement: s } : st)}
                  >
                    <Text style={[styles.chipText, { color: textSec }, editState?.sunRequirement === s && styles.chipTextActive]}>
                      {SUN_EMOJIS[s]} {s.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: textSec }]}>Water every (days)</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity style={[styles.stepBtn, { borderColor: border }]}
                  onPress={() => setEditState(s => s ? { ...s, waterIntervalDays: Math.max(1, s.waterIntervalDays - 1) } : s)}>
                  <Text style={[styles.stepBtnText, { color: textPrim }]}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.stepValue, { color: textPrim }]}>{editState?.waterIntervalDays ?? 3} days</Text>
                <TouchableOpacity style={[styles.stepBtn, { borderColor: border }]}
                  onPress={() => setEditState(s => s ? { ...s, waterIntervalDays: Math.min(30, s.waterIntervalDays + 1) } : s)}>
                  <Text style={[styles.stepBtnText, { color: textPrim }]}>+</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { color: textSec }]}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
                value={editState?.notes ?? ''}
                onChangeText={v => setEditState(s => s ? { ...s, notes: v } : s)}
                placeholder="Growing tips, spacing, companion notes…"
                placeholderTextColor={textSec}
                multiline
              />
            </ScrollView>

            {/* Modal footer */}
            <View style={[styles.modalFooter, { borderTopColor: border }]}>
              <TouchableOpacity style={[styles.footerBtn, styles.footerBtnCancel, { borderColor: border }]} onPress={() => setEditState(null)}>
                <Text style={[styles.footerBtnCancelText, { color: textSec }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerBtn, styles.footerBtnSave, saving && { opacity: 0.6 }]}
                onPress={saveEdit}
                disabled={saving}
              >
                <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.footerBtnGrad}>
                  <Text style={styles.footerBtnSaveText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
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
  loadingText:  { marginTop: 12, fontSize: 14 },

  // Top nav
  topNav:       { borderBottomWidth: 1, ...Shadow.soft },
  topNavInner:  { maxWidth: 1200, width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, gap: 16 },
  navBackBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: R.md, borderWidth: 1 },
  navBackArrow: { fontSize: 16, fontWeight: '700' },
  navBackLabel: { fontSize: 13, fontWeight: '600' },
  navBrand:     { flex: 1 },
  navTitle:     { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  navSub:       { fontSize: 12, marginTop: 1 },
  navAddBtn:    { borderRadius: R.md, overflow: 'hidden', ...Shadow.soft },
  navAddGrad:   { paddingVertical: 9, paddingHorizontal: 18 },
  navAddText:   { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Page content
  pageContent:  { maxWidth: 1200, width: '100%', alignSelf: 'center', padding: 24, paddingBottom: 48 },

  // Setup banner
  setupBanner:  { backgroundColor: '#fffbeb', padding: 16, marginBottom: 20, borderRadius: R.lg, borderLeftWidth: 4, borderLeftColor: '#f59e0b', borderWidth: 1, borderColor: '#fde68a' },
  setupTitle:   { fontWeight: '700', color: '#92400e', marginBottom: 6, fontSize: 14 },
  setupBody:    { fontSize: 13, color: '#78350f', lineHeight: 20 },
  setupCode:    { fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier', backgroundColor: '#fef3c7', color: '#92400e' } as any,

  // Toolbar
  toolbar:      { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 14, borderRadius: R.lg, borderWidth: 1, marginBottom: 16 },
  searchInput:  { flex: 1, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, borderWidth: 1.5 },
  toolbarCount: { fontSize: 13, fontWeight: '600', flexShrink: 0 },

  // Table
  table:        { borderRadius: R.lg, borderWidth: 1, overflow: 'hidden' },
  tableHeader:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  thIcon:       { width: 56, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  thName:       { flex: 1, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  thMeta:       { width: 80, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  thActions:    { width: 200, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'right' },

  tableRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  emptyRow:     { padding: 32, alignItems: 'center' },
  emptyText:    { fontSize: 14 },

  tdIcon:       { width: 56, alignItems: 'center', position: 'relative', cursor: 'pointer' } as any,
  iconImg:      { width: 40, height: 40, borderRadius: R.sm },
  iconEmoji:    { width: 40, height: 40, borderRadius: R.sm, justifyContent: 'center', alignItems: 'center' },
  iconEmojiText:{ fontSize: 22 },
  iconHint:     { position: 'absolute', bottom: -2, right: 2, fontSize: 10 },

  tdName:       { flex: 1, paddingRight: 12 },
  plantName:    { fontSize: 14, fontWeight: '600' },
  plantKey:     { fontSize: 11, marginTop: 2 },

  tdMeta:       { width: 80, fontSize: 13 },
  inlineEditCell: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  inlineEditHint: { fontSize: 9, marginTop: 2 },
  inlineBtn:    { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: 'rgba(128,128,128,0.12)' },
  inlineBtnText:{ fontSize: 14, fontWeight: '700', lineHeight: 18 },
  inlineVal:    { fontSize: 12, fontWeight: '700', minWidth: 20, textAlign: 'center' },

  tdActions:    { width: 200, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  actionBtn:    { paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.sm, borderWidth: 1, borderColor: '#e2e8f0' },
  actionBtnText:{ fontSize: 12, fontWeight: '600' },
  actionBtnDanger:      { borderColor: '#ffc9c9', backgroundColor: '#fff5f5' },
  actionBtnDangerText:  { color: '#e03131', fontSize: 12, fontWeight: '600' },
  actionBtnIcon:{ paddingHorizontal: 8 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalDialog:  { width: '100%', maxWidth: 560, borderRadius: R.xl, borderWidth: 1, maxHeight: '85%', ...Shadow.float },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  modalTitle:   { fontSize: 17, fontWeight: '700' },
  modalClose:   { width: 32, height: 32, borderRadius: R.full, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  modalCloseText: { fontSize: 14, fontWeight: '600' },
  modalBody:    { padding: 24 },
  modalFooter:  { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, padding: 16, borderTopWidth: 1 },

  footerBtn:        { borderRadius: R.md, overflow: 'hidden' },
  footerBtnCancel:  { borderWidth: 1, paddingHorizontal: 18, paddingVertical: 9 },
  footerBtnCancelText: { fontSize: 14, fontWeight: '600' },
  footerBtnSave:    {},
  footerBtnGrad:    { paddingHorizontal: 22, paddingVertical: 10 },
  footerBtnSaveText:{ color: '#fff', fontWeight: '700', fontSize: 14 },

  // Form
  formRow:      { flexDirection: 'row', gap: 16, marginBottom: 4, alignItems: 'flex-start' },
  formCol:      {},
  fieldLabel:   { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6, marginTop: 14 },
  input:        { borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, borderWidth: 1.5 },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip:         { borderRadius: R.full, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1.5 },
  chipActive:   { backgroundColor: G.hunter, borderColor: G.hunter },
  chipText:     { fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: G.cloud, fontWeight: '700' },
  stepperRow:   { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 4, marginTop: 4 },
  stepBtn:      { width: 36, height: 36, borderRadius: R.full, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  stepBtnText:  { fontSize: 20, fontWeight: '700', lineHeight: 22 },
  stepValue:    { fontSize: 16, fontWeight: '700', minWidth: 70, textAlign: 'center' },

  // Tab switcher
  tabSwitcher:  { flexDirection: 'row', borderRadius: R.md, borderWidth: 1, overflow: 'hidden' },
  tabBtn:       { paddingVertical: 8, paddingHorizontal: 16 },
  tabBtnActive: { backgroundColor: G.hunter },
  tabBtnText:   { fontSize: 13, fontWeight: '700' },

  // Premium status badges
  statusBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.full, alignSelf: 'flex-start' },
  statusPremium: { backgroundColor: '#dcfce7' },
  statusFree:    { backgroundColor: '#fef3c7' },
  statusText:    { fontSize: 11, fontWeight: '700' },

  // Grant button
  actionBtnGrant:      { borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' },
  actionBtnGrantText:  { color: '#065f46', fontSize: 12, fontWeight: '600' },
});
