import PocketBase, { AsyncAuthStore, LocalAuthStore } from 'pocketbase';
import { Platform } from 'react-native';

const PB_URL = process.env.EXPO_PUBLIC_PB_URL!;
const STORE_KEY = 'pb_auth';

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

export function fileUrl(
  record: { collectionId: string; collectionName: string; id: string },
  filename: string,
): string {
  return `${PB_URL}/api/files/${record.collectionName}/${record.id}/${filename}`;
}
