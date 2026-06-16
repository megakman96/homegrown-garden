import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { pb } from '@/lib/pb';
import { G, R, Shadow } from '@/constants/theme';
import { PressableScale } from '@/components/ui/PressableScale';

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();

  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleReset() {
    if (!token) { setError('Invalid reset link.'); return; }
    if (!newPw || !confirmPw) { setError('Please fill in both fields.'); return; }
    if (newPw !== confirmPw) { setError('Passwords do not match.'); return; }
    if (newPw.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setLoading(true);
    setError(null);
    try {
      await pb.collection('users').confirmPasswordReset(token, newPw, confirmPw);
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? 'Could not reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={[G.forest, G.hunter, G.fern]} locations={[0, 0.55, 1]} style={styles.gradient}>
      <View style={styles.wrap}>
        <View style={styles.card}>
          {done ? (
            <>
              <Text style={styles.title}>Password updated ✅</Text>
              <Text style={styles.sub}>Your password has been reset. You can now sign in.</Text>
              <PressableScale onPress={() => router.replace('/(auth)/login')} style={styles.btn} haptic>
                <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnGradient}>
                  <Text style={styles.btnText}>Go to Sign In</Text>
                </LinearGradient>
              </PressableScale>
            </>
          ) : (
            <>
              <Text style={styles.title}>Set new password</Text>
              <Text style={styles.sub}>Choose a strong password for your GreenPlot account.</Text>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>⚠️ {error}</Text>
                </View>
              )}

              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                placeholder="At least 8 characters"
                placeholderTextColor={G.stone}
                value={newPw}
                onChangeText={setNewPw}
                secureTextEntry
                autoFocus
              />

              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={[styles.input, confirmPw.length > 0 && { borderColor: confirmPw === newPw ? '#52b788' : '#e03131' }]}
                placeholder="Repeat new password"
                placeholderTextColor={G.stone}
                value={confirmPw}
                onChangeText={setConfirmPw}
                secureTextEntry
              />

              <PressableScale onPress={handleReset} style={[styles.btn, { marginTop: 8 }]} haptic>
                <LinearGradient colors={[G.sage, G.hunter]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnGradient}>
                  {loading ? <ActivityIndicator color={G.cloud} /> : <Text style={styles.btnText}>Reset Password</Text>}
                </LinearGradient>
              </PressableScale>
            </>
          )}
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
  label:    { fontSize: 11, fontWeight: '700', color: G.stone, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: {
    backgroundColor: G.foam, borderRadius: R.md,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: G.ink,
    borderWidth: 1.5, borderColor: G.mist, marginBottom: 16,
  },
  errorBox: { backgroundColor: '#fff5f5', borderRadius: R.md, padding: 12, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: '#e03131' },
  errorText: { fontSize: 13, color: '#c0392b', lineHeight: 18 },
  btn:       { borderRadius: R.lg, overflow: 'hidden' },
  btnGradient: { paddingVertical: 15, alignItems: 'center', borderRadius: R.lg },
  btnText:   { color: G.cloud, fontSize: 16, fontWeight: '700' },
});
