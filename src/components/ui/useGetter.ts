import { useCallback, useEffect, useRef } from 'react';

/**
 * A stable function that returns the latest `value`. Gesture handlers are built once but must see
 * fresh props and state; they call the getter at event time instead of closing over a ref.
 */
export function useGetter<T>(value: T): () => T {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return useCallback(() => ref.current, []);
}
