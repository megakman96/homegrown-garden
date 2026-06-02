import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { pb } from '@/lib/pb';
import { useAuth } from '@/hooks/use-auth';
import { PressableScale } from '@/components/ui/PressableScale';
import { FadeInView } from '@/components/ui/FadeInView';
import { G, Shadow, R } from '@/constants/theme';
import type { Plant } from '@/lib/types';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    pb.collection('plants')
      .getFullList({ filter: `user_id = "${user.id}"` })
      .then((data) => {
        setPlants(data as any);
        setLoading(false);
      });
  }, [user]);

  const needsWater = plants.filter((p) => {
    if (!p.last_watered || !p.water_interval_days) return false;
    const due = new Date(p.last_watered);
    due.setDate(due.getDate() + p.water_interval_days);
    return due <= new Date();
  });

  const upcomingHarvests = plants
    .filter((p) => p.expected_harvest_date && p.health_status !== 'harvested')
    .sort((a, b) => new Date(a.expected_harvest_date!).getTime() - new Date(b.expected_harvest_date!).getTime())
    .slice(0, 3);

  const firstName = user?.email?.split('@')[0] ?? 'Gardener';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero banner */}
      <FadeInView delay={0} from="fade">
        <LinearGradient
          colors={[G.forest, G.hunter]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroEmoji}>🌤️</Text>
          <Text style={styles.heroGreeting}>{greeting()}, {firstName}!</Text>
          <Text style={styles.heroSub}>Here's what your garden needs today</Text>
          <View style={styles.heroLeaves}>
            <Text style={styles.heroLeaf}>🌿</Text>
            <Text style={styles.heroLeaf}>🍃</Text>
          </View>
        </LinearGradient>
      </FadeInView>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <FadeInView delay={80} style={styles.statFlex}>
          <StatCard label="Plants" value={plants.length} emoji="🌱" color={G.sage} delay={80} />
        </FadeInView>
        <FadeInView delay={140} style={styles.statFlex}>
          <StatCard label="Thirsty" value={needsWater.length} emoji="💧" color={needsWater.length > 0 ? G.bloom : G.sage} delay={140} />
        </FadeInView>
        <FadeInView delay={200} style={styles.statFlex}>
          <StatCard
            label="Harvested"
            value={plants.filter((p) => p.health_status === 'harvested').length}
            emoji="🧺"
            color={G.sage}
            delay={200}
          />
        </FadeInView>
      </View>

      {needsWater.length > 0 && (
        <FadeInView delay={260} style={styles.section}>
          <Text style={styles.sectionTitle}>💧 Needs Water</Text>
          {needsWater.map((p, i) => (
            <FadeInView key={p.id} delay={280 + i * 50} from="bottom">
              <PressableScale onPress={() => router.push(`/plant/${p.id}`)} style={styles.alertCard}>
                <View style={[styles.alertAccent, { backgroundColor: G.sage }]} />
                <Text style={styles.alertName}>{p.name}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Water now</Text>
                </View>
              </PressableScale>
            </FadeInView>
          ))}
        </FadeInView>
      )}

      {upcomingHarvests.length > 0 && (
        <FadeInView delay={340} style={styles.section}>
          <Text style={styles.sectionTitle}>🧺 Upcoming Harvests</Text>
          {upcomingHarvests.map((p, i) => (
            <FadeInView key={p.id} delay={360 + i * 50} from="bottom">
              <PressableScale onPress={() => router.push(`/plant/${p.id}`)} style={styles.alertCard}>
                <View style={[styles.alertAccent, { backgroundColor: G.sun }]} />
                <Text style={styles.alertName}>{p.name}</Text>
                <Text style={styles.alertDate}>
                  {new Date(p.expected_harvest_date!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              </PressableScale>
            </FadeInView>
          ))}
        </FadeInView>
      )}

      {!loading && plants.length === 0 && (
        <FadeInView delay={300} style={styles.empty} from="scale">
          <Text style={styles.emptyEmoji}>🌾</Text>
          <Text style={styles.emptyTitle}>Your garden awaits</Text>
          <Text style={styles.emptyText}>Add your first plant and start growing something amazing.</Text>
          <PressableScale onPress={() => router.push('/(tabs)/plants')} style={styles.emptyBtn}>
            <LinearGradient
              colors={[G.sage, G.hunter]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.emptyBtnGradient}
            >
              <Text style={styles.emptyBtnText}>🌱  Add your first plant</Text>
            </LinearGradient>
          </PressableScale>
        </FadeInView>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function StatCard({ label, value, emoji, color, delay }: { label: string; value: number; emoji: string; color: string; delay: number }) {
  return (
    <View style={styles.statCard}>
      <LinearGradient
        colors={[color + '22', color + '11']}
        style={styles.statGradient}
      >
        <Text style={styles.statEmoji}>{emoji}</Text>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: G.foam },
  content:      { paddingBottom: 40 },
  hero: {
    margin: 16,
    marginTop: Platform.OS === 'ios' ? 8 : 16,
    borderRadius: R.xl,
    padding: 24,
    paddingBottom: 28,
    overflow: 'hidden',
    ...Shadow.card,
  },
  heroEmoji:    { fontSize: 36, marginBottom: 8 },
  heroGreeting: { fontSize: 24, fontWeight: '800', color: G.cloud, letterSpacing: -0.3 },
  heroSub:      { fontSize: 14, color: G.mist, marginTop: 4 },
  heroLeaves:   { position: 'absolute', right: 20, bottom: 16, flexDirection: 'row', gap: 4 },
  heroLeaf:     { fontSize: 28, opacity: 0.4 },
  statsRow:     { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  statFlex:     { flex: 1 },
  statCard:     { borderRadius: R.lg, overflow: 'hidden', ...Shadow.soft },
  statGradient: { padding: 16, alignItems: 'center', borderRadius: R.lg },
  statEmoji:    { fontSize: 22, marginBottom: 4 },
  statValue:    { fontSize: 26, fontWeight: '800' },
  statLabel:    { fontSize: 11, color: G.stone, marginTop: 2, fontWeight: '600' },
  section:      { paddingHorizontal: 16, marginTop: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: G.forest, marginBottom: 10, letterSpacing: 0.1 },
  alertCard: {
    backgroundColor: G.cloud,
    borderRadius: R.md,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    ...Shadow.soft,
  },
  alertAccent:  { width: 4, alignSelf: 'stretch', marginRight: 14 },
  alertName:    { flex: 1, fontSize: 15, color: G.ink, fontWeight: '600', paddingVertical: 16 },
  badge:        { backgroundColor: G.dew, borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 5, marginRight: 14 },
  badgeText:    { fontSize: 12, color: G.hunter, fontWeight: '700' },
  alertDate:    { fontSize: 13, color: G.stone, marginRight: 14, fontWeight: '600' },
  empty:        { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyEmoji:   { fontSize: 64, marginBottom: 16 },
  emptyTitle:   { fontSize: 22, fontWeight: '800', color: G.forest, marginBottom: 8 },
  emptyText:    { fontSize: 15, color: G.stone, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  emptyBtn:     { borderRadius: R.lg, overflow: 'hidden', ...Shadow.card },
  emptyBtnGradient: { paddingVertical: 15, paddingHorizontal: 28 },
  emptyBtnText: { color: G.cloud, fontWeight: '700', fontSize: 16 },
});
