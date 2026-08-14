import { useSyncExternalStore } from 'react';

import { useIsOnline } from '@/lib/useNetworkStatus';

// A tiny module-level store for the app-wide "syncing" state. It's kept outside
// React (not a Context) on purpose: both hooks (useOfflineAsync) and plain async
// modules (media-sync) need to flip it, and any number of concurrent sync tasks
// should collapse into a single "syncing" flag. Components subscribe via
// useSyncing()/useSync(); background code brackets work with withSync().

let activeCount = 0;
let lastSyncedAt: number | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function beginSync(): void {
  activeCount += 1;
  emit();
}

export function endSync(): void {
  activeCount = Math.max(0, activeCount - 1);
  if (activeCount === 0) lastSyncedAt = Date.now();
  emit();
}

/** Brackets an async task as "syncing" so the global banner reflects it. */
export async function withSync<T>(task: () => Promise<T>): Promise<T> {
  beginSync();
  try {
    return await task();
  } finally {
    endSync();
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSyncing(): boolean {
  return activeCount > 0;
}

/** Reactive: true while any sync task is in flight. */
export function useSyncing(): boolean {
  return useSyncExternalStore(subscribe, getSyncing, getSyncing);
}

export function lastSyncTime(): number | null {
  return lastSyncedAt;
}

/** Combined connectivity + sync state for the banner and any screen that cares. */
export function useSync(): { online: boolean; syncing: boolean } {
  const online = useIsOnline();
  const syncing = useSyncing();
  return { online, syncing };
}
