import { useState, useEffect } from 'react';
import { Flex } from '@radix-ui/themes';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { Users, Award, Clock, BarChart2, PieChart as PieIcon } from 'lucide-react';
import { getAgentUtilization, AgentUtilization } from '../services/analyticsService';
import {
  CHART_COLORS,
  CHART_GRID,
  CHART_AXIS,
  CHART_MARGIN,
  CHART_PALETTE,
} from '../lib/chartTheme';
import ChartTooltip from './charts/ChartTooltip';
import StatCard from './charts/StatCard';

const AGENT_COLORS: Record<string, string> = {
  coder:      CHART_COLORS.blue,
  researcher: CHART_COLORS.violet,
  writer:     CHART_COLORS.accent,
  chief:      CHART_COLORS.amber,
  unassigned: CHART_COLORS.gray,
};

function getAgentColor(agentId: string, index: number): string {
  return AGENT_COLORS[agentId] ?? CHART_PALETTE[index % CHART_PALETTE.length];
}

// Custom label for donut chart
function DonutLabel({ cx, cy, total }: { cx: number; cy: number; total: number }) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan x={cx} dy="-0.4em" fontSize={22} fontWeight={700} fill="var(--mission-control-text)">
        {total}
      </tspan>
      <tspan x={cx} dy="1.5em" fontSize={10} fill="var(--mission-control-text-dim)">
        total tasks
      </tspan>
    </text>
  );
}

type ViewMode = 'bar' | 'donut';

export default function AgentUtilizationChart() {
  const [data, setData] = useState<AgentUtilization[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('bar');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      setData(await getAgentUtilization());
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-mission-control-accent border-t-transparent animate-spin" />
          <span className="text-xs text-mission-control-text-dim">Loading agent data…</span>
        </div>
      </div>
    );
  }

  const topAgent   = data[0];
  const totalTasks = data.reduce((s, d) => s + d.tasksAssigned, 0);
  const totalHours = data.reduce((s, d) => s + d.totalTimeSpent, 0);
  const avgRate    = data.length
    ? Math.round(data.reduce((s, d) => s + d.completionRate, 0) / data.length)
    : 0;

  return (
    <div className="h-full flex flex-col gap-5">
      {/* Header */}
      <Flex align="center" justify="between">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Users size={16} className="text-mission-control-accent" />
            Agent Utilization
          </h2>
          <p className="text-xs text-mission-control-text-dim mt-0.5">
            Performance metrics per agent
          </p>
        </div>

        <div className="flex items-center border border-mission-control-border rounded-lg overflow-hidden">
          {([['bar', BarChart2], ['donut', PieIcon]] as const).map(([mode, Icon]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs capitalize transition-colors ${
                viewMode === mode
                  ? 'bg-mission-control-accent/10 text-mission-control-accent'
                  : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/50'
              }`}
            >
              <Icon size={12} />
              {mode}
            </button>
          ))}
        </div>
      </Flex>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Top Performer"
          value={topAgent?.agentName ?? '—'}
          icon={<Award size={12} />}
          color={CHART_COLORS.amber}
        />
        <StatCard
          label="Total Tasks"
          value={totalTasks}
          color={CHART_COLORS.blue}
        />
        <StatCard
          label="Total Hours"
          value={totalHours.toFixed(1)}
          unit="h"
          icon={<Clock size={12} />}
          color={CHART_COLORS.cyan}
        />
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
        {viewMode === 'bar' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={CHART_MARGIN} barGap={3} barCategoryGap="30%">
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="agentName" {...CHART_AXIS} />
              <YAxis {...CHART_AXIS} width={28} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
              <Bar dataKey="tasksCompleted"  name="Completed"  fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} />
              <Bar dataKey="tasksInProgress" name="In Progress" fill={CHART_COLORS.amber}  radius={[4, 4, 0, 0]} />
              <Bar dataKey="tasksAssigned"   name="Assigned"    fill={CHART_COLORS.blue}   radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                {data.map((_, i) => {
                  const color = getAgentColor(data[i].agentId, i);
                  return (
                    <radialGradient key={i} id={`donutGrad${i}`} cx="50%" cy="50%" r="50%">
                      <stop offset="0%"   stopColor={color} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.6} />
                    </radialGradient>
                  );
                })}
              </defs>
              <Pie
                data={data}
                dataKey="tasksCompleted"
                nameKey="agentName"
                cx="50%"
                cy="50%"
                innerRadius="52%"
                outerRadius="78%"
                paddingAngle={3}
                labelLine={false}
              >
                {data.map((entry, i) => (
                  <Cell key={entry.agentId} fill={`url(#donutGrad${i})`} stroke="none" />
                ))}
              </Pie>
              {/* Center label */}
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
                <tspan x="50%" dy="-0.4em" fontSize={22} fontWeight={700} fill="var(--mission-control-text)">
                  {data.reduce((s, d) => s + d.tasksCompleted, 0)}
                </tspan>
                <tspan x="50%" dy="1.5em" fontSize={10} fill="var(--mission-control-text-dim)">
                  completed
                </tspan>
              </text>
              <Tooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                formatter={(value) => <span style={{ color: 'var(--mission-control-text-dim)' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Agent table */}
      <div className="bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-mission-control-border">
                <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Agent</th>
                <th className="text-right px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Assigned</th>
                <th className="text-right px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Done</th>
                <th className="text-right px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim w-32">Rate</th>
                <th className="text-right px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Avg</th>
                <th className="text-right px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((agent, i) => {
                const color = getAgentColor(agent.agentId, i);
                const rateColor =
                  agent.completionRate >= 80 ? 'var(--color-success)' :
                  agent.completionRate >= 50 ? 'var(--color-warning)' : 'var(--color-error)';
                return (
                  <tr key={agent.agentId} className="border-b border-mission-control-border/40 last:border-0 hover:bg-mission-control-border/10 transition-colors">
                    <td className="px-4 py-2.5">
                      <Flex align="center" gap="2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="font-medium text-mission-control-text">{agent.agentName}</span>
                      </Flex>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-mission-control-text-dim">{agent.tasksAssigned}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: CHART_COLORS.accent }}>{agent.tasksCompleted}</td>
                    <td className="px-4 py-2.5 text-right">
                      {/* Mini progress bar */}
                      <Flex align="center" justify="end" gap="2">
                        <div className="w-16 h-1.5 rounded-full bg-mission-control-border overflow-hidden">
                          <div
                            className="h-full rounded-full transition-colors"
                            style={{ width: `${Math.min(agent.completionRate, 100)}%`, backgroundColor: rateColor }}
                          />
                        </div>
                        <span className="tabular-nums w-8 text-right" style={{ color: rateColor }}>
                          {agent.completionRate}%
                        </span>
                      </Flex>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-mission-control-text-dim">{agent.avgCompletionTime.toFixed(1)}h</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: CHART_COLORS.amber }}>{agent.totalTimeSpent.toFixed(1)}h</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Avg completion rate footer */}
      <Flex align="center" justify="between" className="px-1 text-xs text-mission-control-text-dim">
        <span>Average completion rate across all agents</span>
        <span className="font-semibold tabular-nums" style={{ color: CHART_COLORS.accent }}>{avgRate}%</span>
      </Flex>
    </div>
  );
}
