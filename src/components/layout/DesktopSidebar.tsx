import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { G, Spring, R } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

const TABS = [
  { name: '(tabs)/index',    route: '/(tabs)',           label: 'Home',     emoji: '🏡' },
  { name: '(tabs)/garden',   route: '/(tabs)/garden',    label: 'Garden',   emoji: '🌻' },
  { name: '(tabs)/plants',   route: '/(tabs)/plants',    label: 'Plants',   emoji: '🌿' },
  { name: '(tabs)/schedule', route: '/(tabs)/schedule',  label: 'Schedule', emoji: '📅' },
  { name: '(tabs)/history',  route: '/(tabs)/history',   label: 'History',  emoji: '📋' },
  { name: '(tabs)/plan',     route: '/(tabs)/plan',      label: 'Plan',     emoji: '🗓️' },
  { name: '(tabs)/profile',  route: '/(tabs)/profile',   label: 'Profile',  emoji: '👤' },
];

function NavItem({ tab, active }: { tab: typeof TABS[0]; active: boolean }) {
  const router = useRouter();
  const bg = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(255,255,255,${bg.value * 0.1})`,
  }));

  return (
    <Pressable
      onPressIn={() => { bg.value = withSpring(1.2, Spring.snappy); }}
      onPressOut={() => { bg.value = withSpring(active ? 1 : 0, Spring.gentle); }}
      onPress={() => router.push(tab.route as any)}
    >
      <Animated.View style={[styles.navItem, active && styles.navItemActive, animStyle]}>
        <Text style={[styles.navEmoji, active && styles.navEmojiActive]}>{tab.emoji}</Text>
        <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab.label}</Text>
        {active && <View style={styles.activePip} />}
      </Animated.View>
    </Pressable>
  );
}

export function DesktopSidebar() {
  const segments = useSegments() as string[];
  const { user, signOut } = useAuth();
  const activeSegment = segments[1] ?? 'index';

  return (
    <View style={styles.sidebar}>
      {/* Brand */}
      <View style={styles.brand}>
        <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
        <View>
          <Text style={styles.brandName}>HomeGrown</Text>
          <Text style={styles.brandTag}>Garden Tracker</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>MENU</Text>

      {/* Nav */}
      <View style={styles.nav}>
        {TABS.map(tab => {
          const tabKey = tab.name.replace('(tabs)/', '');
          const isActive =
            activeSegment === tabKey ||
            (tabKey === 'index' && (activeSegment === '(tabs)' || activeSegment === undefined));
          return <NavItem key={tab.name} tab={tab} active={isActive} />;
        })}
      </View>

      <View style={{ flex: 1 }} />

      {/* User */}
      {user && (
        <View style={styles.userSection}>
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.email[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
              <Text style={styles.userRole}>Gardener</Text>
            </View>
          </View>
          <Pressable onPress={signOut} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 256,
    backgroundColor: G.forest,
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 16,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 6,
    marginBottom: 28,
  },
  logo: { width: 40, height: 40, borderRadius: R.sm },
  brandName: { color: G.foam, fontWeight: '800', fontSize: 17, letterSpacing: -0.3 },
  brandTag: { color: G.seafoam, fontSize: 11, marginTop: 1 },
  sectionLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  nav: { gap: 2 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: R.sm,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  navEmoji: { fontSize: 17, opacity: 0.65 },
  navEmojiActive: { opacity: 1 },
  navLabel: { color: G.seafoam, fontSize: 14, fontWeight: '500' },
  navLabelActive: { color: G.cloud, fontWeight: '700' },
  activePip: {
    position: 'absolute',
    left: 0,
    top: '25%',
    bottom: '25%',
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: G.sage,
  },
  userSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 16,
    gap: 10,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: R.full,
    backgroundColor: G.fern,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: { color: G.cloud, fontWeight: '700', fontSize: 15 },
  userEmail: { color: G.foam, fontSize: 12, fontWeight: '600' },
  userRole: { color: G.seafoam, fontSize: 11, marginTop: 1 },
  signOutBtn: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: R.sm,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  signOutText: { color: G.mist, fontSize: 13, fontWeight: '500' },
});
