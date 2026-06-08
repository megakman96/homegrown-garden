import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useAppTheme } from '@/contexts/theme-context';
import { G, R, Shadow } from '@/constants/theme';
import { getActivityLogAsync, type ActivityEntry } from '@/lib/activity-log';
import { getPlantIcon } from '@/lib/plant-icons';

const TYPE_LABEL: Record<ActivityEntry['type'], string> = {
  water: '💧 Watered',
  harvest: '🧺 Harvested',
};

const TYPE_COLOR: Record<ActivityEntry['type'], string> = {
  water: '#74c0fc',
  harvest: '#a9e34b',
};

function formatDateGroup(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function groupByDate(entries: ActivityEntry[]): { label: string; items: ActivityEntry[] }[] {
  const map = new Map<string, ActivityEntry[]>();
  for (const entry of entries) {
    const label = formatDateGroup(entry.date);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(entry);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const { isDark, colors } = useAppTheme();
  const { isDesktop } = useBreakpoint();
  const bg      = isDark ? colors.bg     : G.foam;
  const cardBg  = isDark ? colors.bgCard : G.cloud;
  const textPrim= isDark ? colors.text   : G.forest;
  const textSec = isDark ? colors.textSec: G.stone;
  const border  = isDark ? colors.border : G.mist;

  const [log, setLog] = useState<ActivityEntry[]>([]);

  useFocusEffect(useCallback(() => {
    if (user) getActivityLogAsync(user.id).then(setLog);
  }, [user]));

  const groups = groupByDate(log);

  // Season totals: tally harvest pieces for the current calendar year
  const thisYear = new Date().getFullYear();
  const seasonStats = useMemo(() => {
    const harvestsThisYear = log.filter(
      e => e.type === 'harvest' && new Date(e.date).getFullYear() === thisYear,
    );
    const totalPieces = harvestsThisYear.reduce((sum, e) => sum + (e.grams ?? 1), 0);
    // Running cumulative total per entry (oldest → newest)
    let running = 0;
    const runningMap = new Map<string, number>();
    const sorted = [...harvestsThisYear].reverse();
    for (const e of sorted) { running += e.grams ?? 1; runningMap.set(e.id, running); }
    return { totalPieces, runningMap, count: harvestsThisYear.length };
  }, [log, thisYear]);

  if (!user) return null;

  const empty = (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>📋</Text>
      <Text style={[styles.emptyTitle, { color: textPrim }]}>No history yet</Text>
      <Text style={[styles.emptyText, { color: textSec }]}>
        Water plants from the Schedule tab or harvest from a plant page — events will appear here.
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {isDesktop && (
        <View style={[styles.header, { borderBottomColor: border }]}>
          <Text style={[styles.pageTitle, { color: textPrim }]}>📋 History</Text>
          <Text style={[styles.pageSub, { color: textSec }]}>
            {log.length} event{log.length !== 1 ? 's' : ''} logged
          </Text>
        </View>
      )}
      <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]} showsVerticalScrollIndicator={false}>

        {/* Season summary card */}
        {seasonStats.totalPieces > 0 && (
          <View style={[styles.seasonCard, { backgroundColor: cardBg, borderColor: border }, isDesktop && styles.seasonCardDesktop]}>
            <Text style={styles.seasonEmoji}>🧺</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.seasonTitle, { color: textPrim }]}>{thisYear} Season Total</Text>
              <Text style={[styles.seasonSub, { color: textSec }]}>
                {seasonStats.totalPieces} piece{seasonStats.totalPieces !== 1 ? 's' : ''} harvested across {seasonStats.count} log{seasonStats.count !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        )}

        {groups.length === 0 ? empty : groups.map(({ label, items }) => {
          // Day harvest total
          const dayHarvest = items.filter(e => e.type === 'harvest').reduce((s, e) => s + (e.grams ?? 1), 0);
          return (
            <View key={label} style={[styles.group, isDesktop && styles.groupDesktop]}>
              <View style={styles.groupLabelRow}>
                <Text style={[styles.groupLabel, { color: textSec }]}>{label}</Text>
                {dayHarvest > 0 && (
                  <Text style={[styles.groupHarvestBadge, { color: textSec }]}>
                    🧺 {dayHarvest} piece{dayHarvest !== 1 ? 's' : ''}
                  </Text>
                )}
              </View>
              {items.map((entry) => {
                const runningTotal = seasonStats.runningMap.get(entry.id);
                return (
                  <View key={entry.id} style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                    <View style={[styles.cardAccent, { backgroundColor: TYPE_COLOR[entry.type] }]} />
                    <Text style={styles.cardEmoji}>{getPlantIcon(entry.plantName).emoji}</Text>
                    <View style={styles.cardBody}>
                      <Text style={[styles.cardTitle, { color: textPrim }]}>{entry.plantName}</Text>
                      <Text style={[styles.cardType, { color: textSec }]}>
                        {TYPE_LABEL[entry.type]}
                        {entry.type === 'harvest' && entry.grams != null
                          ? ` · ${entry.grams} piece${entry.grams !== 1 ? 's' : ''}`
                          : ''}
                        {entry.notes && !entry.notes.match(/^\d+ pieces?/) ? ` · ${entry.notes}` : ''}
                      </Text>
                      {entry.type === 'harvest' && runningTotal != null && runningTotal > (entry.grams ?? 1) && (
                        <Text style={[styles.cardRunning, { color: textSec }]}>
                          Season running total: {runningTotal} pieces
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.cardTime, { color: textSec }]}>{formatTime(entry.date)}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  header:        { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 20, borderBottomWidth: 1 },
  pageTitle:     { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  pageSub:       { fontSize: 13, marginTop: 3 },
  content:       { padding: 16, paddingBottom: 40 },
  contentDesktop:{ maxWidth: 1200, width: '100%', alignSelf: 'center', paddingHorizontal: 32, flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' },
  group:         { marginBottom: 20 },
  groupDesktop:  { width: '47%', minWidth: 320, flexGrow: 1 },
  groupLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  groupLabel:    { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  groupHarvestBadge: { fontSize: 11, fontWeight: '600' },
  card: {
    flexDirection: 'row', alignItems: 'center', borderRadius: R.lg,
    marginBottom: 8, overflow: 'hidden', borderWidth: 1, ...Shadow.soft,
  },
  cardAccent:    { width: 4, alignSelf: 'stretch' },
  cardEmoji:     { fontSize: 24, marginHorizontal: 12 },
  cardBody:      { flex: 1, paddingVertical: 12 },
  cardTitle:     { fontSize: 15, fontWeight: '600' },
  cardType:      { fontSize: 13, marginTop: 2 },
  cardRunning:   { fontSize: 11, marginTop: 3, fontStyle: 'italic' },
  cardTime:      { fontSize: 12, marginRight: 12 },
  empty:         { paddingTop: 72, alignItems: 'center', paddingHorizontal: 32 },
  emptyEmoji:    { fontSize: 52, marginBottom: 14 },
  emptyTitle:    { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptyText:     { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  seasonCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: R.lg, borderWidth: 1, padding: 14,
    marginBottom: 20, ...Shadow.soft,
  },
  seasonCardDesktop: { width: '100%' },
  seasonEmoji:   { fontSize: 32 },
  seasonTitle:   { fontSize: 15, fontWeight: '700' },
  seasonSub:     { fontSize: 13, marginTop: 2 },
});
