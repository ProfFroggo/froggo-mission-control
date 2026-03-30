// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * useInboxData — shared hook for /api/inbox list data.
 *
 * Uses module-level in-flight deduplication + TTL caching so that
 * DashInboxCard and Sidebar (via pending count derivation) share
 * a single fetch instead of 2 independent ones.
 *
 * Fixes: 2× duplicate /api/inbox calls → 1×.
 */

import { useState, useEffect, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────

export interface InboxItem {
  id: number;
  type: string;
  title: string;
  content: string;
  channel: string | null;
  status: string | null;
  createdAt: number;
  metadata: Record<string, unknown>;
  starred: 0 | 1;
  isRead: 0 | 1;
  tags: string[];
}

// ── Module-level cache (shared across all hook instances) ────────────

const CACHE_TTL_MS = 30_000; // 30 seconds

let cachedItems: InboxItem[] | null = null;
let cachedAt = 0;
let inflightPromise: Promise<InboxItem[]> | null = null;
const subscribers = new Set<(items: InboxItem[]) => void>();

function isCacheValid(): boolean {
  return cachedItems !== null && Date.now() - cachedAt < CACHE_TTL_MS;
}

async function fetchInboxData(): Promise<InboxItem[]> {
  if (isCacheValid()) return cachedItems!;
  if (inflightPromise) return inflightPromise;

  inflightPromise = (async () => {
    try {
      const res = await fetch('/api/inbox');
      if (!res.ok) return cachedItems ?? [];
      const data = await res.json();
      const items = Array.isArray(data) ? data as InboxItem[] : [];
      cachedItems = items;
      cachedAt = Date.now();
      return items;
    } catch {
      return cachedItems ?? [];
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}

/**
 * Externally update the cache (e.g. from SSE events).
 * Notifies all subscribers.
 */
export function setInboxDataExternal(items: InboxItem[]): void {
  cachedItems = items;
  cachedAt = Date.now();
  subscribers.forEach((fn) => fn(items));
}

/**
 * Invalidate the cache so next consumer triggers a fresh fetch.
 */
export function invalidateInboxData(): void {
  cachedItems = null;
  cachedAt = 0;
}

/**
 * Get the current pending count from cached data without triggering a fetch.
 * Returns 0 if no data is cached.
 */
export function getCachedPendingCount(): number {
  if (!cachedItems) return 0;
  return cachedItems.filter((i) => i.status === 'pending').length;
}

// ── React hook ───────────────────────────────────────────────────────

export function useInboxData(): {
  items: InboxItem[];
  pendingCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [items, setItems] = useState<InboxItem[]>(cachedItems ?? []);
  const [loading, setLoading] = useState(!isCacheValid());

  useEffect(() => {
    let cancelled = false;

    // Subscribe to cross-component updates
    const subscriber = (newItems: InboxItem[]) => {
      if (!cancelled) setItems(newItems);
    };
    subscribers.add(subscriber);

    if (isCacheValid()) {
      setItems(cachedItems!);
      setLoading(false);
    } else {
      setLoading(true);
      fetchInboxData().then((result) => {
        if (!cancelled) {
          setItems(result);
          setLoading(false);
        }
        // Notify all subscribers
        subscribers.forEach((fn) => fn(result));
      });
    }

    return () => {
      cancelled = true;
      subscribers.delete(subscriber);
    };
  }, []);

  const refresh = useCallback(async () => {
    invalidateInboxData();
    const result = await fetchInboxData();
    subscribers.forEach((fn) => fn(result));
  }, []);

  const pendingCount = items.filter((i) => i.status === 'pending').length;

  return { items, pendingCount, loading, refresh };
}
