import { useCallback, useEffect, useState } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: unknown;
  reload: () => void;
}

/**
 * The state machine both async hooks are built on: the value, the loading and
 * error flags, and a nonce that `reload()` bumps to re-run the effect.
 *
 * Extracted so `useAsync` and `useOfflineAsync` share one implementation
 * instead of keeping two drifting copies of the same boilerplate — they differ
 * only in what their effect does, not in the state they keep.
 */
export function useAsyncMachine<T>() {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, setData, loading, setLoading, error, setError, nonce, reload };
}

// Runs an async loader on mount (and whenever `deps` change), tracking loading
// and error state so screens can render loading / empty / error UI instead of a
// blank screen plus an unhandled promise rejection.
//
// For read-only content that must survive a loss of connectivity, prefer
// useOfflineAsync — it serves the cache first and exposes the data's age.
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const { data, setData, loading, setLoading, error, setError, nonce, reload } =
    useAsyncMachine<T>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loader()
      .then((r) => {
        if (active) setData(r);
      })
      .catch((e) => {
        if (active) setError(e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, reload };
}
