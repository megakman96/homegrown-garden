import PocketBase, { AsyncAuthStore, LocalAuthStore } from 'pocketbase';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PB_URL = process.env.EXPO_PUBLIC_PB_URL!;
const STORE_KEY = 'pb_auth';
const INSTALL_FLAG = 'app_installed_v1';

// AsyncStorage is wiped on uninstall; SecureStore (Keychain) is not.
// On first launch after a fresh install, clear any stale Keychain credentials
// so the user is prompted to log in again.
async function clearStaleKeychainIfFreshInstall() {
  if (Platform.OS === 'web') return;
  try {
    const flag = await AsyncStorage.getItem(INSTALL_FLAG);
    if (!flag) {
      const SecureStore = require('expo-secure-store');
      await SecureStore.deleteItemAsync(STORE_KEY);
      await AsyncStorage.setItem(INSTALL_FLAG, '1');
    }
  } catch {}
}

clearStaleKeychainIfFreshInstall();

function createStore() {
  if (Platform.OS === 'web') {
    return new LocalAuthStore(STORE_KEY);
  }
  // SecureStore.getItem is synchronous on iOS/Android — pass the stored token as
  // `initial` so AsyncAuthStore restores the session immediately on startup
  // instead of always starting unauthenticated.
  const SecureStore = require('expo-secure-store');
  return new AsyncAuthStore({
    save: async (serialized) => {
      await SecureStore.setItemAsync(STORE_KEY, serialized);
    },
    initial: SecureStore.getItem(STORE_KEY) ?? undefined,
    clear: async () => {
      await SecureStore.deleteItemAsync(STORE_KEY);
    },
  });
}

export const pb = new PocketBase(PB_URL, createStore());
pb.autoCancellation(false);

// Auto-clear stale token on 401 so AuthGuard redirects to login
pb.afterSend = (response, data) => {
  if (response.status === 401) {
    pb.authStore.clear();
  }
  return data;
};

export function fileUrl(
  record: { collectionId: string; collectionName: string; id: string },
  filename: string,
): string {
  return `${PB_URL}/api/files/${record.collectionName}/${record.id}/${filename}`;
}
