import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { G, R, Shadow } from '@/constants/theme';

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: 'Acceptance of terms',
    body:
      'By downloading, installing, or using GreenPlot, you agree to these Terms of Use. If you do not agree, please do not use the app.',
  },
  {
    heading: 'GreenPlot Pro subscription',
    body:
      'GreenPlot Pro is an auto-renewing subscription available as Monthly ($1.99/month) or Annual ($19.99/year) plans, each preceded by a 14-day free trial. Payment is charged to your App Store or Google Play account at confirmation of purchase.',
  },
  {
    heading: 'Trial & billing',
    body:
      'Your free trial converts automatically into a paid subscription at the end of the 14-day period unless you cancel at least 24 hours before the trial ends. Subscriptions automatically renew for the same length and price unless auto-renew is turned off at least 24 hours before the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period.',
  },
  {
    heading: 'Managing & cancelling',
    body:
      'You can manage or cancel your subscription at any time in your device’s account settings (App Store: Settings > Apple ID > Subscriptions; Google Play: Play Store > Payments & subscriptions). Cancelling stops future renewals but does not refund the current period.',
  },
  {
    heading: 'Use of the app',
    body:
      'You may use GreenPlot for personal, non-commercial garden planning. You are responsible for the accuracy of the garden data you enter and for keeping your account credentials secure.',
  },
  {
    heading: 'No warranty',
    body:
      'GreenPlot is provided "as is." Planting advice, frost dates, and weather-aware suggestions are estimates and not a guarantee of gardening outcomes.',
  },
  {
    heading: 'Changes to these terms',
    body: 'We may update these terms from time to time. Continued use of the app after a change constitutes acceptance of the updated terms.',
  },
  {
    heading: 'Contact',
    body: 'Questions about these terms? Contact us at support@greenplot.us.',
  },
];

export default function TermsScreen() {
  return (
    <LinearGradient colors={[G.forest, G.hunter, G.fern]} locations={[0, 0.55, 1]} style={styles.gradient}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.card}>
          <Text style={styles.title}>Terms of Use (EULA)</Text>
          <Text style={styles.sub}>These Terms of Use govern your use of GreenPlot, including the GreenPlot Pro subscription.</Text>
          {SECTIONS.map((s) => (
            <View key={s.heading} style={styles.section}>
              <Text style={styles.heading}>{s.heading}</Text>
              <Text style={styles.body}>{s.body}</Text>
            </View>
          ))}
          <Text style={styles.updated}>Last updated: September 15, 2026</Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  wrap:     { flexGrow: 1, alignItems: 'center', padding: 24, paddingVertical: 48 },
  card: {
    width: '100%', maxWidth: 640,
    backgroundColor: G.cloud,
    borderRadius: R.xl,
    padding: 28,
    ...Shadow.float,
  },
  title:   { fontSize: 24, fontWeight: '700', color: G.forest, marginBottom: 8 },
  sub:     { fontSize: 14, color: G.stone, marginBottom: 24, lineHeight: 20 },
  section: { marginBottom: 18 },
  heading: { fontSize: 15, fontWeight: '700', color: G.forest, marginBottom: 4 },
  body:    { fontSize: 14, color: G.ink, lineHeight: 20 },
  updated: { fontSize: 12, color: G.stone, marginTop: 12 },
});
