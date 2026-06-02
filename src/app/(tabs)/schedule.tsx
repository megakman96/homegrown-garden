import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { pb } from '@/lib/pb';
import { useAuth } from '@/hooks/use-auth';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import type { Plant } from '@/lib/types';
import {
  fetchWeather, getBrowserLocation, calculateWateringAdvice, formatDateShort,
  searchCity, saveLocation, loadSavedLocation, clearSavedLocation,
  type WeatherData, type WateringAdvice, type GeoResult, type Location,
} from '@/lib/weather';

interface PlantWithAdvice {
  plant: Plant;
  type: 'water' | 'harvest';
  nextDate: Date;
  overdue: boolean;
  advice?: WateringAdvice;
}

export default function ScheduleScreen() {
  const { user } = useAuth();
  const { isDesktop } = useBreakpoint();
  const router = useRouter();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<PlantWithAdvice[]>([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<GeoResult[]>([]);
  const [citySearching, setCitySearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const loadPlants = useCallback(async () => {
    if (!user) return;
    const data = await pb.collection('plants').getFullList({
      filter: `user_id = "${user.id}" && health_status != "dead" && health_status != "harvested"`,
    });
    return data as any[];
  }, [user]);

  const loadWeather = useCallback(async (loc?: Location) => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const location = loc ?? await loadSavedLocation();
      if (!location) return null;
      const data = await fetchWeather(location);
      setWeather(data);
      return data;
    } catch (e: any) {
      setWeatherError(e.message ?? 'Location unavailable');
      return null;
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  async function searchCities(query: string) {
    setCityQuery(query);
    if (query.length < 2) { setCityResults([]); return; }
    setCitySearching(true);
    const results = await searchCity(query);
    setCityResults(results);
    setCitySearching(false);
  }

  async function selectCity(result: GeoResult) {
    const loc: Location = {
      latitude: result.latitude,
      longitude: result.longitude,
      name: result.admin1 ? `${result.name}, ${result.admin1}` : `${result.name}, ${result.country}`,
    };
    await saveLocation(loc);
    setShowLocationModal(false);
    setCityQuery('');
    setCityResults([]);
    const wxData = await loadWeather(loc);
    buildSchedule(plants, wxData);
  }

  async function useMyLocation() {
    setGpsError(null);
    setGpsLoading(true);
    try {
      const loc = await getBrowserLocation();
      await saveLocation(loc);
      setShowLocationModal(false);
      const wxData = await loadWeather(loc);
      buildSchedule(plants, wxData);
    } catch {
      setGpsError('Permission denied. Allow location access in your browser settings, or search for a city below.');
    } finally {
      setGpsLoading(false);
    }
  }

  async function changeLocation() {
    await clearSavedLocation();
    setWeather(null);
    setGpsError(null);
    setShowLocationModal(true);
  }

  const buildSchedule = useCallback((plantList: Plant[], wx: WeatherData | null) => {
    const now = new Date();
    const schedule: PlantWithAdvice[] = [];

    for (const plant of plantList) {
      // Watering
      if (plant.water_interval_days) {
        const advice = wx
          ? calculateWateringAdvice(plant.last_watered, plant.water_interval_days, wx)
          : null;
        const nextDate = advice?.nextWateringDate ?? (() => {
          if (!plant.last_watered) return now; // never watered → due now
          const d = new Date(plant.last_watered);
          d.setDate(d.getDate() + plant.water_interval_days!);
          return d;
        })();
        schedule.push({
          plant,
          type: 'water',
          nextDate,
          overdue: nextDate < now && !advice?.skipReason,
          advice: advice ?? undefined,
        });
      }
      // Harvest
      if (plant.expected_harvest_date) {
        const nextDate = new Date(plant.expected_harvest_date);
        schedule.push({ plant, type: 'harvest', nextDate, overdue: nextDate < now });
      }
    }

    schedule.sort((a, b) => {
      if (a.overdue && !b.overdue) return -1;
      if (!a.overdue && b.overdue) return 1;
      return a.nextDate.getTime() - b.nextDate.getTime();
    });
    setItems(schedule);
  }, []);

  useEffect(() => {
    if (!user) return;
    loadPlants().then((plantList) => {
      const pl = plantList ?? [];
      setPlants(pl);
      loadWeather().then((wxData) => {
        buildSchedule(pl, wxData);
        if (!wxData) setShowLocationModal(true);
      });
    });
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const [plantList, wxData] = await Promise.all([loadPlants(), loadWeather()]);
    const pl = plantList ?? [];
    setPlants(pl);
    buildSchedule(pl, wxData);
    setRefreshing(false);
  }, [loadPlants, loadWeather, buildSchedule]);

  async function markWatered(plant: Plant) {
    const now = new Date().toISOString();
    await pb.collection('plants').update(plant.id, { last_watered: now });
    setPlants((prev) => prev.map((p) => p.id === plant.id ? { ...p, last_watered: now } : p));
    buildSchedule(
      plants.map((p) => p.id === plant.id ? { ...p, last_watered: now } : p),
      weather
    );
  }

  const today = weather?.days.find((d) => !d.isFuture || d.date === new Date().toISOString().slice(0, 10));
  const overdue = items.filter((i) => i.overdue);
  const upcoming = items.filter((i) => !i.overdue);

  const locationModal = (
    <Modal visible={showLocationModal} transparent animationType="slide">
      <View style={styles.modalBackdrop}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>📍 Set Your Location</Text>
          <Text style={styles.modalSub}>Used for rain forecasts and watering advice</Text>
          <TouchableOpacity style={styles.gpsButton} onPress={useMyLocation} disabled={gpsLoading}>
            <Text style={styles.gpsButtonText}>
              {gpsLoading ? 'Locating...' : '📡 Use my current location'}
            </Text>
          </TouchableOpacity>
          {gpsError && <Text style={styles.gpsError}>{gpsError}</Text>}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or search</Text>
            <View style={styles.dividerLine} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Search city (e.g. London, Austin)"
            value={cityQuery}
            onChangeText={searchCities}
            autoFocus
          />
          {citySearching && <ActivityIndicator color="#2d6a4f" style={{ marginVertical: 8 }} />}
          {cityResults.map((r, i) => (
            <TouchableOpacity key={i} style={styles.cityRow} onPress={() => selectCity(r)}>
              <Text style={styles.cityName}>{r.name}</Text>
              <Text style={styles.cityRegion}>{r.admin1 ? `${r.admin1}, ` : ''}{r.country}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => { setShowLocationModal(false); setGpsError(null); }} style={styles.skipButton}>
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const scheduleList = (
    <>
      {overdue.length > 0 && (
        <Section title={`🔴 Overdue (${overdue.length})`}>
          {overdue.map((item, i) => (
            <ScheduleCard key={i} item={item} onWater={markWatered} onPress={() => router.push(`/plant/${item.plant.id}`)} />
          ))}
        </Section>
      )}
      {upcoming.length > 0 && (
        <Section title="📋 Upcoming">
          {upcoming.map((item, i) => (
            <ScheduleCard key={i} item={item} onWater={markWatered} onPress={() => router.push(`/plant/${item.plant.id}`)} />
          ))}
        </Section>
      )}
      {items.length === 0 && !weatherLoading && (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyText}>No scheduled tasks</Text>
          <Text style={styles.emptyHint}>Set watering intervals and harvest dates on your plants to see them here</Text>
        </View>
      )}
    </>
  );

  if (isDesktop) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.desktopContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {locationModal}
        <View style={styles.desktopPageHeader}>
          <Text style={styles.desktopPageTitle}>📅 Schedule</Text>
          <Text style={styles.desktopPageSub}>Watering & harvest timeline for your plants</Text>
        </View>
        <View style={styles.desktopBody}>
          <View style={styles.desktopWeatherCol}>
            <WeatherWidget
              weather={weather}
              loading={weatherLoading}
              error={weatherError}
              onSetLocation={() => setShowLocationModal(true)}
              onChangeLocation={changeLocation}
            />
          </View>
          <View style={styles.desktopScheduleCol}>
            {scheduleList}
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <WeatherWidget
        weather={weather}
        loading={weatherLoading}
        error={weatherError}
        onSetLocation={() => setShowLocationModal(true)}
        onChangeLocation={changeLocation}
      />
      {locationModal}
      {scheduleList}
    </ScrollView>
  );
}

// ─── WEATHER WIDGET ──────────────────────────────────────────────────────────

function WeatherWidget({ weather, loading, error, onSetLocation, onChangeLocation }: {
  weather: WeatherData | null;
  loading: boolean;
  error: string | null;
  onSetLocation: () => void;
  onChangeLocation: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.weatherCard}>
        <ActivityIndicator color="#2d6a4f" />
        <Text style={styles.weatherLoading}>Fetching weather…</Text>
      </View>
    );
  }

  if (!weather) {
    return (
      <TouchableOpacity style={styles.weatherCard} onPress={onSetLocation}>
        <Text style={styles.weatherErrorText}>
          {error ? `⚠️ ${error}` : '📍 Set location for weather-aware watering'}
        </Text>
        <Text style={styles.retryLink}>Tap to set location →</Text>
      </TouchableOpacity>
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const today = weather.days.find((d) => d.date === todayStr);
  const next7 = weather.days.filter((d) => d.isFuture).slice(0, 7);
  const rainDays = next7.filter((d) => d.isRainy);
  const totalRainMm = next7.reduce((s, d) => s + d.precipMm, 0);

  return (
    <View style={styles.weatherCard}>
      {/* Header row */}
      <View style={styles.weatherHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.weatherTitle}>
            {today ? `${Math.round(today.tempMaxC)}° / ${Math.round(today.tempMinC)}°C` : 'Weather'}
          </Text>
          <TouchableOpacity onPress={onChangeLocation}>
            <Text style={styles.weatherSub}>
              📍 {weather.locationName ?? `${weather.latitude.toFixed(2)}, ${weather.longitude.toFixed(2)}`}
              {'  '}
              <Text style={styles.changeLink}>change</Text>
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.weatherRight}>
          {today?.isRainy ? (
            <View style={styles.weatherBadgeRain}>
              <Text style={styles.weatherBadgeText}>🌧️ {today.precipMm.toFixed(0)}mm today</Text>
            </View>
          ) : (
            <View style={styles.weatherBadgeSun}>
              <Text style={styles.weatherBadgeText}>☀️ Dry today</Text>
            </View>
          )}
        </View>
      </View>

      {/* 7-day strip */}
      <View style={styles.forecastRow}>
        {next7.map((day) => (
          <View key={day.date} style={styles.forecastDay}>
            <Text style={styles.forecastDayLabel}>
              {new Date(day.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}
            </Text>
            <View style={[styles.forecastBar, day.isRainy ? styles.forecastBarRain : styles.forecastBarDry]}>
              <Text style={styles.forecastBarEmoji}>{day.isRainy ? '🌧' : '☀'}</Text>
            </View>
            <Text style={[styles.forecastMm, { opacity: day.precipMm > 0 ? 1 : 0 }]}>
              {day.precipMm.toFixed(0)}mm
            </Text>
          </View>
        ))}
      </View>

      {/* Summary row */}
      <View style={styles.weatherSummaryRow}>
        {rainDays.length > 0 ? (
          <Text style={styles.rainNote}>
            🌧️ {rainDays.length} rainy days ahead ({totalRainMm.toFixed(0)}mm) — schedule adjusted
          </Text>
        ) : (
          <Text style={styles.rainNote}>☀️ No rain in the next 7 days — water as scheduled</Text>
        )}
      </View>
    </View>
  );
}

// ─── SCHEDULE CARD ────────────────────────────────────────────────────────────

function ScheduleCard({ item, onWater, onPress }: {
  item: PlantWithAdvice;
  onWater: (p: Plant) => void;
  onPress: () => void;
}) {
  const isWater = item.type === 'water';
  const { advice } = item;

  return (
    <TouchableOpacity
      style={[styles.card, item.overdue && styles.cardOverdue, advice?.skipReason && styles.cardSkip]}
      onPress={onPress}
    >
      <View style={styles.cardLeft}>
        <Text style={styles.cardEmoji}>{isWater ? '💧' : '🧺'}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{item.plant.name}</Text>
        <Text style={styles.cardSub}>
          {isWater ? 'Water' : 'Harvest'} · {formatDateShort(item.nextDate)}
          {item.overdue && !advice?.skipReason && ' ⚠️'}
        </Text>

        {/* Weather advice */}
        {advice?.skipReason && (
          <View style={styles.skipBadge}>
            <Text style={styles.skipText}>🌧️ {advice.skipReason}</Text>
          </View>
        )}
        {advice && !advice.skipReason && advice.recentRainMm > 3 && (
          <Text style={styles.rainAdjust}>
            Adjusted for {advice.recentRainMm.toFixed(0)}mm recent rain
          </Text>
        )}
        {advice && advice.adjustedIntervalDays !== (item.plant.water_interval_days ?? 0) && !advice.skipReason && (
          <Text style={styles.rainAdjust}>
            Interval: {item.plant.water_interval_days}d → {advice.adjustedIntervalDays}d (weather)
          </Text>
        )}
      </View>

      {isWater && !advice?.skipReason && (
        <TouchableOpacity
          style={[styles.doneButton, item.overdue && styles.doneButtonOverdue]}
          onPress={(e) => { e.stopPropagation(); onWater(item.plant); }}
        >
          <Text style={styles.doneText}>Done ✓</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f7ee' },
  content: { padding: 16, paddingBottom: 40 },
  desktopContent: { maxWidth: 1200, width: '100%', alignSelf: 'center', paddingBottom: 48 },
  desktopPageHeader: { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 20 },
  desktopPageTitle: { fontSize: 28, fontWeight: '800', color: '#1b4332', letterSpacing: -0.5 },
  desktopPageSub: { fontSize: 14, color: '#52796f', marginTop: 4 },
  desktopBody: { flexDirection: 'row', gap: 24, paddingHorizontal: 32, alignItems: 'flex-start' },
  desktopWeatherCol: { width: 360, flexShrink: 0 },
  desktopScheduleCol: { flex: 1 },

  // Weather widget
  weatherCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  weatherHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  weatherTitle: { fontSize: 22, fontWeight: '700', color: '#1b4332' },
  weatherSub: { fontSize: 12, color: '#52796f', marginTop: 2 },
  changeLink: { color: '#2d6a4f', fontWeight: '600' },
  weatherRight: { alignItems: 'flex-end', marginLeft: 8 },
  weatherBadgeRain: { backgroundColor: '#e7f5ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  weatherBadgeSun: { backgroundColor: '#ebfbee', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  weatherBadgeText: { fontSize: 12, color: '#1b4332', fontWeight: '500' },
  forecastRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  forecastDay: { alignItems: 'center', flex: 1 },
  forecastDayLabel: { fontSize: 11, color: '#52796f', marginBottom: 4 },
  forecastBar: { width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  forecastBarRain: { backgroundColor: '#d0ebff' },
  forecastBarDry: { backgroundColor: '#fff9db' },
  forecastBarEmoji: { fontSize: 15 },
  forecastMm: { fontSize: 9, color: '#1971c2', marginTop: 2 },
  weatherSummaryRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f7ee' },
  rainNote: { fontSize: 12, color: '#52796f', textAlign: 'center' },
  weatherLoading: { textAlign: 'center', color: '#52796f', marginTop: 8 },
  weatherErrorText: { textAlign: 'center', color: '#52796f', fontWeight: '500' },
  retryLink: { textAlign: 'center', color: '#2d6a4f', marginTop: 4, fontSize: 13 },
  // Location modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderRadius: 20, padding: 24, margin: 16, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#2d6a4f', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#52796f', marginBottom: 16 },
  gpsButton: { backgroundColor: '#d8f3dc', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 8 },
  gpsButtonText: { color: '#2d6a4f', fontWeight: '600', fontSize: 15 },
  gpsError: { color: '#c0392b', fontSize: 13, textAlign: 'center', marginBottom: 12, lineHeight: 18 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e8f5e9' },
  dividerText: { fontSize: 12, color: '#52796f' },
  input: { backgroundColor: '#f0f7ee', borderRadius: 12, padding: 14, fontSize: 15, borderWidth: 1, borderColor: '#b7e4c7', marginBottom: 8 },
  cityRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f7ee' },
  cityName: { fontSize: 15, fontWeight: '600', color: '#1b4332' },
  cityRegion: { fontSize: 12, color: '#52796f', marginTop: 2 },
  skipButton: { marginTop: 16, alignItems: 'center' },
  skipButtonText: { color: '#52796f', fontSize: 14 },

  // Schedule
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#2d6a4f', marginBottom: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardOverdue: { borderLeftWidth: 4, borderLeftColor: '#ff6b6b' },
  cardSkip: { borderLeftWidth: 4, borderLeftColor: '#74c0fc', opacity: 0.85 },
  cardLeft: { marginRight: 12 },
  cardEmoji: { fontSize: 26 },
  cardBody: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#1b4332' },
  cardSub: { fontSize: 13, color: '#52796f', marginTop: 2 },
  skipBadge: { backgroundColor: '#e7f5ff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4, alignSelf: 'flex-start' },
  skipText: { fontSize: 11, color: '#1971c2', fontWeight: '500' },
  rainAdjust: { fontSize: 11, color: '#74c69d', marginTop: 3 },
  doneButton: { backgroundColor: '#d8f3dc', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  doneButtonOverdue: { backgroundColor: '#ffe3e3' },
  doneText: { color: '#2d6a4f', fontWeight: '600', fontSize: 12 },

  empty: { paddingTop: 64, alignItems: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#52796f', marginBottom: 8 },
  emptyHint: { fontSize: 13, color: '#74c69d', textAlign: 'center', paddingHorizontal: 32 },
});
