import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { offlineList } from '@/lib/offline-db';
import { useAuth } from '@/hooks/use-auth';
import { getPlantIcon } from '@/lib/plant-icons';
import ProBanner from '@/components/ui/ProBanner';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { PressableScale } from '@/components/ui/PressableScale';
import { FadeInView } from '@/components/ui/FadeInView';
import { G, Shadow, R } from '@/constants/theme';
import { useAppTheme, isBirthdayToday, loadBirthday, formatTemp } from '@/contexts/theme-context';
import { fetchWeather, loadSavedLocation, type WeatherData } from '@/lib/weather';
import GardenDailyCard from '@/components/ui/GardenDailyCard';
import { subscribe } from '@/lib/events';
import type { Plant } from '@/lib/types';

function greeting() {
  const h = new Date().getHours();
  if (h < 5)  return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const BIRTHDAY_MSGS = [
  '🎂 Happy Birthday! Wishing you a garden full of joy today! 🌸',
  '🎉 It\'s your special day! Hope it\'s as bright as a sunny garden! 🌻',
  '🎈 Happy Birthday! May your harvests be as sweet as this day! 🍓',
];

export default function DashboardScreen() {
  const { user } = useAuth();
  const { isDark, colors, tempUnit } = useAppTheme();
  const router = useRouter();
  const { isDesktop } = useBreakpoint();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const firstName = user?.name?.split(' ')?.[0] || 'Gardener';
  const birthday = user ? loadBirthday(user.id) : null;
  const isToday = isBirthdayToday(birthday);
  const bdayMsg = isToday ? BIRTHDAY_MSGS[new Date().getDate() % BIRTHDAY_MSGS.length] : null;

  const loadPlants = useCallback(async () => {
    if (!user) return;
    try {
      const data = await offlineList('plants', user.id, `user_id = "${user.id}"`);
      setPlants(data as any);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { loadPlants(); }, [loadPlants]));

  useEffect(() => subscribe('plants:changed', () => loadPlants()), [loadPlants]);

  useEffect(() => {
    setWeatherLoading(true);
    loadSavedLocation()
      .then(loc => loc ? fetchWeather(loc) : null)
      .then(wx => { setWeather(wx); setWeatherLoading(false); })
      .catch(() => setWeatherLoading(false));
  }, []);

  const now = new Date();

  const needsWater = plants.filter(p => {
    if (!p.last_watered || !p.water_interval_days) return false;
    const due = new Date(p.last_watered);
    due.setDate(due.getDate() + p.water_interval_days);
    return due <= now;
  });

  const upcomingHarvests = plants
    .filter(p => p.expected_harvest_date && p.health_status !== 'harvested')
    .map(p => ({ ...p, harvestDate: new Date(p.expected_harvest_date!) }))
    .filter(p => {
      const diff = (p.harvestDate.getTime() - now.getTime()) / 86_400_000;
      return diff >= -1 && diff <= 7;
    })
    .sort((a, b) => a.harvestDate.getTime() - b.harvestDate.getTime())
    .slice(0, 4);

  const bg = isDark ? colors.bg : G.foam;
  const cardBg = isDark ? colors.bgCard : G.cloud;
  const textPrimary = isDark ? colors.text : G.forest;
  const textSecondary = isDark ? colors.textSec : G.stone;
  const borderColor = isDark ? colors.border : G.mist;

  const heroSection = (
    <FadeInView delay={0} from="fade">
      <LinearGradient
        colors={isDark ? ['#1e3828', '#162a1e'] : [G.forest, G.hunter]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.hero, isDesktop && styles.heroDesktop]}
      >
        {bdayMsg ? (
          <>
            <Text style={styles.heroEmoji}>🎂</Text>
            <Text style={styles.heroGreeting}>Happy Birthday, {firstName}!</Text>
            <Text style={styles.heroBday}>{bdayMsg.replace(/^🎂 /, '')}</Text>
          </>
        ) : (
          <>
            <Text style={styles.heroEmoji}>🌱</Text>
            <Text style={styles.heroGreeting}>{greeting()}, {firstName}!</Text>
            <Text style={styles.heroSub}>
              {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
          </>
        )}
        <View style={styles.heroLeaves}>
          <Text style={styles.heroLeaf}>🌿</Text>
          <Text style={styles.heroLeaf}>🍃</Text>
        </View>
      </LinearGradient>
    </FadeInView>
  );

  // Daily nature card (animated scene + sunrise/sunset + fun fact + rain forecast)
  const weatherCard = (
    <FadeInView delay={60} from="bottom" style={isDesktop ? { marginHorizontal: 0 } : undefined}>
      <GardenDailyCard
        weather={weatherLoading ? null : weather}
        tempUnit={tempUnit}
        onPressWeather={() => router.push('/(tabs)/schedule')}
      />
    </FadeInView>
  );

  // Stats row
  const statsRow = (
    <View style={[styles.statsRow, isDesktop && styles.statsRowDesktop]}>
      <FadeInView style={styles.statWrap}>
        <PressableScale
          style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}
          onPress={() => router.push('/(tabs)/plants')}
        >
          <Text style={styles.statEmoji}>🌱</Text>
          <Text style={[styles.statValue, { color: G.sage }]}>{plants.length}</Text>
          <Text style={[styles.statLabel, { color: textSecondary }]}>Plants</Text>
        </PressableScale>
      </FadeInView>
      <FadeInView style={styles.statWrap}>
        <PressableScale
          style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}
          onPress={() => router.push('/(tabs)/schedule')}
        >
          <Text style={styles.statEmoji}>💧</Text>
          <Text style={[styles.statValue, { color: needsWater.length > 0 ? G.bloom : G.sage }]}>{needsWater.length}</Text>
          <Text style={[styles.statLabel, { color: textSecondary }]}>Thirsty</Text>
        </PressableScale>
      </FadeInView>
      <FadeInView style={styles.statWrap}>
        <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={styles.statEmoji}>🌿</Text>
          <Text style={[styles.statValue, { color: G.sage }]}>{plants.filter(p => p.health_status === 'healthy').length}</Text>
          <Text style={[styles.statLabel, { color: textSecondary }]}>Healthy</Text>
        </View>
      </FadeInView>
    </View>
  );

  // Needs water section
  const waterSection = needsWater.length > 0 && (
    <FadeInView delay={120} from="bottom" style={[styles.section, isDesktop && styles.sectionDesktop]}>
      <Text style={[styles.sectionTitle, { color: textPrimary }]}>💧 Needs Water Now</Text>
      {needsWater.slice(0, 5).map(p => (
        <PressableScale key={p.id} style={[styles.taskCard, { backgroundColor: cardBg, borderColor }]}
          onPress={() => router.push(`/plant/${p.id}`)}>
          <View style={[styles.taskAccent, { backgroundColor: '#74c0fc' }]} />
          <Text style={[styles.taskName, { color: textPrimary }]}>{p.name}</Text>
          <View style={[styles.taskBadge, { backgroundColor: '#e7f5ff' }]}>
            <Text style={styles.taskBadgeText}>Water now</Text>
          </View>
        </PressableScale>
      ))}
      {needsWater.length > 5 && (
        <Text style={[styles.moreTasks, { color: textSecondary }]}>+{needsWater.length - 5} more</Text>
      )}
    </FadeInView>
  );

  // Upcoming harvests
  const harvestSection = upcomingHarvests.length > 0 && (
    <FadeInView delay={180} from="bottom" style={[styles.section, isDesktop && styles.sectionDesktop]}>
      <Text style={[styles.sectionTitle, { color: textPrimary }]}>🧺 Upcoming Harvests</Text>
      {upcomingHarvests.map(p => {
        const diff = Math.ceil((p.harvestDate.getTime() - now.getTime()) / 86_400_000);
        const label = diff <= 0 ? 'Ready now!' : diff === 1 ? 'Tomorrow' :
          p.harvestDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return (
          <PressableScale key={p.id} style={[styles.taskCard, { backgroundColor: cardBg, borderColor }]}
            onPress={() => router.push(`/plant/${p.id}`)}>
            <View style={[styles.taskAccent, { backgroundColor: G.sun }]} />
            <Text style={[styles.taskName, { color: textPrimary }]}>{p.name}</Text>
            <View style={[styles.taskBadge, { backgroundColor: diff <= 0 ? '#d8f3dc' : '#fff9db' }]}>
              <Text style={[styles.taskBadgeText, { color: diff <= 0 ? G.hunter : '#7d5a00' }]}>{label}</Text>
            </View>
          </PressableScale>
        );
      })}
    </FadeInView>
  );

  // Harvest summary — group harvested plants by name
  const harvestedPlants = plants.filter(p => p.health_status === 'harvested');
  const harvestGroups = harvestedPlants.reduce<Record<string, { count: number; totalGrams: number; emoji: string }>>((acc, p) => {
    const key = p.name;
    if (!acc[key]) acc[key] = { count: 0, totalGrams: 0, emoji: getPlantIcon(p.name).emoji };
    acc[key].count++;
    acc[key].totalGrams += p.total_yield_grams ?? 0;
    return acc;
  }, {});
  const harvestSummaryItems = Object.entries(harvestGroups).sort((a, b) => b[1].count - a[1].count);

  const harvestSummary = harvestSummaryItems.length > 0 && (
    <FadeInView delay={220} from="bottom" style={[styles.section, isDesktop && styles.sectionDesktop]}>
      <Text style={[styles.sectionTitle, { color: textPrimary }]}>🧺 Total Harvest</Text>
      <View style={styles.harvestGrid}>
        {harvestSummaryItems.map(([name, { count, totalGrams, emoji }]) => (
          <View key={name} style={[styles.harvestChip, { backgroundColor: cardBg, borderColor }]}>
            <Text style={styles.harvestChipEmoji}>{emoji}</Text>
            <View>
              <Text style={[styles.harvestChipName, { color: textPrimary }]} numberOfLines={1}>{name}</Text>
              <Text style={[styles.harvestChipSub, { color: textSecondary }]}>
                {count === 1 ? '1 plant' : `${count} plants`}
                {totalGrams > 0 ? ` · ${totalGrams >= 1000 ? `${(totalGrams / 1000).toFixed(1)}kg` : `${totalGrams}g`}` : ''}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </FadeInView>
  );

  // Empty state
  const emptyState = !loading && plants.length === 0 && (
    <FadeInView delay={120} from="scale" style={styles.empty}>
      <Text style={styles.emptyEmoji}>🌾</Text>
      <Text style={[styles.emptyTitle, { color: textPrimary }]}>Your garden awaits</Text>
      <Text style={[styles.emptyText, { color: textSecondary }]}>Add your first plant and start growing.</Text>
      <PressableScale onPress={() => router.push('/(tabs)/plants')} style={styles.emptyBtn}>
        <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyBtnGradient}>
          <Text style={styles.emptyBtnText}>🌱  Add your first plant</Text>
        </LinearGradient>
      </PressableScale>
    </FadeInView>
  );

  if (isDesktop) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: bg }]} contentContainerStyle={styles.desktopContent} showsVerticalScrollIndicator={false}>
        <View style={styles.desktopPadding}>
          {heroSection}
          {weatherCard}
          {statsRow}
          <View style={styles.desktopColumns}>
            <View style={styles.desktopCol}>
              {waterSection}
              {emptyState}
            </View>
            <View style={styles.desktopCol}>
              {harvestSection}
              {harvestSummary}
            </View>
          </View>
          <ProBanner />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg }]} contentContainerStyle={styles.mobileContent} showsVerticalScrollIndicator={false}>
      {heroSection}
      <View style={{ height: 16 }} />
      {weatherCard}
      {statsRow}
      {waterSection}
      {harvestSection}
      {harvestSummary}
      {emptyState}
      <ProBanner />
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  mobileContent:   { paddingBottom: 40 },
  desktopContent:  { paddingBottom: 48 },
  desktopPadding:  { maxWidth: 1200, width: '100%', alignSelf: 'center', paddingHorizontal: 24 },
  desktopColumns:  { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  desktopCol:      { flex: 1 },

  // Hero
  hero: {
    margin: 16,
    borderRadius: R.xl,
    padding: 24,
    paddingBottom: 28,
    overflow: 'hidden',
    ...Shadow.card,
  },
  heroDesktop: { margin: 0, marginTop: 24, marginBottom: 16 },
  heroEmoji:   { fontSize: 36, marginBottom: 8 },
  heroGreeting:{ fontSize: 24, fontWeight: '800', color: G.cloud, letterSpacing: -0.3 },
  heroSub:     { fontSize: 14, color: G.mist, marginTop: 4 },
  heroBday:    { fontSize: 13, color: G.mint, marginTop: 6, lineHeight: 18 },
  heroLeaves:  { position: 'absolute', right: 20, bottom: 16, flexDirection: 'row', gap: 4 },
  heroLeaf:    { fontSize: 28, opacity: 0.3 },

  // Stats
  statsRow:       { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  statsRowDesktop:{ paddingHorizontal: 0, marginBottom: 16 },
  statWrap:       { flex: 1 },
  statCard:       { borderRadius: R.lg, padding: 14, alignItems: 'center', borderWidth: 1, ...Shadow.soft },
  statEmoji:      { fontSize: 20, marginBottom: 4 },
  statValue:      { fontSize: 24, fontWeight: '800' },
  statLabel:      { fontSize: 11, marginTop: 2, fontWeight: '600' },

  // Task sections
  section:        { paddingHorizontal: 16, marginBottom: 16 },
  sectionDesktop: { paddingHorizontal: 0 },
  sectionTitle:   { fontSize: 15, fontWeight: '700', marginBottom: 10, letterSpacing: 0.1 },
  taskCard: {
    borderRadius: R.md,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    ...Shadow.soft,
  },
  taskAccent:     { width: 4, alignSelf: 'stretch', marginRight: 14 },
  taskName:       { flex: 1, fontSize: 15, fontWeight: '600', paddingVertical: 14 },
  taskBadge:      { borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 5, marginRight: 12 },
  taskBadgeText:  { fontSize: 12, color: G.hunter, fontWeight: '700' },
  moreTasks:      { fontSize: 13, textAlign: 'center', marginTop: 4 },

  // Harvest summary
  harvestGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  harvestChip:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 10, minWidth: '47%', flex: 1 },
  harvestChipEmoji: { fontSize: 22 },
  harvestChipName:  { fontSize: 13, fontWeight: '700', maxWidth: 100 },
  harvestChipSub:   { fontSize: 11, marginTop: 1 },

  // Empty
  empty:          { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyEmoji:     { fontSize: 56, marginBottom: 14 },
  emptyTitle:     { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptyText:      { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  emptyBtn:       { borderRadius: R.lg, overflow: 'hidden', ...Shadow.card },
  emptyBtnGradient: { paddingVertical: 14, paddingHorizontal: 28 },
  emptyBtnText:   { color: G.cloud, fontWeight: '700', fontSize: 15 },
});
