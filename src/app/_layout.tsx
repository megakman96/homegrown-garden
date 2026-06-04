import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

// On native, PocketBase ClientResponseErrors from unhandled async chains crash
// the app via ErrorUtils. Filter them out — individual screens handle errors via try/catch.
if (Platform.OS !== 'web') {
  const EU = (global as any).ErrorUtils;
  if (EU?.setGlobalHandler) {
    const prev = EU.getGlobalHandler();
    EU.setGlobalHandler((error: any, isFatal: boolean) => {
      if (error?.name === 'ClientResponseError') return;
      prev?.(error, isFatal);
    });
  }
}
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/hooks/use-auth';
import { pb } from '@/lib/pb';
import { AppThemeProvider, useAppTheme } from '@/contexts/theme-context';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, user, loading } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login');
      return;
    }

    if (inAuthGroup) {
      const uid = user?.id ?? (pb.authStore.model as any)?.id;
      if (!uid) { router.replace('/(tabs)'); return; }

      pb.collection('gardens')
        .getList(1, 1, { filter: `user_id = "${uid}"` })
        .then(result => {
          router.replace(result.totalItems === 0 ? '/new-garden' : '/(tabs)');
        })
        .catch(() => router.replace('/(tabs)'));
    }
  }, [session, loading]);

  return <>{children}</>;
}

function ThemedApp() {
  const { isDark } = useAppTheme();

  useEffect(() => {
    if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthGuard>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            animationDuration: 180,
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
          <Stack.Screen name="plant/[id]" options={{ headerShown: true, title: 'Plant Detail', animation: 'slide_from_right', animationDuration: 220 }} />
          <Stack.Screen name="new-garden" options={{ animation: 'slide_from_bottom', animationDuration: 260 }} />
          <Stack.Screen name="admin" options={{ animation: 'slide_from_bottom', animationDuration: 260 }} />
        </Stack>
      </AuthGuard>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <ThemedApp />
    </AppThemeProvider>
  );
}
