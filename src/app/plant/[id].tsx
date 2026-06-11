import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, Image, Dimensions, Platform,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { pb, fileUrl } from '@/lib/pb';
import { offlineList, offlineOne, offlineUpdate, offlineCreate } from '@/lib/offline-db';
import { useAuth } from '@/hooks/use-auth';
import PlantAvatar from '@/components/PlantAvatar';
import { G, R, Shadow } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import type { Plant, Harvest, PlantPhoto, HealthStatus } from '@/lib/types';
import { addActivityEntryAsync } from '@/lib/activity-log';
import { generateSinglePlantPdf } from '@/lib/garden-pdf';
import { findPlantKey, PLANT_CATALOG, SUN_LABELS, SUN_EMOJIS } from '@/lib/plant-catalog';
import { fetchZoneForCoords, getFrostInfo, calcPlantingWindow, fmtDate, type FrostInfo, type PlantingWindow } from '@/lib/frost-dates';
import { loadGardenLocation } from '@/lib/weather';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HERO_HEIGHT = 260;

const HEALTH_OPTIONS: HealthStatus[] = ['healthy', 'needs_water', 'sick', 'harvested', 'dead'];

const HEALTH_COLORS: Record<HealthStatus, string> = {
  healthy:     '#52b788',
  needs_water: '#339af0',
  sick:        '#f03e3e',
  harvested:   '#a9e34b',
  dead:        '#adb5bd',
};

const HEALTH_LABELS: Record<HealthStatus, string> = {
  healthy:     '🟢 Healthy',
  needs_water: '💧 Needs water',
  sick:        '🟠 Sick',
  harvested:   '🧺 Harvested',
  dead:        '⚫ Dead',
};

export default function PlantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { isDark, colors } = useAppTheme();
  const bg      = isDark ? colors.bg        : G.foam;
  const cardBg  = isDark ? colors.bgCard    : G.cloud;
  const textPrim= isDark ? colors.text      : G.forest;
  const textSec = isDark ? colors.textSec   : G.stone;
  const border  = isDark ? colors.border    : G.mist;
  const inputBg = isDark ? colors.bgElement : G.foam;
  const navigation = useNavigation();
  const [plant, setPlant] = useState<Plant | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [photos, setPhotos] = useState<PlantPhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [photoLoadError, setPhotoLoadError] = useState<string | null>(null);
  const [wikiImageUrl, setWikiImageUrl] = useState<string | null>(null);
  const [frostInfo, setFrostInfo] = useState<FrostInfo | null>(null);
  const [plantingWindow, setPlantingWindow] = useState<PlantingWindow | null>(null);
  const [frostZoneLabel, setFrostZoneLabel] = useState<string | null>(null);
  const [showHarvest, setShowHarvest] = useState(false);
  const [harvestCount, setHarvestCount] = useState(1);
  const [harvestNotes, setHarvestNotes] = useState('');
  const [savingHarvest, setSavingHarvest] = useState(false);
  const [editingHarvest, setEditingHarvest] = useState<Harvest | null>(null);
  const [editHarvestCount, setEditHarvestCount] = useState(1);
  const [editHarvestNotes, setEditHarvestNotes] = useState('');
  const [savingEditHarvest, setSavingEditHarvest] = useState(false);

  useEffect(() => {
    if (!id) return;
    offlineOne('plants', id as string)
      .then((p) => {
        if (!p) { setLoadError('Plant not found'); return; }
        setPlant(p as any);
        navigation.setOptions({ title: (p as any).name });

        // Fetch Wikipedia reference image — try common name then scientific name
        const tryWiki = (title: string) =>
          fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
            .then(r => r.json())
            .then((data: any) => data?.thumbnail?.source ?? null)
            .catch(() => null);

        tryWiki((p as any).name).then(async (url) => {
          if (url) { setWikiImageUrl(url); return; }
          const key = findPlantKey((p as any).name);
          const sci = key ? PLANT_CATALOG[key]?.scientificName : null;
          if (sci) {
            const url2 = await tryWiki(sci);
            if (url2) setWikiImageUrl(url2);
          }
        });

        // Fetch frost zone from the plant's garden location (fire-and-forget)
        const gardenId = (p as any).garden_id;
        if (gardenId) {
          offlineOne('gardens', gardenId)
            .then(async (garden) => {
              const loc = await loadGardenLocation(garden as any);
              if (!loc) return;
              const zone = await fetchZoneForCoords(loc.latitude, loc.longitude);
              if (!zone) return;
              const info = getFrostInfo(zone);
              if (!info) return;
              setFrostInfo(info);
              setFrostZoneLabel(
                loc.name
                  ? `${loc.name} · Zone ${info.zone.toUpperCase()}`
                  : `Zone ${info.zone.toUpperCase()}`
              );
            })
            .catch(() => {});
        }
      })
      .catch((e) => setLoadError(e?.message ?? 'Could not load plant'));

    offlineList('harvests', user?.id ?? '', `plant_id = "${id}"`)
      .then((h) => setHarvests(h as any))
      .catch(() => {});

    pb.collection('plant_photos')
      .getFullList({ filter: `plant_id = "${id}"` })
      .then((ph) => {
        const sorted = [...ph].sort((a, b) =>
          new Date(b.created).getTime() - new Date(a.created).getTime()
        );
        setPhotos(sorted as any);
        setPhotoLoadError(null);
      })
      .catch((e) => setPhotoLoadError(e?.message ?? 'Could not load photos'));
  }, [id]);

  useEffect(() => {
    photos.forEach((photo: any) => {
      if (photoUrls[photo.id]) return;
      // photo field may be string or array (multi-file)
      const filename: string | undefined = Array.isArray(photo.photo)
        ? photo.photo[0]
        : photo.photo;
      if (!filename) return;
      setPhotoUrls((prev) => ({ ...prev, [photo.id]: fileUrl(photo, filename) }));
    });
  }, [photos]);

  async function updateHealth(status: HealthStatus) {
    if (!plant || !user) return;
    await offlineUpdate('plants', user.id, plant.id, { health_status: status });
    setPlant((p) => p ? { ...p, health_status: status } : p);
  }

  async function markWatered() {
    if (!plant || !user) return;
    const now = new Date().toISOString();
    await offlineUpdate('plants', user.id, plant.id, { last_watered: now });
    setPlant((p) => p ? { ...p, last_watered: now } : p);
    Alert.alert('Watered! 💧', `${plant.name} marked as watered.`);
  }

  async function logHarvest() {
    if (!user || !plant || harvestCount < 1 || savingHarvest) return;
    setSavingHarvest(true);
    try {
      const autoNote = `${harvestCount} piece${harvestCount !== 1 ? 's' : ''} harvested`;
      const notes = harvestNotes.trim() || autoNote;

      const payload: Record<string, any> = {
        plant_id: plant.id,
        user_id: user.id,
        yield_grams: harvestCount, // satisfies required field; represents piece count
        notes,
      };

      const { record: data } = await offlineCreate('harvests', user.id, payload);
      setHarvests((h) => [data as any, ...h]);
      addActivityEntryAsync(user.id, {
        type: 'harvest', plantId: plant.id, plantName: plant.name,
        gardenId: plant.garden_id, grams: harvestCount, notes,
      });
      setShowHarvest(false);
      setHarvestCount(1);
      setHarvestNotes('');
    } catch (e: any) {
      const pbFields = e?.data?.data ?? e?.data;
      const fieldErrors = pbFields && typeof pbFields === 'object'
        ? Object.entries(pbFields as Record<string, any>)
            .map(([k, v]) => `${k}: ${(v as any)?.message ?? JSON.stringify(v)}`)
            .join('\n')
        : null;
      Alert.alert('Could not save harvest', fieldErrors || e?.message || 'Please try again.');
    } finally {
      setSavingHarvest(false);
    }
  }

  function openEditHarvest(h: Harvest) {
    setEditingHarvest(h);
    setEditHarvestCount(h.yield_grams || 1);
    setEditHarvestNotes(h.notes?.match(/^\d+ pieces?/) ? '' : (h.notes ?? ''));
  }

  async function saveEditHarvest() {
    if (!editingHarvest) return;
    setSavingEditHarvest(true);
    try {
      const autoNote = `${editHarvestCount} piece${editHarvestCount !== 1 ? 's' : ''} harvested`;
      const notes = editHarvestNotes.trim() || autoNote;
      await pb.collection('harvests').update(editingHarvest.id, { yield_grams: editHarvestCount, notes });
      setHarvests(prev => prev.map(h => h.id === editingHarvest.id ? { ...h, yield_grams: editHarvestCount, notes } : h));
      setEditingHarvest(null);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not update harvest');
    } finally {
      setSavingEditHarvest(false);
    }
  }

  function confirmDeleteHarvest(h: Harvest) {
    Alert.alert('Delete Harvest', 'Remove this harvest record?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await pb.collection('harvests').delete(h.id);
          setHarvests(prev => prev.filter(r => r.id !== h.id));
        } catch (e: any) {
          Alert.alert('Error', e?.message ?? 'Could not delete');
        }
      }},
    ]);
  }

  async function addPhoto() {
    if (!user || !plant) return;

    Alert.alert('Log Progress Photo', 'How would you like to add a photo?', [
      {
        text: '📷 Take Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Camera access is required to take photos.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
          if (!result.canceled && result.assets[0]) uploadPhoto(result.assets[0].uri);
        },
      },
      {
        text: '🖼️ Choose from Library',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Photo library access is required to select photos.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) uploadPhoto(result.assets[0].uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function uploadPhoto(uri: string) {
    if (!user || !plant) return;
    setUploading(true);
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
      formData.append('taken_at', new Date().toISOString());
      const data = await pb.collection('plant_photos').create(formData);
      setPhotos((p) => [data as any, ...p]);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Unknown error');
    } finally {
      setUploading(false);
    }
  }

  if (loadError) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingEmoji}>🌱</Text>
        <Text style={styles.loadingTitle}>Couldn't load plant</Text>
        <Text style={styles.loadingMsg}>{loadError}</Text>
      </View>
    );
  }

  if (!plant) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingEmoji}>🌿</Text>
        <Text style={styles.loadingTitle}>Loading…</Text>
      </View>
    );
  }

  const totalYieldKg = (plant.total_yield_grams / 1000).toFixed(2);

  const catalogKey = findPlantKey(plant.name);
  const catalogInfo = catalogKey ? PLANT_CATALOG[catalogKey] : null;

  const COOL_SEASON_KEYS = new Set([
    'lettuce','spinach','kale','broccoli','cabbage','cauliflower','pea',
    'carrot','radish','beet','chard','arugula','bok_choy','collard_greens',
    'kohlrabi','turnip','parsnip','rutabaga','brussels_sprouts','celery',
  ]);
  const isWarmSeason = !COOL_SEASON_KEYS.has(catalogKey ?? '');
  const window = frostInfo ? calcPlantingWindow(frostInfo, isWarmSeason, catalogInfo?.daysToMaturity) : null;

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg }]} contentContainerStyle={styles.content}>

      {/* ── Hero: Wikipedia reference image ────────────────────────────── */}
      <View style={styles.hero}>
        {wikiImageUrl ? (
          <Image source={{ uri: wikiImageUrl }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={[G.forest, G.fern]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.heroEmpty}
          >
            <PlantAvatar name={plant.name} size={110} />
          </LinearGradient>
        )}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)']}
          style={styles.heroOverlay}
        >
          <View style={styles.heroBottom}>
            <Text style={styles.heroName}>{plant.name}</Text>
            {plant.variety ? <Text style={styles.heroVariety}>{plant.variety}</Text> : null}
          </View>
        </LinearGradient>

        {wikiImageUrl && (
          <View style={styles.wikiCredit}>
            <Text style={styles.wikiCreditText}>📷 Wikipedia</Text>
          </View>
        )}
      </View>

      {/* ── Quick actions — right at top so no scrolling needed ─────────── */}
      <View style={[styles.actionsBar, { backgroundColor: cardBg, borderColor: border }]}>
        <TouchableOpacity style={styles.actionButton} onPress={markWatered}>
          <Text style={styles.actionEmoji}>💧</Text>
          <Text style={[styles.actionText, { color: textPrim }]}>Mark Watered</Text>
        </TouchableOpacity>
        <View style={[styles.actionDivider, { backgroundColor: border }]} />
        <TouchableOpacity style={styles.actionButton} onPress={() => setShowHarvest(true)}>
          <Text style={styles.actionEmoji}>🧺</Text>
          <Text style={[styles.actionText, { color: textPrim }]}>Log Harvest</Text>
        </TouchableOpacity>
        <View style={[styles.actionDivider, { backgroundColor: border }]} />
        <TouchableOpacity style={styles.actionButton} onPress={addPhoto} disabled={uploading}>
          <Text style={styles.actionEmoji}>{uploading ? '⏳' : '📷'}</Text>
          <Text style={[styles.actionText, { color: textPrim }]}>Log Progress</Text>
        </TouchableOpacity>
        <View style={[styles.actionDivider, { backgroundColor: border }]} />
        <TouchableOpacity style={styles.actionButton} onPress={() => generateSinglePlantPdf(plant)}>
          <Text style={styles.actionEmoji}>📄</Text>
          <Text style={[styles.actionText, { color: textPrim }]}>Print Card</Text>
        </TouchableOpacity>
      </View>

      {/* ── Health status ───────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.label}>Health Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {HEALTH_OPTIONS.map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.healthChip,
                plant.health_status === status && { backgroundColor: HEALTH_COLORS[status], borderColor: HEALTH_COLORS[status] },
              ]}
              onPress={() => updateHealth(status)}
            >
              <Text style={[styles.healthChipText, plant.health_status === status && styles.healthChipTextActive]}>
                {status.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Info card ───────────────────────────────────────────────────── */}
      <View style={[styles.infoCard, { backgroundColor: cardBg }]}>
        {plant.variety && <InfoRow label="Variety" value={plant.variety} />}
        {plant.planted_date && <InfoRow label="Planted" value={new Date(plant.planted_date).toLocaleDateString()} />}
        {plant.expected_harvest_date && (
          <InfoRow label="Expected harvest" value={new Date(plant.expected_harvest_date).toLocaleDateString()} />
        )}
        {plant.last_watered && (
          <InfoRow label="Last watered" value={new Date(plant.last_watered).toLocaleDateString()} />
        )}
        {plant.water_interval_days && (
          <InfoRow label="Water every" value={`${plant.water_interval_days} days`} />
        )}
        <InfoRow label="Total yield" value={`${totalYieldKg} kg`} />
        {plant.notes && <InfoRow label="Notes" value={plant.notes} />}
      </View>

      {/* ── Catalog growing info ────────────────────────────────────────── */}
      {catalogInfo && (
        <View style={[styles.catalogCard, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: textPrim, paddingHorizontal: 0, marginBottom: 14 }]}>🌿 Growing Guide</Text>

          {/* Quick specs row */}
          <View style={styles.specsRow}>
            <View style={[styles.specChip, { backgroundColor: isDark ? colors.bgElement : '#fff9db', borderColor: isDark ? colors.border : '#ffe066' }]}>
              <Text style={styles.specChipEmoji}>{SUN_EMOJIS[catalogInfo.sunRequirement]}</Text>
              <Text style={[styles.specChipLabel, { color: textSec }]}>Sun</Text>
              <Text style={[styles.specChipValue, { color: textPrim }]}>{SUN_LABELS[catalogInfo.sunRequirement]}</Text>
            </View>
            <View style={[styles.specChip, { backgroundColor: isDark ? colors.bgElement : '#e7f5ff', borderColor: isDark ? colors.border : '#74c0fc' }]}>
              <Text style={styles.specChipEmoji}>💧</Text>
              <Text style={[styles.specChipLabel, { color: textSec }]}>Water</Text>
              <Text style={[styles.specChipValue, { color: textPrim }]}>Every {plant.water_interval_days ?? catalogInfo.waterIntervalDays}d</Text>
            </View>
            {catalogInfo.spacingCm && (
              <View style={[styles.specChip, { backgroundColor: isDark ? colors.bgElement : '#f3f0ff', borderColor: isDark ? colors.border : '#b197fc' }]}>
                <Text style={styles.specChipEmoji}>📏</Text>
                <Text style={[styles.specChipLabel, { color: textSec }]}>Spacing</Text>
                <Text style={[styles.specChipValue, { color: textPrim }]}>{catalogInfo.spacingCm}cm / {Math.round(catalogInfo.spacingCm / 2.54)}"</Text>
              </View>
            )}
            {catalogInfo.daysToMaturity && (
              <View style={[styles.specChip, { backgroundColor: isDark ? colors.bgElement : '#fff4e6', borderColor: isDark ? colors.border : '#ffa94d' }]}>
                <Text style={styles.specChipEmoji}>⏱</Text>
                <Text style={[styles.specChipLabel, { color: textSec }]}>Maturity</Text>
                <Text style={[styles.specChipValue, { color: textPrim }]}>{catalogInfo.daysToMaturity.min}–{catalogInfo.daysToMaturity.max}d</Text>
              </View>
            )}
          </View>

          {/* Sowing guide */}
          {catalogInfo.daysToMaturity && (
            <View style={[styles.sowingBox, { borderColor: isDark ? colors.border : '#ffe066', backgroundColor: isDark ? colors.bgElement : '#fffbeb' }]}>
              <Text style={[styles.sowingTitle, { color: isDark ? '#ffd43b' : '#e67700' }]}>🌱 Sowing Guide</Text>
              <Text style={[styles.sowingText, { color: textPrim }]}>
                {(() => {
                  const cool = ['lettuce','spinach','kale','broccoli','cabbage','cauliflower','pea','carrot','radish','beet','chard','arugula','bok_choy','collard_greens'].includes(catalogKey ?? '');
                  if (cool) return 'Direct sow or transplant 4–6 weeks before last spring frost. Cold-tolerant — ideal for early spring or fall planting.';
                  if ((catalogInfo.daysToMaturity?.min ?? 0) >= 60) return 'Start seeds indoors 6–8 weeks before last frost. Transplant outdoors after all frost risk has passed.';
                  return 'Direct sow outdoors after last frost date when soil is warm (60°F / 15°C+).';
                })()}
              </Text>
              <Text style={[styles.sowingText, { color: textSec, marginTop: 4 }]}>
                Seed depth: {catalogInfo.spacingCm ? `${Math.round(catalogInfo.spacingCm * 0.15)}–${Math.round(catalogInfo.spacingCm * 0.25)} cm (¼–½")` : '1–2 cm (½")'}
              </Text>
            </View>
          )}

          {/* Scientific name + category */}
          {(catalogInfo.scientificName || catalogInfo.category) && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {catalogInfo.scientificName && (
                <View style={[styles.tagChip, { backgroundColor: isDark ? colors.bgElement : G.foam, borderColor: border }]}>
                  <Text style={[styles.tagChipText, { color: textSec, fontStyle: 'italic' }]}>{catalogInfo.scientificName}</Text>
                </View>
              )}
              {catalogInfo.category && (
                <View style={[styles.tagChip, { backgroundColor: isDark ? colors.bgElement : G.foam, borderColor: border }]}>
                  <Text style={[styles.tagChipText, { color: textSec }]}>{catalogInfo.category}</Text>
                </View>
              )}
            </View>
          )}

          {/* Growing notes */}
          {catalogInfo.notes && (
            <View style={[styles.notesBox, { borderColor: isDark ? colors.border : G.mist, backgroundColor: isDark ? colors.bgElement : G.foam }]}>
              <Text style={[styles.notesText, { color: textPrim }]}>💡 {catalogInfo.notes}</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Companion planting ───────────────────────────────────────────── */}
      {catalogInfo && (catalogInfo.goodCompanions.length > 0 || catalogInfo.badCompanions.length > 0) && (
        <View style={[styles.catalogCard, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: textPrim, paddingHorizontal: 0, marginBottom: 14 }]}>🤝 Companion Planting</Text>

          {catalogInfo.goodCompanions.length > 0 && (
            <>
              <Text style={[styles.companionLabel, { color: '#2b8a3e' }]}>✅ Plant near these</Text>
              <View style={styles.companionChips}>
                {catalogInfo.goodCompanions.map(k => {
                  const name = PLANT_CATALOG[k]?.name ?? k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                  return (
                    <View key={k} style={styles.goodChip}>
                      <Text style={styles.goodChipText}>{name}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {catalogInfo.badCompanions.length > 0 && (
            <>
              <Text style={[styles.companionLabel, { color: '#c92a2a', marginTop: 12 }]}>❌ Keep away from</Text>
              <View style={styles.companionChips}>
                {catalogInfo.badCompanions.map(k => {
                  const name = PLANT_CATALOG[k]?.name ?? k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                  return (
                    <View key={k} style={styles.badChip}>
                      <Text style={styles.badChipText}>{name}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      )}

      {/* ── Frost & planting dates ──────────────────────────────────────── */}
      <View style={[styles.catalogCard, { backgroundColor: cardBg }]}>
        <Text style={[styles.sectionTitle, { color: textPrim, paddingHorizontal: 0, marginBottom: 14 }]}>🌡️ Frost & Planting</Text>

        {frostInfo && frostZoneLabel ? (
            <>
              {/* Zone + season length */}
              <View style={[styles.frostZoneBadge, { backgroundColor: isDark ? colors.bgElement : '#e8f5e9', borderColor: isDark ? colors.border : '#a5d6a7' }]}>
                <Text style={[styles.frostZoneText, { color: isDark ? '#a5d6a7' : '#2e7d32' }]}>
                  📍 {frostZoneLabel}
                </Text>
              </View>

              {/* Frost date chips */}
              {!frostInfo.noFrostRisk ? (
                <View style={styles.frostRow}>
                  <View style={[styles.frostChip, { backgroundColor: isDark ? colors.bgElement : '#e3f2fd', borderColor: isDark ? colors.border : '#90caf9' }]}>
                    <Text style={[styles.frostChipLabel, { color: isDark ? '#90caf9' : '#1565c0' }]}>❄️ Last frost</Text>
                    <Text style={[styles.frostChipDate, { color: textPrim }]}>{fmtDate(frostInfo.lastFrost)}</Text>
                  </View>
                  <View style={[styles.frostChip, { backgroundColor: isDark ? colors.bgElement : '#fce4ec', borderColor: isDark ? colors.border : '#f48fb1' }]}>
                    <Text style={[styles.frostChipLabel, { color: isDark ? '#f48fb1' : '#880e4f' }]}>🍂 First frost</Text>
                    <Text style={[styles.frostChipDate, { color: textPrim }]}>{fmtDate(frostInfo.firstFrost)}</Text>
                  </View>
                  <View style={[styles.frostChip, { backgroundColor: isDark ? colors.bgElement : '#f3e5f5', borderColor: isDark ? colors.border : '#ce93d8' }]}>
                    <Text style={[styles.frostChipLabel, { color: isDark ? '#ce93d8' : '#6a1b9a' }]}>🌿 Season</Text>
                    <Text style={[styles.frostChipDate, { color: textPrim }]}>{frostInfo.growingDays}d</Text>
                  </View>
                </View>
              ) : (
                <Text style={[styles.frostNoFrost, { color: textSec }]}>
                  🌴 Frost-free zone — plants can go outdoors year-round.
                </Text>
              )}

              {/* Planting timeline for this specific plant */}
              {window && (
                <View style={[styles.frostTimeline, { borderColor: isDark ? colors.border : '#e0e0e0', backgroundColor: isDark ? colors.bgElement : '#fafafa' }]}>
                  <Text style={[styles.frostTimelineTitle, { color: textPrim }]}>
                    🌱 {plant.name} planting timeline
                  </Text>
                  {window.startIndoors && (
                    <View style={styles.frostTimelineRow}>
                      <Text style={styles.frostTimelineEmoji}>🏠</Text>
                      <View>
                        <Text style={[styles.frostTimelineLabel, { color: textSec }]}>Start indoors</Text>
                        <Text style={[styles.frostTimelineDate, { color: textPrim }]}>{fmtDate(window.startIndoors)}</Text>
                      </View>
                    </View>
                  )}
                  <View style={styles.frostTimelineRow}>
                    <Text style={styles.frostTimelineEmoji}>{isWarmSeason ? '☀️' : '🌱'}</Text>
                    <View>
                      <Text style={[styles.frostTimelineLabel, { color: textSec }]}>
                        {window.startIndoors ? 'Transplant outdoors' : 'Direct sow / transplant'}
                      </Text>
                      <Text style={[styles.frostTimelineDate, { color: textPrim }]}>{fmtDate(window.transplantOutdoors)}</Text>
                    </View>
                  </View>
                  {window.harvestStart && window.harvestEnd && (
                    <View style={styles.frostTimelineRow}>
                      <Text style={styles.frostTimelineEmoji}>🧺</Text>
                      <View>
                        <Text style={[styles.frostTimelineLabel, { color: textSec }]}>Harvest window</Text>
                        <Text style={[styles.frostTimelineDate, { color: textPrim }]}>
                          {fmtDate(window.harvestStart)} – {fmtDate(window.harvestEnd)}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </>
          ) : (
            <Text style={[styles.frostNoLocation, { color: textSec }]}>
              Add a location to this plant's garden to see frost dates and planting recommendations.
            </Text>
          )}
        </View>

      {/* ── Progress log ─────────────────────────────────────────────────── */}
      <View style={[styles.catalogCard, { backgroundColor: cardBg }]}>
        <View style={styles.progressHeader}>
          <Text style={[styles.sectionTitle, { color: textPrim, marginBottom: 0 }]}>📷 Progress Log</Text>
          <TouchableOpacity style={styles.logProgressBtn} onPress={addPhoto} disabled={uploading}>
            <Text style={styles.logProgressBtnText}>{uploading ? '⏳ Uploading…' : '+ Log Progress'}</Text>
          </TouchableOpacity>
        </View>
        {photoLoadError ? (
          <Text style={[styles.progressEmpty, { color: '#e03131' }]}>⚠️ {photoLoadError}</Text>
        ) : photos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 12 }}
            contentContainerStyle={styles.photoStripContent}
          >
            {photos.map((photo) =>
              photoUrls[photo.id] ? (
                <Image key={photo.id} source={{ uri: photoUrls[photo.id] }} style={styles.photoThumb} resizeMode="cover" />
              ) : (
                <View key={photo.id} style={[styles.photoThumb, styles.photoThumbLoading]}>
                  <Text>📷</Text>
                </View>
              )
            )}
          </ScrollView>
        ) : (
          <Text style={[styles.progressEmpty, { color: textSec }]}>No progress photos yet. Tap "+ Log Progress" to document growth.</Text>
        )}
      </View>

      {/* ── Harvest log ─────────────────────────────────────────────────── */}
      {harvests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧺 Harvest Log</Text>
          {harvests.map((h) => (
            <View key={h.id} style={[styles.harvestRow, { borderColor: border }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.harvestDate}>{new Date((h.harvested_at || (h as any).created) || new Date()).toLocaleDateString()}</Text>
                <Text style={styles.harvestYield}>
                  {h.notes?.match(/^\d+ pieces?/)?.[0] ?? (h.yield_grams > 0 ? `${h.yield_grams} piece${h.yield_grams !== 1 ? 's' : ''}` : '—')}
                </Text>
                {h.notes && !h.notes.match(/^\d+ pieces?/) && (
                  <Text style={styles.harvestNotes}>{h.notes}</Text>
                )}
              </View>
              <View style={styles.harvestActions}>
                <TouchableOpacity onPress={() => openEditHarvest(h)} style={styles.harvestActionBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Text style={{ fontSize: 15 }}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDeleteHarvest(h)} style={styles.harvestActionBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Text style={{ fontSize: 15 }}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── Edit harvest modal ──────────────────────────────────────────── */}
      <Modal visible={!!editingHarvest} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { backgroundColor: cardBg }]}>
            <Text style={[styles.modalTitle, { color: textPrim }]}>✏️ Edit Harvest</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setEditHarvestCount(v => Math.max(1, v - 1))}>
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <View style={styles.stepValueWrap}>
                <Text style={styles.stepValue}>{editHarvestCount}</Text>
                <Text style={styles.stepUnit}>{editHarvestCount === 1 ? 'piece' : 'pieces'}</Text>
              </View>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setEditHarvestCount(v => v + 1)}>
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
              placeholder="Notes (optional)"
              placeholderTextColor={textSec}
              value={editHarvestNotes}
              onChangeText={setEditHarvestNotes}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingHarvest(null)} disabled={savingEditHarvest}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, savingEditHarvest && { opacity: 0.5 }]} onPress={saveEditHarvest} disabled={savingEditHarvest}>
                <Text style={styles.buttonText}>{savingEditHarvest ? 'Saving…' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Harvest modal ────────────────────────────────────────────────── */}
      <Modal visible={showHarvest} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { backgroundColor: cardBg }]}>
            <Text style={[styles.modalTitle, { color: textPrim }]}>🧺 Log Harvest</Text>

            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setHarvestCount(v => Math.max(1, v - 1))}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <View style={styles.stepValueWrap}>
                <Text style={styles.stepValue}>{harvestCount}</Text>
                <Text style={styles.stepUnit}>{harvestCount === 1 ? 'piece' : 'pieces'}</Text>
              </View>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setHarvestCount(v => v + 1)}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
              placeholder="Notes (optional)"
              placeholderTextColor={textSec}
              value={harvestNotes}
              onChangeText={setHarvestNotes}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowHarvest(false)} disabled={savingHarvest}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, savingHarvest && { opacity: 0.5 }]}
                onPress={logHarvest}
                disabled={savingHarvest}
              >
                <Text style={styles.buttonText}>{savingHarvest ? 'Saving…' : 'Log Harvest'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: G.foam, padding: 32 },
  loadingEmoji: { fontSize: 48, marginBottom: 12 },
  loadingTitle: { fontSize: 18, fontWeight: '700', color: G.forest, marginBottom: 6 },
  loadingMsg: { fontSize: 14, color: G.stone, textAlign: 'center', lineHeight: 20 },

  container: { flex: 1, backgroundColor: G.foam },
  content: { paddingBottom: 48 },

  // Hero
  hero: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    backgroundColor: G.forest,
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  heroBottom: { gap: 2 },
  heroName: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  heroVariety: { fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  // Photo strip
  photoStripContent: { paddingBottom: 4, gap: 8, flexDirection: 'row' },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: R.md,
    overflow: 'hidden',
  },
  photoThumbLoading: { backgroundColor: G.dew, justifyContent: 'center', alignItems: 'center' },

  // Sections
  section: { paddingHorizontal: 16, marginTop: 16 },
  label: { fontSize: 11, fontWeight: '700', color: G.stone, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: G.forest, marginBottom: 12 },

  // Health chips
  healthChip: {
    borderRadius: R.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: G.cloud,
    borderWidth: 1.5,
    borderColor: G.mist,
  },
  healthChipText: { color: G.hunter, fontWeight: '500', textTransform: 'capitalize' },
  healthChipTextActive: { color: '#fff' },

  // Info card — bg/text set inline from theme
  infoCard: { borderRadius: R.lg, marginHorizontal: 16, marginTop: 16, ...Shadow.soft },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: G.foam },
  infoLabel: { fontSize: 14, color: G.stone },
  infoValue: { fontSize: 14, color: G.forest, fontWeight: '500', maxWidth: '55%', textAlign: 'right' },

  // Quick actions bar — sits right below the hero
  actionsBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: R.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadow.soft,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  actionDivider: { width: 1, marginVertical: 10 },
  actionEmoji: { fontSize: 20 },
  actionText: { fontSize: 10, fontWeight: '600', textAlign: 'center' },

  // Progress log section
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logProgressBtn: {
    backgroundColor: G.hunter,
    borderRadius: R.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  logProgressBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  progressEmpty: { fontSize: 13, marginTop: 12, lineHeight: 18 },

  // Wiki credit
  wikiCredit: { position: 'absolute', bottom: 8, right: 12, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  wikiCreditText: { fontSize: 9, color: 'rgba(255,255,255,0.8)' },

  // Catalog card
  catalogCard: { borderRadius: R.lg, marginHorizontal: 16, marginTop: 16, padding: 16, ...Shadow.soft },
  specsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  specChip: { flex: 1, minWidth: 80, borderRadius: R.md, borderWidth: 1.5, padding: 10, alignItems: 'center', gap: 2 },
  specChipEmoji: { fontSize: 20 },
  specChipLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  specChipValue: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  sowingBox: { borderRadius: R.md, borderWidth: 1.5, padding: 12, marginBottom: 4 },
  sowingTitle: { fontSize: 12, fontWeight: '700', marginBottom: 5 },
  sowingText: { fontSize: 13, lineHeight: 19 },
  tagChip: { borderRadius: R.full, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  tagChipText: { fontSize: 12 },
  notesBox: { borderRadius: R.md, borderWidth: 1, padding: 12, marginTop: 10 },
  notesText: { fontSize: 13, lineHeight: 19 },
  companionLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  companionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  goodChip: { backgroundColor: '#d8f3dc', borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 5 },
  goodChipText: { fontSize: 12, fontWeight: '600', color: '#2b8a3e' },
  badChip: { backgroundColor: '#ffe3e3', borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 5 },
  badChipText: { fontSize: 12, fontWeight: '600', color: '#c92a2a' },

  // Frost & planting
  frostZoneBadge:     { borderRadius: R.full, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 14 },
  frostZoneText:      { fontSize: 13, fontWeight: '700' },
  frostRow:           { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  frostChip:          { flex: 1, minWidth: 90, borderRadius: R.md, borderWidth: 1.5, padding: 10, alignItems: 'center', gap: 3 },
  frostChipLabel:     { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  frostChipDate:      { fontSize: 14, fontWeight: '800' },
  frostNoFrost:       { fontSize: 13, lineHeight: 19, marginBottom: 10 },
  frostNoLocation:    { fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  frostTimeline:      { borderRadius: R.md, borderWidth: 1, padding: 14, gap: 12 },
  frostTimelineTitle: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  frostTimelineRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  frostTimelineEmoji: { fontSize: 22, width: 30 },
  frostTimelineLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  frostTimelineDate:  { fontSize: 16, fontWeight: '800' },

  // Harvest log
  harvestActions: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  harvestActionBtn: { padding: 6 },
  harvestRow: {
    backgroundColor: G.cloud,
    borderRadius: R.md,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: G.dew,
  },
  harvestDate: { fontSize: 13, color: G.stone, minWidth: 72 },
  harvestYield: { fontSize: 15, fontWeight: '700', color: G.hunter, flex: 1 },
  harvestNotes: { fontSize: 12, color: G.fern },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { borderRadius: R.xl, padding: 24, margin: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: G.forest, marginBottom: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 20 },
  stepBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: G.dew, justifyContent: 'center', alignItems: 'center' },
  stepBtnText: { fontSize: 26, fontWeight: '300', color: G.hunter, lineHeight: 30 },
  stepValueWrap: { alignItems: 'center', minWidth: 90 },
  stepValue: { fontSize: 36, fontWeight: '800', color: G.forest },
  stepUnit: { fontSize: 13, color: G.stone, marginTop: 2 },
  input: {
    borderRadius: R.md,
    padding: 14,
    fontSize: 16,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  cancelBtn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#fff5f5', borderWidth: 1.5, borderColor: '#ffc9c9' },
  cancelText: { color: '#e03131', fontSize: 15, fontWeight: '700' },
  button: { backgroundColor: G.hunter, borderRadius: R.md, paddingHorizontal: 24, paddingVertical: 12 },
  buttonText: { color: G.cloud, fontWeight: '600', fontSize: 15 },
});
