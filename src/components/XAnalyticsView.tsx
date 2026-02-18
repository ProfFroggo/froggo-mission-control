import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, Eye, Activity, Download, Users, RefreshCw } from 'lucide-react';

interface AnalyticsSummary {
  totalPosts: number;
  totalApproved: number;
  totalDrafts: number;
  engagementRate: number;
  reach: number;
  impressions: number;
}

interface ContentPost {
  id: string;
  content: string;
  status: string;
  created_at: number;
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
      const [summaryResult, topContentResult] = await Promise.all([
        (window as any).clawdbot?.xAnalytics?.summary(),
        (window as any).clawdbot?.xAnalytics?.topContent(),
      ]);
      if (summaryResult?.success !== false) {
        setSummary(summaryResult || { totalPosts: 0, totalApproved: 0, totalDrafts: 0, engagementRate: 0, reach: 0, impressions: 0 });
      }
      if (topContentResult?.success !== false) {
        setTopContent(topContentResult?.posts || []);
      }
    } catch {
      setSummary({ totalPosts: 0, totalApproved: 0, totalDrafts: 0, engagementRate: 0, reach: 0, impressions: 0 });
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
      `X/Twitter Daily Insights Report — ${date}`,
      '='.repeat(50),
      '',
      '## Performance Summary',
      `Total Posts: ${summary?.totalPosts ?? 0}`,
      `Engagement Rate: ${summary?.engagementRate ?? 0}%`,
      `Reach: ${(summary?.reach ?? 0).toLocaleString()}`,
      `Impressions: ${(summary?.impressions ?? 0).toLocaleString()}`,
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

  const statCards = [
    {
      label: 'Total Posts',
      value: summary?.totalPosts ?? 0,
      icon: BarChart2,
      format: (v: number) => v.toString(),
      color: 'text-clawd-accent',
      bg: 'bg-clawd-accent/10',
    },
    {
      label: 'Engagement Rate',
      value: summary?.engagementRate ?? 0,
      icon: TrendingUp,
      format: (v: number) => `${v.toFixed(1)}%`,
      color: 'text-success',
      bg: 'bg-success-subtle',
    },
    {
      label: 'Reach',
      value: summary?.reach ?? 0,
      icon: Eye,
      format: (v: number) => v.toLocaleString(),
      color: 'text-info',
      bg: 'bg-info-subtle',
    },
    {
      label: 'Impressions',
      value: summary?.impressions ?? 0,
      icon: Activity,
      format: (v: number) => v.toLocaleString(),
      color: 'text-review',
      bg: 'bg-review-subtle',
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-clawd-bg">
      <div className="max-w-5xl mx-auto p-6 space-y-6 w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-clawd-accent/10 rounded-xl">
              <BarChart2 size={24} className="text-clawd-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-clawd-text">X Analytics</h1>
              <p className="text-sm text-clawd-text-dim">Performance overview for your X/Twitter account</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 rounded-lg border border-clawd-border hover:bg-clawd-surface transition-colors text-clawd-text-dim hover:text-clawd-text"
              title="Refresh data"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/80 transition-colors text-sm font-medium"
            >
              <Download size={16} />
              Download Report
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-clawd-accent" />
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.label}
                    className="bg-clawd-surface rounded-xl border border-clawd-border p-5"
                  >
                    <div className={`inline-flex p-2 rounded-lg ${card.bg} mb-3`}>
                      <Icon size={20} className={card.color} />
                    </div>
                    <div className="text-2xl font-bold text-clawd-text mb-1">
                      {card.format(card.value)}
                    </div>
                    <div className="text-sm text-clawd-text-dim">{card.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Top Content */}
            <div className="bg-clawd-surface rounded-xl border border-clawd-border">
              <div className="p-5 border-b border-clawd-border">
                <h2 className="font-semibold text-clawd-text">Top Content</h2>
                <p className="text-sm text-clawd-text-dim mt-0.5">Recent posted and approved tweets</p>
              </div>
              <div className="divide-y divide-clawd-border">
                {topContent.length === 0 ? (
                  <div className="p-8 text-center text-clawd-text-dim">
                    <BarChart2 size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No published content yet</p>
                    <p className="text-xs mt-1">Content will appear here once tweets are posted</p>
                  </div>
                ) : (
                  topContent.map((post) => (
                    <div key={post.id} className="p-4 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-clawd-text line-clamp-2">
                          {post.content.slice(0, 120)}{post.content.length > 120 ? '...' : ''}
                        </p>
                        <p className="text-xs text-clawd-text-dim mt-1">
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
            <div className="bg-clawd-surface rounded-xl border border-clawd-border">
              <div className="p-5 border-b border-clawd-border flex items-center gap-2">
                <Users size={18} className="text-clawd-text-dim" />
                <div>
                  <h2 className="font-semibold text-clawd-text">Competitor Insights</h2>
                  <p className="text-sm text-clawd-text-dim mt-0.5">Benchmarking against similar accounts</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-clawd-border">
                      <th className="text-left p-4 text-xs uppercase tracking-wide text-clawd-text-dim font-medium">Account</th>
                      <th className="text-left p-4 text-xs uppercase tracking-wide text-clawd-text-dim font-medium">Followers</th>
                      <th className="text-left p-4 text-xs uppercase tracking-wide text-clawd-text-dim font-medium">Avg. Engagement</th>
                      <th className="text-left p-4 text-xs uppercase tracking-wide text-clawd-text-dim font-medium">Post Frequency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-clawd-border">
                    {MOCK_COMPETITORS.map((c) => (
                      <tr key={c.account} className="hover:bg-clawd-bg/50 transition-colors">
                        <td className="p-4 text-clawd-text font-medium">{c.account}</td>
                        <td className="p-4 text-clawd-text-dim">{c.followers}</td>
                        <td className="p-4 text-clawd-text-dim">{c.engagement}</td>
                        <td className="p-4 text-clawd-text-dim">{c.frequency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 pb-4 pt-2">
                <p className="text-xs text-clawd-text-dim italic">
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
