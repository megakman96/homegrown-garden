import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { pb } from '@/lib/pb';
import { useAuth } from '@/hooks/use-auth';
import { useAppTheme } from '@/contexts/theme-context';
import PlantAvatar from '@/components/PlantAvatar';
import { G, R, Shadow } from '@/constants/theme';

type PlantStats = {
  plantName: string;
  myGardens: number;
  shared: number;
  total: number;
};

type YearStats = {
  year: number;
  totalPieces: number;
  plants: PlantStats[];
};

export default function StatisticsScreen() {
  const { user } = useAuth();
  const { isDark, colors } = useAppTheme();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [yearStats, setYearStats] = useState<YearStats[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const bg = isDark ? colors.bg : G.foam;
  const cardBg = isDark ? colors.bgCard : G.cloud;
  const textPrim = isDark ? colors.text : G.forest;
  const textSec = isDark ? colors.textSec : G.stone;
  const border = isDark ? colors.border : G.mist;

  useEffect(() => {
    navigation.setOptions({ title: 'Harvest Statistics', headerShown: true, headerBackTitle: 'Back' });
    if (!user) return;
    loadStats();
  }, [user]);

  async function loadStats() {
    if (!user) return;
    setLoading(true);
    try {
      const [harvests, plants, sharedGardenRecords] = await Promise.all([
        pb.collection('harvests').getFullList({ filter: `user_id = "${user.id}"` }),
        pb.collection('plants').getFullList({ filter: `user_id = "${user.id}"` }),
        pb.collection('garden_shares').getFullList({ filter: `owner_id = "${user.id}"` }),
      ]);

      const plantMap = new Map<string, any>(plants.map((p: any) => [p.id, p]));
      const sharedGardenIds = new Set<string>(sharedGardenRecords.map((s: any) => s.garden_id));

      const byYear = new Map<number, Map<string, PlantStats>>();

      for (const h of harvests as any[]) {
        const date = new Date(h.harvested_at ?? h.created);
        const year = date.getFullYear();
        const plant = plantMap.get(h.plant_id);
        const plantName = plant?.name ?? 'Unknown Plant';
        const gardenId = plant?.garden_id ?? '';
        const isShared = sharedGardenIds.has(gardenId);
        const pieces = Number(h.yield_grams ?? 0);

        if (!byYear.has(year)) byYear.set(year, new Map());
        const yearMap = byYear.get(year)!;

        if (!yearMap.has(plantName)) {
          yearMap.set(plantName, { plantName, myGardens: 0, shared: 0, total: 0 });
        }
        const stats = yearMap.get(plantName)!;
        stats.total += pieces;
        if (isShared) stats.shared += pieces;
        else stats.myGardens += pieces;
      }

      const result: YearStats[] = [];
      for (const [year, pMap] of byYear) {
        const plantList = [...pMap.values()].sort((a, b) => b.total - a.total);
        result.push({
          year,
          totalPieces: plantList.reduce((sum, p) => sum + p.total, 0),
          plants: plantList,
        });
      }
      result.sort((a, b) => b.year - a.year);
      setYearStats(result);
      if (result.length > 0) setSelectedYear(result[0].year);
    } finally {
      setLoading(false);
    }
  }

  const currentYearData = yearStats.find(y => y.year === selectedYear);
  const maxPieces = currentYearData ? Math.max(...currentYearData.plants.map(p => p.total), 1) : 1;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator color={G.hunter} size="large" />
        <Text style={[styles.loadingText, { color: textSec }]}>Loading statistics…</Text>
      </View>
    );
  }

  if (yearStats.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <Text style={styles.emptyEmoji}>🧺</Text>
        <Text style={[styles.emptyTitle, { color: textPrim }]}>No harvests yet</Text>
        <Text style={[styles.emptyText, { color: textSec }]}>
          Log your first harvest from a plant's detail page to start tracking statistics.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg }]} contentContainerStyle={styles.content}>

      {/* Year selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.yearBar} contentContainerStyle={styles.yearBarContent}>
        {yearStats.map(y => (
          <TouchableOpacity
            key={y.year}
            style={[styles.yearChip, { borderColor: border }, selectedYear === y.year && styles.yearChipActive]}
            onPress={() => setSelectedYear(y.year)}
          >
            <Text style={[styles.yearChipText, { color: textPrim }, selectedYear === y.year && styles.yearChipTextActive]}>
              {y.year}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Summary card */}
      {currentYearData && (
        <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
          <Text style={[styles.summaryYear, { color: textSec }]}>{selectedYear} Total</Text>
          <Text style={[styles.summaryTotal, { color: textPrim }]}>{currentYearData.totalPieces.toLocaleString()}</Text>
          <Text style={[styles.summaryLabel, { color: textSec }]}>pieces harvested</Text>
          <View style={[styles.summaryDivider, { backgroundColor: border }]} />
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryItemNum, { color: G.hunter }]}>
                {currentYearData.plants.reduce((s, p) => s + p.myGardens, 0).toLocaleString()}
              </Text>
              <Text style={[styles.summaryItemLabel, { color: textSec }]}>My Gardens</Text>
            </View>
            <View style={[styles.summaryItemDivider, { backgroundColor: border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryItemNum, { color: '#339af0' }]}>
                {currentYearData.plants.reduce((s, p) => s + p.shared, 0).toLocaleString()}
              </Text>
              <Text style={[styles.summaryItemLabel, { color: textSec }]}>Shared</Text>
            </View>
            <View style={[styles.summaryItemDivider, { backgroundColor: border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryItemNum, { color: textPrim }]}>
                {currentYearData.totalPieces.toLocaleString()}
              </Text>
              <Text style={[styles.summaryItemLabel, { color: textSec }]}>Total</Text>
            </View>
          </View>
        </View>
      )}

      {/* Per-plant breakdown */}
      {currentYearData && (
        <View style={styles.plantSection}>
          <Text style={[styles.sectionTitle, { color: textSec }]}>BY PLANT</Text>
          {currentYearData.plants.map(p => (
            <View key={p.plantName} style={[styles.plantCard, { backgroundColor: cardBg, borderColor: border }]}>
              <View style={styles.plantHeader}>
                <PlantAvatar name={p.plantName} size={36} />
                <Text style={[styles.plantName, { color: textPrim }]}>{p.plantName}</Text>
                <Text style={[styles.plantTotal, { color: G.hunter }]}>{p.total.toLocaleString()} pcs</Text>
              </View>
              <View style={[styles.barBg, { backgroundColor: isDark ? colors.bgElement : G.dew }]}>
                <View style={[styles.barFill, { width: `${(p.total / maxPieces) * 100}%` as any }]} />
              </View>
              <View style={styles.breakdownRow}>
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownNum, { color: G.hunter }]}>{p.myGardens.toLocaleString()}</Text>
                  <Text style={[styles.breakdownLabel, { color: textSec }]}>My Gardens</Text>
                </View>
                <View style={[styles.breakdownDivider, { backgroundColor: border }]} />
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownNum, { color: '#339af0' }]}>{p.shared.toLocaleString()}</Text>
                  <Text style={[styles.breakdownLabel, { color: textSec }]}>Shared</Text>
                </View>
                <View style={[styles.breakdownDivider, { backgroundColor: border }]} />
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownNum, { color: textPrim }]}>{p.total.toLocaleString()}</Text>
                  <Text style={[styles.breakdownLabel, { color: textSec }]}>Total</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 12, fontSize: 14 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  yearBar: { flexGrow: 0, marginTop: 20 },
  yearBarContent: { paddingHorizontal: 16, gap: 8 },
  yearChip: { borderRadius: R.full, borderWidth: 1.5, paddingHorizontal: 20, paddingVertical: 8 },
  yearChipActive: { backgroundColor: G.hunter, borderColor: G.hunter },
  yearChipText: { fontSize: 15, fontWeight: '600' },
  yearChipTextActive: { color: '#fff' },

  summaryCard: { margin: 16, borderRadius: R.xl, padding: 24, alignItems: 'center', ...Shadow.soft },
  summaryYear: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  summaryTotal: { fontSize: 52, fontWeight: '800', letterSpacing: -1, marginTop: 4 },
  summaryLabel: { fontSize: 13, marginTop: 2 },
  summaryDivider: { height: 1, width: '100%', marginVertical: 20 },
  summaryRow: { flexDirection: 'row', width: '100%' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryItemNum: { fontSize: 22, fontWeight: '800' },
  summaryItemLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  summaryItemDivider: { width: 1 },

  plantSection: { paddingHorizontal: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  plantCard: { borderRadius: R.lg, borderWidth: 1, padding: 14, marginBottom: 10, ...Shadow.soft },
  plantHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  plantName: { flex: 1, fontSize: 15, fontWeight: '700' },
  plantTotal: { fontSize: 14, fontWeight: '700' },
  barBg: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  barFill: { height: '100%', backgroundColor: G.hunter, borderRadius: 3 },
  breakdownRow: { flexDirection: 'row' },
  breakdownItem: { flex: 1, alignItems: 'center' },
  breakdownNum: { fontSize: 16, fontWeight: '800' },
  breakdownLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },
  breakdownDivider: { width: 1, marginVertical: 2 },
});
