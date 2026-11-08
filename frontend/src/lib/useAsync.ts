import { useCallback, useEffect, useState } from 'react';

/**
 * Load data on mount / when deps change.
 *   reload()  → shows loading state (first load, after an action)
 *   refresh() → quiet background update, keeps what is on screen (polling)
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    return run()
      .then((d) => setData(d))
      .catch((e: Error) => setError(e))
      .finally(() => setLoading(false));
  }, [run]);

  const refresh = useCallback(
    () =>
      run()
        .then((d) => setData(d))
        .catch(() => undefined),
    [run],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, refresh, setData };
}
