import { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { offlineList, offlineCreate } from '@/lib/offline-db';
import { useAuth } from '@/hooks/use-auth';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { G, Shadow, R } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import { getPlantIcon } from '@/lib/plant-icons';
import {
  PLANT_CATALOG, SUN_EMOJIS, SUN_LABELS, searchPlants,
  type CatalogEntry,
} from '@/lib/plant-catalog';
import type { Garden } from '@/lib/types';

type CatalogItem = { key: string; entry: CatalogEntry };

const ALL_ITEMS: CatalogItem[] = Object.entries(PLANT_CATALOG)
  .map(([key, entry]) => ({ key, entry }))
  .sort((a, b) => a.entry.name.localeCompare(b.entry.name));

const CATEGORIES = ['All', ...Array.from(new Set(ALL_ITEMS.map(i => i.entry.category ?? 'Other'))).sort()];

export default function PlantCatalogueScreen() {
  const { user } = useAuth();
  const { isDark, colors } = useAppTheme();
  const { isDesktop } = useBreakpoint();
  const router = useRouter();

  const bg      = isDark ? colors.bg        : G.foam;
  const cardBg  = isDark ? colors.bgCard    : G.cloud;
  const textPrim= isDark ? colors.text      : G.forest;
  const textSec = isDark ? colors.textSec   : G.stone;
  const border  = isDark ? colors.border    : G.mist;
  const inputBg = isDark ? colors.bgElement : '#f0f7ee';

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingToGarden, setAddingToGarden] = useState(false);

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

  async function addToGarden(gardenId: string) {
    if (!user || !selected) return;
    setAddingToGarden(true);
    try {
      const entry = selected.entry;
      await offlineCreate('plants', user.id, {
        user_id: user.id,
        garden_id: gardenId,
        name: entry.name,
        row: null,
        col: null,
        health_status: 'healthy',
        sun_requirement: entry.sunRequirement,
        water_interval_days: entry.waterIntervalDays,
        total_yield_grams: 0,
      });
      Alert.alert('Added! 🌱', `${entry.name} has been added to your garden. Place it on the grid from the Garden tab.`);
      setShowAddModal(false);
      setSelected(null);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not add plant');
    } finally {
      setAddingToGarden(false);
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

      {/* Plant detail modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.detailBackdrop}>
          <TouchableOpacity style={styles.detailDismiss} activeOpacity={1} onPress={() => setSelected(null)} />
          <View style={[styles.detailSheet, { backgroundColor: cardBg }]}>
            <View style={styles.detailHandle} />

            {selected && (() => {
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

                  {/* Add to garden button */}
                  <TouchableOpacity
                    style={[styles.addBtn, { marginTop: 20 }]}
                    onPress={() => {
                      if (!user) { router.push('/login' as any); return; }
                      if (gardens.length === 0) {
                        Alert.alert('No Gardens', 'Create a garden first, then add plants.');
                        return;
                      }
                      setShowAddModal(true);
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

      {/* Pick garden modal */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View style={[styles.pickBackdrop]}>
          <View style={[styles.pickSheet, { backgroundColor: cardBg }]}>
            <Text style={[styles.pickTitle, { color: textPrim }]}>Add to which garden?</Text>
            <Text style={[styles.pickSub, { color: textSec }]}>{selected?.entry.name} will be added without a grid position. Place it from the Garden tab.</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
              {gardens.map(g => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.gardenRow, { borderColor: border }]}
                  onPress={() => addToGarden(g.id)}
                  disabled={addingToGarden}
                >
                  <Text style={styles.gardenRowEmoji}>🌻</Text>
                  <Text style={[styles.gardenRowName, { color: textPrim }]}>{g.name}</Text>
                  <Text style={[styles.gardenRowArrow, { color: textSec }]}>›</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.pickCancel} onPress={() => setShowAddModal(false)}>
              <Text style={[styles.pickCancelText, { color: textSec }]}>Cancel</Text>
            </TouchableOpacity>
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
  categoryChip: { borderRadius: R.full, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 6 },
  categoryChipActive: { backgroundColor: G.hunter, borderColor: G.hunter },
  categoryChipText: { fontSize: 13, fontWeight: '600' },
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

  addBtn: { borderRadius: R.lg, overflow: 'hidden', ...Shadow.card },
  addBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  // Pick garden modal
  pickBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  pickSheet: { borderRadius: R.xl, padding: 24, width: '100%', maxWidth: 440 },
  pickTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  pickSub: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  gardenRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, gap: 10 },
  gardenRowEmoji: { fontSize: 24 },
  gardenRowName: { flex: 1, fontSize: 15, fontWeight: '600' },
  gardenRowArrow: { fontSize: 20, fontWeight: '300' },
  pickCancel: { marginTop: 16, alignItems: 'center', paddingVertical: 12 },
  pickCancelText: { fontSize: 15, fontWeight: '600' },
});
