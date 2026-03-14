// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';
import { Users, Loader2, Download, Copy, Check } from 'lucide-react';

interface DailyPoint {
  date: string;
  tasks: number;
  successRate: number;
  tokens: number;
}

interface AgentData {
  id: string;
  name: string;
  daily: DailyPoint[];
}

interface Props {
  days?: number;
}

const CHART_H = 220;
const CHART_PADDING = { top: 16, right: 16, bottom: 40, left: 48 };
const CHART_W = 700;

const AGENT_COLORS = [
  '#6366f1', // indigo
  '#22c55e', // green
  '#f59e0b', // amber
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#8b5cf6', // violet
  '#06b6d4', // cyan
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
}

function buildBomCsv(agents: AgentData[]): string {
  const BOM = '\uFEFF';
  const header = 'Agent,Date,Tasks,Success Rate (%),Tokens\n';
  const rows = agents
    .flatMap((a) =>
      a.daily.map((d) => `${a.name},${d.date},${d.tasks},${d.successRate},${d.tokens}`)
    )
    .join('\n');
  return BOM + header + rows;
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function totalTasks(agent: AgentData): number {
  return agent.daily.reduce((s, d) => s + d.tasks, 0);
}

function avgDaily(agent: AgentData): number {
  if (agent.daily.length === 0) return 0;
  return Math.round((totalTasks(agent) / agent.daily.length) * 10) / 10;
}

function avgSuccessRate(agent: AgentData): number {
  const valid = agent.daily.filter((d) => d.tasks > 0);
  if (valid.length === 0) return 0;
  return Math.round((valid.reduce((s, d) => s + d.successRate, 0) / valid.length) * 10) / 10;
}

export default function AgentTrendsChart({ days = 30 }: Props) {
  const [data, setData] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/agent-trends?days=${days}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { agents: AgentData[] };
      setData(json.agents ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleAgent(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleExportCsv() {
    downloadCsv(buildBomCsv(data), `agent-trends-${new Date().toISOString().split('T')[0]}.csv`);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildBomCsv(data));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-mission-control-text-dim" />
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-mission-control-text-dim">
        {error ? 'Failed to load agent trends.' : 'No agent data for this period.'}
      </div>
    );
  }

  // Collect all unique dates across all agents
  const allDates = [...new Set(data.flatMap((a) => a.daily.map((d) => d.date)))].sort();
  const innerW = CHART_W - CHART_PADDING.left - CHART_PADDING.right;
  const innerH = CHART_H - CHART_PADDING.top - CHART_PADDING.bottom;

  const visibleAgents = data.filter((a) => !hidden.has(a.id));

  // Max tasks across all visible agents
  const maxTasks = Math.max(
    ...data.flatMap((a) => a.daily.map((d) => d.tasks)),
    1
  );

  function xPos(dateIdx: number): number {
    if (allDates.length <= 1) return CHART_PADDING.left + innerW / 2;
    return CHART_PADDING.left + (dateIdx / (allDates.length - 1)) * innerW;
  }

  function yPos(val: number): number {
    return CHART_PADDING.top + innerH - (val / maxTasks) * innerH;
  }

  // Y ticks
  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((maxTasks * i) / tickCount)
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-mission-control-accent" />
          <span className="font-medium">Agent Task Trends</span>
          <span className="text-xs text-mission-control-text-dim">last {days} days</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-mission-control-border hover:bg-mission-control-border/80 rounded-lg transition-colors"
            title="Export agent trends as CSV"
          >
            <Download size={12} />
            CSV
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-mission-control-border hover:bg-mission-control-border/80 rounded-lg transition-colors"
            title="Copy to clipboard"
          >
            {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Agent toggles */}
      <div className="flex flex-wrap gap-2">
        {data.map((agent, idx) => {
          const color = AGENT_COLORS[idx % AGENT_COLORS.length];
          const isHidden = hidden.has(agent.id);
          return (
            <button
              key={agent.id}
              onClick={() => toggleAgent(agent.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                isHidden
                  ? 'border-mission-control-border text-mission-control-text-dim bg-transparent opacity-50'
                  : 'border-transparent text-white'
              }`}
              style={isHidden ? {} : { background: color }}
              title={isHidden ? `Show ${agent.name}` : `Hide ${agent.name}`}
            >
              {agent.name}
            </button>
          );
        })}
      </div>

      {/* SVG Line chart */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="w-full"
          style={{ minWidth: '360px', maxHeight: '260px' }}
          aria-label="Agent task trends line chart"
        >
          {/* Grid + Y labels */}
          {yTicks.map((tick) => {
            const y = yPos(tick);
            return (
              <g key={tick}>
                <line
                  x1={CHART_PADDING.left}
                  y1={y}
                  x2={CHART_W - CHART_PADDING.right}
                  y2={y}
                  stroke="var(--color-border, #334155)"
                  strokeWidth={0.5}
                  strokeDasharray="3,3"
                />
                <text
                  x={CHART_PADDING.left - 6}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={9}
                  fill="var(--color-text-dim, #64748b)"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* X-axis labels (every ~5 dates to avoid crowding) */}
          {allDates
            .filter((_, i) => i % Math.max(Math.ceil(allDates.length / 7), 1) === 0)
            .map((date) => {
              const idx = allDates.indexOf(date);
              return (
                <text
                  key={date}
                  x={xPos(idx)}
                  y={CHART_PADDING.top + innerH + 14}
                  textAnchor="middle"
                  fontSize={8}
                  fill="var(--color-text-dim, #64748b)"
                >
                  {formatDate(date)}
                </text>
              );
            })}

          {/* Lines per agent */}
          {visibleAgents.map((agent, agentIdx) => {
            const color = AGENT_COLORS[data.indexOf(agent) % AGENT_COLORS.length];
            const dailyMap = new Map(agent.daily.map((d) => [d.date, d.tasks]));

            const points = allDates
              .map((date, i) => {
                const tasks = dailyMap.get(date);
                if (tasks === undefined) return null;
                return { x: xPos(i), y: yPos(tasks) };
              })
              .filter((p): p is { x: number; y: number } => p !== null);

            if (points.length < 2) return null;

            const pathD = points
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
              .join(' ');

            return (
              <g key={agent.id}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={0.9}
                />
                {/* Dots at data points */}
                {points.map((p, pi) => (
                  <circle key={pi} cx={p.x} cy={p.y} r={2.5} fill={color} opacity={0.85} />
                ))}
              </g>
            );
          })}

          {/* Baseline */}
          <line
            x1={CHART_PADDING.left}
            y1={yPos(0)}
            x2={CHART_W - CHART_PADDING.right}
            y2={yPos(0)}
            stroke="var(--color-border, #334155)"
            strokeWidth={1}
          />
        </svg>
      </div>

      {/* Summary table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs text-mission-control-text-dim border-b border-mission-control-border">
              <th className="pb-2 pr-4">Agent</th>
              <th className="pb-2 pr-4 text-right">Total Tasks</th>
              <th className="pb-2 pr-4 text-right">Avg Daily</th>
              <th className="pb-2 text-right">Avg Success Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.map((agent, idx) => {
              const color = AGENT_COLORS[idx % AGENT_COLORS.length];
              return (
                <tr
                  key={agent.id}
                  className="border-b border-mission-control-border/50 hover:bg-mission-control-border/20 transition-colors"
                >
                  <td className="py-2 pr-4">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} />
                      {agent.name}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right font-medium">{totalTasks(agent)}</td>
                  <td className="py-2 pr-4 text-right text-mission-control-text-dim">
                    {avgDaily(agent)}
                  </td>
                  <td className="py-2 text-right">
                    <span
                      className={
                        avgSuccessRate(agent) >= 80
                          ? 'text-success'
                          : avgSuccessRate(agent) >= 50
                          ? 'text-warning'
                          : 'text-destructive'
                      }
                    >
                      {avgSuccessRate(agent)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
