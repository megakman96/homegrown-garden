import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useAppTheme } from '@/contexts/theme-context';
import { G, R, Shadow } from '@/constants/theme';
import { getActivityLog, type ActivityEntry } from '@/lib/activity-log';
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
    if (user) setLog(getActivityLog(user.id));
  }, [user]));

  const groups = groupByDate(log);

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
        {groups.length === 0 ? empty : groups.map(({ label, items }) => (
          <View key={label} style={[styles.group, isDesktop && styles.groupDesktop]}>
            <Text style={[styles.groupLabel, { color: textSec }]}>{label}</Text>
            {items.map((entry) => (
              <View key={entry.id} style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                <View style={[styles.cardAccent, { backgroundColor: TYPE_COLOR[entry.type] }]} />
                <Text style={styles.cardEmoji}>{getPlantIcon(entry.plantName).emoji}</Text>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: textPrim }]}>{entry.plantName}</Text>
                  <Text style={[styles.cardType, { color: textSec }]}>
                    {TYPE_LABEL[entry.type]}
                    {entry.type === 'harvest' && entry.grams ? ` · ${entry.grams}g` : ''}
                    {entry.notes ? ` · ${entry.notes}` : ''}
                  </Text>
                </View>
                <Text style={[styles.cardTime, { color: textSec }]}>{formatTime(entry.date)}</Text>
              </View>
            ))}
          </View>
        ))}
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
  contentDesktop:{ maxWidth: 800, width: '100%', alignSelf: 'center', paddingHorizontal: 32 },
  group:         { marginBottom: 20 },
  groupDesktop:  {},
  groupLabel:    { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center', borderRadius: R.lg,
    marginBottom: 8, overflow: 'hidden', borderWidth: 1, ...Shadow.soft,
  },
  cardAccent:    { width: 4, alignSelf: 'stretch' },
  cardEmoji:     { fontSize: 24, marginHorizontal: 12 },
  cardBody:      { flex: 1, paddingVertical: 12 },
  cardTitle:     { fontSize: 15, fontWeight: '600' },
  cardType:      { fontSize: 13, marginTop: 2 },
  cardTime:      { fontSize: 12, marginRight: 12 },
  empty:         { paddingTop: 72, alignItems: 'center', paddingHorizontal: 32 },
  emptyEmoji:    { fontSize: 52, marginBottom: 14 },
  emptyTitle:    { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptyText:     { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
