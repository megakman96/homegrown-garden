import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { pb } from '@/lib/pb';
import { useAuth } from '@/hooks/use-auth';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useAppTheme, formatTemp, type TempUnit } from '@/contexts/theme-context';
import type { Plant, Garden } from '@/lib/types';
import {
  fetchWeather, getBrowserLocation, calculateWateringAdvice, formatDateShort,
  searchCity, saveLocation, saveGardenLocation, loadGardenLocation,
  type WeatherData, type WateringAdvice, type GeoResult, type Location,
} from '@/lib/weather';
import { addActivityEntryAsync } from '@/lib/activity-log';

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
  const { tempUnit, isDark, colors } = useAppTheme();
  const bg      = isDark ? colors.bg        : '#f0f7ee';
  const cardBg  = isDark ? colors.bgCard    : '#fff';
  const textPrim= isDark ? colors.text      : '#1b4332';
  const textSec = isDark ? colors.textSec   : '#52796f';
  const border  = isDark ? colors.border    : '#e8f5e9';
  const inputBg = isDark ? colors.bgElement : '#f0f7ee';
  const router = useRouter();

  const [plants, setPlants] = useState<Plant[]>([]);
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [gardenWeather, setGardenWeather] = useState<Record<string, WeatherData | null>>({});
  const [gardenLocations, setGardenLocations] = useState<Record<string, Location | null>>({});
  const [gardenWeatherLoading, setGardenWeatherLoading] = useState<Record<string, boolean>>({});
  const [items, setItems] = useState<PlantWithAdvice[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Location modal — tracks which garden we're setting location for
  const [locationGardenId, setLocationGardenId] = useState<string | null>(null);
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<GeoResult[]>([]);
  const [citySearching, setCitySearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadGardenWeather = useCallback(async (garden: Garden, loc: Location): Promise<WeatherData | null> => {
    setGardenWeatherLoading(prev => ({ ...prev, [garden.id]: true }));
    try {
      const data = await fetchWeather(loc);
      setGardenWeather(prev => ({ ...prev, [garden.id]: data }));
      return data;
    } catch {
      setGardenWeather(prev => ({ ...prev, [garden.id]: null }));
      return null;
    } finally {
      setGardenWeatherLoading(prev => ({ ...prev, [garden.id]: false }));
    }
  }, []);

  const loadAll = useCallback(async () => {
    if (!user) return;

    const [plantsData, gardensData] = await Promise.all([
      pb.collection('plants').getFullList({
        filter: `user_id = "${user.id}" && health_status != "dead" && health_status != "harvested"`,
      }),
      pb.collection('gardens').getFullList({ filter: `user_id = "${user.id}"` }),
    ]);

    const pl = plantsData as any[] as Plant[];
    const gl = gardensData as any[] as Garden[];
    setPlants(pl);
    setGardens(gl);

    // Load location + weather for each garden
    const locs: Record<string, Location | null> = {};
    await Promise.all(gl.map(async (g) => {
      const loc = await loadGardenLocation(g as any);
      locs[g.id] = loc;
      if (loc) loadGardenWeather(g, loc);
    }));
    setGardenLocations(locs);

    // Build schedule using whatever weather is already cached (may be empty on first load;
    // weather updates trigger a re-build via gardenWeather state change)
    buildSchedule(pl, {});
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [user]);

  // Re-build schedule whenever weather map changes
  useEffect(() => {
    if (plants.length > 0) buildSchedule(plants, gardenWeather);
  }, [gardenWeather]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  // ── Schedule builder ─────────────────────────────────────────────────────

  const buildSchedule = useCallback((
    plantList: Plant[],
    wxMap: Record<string, WeatherData | null>,
  ) => {
    const now = new Date();
    const schedule: PlantWithAdvice[] = [];

    for (const plant of plantList) {
      const wx = wxMap[plant.garden_id] ?? null;

      if (plant.water_interval_days) {
        const advice = wx
          ? calculateWateringAdvice(plant.last_watered, plant.water_interval_days, wx)
          : null;
        const nextDate = advice?.nextWateringDate ?? (() => {
          if (!plant.last_watered) return now;
          const d = new Date(plant.last_watered);
          d.setDate(d.getDate() + plant.water_interval_days!);
          return d;
        })();
        schedule.push({
          plant, type: 'water', nextDate,
          overdue: nextDate < now && !advice?.skipReason,
          advice: advice ?? undefined,
        });
      }
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

  async function markWatered(plant: Plant) {
    const now = new Date().toISOString();
    await pb.collection('plants').update(plant.id, { last_watered: now });
    if (user) {
      addActivityEntryAsync(user.id, { type: 'water', plantId: plant.id, plantName: plant.name, gardenId: plant.garden_id });
    }
    const updated = plants.map(p => p.id === plant.id ? { ...p, last_watered: now } : p);
    setPlants(updated);
    buildSchedule(updated, gardenWeather);
  }

  // ── Location modal ────────────────────────────────────────────────────────

  function openLocationModal(gardenId: string) {
    setLocationGardenId(gardenId);
    setCityQuery('');
    setCityResults([]);
    setGpsError(null);
  }

  function closeLocationModal() {
    setLocationGardenId(null);
    setCityQuery('');
    setCityResults([]);
    setGpsError(null);
  }

  async function searchCities(query: string) {
    setCityQuery(query);
    if (query.length < 2) { setCityResults([]); return; }
    setCitySearching(true);
    const results = await searchCity(query);
    setCityResults(results);
    setCitySearching(false);
  }

  async function applyLocation(loc: Location) {
    if (!locationGardenId) return;
    closeLocationModal();
    const garden = gardens.find(g => g.id === locationGardenId);
    if (!garden) return;

    await saveGardenLocation(locationGardenId, loc);
    await saveLocation(loc);
    // Persist to PocketBase so location survives cache clears / new devices
    pb.collection('gardens').update(locationGardenId, { location_json: JSON.stringify(loc) })
      .then(updated => setGardens(prev => prev.map(g => g.id === locationGardenId ? { ...g, ...(updated as any) } : g)))
      .catch(() => {});
    setGardenLocations(prev => ({ ...prev, [locationGardenId]: loc }));
    loadGardenWeather(garden, loc);
  }

  async function selectCity(result: GeoResult) {
    const loc: Location = {
      latitude: result.latitude,
      longitude: result.longitude,
      name: result.admin1
        ? `${result.name}, ${result.admin1}`
        : `${result.name}, ${result.country}`,
    };
    await applyLocation(loc);
  }

  async function useMyLocation() {
    setGpsError(null);
    setGpsLoading(true);
    try {
      const loc = await getBrowserLocation();
      await applyLocation(loc);
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.includes('not available') || msg.includes('secure')) {
        setGpsError('GPS requires HTTPS. Search for your city below.');
      } else {
        setGpsError('Location access denied. Search for your city below.');
      }
    } finally {
      setGpsLoading(false);
    }
  }

  // ── Grouping by location ─────────────────────────────────────────────────

  const itemsByGarden: Record<string, PlantWithAdvice[]> = {};
  for (const item of items) {
    const gid = item.plant.garden_id;
    if (!itemsByGarden[gid]) itemsByGarden[gid] = [];
    itemsByGarden[gid].push(item);
  }

  // Two gardens share a location if their location name matches (case-insensitive)
  // or their rounded lat/lon (0.1°) matches — whichever is available.
  function locationKey(loc: Location): string {
    if (loc.name) return loc.name.toLowerCase().trim();
    return `${loc.latitude.toFixed(1)},${loc.longitude.toFixed(1)}`;
  }

  type LocationGroup = { key: string; location: Location; gardens: Garden[] };

  const groupMap = new Map<string, LocationGroup>();
  for (const g of gardens) {
    const loc = gardenLocations[g.id];
    if (!loc) continue;
    const key = locationKey(loc);
    if (!groupMap.has(key)) groupMap.set(key, { key, location: loc, gardens: [] });
    groupMap.get(key)!.gardens.push(g);
  }

  const locationGroups = Array.from(groupMap.values());
  const noLocationGardens = gardens.filter(g => !gardenLocations[g.id]);

  const activeGardens = gardens.filter(g => (itemsByGarden[g.id]?.length ?? 0) > 0);
  const inactiveGardens = gardens.filter(g => !((itemsByGarden[g.id]?.length ?? 0) > 0));

  const totalItems = items.length;
  const totalOverdue = items.filter(i => i.overdue).length;

  // ── Location modal JSX ────────────────────────────────────────────────────

  const locationModalGarden = gardens.find(g => g.id === locationGardenId);
  const locationModal = (
    <Modal visible={!!locationGardenId} transparent animationType="slide">
      <View style={styles.modalBackdrop}>
        <View style={[styles.modal, { backgroundColor: cardBg }]}>
          <Text style={[styles.modalTitle, { color: textPrim }]}>
            📍 {locationModalGarden ? `Location for ${locationModalGarden.name}` : 'Set Location'}
          </Text>
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
          <TouchableOpacity onPress={closeLocationModal} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderGardenSection(garden: Garden, isDesktopLayout: boolean) {
    const gItems = itemsByGarden[garden.id] ?? [];
    const wx = gardenWeather[garden.id] ?? null;
    const loc = gardenLocations[garden.id] ?? null;
    const wxLoading = gardenWeatherLoading[garden.id] ?? false;
    const overdue = gItems.filter(i => i.overdue);
    const upcoming = gItems.filter(i => !i.overdue);

    return (
      <View key={garden.id} style={isDesktopLayout ? styles.desktopGardenSection : styles.gardenSection}>
        {/* Garden header */}
        <View style={styles.gardenHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.gardenName, { color: textPrim }]}>🌻 {garden.name}</Text>
            {loc && <Text style={[styles.gardenLoc, { color: textSec }]}>📍 {loc.name ?? 'Saved location'}</Text>}
          </View>
        </View>

        {/* Weather for this garden */}
        <WeatherWidget
          weather={wx}
          loading={wxLoading}
          tempUnit={tempUnit}
          onSetLocation={() => openLocationModal(garden.id)}
          onChangeLocation={() => openLocationModal(garden.id)}
        />

        {/* Schedule items */}
        {overdue.length > 0 && (
          <Section title={`🔴 Overdue (${overdue.length})`}>
            {overdue.map((item, i) => (
              <ScheduleCard key={i} item={item} onWater={markWatered}
                onPress={() => router.push(`/plant/${item.plant.id}`)} />
            ))}
          </Section>
        )}
        {upcoming.length > 0 && (
          <Section title="📋 Upcoming">
            {upcoming.map((item, i) => (
              <ScheduleCard key={i} item={item} onWater={markWatered}
                onPress={() => router.push(`/plant/${item.plant.id}`)} />
            ))}
          </Section>
        )}
        {gItems.length === 0 && (
          <View style={styles.gardenEmpty}>
            <Text style={styles.gardenEmptyText}>No upcoming tasks for this garden</Text>
          </View>
        )}
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  if (isDesktop) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: bg }]}
        contentContainerStyle={styles.desktopContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {locationModal}
        <View style={styles.desktopPageHeader}>
          <Text style={[styles.desktopPageTitle, { color: textPrim }]}>📅 Schedule</Text>
          <Text style={[styles.desktopPageSub, { color: textSec }]}>
            {totalOverdue > 0
              ? `${totalOverdue} overdue · ${totalItems} total tasks`
              : `${totalItems} upcoming task${totalItems !== 1 ? 's' : ''}`}
          </Text>
        </View>

        {gardens.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={styles.emptyText}>No gardens yet</Text>
            <Text style={styles.emptyHint}>Create a garden to start tracking your schedule</Text>
          </View>
        ) : (
          <View style={styles.desktopGrid}>
            {[...activeGardens, ...inactiveGardens].map(g => renderGardenSection(g, true))}
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: bg }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {locationModal}
      {gardens.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyText}>No gardens yet</Text>
          <Text style={styles.emptyHint}>Create a garden to start tracking your schedule</Text>
        </View>
      ) : (
        [...activeGardens, ...inactiveGardens].map(g => renderGardenSection(g, false))
      )}
    </ScrollView>
  );
}

// ─── WEATHER WIDGET ──────────────────────────────────────────────────────────

function WeatherWidget({ weather, loading, tempUnit, onSetLocation, onChangeLocation }: {
  weather: WeatherData | null;
  loading: boolean;
  tempUnit: TempUnit;
  onSetLocation: () => void;
  onChangeLocation: () => void;
}) {
  const { isDark, colors } = useAppTheme();
  const cardBg  = isDark ? colors.bgCard  : '#fff';
  const textPrim= isDark ? colors.text    : '#1b4332';
  const textSec = isDark ? colors.textSec : '#52796f';
  const border  = isDark ? colors.border  : '#f0f7ee';

  if (loading) {
    return (
      <View style={[styles.weatherCard, { backgroundColor: cardBg }]}>
        <ActivityIndicator color="#2d6a4f" size="small" />
        <Text style={[styles.weatherLoading, { color: textSec }]}>Fetching weather…</Text>
      </View>
    );
  }

  if (!weather) {
    return (
      <View style={[styles.weatherCard, styles.weatherCardEmpty, { backgroundColor: cardBg }]}>
        <Text style={[styles.weatherErrorText, { color: textSec }]}>📍 No location set — edit your garden to enable weather-aware watering</Text>
      </View>
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const today = weather.days.find(d => d.date === todayStr);
  const next7 = weather.days.filter(d => d.isFuture).slice(0, 7);
  const rainDays = next7.filter(d => d.isRainy);
  const totalRainMm = next7.reduce((s, d) => s + d.precipMm, 0);

  return (
    <View style={[styles.weatherCard, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={styles.weatherHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.weatherTitle, { color: textPrim }]}>
            {today ? `${formatTemp(today.tempMaxC, tempUnit)} / ${formatTemp(today.tempMinC, tempUnit)}` : 'Weather'}
          </Text>
          <TouchableOpacity onPress={onChangeLocation}>
            <Text style={[styles.weatherSub, { color: textSec }]}>
              📍 {weather.locationName ?? `${weather.latitude.toFixed(2)}, ${weather.longitude.toFixed(2)}`}
              {'  '}<Text style={styles.changeLink}>change</Text>
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

      <View style={styles.forecastRow}>
        {next7.map(day => (
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
  const { isDark, colors } = useAppTheme();
  const cardBg  = isDark ? colors.bgCard  : '#fff';
  const textPrim= isDark ? colors.text    : '#1b4332';
  const textSec = isDark ? colors.textSec : '#52796f';
  const isWater = item.type === 'water';
  const { advice } = item;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardBg }, item.overdue && styles.cardOverdue, advice?.skipReason && styles.cardSkip]}
      onPress={onPress}
    >
      <View style={styles.cardLeft}>
        <Text style={styles.cardEmoji}>{isWater ? '💧' : '🧺'}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardName, { color: textPrim }]}>{item.plant.name}</Text>
        <Text style={[styles.cardSub, { color: textSec }]}>
          {isWater ? 'Water' : 'Harvest'} · {formatDateShort(item.nextDate)}
          {item.overdue && !advice?.skipReason && ' ⚠️'}
        </Text>
        {advice?.skipReason && (
          <View style={styles.skipBadge}>
            <Text style={styles.skipText}>🌧️ {advice.skipReason}</Text>
          </View>
        )}
        {advice && !advice.skipReason && advice.recentRainMm > 3 && (
          <Text style={styles.rainAdjust}>Adjusted for {advice.recentRainMm.toFixed(0)}mm recent rain</Text>
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
          onPress={e => { e.stopPropagation(); onWater(item.plant); }}
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

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f7ee' },
  content: { padding: 16, paddingBottom: 40 },
  desktopContent: { maxWidth: 1400, width: '100%', alignSelf: 'center', paddingBottom: 48 },
  desktopPageHeader: { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 20 },
  desktopPageTitle: { fontSize: 28, fontWeight: '800', color: '#1b4332', letterSpacing: -0.5 },
  desktopPageSub: { fontSize: 14, color: '#52796f', marginTop: 4 },
  desktopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    paddingHorizontal: 32,
    alignItems: 'flex-start',
  },

  // Per-garden sections
  gardenSection: {
    marginBottom: 32,
  },
  desktopGardenSection: {
    width: '47%',
    minWidth: 340,
    flexGrow: 1,
  },
  gardenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  gardenName: { fontSize: 17, fontWeight: '800', color: '#1b4332' },
  gardenLoc: { fontSize: 12, color: '#52796f', marginTop: 2 },
  setLocBtn: {
    backgroundColor: '#d8f3dc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  setLocText: { fontSize: 12, color: '#2d6a4f', fontWeight: '600' },
  gardenEmpty: { paddingVertical: 16, alignItems: 'center' },
  gardenEmptyText: { fontSize: 13, color: '#74c69d', fontStyle: 'italic' },

  // Weather widget
  weatherCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  weatherCardEmpty: { alignItems: 'center', paddingVertical: 20 },
  weatherHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  weatherTitle: { fontSize: 20, fontWeight: '700', color: '#1b4332' },
  weatherSub: { fontSize: 12, color: '#52796f', marginTop: 2 },
  changeLink: { color: '#2d6a4f', fontWeight: '600' },
  weatherRight: { alignItems: 'flex-end', marginLeft: 8 },
  weatherBadgeRain: { backgroundColor: '#e7f5ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  weatherBadgeSun: { backgroundColor: '#ebfbee', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  weatherBadgeText: { fontSize: 12, color: '#1b4332', fontWeight: '500' },
  forecastRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  forecastDay: { alignItems: 'center', flex: 1 },
  forecastDayLabel: { fontSize: 11, color: '#52796f', marginBottom: 4 },
  forecastBar: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  forecastBarRain: { backgroundColor: '#d0ebff' },
  forecastBarDry: { backgroundColor: '#fff9db' },
  forecastBarEmoji: { fontSize: 14 },
  forecastMm: { fontSize: 9, color: '#1971c2', marginTop: 2 },
  weatherSummaryRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f7ee' },
  rainNote: { fontSize: 12, color: '#52796f', textAlign: 'center' },
  weatherLoading: { textAlign: 'center', color: '#52796f', marginTop: 8, fontSize: 13 },
  weatherErrorText: { textAlign: 'center', color: '#52796f', fontWeight: '500', marginBottom: 4 },
  retryLink: { textAlign: 'center', color: '#2d6a4f', fontSize: 13 },

  // Location modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderRadius: 20, padding: 24, margin: 16, maxHeight: '80%' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#2d6a4f', marginBottom: 4 },
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
  skipButtonText: { color: '#e03131', fontSize: 14, fontWeight: '600' },
  cancelBtn: { marginTop: 16, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#fff5f5', borderWidth: 1.5, borderColor: '#ffc9c9', alignSelf: 'center' },
  cancelText: { color: '#e03131', fontSize: 15, fontWeight: '700' },

  // Schedule items
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#2d6a4f', marginBottom: 8 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  cardOverdue: { borderLeftWidth: 4, borderLeftColor: '#ff6b6b' },
  cardSkip: { borderLeftWidth: 4, borderLeftColor: '#74c0fc', opacity: 0.85 },
  cardLeft: { marginRight: 12 },
  cardEmoji: { fontSize: 24 },
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
