import { useEffect, useState } from 'react';

import { readCacheEntry, writeCache } from '@/lib/offline-cache';
import {
  OfflineEmptyError,
  SessionExpiredError,
  classifyError,
  reportDeadSession,
} from '@/lib/offline-errors';
import { useAsyncMachine, type AsyncState } from '@/lib/useAsync';
import { useIsOnline } from '@/lib/useNetworkStatus';

// Cache-first read hook: the core pattern for every content screen. On mount it
// returns the last cached value immediately (so screens render instantly, even
// offline), then — only when online — revalidates from the network and updates
// both the UI and the cache. A failed revalidation keeps the cached data.
// Re-runs on reconnect.
//
// This lives in the page, on IndexedDB, keyed by user id. It can never move
// into the service worker: every API GET is Bearer-scoped and Spring sends no
// `Vary: Authorization`, so a URL-keyed SW route would serve one teacher's
// response to the next on a shared tablet.
//
// Two fixes over the RN original (BUG-09):
//   1. `fetchedAt`/`ageMs`/`isStale` — the cache never expired, so month-old
//      data was presented as current with nothing to tell the user otherwise.
//   2. `status` and typed errors — "offline with nothing cached" and a genuine
//      failure both surfaced as the same anonymous Error, so screens could not
//      choose the right message. They are now distinguishable without parsing
//      a string.

/** Default staleness threshold: a day-old response is worth flagging. */
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type OfflineStatus =
  | 'loading'
  | 'fresh'
  | 'stale'
  | 'empty'
  | 'offline-empty'
  | 'session-expired'
  | 'error';

export interface OfflineAsyncState<T> extends AsyncState<T> {
  /** When the data currently on screen came off the network, epoch ms. */
  fetchedAt: number | undefined;
  /** How old that data is, ms. undefined when there is no data. */
  ageMs: number | undefined;
  /** True when `ageMs` exceeds `maxAgeMs` — show the age to the user. */
  isStale: boolean;
  /** True while the value on screen came from the cache, not this render's fetch. */
  fromCache: boolean;
  /** One flag screens can switch on instead of unpicking data/loading/error. */
  status: OfflineStatus;
}

export interface OfflineAsyncOptions {
  /** Age past which data is reported stale. Default 24h. */
  maxAgeMs?: number;
  /**
   * Age past which cached data is not shown at all while offline. Default
   * Infinity: showing something old beats showing nothing, as long as the
   * screen says how old it is.
   */
  hardMaxAgeMs?: number;
  /** Skip the cache write (e.g. responses too large or too personal to keep). */
  noStore?: boolean;
}

export function useOfflineAsync<T>(
  cacheKey: string,
  loader: () => Promise<T>,
  deps: unknown[] = [],
  options: OfflineAsyncOptions = {},
): OfflineAsyncState<T> {
  const { maxAgeMs = DEFAULT_MAX_AGE_MS, hardMaxAgeMs = Infinity, noStore = false } = options;

  const online = useIsOnline();
  const { data, setData, loading, setLoading, error, setError, nonce, reload } =
    useAsyncMachine<T>();
  const [fetchedAt, setFetchedAt] = useState<number | undefined>(undefined);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      // 1. Cache-first: show stored content right away.
      const cached = await readCacheEntry<T>(cacheKey);
      let hasData = false;

      if (cached !== undefined) {
        const tooOld = Date.now() - cached.fetchedAt > hardMaxAgeMs;
        if (active && !tooOld) {
          setData(cached.data);
          setFetchedAt(cached.fetchedAt);
          setFromCache(true);
          hasData = true;
          setLoading(false);
        }
      }

      // 2. Revalidate when online. (Not tied to the global "syncing" banner —
      // that reflects the background content sync, so it doesn't flash on
      // every screen load.)
      if (online) {
        try {
          const fresh = await loader();
          if (!active) return;
          setData(fresh);
          setFetchedAt(Date.now());
          setFromCache(false);
          hasData = true;
          setError(null);
          if (!noStore) void writeCache(cacheKey, fresh);
        } catch (e) {
          const kind = classifyError(e);

          if (kind.fatalToSession) {
            // A 403 on any endpoint means this session is over: the account was
            // rejected or the token revoked. The opposite of a network failure
            // — retrying is pointless, and keeping this user's cached data on a
            // shared tablet is the leak the namespacing exists to prevent. Drop
            // what is on screen, purge, and let the auth layer send them out.
            if (active) {
              setData(undefined);
              setFetchedAt(undefined);
              setFromCache(false);
              setError(new SessionExpiredError(kind.detail ?? 'session expired', kind.detail));
            }
            void reportDeadSession(kind.detail);
          } else if (active && !hasData) {
            // Nothing cached to fall back on, so the screen has to show it.
            setError(e);
          }
          // With cached data in hand a failed revalidation is silent: the user
          // keeps reading, and `isStale`/`ageMs` say how old it is.
        }
      } else if (active && !hasData) {
        // Offline with nothing cached. An empty state, not a failure — and now
        // typed, so the screen can say "sin conexión" instead of "algo salió
        // mal". The message is preserved for callers that still match on it.
        setError(new OfflineEmptyError());
      }

      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, online, nonce, ...deps]);

  const ageMs = fetchedAt === undefined ? undefined : Math.max(0, Date.now() - fetchedAt);
  const isStale = ageMs !== undefined && ageMs > maxAgeMs;

  return {
    data,
    loading,
    error,
    reload,
    fetchedAt,
    ageMs,
    isStale,
    fromCache,
    status: deriveStatus({ loading, error, hasData: data !== undefined, isStale }),
  };
}

function deriveStatus(input: {
  loading: boolean;
  error: unknown;
  hasData: boolean;
  isStale: boolean;
}): OfflineStatus {
  if (input.loading) return 'loading';
  if (input.error instanceof SessionExpiredError) return 'session-expired';
  if (input.error instanceof OfflineEmptyError) return 'offline-empty';
  if (input.error) return 'error';
  if (!input.hasData) return 'empty';
  return input.isStale ? 'stale' : 'fresh';
}

/**
 * Formats a cache age for the UI, so every screen phrases staleness the same
 * way. Returns null when the data is fresh enough not to mention.
 */
export function formatCacheAge(ageMs: number | undefined): string | null {
  if (ageMs === undefined) return null;
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'hace 1 día' : `hace ${days} días`;
}
