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
      logError(error, 'global_handler' + (isFatal ? ':fatal' : ''));
      if (error?.name === 'ClientResponseError') return;
      prev?.(error, isFatal);
    });
  }
}
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/hooks/use-auth';
import { usePremium } from '@/hooks/use-premium';
import { pb } from '@/lib/pb';
import { AppThemeProvider, useAppTheme } from '@/contexts/theme-context';
import { SyncProvider } from '@/contexts/sync-context';
import { setupNotificationChannel, requestNotificationPermission, rescheduleAllNotifications } from '@/lib/notifications';
import { loadNotificationSettings } from '@/lib/notification-settings';
import { subscribe } from '@/lib/events';
import { initPurchases } from '@/lib/subscription';
import { checkRainAutoWater } from '@/lib/rain-auto-water';
import { logError } from '@/lib/error-log';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, user, loading } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';

    const inPublicRoute = inAuthGroup || segments[0] === 'reset-password' || segments[0] === 'privacy' || segments[0] === 'support';
    if (!session) {
      if (!inPublicRoute) router.replace('/(auth)/login');
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
  const { isPremium } = usePremium();

  // Auto-schedule local notifications on launch and on every plant change, not just from the settings toggle.
  useEffect(() => {
    if (Platform.OS === 'web' || !user?.id || !isPremium) return;
    let cancelled = false;

    async function syncNotifications(force: boolean) {
      const settings = await loadNotificationSettings();
      if (!settings.masterEnabled || cancelled) return;
      const granted = await requestNotificationPermission();
      if (!granted || cancelled) return;
      const plants = await offlineList('plants', user!.id, `user_id = "${user!.id}"`).catch(() => []);
      if (!cancelled) await rescheduleAllNotifications(plants as any, force);
    }

    // On-open: throttled (force=false). plants/plans changes: always run (force=true).
    syncNotifications(false);
    const unsubPlants = subscribe('plants:changed', () => syncNotifications(true));
    const unsubPlans = subscribe('plans:changed', () => syncNotifications(true));
    return () => { cancelled = true; unsubPlants(); unsubPlans(); };
  }, [user?.id, isPremium]);

  useEffect(() => {
    if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
      // Unregister the old caching SW (was at /sw.js, Cloudflare cached it)
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => { if (r.active?.scriptURL?.includes('/sw.js')) r.unregister(); });
      }).catch(() => {});
      // Register no-op SW at a new URL Cloudflare has never cached
      navigator.serviceWorker.register('/sw-noop.js').catch(() => {});
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
  // Also run the rain auto-water check (no-op if weather setting is off or already ran today).
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
    checkRainAutoWater(user.id).catch(() => {});
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
          <Stack.Screen name="reset-password" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="privacy" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="support" options={{ headerShown: false, animation: 'fade' }} />
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
