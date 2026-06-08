import AsyncStorage from '@react-native-async-storage/async-storage';

const K = {
  list: (col: string, uid: string) => `gg:list:${col}:${uid}`,
  one:  (col: string, id: string)  => `gg:one:${col}:${id}`,
  queue: 'gg:sync_queue',
};

// ── List cache ────────────────────────────────────────────────────────────

export async function cacheList(col: string, uid: string, data: any[]) {
  await AsyncStorage.setItem(K.list(col, uid), JSON.stringify(data));
}

export async function getCachedList(col: string, uid: string): Promise<any[]> {
  const raw = await AsyncStorage.getItem(K.list(col, uid));
  return raw ? JSON.parse(raw) : [];
}

export async function patchCachedListItem(col: string, uid: string, id: string, data: any) {
  const list = await getCachedList(col, uid);
  const i = list.findIndex((r: any) => r.id === id);
  if (i >= 0) {
    list[i] = { ...list[i], ...data };
    await cacheList(col, uid, list);
  }
}

export async function addToCachedList(col: string, uid: string, record: any) {
  const list = await getCachedList(col, uid);
  if (!list.find((r: any) => r.id === record.id)) {
    await cacheList(col, uid, [record, ...list]);
  }
}

export async function removeFromCachedList(col: string, uid: string, id: string) {
  const list = await getCachedList(col, uid);
  await cacheList(col, uid, list.filter((r: any) => r.id !== id));
}

// ── Single-record cache ───────────────────────────────────────────────────

export async function cacheOne(col: string, id: string, data: any) {
  await AsyncStorage.setItem(K.one(col, id), JSON.stringify(data));
}

export async function getCachedOne(col: string, id: string): Promise<any | null> {
  const raw = await AsyncStorage.getItem(K.one(col, id));
  return raw ? JSON.parse(raw) : null;
}

// ── Sync queue ────────────────────────────────────────────────────────────

export interface SyncOp {
  id: string;
  collection: string;
  action: 'create' | 'update' | 'delete';
  recordId: string;
  data?: any;
  userId: string;
  queuedAt: string;
}

export async function enqueueOp(op: Omit<SyncOp, 'id' | 'queuedAt'>): Promise<SyncOp> {
  const queue = await getQueue();
  const full: SyncOp = {
    ...op,
    id: `op_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    queuedAt: new Date().toISOString(),
  };
  // Collapse duplicate update ops for the same record
  if (op.action === 'update') {
    const existing = queue.findIndex(q => q.action === 'update' && q.recordId === op.recordId && q.collection === op.collection);
    if (existing >= 0) {
      queue[existing].data = { ...queue[existing].data, ...op.data };
      await AsyncStorage.setItem(K.queue, JSON.stringify(queue));
      return queue[existing];
    }
  }
  await AsyncStorage.setItem(K.queue, JSON.stringify([...queue, full]));
  return full;
}

export async function getQueue(): Promise<SyncOp[]> {
  const raw = await AsyncStorage.getItem(K.queue);
  return raw ? JSON.parse(raw) : [];
}

export async function dequeueOp(opId: string) {
  const queue = await getQueue();
  await AsyncStorage.setItem(K.queue, JSON.stringify(queue.filter(op => op.id !== opId)));
}

export async function clearQueue() {
  await AsyncStorage.removeItem(K.queue);
}
