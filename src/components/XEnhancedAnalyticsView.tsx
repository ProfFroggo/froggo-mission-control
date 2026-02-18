import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart2, TrendingUp, Eye, Activity, Download, Users, RefreshCw,
  MessageCircle, Repeat, Heart, MousePointer, Calendar, Clock, Lightbulb,
  ArrowUp, ArrowDown, Minus, Zap
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, HeatmapCell
} from 'recharts';
import { Spinner } from './LoadingStates';

interface PostMetrics {
  id: string;
  content: string;
  created_at: number;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  clicks: number;
  type: 'single' | 'thread' | 'reply' | 'quote';
}

interface AnalyticsSummary {
  totalPosts: number;
  totalImpressions: number;
  engagementRate: number;
  followerGrowth: number;
  avgEngagement: number;
}

interface HeatmapCellData {
  day: number;
  hour: number;
  value: number;
}

interface Suggestion {
  id: string;
  type: 'timing' | 'content' | 'engagement' | 'growth';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  icon: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// Generate mock data for demonstration
const generateMockData = () => {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  
  // Generate impressions over time
  const impressionsOverTime = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000);
    impressionsOverTime.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      impressions: Math.floor(5000 + Math.random() * 15000 + (29 - i) * 200),
      engagement: Math.floor(200 + Math.random() * 800 + (29 - i) * 10),
    });
  }

  // Generate follower growth
  const followerGrowth = [];
  let followers = 4200;
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000);
    followers += Math.floor(Math.random() * 50 - 10);
    followerGrowth.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      followers,
    });
  }

  // Content type performance
  const contentTypes = [
    { name: 'Threads', value: 35, engagement: 5.2 },
    { name: 'Single Tweets', value: 45, engagement: 2.8 },
    { name: 'Replies', value: 12, engagement: 1.9 },
    { name: 'Quotes', value: 8, engagement: 3.4 },
  ];

  // Generate heatmap data (day of week x hour)
  const heatmapData: { day: string; hour: number; value: number }[] = [];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      // Higher engagement during work hours and evenings
      let baseValue = 10;
      if (hour >= 9 && hour <= 11) baseValue = 60;
      if (hour >= 12 && hour <= 14) baseValue = 45;
      if (hour >= 18 && hour <= 21) baseValue = 70;
      if (hour >= 21 && hour <= 23) baseValue = 50;
      if (day >= 1 && day <= 5) baseValue *= 1.3; // Weekdays higher
      
      heatmapData.push({
        day: days[day],
        hour,
        value: Math.floor(baseValue + Math.random() * 30),
      });
    }
  }

  // Generate post-level metrics
  const postMetrics: PostMetrics[] = [];
  const types: PostMetrics['type'][] = ['single', 'thread', 'reply', 'quote'];
  for (let i = 0; i < 25; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const impressions = Math.floor(1000 + Math.random() * 20000);
    const engagement = Math.floor(impressions * (0.01 + Math.random() * 0.08));
    
    postMetrics.push({
      id: `post-${i}`,
      content: `Sample tweet content #${i + 1} - ${type === 'thread' ? 'This is a thread with multiple tweets' : 'Interesting thought about industry trends'}`,
      created_at: now - i * 12 * 60 * 60 * 1000,
      impressions,
      likes: Math.floor(engagement * 0.6),
      retweets: Math.floor(engagement * 0.25),
      replies: Math.floor(engagement * 0.1),
      clicks: Math.floor(engagement * 0.05),
      type,
    });
  }

  // Summary
  const summary: AnalyticsSummary = {
    totalPosts: 156,
    totalImpressions: 487000,
    engagementRate: 3.8,
    followerGrowth: 12.4,
    avgEngagement: 3.2,
  };

  // Suggestions
  const suggestions: Suggestion[] = [
    {
      id: '1',
      type: 'timing',
      title: 'Post more on Tuesdays at 2pm',
      description: 'Your engagement is 3x higher on Tuesday afternoons. Schedule your best content for this slot.',
      impact: 'high',
      icon: '🕐',
    },
    {
      id: '2',
      type: 'content',
      title: 'Threads outperform single tweets',
      description: 'Your threads get 5x more engagement than single tweets. Consider converting key ideas into thread format.',
      impact: 'high',
      icon: '🧵',
    },
    {
      id: '3',
      type: 'timing',
      title: 'Evening hours are golden',
      description: 'Your audience is most active between 8-10pm. This is when your posts get 2x the average engagement.',
      impact: 'medium',
      icon: '🌙',
    },
    {
      id: '4',
      type: 'engagement',
      title: 'Reply to more mentions',
      description: 'Posts that engage with replies get 40% more impressions. Join conversations in your mentions.',
      impact: 'medium',
      icon: '💬',
    },
    {
      id: '5',
      type: 'growth',
      title: 'Post consistently on weekdays',
      description: 'Consistency correlates with follower growth. Aim for 3-5 posts per weekday.',
      impact: 'low',
      icon: '📈',
    },
  ];

  return {
    impressionsOverTime,
    followerGrowth,
    contentTypes,
    heatmapData,
    postMetrics,
    summary,
    suggestions,
  };
};

type AnalyticsView = 'overview' | 'posts' | 'heatmap' | 'insights';

export function XEnhancedAnalyticsView() {
  const [view, setView] = useState<AnalyticsView>('overview');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReturnType<typeof generateMockData> | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Try to load from X API first, fallback to mock
      const xAnalytics = (window as any).clawdbot?.xAnalytics;
      if (xAnalytics) {
        // Real implementation would go here
      }
      
      // Simulate API delay
      await new Promise(r => setTimeout(r, 800));
      setData(generateMockData());
    } catch (error) {
      console.error('Failed to load analytics:', error);
      setData(generateMockData());
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

  if (loading || !data) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-clawd-bg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-clawd-border shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-clawd-accent/10 rounded-xl">
              <BarChart2 size={24} className="text-clawd-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-clawd-text">Enhanced Analytics</h1>
              <p className="text-sm text-clawd-text-dim">Deep insights for your X/Twitter performance</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-clawd-surface rounded-lg p-1 border border-clawd-border">
              {(['7d', '30d', '90d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-clawd-accent text-white'
                      : 'text-clawd-text-dim hover:text-clawd-text'
                  }`}
                >
                  {range === '7d' ? '7D' : range === '30d' ? '30D' : '90D'}
                </button>
              ))}
            </div>
            <button
              onClick={loadData}
              className="p-2 rounded-lg border border-clawd-border hover:bg-clawd-surface transition-colors text-clawd-text-dim"
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
                  ? 'bg-clawd-accent text-white'
                  : 'bg-clawd-surface border border-clawd-border text-clawd-text-dim hover:text-clawd-text hover:border-clawd-accent/50'
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
              <div className="bg-clawd-surface border border-clawd-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle size={16} className="text-info" />
                  <span className="text-sm text-clawd-text-dim">Total Posts</span>
                </div>
                <div className="text-2xl font-bold text-clawd-text">{data.summary.totalPosts}</div>
              </div>
              <div className="bg-clawd-surface border border-clawd-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Eye size={16} className="text-clawd-accent" />
                  <span className="text-sm text-clawd-text-dim">Impressions</span>
                </div>
                <div className="text-2xl font-bold text-clawd-text">{formatNumber(data.summary.totalImpressions)}</div>
              </div>
              <div className="bg-clawd-surface border border-clawd-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-success" />
                  <span className="text-sm text-clawd-text-dim">Engagement Rate</span>
                </div>
                <div className="text-2xl font-bold text-success">{data.summary.engagementRate}%</div>
              </div>
              <div className="bg-clawd-surface border border-clawd-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={16} className="text-purple-500" />
                  <span className="text-sm text-clawd-text-dim">Follower Growth</span>
                </div>
                <div className="text-2xl font-bold text-purple-500">+{data.summary.followerGrowth}%</div>
              </div>
              <div className="bg-clawd-surface border border-clawd-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={16} className="text-warning" />
                  <span className="text-sm text-clawd-text-dim">Avg Engagement</span>
                </div>
                <div className="text-2xl font-bold text-warning">{data.summary.avgEngagement}%</div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Impressions Over Time */}
              <div className="bg-clawd-surface border border-clawd-border rounded-xl p-5">
                <h3 className="font-semibold text-clawd-text mb-4 flex items-center gap-2">
                  <Eye size={16} className="text-clawd-accent" />
                  Impressions Over Time
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.impressionsOverTime}>
                      <defs>
                        <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} tickFormatter={formatNumber} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        labelStyle={{ color: '#f3f4f6' }}
                      />
                      <Area type="monotone" dataKey="impressions" stroke="#3b82f6" fillOpacity={1} fill="url(#colorImpressions)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Follower Growth */}
              <div className="bg-clawd-surface border border-clawd-border rounded-xl p-5">
                <h3 className="font-semibold text-clawd-text mb-4 flex items-center gap-2">
                  <Users size={16} className="text-purple-500" />
                  Follower Growth
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.followerGrowth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} domain={['dataMin - 100', 'dataMax + 100']} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        labelStyle={{ color: '#f3f4f6' }}
                      />
                      <Line type="monotone" dataKey="followers" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Content Type Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-clawd-surface border border-clawd-border rounded-xl p-5">
                <h3 className="font-semibold text-clawd-text mb-4 flex items-center gap-2">
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
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-clawd-surface border border-clawd-border rounded-xl p-5">
                <h3 className="font-semibold text-clawd-text mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-success" />
                  Engagement by Content Type
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.contentTypes} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                      <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} width={80} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        formatter={(value: number) => [`${value}%`, 'Engagement']}
                      />
                      <Bar dataKey="engagement" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Top Suggestions Preview */}
            <div className="bg-clawd-surface border border-clawd-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-clawd-text flex items-center gap-2">
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
                  <div key={suggestion.id} className="p-4 bg-clawd-bg rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{suggestion.icon}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        suggestion.impact === 'high' ? 'bg-success-subtle text-success' :
                        suggestion.impact === 'medium' ? 'bg-warning-subtle text-warning' :
                        'bg-clawd-border text-clawd-text-dim'
                      }`}>
                        {suggestion.impact} impact
                      </span>
                    </div>
                    <div className="font-medium text-clawd-text text-sm">{suggestion.title}</div>
                    <div className="text-xs text-clawd-text-dim mt-1 line-clamp-2">{suggestion.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'posts' && (
          <div className="space-y-4">
            {/* Average Metrics Bar */}
            <div className="bg-clawd-surface border border-clawd-border rounded-xl p-4">
              <div className="text-sm text-clawd-text-dim mb-3">Average Post Performance</div>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <Eye size={14} className="text-clawd-accent" />
                  <span className="text-clawd-text">{formatFullNumber(avgMetrics.impressions)}</span>
                  <span className="text-xs text-clawd-text-dim">impressions</span>
                </div>
                <div className="flex items-center gap-2">
                  <Heart size={14} className="text-review" />
                  <span className="text-clawd-text">{avgMetrics.likes}</span>
                  <span className="text-xs text-clawd-text-dim">likes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Repeat size={14} className="text-success" />
                  <span className="text-clawd-text">{avgMetrics.retweets}</span>
                  <span className="text-xs text-clawd-text-dim">retweets</span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageCircle size={14} className="text-info" />
                  <span className="text-clawd-text">{avgMetrics.replies}</span>
                  <span className="text-xs text-clawd-text-dim">replies</span>
                </div>
                <div className="flex items-center gap-2">
                  <MousePointer size={14} className="text-purple-500" />
                  <span className="text-clawd-text">{avgMetrics.clicks}</span>
                  <span className="text-xs text-clawd-text-dim">clicks</span>
                </div>
              </div>
            </div>

            {/* Post List */}
            <div className="bg-clawd-surface border border-clawd-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-clawd-border">
                <h3 className="font-semibold text-clawd-text">Individual Post Performance</h3>
              </div>
              <div className="divide-y divide-clawd-border">
                {data.postMetrics.map((post) => (
                  <div key={post.id} className="p-4 hover:bg-clawd-bg/50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            post.type === 'thread' ? 'bg-success-subtle text-success' :
                            post.type === 'reply' ? 'bg-info-subtle text-info' :
                            post.type === 'quote' ? 'bg-purple-subtle text-purple-500' :
                            'bg-clawd-accent/20 text-clawd-accent'
                          }`}>
                            {post.type}
                          </span>
                          <span className="text-xs text-clawd-text-dim">
                            {new Date(post.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-clawd-text line-clamp-2">{post.content}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-lg font-semibold text-clawd-text">{formatNumber(post.impressions)}</div>
                          <div className="text-xs text-clawd-text-dim">impr</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-semibold flex items-center justify-end gap-1 ${getPerformanceClass(post.impressions, avgMetrics.impressions)}`}>
                            {getPerformanceIcon(post.impressions, avgMetrics.impressions)}
                            {formatNumber(post.impressions)}
                          </div>
                          <div className="text-xs text-clawd-text-dim">vs avg</div>
                        </div>
                        <div className="grid grid-cols-4 gap-3 text-center">
                          <div>
                            <div className="flex items-center justify-center gap-1 text-review">
                              <Heart size={12} />
                            </div>
                            <div className="text-xs font-medium text-clawd-text">{post.likes}</div>
                          </div>
                          <div>
                            <div className="flex items-center justify-center gap-1 text-success">
                              <Repeat size={12} />
                            </div>
                            <div className="text-xs font-medium text-clawd-text">{post.retweets}</div>
                          </div>
                          <div>
                            <div className="flex items-center justify-center gap-1 text-info">
                              <MessageCircle size={12} />
                            </div>
                            <div className="text-xs font-medium text-clawd-text">{post.replies}</div>
                          </div>
                          <div>
                            <div className="flex items-center justify-center gap-1 text-purple-500">
                              <MousePointer size={12} />
                            </div>
                            <div className="text-xs font-medium text-clawd-text">{post.clicks}</div>
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
            <div className="bg-clawd-surface border border-clawd-border rounded-xl p-5">
              <h3 className="font-semibold text-clawd-text mb-2 flex items-center gap-2">
                <Calendar size={16} className="text-clawd-accent" />
                Optimal Posting Times
              </h3>
              <p className="text-sm text-clawd-text-dim mb-4">
                Engagement heatmap showing when your audience is most active
              </p>
              
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  {/* Hour labels */}
                  <div className="flex ml-12 mb-2">
                    {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => (
                      <div key={hour} className="flex-1 text-xs text-clawd-text-dim text-center">
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>
                  
                  {/* Heatmap grid */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, dayIndex) => (
                    <div key={day} className="flex items-center mb-1">
                      <div className="w-10 text-xs text-clawd-text-dim text-right pr-2">{day}</div>
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
                                backgroundColor: value === 0 ? '#1f2937' : `rgba(59, 130, 246, ${intensity})`,
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
                    <span className="text-xs text-clawd-text-dim">Low</span>
                    <div className="flex gap-0.5">
                      {[0.2, 0.4, 0.6, 0.8, 1].map((intensity) => (
                        <div
                          key={intensity}
                          className="w-6 h-4 rounded-sm"
                          style={{ backgroundColor: `rgba(59, 130, 246, ${intensity})` }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-clawd-text-dim">High</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Best Times Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-clawd-surface border border-clawd-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={16} className="text-warning" />
                  <span className="text-sm text-clawd-text-dim">Best Day</span>
                </div>
                <div className="text-2xl font-bold text-clawd-text">Tuesday</div>
                <div className="text-sm text-clawd-text-dim">Highest average engagement</div>
              </div>
              <div className="bg-clawd-surface border border-clawd-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={16} className="text-info" />
                  <span className="text-sm text-clawd-text-dim">Best Time</span>
                </div>
                <div className="text-2xl font-bold text-clawd-text">2:00 PM</div>
                <div className="text-sm text-clawd-text-dim">Peak engagement window</div>
              </div>
              <div className="bg-clawd-surface border border-clawd-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={16} className="text-success" />
                  <span className="text-sm text-clawd-text-dim">Best Day + Time</span>
                </div>
                <div className="text-2xl font-bold text-clawd-text">Tue 8-10 PM</div>
                <div className="text-sm text-clawd-text-dim">Optimal posting slot</div>
              </div>
            </div>
          </div>
        )}

        {view === 'insights' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-clawd-text flex items-center gap-2">
              <Lightbulb size={16} className="text-warning" />
              AI-Powered Suggestions
            </h3>
            <div className="grid gap-4">
              {data.suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="bg-clawd-surface border border-clawd-border rounded-xl p-5"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">{suggestion.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-clawd-text">{suggestion.title}</h4>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          suggestion.impact === 'high' ? 'bg-success-subtle text-success' :
                          suggestion.impact === 'medium' ? 'bg-warning-subtle text-warning' :
                          'bg-clawd-border text-clawd-text-dim'
                        }`}>
                          {suggestion.impact} impact
                        </span>
                      </div>
                      <p className="text-sm text-clawd-text-dim">{suggestion.description}</p>
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
