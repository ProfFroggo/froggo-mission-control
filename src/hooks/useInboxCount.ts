// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * useInboxCount — shared hook for inbox pending item count.
 *
 * Derives the pending count from the shared useInboxData cache,
 * eliminating a separate /api/inbox?status=pending fetch.
 * Multiple hook consumers share a single in-flight request.
 *
 * Also exposes `setInboxCountExternal` for SSE event bus updates.
 */

import { useState, useEffect, useCallback } from 'react';
import { useInboxData, invalidateInboxData, type InboxItem } from './useInboxData';

// ── External count override (SSE events) ────────────────────────────

let externalCount: number | null = null;
const countSubscribers = new Set<(count: number) => void>();

/**
 * Externally set the count (e.g. from SSE events).
 * Notifies all subscribers and bypasses data-derived count.
 */
export function setInboxCountExternal(count: number): void {
  externalCount = count;
  countSubscribers.forEach((fn) => fn(count));
}

/**
 * Invalidate the cache so next consumer triggers a fresh fetch.
 */
export function invalidateInboxCount(): void {
  externalCount = null;
  invalidateInboxData();
}

// ── React hook ───────────────────────────────────────────────────────

export function useInboxCount(): {
  count: number;
  refresh: () => Promise<void>;
} {
  // Derive count from the shared inbox data (no separate fetch)
  const { items, refresh: refreshData } = useInboxData();
  const derivedCount = items.filter((i: InboxItem) => i.status === 'pending').length;

  // Support external override from SSE
  const [overrideCount, setOverrideCount] = useState<number | null>(externalCount);

  useEffect(() => {
    const subscriber = (count: number) => setOverrideCount(count);
    countSubscribers.add(subscriber);
    return () => { countSubscribers.delete(subscriber); };
  }, []);

  const count = overrideCount ?? derivedCount;

  const refresh = useCallback(async () => {
    externalCount = null;
    setOverrideCount(null);
    await refreshData();
  }, [refreshData]);

  return { count, refresh };
}
