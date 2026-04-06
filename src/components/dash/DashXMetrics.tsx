// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * DashXMetrics — X/Twitter snapshot card.
 * Filters tweets to the selected range (24h / 48h) so metrics reflect
 * actual activity in that window, not lifetime totals.
 */
import { Twitter } from 'lucide-react';
import { useXAnalytics } from '../../hooks/useXAnalytics';

interface DashXMetricsProps {
  range: '24h' | '48h';
  onNavigate?: (view: string) => void;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function MetricCell({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] text-mission-control-text-dim uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold text-mission-control-text tabular-nums mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-mission-control-text-dim mt-0.5">{sub}</div>}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <>
      <div className="grid grid-cols-2 divide-x divide-y divide-mission-control-border">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-mission-control-surface px-4 py-3">
            <div className="h-2 w-16 rounded bg-mission-control-border animate-pulse mb-2" />
            <div className="h-5 w-12 rounded bg-mission-control-border animate-pulse" />
          </div>
        ))}
      </div>
      {/* Top-post placeholder — matches the loaded "Top post" section height
          to prevent layout shift (CLS) when data arrives and the card grows. */}
      <div className="px-4 py-3 border-t border-mission-control-border">
        <div className="h-2 w-20 rounded bg-mission-control-border animate-pulse mb-2" />
        <div className="h-3 w-full rounded bg-mission-control-border animate-pulse mb-1" />
        <div className="h-3 w-2/3 rounded bg-mission-control-border animate-pulse" />
      </div>
    </>
  );
}

export default function DashXMetrics({ range, onNavigate }: DashXMetricsProps) {
  // Shared hook — deduplicates with DashSnapshotKPI and other consumers
  const { data, loading } = useXAnalytics();

  const rangeMs = range === '24h' ? 24 * 60 * 60 * 1000 : 48 * 60 * 60 * 1000;

  const isConfigured = data?.ok && data.profile;

  // Filter tweets to selected range
  const cutoff = Date.now() - rangeMs;
  const allTweets = data?.tweets ?? [];
  const rangedTweets = allTweets.filter(
    (t) => t.created_at && new Date(t.created_at).getTime() >= cutoff,
  );

  const impressions  = rangedTweets.reduce((s, t) => s + t.public_metrics.impression_count, 0);
  const likes        = rangedTweets.reduce((s, t) => s + t.public_metrics.like_count, 0);
  const retweets     = rangedTweets.reduce((s, t) => s + t.public_metrics.retweet_count, 0);
  const replies      = rangedTweets.reduce((s, t) => s + t.public_metrics.reply_count, 0);
  const engagements  = likes + retweets + replies;
  const engRate      = impressions > 0 ? ((engagements / impressions) * 100).toFixed(2) : '0.00';
  const followers    = data?.profile?.public_metrics.followers_count ?? 0;

  const topPost = rangedTweets.length > 0
    ? rangedTweets.reduce((best, t) =>
        t.public_metrics.impression_count > best.public_metrics.impression_count ? t : best,
      )
    : null;

  return (
    <div className="bg-mission-control-surface rounded-xl border border-mission-control-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border">
        <h2 className="text-sm font-bold text-mission-control-text flex items-center gap-2">
          <Twitter size={15} className="text-sky-400" />
          X / Twitter
        </h2>
        {isConfigured && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-mission-control-text-dim">
              {rangedTweets.length} post{rangedTweets.length !== 1 ? 's' : ''} · {range}
            </span>
            <button
              type="button"
              onClick={() => onNavigate?.('twitter')}
              className="text-[10px] text-mission-control-text-dim hover:text-mission-control-accent transition-colors"
            >
              Full view →
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <SkeletonGrid />
      ) : !isConfigured ? (
        <div className="px-4 py-6 text-center">
          <Twitter size={24} className="mx-auto mb-2 text-mission-control-text-dim opacity-30" />
          <p className="text-xs text-mission-control-text-dim">X not configured</p>
          <button
            type="button"
            onClick={() => onNavigate?.('twitter')}
            className="mt-2 text-xs text-mission-control-accent hover:underline"
          >
            Connect account →
          </button>
        </div>
      ) : rangedTweets.length === 0 ? (
        <>
          <div className="grid grid-cols-2 divide-x divide-y divide-mission-control-border">
            <MetricCell label="Followers" value={fmt(followers)} sub="current" />
            <MetricCell label={`Posts · ${range}`} value="0" sub="no posts in range" />
            <MetricCell label="Impressions" value="—" />
            <MetricCell label="Engagement" value="—" />
          </div>
          <div className="px-4 py-3 border-t border-mission-control-border">
            <p className="text-xs text-mission-control-text-dim">No posts in the last {range}</p>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 divide-x divide-y divide-mission-control-border">
            <MetricCell label="Followers" value={fmt(followers)} sub="current" />
            <MetricCell label={`Posts · ${range}`} value={rangedTweets.length} />
            <MetricCell label={`Impressions · ${range}`} value={fmt(impressions)} />
            <MetricCell label={`Engagement · ${range}`} value={`${engRate}%`} sub={`${fmt(engagements)} interactions`} />
          </div>

          {topPost && (
            <div className="px-4 py-3 border-t border-mission-control-border">
              <div className="text-[10px] text-mission-control-text-dim uppercase tracking-wide mb-1.5">
                Top post · {range}
              </div>
              <p className="text-xs text-mission-control-text line-clamp-2 leading-relaxed">
                {topPost.text}
              </p>
              <div className="flex gap-3 mt-2 text-[10px] text-mission-control-text-dim">
                <span>{fmt(topPost.public_metrics.impression_count)} impressions</span>
                <span>{topPost.public_metrics.like_count} likes</span>
                <span>{topPost.public_metrics.retweet_count} RT</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
