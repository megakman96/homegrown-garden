import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { G, R, Shadow } from '@/constants/theme';

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: 'Account information',
    body:
      'When you create a GreenPlot account we collect your email address, password, and optionally your first name and birthday. Your password is never stored in plain text.',
  },
  {
    heading: 'Garden data',
    body:
      'We store the garden layouts, plants, watering and harvest history, and any progress photos you add so the app can work and stay in sync across your devices.',
  },
  {
    heading: 'Location',
    body:
      'If you set a location for a garden, we use the coordinates to fetch weather and frost-date information from Open-Meteo, a third-party weather provider. We do not access or track your device’s GPS location in the background.',
  },
  {
    heading: 'Garden sharing',
    body:
      'If you share a garden with someone else, we store the email address you entered so that person can access the shared garden. The person you share with can see the garden data you’ve shared.',
  },
  {
    heading: 'Subscriptions',
    body:
      'GreenPlot Pro purchases are processed by Apple or Google and managed through RevenueCat, our subscription infrastructure provider. RevenueCat receives your in-app user ID and purchase/subscription status to manage entitlements — it does not receive your email, password, or garden data.',
  },
  {
    heading: 'Diagnostics',
    body:
      'If the app encounters an error, we may send a diagnostic report (error message, device platform, and app version) to our servers to help us fix bugs. These reports are not linked to advertising and are used only for troubleshooting.',
  },
  {
    heading: 'How we use your information',
    body:
      'We use your data solely to provide GreenPlot’s features: storing your garden plans, sending you watering and harvest reminders, and showing weather-aware advice. We do not sell your data or share it with advertisers.',
  },
  {
    heading: 'Data deletion',
    body:
      'You can delete your account and all associated data at any time from the Profile tab, or by contacting us at support@greenplot.us.',
  },
  {
    heading: 'Children’s privacy',
    body:
      'GreenPlot is not directed at children under 13, and we do not knowingly collect information from children under 13.',
  },
  {
    heading: 'Changes to this policy',
    body: 'We may update this policy from time to time. Changes will be posted at this page.',
  },
  {
    heading: 'Contact',
    body: 'Questions about this policy? Contact us at support@greenplot.us.',
  },
];

export default function PrivacyScreen() {
  return (
    <LinearGradient colors={[G.forest, G.hunter, G.fern]} locations={[0, 0.55, 1]} style={styles.gradient}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.card}>
          <Text style={styles.title}>Privacy Policy</Text>
          <Text style={styles.sub}>GreenPlot ("we", "our", "the app") respects your privacy. This page explains what information we collect and how we use it.</Text>
          {SECTIONS.map((s) => (
            <View key={s.heading} style={styles.section}>
              <Text style={styles.heading}>{s.heading}</Text>
              <Text style={styles.body}>{s.body}</Text>
            </View>
          ))}
          <Text style={styles.updated}>Last updated: August 4, 2026</Text>
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
