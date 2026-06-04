import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useEffect } from 'react';
import { G, Shadow, Spring, R } from '@/constants/theme';
import { DesktopSidebar } from '@/components/layout/DesktopSidebar';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useAppTheme } from '@/contexts/theme-context';

const TABS = [
  { name: 'index',    label: 'Home',     emoji: '🏡' },
  { name: 'garden',   label: 'Garden',   emoji: '🌻' },
  { name: 'plants',   label: 'Plants',   emoji: '🌿' },
  { name: 'schedule', label: 'Schedule', emoji: '📅' },
  { name: 'history',  label: 'History',  emoji: '📋' },
  { name: 'plan',     label: 'Plan',     emoji: '🗓️' },
  { name: 'profile',  label: 'Profile',  emoji: '👤' },
];

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  const scale = useSharedValue(1);
  const dotOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.15 : 1, Spring.snappy);
    dotOpacity.value = withSpring(focused ? 1 : 0, Spring.gentle);
  }, [focused]);

  const emojiStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value, transform: [{ scale: dotOpacity.value }] }));

  return (
    <View style={styles.iconWrap}>
      <Animated.Text style={[styles.emoji, emojiStyle]}>{emoji}</Animated.Text>
      <Animated.View style={[styles.dot, dotStyle]} />
    </View>
  );
}

function DesktopTabsWrapper() {
  return (
    <View style={styles.desktopShell}>
      <DesktopSidebar />
      <View style={styles.desktopContent}>
        <Tabs
          tabBar={() => null}
          screenOptions={{ headerShown: false }}
        >
          {TABS.map(tab => (
            <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
          ))}
        </Tabs>
      </View>
    </View>
  );
}

function MobileTabs() {
  const { isDark, colors } = useAppTheme();
  const tabBg = isDark ? colors.bgCard : G.cloud;
  const headerBg = isDark ? colors.bgCard : G.foam;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: headerBg, ...Shadow.soft },
        headerTintColor: isDark ? colors.text : G.forest,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        tabBarStyle: [styles.tabBar, { backgroundColor: tabBg, borderTopColor: isDark ? colors.border : 'transparent' }],
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveTintColor: isDark ? colors.tint : G.hunter,
        tabBarInactiveTintColor: isDark ? colors.textSec : G.stone,
      }}
    >
      {TABS.map(tab => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarIcon: ({ focused }) => <TabIcon emoji={tab.emoji} focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}

export default function TabsLayout() {
  const { isDesktop } = useBreakpoint();
  return isDesktop ? <DesktopTabsWrapper /> : <MobileTabs />;
}

const styles = StyleSheet.create({
  desktopShell: { flex: 1, flexDirection: 'row' },
  desktopContent: { flex: 1 },
  tabBar: {
    backgroundColor: G.cloud,
    borderTopWidth: 0,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    height: Platform.OS === 'ios' ? 84 : 64,
    ...Shadow.float,
  },
  tabLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  iconWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  emoji: { fontSize: 22 },
  dot: {
    width: 5, height: 5, borderRadius: R.full,
    backgroundColor: G.sage, marginTop: 3,
  },
});
