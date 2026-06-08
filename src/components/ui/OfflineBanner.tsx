import { View, Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useSyncStatus } from '@/contexts/sync-context';

export default function OfflineBanner() {
  const { isOnline, pendingCount } = useSyncStatus();
  const opacity = useRef(new Animated.Value(0)).current;

  const visible = !isOnline;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible) return null;

  const label = pendingCount > 0
    ? `Offline · ${pendingCount} change${pendingCount !== 1 ? 's' : ''} saved locally`
    : 'Offline · changes will sync when reconnected';

  return (
    <Animated.View style={[styles.bar, { opacity }]}>
      <Text style={styles.text}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar:  { paddingVertical: 6, paddingHorizontal: 16, alignItems: 'center', backgroundColor: '#e67700' },
  text: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
