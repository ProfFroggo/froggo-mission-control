// LEGACY: UsageStatsPanel uses file-level suppression for intentional patterns.
// loadStats is redefined on each render but captures latest state - safe pattern.
// Review: 2026-02-17 - suppression retained, pattern is safe

import { useState, useEffect } from 'react';
import { Flex, Spinner } from '@radix-ui/themes';
import {
  MessageSquare,
  Users,
  Activity,
  TrendingUp,
  Mail,
  Phone,
  MessageCircle,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { CHART_COLORS, CHART_AXIS, CHART_GRID, CHART_MARGIN } from '../lib/chartTheme';
import ChartTooltip from './charts/ChartTooltip';

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
        <Flex align="center" gap="2" className="text-mission-control-text-dim">
          <Spinner size="2" />
          Loading usage statistics...
        </Flex>
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
      <Flex align="center" justify="between" className="mb-6">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2 text-mission-control-text">
            <Activity className="text-mission-control-accent" size={18} />
            Usage Statistics
          </h2>
          <p className="text-xs text-mission-control-text-dim mt-0.5">
            Comprehensive usage metrics and activity tracking
          </p>
        </div>
        <button type="button" onClick={loadStats} aria-label="Refresh" className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
          <RefreshCw size={16} />
        </button>
      </Flex>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
          <Flex align="center" justify="between" className="mb-2">
            <MessageSquare size={18} className="text-info" />
            <TrendingUp size={14} className="text-success" />
          </Flex>
          <div className="text-2xl font-bold tabular-nums text-mission-control-text mb-0.5">
            {stats.totalMessages.toLocaleString()}
          </div>
          <div className="text-xs text-mission-control-text-dim mt-0.5">Total Messages</div>
          <div className="mt-1.5 text-xs text-mission-control-text-dim tabular-nums">
            ~{avgMessagesPerDay}/day avg
          </div>
        </div>

        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
          <Flex align="center" justify="between" className="mb-2">
            <Users size={18} className="text-review" />
            <MessageCircle size={14} className="text-info" />
          </Flex>
          <div className="text-2xl font-bold tabular-nums text-mission-control-text mb-0.5">
            {stats.totalConversations}
          </div>
          <div className="text-xs text-mission-control-text-dim mt-0.5">Conversations</div>
          <div className="mt-1.5 text-xs text-mission-control-text-dim tabular-nums">
            {stats.activeChannels} active channels
          </div>
        </div>

        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
          <Flex align="center" justify="between" className="mb-2">
            <Phone size={18} className="text-success" />
            <Activity size={14} className="text-warning" />
          </Flex>
          <div className="text-2xl font-bold text-mission-control-text mb-0.5">
            {topChannel?.channel || 'N/A'}
          </div>
          <div className="text-xs text-mission-control-text-dim mt-0.5">Top Channel</div>
          <div className="mt-1.5 text-xs text-mission-control-text-dim tabular-nums">
            {topChannel?.count.toLocaleString() || 0} messages
          </div>
        </div>

        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
          <Flex align="center" justify="between" className="mb-2">
            <Mail size={18} className="text-warning" />
            <TrendingUp size={14} className="text-success" />
          </Flex>
          <div className="text-2xl font-bold tabular-nums text-mission-control-text mb-0.5">
            {stats.avgResponseTime.toFixed(1)}m
          </div>
          <div className="text-xs text-mission-control-text-dim mt-0.5">Avg Response Time</div>
          <div className="mt-1.5 text-xs text-mission-control-text-dim">
            Between messages
          </div>
        </div>
      </div>

      {/* Messages Over Time Chart */}
      <div className="bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-mission-control-text-dim" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Messages Over Time</span>
          </div>
          <span className="text-xs text-mission-control-text-dim">daily volume</span>
        </div>
        <div className="px-4 pt-3 pb-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={stats.messagesPerDay} margin={CHART_MARGIN}>
            <defs>
              <linearGradient id="usageGradMessages" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity={0.25} />
                <stop offset="100%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...CHART_GRID} />
            <XAxis
              dataKey="date"
              {...CHART_AXIS}
              tickFormatter={(date) =>
                new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
            />
            <YAxis {...CHART_AXIS} width={28} />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="count"
              name="Messages"
              stroke={CHART_COLORS.blue}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#usageGradMessages)"
              dot={false}
              activeDot={{ r: 4, fill: CHART_COLORS.blue, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
        </div>
      </div>

      {/* Channel Distribution & Peak Hours */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Channel Breakdown */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-mission-control-text-dim" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Channel Distribution</span>
            </div>
          </div>
          <div className="px-4 pt-3 pb-4 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.channelBreakdown} layout="vertical" margin={CHART_MARGIN}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis type="number" {...CHART_AXIS} />
              <YAxis dataKey="channel" type="category" {...CHART_AXIS} width={80} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" name="Messages" fill={CHART_COLORS.purple} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Hours */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-mission-control-text-dim" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Activity by Hour</span>
            </div>
          </div>
          <div className="px-4 pt-3 pb-4 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.peakHours} margin={CHART_MARGIN}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis
                dataKey="hour"
                {...CHART_AXIS}
                tickFormatter={(hour) => `${hour}h`}
              />
              <YAxis {...CHART_AXIS} width={28} />
              <Tooltip
                content={<ChartTooltip labelFormatter={(hour) => `${hour}:00 – ${Number(hour) + 1}:00`} />}
              />
              <Bar dataKey="count" name="Messages" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-mission-control-text-dim" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Insights</span>
          </div>
        </div>
        <div className="px-4 pt-3 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-4 bg-mission-control-border/10 rounded-lg">
            <div className="text-xs text-mission-control-text-dim mb-1">Most active hour</div>
            <div className="font-medium text-base tabular-nums text-mission-control-text">
              {peakHour ? `${peakHour.hour}:00 – ${peakHour.hour + 1}:00` : 'N/A'}
            </div>
            {peakHour && (
              <div className="text-xs text-mission-control-text-dim mt-1 tabular-nums">
                {peakHour.count} messages
              </div>
            )}
          </div>
          <div className="p-4 bg-mission-control-border/10 rounded-lg">
            <div className="text-xs text-mission-control-text-dim mb-1">Messages per conversation</div>
            <div className="font-medium text-base tabular-nums text-mission-control-text">
              {stats.totalConversations > 0
                ? Math.round(stats.totalMessages / stats.totalConversations)
                : 0}
            </div>
            <div className="text-xs text-mission-control-text-dim mt-1">
              Average depth
            </div>
          </div>
          <div className="p-4 bg-mission-control-border/10 rounded-lg">
            <div className="text-xs text-mission-control-text-dim mb-1">Busiest day</div>
            <div className="font-medium text-base text-mission-control-text">
              {stats.messagesPerDay.length > 0
                ? new Date(
                    stats.messagesPerDay.reduce((a, b) => (a.count > b.count ? a : b)).date
                  ).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'N/A'}
            </div>
            <div className="text-xs text-mission-control-text-dim mt-1 tabular-nums">
              {stats.messagesPerDay.length > 0
                ? stats.messagesPerDay.reduce((a, b) => (a.count > b.count ? a : b)).count
                : 0}{' '}
              messages
            </div>
          </div>
          <div className="p-4 bg-mission-control-border/10 rounded-lg">
            <div className="text-xs text-mission-control-text-dim mb-1">Growth trend</div>
            <div className="font-medium text-base flex items-center gap-2 text-mission-control-text">
              {stats.messagesPerDay.length >= 2 &&
              stats.messagesPerDay[stats.messagesPerDay.length - 1].count >
                stats.messagesPerDay[0].count ? (
                <>
                  <TrendingUp size={16} className="text-success" />
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
