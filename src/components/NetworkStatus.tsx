// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * NetworkStatus - Shows a dismissible banner when the user is offline.
 * Uses useOnlineStatus hook for browser connectivity + SSE liveness signal.
 */

import { useState, useEffect } from 'react';
import { WifiOff, Wifi, X } from 'lucide-react';
import { Flex } from '@radix-ui/themes';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useEventBus } from '../lib/useEventBus';

export default function NetworkStatus() {
  const online = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);
  const [showOnlineBriefly, setShowOnlineBriefly] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // Track SSE connection liveness: when SSE reconnects, reset any dismissed state
  useEventBus('connected', () => {
    // SSE reconnected — if we were dismissed due to offline, allow banner to re-show
    if (wasOffline) {
      setDismissed(false);
    }
  });

  useEffect(() => {
    if (!online && !wasOffline) {
      // Just went offline
      setWasOffline(true);
      setDismissed(false);
      setShowOnlineBriefly(false);
    } else if (online && wasOffline) {
      // Just came back online
      setWasOffline(false);
      setDismissed(false);
      setShowOnlineBriefly(true);
      const id = setTimeout(() => setShowOnlineBriefly(false), 3000);
      return () => clearTimeout(id);
    }
  }, [online, wasOffline]);

  if (!online && !dismissed) {
    return (
      <Flex
        align="center"
        justify="center"
        gap="2"
        px="4"
        py="2"
        role="alert"
        aria-live="assertive"
        className="fixed top-0 left-0 right-0 z-[100] text-white text-sm font-medium shadow-md"
        style={{ background: 'var(--color-warning)' }}
      >
        <WifiOff size={16} aria-hidden />
        <span>No internet connection. Some features may be unavailable.</span>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss offline notification"
          className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded text-white opacity-80 hover:opacity-100 transition-opacity"
        >
          <X size={16} />
        </button>
      </Flex>
    );
  }

  if (showOnlineBriefly) {
    return (
      <Flex
        align="center"
        justify="center"
        gap="2"
        px="4"
        py="2"
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-[100] text-white text-sm font-medium shadow-md"
        style={{ background: 'var(--color-success)' }}
      >
        <Wifi size={16} aria-hidden />
        <span>Back online</span>
      </Flex>
    );
  }

  return null;
}
