import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Load data on mount / when deps change.
 *   reload()  → shows loading state (first load, after an action)
 *   refresh() → quiet background update, keeps what is on screen (polling)
 *
 * Stability rules:
 *   - only the newest request may write state (a slow old response never overwrites a newer one,
 *     e.g. switching tickets quickly, or a poll finishing after an action)
 *   - nothing is written after the component unmounts
 *   - data stays on screen while reloading (components show a skeleton only when data is null)
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const reload = useCallback(() => {
    const id = ++latest.current;
    const current = () => alive.current && id === latest.current;
    setLoading(true);
    setError(null);
    return run()
      .then((d) => {
        if (current()) setData(d);
      })
      .catch((e: Error) => {
        if (current()) setError(e);
      })
      .finally(() => {
        if (current()) setLoading(false);
      });
  }, [run]);

  const refresh = useCallback(() => {
    const id = latest.current; // a poll never beats a newer reload
    return run()
      .then((d) => {
        if (alive.current && id === latest.current) setData(d);
      })
      .catch(() => undefined);
  }, [run]);

  // New deps = a different resource: clear the old one so it never shows under the new id.
  useEffect(() => {
    setData(null);
    void reload();
  }, [reload]);

  return { data, error, loading, reload, refresh, setData };
}
