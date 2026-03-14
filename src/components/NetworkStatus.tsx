// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * NetworkStatus - Shows a dismissible banner when the user is offline.
 * Uses useOnlineStatus hook for browser connectivity + SSE liveness signal.
 */

import { useState, useEffect } from 'react';
import { WifiOff, Wifi, X } from 'lucide-react';
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
      <div
        role="alert"
        aria-live="assertive"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '8px 16px',
          background: 'var(--warning, #d97706)',
          color: '#fff',
          fontSize: '14px',
          fontWeight: 500,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        <WifiOff size={16} aria-hidden />
        <span>No internet connection. Some features may be unavailable.</span>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss offline notification"
          style={{
            marginLeft: '8px',
            padding: '2px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            opacity: 0.8,
            lineHeight: 1,
          }}
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  if (showOnlineBriefly) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '8px 16px',
          background: 'var(--success, #16a34a)',
          color: '#fff',
          fontSize: '14px',
          fontWeight: 500,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        <Wifi size={16} aria-hidden />
        <span>Back online</span>
      </div>
    );
  }

  return null;
}
