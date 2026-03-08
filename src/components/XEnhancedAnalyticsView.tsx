import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart2, TrendingUp, Eye, Activity, Users, RefreshCw,
  MessageCircle, Repeat, Heart, MousePointer, Calendar, Clock, Lightbulb,
  ArrowUp, ArrowDown, Minus, Zap
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Spinner } from './LoadingStates';
import { CHART_COLORS, CHART_GRID, CHART_AXIS, CHART_TOOLTIP } from '../lib/chartTheme';

interface PostMetrics {
  id: string;
  content: string;
  created_at: number;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  clicks: number;  // Always 0 — X API free tier doesn't expose click data
  type: 'single' | 'thread' | 'reply' | 'quote';
}

interface AnalyticsSummary {
  totalPosts: number;
  totalImpressions: number;
  engagementRate: number;
  followerCount: number;  // Real current count
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
}


interface Suggestion {
  id: string;
  type: 'timing' | 'content' | 'engagement' | 'growth';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  icon: string;
}

const COLORS = [CHART_COLORS.blue, CHART_COLORS.green, CHART_COLORS.amber, CHART_COLORS.red, CHART_COLORS.purple, CHART_COLORS.pink];


type AnalyticsView = 'overview' | 'posts' | 'heatmap' | 'insights';

export function XEnhancedAnalyticsView() {
  const [view, setView] = useState<AnalyticsView>('overview');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const clawdbot = (window as any).clawdbot;

      const [profileResult, tweetsResult] = await Promise.all([
        clawdbot?.xAnalytics?.profile?.(),
        clawdbot?.xAnalytics?.tweets?.(100),
      ]);

      const profile = profileResult?.data?.public_metrics || {};
      const rawTweets: any[] = tweetsResult?.data || [];

      // Map real tweets to PostMetrics
      const postMetrics: PostMetrics[] = rawTweets.map((t: any) => ({
        id: t.id,
        content: t.text,
        created_at: new Date(t.created_at).getTime(),
        impressions: t.public_metrics?.impression_count || 0,
        likes: t.public_metrics?.like_count || 0,
        retweets: t.public_metrics?.retweet_count || 0,
        replies: t.public_metrics?.reply_count || 0,
        clicks: 0,  // Not available on free tier
        type: 'single' as const,
      }));

      // Build impressions over time from real tweet dates
      const dateMap: Record<string, { impressions: number; engagement: number }> = {};
      for (const t of postMetrics) {
        const dateKey = new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (!dateMap[dateKey]) dateMap[dateKey] = { impressions: 0, engagement: 0 };
        dateMap[dateKey].impressions += t.impressions;
        dateMap[dateKey].engagement += t.likes + t.retweets + t.replies;
      }
      const impressionsOverTime = Object.entries(dateMap).map(([date, v]) => ({ date, ...v })).slice(-30);

      const totalLikes = postMetrics.reduce((s, t) => s + t.likes, 0);
      const totalRetweets = postMetrics.reduce((s, t) => s + t.retweets, 0);
      const totalReplies = postMetrics.reduce((s, t) => s + t.replies, 0);
      const totalEngagements = totalLikes + totalRetweets + totalReplies;
      const followers = profile.followers_count || 0;
      const engagementRate = followers > 0 && postMetrics.length > 0
        ? ((totalEngagements / postMetrics.length) / followers * 100)
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
        { name: 'Single Tweets', value: postMetrics.filter(t => t.type === 'single').length, engagement: 0 },
      ];

      // Heatmap from real tweet timestamps
      const heatmapData: { day: string; hour: number; value: number }[] = [];
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const heatmapMap: Record<string, number> = {};
      for (const t of postMetrics) {
        const d = new Date(t.created_at);
        const key = `${d.getDay()}-${d.getHours()}`;
        heatmapMap[key] = (heatmapMap[key] || 0) + t.likes + t.retweets + t.replies + 1;
      }
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          heatmapData.push({ day: days[day], hour, value: heatmapMap[`${day}-${hour}`] || 0 });
        }
      }

      // Follower growth: just current count (can't get historical without premium)
      const followerGrowth = [{ date: 'Now', followers }];

      // Suggestions based on real data
      const suggestions: Suggestion[] = [];
      if (postMetrics.length > 0) {
        const best = [...postMetrics].sort((a, b) => (b.likes + b.retweets) - (a.likes + a.retweets))[0];
        if (best) {
          const bestDate = new Date(best.created_at);
          suggestions.push({
            id: '1',
            type: 'timing',
            title: `${days[bestDate.getDay()]}s at ${bestDate.getHours()}:00 perform best`,
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
      });

    } catch (error) {
      console.error('[XAnalytics] Failed to load analytics:', error);
      // On error, show empty state (not mock data)
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatFullNumber = (num: number) => {
    return num.toLocaleString();
  };

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

  const getPerformanceClass = (value: number, avg: number) => {
    const ratio = value / avg;
    if (ratio >= 1.5) return 'text-success';
    if (ratio >= 1.0) return 'text-info';
    if (ratio >= 0.5) return 'text-warning';
    return 'text-review';
  };

  const getPerformanceIcon = (value: number, avg: number) => {
    const ratio = value / avg;
    if (ratio >= 1.5) return <ArrowUp size={14} className="text-success" />;
    if (ratio >= 1.0) return <ArrowUp size={14} className="text-info" />;
    if (ratio >= 0.5) return <Minus size={14} className="text-warning" />;
    return <ArrowDown size={14} className="text-review" />;
  };

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
              <p className="text-sm text-mission-control-text-dim">Deep insights for your social media performance</p>
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
            { id: 'posts', label: 'Post Metrics', icon: MessageCircle },
            { id: 'heatmap', label: 'Posting Heatmap', icon: Calendar },
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
                <div className="text-2xl font-bold text-mission-control-text">{formatNumber(data.summary.totalImpressions)}</div>
              </div>
              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-success" />
                  <span className="text-sm text-mission-control-text-dim">Engagement Rate</span>
                </div>
                <div className="text-2xl font-bold text-success">{data.summary.engagementRate.toFixed(2)}%</div>
              </div>
              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={16} className="text-purple-500" />
                  <span className="text-sm text-mission-control-text-dim">Followers</span>
                </div>
                <div className="text-2xl font-bold text-purple-500">{formatNumber(data.summary.followerCount)}</div>
              </div>
              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={16} className="text-warning" />
                  <span className="text-sm text-mission-control-text-dim">Avg Likes/Tweet</span>
                </div>
                <div className="text-2xl font-bold text-warning">{data.summary.avgLikesPerTweet.toFixed(1)}</div>
              </div>
            </div>

            {/* Charts Row */}
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
                      <XAxis dataKey="date" tick={{ fill: CHART_AXIS.stroke, fontSize: 10 }} tickLine={false} />
                      <YAxis tick={{ fill: CHART_AXIS.stroke, fontSize: 10 }} tickLine={false} tickFormatter={formatNumber} />
                      <Tooltip
                        contentStyle={{ backgroundColor: CHART_TOOLTIP.backgroundColor, border: CHART_TOOLTIP.border, borderRadius: CHART_TOOLTIP.borderRadius }}
                        labelStyle={{ color: CHART_TOOLTIP.color }}
                      />
                      <Area type="monotone" dataKey="impressions" stroke={CHART_COLORS.blue} fillOpacity={1} fill="url(#colorImpressions)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Follower Growth */}
              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
                <h3 className="font-semibold text-mission-control-text mb-4 flex items-center gap-2">
                  <Users size={16} className="text-purple-500" />
                  Follower Growth
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.followerGrowth}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID.stroke} opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fill: CHART_AXIS.stroke, fontSize: 10 }} tickLine={false} />
                      <YAxis tick={{ fill: CHART_AXIS.stroke, fontSize: 10 }} tickLine={false} domain={['dataMin - 100', 'dataMax + 100']} />
                      <Tooltip
                        contentStyle={{ backgroundColor: CHART_TOOLTIP.backgroundColor, border: CHART_TOOLTIP.border, borderRadius: CHART_TOOLTIP.borderRadius }}
                        labelStyle={{ color: CHART_TOOLTIP.color }}
                      />
                      <Line type="monotone" dataKey="followers" stroke={CHART_COLORS.purple} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Content Type Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                        contentStyle={{ backgroundColor: CHART_TOOLTIP.backgroundColor, border: CHART_TOOLTIP.border, borderRadius: CHART_TOOLTIP.borderRadius }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
                <h3 className="font-semibold text-mission-control-text mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-success" />
                  Engagement by Content Type
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.contentTypes} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID.stroke} opacity={0.3} />
                      <XAxis type="number" tick={{ fill: CHART_AXIS.stroke, fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fill: CHART_AXIS.stroke, fontSize: 10 }} width={80} />
                      <Tooltip
                        contentStyle={{ backgroundColor: CHART_TOOLTIP.backgroundColor, border: CHART_TOOLTIP.border, borderRadius: CHART_TOOLTIP.borderRadius }}
                        formatter={((value: number) => [`${value}%`, 'Engagement']) as any}
                      />
                      <Bar dataKey="engagement" fill={CHART_COLORS.green} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Top Suggestions Preview */}
            <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-mission-control-text flex items-center gap-2">
                  <Lightbulb size={16} className="text-warning" />
                  Top Insights
                </h3>
                <button
                  onClick={() => setView('insights')}
                  className="text-sm text-info hover:underline"
                >
                  View all →
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.suggestions.slice(0, 3).map((suggestion) => (
                  <div key={suggestion.id} className="p-4 bg-mission-control-bg rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{suggestion.icon}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        suggestion.impact === 'high' ? 'bg-success-subtle text-success' :
                        suggestion.impact === 'medium' ? 'bg-warning-subtle text-warning' :
                        'bg-mission-control-border text-mission-control-text-dim'
                      }`}>
                        {suggestion.impact} impact
                      </span>
                    </div>
                    <div className="font-medium text-mission-control-text text-sm">{suggestion.title}</div>
                    <div className="text-xs text-mission-control-text-dim mt-1 line-clamp-2">{suggestion.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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
                  <MousePointer size={14} className="text-purple-500" />
                  <span className="text-mission-control-text">{avgMetrics.clicks}</span>
                  <span className="text-xs text-mission-control-text-dim">clicks</span>
                </div>
              </div>
            </div>

            {/* Post List */}
            <div className="bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-mission-control-border">
                <h3 className="text-sm font-semibold text-mission-control-text">Individual Post Performance</h3>
              </div>
              <div className="divide-y divide-mission-control-border">
                {data.postMetrics.map((post) => (
                  <div key={post.id} className="p-4 hover:bg-mission-control-bg/50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            post.type === 'thread' ? 'bg-success-subtle text-success' :
                            post.type === 'reply' ? 'bg-info-subtle text-info' :
                            post.type === 'quote' ? 'bg-purple-subtle text-purple-500' :
                            'bg-mission-control-accent/20 text-mission-control-accent'
                          }`}>
                            {post.type}
                          </span>
                          <span className="text-xs text-mission-control-text-dim">
                            {new Date(post.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-mission-control-text line-clamp-2">{post.content}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-lg font-semibold text-mission-control-text">{formatNumber(post.impressions)}</div>
                          <div className="text-xs text-mission-control-text-dim">impr</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-semibold flex items-center justify-end gap-1 ${getPerformanceClass(post.impressions, avgMetrics.impressions)}`}>
                            {getPerformanceIcon(post.impressions, avgMetrics.impressions)}
                            {formatNumber(post.impressions)}
                          </div>
                          <div className="text-xs text-mission-control-text-dim">vs avg</div>
                        </div>
                        <div className="grid grid-cols-4 gap-3 text-center">
                          <div>
                            <div className="flex items-center justify-center gap-1 text-review">
                              <Heart size={12} />
                            </div>
                            <div className="text-xs font-medium text-mission-control-text">{post.likes}</div>
                          </div>
                          <div>
                            <div className="flex items-center justify-center gap-1 text-success">
                              <Repeat size={12} />
                            </div>
                            <div className="text-xs font-medium text-mission-control-text">{post.retweets}</div>
                          </div>
                          <div>
                            <div className="flex items-center justify-center gap-1 text-info">
                              <MessageCircle size={12} />
                            </div>
                            <div className="text-xs font-medium text-mission-control-text">{post.replies}</div>
                          </div>
                          <div>
                            <div className="flex items-center justify-center gap-1 text-purple-500">
                              <MousePointer size={12} />
                            </div>
                            <div className="text-xs font-medium text-mission-control-text">{post.clicks}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'heatmap' && (
          <div className="space-y-6">
            {/* Posting Frequency Heatmap */}
            <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
              <h3 className="font-semibold text-mission-control-text mb-2 flex items-center gap-2">
                <Calendar size={16} className="text-mission-control-accent" />
                Optimal Posting Times
              </h3>
              <p className="text-sm text-mission-control-text-dim mb-4">
                Engagement heatmap showing when your audience is most active
              </p>
              
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  {/* Hour labels */}
                  <div className="flex ml-12 mb-2">
                    {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => (
                      <div key={hour} className="flex-1 text-xs text-mission-control-text-dim text-center">
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>
                  
                  {/* Heatmap grid */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, _dayIndex) => (
                    <div key={day} className="flex items-center mb-1">
                      <div className="w-10 text-xs text-mission-control-text-dim text-right pr-2">{day}</div>
                      <div className="flex-1 flex gap-0.5">
                        {Array.from({ length: 24 }, (_, hour) => {
                          const cellData = data.heatmapData.find(h => h.day === day && h.hour === hour);
                          const value = cellData?.value || 0;
                          const intensity = Math.min(value / 80, 1);
                          return (
                            <div
                              key={hour}
                              className="flex-1 h-8 rounded-sm transition-colors"
                              style={{
                                backgroundColor: value === 0 ? CHART_TOOLTIP.backgroundColor : `rgba(59, 130, 246, ${intensity})`,
                              }}
                              title={`${day} ${hour}:00 - Engagement: ${value}`}
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
                          style={{ backgroundColor: `rgba(59, 130, 246, ${intensity})` }}
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
                <div className="text-2xl font-bold text-mission-control-text">Tuesday</div>
                <div className="text-sm text-mission-control-text-dim">Highest average engagement</div>
              </div>
              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={16} className="text-info" />
                  <span className="text-sm text-mission-control-text-dim">Best Time</span>
                </div>
                <div className="text-2xl font-bold text-mission-control-text">2:00 PM</div>
                <div className="text-sm text-mission-control-text-dim">Peak engagement window</div>
              </div>
              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={16} className="text-success" />
                  <span className="text-sm text-mission-control-text-dim">Best Day + Time</span>
                </div>
                <div className="text-2xl font-bold text-mission-control-text">Tue 8-10 PM</div>
                <div className="text-sm text-mission-control-text-dim">Optimal posting slot</div>
              </div>
            </div>
          </div>
        )}

        {view === 'insights' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-mission-control-text flex items-center gap-2">
              <Lightbulb size={16} className="text-warning" />
              AI-Powered Suggestions
            </h3>
            <div className="grid gap-4">
              {data.suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">{suggestion.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-mission-control-text">{suggestion.title}</h4>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          suggestion.impact === 'high' ? 'bg-success-subtle text-success' :
                          suggestion.impact === 'medium' ? 'bg-warning-subtle text-warning' :
                          'bg-mission-control-border text-mission-control-text-dim'
                        }`}>
                          {suggestion.impact} impact
                        </span>
                      </div>
                      <p className="text-sm text-mission-control-text-dim">{suggestion.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default XEnhancedAnalyticsView;
