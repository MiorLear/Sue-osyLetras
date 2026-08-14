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
const FAILED_KEY = 'offline-mutations-failed-v1';

/** How many transient failures a single change is given before it is parked in
 *  the failed store. Roughly a day of reconnect attempts at the retry cadence. */
export const MAX_ATTEMPTS = 6;

/** `attempts` counts *transient* failures only; a permanent rejection parks the
 *  change immediately and an expired session doesn't count against it at all. */
interface Attempted {
  id: string;
  attempts?: number;
}

export type Mutation =
  | (Attempted & { kind: 'profile.update'; input: UpdateProfileInput })
  | (Attempted & { kind: 'event.create'; tempId: string; input: CreateEventInput })
  | (Attempted & { kind: 'event.update'; targetId: string; input: UpdateEventInput })
  | (Attempted & { kind: 'event.remove'; targetId: string })
  | (Attempted & { kind: 'post.create'; tempId: number; input: CreatePostInput })
  | (Attempted & { kind: 'post.like'; postId: number })
  | (Attempted & { kind: 'post.comment'; postId: number; input: CreateCommentInput });

/** A change the server will never accept, kept out of the queue so the rest can
 *  drain, and out of the pending count so the banner stops lying about it. */
export interface FailedMutation {
  mutation: Mutation;
  /** Short Spanish reason, shown to the user. */
  reason: string;
  status?: number;
  failedAt: number;
}

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

const failed: FailedMutation[] = [];

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    /* best-effort */
  }
}

async function persistFailed(): Promise<void> {
  try {
    await AsyncStorage.setItem(FAILED_KEY, JSON.stringify(failed));
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
  try {
    const raw = await AsyncStorage.getItem(FAILED_KEY);
    const stored = raw ? (JSON.parse(raw) as FailedMutation[]) : [];
    failed.length = 0;
    failed.push(...stored);
  } catch {
    failed.length = 0;
  }
  try {
    const raw = await AsyncStorage.getItem(ID_MAP_KEY);
    postIdMap = raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    postIdMap = {};
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

// --- Temp post ids --------------------------------------------------------
//
// A post created offline gets a placeholder id, and BUG-06 was that likes and
// comments could not attach to it: `enqueuePostLike/Comment` needed a real
// numeric id, so the screens special-cased pending posts and simply refused the
// interaction. Events sidestep this by folding edits into their pending create,
// but a like or a comment is not an edit of the post — it is a separate write
// that must land *after* the server assigns the id.
//
// So the queue keeps a temp→real map instead. Placeholder ids are minted above
// TEMP_POST_ID_FLOOR, which the server's sequence will never reach, so a temp id
// is recognisable on sight — in the queue, in a screen, and in a stored queue
// from an older version of the app.

const ID_MAP_KEY = 'offline-post-id-map-v1';
const TEMP_POST_ID_FLOOR = 1e12;
const ID_MAP_LIMIT = 200;

let postIdMap: Record<string, number> = {};

/** A placeholder id for a post created offline. */
export function newTempPostId(): number {
  return Date.now();
}

/** True for a placeholder id the server has never seen. */
export function isTempPostId(postId: number): boolean {
  return postId >= TEMP_POST_ID_FLOOR;
}

/** The server id for a post, if its create already synced; otherwise unchanged. */
export function resolvePostId(postId: number): number {
  return postIdMap[String(postId)] ?? postId;
}

async function persistIdMap(): Promise<void> {
  try {
    await AsyncStorage.setItem(ID_MAP_KEY, JSON.stringify(postIdMap));
  } catch {
    /* best-effort */
  }
}

/** Records the id the server assigned and rewrites everything still queued
 *  against the placeholder, so replay never dispatches a temp id. */
async function mapPostId(tempId: number, realId: number): Promise<void> {
  postIdMap[String(tempId)] = realId;
  // Temp ids are Date.now(), so the numeric key order is chronological: drop the
  // oldest entries once the map grows past its cap.
  const keys = Object.keys(postIdMap);
  if (keys.length > ID_MAP_LIMIT) {
    const keep = keys.map(Number).sort((a, b) => a - b).slice(-ID_MAP_LIMIT);
    postIdMap = Object.fromEntries(keep.map((k) => [String(k), postIdMap[String(k)]]));
  }
  for (const m of queue) {
    if ((m.kind === 'post.like' || m.kind === 'post.comment') && m.postId === tempId) {
      m.postId = realId;
    }
  }
  await persistIdMap();
}

/** Queue creating a post; tempId is the placeholder id shown until it syncs. */
export async function enqueuePostCreate(tempId: number, input: CreatePostInput): Promise<void> {
  await loadQueue();
  queue.push({ id: newId(), kind: 'post.create', tempId, input });
  await persist();
  emit();
}

/** Queue a like toggle. Works on a post created offline too: the placeholder id
 *  is rewritten once its create syncs. Two toggles cancel out (coalesced). */
export async function enqueuePostLike(postId: number): Promise<void> {
  await loadQueue();
  const target = resolvePostId(postId);
  const existingIdx = queue.findIndex((m) => m.kind === 'post.like' && m.postId === target);
  if (existingIdx >= 0) {
    queue.splice(existingIdx, 1); // like + unlike → no net change
  } else {
    queue.push({ id: newId(), kind: 'post.like', postId: target });
  }
  await persist();
  emit();
}

/** Queue a comment. Works on a post created offline too (see enqueuePostLike). */
export async function enqueuePostComment(postId: number, input: CreateCommentInput): Promise<void> {
  await loadQueue();
  queue.push({ id: newId(), kind: 'post.comment', postId: resolvePostId(postId), input });
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
    case 'post.create': {
      const created = await api.posts.create(m.input);
      // The moment the server assigns an id, everything queued against the
      // placeholder is rewritten — this is what lets a like or comment made
      // offline on an offline-created post replay correctly.
      if (typeof created?.id === 'number') await mapPostId(m.tempId, created.id);
      break;
    }
    case 'post.like':
      await api.posts.toggleLike(resolvePostId(m.postId));
      break;
    case 'post.comment':
      await api.posts.addComment(resolvePostId(m.postId), m.input);
      break;
  }
}

// --- Error classification -------------------------------------------------
//
// The outbox used to treat every failure the same: `catch { break }`. A change
// the server will never accept — a comment on a deleted post, a 403 from a
// revoked account — stopped the whole queue forever while the banner kept
// promising "N cambios se sincronizarán al reconectar" (BUG-03). Worse, a 401
// was indistinguishable from a network blip, so it retried into the login
// redirect on every pass. The verdicts below are the invariant to port:

type Verdict =
  /** Session is gone. Stop the pass, change nothing: the API client is already
   *  bouncing to login, and retrying would just loop through the redirect. */
  | 'session'
  /** Might work later (offline, timeout, rate limit, server error). Count an
   *  attempt and stop the pass so ordering is preserved. */
  | 'transient'
  /** The server will never accept this. Park it and keep draining the rest. */
  | 'permanent';

function statusOf(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : undefined;
}

function classify(error: unknown): Verdict {
  const status = statusOf(error);
  // No HTTP status at all: a fetch-level failure, i.e. the network. Retry.
  if (status === undefined) return 'transient';
  if (status === 401) return 'session';
  if (status === 408 || status === 429 || status >= 500) return 'transient';
  // Every other 4xx is a rejection of *this* payload — replaying it verbatim
  // cannot change the answer (400, 403, 404, 409, 410, 422, …).
  if (status >= 400) return 'permanent';
  return 'transient';
}

function reasonFor(status: number | undefined, exhausted: boolean): string {
  if (exhausted) return 'No se pudo sincronizar tras varios intentos.';
  switch (status) {
    case 403:
      return 'No tienes permiso para hacer este cambio.';
    case 404:
    case 410:
      return 'El contenido ya no existe.';
    case 409:
      return 'El contenido cambió en el servidor.';
    case 400:
    case 422:
      return 'El servidor rechazó el cambio.';
    default:
      return 'El servidor rechazó el cambio.';
  }
}

/** Moves a mutation out of the queue and into the failed store, in place.
 *
 *  If it is a post create, its queued likes and comments go with it: their
 *  placeholder id will never be mapped to a real one, so replaying them would
 *  only produce a stream of 404s against an id the server never issued. */
async function parkAsFailed(mutation: Mutation, status: number | undefined, exhausted: boolean): Promise<void> {
  const reason = reasonFor(status, exhausted);
  removeById(mutation.id);
  failed.push({ mutation, reason, status, failedAt: Date.now() });

  if (mutation.kind === 'post.create') {
    const orphans = queue.filter(
      (m) => (m.kind === 'post.like' || m.kind === 'post.comment') && m.postId === mutation.tempId,
    );
    for (const orphan of orphans) {
      removeById(orphan.id);
      failed.push({
        mutation: orphan,
        reason: 'La publicación no se pudo crear.',
        status,
        failedAt: Date.now(),
      });
    }
  }

  await persistFailed();
}

/** Changes that could not be synced and need the user to decide. */
export async function listFailedMutations(): Promise<FailedMutation[]> {
  await loadQueue();
  return failed.slice();
}

/** Discards the failed changes (the only action offered today: the local copy
 *  is already gone, so there is nothing to restore — see PWA-3.7 for retry/edit). */
export async function discardFailedMutations(): Promise<void> {
  await loadQueue();
  failed.length = 0;
  await persistFailed();
  emit();
}

let flushing = false;

/** Replays queued mutations in order.
 *
 *  The pass walks a snapshot of stable ids and re-reads each entry by id right
 *  before dispatching it. Anything enqueued while the pass is in flight is left
 *  for the next one, and an entry that was cancelled or coalesced away
 *  meanwhile is simply skipped instead of being dispatched from a stale index.
 *
 *  A retryable failure still stops the pass — the rest stay queued and in order
 *  for the next attempt — but a permanent one only takes its own mutation down
 *  with it, so one bad change can no longer wedge the outbox. */
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
        } catch (error) {
          const verdict = classify(error);
          if (verdict === 'session') return; // no attempt counted; retry after login
          if (verdict === 'transient') {
            mutation.attempts = (mutation.attempts ?? 0) + 1;
            if (mutation.attempts < MAX_ATTEMPTS) {
              await persist();
              emit();
              return; // stop here so the queue replays in order next time
            }
          }
          await parkAsFailed(mutation, statusOf(error), verdict === 'transient');
          await persist();
          emit();
          continue; // the rest of the queue is not this mutation's fault
        }
        removeById(id);
        await persist();
        emit();
      }
    });
  } finally {
    flushing = false;
    rescheduleRetry();
  }
}

// --- Retry ladder ---------------------------------------------------------
//
// The only flush trigger used to be the `online` flag flipping (BUG-07), so a
// device that booted already-connected with a pending queue never retried, and
// a transient server error stranded the outbox until the next connectivity
// change — which on a classroom tablet on stable Wi-Fi may never come.
//
// The invariant: while there is queued work, a flush is always scheduled. The
// timer lives here (pure JS, testable); the app-lifecycle triggers — app start,
// reconnect, return to foreground — are wired in src/app/_layout.tsx, since
// react-native's AppState must not leak into this module.

const BASE_RETRY_MS = 15_000;
const MAX_RETRY_MS = 5 * 60_000;

let autoFlush = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryStep = 0;

/** Exponential backoff, capped, with ±25% jitter so a classroom full of tablets
 *  coming back on the same Wi-Fi doesn't retry in lockstep. */
function nextRetryDelay(): number {
  const base = Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 2 ** retryStep);
  const jitter = base * 0.25 * (Math.random() * 2 - 1);
  return Math.max(1_000, Math.round(base + jitter));
}

function clearRetry(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

/** Called after every pass: arms the next attempt while work is pending, and
 *  stops the timer as soon as the queue drains. */
function rescheduleRetry(): void {
  if (!autoFlush) return;
  if (queue.length === 0) {
    retryStep = 0;
    clearRetry();
    return;
  }
  if (retryTimer) return;
  const delay = nextRetryDelay();
  retryStep = Math.min(retryStep + 1, 8);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flushQueue();
  }, delay);
}

/** Starts the retry ladder and flushes once immediately (the app-start trigger).
 *  Returns a stop function; call it on unmount. */
export function startOutboxRetries(): () => void {
  autoFlush = true;
  void flushQueue();
  return () => {
    autoFlush = false;
    retryStep = 0;
    clearRetry();
  };
}

/** A flush prompted by an app-lifecycle event (reconnect, foreground). Resets
 *  the backoff: the conditions changed, so the next failure starts over. */
export function flushQueueNow(): void {
  retryStep = 0;
  clearRetry();
  void flushQueue();
}

const subscribe = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const getCount = (): number => queue.length;
const getFailedCount = (): number => failed.length;

/** Reactive number of changes waiting to sync. */
export function usePendingCount(): number {
  return useSyncExternalStore(subscribe, getCount, getCount);
}

/** Reactive number of changes that could not be synced and need the user's call. */
export function useFailedCount(): number {
  return useSyncExternalStore(subscribe, getFailedCount, getFailedCount);
}
