import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, Image, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { pb, fileUrl } from '@/lib/pb';
import { useAuth } from '@/hooks/use-auth';
import PlantAvatar from '@/components/PlantAvatar';
import { G, R, Shadow } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import type { Plant, Harvest, PlantPhoto, HealthStatus } from '@/lib/types';
import { addActivityEntryAsync } from '@/lib/activity-log';
import { generateSinglePlantPdf } from '@/lib/garden-pdf';

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
  const [showHarvest, setShowHarvest] = useState(false);
  const [harvestUnit, setHarvestUnit] = useState<'grams' | 'quantity'>('quantity');
  const [harvestValue, setHarvestValue] = useState(1);
  const [harvestNotes, setHarvestNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    pb.collection('plants').getOne(id as string)
      .then((p) => {
        setPlant(p as any);
        navigation.setOptions({ title: (p as any).name });
      })
      .catch((e) => setLoadError(e?.message ?? 'Could not load plant'));

    pb.collection('harvests')
      .getFullList({ filter: `plant_id = "${id}"`, sort: '-harvested_at' })
      .then((h) => setHarvests(h as any))
      .catch(() => {});

    pb.collection('plant_photos')
      .getFullList({ filter: `plant_id = "${id}"`, sort: '-created' })
      .then((ph) => setPhotos(ph as any))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    photos.forEach((photo: any) => {
      if (photoUrls[photo.id]) return;
      setPhotoUrls((prev) => ({ ...prev, [photo.id]: fileUrl(photo, photo.photo) }));
    });
  }, [photos]);

  async function updateHealth(status: HealthStatus) {
    if (!plant) return;
    await pb.collection('plants').update(plant.id, { health_status: status });
    setPlant((p) => p ? { ...p, health_status: status } : p);
  }

  async function markWatered() {
    if (!plant) return;
    const now = new Date().toISOString();
    await pb.collection('plants').update(plant.id, { last_watered: now });
    setPlant((p) => p ? { ...p, last_watered: now } : p);
    Alert.alert('Watered! 💧', `${plant.name} marked as watered.`);
  }

  async function logHarvest() {
    if (!user || !plant || harvestValue <= 0) return;
    const isQty = harvestUnit === 'quantity';
    const yieldGrams = isQty ? 0 : harvestValue;
    const autoNote = isQty ? `${harvestValue} piece${harvestValue !== 1 ? 's' : ''} harvested` : null;
    const notes = harvestNotes.trim() || autoNote || null;

    const data = await pb.collection('harvests').create({
      plant_id: plant.id,
      user_id: user.id,
      yield_grams: yieldGrams,
      notes,
      harvested_at: new Date().toISOString(),
    });
    setHarvests((h) => [data as any, ...h]);
    addActivityEntryAsync(user.id, {
      type: 'harvest', plantId: plant.id, plantName: plant.name,
      gardenId: plant.garden_id, grams: yieldGrams || undefined, notes: notes || undefined,
    });
    if (!isQty) {
      const newTotal = (plant.total_yield_grams ?? 0) + yieldGrams;
      await pb.collection('plants').update(plant.id, { total_yield_grams: newTotal });
      setPlant((p) => p ? { ...p, total_yield_grams: newTotal } : p);
    }
    setShowHarvest(false);
    setHarvestValue(harvestUnit === 'grams' ? 100 : 1);
    setHarvestNotes('');
  }

  async function addPhoto() {
    if (!user || !plant) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const formData = new FormData();
      formData.append('photo', blob as any, `photo_${Date.now()}.jpg`);
      formData.append('plant_id', plant.id);
      formData.append('user_id', user.id);
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
  const heroUrl = photos.length > 0 ? photoUrls[photos[0].id] : null;
  const additionalPhotos = photos.length > 1 ? photos.slice(1) : [];

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg }]} contentContainerStyle={styles.content}>

      {/* ── Hero photo ─────────────────────────────────────────────────── */}
      <View style={styles.hero}>
        {heroUrl ? (
          <Image source={{ uri: heroUrl }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={[G.forest, G.fern]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.heroEmpty}
          >
            <PlantAvatar name={plant.name} size={110} />
          </LinearGradient>
        )}

        {/* Gradient overlay + name at bottom */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)']}
          style={styles.heroOverlay}
        >
          <View style={styles.heroBottom}>
            <Text style={styles.heroName}>{plant.name}</Text>
            {plant.variety ? (
              <Text style={styles.heroVariety}>{plant.variety}</Text>
            ) : null}
          </View>
        </LinearGradient>

        {/* Camera button */}
        <TouchableOpacity style={styles.cameraBtn} onPress={addPhoto} disabled={uploading}>
          <Text style={styles.cameraBtnText}>{uploading ? '⏳' : '📷'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Additional photos strip ─────────────────────────────────────── */}
      {photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.photoStrip}
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
          <TouchableOpacity style={[styles.photoThumb, styles.addPhotoThumb]} onPress={addPhoto} disabled={uploading}>
            <Text style={styles.addPhotoThumbText}>+</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

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

      {/* ── Quick actions ────────────────────────────────────────────────── */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={markWatered}>
          <Text style={styles.actionEmoji}>💧</Text>
          <Text style={styles.actionText}>Mark Watered</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => setShowHarvest(true)}>
          <Text style={styles.actionEmoji}>🧺</Text>
          <Text style={styles.actionText}>Log Harvest</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => generateSinglePlantPdf(plant)}>
          <Text style={styles.actionEmoji}>📄</Text>
          <Text style={styles.actionText}>Print Plant Card</Text>
        </TouchableOpacity>
        {photos.length === 0 && (
          <TouchableOpacity style={styles.actionButton} onPress={addPhoto} disabled={uploading}>
            <Text style={styles.actionEmoji}>{uploading ? '⏳' : '📷'}</Text>
            <Text style={styles.actionText}>Add Photo</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Harvest log ─────────────────────────────────────────────────── */}
      {harvests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧺 Harvest Log</Text>
          {harvests.map((h) => (
            <View key={h.id} style={styles.harvestRow}>
              <Text style={styles.harvestDate}>{new Date(h.harvested_at).toLocaleDateString()}</Text>
              <Text style={styles.harvestYield}>
                {h.yield_grams > 0
                  ? `${h.yield_grams}g`
                  : h.notes?.match(/^\d+ pieces?/)?.[0] ?? '—'}
              </Text>
              {h.notes && !h.notes.match(/^\d+ pieces?/) && (
                <Text style={styles.harvestNotes}>{h.notes}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* ── Harvest modal ────────────────────────────────────────────────── */}
      <Modal visible={showHarvest} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { backgroundColor: cardBg }]}>
            <Text style={[styles.modalTitle, { color: textPrim }]}>🧺 Log Harvest</Text>

            <View style={styles.unitToggle}>
              <TouchableOpacity
                style={[styles.unitBtn, harvestUnit === 'grams' && styles.unitBtnActive]}
                onPress={() => { setHarvestUnit('grams'); setHarvestValue(100); }}
              >
                <Text style={[styles.unitBtnText, harvestUnit === 'grams' && styles.unitBtnTextActive]}>⚖️ Grams</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unitBtn, harvestUnit === 'quantity' && styles.unitBtnActive]}
                onPress={() => { setHarvestUnit('quantity'); setHarvestValue(1); }}
              >
                <Text style={[styles.unitBtnText, harvestUnit === 'quantity' && styles.unitBtnTextActive]}>🔢 Quantity</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setHarvestValue(v => Math.max(harvestUnit === 'grams' ? 10 : 1, v - (harvestUnit === 'grams' ? 10 : 1)))}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <View style={styles.stepValueWrap}>
                <Text style={styles.stepValue}>{harvestValue}</Text>
                <Text style={styles.stepUnit}>{harvestUnit === 'grams' ? 'g' : harvestValue === 1 ? 'piece' : 'pieces'}</Text>
              </View>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setHarvestValue(v => v + (harvestUnit === 'grams' ? 10 : 1))}
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
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowHarvest(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={logHarvest}>
                <Text style={styles.buttonText}>Log Harvest</Text>
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
  cameraBtn: {
    position: 'absolute',
    top: 12,
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBtnText: { fontSize: 18 },

  // Photo strip
  photoStrip: { flexGrow: 0, backgroundColor: G.foam },
  photoStripContent: { paddingHorizontal: 14, paddingVertical: 12, gap: 8, flexDirection: 'row' },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: R.md,
    overflow: 'hidden',
  },
  photoThumbLoading: { backgroundColor: G.dew, justifyContent: 'center', alignItems: 'center' },
  addPhotoThumb: {
    backgroundColor: G.dew,
    borderWidth: 1.5,
    borderColor: G.mist,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoThumbText: { fontSize: 22, color: G.sage },

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

  // Quick actions
  actions: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 16 },
  actionButton: {
    flex: 1,
    borderRadius: R.lg,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: G.mist,
    gap: 4,
    ...Shadow.soft,
  },
  actionEmoji: { fontSize: 20 },
  actionText: { fontSize: 11, fontWeight: '600', color: G.hunter, textAlign: 'center' },

  // Harvest log
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
  unitToggle: { flexDirection: 'row', backgroundColor: G.foam, borderRadius: R.md, padding: 4, marginBottom: 20 },
  unitBtn: { flex: 1, paddingVertical: 9, borderRadius: R.sm, alignItems: 'center' },
  unitBtnActive: { backgroundColor: G.cloud, ...Shadow.soft },
  unitBtnText: { fontSize: 14, color: G.stone, fontWeight: '500' },
  unitBtnTextActive: { color: G.forest, fontWeight: '700' },
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
  buttonText: { color: G.cloud, fontWeight: '600' },
});
