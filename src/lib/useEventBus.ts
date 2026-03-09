// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Phase 82: SSE client hook — connects to /api/events and dispatches to handlers
// Replaces component-level polling as the primary update mechanism.

import { useEffect, useRef } from 'react';

type EventHandler = (data: unknown) => void;

// Module-level EventSource singleton — shared across all hook instances
let eventSource: EventSource | null = null;
const handlers = new Map<string, Set<EventHandler>>();

const EVENT_TYPES = [
  'connected',
  'task.created',
  'task.updated',
  'agent.status',
  'inbox.count',
];

function dispatchEvent(type: string, data: unknown) {
  handlers.get(type)?.forEach(h => {
    try { h(data); } catch { /* non-fatal */ }
  });
}

function connectEventSource(): EventSource {
  if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
    return eventSource;
  }

  eventSource = new EventSource('/api/events');

  // Named event handlers for each registered event type
  for (const type of EVENT_TYPES) {
    eventSource.addEventListener(type, (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        dispatchEvent(type, data);
      } catch { /* ignore parse errors */ }
    });
  }

  eventSource.onerror = () => {
    // EventSource auto-reconnects — no manual retry needed
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
