import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { pb } from '@/lib/pb';
import { getQueue, dequeueOp, SyncOp } from '@/lib/offline-cache';
import { isNetworkError } from '@/lib/offline-db';
import { emit } from '@/lib/events';
import { logError } from '@/lib/error-log';

interface SyncContextValue {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  flushQueue: () => Promise<void>;
  markOnline: (online: boolean) => void;
}

const SyncContext = createContext<SyncContextValue>({
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  flushQueue: async () => {},
  markOnline: () => {},
});

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const flushing = useRef(false);

  const refreshPending = useCallback(async () => {
    const queue = await getQueue();
    setPendingCount(queue.length);
  }, []);

  const flushQueue = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    setIsSyncing(true);

    const queue = await getQueue();
    if (!queue.length) {
      flushing.current = false;
      setIsSyncing(false);
      return;
    }

    const collections = new Set<string>();
    let hadNetworkError = false;

    for (const op of queue) {
      if (hadNetworkError) break;
      try {
        await executeOp(op);
        await dequeueOp(op.id);
        collections.add(op.collection);
      } catch (e) {
        if (isNetworkError(e)) {
          hadNetworkError = true;
          setIsOnline(false);
        } else {
          // Server rejected it (conflict, validation error) — discard to unblock queue
          logError(e, `sync:${op.collection}:${op.action}`);
          await dequeueOp(op.id);
        }
      }
    }

    await refreshPending();
    setIsSyncing(false);
    flushing.current = false;

    if (!hadNetworkError && collections.size > 0) {
      setIsOnline(true);
      // Notify all screens to re-fetch so temp IDs are replaced with real server IDs
      emit('plants:changed');
      emit('gardens:changed');
    }
  }, [refreshPending]);

  const markOnline = useCallback((online: boolean) => {
    setIsOnline(online);
    if (online) flushQueue();
  }, [flushQueue]);

  // Flush when app comes back to foreground
  useEffect(() => {
    refreshPending();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') flushQueue();
    });
    return () => sub.remove();
  }, [flushQueue, refreshPending]);

  // Periodic retry when offline
  useEffect(() => {
    if (isOnline) return;
    const id = setInterval(flushQueue, 15_000);
    return () => clearInterval(id);
  }, [isOnline, flushQueue]);

  return (
    <SyncContext.Provider value={{ isOnline, pendingCount, isSyncing, flushQueue, markOnline }}>
      {children}
    </SyncContext.Provider>
  );
}

export const useSyncStatus = () => useContext(SyncContext);

async function executeOp(op: SyncOp) {
  if (op.action === 'create') {
    await pb.collection(op.collection).create(op.data);
  } else if (op.action === 'update') {
    await pb.collection(op.collection).update(op.recordId, op.data);
  } else if (op.action === 'delete') {
    await pb.collection(op.collection).delete(op.recordId);
  }
}
