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
import { CHART_COLORS, CHART_AXIS } from '../lib/chartTheme';

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

export default function UsageStatsPanel({ days = 30 }: { days?: number }) {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [days]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const result = await fetch(`/api/analytics/usage-stats?days=${days}`).then(r => r.ok ? r.json() : null).catch(() => null);

      if (result) {
        setStats({
          totalMessages: result.totalMessages || 0,
          totalSessions: result.totalSessions || 0,
          activeChannels: result.activeChannels || 0,
          messagesPerDay: (result.messagesPerDay || []) as { date: string; count: number }[],
          channelBreakdown: (result.channelBreakdown || []) as { channel: string; count: number }[],
          peakHours: (result.peakHours || []) as { hour: number; count: number }[],
          avgResponseTime: result.avgResponseTime || 0,
          totalConversations: result.totalSessions || 0,
        });
      } else {
        // No data available - set empty defaults
        setStats({
          totalMessages: 0,
          totalSessions: 0,
          activeChannels: 0,
          messagesPerDay: [],
          channelBreakdown: [],
          peakHours: [],
          avgResponseTime: 0,
          totalConversations: 0,
        });
      }
    } catch (error) {
      // Failed to load usage stats
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-mission-control-text-dim">
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
            <Activity className="text-mission-control-accent" size={20} />
            Usage Statistics
          </h2>
          <p className="text-sm text-mission-control-text-dim mt-1">
            Comprehensive usage metrics and activity tracking
          </p>
        </div>

        <div className="flex items-center gap-3">

          <button
            onClick={loadStats}
            className="p-2 hover:bg-mission-control-border rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <MessageSquare size={20} className="text-info" />
            <TrendingUp size={16} className="text-success" />
          </div>
          <div className="text-3xl font-bold text-info mb-1 tabular-nums">
            {stats.totalMessages.toLocaleString()}
          </div>
          <div className="text-sm text-mission-control-text-dim">Total Messages</div>
          <div className="mt-2 text-xs text-mission-control-text-dim">
            ~{avgMessagesPerDay}/day avg
          </div>
        </div>

        <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <Users size={20} className="text-review" />
            <MessageCircle size={16} className="text-info" />
          </div>
          <div className="text-3xl font-bold text-review mb-1 tabular-nums">
            {stats.totalConversations}
          </div>
          <div className="text-sm text-mission-control-text-dim">Conversations</div>
          <div className="mt-2 text-xs text-mission-control-text-dim">
            {stats.activeChannels} active channels
          </div>
        </div>

        <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <Phone size={20} className="text-success" />
            <Activity size={16} className="text-warning" />
          </div>
          <div className="text-3xl font-bold text-success mb-1">
            {topChannel?.channel || 'N/A'}
          </div>
          <div className="text-sm text-mission-control-text-dim">Top Channel</div>
          <div className="mt-2 text-xs text-mission-control-text-dim">
            {topChannel?.count.toLocaleString() || 0} messages
          </div>
        </div>

        <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <Mail size={20} className="text-warning" />
            <TrendingUp size={16} className="text-success" />
          </div>
          <div className="text-3xl font-bold text-warning mb-1 tabular-nums">
            {stats.avgResponseTime.toFixed(1)}m
          </div>
          <div className="text-sm text-mission-control-text-dim">Avg Response Time</div>
          <div className="mt-2 text-xs text-mission-control-text-dim">
            Between messages
          </div>
        </div>
      </div>

      {/* Messages Over Time Chart */}
      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6 mb-6">
        <h3 className="font-semibold mb-4">Messages Over Time</h3>
        <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={stats.messagesPerDay}>
            <defs>
              <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.8} />
                <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--mission-control-border)" />
            <XAxis
              dataKey="date"
              stroke={CHART_AXIS.stroke}
              tickFormatter={(date) =>
                new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
            />
            <YAxis stroke={CHART_AXIS.stroke} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--mission-control-surface)',
                border: '1px solid var(--mission-control-border)',
                borderRadius: '8px',
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke={CHART_COLORS.blue}
              fillOpacity={1}
              fill="url(#colorMessages)"
            />
          </AreaChart>
        </ResponsiveContainer>
        </div>
      </div>

      {/* Channel Distribution & Peak Hours */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Channel Breakdown */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Channel Distribution</h3>
          <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.channelBreakdown} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--mission-control-border)" />
              <XAxis type="number" stroke={CHART_AXIS.stroke} />
              <YAxis dataKey="channel" type="category" stroke={CHART_AXIS.stroke} width={80} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--mission-control-surface)',
                  border: '1px solid var(--mission-control-border)',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="count" fill={CHART_COLORS.purple} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Hours */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Activity by Hour</h3>
          <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.peakHours}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--mission-control-border)" />
              <XAxis
                dataKey="hour"
                stroke={CHART_AXIS.stroke}
                tickFormatter={(hour) => `${hour}:00`}
              />
              <YAxis stroke={CHART_AXIS.stroke} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--mission-control-surface)',
                  border: '1px solid var(--mission-control-border)',
                  borderRadius: '8px',
                }}
                labelFormatter={(hour) => `${hour}:00 - ${hour + 1}:00`}
              />
              <Bar dataKey="count" fill={CHART_COLORS.green} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
        <h3 className="font-semibold mb-4">Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-mission-control-bg rounded-lg">
            <div className="text-sm text-mission-control-text-dim mb-1">Most active hour</div>
            <div className="font-medium text-lg tabular-nums">
              {peakHour ? `${peakHour.hour}:00 - ${peakHour.hour + 1}:00` : 'N/A'}
            </div>
            {peakHour && (
              <div className="text-sm text-mission-control-text-dim mt-1">
                {peakHour.count} messages
              </div>
            )}
          </div>
          <div className="p-4 bg-mission-control-bg rounded-lg">
            <div className="text-sm text-mission-control-text-dim mb-1">Messages per conversation</div>
            <div className="font-medium text-lg tabular-nums">
              {stats.totalConversations > 0
                ? Math.round(stats.totalMessages / stats.totalConversations)
                : 0}
            </div>
            <div className="text-sm text-mission-control-text-dim mt-1">
              Average depth
            </div>
          </div>
          <div className="p-4 bg-mission-control-bg rounded-lg">
            <div className="text-sm text-mission-control-text-dim mb-1">Busiest day</div>
            <div className="font-medium text-lg">
              {stats.messagesPerDay.length > 0
                ? new Date(
                    stats.messagesPerDay.reduce((a, b) => (a.count > b.count ? a : b)).date
                  ).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'N/A'}
            </div>
            <div className="text-sm text-mission-control-text-dim mt-1">
              {stats.messagesPerDay.length > 0
                ? stats.messagesPerDay.reduce((a, b) => (a.count > b.count ? a : b)).count
                : 0}{' '}
              messages
            </div>
          </div>
          <div className="p-4 bg-mission-control-bg rounded-lg">
            <div className="text-sm text-mission-control-text-dim mb-1">Growth trend</div>
            <div className="font-medium text-lg flex items-center gap-2">
              {stats.messagesPerDay.length >= 2 &&
              stats.messagesPerDay[stats.messagesPerDay.length - 1].count >
                stats.messagesPerDay[0].count ? (
                <>
                  <TrendingUp size={20} className="text-success" />
                  <span className="text-success">Increasing</span>
                </>
              ) : (
                <span className="text-mission-control-text-dim">Stable</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
