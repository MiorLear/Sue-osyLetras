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

// The queue array is created once and never reassigned: `flushQueue` runs
// across awaits, and an enqueue landing mid-flush used to swap the reference
// out from under the in-flight loop (BUG-04), which then shifted an orphaned
// array — dropping or re-dispatching a change. Every mutation of the queue goes
// through the helpers below, which edit this same array in place.
const queue: Mutation[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

/** Replaces the queue contents without replacing the array reference. */
function replaceQueue(next: Mutation[]): void {
  queue.length = 0;
  queue.push(...next);
}

/** Drops every entry matching `pred`, in place. */
function removeWhere(pred: (m: Mutation) => boolean): void {
  for (let i = queue.length - 1; i >= 0; i -= 1) {
    if (pred(queue[i])) queue.splice(i, 1);
  }
}

/** Drops a single entry by its stable id, in place. */
function removeById(id: string): void {
  const i = queue.findIndex((m) => m.id === id);
  if (i >= 0) queue.splice(i, 1);
}

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
    replaceQueue(raw ? (JSON.parse(raw) as Mutation[]) : []);
  } catch {
    replaceQueue([]);
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
  removeWhere((m) => m.kind === 'profile.update');
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
    removeWhere(
      (m) =>
        (m.kind === 'event.create' && m.tempId === targetId) ||
        (m.kind === 'event.update' && m.targetId === targetId),
    );
  } else {
    removeWhere((m) => m.kind === 'event.update' && m.targetId === targetId);
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
 *  out of order (the rest stay queued for the next reconnect).
 *
 *  The pass walks a snapshot of stable ids and re-reads each entry by id right
 *  before dispatching it. Anything enqueued while the pass is in flight is left
 *  for the next one, and an entry that was cancelled or coalesced away
 *  meanwhile is simply skipped instead of being dispatched from a stale index. */
export async function flushQueue(): Promise<void> {
  await loadQueue();
  if (flushing || queue.length === 0) return;
  flushing = true;
  try {
    await withSync(async () => {
      const ids = queue.map((m) => m.id);
      for (const id of ids) {
        const mutation = queue.find((m) => m.id === id);
        if (!mutation) continue; // cancelled or merged away while we were awaiting
        try {
          await dispatch(mutation);
        } catch {
          return;
        }
        removeById(id);
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
