import { useSyncExternalStore } from 'react';

import { useIsOnline } from '@/lib/useNetworkStatus';

// A tiny module-level store for the app-wide "syncing" state. It's kept outside
// React (not a Context) on purpose: both hooks (useOfflineAsync) and plain async
// modules (the media sync, the outbox replay) need to flip it, and any number of
// concurrent sync tasks should collapse into a single "syncing" flag.
// Components subscribe via useSyncing()/useSync(); background code brackets work
// with withSync().
//
// Ports essentially verbatim from src/lib/sync-status.tsx — it was already
// platform-agnostic. The pending-changes slot is new: on RN the count came from
// mutation-queue, which on the web will live in the IndexedDB outbox (phase 3).
// Keeping the slot here means the banner does not have to import the queue, and
// the queue can publish its count without a React context.

let activeCount = 0;
let lastSyncedAt: number | null = null;
let pendingCount = 0;
let failedCount = 0;
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

/** Published by the outbox so the banner can say how much is waiting. */
export function setPendingCount(n: number): void {
  const next = Math.max(0, n);
  if (next === pendingCount) return;
  pendingCount = next;
  emit();
}

function getPendingCount(): number {
  return pendingCount;
}

export function usePendingCount(): number {
  return useSyncExternalStore(subscribe, getPendingCount, getPendingCount);
}

/**
 * Publicado también por el outbox: los cambios que ya NO se van a reintentar
 * solos y necesitan que la docente decida.
 *
 * Va en una ranura aparte de `pendingCount` y no sumado a él porque el aviso de
 * arriba dice "se sincronizarán al reconectar", y de un cambio muerto eso es
 * mentira — exactamente la que denuncia BUG-03.
 */
export function setFailedCount(n: number): void {
  const next = Math.max(0, n);
  if (next === failedCount) return;
  failedCount = next;
  emit();
}

function getFailedCount(): number {
  return failedCount;
}

export function useFailedCount(): number {
  return useSyncExternalStore(subscribe, getFailedCount, getFailedCount);
}

/** Combined connectivity + sync state for the banner and any screen that cares. */
export function useSync(): {
  online: boolean;
  syncing: boolean;
  pending: number;
  failed: number;
} {
  const online = useIsOnline();
  const syncing = useSyncing();
  const pending = usePendingCount();
  const failed = useFailedCount();
  return { online, syncing, pending, failed };
}

/** Test-only reset. */
export function __resetSyncStatus(): void {
  activeCount = 0;
  lastSyncedAt = null;
  pendingCount = 0;
  failedCount = 0;
  listeners.clear();
}
