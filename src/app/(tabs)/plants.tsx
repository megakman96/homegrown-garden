import { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, FlatList, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { offlineList, offlineCreate } from '@/lib/offline-db';
import { useAuth } from '@/hooks/use-auth';
import { usePremium, FREE_LIMITS } from '@/hooks/use-premium';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { G, Shadow, R } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import { getPlantIcon } from '@/lib/plant-icons';
import {
  PLANT_CATALOG, SUN_EMOJIS, SUN_LABELS, searchPlants,
  type CatalogEntry,
} from '@/lib/plant-catalog';
import { layoutFromGarden, TILE_COLORS, type GardenLayout } from '@/lib/garden-layout';
import { loadGardenLocation } from '@/lib/weather';
import { fetchZoneForCoords, getZoneViability } from '@/lib/frost-dates';
import { findPlantKey } from '@/lib/plant-catalog';
import type { Garden } from '@/lib/types';
import type { Plant } from '@/lib/types';

const COOL_SEASON_KEYS = new Set([
  'lettuce','spinach','kale','broccoli','cabbage','cauliflower','pea',
  'carrot','radish','beet','chard','arugula','bok_choy','collard_greens',
  'kohlrabi','turnip','parsnip','rutabaga','brussels_sprouts','celery',
]);

type CatalogItem = { key: string; entry: CatalogEntry };

const ALL_ITEMS: CatalogItem[] = Object.entries(PLANT_CATALOG)
  .map(([key, entry]) => ({ key, entry }))
  .sort((a, b) => a.entry.name.localeCompare(b.entry.name));

const CATEGORIES = ['All', ...Array.from(new Set(ALL_ITEMS.map(i => i.entry.category ?? 'Other'))).sort()];

export default function PlantCatalogueScreen() {
  const { user } = useAuth();
  const { isPremium } = usePremium();
  const { isDark, colors } = useAppTheme();
  const { isDesktop } = useBreakpoint();
  const router = useRouter();

  const bg      = isDark ? colors.bg        : G.foam;
  const cardBg  = isDark ? colors.bgCard    : G.cloud;
  const textPrim= isDark ? colors.text      : G.forest;
  const textSec = isDark ? colors.textSec   : G.stone;
  const border  = isDark ? colors.border    : G.mist;
  const inputBg = isDark ? colors.bgElement : '#f0f7ee';

  const { width: screenWidth } = useWindowDimensions();

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [gardens, setGardens] = useState<Garden[]>([]);

  // Wizard state
  const [wizardStep, setWizardStep] = useState<'garden' | 'tile' | null>(null);
  const [wizardGarden, setWizardGarden] = useState<Garden | null>(null);
  const [wizardGardenPlants, setWizardGardenPlants] = useState<Plant[]>([]);
  const [wizardTile, setWizardTile] = useState<{ row: number; col: number } | null>(null);
  const [wizardZone, setWizardZone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!user) return;
    offlineList('gardens', user.id, `user_id = "${user.id}"`)
      .then(data => setGardens(data as any))
      .catch(() => {});
  }, [user]));

  const filteredItems = useMemo(() => {
    let items = query.trim() ? searchPlants(query, 120) : ALL_ITEMS;
    if (activeCategory !== 'All') {
      items = items.filter(i => (i.entry.category ?? 'Other') === activeCategory);
    }
    return items;
  }, [query, activeCategory]);

  function closeWizard() {
    setWizardStep(null);
    setWizardGarden(null);
    setWizardGardenPlants([]);
    setWizardTile(null);
    setWizardZone(null);
  }

  async function selectWizardGarden(garden: Garden) {
    setWizardGarden(garden);
    setWizardTile(null);
    setWizardZone(null);
    setWizardStep('tile');
    if (user) {
      offlineList('plants', user.id, `garden_id = "${garden.id}"`)
        .then(data => setWizardGardenPlants(data as any))
        .catch(() => {});
    }
    // Fetch zone for this garden in the background
    loadGardenLocation(garden as any)
      .then(loc => loc ? fetchZoneForCoords(loc.latitude, loc.longitude) : null)
      .then(zone => { if (zone) setWizardZone(zone); })
      .catch(() => {});
  }

  async function confirmPlace() {
    if (!user || !selected || !wizardGarden) return;
    if (!isPremium) {
      const allPlants = await offlineList('plants', user.id, `user_id = "${user.id}"`).catch(() => []);
      if (allPlants.length >= FREE_LIMITS.plants) {
        closeWizard();
        setSelected(null);
        router.push('/subscription' as any);
        return;
      }
    }

    // Zone viability warning
    if (wizardZone) {
      const catalogKey = findPlantKey(selected.entry.name);
      const isCool = COOL_SEASON_KEYS.has(catalogKey ?? '');
      const viability = getZoneViability(catalogKey, wizardZone, isCool);
      if (viability.emoji === '❌') {
        const proceed = await new Promise<boolean>(resolve => {
          Alert.alert(
            `⚠️ Zone Mismatch`,
            `${selected.entry.name} is not recommended for Zone ${wizardZone.toUpperCase()}.\n\n${viability.label}.\n\nPlanting it here is unlikely to succeed. Do you want to add it anyway?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Add Anyway', style: 'destructive', onPress: () => resolve(true) },
            ],
          );
        });
        if (!proceed) return;
      } else if (viability.emoji === '⚠️') {
        const proceed = await new Promise<boolean>(resolve => {
          Alert.alert(
            `⚠️ Marginal Zone`,
            `${selected.entry.name} may struggle in Zone ${wizardZone.toUpperCase()}.\n\n${viability.label}.\n\nWith extra care it may still succeed. Add it?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Add Anyway', style: 'default', onPress: () => resolve(true) },
            ],
          );
        });
        if (!proceed) return;
      }
    }

    setSaving(true);
    try {
      const entry = selected.entry;
      await offlineCreate('plants', user.id, {
        user_id: user.id,
        garden_id: wizardGarden.id,
        name: entry.name,
        row: wizardTile?.row ?? null,
        col: wizardTile?.col ?? null,
        health_status: 'healthy',
        sun_requirement: entry.sunRequirement,
        water_interval_days: entry.waterIntervalDays,
        total_yield_grams: 0,
      });
      const msg = wizardTile
        ? `${entry.name} planted at row ${wizardTile.row + 1}, column ${wizardTile.col + 1} in ${wizardGarden.name}.`
        : `${entry.name} added to ${wizardGarden.name}. Place it on the grid from the Garden tab.`;
      Alert.alert('Planted! 🌱', msg);
      closeWizard();
      setSelected(null);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not add plant');
    } finally {
      setSaving(false);
    }
  }

  function renderItem({ item }: { item: CatalogItem }) {
    const { key, entry } = item;
    const icon = getPlantIcon(entry.name).emoji;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}
        onPress={() => setSelected({ key, entry })}
        activeOpacity={0.75}
      >
        <Text style={styles.cardEmoji}>{icon}</Text>
        <View style={styles.cardBody}>
          <Text style={[styles.cardName, { color: textPrim }]} numberOfLines={1}>{entry.name}</Text>
          {entry.scientificName && (
            <Text style={[styles.cardSci, { color: textSec }]} numberOfLines={1}>{entry.scientificName}</Text>
          )}
          <View style={styles.cardChips}>
            <View style={[styles.chip, { backgroundColor: isDark ? colors.bgElement : '#fff9db', borderColor: isDark ? colors.border : '#ffe066' }]}>
              <Text style={[styles.chipText, { color: isDark ? '#ffd43b' : '#7d5a00' }]}>{SUN_EMOJIS[entry.sunRequirement]} {SUN_LABELS[entry.sunRequirement]}</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: isDark ? colors.bgElement : '#e7f5ff', borderColor: isDark ? colors.border : '#74c0fc' }]}>
              <Text style={[styles.chipText, { color: isDark ? '#74c0fc' : '#1864ab' }]}>💧 {entry.waterIntervalDays}d</Text>
            </View>
            {entry.daysToMaturity && (
              <View style={[styles.chip, { backgroundColor: isDark ? colors.bgElement : '#f3f0ff', borderColor: isDark ? colors.border : '#b197fc' }]}>
                <Text style={[styles.chipText, { color: isDark ? '#b197fc' : '#5f3dc4' }]}>⏱ {entry.daysToMaturity.min}–{entry.daysToMaturity.max}d</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={[styles.cardArrow, { color: textSec }]}>›</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: isDark ? colors.bgCard : G.cloud, borderBottomColor: border }]}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: inputBg, borderColor: border, color: textPrim }]}
          placeholder="Search plants…"
          placeholderTextColor={textSec}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.categoryBar, { borderBottomColor: border }]}
        contentContainerStyle={styles.categoryBarContent}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryChip, { borderColor: border }, activeCategory === cat && styles.categoryChipActive]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text style={[styles.categoryChipText, { color: textSec }, activeCategory === cat && styles.categoryChipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Plant list */}
      <FlatList
        data={filteredItems}
        keyExtractor={i => i.key}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, isDesktop && styles.listDesktop]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🌿</Text>
            <Text style={[styles.emptyText, { color: textSec }]}>No plants match your search.</Text>
          </View>
        }
      />

      {/* Plant detail / wizard modal — single modal, content swaps based on wizardStep */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => { if (wizardStep) { closeWizard(); } else { setSelected(null); } }}>
        <View style={styles.detailBackdrop}>
          <TouchableOpacity style={styles.detailDismiss} activeOpacity={1} onPress={() => { if (wizardStep) { closeWizard(); } else { setSelected(null); } }} />
          <View style={[styles.detailSheet, { backgroundColor: cardBg }]}>
            <View style={styles.detailHandle} />

            {/* ── Wizard: garden picker ── */}
            {wizardStep === 'garden' && selected && (
              <>
                <Text style={[styles.wizardTitle, { color: textPrim }]}>Choose a Garden</Text>
                <Text style={[styles.wizardSub, { color: textSec }]}>Where should {selected.entry.name} go?</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {gardens.map(g => (
                    <TouchableOpacity key={g.id} style={[styles.gardenRow, { borderColor: border }]} onPress={() => selectWizardGarden(g)}>
                      <Text style={styles.gardenRowEmoji}>🌻</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.gardenRowName, { color: textPrim }]}>{g.name}</Text>
                        <Text style={[styles.gardenRowSub, { color: textSec }]}>{g.rows} × {g.cols} grid</Text>
                      </View>
                      <Text style={[styles.gardenRowArrow, { color: textSec }]}>›</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.pickCancel} onPress={closeWizard}>
                  <Text style={[styles.pickCancelText, { color: textSec }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── Wizard: tile picker ── */}
            {wizardStep === 'tile' && selected && wizardGarden && (() => {
              const layout: GardenLayout = layoutFromGarden(wizardGarden);
              const occupied = new Set(
                wizardGardenPlants.filter(p => p.row != null && p.col != null).map(p => `${p.row}:${p.col}`)
              );
              const tileSize = Math.max(28, Math.min(48, Math.floor((screenWidth - 80) / wizardGarden.cols)));
              const plantIcon = getPlantIcon(selected.entry.name).emoji;
              return (
                <>
                  <View style={styles.wizardTitleRow}>
                    <TouchableOpacity onPress={() => { setWizardStep('garden'); setWizardTile(null); }}>
                      <Text style={[styles.wizardBack, { color: G.hunter }]}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={[styles.wizardTitle, { color: textPrim, flex: 1, textAlign: 'center' }]}>Pick a Tile</Text>
                    <View style={{ width: 48 }} />
                  </View>
                  <Text style={[styles.wizardSub, { color: textSec, textAlign: 'center' }]}>
                    Tap an empty tile in {wizardGarden.name}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gridScroll}>
                    <View style={styles.gridWrap}>
                      {layout.map((rowArr, r) => (
                        <View key={r} style={styles.gridRow}>
                          {rowArr.map((cell, c) => {
                            const isInactive = cell === 'inactive';
                            const isOccupied = occupied.has(`${r}:${c}`);
                            const isChosen = wizardTile?.row === r && wizardTile?.col === c;
                            const occupant = wizardGardenPlants.find(p => p.row === r && p.col === c);
                            return (
                              <TouchableOpacity
                                key={c}
                                disabled={isInactive || isOccupied}
                                onPress={() => setWizardTile(isChosen ? null : { row: r, col: c })}
                                style={[styles.wizardTile, {
                                  width: tileSize, height: tileSize,
                                  backgroundColor: isInactive ? TILE_COLORS.inactive : isChosen ? G.hunter : TILE_COLORS[cell],
                                  opacity: isOccupied ? 0.5 : 1,
                                  borderWidth: isChosen ? 2 : 0,
                                  borderColor: G.cloud,
                                }]}
                              >
                                <Text style={{ fontSize: tileSize * 0.45 }}>
                                  {isChosen ? plantIcon : isOccupied ? getPlantIcon(occupant?.name ?? '').emoji : ''}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                  <View style={styles.wizardLegend}>
                    <View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: TILE_COLORS.full_sun }]} /><Text style={[styles.legendText, { color: textSec }]}>Full Sun</Text></View>
                    <View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: TILE_COLORS.partial_sun }]} /><Text style={[styles.legendText, { color: textSec }]}>Partial</Text></View>
                    <View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: TILE_COLORS.shade }]} /><Text style={[styles.legendText, { color: textSec }]}>Shade</Text></View>
                    <View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: TILE_COLORS.inactive }]} /><Text style={[styles.legendText, { color: textSec }]}>Path</Text></View>
                  </View>
                  <TouchableOpacity style={[styles.addBtn, { marginTop: 12 }]} onPress={confirmPlace} disabled={saving}>
                    <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addBtnGradient}>
                      {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.addBtnText}>{wizardTile ? 'Plant here ✓' : 'Add without placing'}</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pickCancel} onPress={closeWizard}>
                    <Text style={[styles.pickCancelText, { color: textSec }]}>Cancel</Text>
                  </TouchableOpacity>
                </>
              );
            })()}

            {/* ── Plant detail ── */}
            {!wizardStep && selected && (() => {
              const { key, entry } = selected;
              const icon = getPlantIcon(entry.name).emoji;
              return (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
                  {/* Header */}
                  <View style={styles.detailHeader}>
                    <Text style={styles.detailEmoji}>{icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.detailName, { color: textPrim }]}>{entry.name}</Text>
                      {entry.scientificName && (
                        <Text style={[styles.detailSci, { color: textSec }]}>{entry.scientificName}</Text>
                      )}
                      {entry.category && (
                        <View style={[styles.catBadge, { backgroundColor: isDark ? colors.bgElement : G.foam, borderColor: border }]}>
                          <Text style={[styles.catBadgeText, { color: textSec }]}>{entry.category}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Quick specs */}
                  <View style={styles.specsRow}>
                    <View style={[styles.specChip, { backgroundColor: isDark ? colors.bgElement : '#fff9db', borderColor: isDark ? colors.border : '#ffe066' }]}>
                      <Text style={styles.specEmoji}>{SUN_EMOJIS[entry.sunRequirement]}</Text>
                      <Text style={[styles.specLabel, { color: textSec }]}>Sun</Text>
                      <Text style={[styles.specValue, { color: textPrim }]}>{SUN_LABELS[entry.sunRequirement]}</Text>
                    </View>
                    <View style={[styles.specChip, { backgroundColor: isDark ? colors.bgElement : '#e7f5ff', borderColor: isDark ? colors.border : '#74c0fc' }]}>
                      <Text style={styles.specEmoji}>💧</Text>
                      <Text style={[styles.specLabel, { color: textSec }]}>Water</Text>
                      <Text style={[styles.specValue, { color: textPrim }]}>Every {entry.waterIntervalDays}d</Text>
                    </View>
                    {entry.spacingCm && (
                      <View style={[styles.specChip, { backgroundColor: isDark ? colors.bgElement : '#f3f0ff', borderColor: isDark ? colors.border : '#b197fc' }]}>
                        <Text style={styles.specEmoji}>📏</Text>
                        <Text style={[styles.specLabel, { color: textSec }]}>Spacing</Text>
                        <Text style={[styles.specValue, { color: textPrim }]}>{entry.spacingCm}cm</Text>
                      </View>
                    )}
                    {entry.daysToMaturity && (
                      <View style={[styles.specChip, { backgroundColor: isDark ? colors.bgElement : '#fff4e6', borderColor: isDark ? colors.border : '#ffa94d' }]}>
                        <Text style={styles.specEmoji}>⏱</Text>
                        <Text style={[styles.specLabel, { color: textSec }]}>Maturity</Text>
                        <Text style={[styles.specValue, { color: textPrim }]}>{entry.daysToMaturity.min}–{entry.daysToMaturity.max}d</Text>
                      </View>
                    )}
                  </View>

                  {/* Notes */}
                  {entry.notes && (
                    <View style={[styles.notesBox, { backgroundColor: isDark ? colors.bgElement : G.foam, borderColor: border }]}>
                      <Text style={[styles.notesText, { color: textPrim }]}>💡 {entry.notes}</Text>
                    </View>
                  )}

                  {/* Companion planting */}
                  {(entry.goodCompanions.length > 0 || entry.badCompanions.length > 0) && (
                    <View style={styles.companionSection}>
                      <Text style={[styles.sectionLabel, { color: textSec }]}>Companion Planting</Text>
                      {entry.goodCompanions.length > 0 && (
                        <>
                          <Text style={[styles.companionTitle, { color: '#2b8a3e' }]}>✅ Plant near</Text>
                          <View style={styles.chipRow}>
                            {entry.goodCompanions.map(k => {
                              const n = PLANT_CATALOG[k]?.name ?? k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                              return <View key={k} style={styles.goodChip}><Text style={styles.goodChipText}>{n}</Text></View>;
                            })}
                          </View>
                        </>
                      )}
                      {entry.badCompanions.length > 0 && (
                        <>
                          <Text style={[styles.companionTitle, { color: '#c92a2a', marginTop: 10 }]}>❌ Keep away from</Text>
                          <View style={styles.chipRow}>
                            {entry.badCompanions.map(k => {
                              const n = PLANT_CATALOG[k]?.name ?? k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                              return <View key={k} style={styles.badChip}><Text style={styles.badChipText}>{n}</Text></View>;
                            })}
                          </View>
                        </>
                      )}
                    </View>
                  )}

                  {/* Varieties */}
                  {entry.varieties && entry.varieties.length > 0 && (
                    <View style={[styles.companionSection]}>
                      <Text style={[styles.sectionLabel, { color: textSec }]}>Varieties</Text>
                      {entry.varieties.map((v, i) => (
                        <View key={i} style={[styles.varietyRow, { borderColor: border }]}>
                          <Text style={[styles.varietyName, { color: textPrim }]}>{v.name}</Text>
                          {v.notes && <Text style={[styles.varietyNotes, { color: textSec }]}>{v.notes}</Text>}
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Zone viability upsell (free users) */}
                  {!isPremium && (
                    <TouchableOpacity
                      style={[styles.zoneTeaser, { backgroundColor: isDark ? colors.bgElement : '#f0f7ee', borderColor: isDark ? colors.border : '#a5d6a7' }]}
                      onPress={() => router.push('/subscription' as any)}
                    >
                      <Text style={styles.zoneTeaserEmoji}>🌍</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.zoneTeaserTitle, { color: isDark ? '#a5d6a7' : '#2e7d32' }]}>Zone Viability  🔒 Pro</Text>
                        <Text style={[styles.zoneTeaserSub, { color: textSec }]}>
                          See if {entry.name} is a good fit for your local growing zone, with zone-adjusted watering intervals.
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Add to garden button */}
                  <TouchableOpacity
                    style={[styles.addBtn, { marginTop: 20 }]}
                    onPress={() => {
                      if (!user) { router.push('/login' as any); return; }
                      if (gardens.length === 0) {
                        Alert.alert('No Gardens', 'Create a garden first from the Garden tab, then add plants.');
                        return;
                      }
                      setWizardStep('garden');
                    }}
                  >
                    <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addBtnGradient}>
                      <Text style={styles.addBtnText}>🌱  Add to a Garden</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  searchBar: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  searchInput: { borderRadius: R.lg, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, borderWidth: 1.5 },

  categoryBar: { flexGrow: 0, borderBottomWidth: 1 },
  categoryBarContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  categoryChip: { borderRadius: R.full, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 10, minHeight: 38, justifyContent: 'center', alignItems: 'center' },
  categoryChipActive: { backgroundColor: G.hunter, borderColor: G.hunter },
  categoryChipText: { fontSize: 14, fontWeight: '600' },
  categoryChipTextActive: { color: '#fff' },

  list: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, paddingBottom: 40 },
  listDesktop: { maxWidth: 800, width: '100%', alignSelf: 'center' },

  card: { flexDirection: 'row', alignItems: 'center', borderRadius: R.lg, borderWidth: 1, padding: 12, gap: 10, ...Shadow.soft },
  cardEmoji: { fontSize: 32, width: 44, textAlign: 'center' },
  cardBody: { flex: 1, gap: 4 },
  cardName: { fontSize: 15, fontWeight: '700' },
  cardSci: { fontSize: 12, fontStyle: 'italic' },
  cardChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cardArrow: { fontSize: 20, fontWeight: '300', paddingHorizontal: 4 },

  chip: { borderRadius: R.full, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 11, fontWeight: '600' },

  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, fontWeight: '500' },

  // Detail sheet
  detailBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  detailDismiss: { flex: 1 },
  detailSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', paddingHorizontal: 24, paddingBottom: 32 },
  detailHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#d0d8d4', alignSelf: 'center', marginVertical: 12 },
  detailContent: { paddingBottom: 8 },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  detailEmoji: { fontSize: 52 },
  detailName: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, marginBottom: 2 },
  detailSci: { fontSize: 13, fontStyle: 'italic', marginBottom: 4 },
  catBadge: { alignSelf: 'flex-start', borderRadius: R.full, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  catBadgeText: { fontSize: 11, fontWeight: '600' },
  specsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  specChip: { flex: 1, minWidth: 80, borderRadius: R.md, borderWidth: 1.5, padding: 10, alignItems: 'center', gap: 2 },
  specEmoji: { fontSize: 20 },
  specLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  specValue: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  notesBox: { borderRadius: R.md, borderWidth: 1, padding: 12, marginBottom: 14 },
  notesText: { fontSize: 13, lineHeight: 19 },

  companionSection: { marginBottom: 14 },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  companionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  goodChip: { backgroundColor: '#d8f3dc', borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 5 },
  goodChipText: { fontSize: 12, fontWeight: '600', color: '#2b8a3e' },
  badChip: { backgroundColor: '#ffe3e3', borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 5 },
  badChipText: { fontSize: 12, fontWeight: '600', color: '#c92a2a' },

  varietyRow: { paddingVertical: 8, borderBottomWidth: 1, gap: 2 },
  varietyName: { fontSize: 13, fontWeight: '700' },
  varietyNotes: { fontSize: 12, lineHeight: 17 },

  addBtn: { borderRadius: R.lg, overflow: 'hidden', ...Shadow.card },
  addBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  gardenRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, gap: 10 },
  gardenRowEmoji: { fontSize: 24 },
  gardenRowName: { fontSize: 15, fontWeight: '600' },
  gardenRowSub: { fontSize: 12, marginTop: 1 },
  gardenRowArrow: { fontSize: 20, fontWeight: '300' },
  pickCancel: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  pickCancelText: { fontSize: 15, fontWeight: '600' },

  // Wizard
  wizardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  wizardBack: { fontSize: 15, fontWeight: '600', paddingVertical: 4, paddingRight: 8, width: 48 },
  wizardTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  wizardSub: { fontSize: 13, lineHeight: 18, marginBottom: 14 },
  gridScroll: { alignItems: 'center', paddingVertical: 8 },
  gridWrap: { gap: 2 },
  gridRow: { flexDirection: 'row', gap: 2 },
  wizardTile: { borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  wizardLegend: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 10, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 14, height: 14, borderRadius: 3 },
  legendText: { fontSize: 11, fontWeight: '600' },

  zoneTeaser:      { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: R.md, borderWidth: 1, padding: 12, marginTop: 16 },
  zoneTeaserEmoji: { fontSize: 22, width: 28, textAlign: 'center' },
  zoneTeaserTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  zoneTeaserSub:   { fontSize: 11, lineHeight: 16 },
});
