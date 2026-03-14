// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// src/hooks/useOnlineStatus.ts
// Subscribes to browser online/offline events and returns current connectivity status.

import { useEffect, useState } from 'react';

/**
 * Returns `true` when the browser believes the network is reachable.
 * Subscribes to `window` online/offline events so the value stays current.
 *
 * The hook also accepts an optional `sseDisconnected` flag: if the SSE
 * connection drops while `navigator.onLine` is still true (e.g. server-side
 * outage) the hook will report offline as well.
 */
export function useOnlineStatus(sseDisconnected?: boolean): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sync with current value in case it changed between render and effect
    setOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // If SSE dropped we treat the connection as degraded/offline
  if (sseDisconnected && !online === false) {
    return false;
  }

  return online && !sseDisconnected;
}
