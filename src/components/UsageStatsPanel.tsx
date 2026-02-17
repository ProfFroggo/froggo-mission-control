// LEGACY: UsageStatsPanel uses file-level suppression for intentional patterns.
// loadStats is redefined on each render but captures latest state - safe pattern.
// Review: 2026-02-17 - suppression retained, pattern is safe

import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Users,
  Activity,
  TrendingUp,
  Mail,
  Phone,
  MessageCircle,
  RefreshCw,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface UsageStats {
  totalMessages: number;
  totalSessions: number;
  activeChannels: number;
  messagesPerDay: { date: string; count: number }[];
  channelBreakdown: { channel: string; count: number }[];
  peakHours: { hour: number; count: number }[];
  avgResponseTime: number;
  totalConversations: number;
}

export default function UsageStatsPanel() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    loadStats();
  }, [timeRange]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const dbExec = window.clawdbot?.db?.exec;
      if (!dbExec) throw new Error('Database not available');

      const cutoffDate = Date.now() - timeRange * 24 * 60 * 60 * 1000;

      // Total messages
      const msgResult = await dbExec(
        'SELECT COUNT(*) as count FROM messages WHERE timestamp >= ?',
        [cutoffDate]
      );

      // Messages per day
      const dailyResult = await dbExec(`
        SELECT 
          date(timestamp / 1000, 'unixepoch') as date,
          COUNT(*) as count
        FROM messages
        WHERE timestamp >= ?
        GROUP BY date
        ORDER BY date
      `, [cutoffDate]);

      // Channel breakdown
      const channelResult = await dbExec(`
        SELECT 
          CASE 
            WHEN session_key LIKE '%whatsapp%' THEN 'WhatsApp'
            WHEN session_key LIKE '%telegram%' THEN 'Telegram'
            WHEN session_key LIKE '%discord%' THEN 'Discord'
            WHEN session_key LIKE '%webchat%' THEN 'Web Chat'
            ELSE 'Other'
          END as channel,
          COUNT(*) as count
        FROM messages
        WHERE timestamp >= ?
        GROUP BY channel
      `, [cutoffDate]);

      // Peak hours
      const hoursResult = await dbExec(`
        SELECT 
          CAST(strftime('%H', timestamp / 1000, 'unixepoch') AS INTEGER) as hour,
          COUNT(*) as count
        FROM messages
        WHERE timestamp >= ?
        GROUP BY hour
        ORDER BY hour
      `, [cutoffDate]);

      // Total sessions
      const sessionsResult = await dbExec(
        'SELECT COUNT(DISTINCT session_key) as count FROM messages WHERE timestamp >= ?',
        [cutoffDate]
      );

      // Active channels
      const activeChannelsResult = await dbExec(`
        SELECT COUNT(DISTINCT 
          CASE 
            WHEN session_key LIKE '%whatsapp%' THEN 'WhatsApp'
            WHEN session_key LIKE '%telegram%' THEN 'Telegram'
            WHEN session_key LIKE '%discord%' THEN 'Discord'
            WHEN session_key LIKE '%webchat%' THEN 'Web Chat'
            ELSE 'Other'
          END
        ) as count
        FROM messages
        WHERE timestamp >= ?
      `, [cutoffDate]);

      // Avg response time (simplified - time between consecutive messages)
      const responseTimeResult = await dbExec(`
        SELECT AVG(time_diff) as avg
        FROM (
          SELECT 
            (timestamp - LAG(timestamp) OVER (PARTITION BY session_key ORDER BY timestamp)) / 1000.0 / 60.0 as time_diff
          FROM messages
          WHERE timestamp >= ?
        )
        WHERE time_diff IS NOT NULL AND time_diff < 60
      `, [cutoffDate]);

      setStats({
        totalMessages: msgResult?.result?.[0]?.count || 0,
        totalSessions: sessionsResult?.result?.[0]?.count || 0,
        activeChannels: activeChannelsResult?.result?.[0]?.count || 0,
        messagesPerDay: dailyResult?.result || [],
        channelBreakdown: channelResult?.result || [],
        peakHours: hoursResult?.result || [],
        avgResponseTime: responseTimeResult?.result?.[0]?.avg || 0,
        totalConversations: sessionsResult?.result?.[0]?.count || 0,
      });
    } catch (error) {
      // 'Failed to load usage stats:', error;
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-clawd-text-dim">
          <RefreshCw size={20} className="animate-spin" />
          Loading usage statistics...
        </div>
      </div>
    );
  }

  const avgMessagesPerDay = stats.messagesPerDay.length > 0
    ? Math.round(stats.totalMessages / stats.messagesPerDay.length)
    : 0;

  const topChannel = stats.channelBreakdown.length > 0
    ? stats.channelBreakdown.reduce((a, b) => (a.count > b.count ? a : b))
    : null;

  const peakHour = stats.peakHours.length > 0
    ? stats.peakHours.reduce((a, b) => (a.count > b.count ? a : b))
    : null;

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="text-clawd-accent" size={20} />
            Usage Statistics
          </h2>
          <p className="text-sm text-clawd-text-dim mt-1">
            Comprehensive usage metrics and activity tracking
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-clawd-border rounded-lg p-1">
            {([7, 30, 90] as const).map((days) => (
              <button
                key={days}
                onClick={() => setTimeRange(days)}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  timeRange === days
                    ? 'bg-clawd-accent text-white'
                    : 'text-clawd-text-dim hover:text-clawd-text'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>

          <button
            onClick={loadStats}
            className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <MessageSquare size={20} className="text-info" />
            <TrendingUp size={16} className="text-success" />
          </div>
          <div className="text-3xl font-bold text-info mb-1">
            {stats.totalMessages.toLocaleString()}
          </div>
          <div className="text-sm text-clawd-text-dim">Total Messages</div>
          <div className="mt-2 text-xs text-clawd-text-dim">
            ~{avgMessagesPerDay}/day avg
          </div>
        </div>

        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <Users size={20} className="text-review" />
            <MessageCircle size={16} className="text-info" />
          </div>
          <div className="text-3xl font-bold text-review mb-1">
            {stats.totalConversations}
          </div>
          <div className="text-sm text-clawd-text-dim">Conversations</div>
          <div className="mt-2 text-xs text-clawd-text-dim">
            {stats.activeChannels} active channels
          </div>
        </div>

        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <Phone size={20} className="text-success" />
            <Activity size={16} className="text-warning" />
          </div>
          <div className="text-3xl font-bold text-success mb-1">
            {topChannel?.channel || 'N/A'}
          </div>
          <div className="text-sm text-clawd-text-dim">Top Channel</div>
          <div className="mt-2 text-xs text-clawd-text-dim">
            {topChannel?.count.toLocaleString() || 0} messages
          </div>
        </div>

        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <Mail size={20} className="text-warning" />
            <TrendingUp size={16} className="text-success" />
          </div>
          <div className="text-3xl font-bold text-warning mb-1">
            {stats.avgResponseTime.toFixed(1)}m
          </div>
          <div className="text-sm text-clawd-text-dim">Avg Response Time</div>
          <div className="mt-2 text-xs text-clawd-text-dim">
            Between messages
          </div>
        </div>
      </div>

      {/* Messages Over Time Chart */}
      <div className="bg-clawd-surface border border-clawd-border rounded-2xl p-6 mb-6">
        <h3 className="font-semibold mb-4">Messages Over Time</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={stats.messagesPerDay}>
            <defs>
              <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--clawd-border)" />
            <XAxis
              dataKey="date"
              stroke="#9CA3AF"
              tickFormatter={(date) =>
                new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
            />
            <YAxis stroke="#9CA3AF" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--clawd-surface)',
                border: '1px solid var(--clawd-border)',
                borderRadius: '8px',
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#3B82F6"
              fillOpacity={1}
              fill="url(#colorMessages)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Channel Distribution & Peak Hours */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Channel Breakdown */}
        <div className="bg-clawd-surface border border-clawd-border rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Channel Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.channelBreakdown} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--clawd-border)" />
              <XAxis type="number" stroke="#9CA3AF" />
              <YAxis dataKey="channel" type="category" stroke="#9CA3AF" width={80} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--clawd-surface)',
                  border: '1px solid var(--clawd-border)',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="count" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Peak Hours */}
        <div className="bg-clawd-surface border border-clawd-border rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Activity by Hour</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.peakHours}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--clawd-border)" />
              <XAxis
                dataKey="hour"
                stroke="#9CA3AF"
                tickFormatter={(hour) => `${hour}:00`}
              />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--clawd-surface)',
                  border: '1px solid var(--clawd-border)',
                  borderRadius: '8px',
                }}
                labelFormatter={(hour) => `${hour}:00 - ${hour + 1}:00`}
              />
              <Bar dataKey="count" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-clawd-surface border border-clawd-border rounded-2xl p-6">
        <h3 className="font-semibold mb-4">Insights</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-clawd-bg rounded-xl">
            <div className="text-sm text-clawd-text-dim mb-1">Most active hour</div>
            <div className="font-medium text-lg">
              {peakHour ? `${peakHour.hour}:00 - ${peakHour.hour + 1}:00` : 'N/A'}
            </div>
            {peakHour && (
              <div className="text-sm text-clawd-text-dim mt-1">
                {peakHour.count} messages
              </div>
            )}
          </div>
          <div className="p-4 bg-clawd-bg rounded-xl">
            <div className="text-sm text-clawd-text-dim mb-1">Messages per conversation</div>
            <div className="font-medium text-lg">
              {stats.totalConversations > 0
                ? Math.round(stats.totalMessages / stats.totalConversations)
                : 0}
            </div>
            <div className="text-sm text-clawd-text-dim mt-1">
              Average depth
            </div>
          </div>
          <div className="p-4 bg-clawd-bg rounded-xl">
            <div className="text-sm text-clawd-text-dim mb-1">Busiest day</div>
            <div className="font-medium text-lg">
              {stats.messagesPerDay.length > 0
                ? new Date(
                    stats.messagesPerDay.reduce((a, b) => (a.count > b.count ? a : b)).date
                  ).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'N/A'}
            </div>
            <div className="text-sm text-clawd-text-dim mt-1">
              {stats.messagesPerDay.length > 0
                ? stats.messagesPerDay.reduce((a, b) => (a.count > b.count ? a : b)).count
                : 0}{' '}
              messages
            </div>
          </div>
          <div className="p-4 bg-clawd-bg rounded-xl">
            <div className="text-sm text-clawd-text-dim mb-1">Growth trend</div>
            <div className="font-medium text-lg flex items-center gap-2">
              {stats.messagesPerDay.length >= 2 &&
              stats.messagesPerDay[stats.messagesPerDay.length - 1].count >
                stats.messagesPerDay[0].count ? (
                <>
                  <TrendingUp size={20} className="text-success" />
                  <span className="text-success">Increasing</span>
                </>
              ) : (
                <span className="text-clawd-text-dim">Stable</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
