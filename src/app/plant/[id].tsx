import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, Image,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { pb, fileUrl } from '@/lib/pb';
import { useAuth } from '@/hooks/use-auth';
import type { Plant, Harvest, PlantPhoto, HealthStatus } from '@/lib/types';

const HEALTH_OPTIONS: HealthStatus[] = ['healthy', 'needs_water', 'sick', 'harvested', 'dead'];

export default function PlantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [plant, setPlant] = useState<Plant | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [photos, setPhotos] = useState<PlantPhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [showHarvest, setShowHarvest] = useState(false);
  const [harvestUnit, setHarvestUnit] = useState<'grams' | 'quantity'>('grams');
  const [harvestValue, setHarvestValue] = useState(100); // grams or count
  const [harvestNotes, setHarvestNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    // Fetch plant first — harvests/photos collections may not exist, don't let them block plant load
    pb.collection('plants').getOne(id as string)
      .then((p) => {
        setPlant(p as any);
        navigation.setOptions({ title: (p as any).name });
      })
      .catch((e) => {
        setLoadError(e?.message ?? 'Could not load plant');
      });

    pb.collection('harvests')
      .getFullList({ filter: `plant_id = "${id}"`, sort: '-harvested_at' })
      .then((h) => setHarvests(h as any))
      .catch(() => {}); // collection may not exist yet

    pb.collection('plant_photos')
      .getFullList({ filter: `plant_id = "${id}"`, sort: '-created' })
      .then((ph) => setPhotos(ph as any))
      .catch(() => {}); // collection may not exist yet
  }, [id]);

  useEffect(() => {
    photos.forEach((photo: any) => {
      if (photoUrls[photo.id]) return;
      const url = fileUrl(photo, photo.photo);
      setPhotoUrls((prev) => ({ ...prev, [photo.id]: url }));
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
    // Store quantity as a count; store grams as-is. Both go into yield_grams field.
    // Quantity harvests set yield_grams = 0 and record count in notes.
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
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    const formData = new FormData();
    formData.append('photo', blob as any, `photo_${Date.now()}.jpg`);
    formData.append('plant_id', plant.id);
    formData.append('user_id', user.id);
    try {
      const data = await pb.collection('plant_photos').create(formData);
      setPhotos((p) => [data as any, ...p]);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Unknown error');
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Health status */}
      <Text style={styles.label}>Health Status</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.healthPicker}>
        {HEALTH_OPTIONS.map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.healthChip, plant.health_status === status && styles.healthChipActive]}
            onPress={() => updateHealth(status)}
          >
            <Text style={[styles.healthChipText, plant.health_status === status && styles.healthChipTextActive]}>
              {status.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Info card */}
      <View style={styles.infoCard}>
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

      {/* Quick actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={markWatered}>
          <Text style={styles.actionText}>💧 Mark Watered</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => setShowHarvest(true)}>
          <Text style={styles.actionText}>🧺 Log Harvest</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={addPhoto}>
          <Text style={styles.actionText}>📷 Add Photo</Text>
        </TouchableOpacity>
      </View>

      {/* Photos */}
      {photos.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
            {photos.map((photo) => (
              photoUrls[photo.id] ? (
                <Image key={photo.id} source={{ uri: photoUrls[photo.id] }} style={styles.photo} />
              ) : (
                <View key={photo.id} style={[styles.photo, styles.photoPlaceholder]}>
                  <Text>📷</Text>
                </View>
              )
            ))}
          </ScrollView>
        </>
      )}

      {/* Harvest log */}
      {harvests.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Harvest Log</Text>
          {harvests.map((h) => (
            <View key={h.id} style={styles.harvestRow}>
              <Text style={styles.harvestDate}>{new Date(h.harvested_at).toLocaleDateString()}</Text>
              <Text style={styles.harvestYield}>
                {h.yield_grams > 0 ? `${h.yield_grams}g` : h.notes?.match(/^\d+ pieces?/) ? h.notes.match(/^\d+ pieces?/)?.[0] : '—'}
              </Text>
              {h.notes && !h.notes.match(/^\d+ pieces?/) && (
                <Text style={styles.harvestNotes}>{h.notes}</Text>
              )}
            </View>
          ))}
        </>
      )}

      <Modal visible={showHarvest} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>🧺 Log Harvest</Text>

            {/* Unit toggle */}
            <View style={styles.unitToggle}>
              <TouchableOpacity
                style={[styles.unitBtn, harvestUnit === 'grams' && styles.unitBtnActive]}
                onPress={() => { setHarvestUnit('grams'); setHarvestValue(100); }}
              >
                <Text style={[styles.unitBtnText, harvestUnit === 'grams' && styles.unitBtnTextActive]}>
                  ⚖️ Grams
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unitBtn, harvestUnit === 'quantity' && styles.unitBtnActive]}
                onPress={() => { setHarvestUnit('quantity'); setHarvestValue(1); }}
              >
                <Text style={[styles.unitBtnText, harvestUnit === 'quantity' && styles.unitBtnTextActive]}>
                  🔢 Quantity
                </Text>
              </TouchableOpacity>
            </View>

            {/* Stepper */}
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

            {/* Notes */}
            <TextInput
              style={styles.input}
              placeholder="Notes (optional)"
              value={harvestNotes}
              onChangeText={setHarvestNotes}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowHarvest(false)}>
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
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f7ee', padding: 32 },
  loadingEmoji: { fontSize: 48, marginBottom: 12 },
  loadingTitle: { fontSize: 18, fontWeight: '700', color: '#1b4332', marginBottom: 6 },
  loadingMsg: { fontSize: 14, color: '#52796f', textAlign: 'center', lineHeight: 20 },
  container: { flex: 1, backgroundColor: '#f0f7ee' },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: '#52796f', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  healthPicker: { flexGrow: 0, marginBottom: 20 },
  healthChip: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#b7e4c7',
  },
  healthChipActive: { backgroundColor: '#2d6a4f', borderColor: '#2d6a4f' },
  healthChipText: { color: '#2d6a4f', fontWeight: '500', textTransform: 'capitalize' },
  healthChipTextActive: { color: '#fff' },
  infoCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f7ee' },
  infoLabel: { fontSize: 14, color: '#52796f' },
  infoValue: { fontSize: 14, color: '#1b4332', fontWeight: '500', maxWidth: '55%', textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  actionButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#b7e4c7',
  },
  actionText: { fontSize: 12, fontWeight: '600', color: '#2d6a4f', textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#2d6a4f', marginBottom: 12 },
  photoRow: { flexGrow: 0, marginBottom: 24 },
  photo: { width: 120, height: 120, borderRadius: 12, marginRight: 10 },
  photoPlaceholder: { backgroundColor: '#d8f3dc', justifyContent: 'center', alignItems: 'center' },
  harvestRow: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  harvestDate: { fontSize: 13, color: '#52796f' },
  harvestYield: { fontSize: 15, fontWeight: '700', color: '#2d6a4f', flex: 1 },
  harvestNotes: { fontSize: 12, color: '#74c69d' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderRadius: 20, padding: 24, margin: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#2d6a4f', marginBottom: 16 },
  unitToggle: { flexDirection: 'row', backgroundColor: '#f0f7ee', borderRadius: 12, padding: 4, marginBottom: 20 },
  unitBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  unitBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  unitBtnText: { fontSize: 14, color: '#52796f', fontWeight: '500' },
  unitBtnTextActive: { color: '#2d6a4f', fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 20 },
  stepBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#d8f3dc', justifyContent: 'center', alignItems: 'center' },
  stepBtnText: { fontSize: 26, fontWeight: '300', color: '#2d6a4f', lineHeight: 30 },
  stepValueWrap: { alignItems: 'center', minWidth: 90 },
  stepValue: { fontSize: 36, fontWeight: '800', color: '#1b4332' },
  stepUnit: { fontSize: 13, color: '#52796f', marginTop: 2 },
  input: {
    backgroundColor: '#f0f7ee',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#b7e4c7',
    marginBottom: 12,
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  cancelText: { color: '#52796f', fontSize: 16 },
  button: { backgroundColor: '#2d6a4f', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
