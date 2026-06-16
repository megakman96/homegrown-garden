import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Image, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withRepeat,
  withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import { PressableScale } from '@/components/ui/PressableScale';
import { FadeInView } from '@/components/ui/FadeInView';
import { pb } from '@/lib/pb';
import { G, Spring, Shadow, R } from '@/constants/theme';
import { saveBirthday } from '@/contexts/theme-context';

const TAGLINES = [
  'Grow something beautiful 🌸',
  'Every seed is a promise 🌱',
  'Your garden, your story 🌿',
  'Good things grow here 🍅',
  'Dig in, grow up 🪴',
  'Bloom where you\'re planted 🌻',
  'Roots down, spirits up 🌾',
  'Sow today, feast tomorrow 🧺',
  'Life is better with dirt on your hands 🤎',
  'Green thumb loading… 🌿',
  'Gardens don\'t grow overnight, but they\'re worth it 🥕',
  'Be the gardener of your own joy 🌼',
];

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [taglineIdx] = useState(() => Math.floor(Math.random() * TAGLINES.length));
  const [firstName, setFirstName] = useState('');
  const [birthday, setBirthday] = useState(''); // MM/DD
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

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

  async function handleForgotPassword() {
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      await pb.collection('users').requestPasswordReset(forgotEmail.trim());
      setForgotSent(true);
    } catch {
      // Always show success to avoid exposing which emails exist
      setForgotSent(true);
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleAuth() {
    if (!email || !password) return;
    if (isSignUp && password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      if (isSignUp) {
        await pb.collection('users').create({
          email, password, passwordConfirm: confirmPassword,
          name: firstName.trim() || email.split('@')[0],
          emailVisibility: true,
        });
        await pb.collection('users').authWithPassword(email, password);
        const uid = (pb.authStore.model as any)?.id;
        if (uid && birthday.trim()) saveBirthday(uid, birthday.trim());
      } else {
        await pb.collection('users').authWithPassword(email, password);
      }
    } catch (e: any) {
      const msg: string = e?.response?.message ?? e?.message ?? 'Something went wrong';
      // PocketBase returns field-level validation errors in e.data or e.response.data
      const fieldErrors = e?.data ?? e?.response?.data ?? {};
      const emailError = fieldErrors?.email;
      const isEmailTaken =
        emailError?.code === 'validation_not_unique' ||
        emailError?.message?.toLowerCase().includes('already in use') ||
        msg.toLowerCase().includes('already exists') ||
        (msg.toLowerCase().includes('email') && msg.toLowerCase().includes('unique'));
      if (isSignUp && isEmailTaken) {
        setErrorMsg('An account with that email already exists. Try signing in instead.');
        setIsSignUp(false);
      } else {
        setErrorMsg(msg);
      }
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
            <Text style={styles.brandName}>GreenPlot</Text>
            <Text style={styles.tagline}>{TAGLINES[taglineIdx]}</Text>
          </FadeInView>

          <FadeInView delay={240} style={styles.card}>
            {forgotMode ? (
              forgotSent ? (
                <>
                  <Text style={styles.cardTitle}>Check your email 📬</Text>
                  <Text style={[styles.switchText, { color: G.stone, marginBottom: 20, lineHeight: 20 }]}>
                    If an account exists for {forgotEmail}, we've sent a password reset link.
                  </Text>
                  <PressableScale onPress={() => { setForgotMode(false); setForgotSent(false); setForgotEmail(''); }} style={styles.btn} haptic>
                    <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnGradient}>
                      <Text style={styles.btnText}>Back to Sign In</Text>
                    </LinearGradient>
                  </PressableScale>
                </>
              ) : (
                <>
                  <Text style={styles.cardTitle}>Reset Password</Text>
                  <View style={styles.inputWrap}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="you@example.com"
                      placeholderTextColor={G.stone}
                      value={forgotEmail}
                      onChangeText={setForgotEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoFocus
                      returnKeyType="go"
                      onSubmitEditing={handleForgotPassword}
                    />
                  </View>
                  <PressableScale onPress={handleForgotPassword} style={styles.btn} haptic>
                    <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnGradient}>
                      {forgotLoading
                        ? <ActivityIndicator color={G.cloud} />
                        : <Text style={styles.btnText}>Send Reset Link</Text>
                      }
                    </LinearGradient>
                  </PressableScale>
                  <PressableScale onPress={() => setForgotMode(false)} style={styles.switchBtn} haptic={false}>
                    <Text style={styles.switchText}>
                      <Text style={styles.switchLink}>← Back to Sign In</Text>
                    </Text>
                  </PressableScale>
                </>
              )
            ) : (
            <>
            <Text style={styles.cardTitle}>{isSignUp ? 'Create Account' : 'Welcome back'}</Text>

            {errorMsg && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
              </View>
            )}

            {isSignUp && (
              <>
                <View style={styles.inputWrap}>
                  <Text style={styles.label}>First Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Your first name"
                    placeholderTextColor={G.stone}
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                    autoComplete="given-name"
                  />
                </View>
                <View style={styles.inputWrap}>
                  <Text style={styles.label}>Birthday <Text style={{ fontWeight: '400', textTransform: 'none' }}>(optional)</Text></Text>
                  <TextInput
                    style={styles.input}
                    placeholder="MM/DD  e.g. 03/15"
                    placeholderTextColor={G.stone}
                    value={birthday}
                    onChangeText={setBirthday}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                </View>
              </>
            )}

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
                returnKeyType={isSignUp ? 'next' : 'go'}
                onSubmitEditing={isSignUp ? undefined : handleAuth}
              />
            </View>

            {isSignUp && (
              <View style={styles.inputWrap}>
                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  style={[
                    styles.input,
                    confirmPassword.length > 0 && {
                      borderColor: confirmPassword === password ? '#52b788' : '#e03131',
                    },
                  ]}
                  placeholder="••••••••"
                  placeholderTextColor={G.stone}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoComplete="new-password"
                  returnKeyType="go"
                  onSubmitEditing={handleAuth}
                />
                {confirmPassword.length > 0 && confirmPassword !== password && (
                  <Text style={styles.matchError}>Passwords do not match</Text>
                )}
              </View>
            )}

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
              onPress={() => { setIsSignUp(v => !v); setErrorMsg(null); setFirstName(''); setBirthday(''); setConfirmPassword(''); }}
              style={styles.switchBtn}
              haptic={false}
            >
              <Text style={styles.switchText}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={styles.switchLink}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
              </Text>
            </PressableScale>

            {!isSignUp && (
              <PressableScale
                onPress={() => { setForgotMode(true); setForgotEmail(email); setForgotSent(false); }}
                style={[styles.switchBtn, { marginTop: 4 }]}
                haptic={false}
              >
                <Text style={[styles.switchText, { color: G.stone }]}>
                  Forgot your password?
                </Text>
              </PressableScale>
            )}
            </>
            )}
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
  cardTitle:   { fontSize: 22, fontWeight: '700', color: G.forest, marginBottom: 16 },
  errorBox:    { backgroundColor: '#fff5f5', borderRadius: R.md, padding: 12, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: '#e03131' },
  errorText:   { fontSize: 13, color: '#c0392b', lineHeight: 18 },
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
  matchError:  { fontSize: 12, color: '#e03131', marginTop: 4 },
  switchBtn:   { marginTop: 16, alignItems: 'center' },
  switchText:  { color: G.stone, fontSize: 14 },
  switchLink:  { color: G.hunter, fontWeight: '700' },
  leafRow:     { flexDirection: 'row', gap: 16, marginTop: 32 },
  leaf:        { fontSize: 26, opacity: 0.8 },
});
