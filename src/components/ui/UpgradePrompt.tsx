import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { G, R, Shadow } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';

interface Props {
  title?: string;
  message: string;
  compact?: boolean;
}

export default function UpgradePrompt({ title = 'Pro Feature', message, compact = false }: Props) {
  const router = useRouter();
  const { isDark, colors } = useAppTheme();
  const cardBg = isDark ? colors.bgCard : '#fffbeb';
  const textPrim = isDark ? colors.text : '#7d5a00';
  const textSec  = isDark ? colors.textSec : '#9c6f00';

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compact, { backgroundColor: cardBg, borderColor: '#ffe066' }]}
        onPress={() => router.push('/subscription' as any)}
      >
        <Text style={styles.compactLock}>🔒</Text>
        <Text style={[styles.compactText, { color: textPrim }]}>{message}</Text>
        <Text style={[styles.compactCta, { color: '#e67700' }]}>Upgrade →</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: '#ffe066' }]}>
      <Text style={styles.lock}>🔒</Text>
      <Text style={[styles.title, { color: textPrim }]}>{title}</Text>
      <Text style={[styles.message, { color: textSec }]}>{message}</Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.push('/subscription' as any)}
      >
        <Text style={styles.btnText}>Start Free 14-Day Trial</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: R.lg, borderWidth: 1.5, padding: 20,
    alignItems: 'center', margin: 16, ...Shadow.soft,
  },
  lock:    { fontSize: 32, marginBottom: 8 },
  title:   { fontSize: 17, fontWeight: '800', marginBottom: 6 },
  message: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  btn:     { backgroundColor: '#e67700', borderRadius: R.lg, paddingVertical: 12, paddingHorizontal: 24 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  compact: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: R.md, borderWidth: 1, padding: 12, marginBottom: 8,
  },
  compactLock: { fontSize: 14 },
  compactText: { flex: 1, fontSize: 13, fontWeight: '600' },
  compactCta:  { fontSize: 13, fontWeight: '700' },
});
