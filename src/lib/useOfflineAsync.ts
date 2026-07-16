import { useCallback, useEffect, useState } from 'react';

import { readCache, writeCache } from '@/lib/offline-cache';
import { useIsOnline } from '@/lib/useNetworkStatus';
import type { AsyncState } from '@/lib/useAsync';

// Cache-first variant of useAsync for read-only content. On mount it returns the
// last cached value immediately (so screens render instantly, even offline),
// then — only when online — revalidates from the network and updates both the
// UI and the cache. A failed revalidation keeps the cached data (the error is
// surfaced only when there is nothing cached to show). Re-runs on reconnect.
export function useOfflineAsync<T>(
  cacheKey: string,
  loader: () => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> {
  const online = useIsOnline();
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      // 1. Cache-first: show stored content right away.
      const cached = await readCache<T>(cacheKey);
      let hasData = false;
      if (active && cached !== undefined) {
        setData(cached);
        hasData = true;
        setLoading(false);
      }

      // 2. Revalidate when online. (Not tied to the global "syncing" banner —
      // that reflects the background content sync in media-sync, so it doesn't
      // flash on every screen load.)
      if (online) {
        try {
          const fresh = await loader();
          if (!active) return;
          setData(fresh);
          hasData = true;
          setError(null);
          void writeCache(cacheKey, fresh);
        } catch (e) {
          if (active && !hasData) setError(e);
        }
      } else if (active && !hasData) {
        // Offline with nothing cached → let the screen show its retry/empty UI.
        setError(new Error('offline: no cached content'));
      }

      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, online, nonce, ...deps]);

  return { data, loading, error, reload };
}
