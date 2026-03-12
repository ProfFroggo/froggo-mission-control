// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * useMemoizedCallback - Stable callback references
 * 
 * Similar to useCallback but with deep comparison of dependencies.
 * Prevents unnecessary re-renders when callbacks are passed as props.
 * 
 * Usage:
 *   const handleClick = useMemoizedCallback(
 *     (id: string) => deleteTask(id),
 *     [deleteTask]
 *   );
 */

import { useRef, useCallback } from 'react';

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => deepEqual(a[key], b[key]));
  }

  return false;
}

/**
 * Memoize callback with deep comparison
 */
export function useMemoizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: any[]
): T {
  const ref = useRef<{ deps: any[]; callback: T } | null>(null);

  const depsChanged = !ref.current || !deepEqual(ref.current.deps, deps);

  if (depsChanged) {
    ref.current = { deps, callback };
  }

  return ref.current!.callback;
}

/**
 * Stable callback that never changes reference
 * Uses latest values via ref (useful for event handlers)
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const stableCallback = useRef(
    ((...args: any[]) => {
      return callbackRef.current(...args);
    }) as T
  ).current;

  return stableCallback;
}

/**
 * Debounced callback with stable reference
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(
    ((...args: any[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay]
  );
}

/**
 * Throttled callback with stable reference
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef<number>(0);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(
    ((...args: any[]) => {
      const now = Date.now();
      if (now - lastCallRef.current >= delay) {
        lastCallRef.current = now;
        callbackRef.current(...args);
      }
    }) as T,
    [delay]
  );
}

/**
 * Callback that runs only once (even if deps change)
 */
export function useOnceCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const hasRun = useRef(false);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(
    ((...args: any[]) => {
      if (!hasRun.current) {
        hasRun.current = true;
        return callbackRef.current(...args);
      }
    }) as T,
    []
  );
}

export default useMemoizedCallback;
