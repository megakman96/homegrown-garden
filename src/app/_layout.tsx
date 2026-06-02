import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { useAuth } from '@/hooks/use-auth';
import { pb } from '@/lib/pb';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, user, loading } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inNewGarden = segments[0] === 'new-garden';

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login');
      return;
    }

    if (inAuthGroup) {
      // Just authenticated — check if this user has any gardens yet
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

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="plant/[id]" options={{ headerShown: true, title: 'Plant Detail' }} />
          <Stack.Screen name="new-garden" />
        </Stack>
      </AuthGuard>
    </ThemeProvider>
  );
}
