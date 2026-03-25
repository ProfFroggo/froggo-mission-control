// XContentMixTracker — analyzes real tweet data from /api/x/analytics to show content type distribution

import React, { useState, useEffect } from 'react';
import { PieChart, TrendingUp, AlertTriangle, Check } from 'lucide-react';
import { Button, TextField, Flex } from '@radix-ui/themes';
import { CHART_COLORS } from '../lib/chartTheme';

interface ContentMixData {
  type: string;
  count: number;
  target: number;
  color: string;
  totalLikes: number;
  totalRetweets: number;
  totalReplies: number;
}

// ─── Content type classification ────────────────────────────────────────────

function classifyTweet(text: string): string {
  const lower = text.toLowerCase();
  // Thread indicator (numbered tweets, "thread" keyword, or 1/ pattern)
  if (/\bthread\b/.test(lower) || /^\d+[/.]/.test(lower.trim()) || /\b1\/\d+\b/.test(lower)) {
    return 'thread';
  }
  // Announcement patterns
  if (/\b(announcing|launched|live now|release|shipping|new feature|introducing|just dropped)\b/.test(lower)) {
    return 'announcement';
  }
  // Meme / humor patterns
  if (/\b(lmao|lol|bruh|meme|shitpost|ratio|fr fr|no cap)\b/.test(lower) || text.includes('https://t.co/') && text.length < 80) {
    return 'meme';
  }
  // Default to educational
  return 'educational';
}

export const XContentMixTracker: React.FC = () => {
  const [mixData, setMixData] = useState<ContentMixData[]>([
    { type: 'Educational', count: 0, target: 40, color: CHART_COLORS.blue, totalLikes: 0, totalRetweets: 0, totalReplies: 0 },
    { type: 'Meme', count: 0, target: 30, color: CHART_COLORS.amber, totalLikes: 0, totalRetweets: 0, totalReplies: 0 },
    { type: 'Thread', count: 0, target: 20, color: CHART_COLORS.accent, totalLikes: 0, totalRetweets: 0, totalReplies: 0 },
    { type: 'Announcement', count: 0, target: 10, color: CHART_COLORS.purple, totalLikes: 0, totalRetweets: 0, totalReplies: 0 },
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'week' | 'month'>('week');

  useEffect(() => {
    loadContentMix();
  }, [period]);

  const loadContentMix = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/x/analytics');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `API error: ${res.status}`);
      }
      const data = await res.json();
      const tweets: any[] = data.tweets ?? [];

      // Filter by period
      const now = Date.now();
      const daysBack = period === 'week' ? 7 : 30;
      const cutoff = now - daysBack * 24 * 60 * 60 * 1000;

      const filteredTweets = tweets.filter((t: any) => {
        if (!t.created_at) return true; // include if no date
        return new Date(t.created_at).getTime() >= cutoff;
      });

      // Classify and count
      const counts: Record<string, { count: number; likes: number; retweets: number; replies: number }> = {
        educational: { count: 0, likes: 0, retweets: 0, replies: 0 },
        meme: { count: 0, likes: 0, retweets: 0, replies: 0 },
        thread: { count: 0, likes: 0, retweets: 0, replies: 0 },
        announcement: { count: 0, likes: 0, retweets: 0, replies: 0 },
      };

      for (const tweet of filteredTweets) {
        const contentType = classifyTweet(tweet.text || '');
        const metrics = tweet.public_metrics || {};
        counts[contentType].count += 1;
        counts[contentType].likes += metrics.like_count || 0;
        counts[contentType].retweets += metrics.retweet_count || 0;
        counts[contentType].replies += metrics.reply_count || 0;
      }

      setMixData(prev =>
        prev.map(item => {
          const key = item.type.toLowerCase();
          const data = counts[key] || { count: 0, likes: 0, retweets: 0, replies: 0 };
          return {
            ...item,
            count: data.count,
            totalLikes: data.likes,
            totalRetweets: data.retweets,
            totalReplies: data.replies,
          };
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const getTotalPosts = () => {
    return mixData.reduce((sum, item) => sum + item.count, 0);
  };

  const getCurrentPercentage = (count: number) => {
    const total = getTotalPosts();
    return total > 0 ? (count / total) * 100 : 0;
  };

  const getDeviation = (item: ContentMixData) => {
    const current = getCurrentPercentage(item.count);
    return current - item.target;
  };

  const isOffTarget = (item: ContentMixData) => {
    const deviation = Math.abs(getDeviation(item));
    return deviation > 10;
  };

  const updateTarget = (type: string, newTarget: number) => {
    setMixData(prev =>
      prev.map(item => (item.type === type ? { ...item, target: newTarget } : item)),
    );
  };

  const getAvgEngagement = (item: ContentMixData) => {
    if (item.count === 0) return 0;
    return ((item.totalLikes + item.totalRetweets + item.totalReplies) / item.count).toFixed(1);
  };

  const renderMixBar = (item: ContentMixData) => {
    const currentPercent = getCurrentPercentage(item.count);
    const deviation = getDeviation(item);
    const offTarget = isOffTarget(item);

    return (
      <div key={item.type} className="mb-4">
        {/* Header */}
        <Flex align="center" justify="between" className="mb-2">
          <Flex align="center" gap="2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-sm font-medium text-mission-control-text">{item.type}</span>
            <span className="text-xs text-mission-control-text-dim">({item.count} posts)</span>
            <span className="text-xs text-mission-control-text-dim">
              avg {getAvgEngagement(item)} eng/post
            </span>
          </Flex>
          <Flex align="center" gap="2">
            <span className="text-xs text-mission-control-text-dim">
              {currentPercent.toFixed(1)}% / {item.target}%
            </span>
            {offTarget ? (
              <AlertTriangle size={14} className="text-warning" />
            ) : (
              <Check size={14} className="text-success" />
            )}
          </Flex>
        </Flex>

        {/* Progress bars */}
        <div className="space-y-1">
          {/* Current */}
          <div className="relative h-6 bg-mission-control-surface rounded overflow-hidden">
            <div
              className="absolute h-full transition-all duration-300"
              style={{
                width: `${Math.min(currentPercent, 100)}%`,
                backgroundColor: item.color,
                opacity: 0.8,
              }}
            />
            <div className="absolute inset-0 flex items-center px-2">
              <span className="text-xs font-medium text-mission-control-text">Current</span>
            </div>
          </div>

          {/* Target */}
          <div className="relative h-2 bg-mission-control-surface rounded overflow-hidden">
            <div
              className="absolute h-full transition-all duration-300"
              style={{
                width: `${item.target}%`,
                backgroundColor: item.color,
                opacity: 0.3,
              }}
            />
          </div>
        </div>

        {/* Deviation indicator */}
        {offTarget && (
          <div className="mt-1 text-xs text-warning flex items-center gap-1">
            <AlertTriangle size={12} />
            {deviation > 0
              ? `${deviation.toFixed(1)}% over target`
              : `${Math.abs(deviation).toFixed(1)}% under target`}
          </div>
        )}

        {/* Target adjuster */}
        <div className="mt-2 flex items-center gap-2">
          <label htmlFor={`target-${item.type}`} className="text-xs text-mission-control-text-dim">
            Target:
          </label>
          <TextField.Root
            id={`target-${item.type}`}
            type="number"
            value={String(item.target)}
            onChange={e => updateTarget(item.type, parseInt(e.target.value) || 0)}
            min="0"
            max="100"
            size="1"
            style={{ width: '4rem' }}
          />
          <span className="text-xs text-mission-control-text-dim">%</span>
        </div>
      </div>
    );
  };

  const getOverallStatus = () => {
    const offTargetCount = mixData.filter(isOffTarget).length;
    if (offTargetCount === 0) return 'on-target';
    if (offTargetCount <= 1) return 'minor-deviation';
    return 'major-deviation';
  };

  const statusClasses = (status: string) => {
    switch (status) {
      case 'on-target':
        return 'bg-success-subtle border-success-border';
      case 'minor-deviation':
        return 'bg-warning-subtle border-warning-border';
      default:
        return 'bg-error-subtle border-error-border';
    }
  };

  const status = getOverallStatus();
  const totalPosts = getTotalPosts();

  return (
    <Flex direction="column" height="100%" p="5" className="bg-mission-control-surface">
      {/* Header */}
      <Flex align="center" justify="between" className="mb-6">
        <Flex align="center" gap="3">
          <PieChart className="text-info" size={24} />
          <div>
            <h2 className="text-lg font-semibold text-mission-control-text">Content Mix Tracker</h2>
            <p className="text-sm text-mission-control-text-dim">
              Analyze your content type distribution from real tweet data
            </p>
          </div>
        </Flex>

        {/* Period selector */}
        <div className="flex items-center border border-mission-control-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setPeriod('week')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              period === 'week'
                ? 'bg-mission-control-accent/10 text-mission-control-accent'
                : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30'
            }`}
          >
            Last Week
          </button>
          <button
            type="button"
            onClick={() => setPeriod('month')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              period === 'month'
                ? 'bg-mission-control-accent/10 text-mission-control-accent'
                : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30'
            }`}
          >
            Last Month
          </button>
        </div>
      </Flex>

      {/* Error state */}
      {error && (
        <Flex align="center" gap="2" className="mb-4 p-3 rounded-lg bg-error-subtle text-error text-sm">
          <AlertTriangle size={16} />
          {error}
          <Button onClick={loadContentMix} variant="ghost" color="red" size="1" className="ml-auto">
            Retry
          </Button>
        </Flex>
      )}

      {/* Overall status card */}
      <div className={`mb-6 p-4 rounded-lg border-2 ${statusClasses(status)}`}>
        <Flex align="center" gap="2" className="mb-1">
          {status === 'on-target' ? (
            <>
              <Check className="text-success" size={20} />
              <span className="font-medium text-mission-control-text">Content Mix On Target</span>
            </>
          ) : status === 'minor-deviation' ? (
            <>
              <TrendingUp className="text-warning" size={20} />
              <span className="font-medium text-warning">Minor Deviation</span>
            </>
          ) : (
            <>
              <AlertTriangle className="text-error" size={20} />
              <span className="font-medium text-error">Major Deviation</span>
            </>
          )}
        </Flex>
        <p className="text-sm text-mission-control-text-dim">
          {totalPosts} tweets analyzed from the last {period === 'week' ? '7 days' : '30 days'}
        </p>
      </div>

      {/* Mix breakdown */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-mission-control-text-dim">
          Loading content mix data from X...
        </div>
      ) : totalPosts === 0 ? (
        <div className="flex-1 flex items-center justify-center text-mission-control-text-dim">
          <div className="text-center">
            <PieChart size={48} className="mx-auto mb-2 text-mission-control-text-dim" />
            <div>No tweets found in this period</div>
            <div className="text-xs mt-2">
              {error
                ? 'Check that X API credentials are configured'
                : 'Post some tweets to start tracking your content mix'}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {mixData.map(renderMixBar)}

          {/* Recommendations */}
          <div className="mt-6 p-4 bg-mission-control-surface rounded-lg border border-mission-control-border">
            <div className="text-sm font-medium text-mission-control-text mb-2">Recommendations</div>
            <ul className="text-sm text-mission-control-text space-y-1">
              {mixData.filter(isOffTarget).map(item => {
                const deviation = getDeviation(item);
                return (
                  <li key={item.type}>
                    {deviation > 0
                      ? `Reduce ${item.type.toLowerCase()} content`
                      : `Increase ${item.type.toLowerCase()} content`}
                  </li>
                );
              })}
              {mixData.filter(isOffTarget).length === 0 && (
                <li>Your content mix is well-balanced. Keep it up.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </Flex>
  );
};
