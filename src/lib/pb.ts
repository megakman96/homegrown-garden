import PocketBase, { AsyncAuthStore } from 'pocketbase';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PB_URL = process.env.EXPO_PUBLIC_PB_URL!;
const STORE_KEY = 'pb_auth';

const store = new AsyncAuthStore({
  save: async (serialized) => {
    if (Platform.OS === 'web') {
      try { localStorage.setItem(STORE_KEY, serialized); } catch {}
    } else {
      await SecureStore.setItemAsync(STORE_KEY, serialized);
    }
  },
  initial: Platform.OS === 'web'
    ? (() => { try { return localStorage.getItem(STORE_KEY); } catch { return null; } })()
    : undefined,
  clear: async () => {
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(STORE_KEY); } catch {}
    } else {
      await SecureStore.deleteItemAsync(STORE_KEY);
    }
  },
});

export const pb = new PocketBase(PB_URL, store);

export function fileUrl(record: { collectionId: string; collectionName: string; id: string }, filename: string): string {
  return `${PB_URL}/api/files/${record.collectionName}/${record.id}/${filename}`;
}
