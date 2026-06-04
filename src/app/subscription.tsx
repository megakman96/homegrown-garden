import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { G, R, Shadow } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import { PressableScale } from '@/components/ui/PressableScale';
import {
  getOfferings, purchasePackage, restorePurchases,
  checkPremium, redeemPromoCode,
} from '@/lib/subscription';

const FEATURES = [
  { emoji: '🌻', label: 'Unlimited gardens', sub: 'Plan as many seasons as you want' },
  { emoji: '📄', label: 'PDF garden reports', sub: 'Detailed per-plant reports, printable' },
  { emoji: '🌦️', label: 'Weather-aware watering', sub: 'Rain forecasts adjust your schedule' },
  { emoji: '🤝', label: 'Garden sharing', sub: 'Collaborate with family & friends' },
  { emoji: '📅', label: 'Season planner', sub: 'Frost dates, sow dates, harvest calendar' },
  { emoji: '🔔', label: 'Smart notifications', sub: 'Watering, harvest & sowing reminders' },
];

export default function SubscriptionScreen() {
  const router = useRouter();
  const { isDark, colors } = useAppTheme();
  const bg     = isDark ? colors.bg     : G.foam;
  const cardBg = isDark ? colors.bgCard : G.cloud;
  const textPrim = isDark ? colors.text   : G.forest;
  const textSec  = isDark ? colors.textSec: G.stone;
  const border   = isDark ? colors.border : G.mist;

  const [offerings, setOfferings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<'monthly' | 'annual'>('annual');
  const [isPremium, setIsPremium] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [showPromo, setShowPromo] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);

  useEffect(() => {
    Promise.all([checkPremium(), getOfferings()]).then(([premium, offs]) => {
      setIsPremium(premium);
      setOfferings(offs);
      setLoading(false);
    });
  }, []);

  async function handlePurchase() {
    if (!offerings) {
      Alert.alert('Not available', Platform.OS === 'web'
        ? 'Subscriptions require the iOS or Android app.'
        : 'Subscriptions require a full app build (not Expo Go). Use a promo code below to get access during testing.');
      return;
    }
    const pkg = selectedPkg === 'annual'
      ? offerings.current?.availablePackages.find((p: any) => p.packageType === 'ANNUAL')
      : offerings.current?.availablePackages.find((p: any) => p.packageType === 'MONTHLY');
    if (!pkg) { Alert.alert('Package not found', 'Please try again.'); return; }

    setPurchasing(true);
    try {
      const success = await purchasePackage(pkg);
      if (success) {
        setIsPremium(true);
        Alert.alert('🎉 Welcome to GardenGrid Pro!', 'Enjoy all premium features. Happy growing!');
        router.back();
      }
    } catch (e: any) {
      Alert.alert('Purchase failed', e?.message ?? 'Something went wrong.');
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    setPurchasing(true);
    try {
      const success = await restorePurchases();
      if (success) {
        setIsPremium(true);
        Alert.alert('Restored!', 'Your premium access has been restored.');
        router.back();
      } else {
        Alert.alert('Nothing to restore', 'No active subscription found for this account.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not restore purchases.');
    } finally {
      setPurchasing(false);
    }
  }

  async function handlePromoCode() {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    const result = await redeemPromoCode(promoCode);
    setPromoLoading(false);
    Alert.alert(result.success ? '✅ Success' : '❌ Invalid Code', result.message);
    if (result.success) {
      setIsPremium(true);
      setPromoCode('');
      setShowPromo(false);
      setTimeout(() => router.back(), 800);
    }
  }

  if (isPremium) {
    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
        <LinearGradient colors={[G.forest, G.hunter]} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </LinearGradient>
        <View style={styles.activeWrap}>
          <Text style={styles.activeEmoji}>🌟</Text>
          <Text style={[styles.activeTitle, { color: textPrim }]}>You're a Pro grower!</Text>
          <Text style={[styles.activeSub, { color: textSec }]}>All GardenGrid features are unlocked.</Text>
          <PressableScale style={styles.doneBtn} onPress={() => router.back()}>
            <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.doneBtnGrad}>
              <Text style={styles.doneBtnText}>Back to app</Text>
            </LinearGradient>
          </PressableScale>
        </View>
      </View>
    );
  }

  // Monthly / annual package details from RevenueCat, or fallback display prices
  const monthlyPkg = offerings?.current?.availablePackages?.find((p: any) => p.packageType === 'MONTHLY');
  const annualPkg  = offerings?.current?.availablePackages?.find((p: any) => p.packageType === 'ANNUAL');
  const monthlyPrice = monthlyPkg?.product?.priceString ?? '$2.99';
  const annualPrice  = annualPkg?.product?.priceString  ?? '$19.99';

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <LinearGradient colors={[G.forest, G.hunter]} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerEmoji}>🌱</Text>
          <Text style={styles.headerTitle}>GardenGrid Pro</Text>
          <Text style={styles.headerSub}>Try free for 14 days, then choose a plan</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Features */}
        {FEATURES.map(f => (
          <View key={f.label} style={[styles.featureRow, { borderBottomColor: border }]}>
            <Text style={styles.featureEmoji}>{f.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.featureLabel, { color: textPrim }]}>{f.label}</Text>
              <Text style={[styles.featureSub, { color: textSec }]}>{f.sub}</Text>
            </View>
            <Text style={styles.checkmark}>✓</Text>
          </View>
        ))}

        {/* Plan picker */}
        <Text style={[styles.sectionTitle, { color: textPrim }]}>Choose your plan</Text>

        <TouchableOpacity
          style={[styles.planCard, { backgroundColor: cardBg, borderColor: selectedPkg === 'annual' ? G.hunter : border }]}
          onPress={() => setSelectedPkg('annual')}
        >
          <View style={[styles.planRadio, selectedPkg === 'annual' && styles.planRadioActive]} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.planName, { color: textPrim }]}>Annual</Text>
              <View style={styles.saveBadge}><Text style={styles.saveBadgeText}>SAVE 44%</Text></View>
            </View>
            <Text style={[styles.planPrice, { color: textSec }]}>{annualPrice}/year · after 14-day free trial</Text>
          </View>
          <Text style={[styles.planPriceRight, { color: G.hunter }]}>
            {annualPrice === '$19.99' ? '$1.67' : ''}/mo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.planCard, { backgroundColor: cardBg, borderColor: selectedPkg === 'monthly' ? G.hunter : border }]}
          onPress={() => setSelectedPkg('monthly')}
        >
          <View style={[styles.planRadio, selectedPkg === 'monthly' && styles.planRadioActive]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.planName, { color: textPrim }]}>Monthly</Text>
            <Text style={[styles.planPrice, { color: textSec }]}>{monthlyPrice}/month · after 14-day free trial</Text>
          </View>
          <Text style={[styles.planPriceRight, { color: textSec }]}>{monthlyPrice}/mo</Text>
        </TouchableOpacity>

        {/* CTA */}
        <PressableScale
          style={[styles.ctaBtn, purchasing && { opacity: 0.6 }]}
          onPress={handlePurchase}
          disabled={purchasing || loading}
        >
          <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtnGrad}>
            {purchasing
              ? <ActivityIndicator color={G.cloud} />
              : <Text style={styles.ctaBtnText}>Start Free 7-Day Trial</Text>}
          </LinearGradient>
        </PressableScale>
        <Text style={[styles.ctaNote, { color: textSec }]}>
          Cancel anytime before trial ends and you won't be charged.
        </Text>

        {/* Promo code */}
        <TouchableOpacity onPress={() => setShowPromo(v => !v)} style={styles.promoToggle}>
          <Text style={[styles.promoToggleText, { color: textSec }]}>
            Have a promo code? {showPromo ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        {showPromo && (
          <View style={[styles.promoRow, { borderColor: border }]}>
            <TextInput
              style={[styles.promoInput, { backgroundColor: isDark ? colors.bgElement : G.foam, color: textPrim, borderColor: border }]}
              placeholder="Enter code (e.g. GROWFREE)"
              placeholderTextColor={textSec}
              value={promoCode}
              onChangeText={setPromoCode}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.promoApplyBtn, promoLoading && { opacity: 0.6 }]}
              onPress={handlePromoCode}
              disabled={promoLoading}
            >
              {promoLoading
                ? <ActivityIndicator color={G.cloud} size="small" />
                : <Text style={styles.promoApplyText}>Apply</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Restore */}
        <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn} disabled={purchasing}>
          <Text style={[styles.restoreText, { color: textSec }]}>Restore previous purchase</Text>
        </TouchableOpacity>

        <Text style={[styles.legalText, { color: textSec }]}>
          Payment charged to your App Store / Google Play account after the 14-day trial.
          Subscription auto-renews unless cancelled 24h before renewal.
        </Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  header:        { paddingTop: Platform.OS === 'ios' ? 56 : 24, paddingBottom: 32, paddingHorizontal: 24 },
  closeBtn:      { alignSelf: 'flex-end', width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  closeBtnText:  { color: G.cloud, fontSize: 15, fontWeight: '600' },
  headerContent: { alignItems: 'center', marginTop: 8 },
  headerEmoji:   { fontSize: 44, marginBottom: 8 },
  headerTitle:   { fontSize: 26, fontWeight: '800', color: G.cloud, letterSpacing: -0.3 },
  headerSub:     { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  scroll:        { padding: 20, paddingTop: 16 },
  featureRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  featureEmoji:  { fontSize: 22, width: 32, textAlign: 'center' },
  featureLabel:  { fontSize: 15, fontWeight: '600' },
  featureSub:    { fontSize: 12, marginTop: 2 },
  checkmark:     { fontSize: 16, color: G.sage, fontWeight: '700' },
  sectionTitle:  { fontSize: 17, fontWeight: '700', marginTop: 24, marginBottom: 12 },
  planCard:      { flexDirection: 'row', alignItems: 'center', borderRadius: R.lg, borderWidth: 2, padding: 16, marginBottom: 10, gap: 12 },
  planRadio:     { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: G.mist },
  planRadioActive:{ borderColor: G.hunter, backgroundColor: G.hunter },
  planName:      { fontSize: 16, fontWeight: '700' },
  planPrice:     { fontSize: 12, marginTop: 2 },
  planPriceRight:{ fontSize: 15, fontWeight: '700' },
  saveBadge:     { backgroundColor: G.sage, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3 },
  saveBadgeText: { fontSize: 10, color: G.cloud, fontWeight: '800', letterSpacing: 0.5 },
  ctaBtn:        { marginTop: 8, borderRadius: R.lg, overflow: 'hidden', ...Shadow.card },
  ctaBtnGrad:    { paddingVertical: 16, alignItems: 'center' },
  ctaBtnText:    { color: G.cloud, fontWeight: '800', fontSize: 17 },
  ctaNote:       { fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  promoToggle:   { alignItems: 'center', marginTop: 20 },
  promoToggleText:{ fontSize: 13 },
  promoRow:      { flexDirection: 'row', gap: 8, marginTop: 10, borderRadius: R.md, overflow: 'hidden' },
  promoInput:    { flex: 1, borderRadius: R.md, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  promoApplyBtn: { backgroundColor: G.hunter, borderRadius: R.md, paddingHorizontal: 18, justifyContent: 'center' },
  promoApplyText:{ color: G.cloud, fontWeight: '700', fontSize: 14 },
  restoreBtn:    { alignItems: 'center', marginTop: 16 },
  restoreText:   { fontSize: 13 },
  legalText:     { fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 17 },
  activeWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  activeEmoji:   { fontSize: 64, marginBottom: 16 },
  activeTitle:   { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  activeSub:     { fontSize: 15, textAlign: 'center', marginBottom: 32 },
  doneBtn:       { borderRadius: R.lg, overflow: 'hidden', ...Shadow.card, width: '100%' },
  doneBtnGrad:   { paddingVertical: 16, alignItems: 'center' },
  doneBtnText:   { color: G.cloud, fontWeight: '800', fontSize: 16 },
});
