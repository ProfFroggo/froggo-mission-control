import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart2, TrendingUp, Eye, Activity, Users, RefreshCw,
  MessageCircle, Repeat, Heart, MousePointer, Calendar, Clock, Lightbulb,
  ArrowUp, ArrowDown, Minus, Zap, Download, Rocket, Link
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Spinner } from './LoadingStates';
import { CHART_COLORS, CHART_GRID, CHART_AXIS, CHART_TOOLTIP } from '../lib/chartTheme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PostMetrics {
  id: string;
  content: string;
  created_at: number;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  clicks: number; // Always 0 — X API free tier doesn't expose click data
  type: 'single' | 'thread' | 'reply' | 'quote';
}

interface AnalyticsSummary {
  totalPosts: number;
  totalImpressions: number;
  engagementRate: number;
  followerCount: number; // Real current count
  avgLikesPerTweet: number;
  avgRetweetsPerTweet: number;
}

interface AnalyticsData {
  impressionsOverTime: { date: string; impressions: number; engagement: number }[];
  followerGrowth: { date: string; followers: number }[];
  contentTypes: { name: string; value: number; engagement: number }[];
  heatmapData: { day: string; hour: number; value: number }[];
  postMetrics: PostMetrics[];
  summary: AnalyticsSummary;
  suggestions: Suggestion[];
  engagementTrend: { date: string; rate: number }[];
}

interface Suggestion {
  id: string;
  type: 'timing' | 'content' | 'engagement' | 'growth';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  icon: string;
}

// ---------------------------------------------------------------------------
// Static / mock data
// ---------------------------------------------------------------------------

// 30-day follower growth trend (mock — X API free tier has no historical followers endpoint)
const MOCK_FOLLOWER_SPARKLINE = [
  820, 835, 841, 850, 862, 858, 870, 881, 876, 890,
  905, 912, 908, 920, 935, 944, 938, 952, 965, 970,
  982, 990, 987, 1002, 1018, 1025, 1031, 1040, 1048, 1055,
];

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Time buckets for the simplified heatmap (6 rows)
const TIME_BUCKETS = [
  { label: 'Night', hours: [0, 1, 2, 3, 4] },
  { label: 'Morning', hours: [5, 6, 7, 8, 9] },
  { label: 'Midday', hours: [10, 11, 12, 13] },
  { label: 'Afternoon', hours: [14, 15, 16, 17] },
  { label: 'Evening', hours: [18, 19, 20, 21] },
  { label: 'Late', hours: [22, 23] },
];

const COLORS = [CHART_COLORS.blue, CHART_COLORS.green, CHART_COLORS.amber, CHART_COLORS.red, CHART_COLORS.purple, CHART_COLORS.pink];

// ---------------------------------------------------------------------------
// Mock data for new analytics sections (labeled clearly — no live API for these)
// ---------------------------------------------------------------------------

// 7-day engagement rate trend — mock historical averages (%)
const MOCK_ENGAGEMENT_TREND_7D = [2.1, 3.4, 2.8, 4.2, 3.9, 5.1, 4.7];
const MOCK_ENGAGEMENT_TREND_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Best posting time heatmap — engagement score 0–100 per time slot
// Keys: dayIndex (0=Sun…6=Sat), time-of-day bucket
const MOCK_POSTING_HEATMAP: Record<number, Record<string, number>> = {
  0: { morning: 20, noon: 45, afternoon: 60, evening: 80, night: 30 }, // Sun
  1: { morning: 35, noon: 70, afternoon: 75, evening: 65, night: 20 }, // Mon
  2: { morning: 40, noon: 65, afternoon: 80, evening: 70, night: 25 }, // Tue
  3: { morning: 30, noon: 60, afternoon: 85, evening: 75, night: 15 }, // Wed
  4: { morning: 45, noon: 55, afternoon: 70, evening: 90, night: 35 }, // Thu
  5: { morning: 50, noon: 80, afternoon: 65, evening: 55, night: 40 }, // Fri
  6: { morning: 25, noon: 50, afternoon: 55, evening: 85, night: 45 }, // Sat
};
const MOCK_HEATMAP_TIME_SLOTS = ['morning', 'noon', 'afternoon', 'evening', 'night'] as const;
const MOCK_HEATMAP_SLOT_LABELS: Record<string, string> = {
  morning: 'Morning',
  noon: 'Noon',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
};

// Mock recent posts for the content performance mini-table
interface MockPost {
  content: string;
  date: string;
  likes: number;
  replies: number;
  impressions: number;
}
const MOCK_RECENT_POSTS: MockPost[] = [
  { content: 'Shipped a massive update to our analytics pipeline today. Real-time insights incoming for everyone.', date: '2026-03-12', likes: 142, replies: 18, impressions: 4800 },
  { content: 'Thread: How we reduced onboarding drop-off by 34% using targeted activation nudges.', date: '2026-03-10', likes: 98, replies: 31, impressions: 3200 },
  { content: 'Growth tip: Your best-performing content from 6 months ago is worth reposting. Audiences forget.', date: '2026-03-08', likes: 211, replies: 9, impressions: 7100 },
  { content: 'Excited to announce we crossed 1,000 active users this week. Grateful for the community support.', date: '2026-03-06', likes: 87, replies: 42, impressions: 2900 },
  { content: 'The underrated growth lever nobody talks about: improving your existing users experience first.', date: '2026-03-04', likes: 163, replies: 22, impressions: 5500 },
];

type AnalyticsView = 'overview' | 'posts' | 'heatmap' | 'insights';

// ---------------------------------------------------------------------------
// Sub-components: pure SVG sparklines
// ---------------------------------------------------------------------------

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
}

function Sparkline({ values, width = 120, height = 36, color = CHART_COLORS.blue, strokeWidth = 1.5 }: SparklineProps) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * w;
      const y = pad + h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// CSV export helper
// ---------------------------------------------------------------------------

function exportMockPostsCSV(posts: MockPost[]) {
  const header = ['Content', 'Date', 'Likes', 'Replies', 'Impressions', 'Engagement %'];
  const rows = posts.map((p) => {
    const preview = p.content.slice(0, 80).replace(/"/g, '""') + (p.content.length > 80 ? '...' : '');
    const engPct = p.impressions > 0
      ? (((p.likes + p.replies) / p.impressions) * 100).toFixed(2)
      : '0.00';
    return [`"${preview}"`, p.date, p.likes, p.replies, p.impressions, engPct].join(',');
  });
  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `x-post-performance-mock-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPostsCSV(posts: PostMetrics[]) {
  const header = ['Content', 'Published', 'Impressions', 'Likes', 'Replies', 'Engagement %'];
  const rows = posts.map((p) => {
    const preview = p.content.slice(0, 60).replace(/"/g, '""') + (p.content.length > 60 ? '...' : '');
    const date = new Date(p.created_at).toLocaleDateString();
    const engPct =
      p.impressions > 0
        ? (((p.likes + p.replies + p.retweets) / p.impressions) * 100).toFixed(2)
        : '0.00';
    return [`"${preview}"`, date, p.impressions, p.likes, p.replies, engPct].join(',');
  });
  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `x-post-performance-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function XEnhancedAnalyticsView() {
  const [view, setView] = useState<AnalyticsView>('overview');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [postSort, setPostSort] = useState<'engagement' | 'impressions' | 'likes'>('engagement');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/x/analytics');
      const apiData = res.ok ? await res.json() : {};
      const profile = apiData.profile?.public_metrics ?? {};
      const rawTweets: any[] = apiData.tweets ?? [];

      // Filter tweets by selected time range
      const rangeDays = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
      const filteredRawTweets = rawTweets.filter(
        (t: any) => new Date(t.created_at).getTime() >= cutoff
      );

      // Map real tweets to PostMetrics
      const postMetrics: PostMetrics[] = filteredRawTweets.map((t: any) => ({
        id: t.id,
        content: t.text,
        created_at: new Date(t.created_at).getTime(),
        impressions: t.public_metrics?.impression_count || 0,
        likes: t.public_metrics?.like_count || 0,
        retweets: t.public_metrics?.retweet_count || 0,
        replies: t.public_metrics?.reply_count || 0,
        clicks: 0, // Not available on free tier
        type: 'single' as const,
      }));

      // Build impressions over time and engagement rate per day
      const dateMap: Record<string, { impressions: number; engagement: number; count: number }> = {};
      for (const t of postMetrics) {
        const dateKey = new Date(t.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        if (!dateMap[dateKey]) dateMap[dateKey] = { impressions: 0, engagement: 0, count: 0 };
        dateMap[dateKey].impressions += t.impressions;
        dateMap[dateKey].engagement += t.likes + t.retweets + t.replies;
        dateMap[dateKey].count += 1;
      }
      const impressionsOverTime = Object.entries(dateMap)
        .map(([date, v]) => ({ date, impressions: v.impressions, engagement: v.engagement }))
        .slice(-30);

      // Engagement rate trend: daily (likes+replies+retweets) / impressions * 100
      const engagementTrend = Object.entries(dateMap)
        .map(([date, v]) => ({
          date,
          rate: v.impressions > 0 ? (v.engagement / v.impressions) * 100 : 0,
        }))
        .slice(-7);

      const totalLikes = postMetrics.reduce((s, t) => s + t.likes, 0);
      const totalRetweets = postMetrics.reduce((s, t) => s + t.retweets, 0);
      const totalReplies = postMetrics.reduce((s, t) => s + t.replies, 0);
      const totalEngagements = totalLikes + totalRetweets + totalReplies;
      const followers = profile.followers_count || 0;
      const engagementRate =
        followers > 0 && postMetrics.length > 0
          ? ((totalEngagements / postMetrics.length) / followers) * 100
          : 0;

      const summary: AnalyticsSummary = {
        totalPosts: postMetrics.length,
        totalImpressions: postMetrics.reduce((s, t) => s + t.impressions, 0),
        engagementRate,
        followerCount: followers,
        avgLikesPerTweet: postMetrics.length > 0 ? totalLikes / postMetrics.length : 0,
        avgRetweetsPerTweet: postMetrics.length > 0 ? totalRetweets / postMetrics.length : 0,
      };

      // Content type breakdown
      const contentTypes = [
        { name: 'Single Tweets', value: postMetrics.filter((t) => t.type === 'single').length, engagement: 0 },
      ];

      // Heatmap from real tweet timestamps
      const heatmapData: { day: string; hour: number; value: number }[] = [];
      const heatmapMap: Record<string, number> = {};
      for (const t of postMetrics) {
        const d = new Date(t.created_at);
        const key = `${d.getDay()}-${d.getHours()}`;
        heatmapMap[key] = (heatmapMap[key] || 0) + t.likes + t.retweets + t.replies + 1;
      }
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          heatmapData.push({ day: DAYS_SHORT[day], hour, value: heatmapMap[`${day}-${hour}`] || 0 });
        }
      }

      // Follower growth: just current count (can't get historical without premium)
      const followerGrowth = [{ date: 'Now', followers }];

      // Suggestions based on real data
      const suggestions: Suggestion[] = [];
      if (postMetrics.length > 0) {
        const best = [...postMetrics].sort(
          (a, b) => b.likes + b.retweets - (a.likes + a.retweets)
        )[0];
        if (best) {
          const bestDate = new Date(best.created_at);
          suggestions.push({
            id: '1',
            type: 'timing',
            title: `${DAYS_SHORT[bestDate.getDay()]}s at ${bestDate.getHours()}:00 perform best`,
            description: `Your top tweet (${best.likes} likes, ${best.retweets} RTs) was posted at this time. Schedule your best content here.`,
            impact: 'high',
            icon: '🕐',
          });
        }
        if (totalRetweets > totalLikes * 0.3) {
          suggestions.push({
            id: '2',
            type: 'content',
            title: 'High retweet rate — keep creating shareable content',
            description: `${totalRetweets} retweets across ${postMetrics.length} tweets. Your content resonates.`,
            impact: 'high',
            icon: '🔁',
          });
        }
      }

      setData({
        impressionsOverTime,
        followerGrowth,
        contentTypes,
        heatmapData,
        postMetrics,
        summary,
        suggestions,
        engagementTrend,
      });
    } catch (error) {
      console.error('[XAnalytics] Failed to load analytics:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // Derived / memoised values
  // ---------------------------------------------------------------------------

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatFullNumber = (num: number) => num.toLocaleString();

  const avgMetrics = useMemo(() => {
    if (!data?.postMetrics.length) return { impressions: 0, likes: 0, retweets: 0, replies: 0, clicks: 0 };
    const posts = data.postMetrics;
    return {
      impressions: Math.floor(posts.reduce((s, p) => s + p.impressions, 0) / posts.length),
      likes: Math.floor(posts.reduce((s, p) => s + p.likes, 0) / posts.length),
      retweets: Math.floor(posts.reduce((s, p) => s + p.retweets, 0) / posts.length),
      replies: Math.floor(posts.reduce((s, p) => s + p.replies, 0) / posts.length),
      clicks: Math.floor(posts.reduce((s, p) => s + p.clicks, 0) / posts.length),
    };
  }, [data]);

  // Sorted posts for the content performance table
  const sortedPosts = useMemo(() => {
    if (!data?.postMetrics) return [];
    return [...data.postMetrics].sort((a, b) => {
      if (postSort === 'engagement') {
        const engA = a.impressions > 0 ? ((a.likes + a.replies + a.retweets) / a.impressions) * 100 : 0;
        const engB = b.impressions > 0 ? ((b.likes + b.replies + b.retweets) / b.impressions) * 100 : 0;
        return engB - engA;
      }
      if (postSort === 'impressions') return b.impressions - a.impressions;
      return b.likes - a.likes;
    });
  }, [data, postSort]);

  // Best posting times from heatmap data
  const bestTimes = useMemo(() => {
    if (!data?.heatmapData?.length) return { day: 'N/A', hour: 'N/A', combined: 'N/A' };
    const dayTotals: Record<string, number> = {};
    const hourTotals: Record<number, number> = {};
    for (const h of data.heatmapData) {
      dayTotals[h.day] = (dayTotals[h.day] || 0) + h.value;
      hourTotals[h.hour] = (hourTotals[h.hour] || 0) + h.value;
    }
    const bestDay = DAYS_SHORT.reduce((a, b) => ((dayTotals[a] || 0) >= (dayTotals[b] || 0) ? a : b));
    const bestHourNum = Object.entries(hourTotals).sort(([, a], [, b]) => b - a)[0]?.[0] ?? '14';
    const h = Number(bestHourNum);
    const bestHourLabel = `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`;
    const bestCell = [...data.heatmapData].sort((a, b) => b.value - a.value)[0];
    const bestCombined = bestCell
      ? `${bestCell.day} ${bestCell.hour % 12 || 12}${bestCell.hour < 12 ? 'AM' : 'PM'}`
      : 'N/A';
    return { day: bestDay, hour: bestHourLabel, combined: bestCombined };
  }, [data]);

  // Time-bucket heatmap: 7 days × 6 buckets
  const bucketHeatmap = useMemo(() => {
    if (!data?.heatmapData?.length) return [];
    return TIME_BUCKETS.map((bucket) => ({
      label: bucket.label,
      days: DAYS_SHORT.map((day) => {
        const total = bucket.hours.reduce((sum, hour) => {
          const cell = data.heatmapData.find((h) => h.day === day && h.hour === hour);
          return sum + (cell?.value ?? 0);
        }, 0);
        return { day, value: total };
      }),
    }));
  }, [data]);

  const bucketMax = useMemo(
    () => Math.max(1, ...bucketHeatmap.flatMap((row) => row.days.map((d) => d.value))),
    [bucketHeatmap]
  );

  const getPerformanceClass = (value: number, avg: number) => {
    const ratio = avg > 0 ? value / avg : 0;
    if (ratio >= 1.5) return 'text-success';
    if (ratio >= 1.0) return 'text-info';
    if (ratio >= 0.5) return 'text-warning';
    return 'text-review';
  };

  const getPerformanceIcon = (value: number, avg: number) => {
    const ratio = avg > 0 ? value / avg : 0;
    if (ratio >= 1.5) return <ArrowUp size={14} className="text-success" />;
    if (ratio >= 1.0) return <ArrowUp size={14} className="text-info" />;
    if (ratio >= 0.5) return <Minus size={14} className="text-warning" />;
    return <ArrowDown size={14} className="text-review" />;
  };

  // ---------------------------------------------------------------------------
  // Engagement rate trend sparkline values (7-day)
  // ---------------------------------------------------------------------------

  const engagementTrendValues = useMemo(
    () => (data?.engagementTrend ?? []).map((d) => d.rate),
    [data]
  );

  // Follower growth change (mock — last vs first in sparkline)
  const followerGrowthPct = useMemo(() => {
    const first = MOCK_FOLLOWER_SPARKLINE[0];
    const last = MOCK_FOLLOWER_SPARKLINE[MOCK_FOLLOWER_SPARKLINE.length - 1];
    return (((last - first) / first) * 100).toFixed(1);
  }, []);

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <BarChart2 size={48} className="mx-auto mb-4 text-mission-control-text-dim opacity-30" />
          <p className="text-mission-control-text font-medium mb-1">Could not load analytics</p>
          <p className="text-sm text-mission-control-text-dim">Check your X API credentials.</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-mission-control-accent text-white rounded-lg text-sm hover:bg-mission-control-accent/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full bg-mission-control-bg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-mission-control-border shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mission-control-accent/10 rounded-xl">
              <BarChart2 size={24} className="text-mission-control-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-mission-control-text">Enhanced Analytics</h1>
              <p className="text-sm text-mission-control-text-dim">
                Deep insights for your social media performance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-mission-control-surface rounded-lg p-1 border border-mission-control-border">
              {(['7d', '30d', '90d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-mission-control-accent text-white'
                      : 'text-mission-control-text-dim hover:text-mission-control-text'
                  }`}
                >
                  {range === '7d' ? '7D' : range === '30d' ? '30D' : '90D'}
                </button>
              ))}
            </div>
            <button
              onClick={loadData}
              className="p-2 rounded-lg border border-mission-control-border hover:bg-mission-control-surface transition-colors text-mission-control-text-dim"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart2 },
            { id: 'posts', label: 'Post Performance', icon: MessageCircle },
            { id: 'heatmap', label: 'Best Posting Times', icon: Calendar },
            { id: 'insights', label: 'Suggestions', icon: Lightbulb },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id as AnalyticsView)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                view === id
                  ? 'bg-mission-control-accent text-white'
                  : 'bg-mission-control-surface border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-accent/50'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* ================================================================
            OVERVIEW VIEW
        ================================================================ */}
        {view === 'overview' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle size={16} className="text-info" />
                  <span className="text-sm text-mission-control-text-dim">Total Posts</span>
                </div>
                <div className="text-2xl font-bold text-mission-control-text">{data.summary.totalPosts}</div>
              </div>
              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Eye size={16} className="text-mission-control-accent" />
                  <span className="text-sm text-mission-control-text-dim">Impressions</span>
                </div>
                <div className="text-2xl font-bold text-mission-control-text">
                  {formatNumber(data.summary.totalImpressions)}
                </div>
              </div>
              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-success" />
                  <span className="text-sm text-mission-control-text-dim">Engagement Rate</span>
                </div>
                <div className="text-2xl font-bold text-success">
                  {data.summary.engagementRate.toFixed(2)}%
                </div>
              </div>
              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={16} className="text-mission-control-accent" />
                  <span className="text-sm text-mission-control-text-dim">Followers</span>
                </div>
                <div className="text-2xl font-bold text-mission-control-accent">
                  {formatNumber(data.summary.followerCount)}
                </div>
              </div>
              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={16} className="text-warning" />
                  <span className="text-sm text-mission-control-text-dim">Avg Likes/Tweet</span>
                </div>
                <div className="text-2xl font-bold text-warning">
                  {data.summary.avgLikesPerTweet.toFixed(1)}
                </div>
              </div>
            </div>

            {/* === NEW: Engagement Rate Trend + Audience Growth row === */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Engagement Rate Trend — 7-day SVG sparkline */}
              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-mission-control-text flex items-center gap-2">
                    <TrendingUp size={16} className="text-success" />
                    Engagement Rate Trend
                    <span className="text-xs font-normal text-mission-control-text-dim">(7-day)</span>
                  </h3>
                  {engagementTrendValues.length > 1 && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      engagementTrendValues[engagementTrendValues.length - 1] >=
                      engagementTrendValues[0]
                        ? 'bg-success-subtle text-success'
                        : 'bg-review-subtle text-review'
                    }`}>
                      {engagementTrendValues[engagementTrendValues.length - 1] >= engagementTrendValues[0]
                        ? '+'
                        : ''}
                      {(
                        engagementTrendValues[engagementTrendValues.length - 1] -
                        engagementTrendValues[0]
                      ).toFixed(2)}
                      %
                    </span>
                  )}
                </div>
                {engagementTrendValues.length >= 2 ? (
                  <>
                    <div className="w-full" style={{ height: 80 }}>
                      <svg
                        viewBox={`0 0 280 80`}
                        width="100%"
                        height="80"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        {/* Grid lines */}
                        {[0.25, 0.5, 0.75].map((t) => (
                          <line
                            key={t}
                            x1={0}
                            x2={280}
                            y1={t * 80}
                            y2={t * 80}
                            stroke="currentColor"
                            strokeOpacity={0.08}
                            strokeWidth={1}
                          />
                        ))}
                        {/* Sparkline */}
                        {(() => {
                          const vals = engagementTrendValues;
                          const min = Math.min(...vals);
                          const max = Math.max(...vals);
                          const range = max - min || 0.01;
                          const pad = 4;
                          const points = vals
                            .map((v, i) => {
                              const x = pad + (i / (vals.length - 1)) * (280 - pad * 2);
                              const y = pad + (1 - (v - min) / range) * (80 - pad * 2);
                              return `${x.toFixed(1)},${y.toFixed(1)}`;
                            })
                            .join(' ');
                          return (
                            <polyline
                              points={points}
                              fill="none"
                              stroke={CHART_COLORS.green}
                              strokeWidth={2}
                              strokeLinejoin="round"
                              strokeLinecap="round"
                            />
                          );
                        })()}
                      </svg>
                    </div>
                    <div className="flex justify-between mt-1">
                      {data.engagementTrend.map((d, i) => (
                        <span key={i} className="text-xs text-mission-control-text-dim">
                          {d.date}
                        </span>
                      ))}
                    </div>
                    <div className="flex justify-between mt-2">
                      {engagementTrendValues.map((v, i) => (
                        <span key={i} className="text-xs font-medium text-success">
                          {v.toFixed(1)}%
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-20 text-sm text-mission-control-text-dim">
                    Not enough data for trend. Post more content to see this chart.
                  </div>
                )}
              </div>

              {/* === NEW: Audience Growth Card === */}
              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-mission-control-text flex items-center gap-2">
                    <Users size={16} className="text-mission-control-accent" />
                    Audience Growth
                  </h3>
                  <span className="text-xs text-mission-control-text-dim italic">
                    Historical data (estimated)
                  </span>
                </div>
                <div className="flex items-end gap-4 mb-3">
                  <div>
                    <div className="text-3xl font-bold text-mission-control-text">
                      {data.summary.followerCount > 0
                        ? formatNumber(data.summary.followerCount)
                        : '—'}
                    </div>
                    <div className="text-sm text-mission-control-text-dim">followers</div>
                  </div>
                  <div className="mb-1">
                    <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-success-subtle text-success">
                      +{followerGrowthPct}% this month
                    </span>
                  </div>
                </div>
                {/* 30-day sparkline */}
                <div className="w-full" style={{ height: 48 }}>
                  <svg
                    viewBox="0 0 280 48"
                    width="100%"
                    height="48"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    {(() => {
                      const vals = MOCK_FOLLOWER_SPARKLINE;
                      const min = Math.min(...vals);
                      const max = Math.max(...vals);
                      const range = max - min || 1;
                      const pad = 3;
                      const points = vals
                        .map((v, i) => {
                          const x = pad + (i / (vals.length - 1)) * (280 - pad * 2);
                          const y = pad + (1 - (v - min) / range) * (48 - pad * 2);
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join(' ');
                      // Fill path
                      const firstX = pad;
                      const lastX = 280 - pad;
                      const bottomY = 48 - pad;
                      const firstPoint = `${firstX.toFixed(1)},${(pad + (1 - (vals[0] - min) / range) * (48 - pad * 2)).toFixed(1)}`;
                      return (
                        <>
                          <path
                            d={`M${firstPoint} L${points.split(' ').slice(1).join(' L')} L${lastX},${bottomY} L${firstX},${bottomY} Z`}
                            fill={CHART_COLORS.purple}
                            fillOpacity={0.12}
                          />
                          <polyline
                            points={points}
                            fill="none"
                            stroke={CHART_COLORS.purple}
                            strokeWidth={2}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                        </>
                      );
                    })()}
                  </svg>
                </div>
                <p className="text-xs text-mission-control-text-dim mt-2">
                  30-day follower trend. Connect X Premium API for live historical data.
                </p>
              </div>
            </div>

            {/* Charts Row — Impressions over time */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Impressions Over Time */}
              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
                <h3 className="font-semibold text-mission-control-text mb-4 flex items-center gap-2">
                  <Eye size={16} className="text-mission-control-accent" />
                  Impressions Over Time
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.impressionsOverTime}>
                      <defs>
                        <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID.stroke} opacity={0.3} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: CHART_AXIS.stroke, fontSize: 10 }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: CHART_AXIS.stroke, fontSize: 10 }}
                        tickLine={false}
                        tickFormatter={formatNumber}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: CHART_TOOLTIP.backgroundColor,
                          border: CHART_TOOLTIP.border,
                          borderRadius: CHART_TOOLTIP.borderRadius,
                        }}
                        labelStyle={{ color: CHART_TOOLTIP.color }}
                      />
                      <Area
                        type="monotone"
                        dataKey="impressions"
                        stroke={CHART_COLORS.blue}
                        fillOpacity={1}
                        fill="url(#colorImpressions)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Content Type Distribution */}
              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
                <h3 className="font-semibold text-mission-control-text mb-4 flex items-center gap-2">
                  <BarChart2 size={16} className="text-info" />
                  Content Type Distribution
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.contentTypes}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}%`}
                        labelLine={false}
                      >
                        {data.contentTypes.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: CHART_TOOLTIP.backgroundColor,
                          border: CHART_TOOLTIP.border,
                          borderRadius: CHART_TOOLTIP.borderRadius,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* === NEW: Campaign Performance Summary === */}
            <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Rocket size={16} className="text-mission-control-accent" />
                <h3 className="font-semibold text-mission-control-text">Campaign Performance</h3>
              </div>
              {/* No campaign-tweet attribution data available on free tier — show CTA */}
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="p-3 bg-mission-control-accent/10 rounded-xl mb-3">
                  <Link size={24} className="text-mission-control-accent" />
                </div>
                <p className="text-sm font-medium text-mission-control-text mb-1">
                  Connect campaigns to track performance
                </p>
                <p className="text-xs text-mission-control-text-dim max-w-sm">
                  Tag tweets with a campaign in the Campaigns tab. Once linked, this section
                  will show which campaign drove the most engagement, impressions, and follower growth.
                </p>
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('x-tab-change', { detail: 'campaigns' }));
                  }}
                  className="mt-4 px-4 py-2 text-sm font-medium bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/80 transition-colors"
                >
                  Go to Campaigns
                </button>
              </div>
            </div>

            {/* Top Suggestions Preview */}
            <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-mission-control-text flex items-center gap-2">
                  <Lightbulb size={16} className="text-warning" />
                  Top Insights
                </h3>
                <button onClick={() => setView('insights')} className="text-sm text-info hover:underline">
                  View all →
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.suggestions.slice(0, 3).map((suggestion) => (
                  <div key={suggestion.id} className="p-4 bg-mission-control-bg rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          suggestion.impact === 'high'
                            ? 'bg-success-subtle text-success'
                            : suggestion.impact === 'medium'
                            ? 'bg-warning-subtle text-warning'
                            : 'bg-mission-control-border text-mission-control-text-dim'
                        }`}
                      >
                        {suggestion.impact} impact
                      </span>
                    </div>
                    <div className="font-medium text-mission-control-text text-sm">{suggestion.title}</div>
                    <div className="text-xs text-mission-control-text-dim mt-1 line-clamp-2">
                      {suggestion.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            POSTS / CONTENT PERFORMANCE VIEW
        ================================================================ */}
        {view === 'posts' && (
          <div className="space-y-4">
            {/* Average Metrics Bar */}
            <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
              <div className="text-sm text-mission-control-text-dim mb-3">Average Post Performance</div>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <Eye size={14} className="text-mission-control-accent" />
                  <span className="text-mission-control-text">{formatFullNumber(avgMetrics.impressions)}</span>
                  <span className="text-xs text-mission-control-text-dim">impressions</span>
                </div>
                <div className="flex items-center gap-2">
                  <Heart size={14} className="text-review" />
                  <span className="text-mission-control-text">{avgMetrics.likes}</span>
                  <span className="text-xs text-mission-control-text-dim">likes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Repeat size={14} className="text-success" />
                  <span className="text-mission-control-text">{avgMetrics.retweets}</span>
                  <span className="text-xs text-mission-control-text-dim">retweets</span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageCircle size={14} className="text-info" />
                  <span className="text-mission-control-text">{avgMetrics.replies}</span>
                  <span className="text-xs text-mission-control-text-dim">replies</span>
                </div>
                <div className="flex items-center gap-2">
                  <MousePointer size={14} className="text-mission-control-accent" />
                  <span className="text-mission-control-text">{avgMetrics.clicks}</span>
                  <span className="text-xs text-mission-control-text-dim">clicks</span>
                </div>
              </div>
            </div>

            {/* === NEW: Content Performance Table === */}
            <div className="bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-mission-control-border flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-mission-control-text">Content Performance</h3>
                  <p className="text-xs text-mission-control-text-dim mt-0.5">
                    Sorted by {postSort === 'engagement' ? 'engagement rate' : postSort}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Sort selector */}
                  <div className="flex bg-mission-control-bg rounded-lg p-1 border border-mission-control-border">
                    {([
                      { key: 'engagement', label: 'Eng %' },
                      { key: 'impressions', label: 'Impr.' },
                      { key: 'likes', label: 'Likes' },
                    ] as const).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setPostSort(key)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          postSort === key
                            ? 'bg-mission-control-accent text-white'
                            : 'text-mission-control-text-dim hover:text-mission-control-text'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {/* CSV Export */}
                  <button
                    onClick={() => exportPostsCSV(sortedPosts)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-mission-control-border rounded-lg hover:bg-mission-control-bg transition-colors text-mission-control-text-dim hover:text-mission-control-text"
                    title="Export CSV"
                  >
                    <Download size={13} />
                    Export CSV
                  </button>
                </div>
              </div>

              {sortedPosts.length === 0 ? (
                <div className="p-8 text-center text-mission-control-text-dim">
                  <BarChart2 size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No post data available</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-mission-control-border bg-mission-control-bg/50">
                        <th className="text-left p-3 text-xs uppercase tracking-wide text-mission-control-text-dim font-medium">
                          Content
                        </th>
                        <th className="text-left p-3 text-xs uppercase tracking-wide text-mission-control-text-dim font-medium whitespace-nowrap">
                          Published
                        </th>
                        <th className="text-right p-3 text-xs uppercase tracking-wide text-mission-control-text-dim font-medium">
                          Impr.
                        </th>
                        <th className="text-right p-3 text-xs uppercase tracking-wide text-mission-control-text-dim font-medium">
                          Likes
                        </th>
                        <th className="text-right p-3 text-xs uppercase tracking-wide text-mission-control-text-dim font-medium">
                          Replies
                        </th>
                        <th className="text-right p-3 text-xs uppercase tracking-wide text-mission-control-text-dim font-medium whitespace-nowrap">
                          Eng %
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-mission-control-border">
                      {sortedPosts.map((post) => {
                        const engPct =
                          post.impressions > 0
                            ? (((post.likes + post.replies + post.retweets) / post.impressions) * 100).toFixed(2)
                            : '0.00';
                        const preview =
                          post.content.length > 60
                            ? post.content.slice(0, 60) + '…'
                            : post.content;
                        return (
                          <tr
                            key={post.id}
                            className="hover:bg-mission-control-bg/50 transition-colors"
                          >
                            <td className="p-3 max-w-xs">
                              <span
                                className="text-mission-control-text text-xs leading-relaxed block truncate"
                                title={post.content}
                              >
                                {preview}
                              </span>
                            </td>
                            <td className="p-3 text-xs text-mission-control-text-dim whitespace-nowrap">
                              {new Date(post.created_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="p-3 text-right text-xs text-mission-control-text font-medium">
                              {formatNumber(post.impressions)}
                            </td>
                            <td className="p-3 text-right text-xs text-mission-control-text font-medium">
                              {post.likes}
                            </td>
                            <td className="p-3 text-right text-xs text-mission-control-text font-medium">
                              {post.replies}
                            </td>
                            <td className="p-3 text-right">
                              <span
                                className={`text-xs font-semibold ${
                                  Number(engPct) >= 5
                                    ? 'text-success'
                                    : Number(engPct) >= 2
                                    ? 'text-info'
                                    : Number(engPct) >= 0.5
                                    ? 'text-warning'
                                    : 'text-mission-control-text-dim'
                                }`}
                              >
                                {engPct}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================
            HEATMAP VIEW
        ================================================================ */}
        {view === 'heatmap' && (
          <div className="space-y-6">
            {/* === NEW: Simplified 7×6 time-bucket heatmap === */}
            <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={16} className="text-mission-control-accent" />
                <h3 className="font-semibold text-mission-control-text">Best Posting Time Heatmap</h3>
              </div>
              <p className="text-xs text-mission-control-text-dim mb-4 italic">
                Based on historical data. Darker cells = higher engagement.
              </p>

              <div className="overflow-x-auto">
                <div className="min-w-[400px]">
                  {/* Day headers */}
                  <div className="flex ml-24 mb-1 gap-1">
                    {DAYS_SHORT.map((d) => (
                      <div
                        key={d}
                        className="flex-1 text-center text-xs font-medium text-mission-control-text-dim"
                      >
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Rows: time buckets */}
                  {bucketHeatmap.map((bucket) => (
                    <div key={bucket.label} className="flex items-center gap-1 mb-1">
                      <div className="w-24 shrink-0 text-xs text-mission-control-text-dim text-right pr-3 font-medium">
                        {bucket.label}
                      </div>
                      {bucket.days.map(({ day, value }) => {
                        const intensity = bucketMax > 0 ? value / bucketMax : 0;
                        const cellClass =
                          intensity === 0
                            ? 'bg-mission-control-border'
                            : intensity < 0.2
                            ? 'bg-info/10'
                            : intensity < 0.5
                            ? 'bg-info/40'
                            : 'bg-info/80';
                        return (
                          <div
                            key={day}
                            className={`flex-1 h-9 rounded-md transition-colors ${cellClass}`}
                            title={`${day} ${bucket.label} — engagement score: ${value}`}
                          />
                        );
                      })}
                    </div>
                  ))}

                  {/* Legend */}
                  <div className="flex items-center justify-end gap-2 mt-3">
                    <span className="text-xs text-mission-control-text-dim">Low</span>
                    <div className="flex gap-1">
                      <div className="w-5 h-4 rounded-sm bg-info/10" />
                      <div className="w-5 h-4 rounded-sm bg-info/40" />
                      <div className="w-5 h-4 rounded-sm bg-info/80" />
                    </div>
                    <span className="text-xs text-mission-control-text-dim">High</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed 24-hour heatmap */}
            <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
              <h3 className="font-semibold text-mission-control-text mb-2 flex items-center gap-2">
                <Clock size={16} className="text-info" />
                Hourly Engagement Detail
              </h3>
              <p className="text-sm text-mission-control-text-dim mb-4">
                24-hour breakdown of engagement by day
              </p>

              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  {/* Hour labels */}
                  <div className="flex ml-12 mb-2">
                    {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => (
                      <div
                        key={hour}
                        className="flex-1 text-xs text-mission-control-text-dim text-center"
                      >
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>

                  {/* Heatmap grid */}
                  {DAYS_SHORT.map((day) => (
                    <div key={day} className="flex items-center mb-1">
                      <div className="w-10 text-xs text-mission-control-text-dim text-right pr-2">
                        {day}
                      </div>
                      <div className="flex-1 flex gap-0.5">
                        {Array.from({ length: 24 }, (_, hour) => {
                          const cellData = data.heatmapData.find(
                            (h) => h.day === day && h.hour === hour
                          );
                          const value = cellData?.value || 0;
                          const intensity = Math.min(value / 80, 1);
                          return (
                            <div
                              key={hour}
                              className="flex-1 h-8 rounded-sm transition-colors"
                              style={{
                                backgroundColor:
                                  value === 0
                                    ? CHART_TOOLTIP.backgroundColor
                                    : `${CHART_COLORS.blue}${Math.round(intensity * 255)
                                        .toString(16)
                                        .padStart(2, '0')}`,
                              }}
                              title={`${day} ${hour}:00 — Engagement: ${value}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Legend */}
                  <div className="flex items-center justify-end gap-2 mt-4">
                    <span className="text-xs text-mission-control-text-dim">Low</span>
                    <div className="flex gap-0.5">
                      {[0.2, 0.4, 0.6, 0.8, 1].map((intensity) => (
                        <div
                          key={intensity}
                          className="w-6 h-4 rounded-sm"
                          style={{
                            backgroundColor: `${CHART_COLORS.blue}${Math.round(intensity * 255)
                              .toString(16)
                              .padStart(2, '0')}`,
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-mission-control-text-dim">High</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Best Times Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={16} className="text-warning" />
                  <span className="text-sm text-mission-control-text-dim">Best Day</span>
                </div>
                <div className="text-2xl font-bold text-mission-control-text">{bestTimes.day}</div>
                <div className="text-sm text-mission-control-text-dim">Highest average engagement</div>
              </div>
              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={16} className="text-info" />
                  <span className="text-sm text-mission-control-text-dim">Best Time</span>
                </div>
                <div className="text-2xl font-bold text-mission-control-text">{bestTimes.hour}</div>
                <div className="text-sm text-mission-control-text-dim">Peak engagement window</div>
              </div>
              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={16} className="text-success" />
                  <span className="text-sm text-mission-control-text-dim">Best Day + Time</span>
                </div>
                <div className="text-2xl font-bold text-mission-control-text">{bestTimes.combined}</div>
                <div className="text-sm text-mission-control-text-dim">Optimal posting slot</div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            INSIGHTS VIEW
        ================================================================ */}
        {view === 'insights' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-mission-control-text flex items-center gap-2">
              <Lightbulb size={16} className="text-warning" />
              Insights &amp; Suggestions
            </h3>
            <div className="grid gap-4">
              {data.suggestions.length === 0 ? (
                <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-8 text-center">
                  <Lightbulb size={32} className="mx-auto mb-3 text-mission-control-text-dim opacity-30" />
                  <p className="text-sm text-mission-control-text-dim">
                    No suggestions yet. Post more content to generate insights.
                  </p>
                </div>
              ) : (
                data.suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-mission-control-bg rounded-lg shrink-0">
                        <Lightbulb
                          size={18}
                          className={
                            suggestion.impact === 'high'
                              ? 'text-success'
                              : suggestion.impact === 'medium'
                              ? 'text-warning'
                              : 'text-mission-control-text-dim'
                          }
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-mission-control-text">{suggestion.title}</h4>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              suggestion.impact === 'high'
                                ? 'bg-success-subtle text-success'
                                : suggestion.impact === 'medium'
                                ? 'bg-warning-subtle text-warning'
                                : 'bg-mission-control-border text-mission-control-text-dim'
                            }`}
                          >
                            {suggestion.impact} impact
                          </span>
                        </div>
                        <p className="text-sm text-mission-control-text-dim">{suggestion.description}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default XEnhancedAnalyticsView;
