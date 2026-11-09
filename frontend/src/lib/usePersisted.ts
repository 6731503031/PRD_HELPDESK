import { useCallback, useState } from 'react';

/** useState that remembers its value in this browser (open/closed panels). Works without storage too. */
export function usePersisted(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(key);
      return saved === null ? initial : saved === '1';
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: boolean) => {
      setValue(v);
      try {
        window.localStorage.setItem(key, v ? '1' : '0');
      } catch {
        /* private mode — fine */
      }
    },
    [key],
  );
  return [value, set];
}
