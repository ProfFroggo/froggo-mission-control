/**
 * useMemoizedValue - Deep memoization for complex objects
 * 
 * Prevents unnecessary re-renders by doing deep comparison of values.
 * Use for expensive computations that depend on complex objects.
 * 
 * Usage:
 *   const filteredTasks = useMemoizedValue(
 *     () => tasks.filter(t => t.status === status),
 *     [tasks, status]
 *   );
 */

import { useRef } from 'react';

/**
 * Deep equality check for objects and arrays
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  // Handle objects
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => deepEqual(a[key], b[key]));
  }

  return false;
}

/**
 * Memoize a computed value with deep comparison
 */
export function useMemoizedValue<T>(
  computeFn: () => T,
  deps: any[]
): T {
  const ref = useRef<{ deps: any[]; value: T } | null>(null);

  // Check if deps have changed (deep comparison)
  const depsChanged = !ref.current || !deepEqual(ref.current.deps, deps);

  // Recompute if deps changed
  if (depsChanged) {
    const value = computeFn();
    ref.current = { deps, value };
  }

  return ref.current!.value;
}

/**
 * Shallow equality check (faster for simple cases)
 */
function shallowEqual(a: any[], b: any[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
}

/**
 * Memoize with shallow comparison (faster)
 */
export function useShallowMemoizedValue<T>(
  computeFn: () => T,
  deps: any[]
): T {
  const ref = useRef<{ deps: any[]; value: T } | null>(null);

  const depsChanged = !ref.current || !shallowEqual(ref.current.deps, deps);

  if (depsChanged) {
    const value = computeFn();
    ref.current = { deps, value };
  }

  return ref.current!.value;
}

/**
 * Memoize an array transformation
 * Optimized for filtering/mapping large arrays
 */
export function useMemoizedArray<T, R>(
  array: T[],
  transformFn: (items: T[]) => R[],
  deps: any[] = []
): R[] {
  return useMemoizedValue(
    () => transformFn(array),
    [array.length, ...array.map(item => (item as any)?.id || item), ...deps]
  );
}

/**
 * Memoize object properties
 * Only recomputes when specific properties change
 */
export function useMemoizedObject<T extends Record<string, any>>(
  obj: T,
  keys: (keyof T)[]
): T {
  const selectedProps = keys.map(key => obj[key]);
  
  return useMemoizedValue(
    () => obj,
    selectedProps
  );
}

/**
 * Performance monitoring wrapper
 * Logs computation time when it exceeds threshold
 */
export function useMemoizedValueWithProfiling<T>(
  computeFn: () => T,
  deps: any[],
  label: string,
  thresholdMs: number = 10
): T {
  const ref = useRef<{ deps: any[]; value: T } | null>(null);

  const depsChanged = !ref.current || !deepEqual(ref.current.deps, deps);

  if (depsChanged) {
    const start = performance.now();
    const value = computeFn();
    const duration = performance.now() - start;

    if (duration > thresholdMs) {
      console.debug(
        `[Performance] ${label} took ${duration.toFixed(2)}ms (threshold: ${thresholdMs}ms)`
      );
    }

    ref.current = { deps, value };
  }

  return ref.current!.value;
}

export default useMemoizedValue;
