import { View, Text, StyleSheet, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { G, R, Shadow } from '@/constants/theme';
import { PressableScale } from '@/components/ui/PressableScale';

export default function SupportScreen() {
  return (
    <LinearGradient colors={[G.forest, G.hunter, G.fern]} locations={[0, 0.55, 1]} style={styles.gradient}>
      <View style={styles.wrap}>
        <View style={styles.card}>
          <Text style={styles.title}>GreenPlot Support</Text>
          <Text style={styles.sub}>
            Have a question, found a bug, or need help with your account? We're happy to help.
          </Text>
          <PressableScale
            onPress={() => Linking.openURL('mailto:support@greenplot.us?subject=GreenPlot%20Support')}
            style={styles.btn}
            haptic
          >
            <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnGradient}>
              <Text style={styles.btnText}>Email support@greenplot.us</Text>
            </LinearGradient>
          </PressableScale>
          <Text style={styles.footnote}>We typically reply within a couple of days.</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  wrap:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    width: '100%', maxWidth: 420,
    backgroundColor: G.cloud,
    borderRadius: R.xl,
    padding: 28,
    ...Shadow.float,
  },
  title:    { fontSize: 22, fontWeight: '700', color: G.forest, marginBottom: 8 },
  sub:      { fontSize: 14, color: G.stone, marginBottom: 20, lineHeight: 20 },
  btn:      { borderRadius: R.lg, overflow: 'hidden' },
  btnGradient: { paddingVertical: 15, alignItems: 'center', borderRadius: R.lg },
  btnText:  { color: G.cloud, fontSize: 16, fontWeight: '700' },
  footnote: { fontSize: 12, color: G.stone, marginTop: 14, textAlign: 'center' },
});
