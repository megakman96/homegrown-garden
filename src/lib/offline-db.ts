import AsyncStorage from '@react-native-async-storage/async-storage';
import { pb } from './pb';
import * as cache from './offline-cache';

// PocketBase ClientResponseError has status=0 when the fetch itself failed (no network).
// Any other error (400/404/500) means we reached the server.
export function isNetworkError(e: any): boolean {
  const status = e?.status ?? e?.response?.status;
  return status === 0 || status === undefined && e?.name !== 'ClientResponseError';
}

// Local-only IDs so we can detect unsynced records throughout the app
export function tempId(): string {
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
export function isTempId(id: string): boolean {
  return id.startsWith('tmp_');
}

// ── Reads ─────────────────────────────────────────────────────────────────

export async function offlineList(col: string, uid: string, filter: string): Promise<any[]> {
  try {
    const data = await pb.collection(col).getFullList({ filter });
    await cache.cacheList(col, uid, data);
    return data;
  } catch (e) {
    return cache.getCachedList(col, uid);
  }
}

export async function offlineOne(col: string, id: string): Promise<any | null> {
  try {
    const data = await pb.collection(col).getOne(id);
    await cache.cacheOne(col, id, data);
    return data;
  } catch (e) {
    return cache.getCachedOne(col, id);
  }
}

// ── Writes ────────────────────────────────────────────────────────────────

export async function offlineCreate(
  col: string,
  uid: string,
  data: any,
): Promise<{ record: any; queued: boolean }> {
  try {
    const record = await pb.collection(col).create(data);
    await cache.addToCachedList(col, uid, record);
    return { record, queued: false };
  } catch (e) {
    if (isNetworkError(e)) {
      const localId = tempId();
      const local = {
        ...data,
        id: localId,
        user_id: uid,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        _offline: true,
      };
      await cache.addToCachedList(col, uid, local);
      await cache.enqueueOp({ collection: col, action: 'create', recordId: localId, data, userId: uid });
      return { record: local, queued: true };
    }
    throw e;
  }
}

export async function offlineUpdate(
  col: string,
  uid: string,
  id: string,
  data: any,
): Promise<{ record: any; queued: boolean }> {
  // Optimistically update cache first so UI responds instantly
  await cache.patchCachedListItem(col, uid, id, data);
  await cache.cacheOne(col, id, { ...(await cache.getCachedOne(col, id) ?? {}), ...data });

  if (isTempId(id)) {
    // Still offline-only — merge into existing create op
    const queue = await cache.getQueue();
    const createOp = queue.find(op => op.action === 'create' && op.recordId === id);
    if (createOp) {
      createOp.data = { ...createOp.data, ...data };
      await AsyncStorage.setItem('gg:sync_queue', JSON.stringify(queue));
    }
    return { record: { id, ...data, _offline: true }, queued: true };
  }

  try {
    const record = await pb.collection(col).update(id, data);
    await cache.patchCachedListItem(col, uid, id, record);
    await cache.cacheOne(col, id, record);
    return { record, queued: false };
  } catch (e) {
    if (isNetworkError(e)) {
      await cache.enqueueOp({ collection: col, action: 'update', recordId: id, data, userId: uid });
      return { record: { id, ...data, _offline: true }, queued: true };
    }
    throw e;
  }
}

export async function offlineDelete(
  col: string,
  uid: string,
  id: string,
): Promise<{ queued: boolean }> {
  await cache.removeFromCachedList(col, uid, id);

  if (isTempId(id)) {
    // Never reached the server — just remove from queue too
    const queue = await cache.getQueue();
    const createOp = queue.find(op => op.action === 'create' && op.recordId === id);
    if (createOp) await cache.dequeueOp(createOp.id);
    return { queued: false };
  }

  try {
    await pb.collection(col).delete(id);
    return { queued: false };
  } catch (e) {
    if (isNetworkError(e)) {
      await cache.enqueueOp({ collection: col, action: 'delete', recordId: id, userId: uid });
      return { queued: true };
    }
    throw e;
  }
}

