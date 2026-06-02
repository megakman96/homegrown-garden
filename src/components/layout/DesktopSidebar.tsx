import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { G, Shadow, Spring, R } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

const TABS = [
  { name: '(tabs)/index',    route: '/(tabs)',          label: 'Home',     emoji: '🏡' },
  { name: '(tabs)/garden',   route: '/(tabs)/garden',   label: 'Garden',   emoji: '🌻' },
  { name: '(tabs)/plants',   route: '/(tabs)/plants',   label: 'Plants',   emoji: '🌿' },
  { name: '(tabs)/schedule', route: '/(tabs)/schedule', label: 'Schedule', emoji: '📅' },
  { name: '(tabs)/profile',  route: '/(tabs)/profile',  label: 'Profile',  emoji: '👤' },
];

function NavItem({ tab, active }: { tab: typeof TABS[0]; active: boolean }) {
  const router = useRouter();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPressIn={() => { scale.value = withSpring(0.97, Spring.snappy); }}
      onPressOut={() => { scale.value = withSpring(1, Spring.gentle); }}
      onPress={() => router.push(tab.route as any)}
    >
      <Animated.View style={[styles.navItem, active && styles.navItemActive, animStyle]}>
        <Text style={styles.navEmoji}>{tab.emoji}</Text>
        <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab.label}</Text>
        {active && <View style={styles.activeBar} />}
      </Animated.View>
    </Pressable>
  );
}

export function DesktopSidebar() {
  const segments = useSegments();
  const { user, signOut } = useAuth();

  const activeSegment = segments[1] ?? 'index';

  return (
    <View style={styles.sidebar}>
      {/* Logo */}
      <View style={styles.logoRow}>
        <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
        <Text style={styles.logoText}>HomeGrown</Text>
      </View>

      {/* Nav */}
      <View style={styles.nav}>
        {TABS.map(tab => {
          const tabKey = tab.name.replace('(tabs)/', '');
          const isActive = activeSegment === tabKey || (activeSegment === '(tabs)' && tabKey === 'index');
          return <NavItem key={tab.name} tab={tab} active={isActive} />;
        })}
      </View>

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* User */}
      {user && (
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.email[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
          </View>
          <Pressable onPress={signOut} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>↩</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 220,
    backgroundColor: G.forest,
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 12,
    ...Shadow.float,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    marginBottom: 32,
  },
  logo: { width: 36, height: 36, borderRadius: R.full },
  logoText: { color: G.foam, fontWeight: '800', fontSize: 18, letterSpacing: -0.3 },
  nav: { gap: 4 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: R.md,
    position: 'relative',
  },
  navItemActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  navEmoji: { fontSize: 20 },
  navLabel: { color: G.seafoam, fontSize: 15, fontWeight: '500' },
  navLabelActive: { color: G.cloud, fontWeight: '700' },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: R.full,
    backgroundColor: G.sage,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: R.full,
    backgroundColor: G.sage,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: G.cloud, fontWeight: '700', fontSize: 14 },
  userEmail: { color: G.seafoam, fontSize: 12 },
  signOutBtn: {
    width: 28,
    height: 28,
    borderRadius: R.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signOutText: { color: G.mist, fontSize: 14 },
});
