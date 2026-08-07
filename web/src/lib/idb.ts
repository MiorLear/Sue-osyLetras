// IndexedDB: the single storage substrate for every piece of offline state the
// PWA keeps. It replaces the RN app's AsyncStorage (which on the web is
// localStorage — ~5MB, synchronous, string-only, shared with the auth token,
// and completely invisible to a service worker, so Background Sync replay could
// never read the outbox from there).
//
// The schema is designed for the whole offline stack, not only for what phase 2
// needs today:
//
//   apiCache   — JSON responses that feed cache-first reads (PWA-2.4)
//   mediaIndex — metadata for downloaded media files (phase 4)
//   outbox     — the offline write queue, replayed in order (phase 3)
//   deadLetter — mutations that exhausted their retries (phase 3)
//   idMap      — temp client id -> server id, once a queued create lands (phase 3)
//   meta       — small key/value app state (last sync, install prompts, ...)
//
// USER SCOPING IS A SECURITY PROPERTY, NOT AN OPTIMISATION. These are shared
// classroom tablets: every user-scoped record carries `userId` and lives under
// a composite primary key that starts with it, so one teacher can never read
// another's cached content, and logout can wipe exactly one user's rows.
//
// mediaIndex is intentionally NOT user-scoped: media is public and
// unauthenticated (it is the only thing the service worker is allowed to
// route), so sharing one download between the teachers of a tablet is both
// safe and the whole point.

export const DB_NAME = 'explorarte-offline';
export const DB_VERSION = 1;

export const STORES = {
  apiCache: 'apiCache',
  mediaIndex: 'mediaIndex',
  outbox: 'outbox',
  deadLetter: 'deadLetter',
  idMap: 'idMap',
  meta: 'meta',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

/** Stores whose rows belong to one user and must disappear when they log out. */
export const USER_SCOPED_STORES: StoreName[] = [
  STORES.apiCache,
  STORES.outbox,
  STORES.deadLetter,
  STORES.idMap,
  STORES.meta,
];

/** Scope used before anyone logs in. Never collides with a real user id
 *  because a server id can't contain the separator below. */
export const ANONYMOUS_SCOPE = '@anonymous';

/** Separator for composite keys. U+0001 cannot appear in a user id or a cache
 *  key, so `scopedKey` is injective and no crafted key can escape its scope. */
const SEP = '\u0001';

/** Composite primary key: the user id always comes first, so an
 *  IDBKeyRange.bound() over `${userId}${SEP}` selects exactly one user's rows
 *  even without touching an index. */
export function scopedKey(userId: string, key: string): string {
  return `${userId}${SEP}${key}`;
}

/** Inverse of `scopedKey`. Returns null if the stored key is malformed. */
export function unscopeKey(composite: string): { userId: string; key: string } | null {
  const at = composite.indexOf(SEP);
  if (at < 0) return null;
  return { userId: composite.slice(0, at), key: composite.slice(at + SEP.length) };
}

/** Range covering every composite key belonging to `userId`. */
export function userKeyRange(userId: string): IDBKeyRange {
  const prefix = userId + SEP;
  return IDBKeyRange.bound(prefix, prefix + '\uffff', false, false);
}

// ── record shapes ────────────────────────────────────────────────────────────

/** A cached API response. `fetchedAt` is what lets the UI show the data's age
 *  and lets callers decide whether it is too stale to trust (BUG-09). */
export interface ApiCacheRecord {
  /** scopedKey(userId, cacheKey) */
  id: string;
  userId: string;
  cacheKey: string;
  data: unknown;
  fetchedAt: number;
}

/** A media file downloaded for offline playback. Not user-scoped on purpose. */
export interface MediaIndexRecord {
  id: string;
  url: string;
  /** Opaque version/ETag/size used to decide whether to re-download. */
  version?: string;
  sizeBytes: number;
  mimeType?: string;
  downloadedAt: number;
  /** Where the bytes live: a Cache Storage key, or an IDB blob key. */
  blobRef?: string;
}

export type OutboxStatus = 'pending' | 'inflight' | 'failed';

/** A mutation made offline, waiting to be replayed. `seq` is auto-incremented
 *  so the queue keeps a total order without storing an explicit index. */
export interface OutboxRecord {
  seq?: number;
  /** Client-generated stable id (the one screens optimistically render). */
  id: string;
  userId: string;
  kind: string;
  payload: unknown;
  createdAt: number;
  attempts: number;
  /** Foreground replay ladder: don't retry before this timestamp. */
  nextAttemptAt: number;
  status: OutboxStatus;
  lastError?: string;
}

/** A mutation that will never be replayed, kept so the user can be told. */
export interface DeadLetterRecord extends Omit<OutboxRecord, 'seq' | 'status'> {
  seq?: number;
  failedAt: number;
  reason: string;
}

/** temp id -> server id, so later queued ops can be rewritten before replay. */
export interface IdMapRecord {
  /** scopedKey(userId, tempId) */
  id: string;
  userId: string;
  tempId: string;
  entity: string;
  serverId: string;
  mappedAt: number;
}

/** Small key/value slots. `userId` may be ANONYMOUS_SCOPE for device-wide
 *  settings that must survive a logout. */
export interface MetaRecord {
  /** scopedKey(userId, name) */
  id: string;
  userId: string;
  name: string;
  value: unknown;
  updatedAt: number;
}

// ── connection ───────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Versioned upgrade path. Every future migration adds a `case` and falls
 * through, so a tablet that skipped three releases still lands on the current
 * schema in a single open().
 */
function upgrade(db: IDBDatabase, oldVersion: number): void {
  switch (oldVersion) {
    case 0: {
      const apiCache = db.createObjectStore(STORES.apiCache, { keyPath: 'id' });
      apiCache.createIndex('by-user', 'userId');
      apiCache.createIndex('by-fetchedAt', 'fetchedAt');

      const mediaIndex = db.createObjectStore(STORES.mediaIndex, { keyPath: 'id' });
      mediaIndex.createIndex('by-url', 'url');

      const outbox = db.createObjectStore(STORES.outbox, { keyPath: 'seq', autoIncrement: true });
      outbox.createIndex('by-user', 'userId');
      outbox.createIndex('by-id', 'id', { unique: true });
      outbox.createIndex('by-nextAttemptAt', 'nextAttemptAt');

      const deadLetter = db.createObjectStore(STORES.deadLetter, {
        keyPath: 'seq',
        autoIncrement: true,
      });
      deadLetter.createIndex('by-user', 'userId');

      const idMap = db.createObjectStore(STORES.idMap, { keyPath: 'id' });
      idMap.createIndex('by-user', 'userId');

      const meta = db.createObjectStore(STORES.meta, { keyPath: 'id' });
      meta.createIndex('by-user', 'userId');
    }
    // falls through — next release adds `case 1:` here.
  }
}

/** Opens (and memoises) the database. */
export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => upgrade(request.result, event.oldVersion);
    request.onsuccess = () => {
      const db = request.result;
      // Another tab asked for a newer schema: let go so it isn't blocked, and
      // force the next call to reopen.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
    request.onblocked = () => {
      dbPromise = null;
      reject(new Error('IndexedDB upgrade blocked by another tab'));
    };
  });
  return dbPromise;
}

/** Test/logout hook: drops the memoised handle so the next open() reconnects. */
export function closeDb(): void {
  const pending = dbPromise;
  dbPromise = null;
  void pending?.then((db) => db.close()).catch(() => undefined);
}

/**
 * Runs `body` inside a transaction and resolves only once the transaction has
 * actually committed — awaiting the individual requests is not enough, because
 * a commit can still fail on quota.
 */
export async function withTx<T>(
  stores: StoreName | StoreName[],
  mode: IDBTransactionMode,
  body: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(stores, mode);
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
  });
  let result: T;
  try {
    result = await body(tx);
  } catch (err) {
    // Without this an exception inside `body` would leave `done` pending
    // forever, hanging every caller.
    try {
      tx.abort();
    } catch {
      /* already finished */
    }
    await done.catch(() => undefined);
    throw err;
  }
  await done;
  return result;
}

export const req = promisify;

// ── generic helpers, used by every offline module ────────────────────────────

export async function getRecord<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  return withTx(store, 'readonly', (tx) => promisify<T | undefined>(tx.objectStore(store).get(key)));
}

export async function putRecord<T>(store: StoreName, value: T): Promise<void> {
  await withTx(store, 'readwrite', (tx) => promisify(tx.objectStore(store).put(value)));
}

export async function deleteRecord(store: StoreName, key: IDBValidKey): Promise<void> {
  await withTx(store, 'readwrite', (tx) => promisify(tx.objectStore(store).delete(key)));
}

/** Every record of `store` belonging to `userId`, via the `by-user` index. */
export async function getAllByUser<T>(store: StoreName, userId: string): Promise<T[]> {
  return withTx(store, 'readonly', (tx) =>
    promisify<T[]>(tx.objectStore(store).index('by-user').getAll(IDBKeyRange.only(userId))),
  );
}

/**
 * Wipes every user-scoped store for one user in a single transaction: it either
 * all disappears or nothing does, so a logout can't leave half a teacher's data
 * on a shared tablet. mediaIndex is left alone (public bytes, see header).
 *
 * Deleting by primary key (looked up through `by-user`) is the one code path
 * that works for both the composite-key stores and the autoIncrement ones.
 */
export async function clearAllUserData(userId: string): Promise<void> {
  await withTx(USER_SCOPED_STORES, 'readwrite', async (tx) => {
    const only = IDBKeyRange.only(userId);
    // Every lookup is issued synchronously, before the first await, so the
    // transaction cannot auto-commit halfway through the wipe.
    const lookups = USER_SCOPED_STORES.map((store) => ({
      store,
      keys: promisify<IDBValidKey[]>(tx.objectStore(store).index('by-user').getAllKeys(only)),
    }));
    for (const { store, keys } of lookups) {
      for (const key of await keys) tx.objectStore(store).delete(key);
    }
  });
}

/** Nukes every store, including media. For "forget this device" / test resets. */
export async function clearEverything(): Promise<void> {
  const stores = Object.values(STORES) as StoreName[];
  await withTx(stores, 'readwrite', (tx) => {
    for (const store of stores) tx.objectStore(store).clear();
  });
}

/** True when IndexedDB is usable at all (private-mode Firefox, old browsers). */
export function isIdbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}
