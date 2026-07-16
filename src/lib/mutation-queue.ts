import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type {
  CreateCommentInput,
  CreateEventInput,
  CreatePostInput,
  UpdateEventInput,
  UpdateProfileInput,
} from '@explorarte/shared';
import { api } from '@/lib/api';
import { withSync } from '@/lib/sync-status';

// Offline write queue: changes made without connection are persisted here and
// replayed, in order, when the device comes back online. Covers profile edits
// and calendar events. Event ops targeting an offline-created event (temp id)
// are coalesced into that create, so we never replay an update/remove against
// an id the server hasn't assigned yet (no id remapping needed).

const KEY = 'offline-mutations-v1';

export type Mutation =
  | { id: string; kind: 'profile.update'; input: UpdateProfileInput }
  | { id: string; kind: 'event.create'; tempId: string; input: CreateEventInput }
  | { id: string; kind: 'event.update'; targetId: string; input: UpdateEventInput }
  | { id: string; kind: 'event.remove'; targetId: string }
  | { id: string; kind: 'post.create'; tempId: number; input: CreatePostInput }
  | { id: string; kind: 'post.like'; postId: number }
  | { id: string; kind: 'post.comment'; postId: number; input: CreateCommentInput };

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

/** Queue creating a new event; tempId is the placeholder id shown in the UI meanwhile. */
export async function enqueueEventCreate(tempId: string, input: CreateEventInput): Promise<void> {
  await loadQueue();
  queue.push({ id: newId(), kind: 'event.create', tempId, input });
  await persist();
  emit();
}

/** Queue an event edit. If it targets an offline-created event, the edit is folded
 *  into that pending create; consecutive edits to the same event are merged. */
export async function enqueueEventUpdate(targetId: string, input: UpdateEventInput): Promise<void> {
  await loadQueue();
  const create = queue.find(
    (m): m is Extract<Mutation, { kind: 'event.create' }> => m.kind === 'event.create' && m.tempId === targetId,
  );
  if (create) {
    create.input = { ...create.input, ...input };
  } else {
    const pendingUpdate = queue.find(
      (m): m is Extract<Mutation, { kind: 'event.update' }> => m.kind === 'event.update' && m.targetId === targetId,
    );
    if (pendingUpdate) {
      pendingUpdate.input = { ...pendingUpdate.input, ...input };
    } else {
      queue.push({ id: newId(), kind: 'event.update', targetId, input });
    }
  }
  await persist();
  emit();
}

/** Queue removing an event. If it's an offline-created event, cancel its create
 *  (and any pending edits) instead of queueing a remove for a non-existent id. */
export async function enqueueEventRemove(targetId: string): Promise<void> {
  await loadQueue();
  const hadCreate = queue.some((m) => m.kind === 'event.create' && m.tempId === targetId);
  if (hadCreate) {
    queue = queue.filter(
      (m) =>
        !(m.kind === 'event.create' && m.tempId === targetId) &&
        !(m.kind === 'event.update' && m.targetId === targetId),
    );
  } else {
    queue = queue.filter((m) => !(m.kind === 'event.update' && m.targetId === targetId));
    queue.push({ id: newId(), kind: 'event.remove', targetId });
  }
  await persist();
  emit();
}

/** Queue creating a post; tempId is the placeholder id shown until it syncs. */
export async function enqueuePostCreate(tempId: number, input: CreatePostInput): Promise<void> {
  await loadQueue();
  queue.push({ id: newId(), kind: 'post.create', tempId, input });
  await persist();
  emit();
}

/** Queue a like toggle for a synced post. Two toggles cancel out (coalesced). */
export async function enqueuePostLike(postId: number): Promise<void> {
  await loadQueue();
  const existingIdx = queue.findIndex((m) => m.kind === 'post.like' && m.postId === postId);
  if (existingIdx >= 0) {
    queue.splice(existingIdx, 1); // like + unlike → no net change
  } else {
    queue.push({ id: newId(), kind: 'post.like', postId });
  }
  await persist();
  emit();
}

/** Queue a comment on a synced post. */
export async function enqueuePostComment(postId: number, input: CreateCommentInput): Promise<void> {
  await loadQueue();
  queue.push({ id: newId(), kind: 'post.comment', postId, input });
  await persist();
  emit();
}

async function dispatch(m: Mutation): Promise<void> {
  switch (m.kind) {
    case 'profile.update':
      await api.profile.update(m.input);
      break;
    case 'event.create':
      await api.events.create(m.input);
      break;
    case 'event.update':
      await api.events.update(m.targetId, m.input);
      break;
    case 'event.remove':
      await api.events.remove(m.targetId);
      break;
    case 'post.create':
      await api.posts.create(m.input);
      break;
    case 'post.like':
      await api.posts.toggleLike(m.postId);
      break;
    case 'post.comment':
      await api.posts.addComment(m.postId, m.input);
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
