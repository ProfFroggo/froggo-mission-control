// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';

// ─── Legacy AppSettings interface (kept for backward compat) ─────────────────
export interface AppSettings {
  externalActionsEnabled?: boolean;
  rateLimitTweets?: number;
  rateLimitEmails?: number;
  defaultEmailAccount?: string;
  defaultCalendarAccount?: string;
  emailAccounts?: Array<{
    id: string;
    label: string;
    address: string;
    color?: string;
  }>;
  [key: string]: unknown;
}

// ─── Module-level namespace cache ────────────────────────────────────────────
// Map from namespace prefix (or '' for full fetch) to { [key]: value }
const nsCache = new Map<string, Record<string, unknown>>();
const nsListeners = new Map<string, Set<() => void>>();

function getOrCreateListeners(ns: string): Set<() => void> {
  if (!nsListeners.has(ns)) nsListeners.set(ns, new Set());
  return nsListeners.get(ns)!;
}

function notifyNs(ns: string): void {
  nsListeners.get(ns)?.forEach((fn) => fn());
}

function namespaceFor(key: string): string {
  const dot = key.indexOf('.');
  return dot === -1 ? '' : key.slice(0, dot);
}

async function fetchNamespace(ns: string): Promise<Record<string, unknown>> {
  const url = ns ? `/api/settings?namespace=${encodeURIComponent(ns)}` : '/api/settings';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`settings fetch failed: ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}

async function patchSetting(key: string, value: unknown): Promise<void> {
  const res = await fetch('/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [key]: value }),
  });
  if (!res.ok) throw new Error(`settings patch failed: ${res.status}`);
}

// ─── Primary generic hook ─────────────────────────────────────────────────────
// Returns [value, setter, loading]
// Fetches all keys in the namespace of `key` on mount (cached per namespace).
// Setter performs an optimistic update then PATCHes the server.
export function useSettings<T = unknown>(
  key: string,
  defaultValue?: T
): [T, (val: T) => void, boolean] {
  const ns = namespaceFor(key);

  const getValueFromCache = useCallback((): T => {
    const cached = nsCache.get(ns);
    if (cached && key in cached) return cached[key] as T;
    return defaultValue as T;
  }, [ns, key, defaultValue]);

  const [value, setValue] = useState<T>(getValueFromCache);
  const [loading, setLoading] = useState<boolean>(!nsCache.has(ns));

  useEffect(() => {
    const listeners = getOrCreateListeners(ns);
    const update = () => setValue(getValueFromCache());
    listeners.add(update);

    if (!nsCache.has(ns)) {
      fetchNamespace(ns)
        .then((data) => {
          nsCache.set(ns, data);
          notifyNs(ns);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    return () => {
      listeners.delete(update);
    };
  }, [ns, getValueFromCache]);

  const setter = useCallback(
    (val: T) => {
      // Optimistic update
      const current = nsCache.get(ns) ?? {};
      nsCache.set(ns, { ...current, [key]: val });
      notifyNs(ns);

      // Persist to server
      patchSetting(key, val).catch((err) => {
        console.error('[useSettings] patch failed:', err);
        // Revert on failure
        nsCache.set(ns, current);
        notifyNs(ns);
      });
    },
    [ns, key]
  );

  return [value, setter, loading];
}

// ─── Legacy hook (returns full settings map, kept for backward compat) ────────
let cachedSettings: AppSettings | null = null;
const legacyListeners: Set<() => void> = new Set();

function notifyLegacyListeners(): void {
  legacyListeners.forEach((fn) => fn());
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data = (await res.json()) as AppSettings;
      cachedSettings = data;
      nsCache.set('', data as Record<string, unknown>);
      notifyLegacyListeners();
      return cachedSettings;
    }
  } catch (_e) {
    // Settings load failed — return cached or empty
  }
  return cachedSettings ?? {};
}

/** @deprecated Use useSettings(key, defaultValue) instead */
export function useAllSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(cachedSettings ?? {});

  useEffect(() => {
    const update = () => setSettings({ ...(cachedSettings ?? {}) });
    legacyListeners.add(update);

    if (!cachedSettings) {
      loadSettings().then((s) => setSettings(s));
    }

    return () => {
      legacyListeners.delete(update);
    };
  }, []);

  return settings;
}
