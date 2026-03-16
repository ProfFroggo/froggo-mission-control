import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, Eye, Activity, Download, Users, RefreshCw } from 'lucide-react';

interface AnalyticsSummary {
  followers: number;
  following: number;
  tweetCount: number;
  totalLikes: number;
  totalRetweets: number;
  totalReplies: number;
  totalImpressions: number;
  engagementRate: number;
  recentTweetCount: number;
  estimated?: boolean;
}

interface ContentPost {
  id: string;
  content: string;
  status: string;
  created_at: number;
  likes?: number;
  retweets?: number;
  impressions?: number;
}

const MOCK_COMPETITORS = [
  { account: '@competitor_alpha', followers: '12.4K', engagement: '2.8%', frequency: '3/day' },
  { account: '@competitor_beta', followers: '8.7K', engagement: '4.1%', frequency: '5/day' },
  { account: '@competitor_gamma', followers: '23.1K', engagement: '1.9%', frequency: '2/day' },
];

export function XAnalyticsView() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [topContent, setTopContent] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/x/analytics');
      if (!res.ok) { setSummary(null); setTopContent([]); return; }
      const data = await res.json();
      const tweets: any[] = data.tweets ?? [];
      const metrics = data.profile?.public_metrics ?? {};
      setSummary({
        followers: metrics.followers_count ?? 0,
        following: metrics.following_count ?? 0,
        tweetCount: metrics.tweet_count ?? 0,
        totalLikes: tweets.reduce((s: number, t: any) => s + (t.public_metrics?.like_count ?? 0), 0),
        totalRetweets: tweets.reduce((s: number, t: any) => s + (t.public_metrics?.retweet_count ?? 0), 0),
        totalReplies: tweets.reduce((s: number, t: any) => s + (t.public_metrics?.reply_count ?? 0), 0),
        totalImpressions: tweets.reduce((s: number, t: any) => s + (t.public_metrics?.impression_count ?? 0), 0),
        engagementRate: 0,
        recentTweetCount: tweets.length,
        estimated: false,
      });
      setTopContent(tweets.slice(0, 10).map((t: any) => ({
        id: t.id,
        content: t.text,
        status: 'posted',
        created_at: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
        likes: t.public_metrics?.like_count ?? 0,
        retweets: t.public_metrics?.retweet_count ?? 0,
        impressions: t.public_metrics?.impression_count ?? 0,
      })));
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDownloadReport = () => {
    const date = new Date().toISOString().slice(0, 10);
    const lines = [
      `Social Media Daily Insights Report — ${date}`,
      '='.repeat(50),
      '',
      '## Performance Summary',
      `Followers: ${(summary?.followers ?? 0).toLocaleString()}`,
      `Total Tweets: ${summary?.tweetCount ?? 0}`,
      `Engagement Rate: ${(summary?.engagementRate ?? 0).toFixed(2)}%`,
      `Total Impressions: ${(summary?.totalImpressions ?? 0).toLocaleString()}`,
      `Total Likes: ${(summary?.totalLikes ?? 0).toLocaleString()}`,
      `Total Retweets: ${(summary?.totalRetweets ?? 0).toLocaleString()}`,
      '',
      '## Top Content',
    ];

    if (topContent.length === 0) {
      lines.push('No published content yet.');
    } else {
      topContent.forEach((post, i) => {
        lines.push(`${i + 1}. [${post.status}] ${post.content.slice(0, 120).replace(/\n/g, ' ')}${post.content.length > 120 ? '...' : ''}`);
        lines.push(`   Published: ${new Date(post.created_at).toLocaleDateString()}`);
      });
    }

    lines.push('');
    lines.push('## Competitor Insights');
    MOCK_COMPETITORS.forEach(c => {
      lines.push(`${c.account} — Followers: ${c.followers}, Engagement: ${c.engagement}, Frequency: ${c.frequency}`);
    });

    lines.push('');
    lines.push('Note: Competitor data requires X API connection for live metrics.');
    lines.push(`Generated: ${new Date().toISOString()}`);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `x-analytics-${date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalEngagements = (summary?.totalLikes ?? 0) + (summary?.totalRetweets ?? 0) + (summary?.totalReplies ?? 0);
  const statCards = [
    {
      label: 'Followers',
      value: summary?.followers ?? 0,
      icon: Users,
      format: (v: number) => v.toLocaleString(),
      color: 'text-mission-control-accent',
      bg: 'bg-mission-control-accent/10',
    },
    {
      label: 'Engagement Rate',
      value: summary?.engagementRate ?? 0,
      icon: TrendingUp,
      format: (v: number) => `${v.toFixed(2)}%`,
      color: 'text-success',
      bg: 'bg-success-subtle',
    },
    {
      label: 'Total Impressions',
      value: summary?.totalImpressions ?? 0,
      icon: Eye,
      format: (v: number) => v.toLocaleString(),
      color: 'text-info',
      bg: 'bg-info-subtle',
    },
    {
      label: 'Total Engagements',
      value: totalEngagements,
      icon: Activity,
      format: (v: number) => v.toLocaleString(),
      color: 'text-review',
      bg: 'bg-review-subtle',
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-mission-control-bg">
      <div className="max-w-5xl mx-auto p-6 space-y-6 w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mission-control-accent/10 rounded-lg">
              <BarChart2 size={24} className="text-mission-control-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-mission-control-text">X Analytics</h1>
              <p className="text-sm text-mission-control-text-dim">Performance overview for your social media account</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 rounded-lg border border-mission-control-border hover:bg-mission-control-surface transition-colors text-mission-control-text-dim hover:text-mission-control-text"
              title="Refresh data"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/80 transition-colors text-sm font-medium"
            >
              <Download size={16} />
              Download Report
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mission-control-accent" />
          </div>
        ) : (
          <>
            {/* Estimated data banner */}
            {summary?.estimated && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm">
                <Activity size={16} />
                <span>Showing estimated metrics. Connect X API for real-time data.</span>
              </div>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.label}
                    className="bg-mission-control-surface rounded-lg border border-mission-control-border p-5"
                  >
                    <div className={`inline-flex p-2 rounded-lg ${card.bg} mb-3`}>
                      <Icon size={20} className={card.color} />
                    </div>
                    <div className="text-2xl font-bold text-mission-control-text mb-1">
                      {card.format(card.value)}
                    </div>
                    <div className="text-sm text-mission-control-text-dim">{card.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Top Content */}
            <div className="bg-mission-control-surface rounded-lg border border-mission-control-border">
              <div className="p-5 border-b border-mission-control-border">
                <h2 className="text-sm font-semibold text-mission-control-text">Top Content</h2>
                <p className="text-sm text-mission-control-text-dim mt-0.5">Recent posted and approved tweets</p>
              </div>
              <div className="divide-y divide-mission-control-border">
                {topContent.length === 0 ? (
                  <div className="p-8 text-center text-mission-control-text-dim">
                    <BarChart2 size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No published content yet</p>
                    <p className="text-xs mt-1">Content will appear here once tweets are posted</p>
                  </div>
                ) : (
                  topContent.map((post) => (
                    <div key={post.id} className="p-4 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-mission-control-text line-clamp-2">
                          {post.content.slice(0, 120)}{post.content.length > 120 ? '...' : ''}
                        </p>
                        <p className="text-xs text-mission-control-text-dim mt-1">
                          {new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                        post.status === 'posted'
                          ? 'bg-success-subtle text-success'
                          : 'bg-info-subtle text-info'
                      }`}>
                        {post.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Competitor Insights */}
            <div className="bg-mission-control-surface rounded-lg border border-mission-control-border">
              <div className="p-5 border-b border-mission-control-border flex items-center gap-2">
                <Users size={18} className="text-mission-control-text-dim" />
                <div>
                  <h2 className="text-sm font-semibold text-mission-control-text">Competitor Insights <span className="text-xs font-normal text-mission-control-text-dim">(Sample data)</span></h2>
                  <p className="text-sm text-mission-control-text-dim mt-0.5">Benchmarking against similar accounts</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mission-control-border">
                      <th className="text-left p-4 text-xs uppercase tracking-wide text-mission-control-text-dim font-medium">Account</th>
                      <th className="text-left p-4 text-xs uppercase tracking-wide text-mission-control-text-dim font-medium">Followers</th>
                      <th className="text-left p-4 text-xs uppercase tracking-wide text-mission-control-text-dim font-medium">Avg. Engagement</th>
                      <th className="text-left p-4 text-xs uppercase tracking-wide text-mission-control-text-dim font-medium">Post Frequency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mission-control-border">
                    {MOCK_COMPETITORS.map((c) => (
                      <tr key={c.account} className="hover:bg-mission-control-bg/50 transition-colors">
                        <td className="p-4 text-mission-control-text font-medium">{c.account}</td>
                        <td className="p-4 text-mission-control-text-dim">{c.followers}</td>
                        <td className="p-4 text-mission-control-text-dim">{c.engagement}</td>
                        <td className="p-4 text-mission-control-text-dim">{c.frequency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 pb-4 pt-2">
                <p className="text-xs text-mission-control-text-dim italic">
                  Connect X API for live competitor data. Currently showing placeholder benchmarks.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default XAnalyticsView;
