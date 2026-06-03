import PocketBase, { AsyncAuthStore, LocalAuthStore } from 'pocketbase';
import { Platform } from 'react-native';

const PB_URL = process.env.EXPO_PUBLIC_PB_URL!;
const STORE_KEY = 'pb_auth';

// Web: LocalAuthStore reads localStorage synchronously in its constructor,
// so pb.authStore.isValid is correct on the very first read — no async queue.
// Native: AsyncAuthStore with SecureStore for encrypted key-value persistence.
const store = Platform.OS === 'web'
  ? new LocalAuthStore(STORE_KEY)
  : new AsyncAuthStore({
      save: async (serialized) => {
        const { setItemAsync } = await import('expo-secure-store');
        await setItemAsync(STORE_KEY, serialized);
      },
      initial: undefined,
      clear: async () => {
        const { deleteItemAsync } = await import('expo-secure-store');
        await deleteItemAsync(STORE_KEY);
      },
    });

export const pb = new PocketBase(PB_URL, store);
pb.autoCancellation(false);

export function fileUrl(
  record: { collectionId: string; collectionName: string; id: string },
  filename: string,
): string {
  return `${PB_URL}/api/files/${record.collectionName}/${record.id}/${filename}`;
}
