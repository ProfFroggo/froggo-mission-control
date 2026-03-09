// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import '@testing-library/jest-dom';

// ─── localStorage shim ─────────────────────────────────────────────────────
// jsdom's localStorage does not fully implement the Web Storage spec in a way
// that satisfies Zustand's persist middleware. We replace it with a robust
// Map-based implementation so that stores using `persist` work in tests.
const _localStore = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  writable: true,
  value: {
    getItem: (key: string) => _localStore.get(key) ?? null,
    setItem: (key: string, value: string) => { _localStore.set(key, value); },
    removeItem: (key: string) => { _localStore.delete(key); },
    clear: () => { _localStore.clear(); },
    get length() { return _localStore.size; },
    key: (index: number) => Array.from(_localStore.keys())[index] ?? null,
  },
});

// ─── DOM method shims ──────────────────────────────────────────────────────
// jsdom does not implement scrollIntoView — components that call it (e.g. to
// auto-scroll a chat window) will throw in tests. Stub it as a no-op.
if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView = function () {};
}
