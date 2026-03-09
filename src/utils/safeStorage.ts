// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Safe localStorage wrapper with error handling.
 * Prevents crashes in private mode or when storage is full.
 *
 * localStorage is limited to ~5MB per origin. Large persisted stores
 * (chat history, artifacts) can exceed this. On QuotaExceededError the
 * evict-and-retry logic clears the offending key and writes a fresh
 * smaller value rather than throwing into React's error boundary.
 */

import { createJSONStorage } from 'zustand/middleware';

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        // Evict the stale key and retry once with the new (smaller) value
        try { localStorage.removeItem(key); } catch {}
        try { localStorage.setItem(key, value); return true; } catch {}
      }
      return false;
    }
  },

  removeItem(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  getJSON<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  setJSON<T>(key: string, value: T): boolean {
    return safeStorage.setItem(key, JSON.stringify(value));
  },
};

/**
 * Zustand persist storage adapter backed by safeStorage.
 * Drop-in replacement for the default localStorage adapter — never throws
 * on quota overflow, evicts the old blob and retries instead.
 *
 * Usage:
 *   persist(fn, { name: 'my-store', storage: zustandSafeStorage })
 */
export const zustandSafeStorage = createJSONStorage(() => ({
  getItem: (key: string) => safeStorage.getItem(key),
  setItem: (key: string, value: string) => { safeStorage.setItem(key, value); },
  removeItem: (key: string) => { safeStorage.removeItem(key); },
}));

export default safeStorage;
