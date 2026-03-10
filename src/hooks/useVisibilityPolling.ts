import { useEffect, useRef, useCallback } from 'react';

/**
 * Runs `callback` every `intervalMs`, but pauses when the page tab is hidden.
 * Immediately fires on tab visibility restore.
 * Replaces direct setInterval usage for polling hooks.
 */
export function useVisibilityPolling(
  callback: () => void,
  intervalMs: number,
  enabled: boolean = true
): void {
  const callbackRef = useRef(callback);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Always keep ref current so interval never captures stale closure
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const start = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      if (!document.hidden) {
        callbackRef.current();
      }
    }, intervalMs);
  }, [intervalMs]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) { stop(); return; }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        callbackRef.current(); // immediate refresh on return
        start();
      }
    };

    if (!document.hidden) {
      start();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, start, stop]);
}
