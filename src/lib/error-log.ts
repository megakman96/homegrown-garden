import { Platform } from 'react-native';
import Constants from 'expo-constants';

const PB_URL = process.env.EXPO_PUBLIC_PB_URL!;

// Fire-and-forget error logging to the error_logs PocketBase collection.
// Uses a raw fetch (not the pb client) so it works even when unauthenticated
// or when pb.authStore is in a bad state.
export function logError(error: unknown, context?: string) {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack ?? '' : '';
    const body = JSON.stringify({
      message: message.slice(0, 2000),
      stack: stack.slice(0, 4000),
      context: context ?? '',
      platform: Platform.OS,
      app_version: `${Constants.expoConfig?.version ?? ''} (${Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? ''})`,
    });
    fetch(`${PB_URL}/api/collections/error_logs/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => {});
  } catch {}
}
