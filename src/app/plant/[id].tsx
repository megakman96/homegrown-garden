import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, Image, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { pb } from '@/lib/pb';
import { offlineList, offlineOne, offlineUpdate, offlineCreate } from '@/lib/offline-db';
import { useAuth } from '@/hooks/use-auth';
import PlantAvatar from '@/components/PlantAvatar';
import { G, R, Shadow } from '@/constants/theme';
import { useAppTheme, formatLength, formatPrecip, formatWeight } from '@/contexts/theme-context';
import { usePremium } from '@/hooks/use-premium';
import type { Plant, Harvest, HealthStatus } from '@/lib/types';
import { addActivityEntryAsync } from '@/lib/activity-log';
import { generateSinglePlantPdf } from '@/lib/garden-pdf';
import { findPlantKey, PLANT_CATALOG, SUN_LABELS, SUN_EMOJIS, FILLER_PLANTS, getFillerSuggestions } from '@/lib/plant-catalog';
import { HEALTH_ISSUES, encodeSickReason, stripSickReason, parseSickReason, type HealthIssue } from '@/lib/plant-health';
import { fetchZoneForCoords, getFrostInfo, calcPlantingWindow, fmtDate, getZoneWaterAdjustment, getZoneViability, type FrostInfo, type PlantingWindow, type ZoneViability } from '@/lib/frost-dates';
import { loadGardenLocation } from '@/lib/weather';
import { emit } from '@/lib/events';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HERO_HEIGHT = 260;

const HEALTH_OPTIONS: HealthStatus[] = ['healthy', 'needs_water', 'sick', 'dead'];

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
  const { isDark, colors, tempUnit, measureUnit } = useAppTheme();
  const { isPremium } = usePremium();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const [showSickPicker, setShowSickPicker] = useState(false);

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

  }, [id]);

  async function updateHealth(status: HealthStatus) {
    if (!plant || !user) return;
    if (status === 'sick') {
      setShowSickPicker(true);
      return;
    }
    await offlineUpdate('plants', user.id, plant.id, { health_status: status });
    setPlant((p) => p ? { ...p, health_status: status } : p);
  }

  async function confirmSickWithIssue(issue: HealthIssue) {
    if (!plant || !user) return;
    setShowSickPicker(false);
    const newNotes = encodeSickReason(issue, plant.notes ?? null);
    await offlineUpdate('plants', user.id, plant.id, { health_status: 'sick', notes: newNotes });
    setPlant((p) => p ? { ...p, health_status: 'sick', notes: newNotes } : p);
  }

  async function markWatered() {
    if (!plant || !user) return;
    const now = new Date().toISOString();
    await offlineUpdate('plants', user.id, plant.id, { last_watered: now });
    setPlant((p) => p ? { ...p, last_watered: now } : p);
    emit('plants:changed');
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
        harvested_at: new Date().toISOString(),
        notes,
      };

      const { record: data } = await offlineCreate('harvests', user.id, payload);
      setHarvests((h) => [data as any, ...h]);
      addActivityEntryAsync(user.id, {
        type: 'harvest', plantId: plant.id, plantName: plant.name,
        gardenId: plant.garden_id, grams: harvestCount, notes,
      });
      emit('plants:changed');
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

  const totalYieldDisplay = formatWeight(plant.total_yield_grams, measureUnit);

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
    <View style={{ flex: 1, backgroundColor: bg }}>
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

      {/* ── Sick issue advice ───────────────────────────────────────────── */}
      {plant.health_status === 'sick' && (() => {
        const issue = parseSickReason(plant.notes ?? null);
        const info = issue ? HEALTH_ISSUES[issue] : null;
        return (
          <View style={[styles.sickCard, { backgroundColor: '#fff5f5', borderColor: '#ffc9c9' }]}>
            <View style={styles.sickCardHeader}>
              <Text style={styles.sickCardEmoji}>{info ? info.emoji : '🟠'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sickCardTitle}>{info ? info.label : 'Plant is sick'}</Text>
                <Text style={styles.sickCardSub}>How to help this plant recover</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSickPicker(true)} style={styles.sickChangeBtn}>
                <Text style={styles.sickChangeBtnText}>Change</Text>
              </TouchableOpacity>
            </View>
            {info && (
              <View style={styles.sickAdviceList}>
                {info.advice.map((tip, i) => (
                  <View key={i} style={styles.sickAdviceRow}>
                    <Text style={styles.sickAdviceNum}>{i + 1}</Text>
                    <Text style={styles.sickAdviceTip}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}
            {!info && (
              <TouchableOpacity style={styles.sickPickBtn} onPress={() => setShowSickPicker(true)}>
                <Text style={styles.sickPickBtnText}>Tell us what's wrong →</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })()}

      {/* ── Climbing plant alert ────────────────────────────────────────── */}
      {catalogInfo?.isClimbing && (
        <View style={[styles.alertCard, styles.climbingCard]}>
          <Text style={styles.alertEmoji}>🧗</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>Climbing Plant — Needs Support</Text>
            <Text style={styles.alertBody}>{catalogInfo.climbingNote ?? 'This plant climbs and needs a trellis, fence, or stake to grow properly.'}</Text>
          </View>
        </View>
      )}

      {/* ── Invasive plant alert ─────────────────────────────────────────── */}
      {catalogInfo?.isInvasive && (
        <View style={[styles.alertCard, styles.invasiveCard]}>
          <Text style={styles.alertEmoji}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.alertTitle, { color: '#a05000' }]}>Invasive — Isolate This Plant</Text>
            <Text style={[styles.alertBody, { color: '#7a3d00' }]}>{catalogInfo.invasiveNote ?? 'This plant spreads aggressively. Keep it isolated from the rest of your garden.'}</Text>
          </View>
        </View>
      )}

      {/* ── Info card ───────────────────────────────────────────────────── */}
      <View style={[styles.infoCard, { backgroundColor: cardBg }]}>
        {plant.variety && <InfoRow label="Variety" value={plant.variety} tc={textSec} vc={textPrim} />}
        {plant.planted_date && <InfoRow label="Planted" value={new Date(plant.planted_date).toLocaleDateString()} tc={textSec} vc={textPrim} />}
        {plant.expected_harvest_date && (
          <InfoRow label="Expected harvest" value={new Date(plant.expected_harvest_date).toLocaleDateString()} tc={textSec} vc={textPrim} />
        )}
        {plant.last_watered && (
          <InfoRow label="Last watered" value={new Date(plant.last_watered).toLocaleDateString()} tc={textSec} vc={textPrim} />
        )}
        {plant.water_interval_days && (
          <InfoRow label="Water every" value={`${plant.water_interval_days} days`} tc={textSec} vc={textPrim} />
        )}
        <InfoRow label="Total yield" value={totalYieldDisplay} tc={textSec} vc={textPrim} />
        {(() => { const n = stripSickReason(plant.notes ?? ''); return n ? <InfoRow label="Notes" value={n} tc={textSec} vc={textPrim} /> : null; })()}
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
            {!isPremium && (
              <TouchableOpacity
                style={[styles.specChip, { backgroundColor: isDark ? colors.bgElement : '#f0f7ee', borderColor: isDark ? colors.border : '#a5d6a7' }]}
                onPress={() => router.push('/subscription' as any)}
              >
                <Text style={styles.specChipEmoji}>🌍</Text>
                <Text style={[styles.specChipLabel, { color: textSec }]}>Zone</Text>
                <Text style={[styles.specChipValue, { color: G.hunter }]}>Pro 🔒</Text>
              </TouchableOpacity>
            )}
            {catalogInfo.spacingCm && (
              <View style={[styles.specChip, { backgroundColor: isDark ? colors.bgElement : '#f3f0ff', borderColor: isDark ? colors.border : '#b197fc' }]}>
                <Text style={styles.specChipEmoji}>📏</Text>
                <Text style={[styles.specChipLabel, { color: textSec }]}>Spacing</Text>
                <Text style={[styles.specChipValue, { color: textPrim }]}>{formatLength(catalogInfo.spacingCm!, measureUnit)}</Text>
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
                  return `Direct sow outdoors after last frost date when soil is warm (${tempUnit === 'F' ? '60°F' : '15°C'}+).`;
                })()}
              </Text>
              <Text style={[styles.sowingText, { color: textSec, marginTop: 4 }]}>
                {(() => {
                if (!catalogInfo.spacingCm) {
                  return `Seed depth: ${measureUnit === 'us' ? '½–¾"' : '1–2 cm'}`;
                }
                const minCm = Math.round(catalogInfo.spacingCm * 0.15);
                const maxCm = Math.round(catalogInfo.spacingCm * 0.25);
                if (measureUnit === 'us') {
                  const minIn = (minCm / 2.54).toFixed(1);
                  const maxIn = (maxCm / 2.54).toFixed(1);
                  return `Seed depth: ${minIn}–${maxIn}"`;
                }
                return `Seed depth: ${minCm}–${maxCm} cm`;
              })()}
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

      {/* ── Filler plants ───────────────────────────────────────────────── */}
      {catalogInfo && (() => {
        const fillers = getFillerSuggestions(catalogInfo);
        if (fillers.length === 0) return null;
        return (
          <View style={[styles.catalogCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.sectionTitle, { color: textPrim, paddingHorizontal: 0, marginBottom: 4 }]}>🌱 Filler Plants</Text>
            <Text style={[styles.fillerSubtitle, { color: textSec }]}>
              Low-growing plants to fill the space around {plant.name}
            </Text>
            {fillers.map(key => {
              const filler = FILLER_PLANTS[key];
              const name = PLANT_CATALOG[key]?.name ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              return (
                <View key={key} style={[styles.fillerRow, { borderColor: isDark ? colors.border : G.mist }]}>
                  <Text style={styles.fillerEmoji}>{filler.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fillerName, { color: textPrim }]}>{name}</Text>
                    <Text style={[styles.fillerWhy, { color: textSec }]}>{filler.why}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        );
      })()}

      {/* ── Frost & planting dates ──────────────────────────────────────── */}
      <View style={[styles.catalogCard, { backgroundColor: cardBg }]}>
        <Text style={[styles.sectionTitle, { color: textPrim, paddingHorizontal: 0, marginBottom: 14 }]}>🌡️ Frost & Planting</Text>

        {!isPremium ? (
          <View style={[styles.proBox, { backgroundColor: isDark ? colors.bgElement : '#f0f7ee', borderColor: isDark ? colors.border : G.mist }]}>
            <Text style={styles.proBoxEmoji}>🌱</Text>
            <Text style={[styles.proBoxTitle, { color: textPrim }]}>Pro Feature</Text>
            <Text style={[styles.proBoxText, { color: textSec }]}>
              Unlock frost dates, planting windows, and personalized growing timelines for {plant.name}. Upgrade to Pro.
            </Text>
            <TouchableOpacity style={styles.proBoxBtn} onPress={() => router.push('/subscription' as any)}>
              <Text style={styles.proBoxBtnText}>Upgrade to Pro →</Text>
            </TouchableOpacity>
          </View>
        ) : frostInfo && frostZoneLabel ? (
            <>
              {/* Zone + season length */}
              <View style={[styles.frostZoneBadge, { backgroundColor: isDark ? colors.bgElement : '#e8f5e9', borderColor: isDark ? colors.border : '#a5d6a7' }]}>
                <Text style={[styles.frostZoneText, { color: isDark ? '#a5d6a7' : '#2e7d32' }]}>
                  📍 {frostZoneLabel}
                </Text>
              </View>

              {/* Zone viability */}
              {(() => {
                const viability: ZoneViability = getZoneViability(catalogKey, frostInfo.zone, !isWarmSeason);
                const waterAdj = getZoneWaterAdjustment(frostInfo.zone);
                const baseInterval = plant.water_interval_days ?? catalogInfo?.waterIntervalDays ?? 3;
                const adjInterval = Math.max(1, baseInterval + waterAdj);
                return (
                  <View style={{ gap: 8, marginBottom: 12 }}>
                    <View style={[styles.zoneViabilityRow, { backgroundColor: isDark ? colors.bgElement : '#f8f9fa', borderColor: isDark ? colors.border : '#dee2e6' }]}>
                      <Text style={[styles.zoneViabilityEmoji]}>{viability.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.zoneViabilityLabel, { color: viability.color }]}>{viability.label}</Text>
                        <Text style={[styles.zoneViabilitySub, { color: textSec }]}>Zone {frostInfo.zone.toUpperCase()} suitability for {plant.name}</Text>
                      </View>
                    </View>
                    {waterAdj !== 0 && (
                      <View style={[styles.zoneViabilityRow, { backgroundColor: isDark ? colors.bgElement : '#e7f5ff', borderColor: isDark ? colors.border : '#74c0fc' }]}>
                        <Text style={styles.zoneViabilityEmoji}>💧</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.zoneViabilityLabel, { color: isDark ? '#74c0fc' : '#1971c2' }]}>
                            Zone-adjusted: water every {adjInterval}d
                          </Text>
                          <Text style={[styles.zoneViabilitySub, { color: textSec }]}>
                            Catalog default is every {baseInterval}d · {waterAdj > 0 ? `zone ${frostInfo.zone.toUpperCase()} retains moisture longer` : `zone ${frostInfo.zone.toUpperCase()} dries out faster`}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })()}

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
              Set a location on this garden (Garden → Edit → Location tab) to see frost dates and planting windows.
            </Text>
          )}
        </View>

      {/* ── Harvest log ─────────────────────────────────────────────────── */}
      {harvests.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textPrim }]}>🧺 Harvest Log</Text>
          {harvests.map((h) => (
            <View key={h.id} style={[styles.harvestRow, { borderColor: border, backgroundColor: cardBg }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.harvestDate, { color: textSec }]}>{new Date((h.harvested_at || (h as any).created) || new Date()).toLocaleDateString()}</Text>
                <Text style={[styles.harvestYield, { color: textPrim }]}>
                  {h.notes?.match(/^\d+ pieces?/)?.[0] ?? (h.yield_grams > 0 ? `${h.yield_grams} piece${h.yield_grams !== 1 ? 's' : ''}` : '—')}
                </Text>
                {h.notes && !h.notes.match(/^\d+ pieces?/) && (
                  <Text style={[styles.harvestNotes, { color: textSec }]}>{h.notes}</Text>
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
      {/* ── Sick issue picker modal ─────────────────────────────────────── */}
      <Modal visible={showSickPicker} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { backgroundColor: cardBg, maxHeight: '85%' }]}>
            <Text style={[styles.modalTitle, { color: textPrim }]}>🟠 What's wrong with {plant.name}?</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {(Object.entries(HEALTH_ISSUES) as [HealthIssue, typeof HEALTH_ISSUES[HealthIssue]][]).map(([key, info]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.issueRow, { borderColor: border, backgroundColor: inputBg }]}
                  onPress={() => confirmSickWithIssue(key)}
                >
                  <Text style={styles.issueEmoji}>{info.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.issueLabel, { color: textPrim }]}>{info.label}</Text>
                    <Text style={[styles.issueSub, { color: textSec }]}>{info.advice[0]}</Text>
                  </View>
                  <Text style={{ color: textSec, fontSize: 18 }}>›</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSickPicker(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
    {/* Back button outside the ScrollView so iOS scroll gestures can't steal the tap */}
    <TouchableOpacity
      style={[styles.heroBackBtn, { top: insets.top + 8 }]}
      onPress={() => router.back()}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Text style={styles.heroBackText}>‹</Text>
    </TouchableOpacity>
    </View>
  );
}

function InfoRow({ label, value, tc, vc }: { label: string; value: string; tc?: string; vc?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, tc ? { color: tc } : undefined]}>{label}</Text>
      <Text style={[styles.infoValue, vc ? { color: vc } : undefined]}>{value}</Text>
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
  heroBackBtn: {
    position: 'absolute',
    top: 12,
    left: 14,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBackText: { color: '#fff', fontSize: 26, fontWeight: '700', lineHeight: 30, marginLeft: -2 },
  heroBottom: { gap: 2 },
  heroName: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  heroVariety: { fontSize: 14, color: 'rgba(255,255,255,0.75)' },
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
  alertCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 16, marginTop: 12, borderRadius: R.lg, borderWidth: 1.5, padding: 14 },
  climbingCard: { backgroundColor: '#e7f5ff', borderColor: '#74c0fc' },
  invasiveCard: { backgroundColor: '#fff4e6', borderColor: '#ffa94d' },
  alertEmoji: { fontSize: 26, marginTop: 1 },
  alertTitle: { fontSize: 14, fontWeight: '700', color: '#1971c2', marginBottom: 4 },
  alertBody: { fontSize: 13, lineHeight: 18, color: '#1864ab' },
  fillerSubtitle: { fontSize: 13, marginBottom: 12 },
  fillerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderTopWidth: 1 },
  fillerEmoji: { fontSize: 22, width: 28, textAlign: 'center', marginTop: 1 },
  fillerName: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  fillerWhy: { fontSize: 12, lineHeight: 17 },
  companionLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  companionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  goodChip: { backgroundColor: '#d8f3dc', borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 5 },
  goodChipText: { fontSize: 12, fontWeight: '600', color: '#2b8a3e' },
  badChip: { backgroundColor: '#ffe3e3', borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 5 },
  badChipText: { fontSize: 12, fontWeight: '600', color: '#c92a2a' },

  // Pro upsell box
  proBox:         { borderRadius: R.lg, borderWidth: 1.5, padding: 16, alignItems: 'center', gap: 8 },
  proBoxEmoji:    { fontSize: 32, marginBottom: 4 },
  proBoxTitle:    { fontSize: 16, fontWeight: '800' },
  proBoxText:     { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  proBoxBtn:      { backgroundColor: G.hunter, borderRadius: R.full, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  proBoxBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },

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

  zoneViabilityRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: R.md, borderWidth: 1, padding: 10 },
  zoneViabilityEmoji: { fontSize: 18, width: 24, textAlign: 'center' },
  zoneViabilityLabel: { fontSize: 13, fontWeight: '700' },
  zoneViabilitySub:   { fontSize: 11, marginTop: 1 },

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

  // Sick card
  sickCard:        { borderRadius: R.lg, borderWidth: 1.5, marginHorizontal: 16, marginTop: 12, padding: 16 },
  sickCardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  sickCardEmoji:   { fontSize: 32 },
  sickCardTitle:   { fontSize: 15, fontWeight: '700', color: '#c92a2a' },
  sickCardSub:     { fontSize: 12, color: '#868e96', marginTop: 2 },
  sickChangeBtn:   { borderRadius: R.full, backgroundColor: '#ffe3e3', borderWidth: 1, borderColor: '#ffc9c9', paddingHorizontal: 10, paddingVertical: 5 },
  sickChangeBtnText: { fontSize: 12, fontWeight: '700', color: '#c92a2a' },
  sickAdviceList:  { gap: 10 },
  sickAdviceRow:   { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  sickAdviceNum:   { width: 22, height: 22, borderRadius: 11, backgroundColor: '#f03e3e', color: '#fff', fontSize: 11, fontWeight: '800', textAlign: 'center', lineHeight: 22 },
  sickAdviceTip:   { flex: 1, fontSize: 13, lineHeight: 19, color: '#495057' },
  sickPickBtn:     { backgroundColor: '#ffe3e3', borderRadius: R.md, padding: 12, alignItems: 'center', marginTop: 8 },
  sickPickBtnText: { color: '#c92a2a', fontWeight: '700', fontSize: 14 },

  // Sick issue picker
  issueRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: R.md, borderWidth: 1, padding: 12, marginBottom: 8 },
  issueEmoji: { fontSize: 28, width: 36, textAlign: 'center' },
  issueLabel: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  issueSub:   { fontSize: 11, lineHeight: 15 },

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
