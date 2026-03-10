// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Phase 82: In-process SSE event emitter singleton
// Used by API routes to push events to all connected SSE clients.

import { EventEmitter } from 'events';

declare global {
  // eslint-disable-next-line no-var
  var __sseEmitter: EventEmitter | undefined;
}

// Singleton — shared across all hot-reloaded modules in the same process
export const sseEmitter: EventEmitter =
  globalThis.__sseEmitter ||
  (globalThis.__sseEmitter = new EventEmitter().setMaxListeners(200));

/** Emit a named SSE event to all connected clients. Fire-and-forget. */
export function emitSSEEvent(event: string, data: Record<string, unknown>): void {
  try {
    sseEmitter.emit('event', { event, data });
  } catch {
    // Non-fatal
  }
}
