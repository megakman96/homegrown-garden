import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { offlineList } from '@/lib/offline-db';

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
import { SyncProvider } from '@/contexts/sync-context';
import { setupNotificationChannel } from '@/lib/notifications';
import { initPurchases } from '@/lib/subscription';

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

      const email = user?.email ?? (pb.authStore.model as any)?.email ?? '';
      Promise.all([
        pb.collection('gardens').getList(1, 1, { filter: `user_id = "${uid}"` }),
        email ? pb.collection('garden_shares').getList(1, 1, { filter: `shared_with_email = "${email}"` }) : Promise.resolve({ totalItems: 0 }),
      ])
        .then(([ownResult, sharedResult]) => {
          const hasAnyGarden = ownResult.totalItems > 0 || sharedResult.totalItems > 0;
          router.replace(hasAnyGarden ? '/(tabs)' : '/new-garden');
        })
        .catch(() => router.replace('/(tabs)'));
    }
  }, [session, loading]);

  return <>{children}</>;
}

function ThemedApp() {
  const { isDark } = useAppTheme();
  const { user } = useAuth();

  useEffect(() => {
    if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    setupNotificationChannel();
    if (!__DEV__ && Platform.OS !== 'web') {
      Updates.checkForUpdateAsync()
        .then(({ isAvailable }) => {
          if (isAvailable) return Updates.fetchUpdateAsync().then(() => Updates.reloadAsync());
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      initPurchases(user.id);
      // Refresh the stored user record so promo_expires (and any server fields) are current
      pb.collection('users').authRefresh().catch(() => {});
    }
  }, [user?.id]);

  // Preload plants + gardens into the offline cache as soon as the user is known,
  // so the Plants tab renders instantly instead of loading on first focus.
  const preloadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user?.id || preloadedRef.current === user.id) return;
    preloadedRef.current = user.id;
    offlineList('gardens', user.id, `user_id = "${user.id}"`).then((gardens) => {
      for (const g of gardens) {
        offlineList('plants', `${user.id}:${g.id}`, `garden_id = "${g.id}"`).catch(() => {});
      }
    }).catch(() => {});
    offlineList('plants', user.id, `user_id = "${user.id}"`).catch(() => {});
  }, [user?.id]);

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
          <Stack.Screen name="plant/[id]" options={{ headerShown: true, title: 'Plant Detail', headerBackTitle: 'Back', animation: 'slide_from_right', animationDuration: 220 }} />
          <Stack.Screen name="new-garden" options={{ animation: 'slide_from_bottom', animationDuration: 260 }} />
          <Stack.Screen name="admin" options={{ animation: 'slide_from_bottom', animationDuration: 260 }} />
          <Stack.Screen name="subscription" options={{ headerShown: false, animation: 'slide_from_bottom', animationDuration: 300 }} />
          <Stack.Screen name="statistics" options={{ headerShown: true, title: 'Harvest Statistics', headerBackTitle: 'Back', animation: 'slide_from_right', animationDuration: 220 }} />
        </Stack>
      </AuthGuard>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <SyncProvider>
        <ThemedApp />
      </SyncProvider>
    </AppThemeProvider>
  );
}
