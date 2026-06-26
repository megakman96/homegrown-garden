import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { G, R, Shadow } from '@/constants/theme';
import { usePremium } from '@/hooks/use-premium';

const DISMISS_KEY = 'gg_banner_dismissed_until';

async function getDismissedUntil(): Promise<number> {
  try {
    if (Platform.OS === 'web') {
      return parseInt(localStorage.getItem(DISMISS_KEY) ?? '0', 10);
    }
    const AS = (await import('@react-native-async-storage/async-storage')).default;
    return parseInt((await AS.getItem(DISMISS_KEY)) ?? '0', 10);
  } catch { return 0; }
}

async function setDismissedUntil(until: number) {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(DISMISS_KEY, String(until));
    } else {
      const AS = (await import('@react-native-async-storage/async-storage')).default;
      await AS.setItem(DISMISS_KEY, String(until));
    }
  } catch {}
}

export default function ProBanner() {
  const router = useRouter();
  const { isPremium, loading } = usePremium();
  const [visible, setVisible] = useState(false);
  const opacity = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (loading || isPremium) return;
    getDismissedUntil().then(until => {
      if (Date.now() < until) return;
      setVisible(true);
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    });
  }, [loading, isPremium]);

  function dismiss() {
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setVisible(false);
    });
    // Re-show tomorrow
    setDismissedUntil(Date.now() + 24 * 60 * 60 * 1000);
  }

  if (loading || isPremium || !visible) return null;

  return (
    <Animated.View style={[styles.wrap, { opacity }]}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => router.push('/subscription' as any)}
      >
        <LinearGradient
          colors={['#1b4332', '#2d6a4f']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.banner}
        >
          <Text style={styles.emoji}>🌱</Text>
          <View style={styles.body}>
            <Text style={styles.title}>GreenPlot Pro</Text>
            <Text style={styles.sub}>Unlimited gardens · Weather · Print garden plans</Text>
          </View>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>Try free</Text>
            <Text style={styles.ctaArrow}>→</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.closeBtn} onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginBottom: 12,
    position: 'relative',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: R.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingRight: 36,
    gap: 10,
    ...Shadow.card,
  },
  emoji:  { fontSize: 22 },
  body:   { flex: 1 },
  title:  { fontSize: 13, fontWeight: '800', color: G.cloud, letterSpacing: 0.1 },
  sub:    { fontSize: 11, color: 'rgba(255,255,255,0.70)', marginTop: 2 },
  cta:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ctaText:{ fontSize: 12, fontWeight: '700', color: '#a9e34b' },
  ctaArrow:{ fontSize: 13, color: '#a9e34b', fontWeight: '700' },
  closeBtn: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0,
    width: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '700' },
});
