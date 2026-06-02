import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withRepeat,
  withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import { PressableScale } from '@/components/ui/PressableScale';
import { FadeInView } from '@/components/ui/FadeInView';
import { supabase } from '@/lib/supabase';
import { G, Spring, Shadow, R } from '@/constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const logoFloat = useSharedValue(0);

  useEffect(() => {
    logoFloat.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0,  { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: logoFloat.value }],
  }));

  async function handleAuth() {
    if (!email || !password) return;
    setLoading(true);
    try {
      const { error } = isSignUp
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      if (error) Alert.alert('Oops', error.message);
      else if (isSignUp)
        Alert.alert('Check your email', 'We sent you a confirmation link 🌱');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={[G.forest, G.hunter, G.fern]}
      locations={[0, 0.55, 1]}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <FadeInView delay={0} style={styles.logoWrap} from="scale">
            <Animated.View style={logoStyle}>
              <Image
                source={require('@/assets/images/icon.png')}
                style={styles.logoImg}
              />
            </Animated.View>
          </FadeInView>

          <FadeInView delay={120} style={styles.brandWrap}>
            <Text style={styles.brandName}>HomeGrown</Text>
            <Text style={styles.tagline}>Grow something beautiful 🌸</Text>
          </FadeInView>

          <FadeInView delay={240} style={styles.card}>
            <Text style={styles.cardTitle}>{isSignUp ? 'Create Account' : 'Welcome back'}</Text>

            <View style={styles.inputWrap}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={G.stone}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={styles.inputWrap}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={G.stone}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
            </View>

            <PressableScale onPress={handleAuth} style={styles.btn} haptic>
              <LinearGradient
                colors={[G.sage, G.hunter]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                {loading
                  ? <ActivityIndicator color={G.cloud} />
                  : <Text style={styles.btnText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
                }
              </LinearGradient>
            </PressableScale>

            <PressableScale
              onPress={() => setIsSignUp(v => !v)}
              style={styles.switchBtn}
              haptic={false}
            >
              <Text style={styles.switchText}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={styles.switchLink}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
              </Text>
            </PressableScale>
          </FadeInView>

          <FadeInView delay={360} style={styles.leafRow}>
            <Text style={styles.leaf}>🌿</Text>
            <Text style={styles.leaf}>🌱</Text>
            <Text style={styles.leaf}>🍃</Text>
          </FadeInView>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient:    { flex: 1 },
  scroll:      { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 },
  logoWrap:    { marginBottom: 8, alignItems: 'center' },
  logoImg:     { width: 110, height: 110, borderRadius: R.full },
  brandWrap:   { alignItems: 'center', marginBottom: 36 },
  brandName:   { fontSize: 38, fontWeight: '800', color: G.foam, letterSpacing: -0.5 },
  tagline:     { fontSize: 15, color: G.mint, marginTop: 4 },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: G.cloud,
    borderRadius: R.xl,
    padding: 28,
    ...Shadow.float,
  },
  cardTitle:   { fontSize: 22, fontWeight: '700', color: G.forest, marginBottom: 20 },
  inputWrap:   { marginBottom: 16 },
  label:       { fontSize: 11, fontWeight: '700', color: G.stone, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: {
    backgroundColor: G.foam,
    borderRadius: R.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: G.ink,
    borderWidth: 1.5,
    borderColor: G.mist,
  },
  btn:         { marginTop: 8, borderRadius: R.lg, overflow: 'hidden' },
  btnGradient: { paddingVertical: 15, alignItems: 'center', borderRadius: R.lg },
  btnText:     { color: G.cloud, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  switchBtn:   { marginTop: 16, alignItems: 'center' },
  switchText:  { color: G.stone, fontSize: 14 },
  switchLink:  { color: G.hunter, fontWeight: '700' },
  leafRow:     { flexDirection: 'row', gap: 16, marginTop: 32 },
  leaf:        { fontSize: 26, opacity: 0.8 },
});
