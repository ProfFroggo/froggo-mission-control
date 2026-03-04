// src/lib/bridge.ts
// Polyfills window.clawdbot so existing components work without changes.
// Import this ONCE in app/page.tsx before the App component renders.
//
// MIGRATION NOTE: This is a temporary shim for Phase 1-3.
// In Phase 4, components will be refactored to call typed API methods directly.

import { invokeCompat } from './api';

if (typeof window !== 'undefined') {
  (window as any).clawdbot = {
    modules: {
      invoke: invokeCompat,
    },
    chat: {
      on: (event: string, _callback: Function) => {
        // SSE subscription — see Phase 12
        console.warn(`[Bridge] chat.on('${event}') — use SSE instead (Phase 12)`);
      },
    },
  };
}
