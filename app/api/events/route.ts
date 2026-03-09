// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Phase 82: SSE Real-Time Layer — replaces polling-based events endpoint
// GET /api/events — Server-Sent Events stream for real-time platform updates

import { NextRequest } from 'next/server';
import { sseEmitter } from '@/lib/sseEmitter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Re-export for convenience (phase 82 compatibility)
export { emitSSEEvent } from '@/lib/sseEmitter';

// ── SSE GET handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Client disconnected — swallow error
        }
      };

      // Send connected confirmation immediately
      send('connected', { ts: Date.now() });

      const handler = ({ event, data }: { event: string; data: Record<string, unknown> }) => {
        send(event, data);
      };

      sseEmitter.on('event', handler);

      // Keepalive comment every 25 seconds to prevent proxy timeouts
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(ping);
        }
      }, 25_000);

      // Cleanup when client disconnects
      request.signal.addEventListener('abort', () => {
        sseEmitter.off('event', handler);
        clearInterval(ping);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
