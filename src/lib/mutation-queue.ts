import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { UpdateProfileInput } from '@explorarte/shared';
import { api } from '@/lib/api';
import { withSync } from '@/lib/sync-status';

// Offline write queue: changes made without connection are persisted here and
// replayed, in order, when the device comes back online. Fase 2 starts with the
// safest mutation (profile edit — a single object, no ids/cross-refs); events
// and community writes extend the Mutation union + dispatch() later.

const KEY = 'offline-mutations-v1';

export type Mutation = { id: string; kind: 'profile.update'; input: UpdateProfileInput };

let queue: Mutation[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    /* best-effort */
  }
}

/** Loads the persisted queue once (so a returning offline user sees pending changes). */
export async function loadQueue(): Promise<void> {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    queue = raw ? (JSON.parse(raw) as Mutation[]) : [];
  } catch {
    queue = [];
  }
  loaded = true;
  emit();
}

function newId(): string {
  return 'm-' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

/** Queue a profile update to sync later. Coalesces to the most recent edit. */
export async function enqueueProfileUpdate(input: UpdateProfileInput): Promise<void> {
  await loadQueue();
  queue = queue.filter((m) => m.kind !== 'profile.update');
  queue.push({ id: newId(), kind: 'profile.update', input });
  await persist();
  emit();
}

async function dispatch(m: Mutation): Promise<void> {
  switch (m.kind) {
    case 'profile.update':
      await api.profile.update(m.input);
      break;
  }
}

let flushing = false;

/** Replays queued mutations in order; stops at the first failure so nothing runs
 *  out of order (the rest stay queued for the next reconnect). */
export async function flushQueue(): Promise<void> {
  await loadQueue();
  if (flushing || queue.length === 0) return;
  flushing = true;
  try {
    await withSync(async () => {
      while (queue.length > 0) {
        try {
          await dispatch(queue[0]);
        } catch {
          break;
        }
        queue.shift();
        await persist();
        emit();
      }
    });
  } finally {
    flushing = false;
  }
}

const subscribe = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const getCount = (): number => queue.length;

/** Reactive number of changes waiting to sync. */
export function usePendingCount(): number {
  return useSyncExternalStore(subscribe, getCount, getCount);
}
