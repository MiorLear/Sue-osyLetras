import {
  ANONYMOUS_SCOPE,
  STORES,
  clearAllUserData,
  getAllByUser,
  getRecord,
  isIdbAvailable,
  putRecord,
  scopedKey,
  withTx,
  type ApiCacheRecord,
} from '@/lib/idb';

// Persists API JSON responses so screens can render offline. The web port of
// src/lib/offline-cache.ts, moved from a flat AsyncStorage keyspace onto
// IndexedDB — and, crucially, namespaced per user.
//
// THE NAMESPACING IS NOT OPTIONAL. These are shared classroom tablets. The RN
// version's keyspace was flat, so the next teacher to open the app on the same
// device would have been served the previous one's cached profile, posts and
// admin lists. Every key here is scopedKey(userId, cacheKey), so a read on
// behalf of one user physically cannot reach another's row.
//
// This is also why cache-first reads live in the page and never in the service
// worker: every API GET carries `Authorization: Bearer` and Spring sends no
// `Vary: Authorization`, so a URL-keyed Workbox route would hand one teacher's
// response to the next. The SW only ever routes public media.
//
// Every entry records `fetchedAt` so callers can show the data's age and decide
// whether it is too stale to present as current (BUG-09).

/** Explicit override, set by the auth layer on sign-in/sign-out. */
let currentUser: string | null = null;

/** Where AuthContext persists the signed-in profile. */
const USER_KEY = 'explorarte_user';

/**
 * The scope every key is written under. Falls back to the persisted profile so
 * the cache is correctly namespaced from the very first read after a reload,
 * before any React provider has had a chance to call setCacheUser().
 *
 * Anonymous (pre-login) traffic gets its own scope rather than sharing one, so
 * public content fetched on the login screen is never attributed to whoever
 * logs in next.
 */
export function getCacheUser(): string {
  if (currentUser) return currentUser;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return ANONYMOUS_SCOPE;
    const parsed = JSON.parse(raw) as { id?: string | number } | null;
    const id = parsed?.id;
    return id === undefined || id === null || id === '' ? ANONYMOUS_SCOPE : String(id);
  } catch {
    return ANONYMOUS_SCOPE;
  }
}

/** Called on sign-in (with the user id) and on sign-out (with null). */
export function setCacheUser(userId: string | null): void {
  currentUser = userId && userId.length > 0 ? userId : null;
}

export interface CacheEntry<T> {
  data: T;
  /** Epoch ms at which this response came off the network. */
  fetchedAt: number;
}

/** Reads the raw entry, including when it was fetched. */
export async function readCacheEntry<T>(key: string): Promise<CacheEntry<T> | undefined> {
  if (!isIdbAvailable()) return undefined;
  try {
    const userId = getCacheUser();
    const row = await getRecord<ApiCacheRecord>(STORES.apiCache, scopedKey(userId, key));
    // Defensive: a row can only be reached through its own user's composite
    // key, but never serve one whose stored owner disagrees.
    if (!row || row.userId !== userId) return undefined;
    return { data: row.data as T, fetchedAt: row.fetchedAt };
  } catch {
    return undefined;
  }
}

/** Cached value for `key`, or undefined. Same signature as the RN version. */
export async function readCache<T>(key: string): Promise<T | undefined> {
  return (await readCacheEntry<T>(key))?.data;
}

/**
 * Best-effort write. A quota error, a closed database or a value that structured
 * clone rejects must never break the screen that just rendered fine — the cache
 * is an optimisation, the network response is already in hand.
 */
export async function writeCache<T>(key: string, data: T): Promise<void> {
  if (!isIdbAvailable()) return;
  try {
    const userId = getCacheUser();
    const record: ApiCacheRecord = {
      id: scopedKey(userId, key),
      userId,
      cacheKey: key,
      data,
      fetchedAt: Date.now(),
    };
    await putRecord(STORES.apiCache, record);
  } catch {
    // Ignore quota / clone / connection errors.
  }
}

/** Drops a single entry for the current user. */
export async function removeCache(key: string): Promise<void> {
  if (!isIdbAvailable()) return;
  try {
    const id = scopedKey(getCacheUser(), key);
    await withTx(STORES.apiCache, 'readwrite', (tx) => {
      tx.objectStore(STORES.apiCache).delete(id);
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Every cached response for the current user, keyed by cacheKey — lets the
 * media sync gather every MediaItem the app knows about without re-hitting the
 * network. Scoped like everything else: it never leaks another user's rows.
 */
export async function readAllCached(): Promise<Record<string, unknown>> {
  if (!isIdbAvailable()) return {};
  try {
    const userId = getCacheUser();
    const rows = await getAllByUser<ApiCacheRecord>(STORES.apiCache, userId);
    const out: Record<string, unknown> = {};
    for (const row of rows) out[row.cacheKey] = row.data;
    return out;
  } catch {
    return {};
  }
}

/** Same, but with the fetch timestamps kept. */
export async function readAllCachedEntries(): Promise<Record<string, CacheEntry<unknown>>> {
  if (!isIdbAvailable()) return {};
  try {
    const rows = await getAllByUser<ApiCacheRecord>(STORES.apiCache, getCacheUser());
    const out: Record<string, CacheEntry<unknown>> = {};
    for (const row of rows) out[row.cacheKey] = { data: row.data, fetchedAt: row.fetchedAt };
    return out;
  } catch {
    return {};
  }
}

/**
 * Logout: removes every entry belonging to `userId` (the current user by
 * default) across every user-scoped store, so the next teacher to pick up the
 * tablet starts from nothing.
 */
export async function clearUserCache(userId: string = getCacheUser()): Promise<void> {
  if (!isIdbAvailable()) return;
  try {
    await clearAllUserData(userId);
  } catch {
    /* best-effort */
  }
}

/** Age of a cached entry in ms, or undefined if it isn't cached. */
export async function cacheAge(key: string): Promise<number | undefined> {
  const entry = await readCacheEntry(key);
  return entry ? Math.max(0, Date.now() - entry.fetchedAt) : undefined;
}
