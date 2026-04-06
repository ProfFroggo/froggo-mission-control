// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Phase 82+88.4: SSE client hook — connects to /api/events and dispatches to handlers
// Replaces component-level polling as the primary update mechanism.

import { useEffect, useRef, useSyncExternalStore } from 'react';

type EventHandler = (data: unknown) => void;

// Module-level EventSource singleton — shared across all hook instances
let eventSource: EventSource | null = null;
const handlers = new Map<string, Set<EventHandler>>();

// Connection state tracking (Phase 88.4)
type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';
let connectionState: ConnectionState = 'disconnected';
const connectionListeners = new Set<() => void>();

function setConnectionState(state: ConnectionState) {
  if (connectionState !== state) {
    connectionState = state;
    connectionListeners.forEach(l => l());
  }
}

const EVENT_TYPES = [
  'connected',
  'task.created',
  'task.updated',
  'task.deleted',
  'agent.status',
  'inbox.count',
  'module.installed',
  'agent.updated',
  'circuit.open',
  'circuit.closed',
  'task.unblocked',
  'agent.hired',
  'automation.completed',
  'automation.failed',
  'notification.new',
  'clara.review_needed',
  'budget.alert',
  'budget.dispatch_blocked',
  'dispatch.auto_routed',
  'approval.created',
  'approval.updated',
];

function dispatchEvent(type: string, data: unknown) {
  handlers.get(type)?.forEach(h => {
    try { h(data); } catch (err) { console.warn('[useEventBus] Non-critical: event handler error:', err); }
  });
}

// Stable named listeners stored so they can be removed on reconnect,
// preventing listener accumulation on the EventSource singleton.
const namedListeners = new Map<string, (e: MessageEvent) => void>();

function attachListeners(es: EventSource): void {
  for (const type of EVENT_TYPES) {
    const listener = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        dispatchEvent(type, data);
      } catch (err) { console.warn('[useEventBus] Failed to parse SSE event data:', err); }
    };
    namedListeners.set(type, listener);
    es.addEventListener(type, listener);
  }
}

function detachListeners(es: EventSource): void {
  for (const [type, listener] of namedListeners) {
    es.removeEventListener(type, listener);
  }
  namedListeners.clear();
}

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connectEventSource(): EventSource {
  if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
    return eventSource;
  }

  // Remove stale listeners from the previous (closed) instance before replacing
  if (eventSource) {
    detachListeners(eventSource);
  }

  setConnectionState('reconnecting');
  eventSource = new EventSource('/api/events');
  attachListeners(eventSource);

  eventSource.onopen = () => {
    setConnectionState('connected');
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  eventSource.onerror = () => {
    if (eventSource?.readyState === EventSource.CLOSED) {
      setConnectionState('disconnected');
      // EventSource gave up — schedule manual reconnect
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connectEventSource();
        }, 5000);
      }
    } else {
      // CONNECTING state — EventSource is auto-reconnecting
      setConnectionState('reconnecting');
    }
  };

  return eventSource;
}

/**
 * Subscribe to a named SSE event. The handler is stable via ref — no stale closure risk.
 * @param eventType One of: task.created, task.updated, agent.status, inbox.count, connected
 * @param handler Called with parsed event data whenever the event fires
 */
export function useEventBus(eventType: string, handler: EventHandler) {
  const handlerRef = useRef<EventHandler>(handler);
  handlerRef.current = handler;

  useEffect(() => {
    // Stable wrapper — always calls the latest handler
    const stableHandler: EventHandler = (data) => handlerRef.current(data);

    if (!handlers.has(eventType)) {
      handlers.set(eventType, new Set());
    }
    handlers.get(eventType)!.add(stableHandler);

    // Connect (or reuse) EventSource
    if (typeof window !== 'undefined') {
      connectEventSource();
    }

    return () => {
      handlers.get(eventType)?.delete(stableHandler);
    };
  }, [eventType]); // eventType is stable by convention
}

/**
 * React hook: returns current SSE connection state ('connected' | 'reconnecting' | 'disconnected').
 * Uses useSyncExternalStore for tear-safe reads.
 */
export function useSSEConnectionState(): ConnectionState {
  return useSyncExternalStore(
    (cb) => { connectionListeners.add(cb); return () => { connectionListeners.delete(cb); }; },
    () => connectionState,
    () => 'disconnected' as ConnectionState, // server snapshot
  );
}
