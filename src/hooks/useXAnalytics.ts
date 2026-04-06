// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * useXAnalytics — shared hook for /api/x/analytics data.
 *
 * Uses module-level in-flight deduplication + TTL caching so that
 * no matter how many components mount simultaneously (DashSnapshotKPI,
 * DashXMetrics, XContentMixTracker, etc.), only ONE network request
 * fires per cache window.
 *
 * Fixes: 7× duplicate /api/x/analytics calls → 1×.
 */

import { useState, useEffect } from 'react';

// ── Types ────────────────────────────────────────────────────────────

export interface XProfile {
  name?: string;
  username?: string;
  public_metrics: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    like_count: number;
  };
}

export interface XTweet {
  id: string;
  text: string;
  created_at?: string;
  public_metrics: {
    impression_count: number;
    like_count: number;
    retweet_count: number;
    reply_count: number;
  };
}

export interface XAnalyticsData {
  success: boolean;
  profile?: XProfile;
  tweets?: XTweet[];
}

// ── Module-level cache (shared across all hook instances) ────────────

let cachedData: XAnalyticsData | null = null;
let cachedAt = 0;
let inflightPromise: Promise<XAnalyticsData> | null = null;

const CACHE_TTL_MS = 60_000; // 1 minute — analytics data doesn't change often

/**
 * Fetch /api/x/analytics with deduplication.
 * - Returns cached data if within TTL.
 * - If a request is already in-flight, returns the same promise (no duplicate).
 * - Otherwise starts a new request.
 */
export async function fetchXAnalytics(): Promise<XAnalyticsData> {
  // Return cached data if still fresh
  if (cachedData && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedData;
  }

  // Deduplicate in-flight requests — multiple callers share one fetch
  if (inflightPromise) return inflightPromise;

  inflightPromise = (async () => {
    try {
      const res = await fetch('/api/x/analytics');
      if (!res.ok) return { success: false };
      const data = (await res.json()) as XAnalyticsData;
      cachedData = data;
      cachedAt = Date.now();
      return data;
    } catch {
      return { success: false };
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}

/**
 * Invalidate the cached analytics data.
 * Call this when you know the data has changed (e.g. after posting a tweet).
 */
export function invalidateXAnalytics(): void {
  cachedData = null;
  cachedAt = 0;
}

// ── React hook ───────────────────────────────────────────────────────

export function useXAnalytics(): { data: XAnalyticsData | null; loading: boolean } {
  const [data, setData] = useState<XAnalyticsData | null>(cachedData);
  const [loading, setLoading] = useState(!cachedData);

  useEffect(() => {
    let cancelled = false;

    // If we already have cached data, show it immediately (no loading flash)
    if (cachedData && Date.now() - cachedAt < CACHE_TTL_MS) {
      setData(cachedData);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchXAnalytics().then((result) => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, []);

  return { data, loading };
}
