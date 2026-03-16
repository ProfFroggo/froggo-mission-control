// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// PlatformHealthDashboard — modal with health metrics, sparklines, and key stats

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity,
  Cpu,
  Database,
  Zap,
  AlertCircle,
  CheckCircle2,
  Circle,
  RefreshCw,
  Download,
  X,
} from 'lucide-react';
import BaseModal, { BaseModalHeader } from './BaseModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HealthSnapshot {
  database: { status: 'ok' | 'error'; queryTimeMs: number; size: string };
  api: { uptime: number; requestsLastHour: number; errorsLastHour: number; avgResponseMs: number };
  agents: { total: number; active: number; idle: number; error: number };
  tasks: { total: number; completedToday: number; failedToday: number; avgDurationMs: number };
  memory: { heapUsedMb: number; heapTotalMb: number; rss: number };
  sse: { connected: boolean; clientCount: number };
  timestamp: number;
}

interface HistoryResponse {
  snapshots: HealthSnapshot[];
  count: number;
}

type OverallStatus = 'ok' | 'degraded' | 'error';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

function computeOverall(snap: HealthSnapshot): OverallStatus {
  if (snap.database.status === 'error' || snap.agents.error > 0) return 'error';
  if (snap.database.queryTimeMs > 200 || snap.api.errorsLastHour > 5) return 'degraded';
  return 'ok';
}

function statusColor(s: OverallStatus): string {
  if (s === 'ok') return 'text-success';
  if (s === 'degraded') return 'text-warning';
  return 'text-error';
}

function statusDotColor(s: OverallStatus): string {
  if (s === 'ok') return 'bg-success';
  if (s === 'degraded') return 'bg-warning';
  return 'bg-error';
}

function componentStatus(ok: boolean, degraded?: boolean): OverallStatus {
  if (!ok) return 'error';
  if (degraded) return 'degraded';
  return 'ok';
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  label?: string;
  unit?: string;
  currentValue?: string;
}

function Sparkline({ data, width = 120, height = 36, color = 'var(--color-info, #3b82f6)', label, unit = '', currentValue }: SparklineProps) {
  if (data.length < 2) {
    return (
      <div className="flex flex-col gap-1">
        {label && <span className="text-[10px] text-mission-control-text-dim uppercase tracking-wide">{label}</span>}
        <div style={{ width, height }} className="flex items-center justify-center text-[10px] text-mission-control-text-dim">no data</div>
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * w;
      const y = pad + h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] text-mission-control-text-dim uppercase tracking-wide">{label}</span>
          {currentValue && (
            <span className="text-[11px] font-mono font-medium text-mission-control-text tabular-nums">
              {currentValue}{unit}
            </span>
          )}
        </div>
      )}
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <polyline
          points={points}
          stroke={color}
          fill="none"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

// ── Status Row Item ───────────────────────────────────────────────────────────

interface StatusItemProps {
  icon: React.ReactNode;
  label: string;
  status: OverallStatus;
  detail?: string;
}

function StatusItem({ icon, label, status, detail }: StatusItemProps) {
  const StatusIcon =
    status === 'ok' ? CheckCircle2 :
    status === 'degraded' ? AlertCircle :
    AlertCircle;

  const iconColor =
    status === 'ok' ? 'text-success' :
    status === 'degraded' ? 'text-warning' :
    'text-error';

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-mission-control-surface border border-mission-control-border">
      <span className="text-mission-control-text-dim">{icon}</span>
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-xs font-medium text-mission-control-text">{label}</span>
        {detail && <span className="text-[10px] text-mission-control-text-dim truncate">{detail}</span>}
      </div>
      <StatusIcon size={14} className={iconColor} aria-label={status} />
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg bg-mission-control-surface border border-mission-control-border">
      <span className="text-[10px] uppercase tracking-wide text-mission-control-text-dim">{label}</span>
      <span className="text-base font-semibold text-mission-control-text tabular-nums font-mono">{value}</span>
      {sub && <span className="text-[10px] text-mission-control-text-dim">{sub}</span>}
    </div>
  );
}

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportCsv(snapshots: HealthSnapshot[]): void {
  const header = [
    'timestamp',
    'db_status', 'db_query_ms', 'db_size',
    'api_uptime', 'api_requests', 'api_errors', 'api_avg_ms',
    'agents_total', 'agents_active', 'agents_idle', 'agents_error',
    'tasks_total', 'tasks_completed_today', 'tasks_failed_today', 'tasks_avg_duration_ms',
    'memory_heap_used_mb', 'memory_heap_total_mb', 'memory_rss_mb',
    'sse_client_count',
  ].join(',');

  const rows = snapshots.map(s => [
    new Date(s.timestamp).toISOString(),
    s.database.status, s.database.queryTimeMs, `"${s.database.size}"`,
    s.api.uptime.toFixed(0), s.api.requestsLastHour, s.api.errorsLastHour, s.api.avgResponseMs,
    s.agents.total, s.agents.active, s.agents.idle, s.agents.error,
    s.tasks.total, s.tasks.completedToday, s.tasks.failedToday, s.tasks.avgDurationMs,
    s.memory.heapUsedMb, s.memory.heapTotalMb, s.memory.rss,
    s.sse.clientCount,
  ].join(','));

  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `platform-health-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Component ────────────────────────────────────────────────────────────

interface PlatformHealthDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const SPARKLINE_WIDTH = 130;
const SPARKLINE_HEIGHT = 40;

export default function PlatformHealthDashboard({ isOpen, onClose }: PlatformHealthDashboardProps) {
  const [current, setCurrent] = useState<HealthSnapshot | null>(null);
  const [history, setHistory] = useState<HealthSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsRes, historyRes] = await Promise.all([
        fetch('/api/health/metrics'),
        fetch('/api/health/history'),
      ]);
      if (metricsRes.ok) {
        const snap: HealthSnapshot = await metricsRes.json();
        setCurrent(snap);
        setLastUpdated(new Date());
      }
      if (historyRes.ok) {
        const hist: HistoryResponse = await historyRes.json();
        setHistory(hist.snapshots);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    fetchMetrics();
    intervalRef.current = setInterval(fetchMetrics, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOpen, fetchMetrics]);

  const overall = current ? computeOverall(current) : 'ok';

  // Extract sparkline series from history
  const responseTimeSeries = history.map(s => s.api.avgResponseMs);
  const activeAgentsSeries = history.map(s => s.agents.active);
  const completionRateSeries = history.map(s =>
    s.tasks.completedToday + s.tasks.failedToday > 0
      ? Math.round((s.tasks.completedToday / (s.tasks.completedToday + s.tasks.failedToday)) * 100)
      : 100
  );
  const memUsageSeries = history.map(s => s.memory.heapUsedMb);

  // Derived stats
  const errorRate = current
    ? current.api.requestsLastHour > 0
      ? ((current.api.errorsLastHour / current.api.requestsLastHour) * 100).toFixed(1)
      : '0.0'
    : '—';

  const agentUtilization = current && current.agents.total > 0
    ? Math.round((current.agents.active / current.agents.total) * 100)
    : 0;

  const completionRate =
    current && (current.tasks.completedToday + current.tasks.failedToday) > 0
      ? Math.round((current.tasks.completedToday / (current.tasks.completedToday + current.tasks.failedToday)) * 100)
      : null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      ariaLabel="Platform health dashboard"
      showCloseButton={false}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-mission-control-border">
        <Activity size={18} className="text-mission-control-accent flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-mission-control-text">Platform Health</h2>
          {lastUpdated && (
            <p className="text-[11px] text-mission-control-text-dim">
              Last updated {lastUpdated.toLocaleTimeString()} — auto-refresh every 30s
            </p>
          )}
        </div>

        {/* Overall status pill */}
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
          overall === 'ok'
            ? 'bg-success-subtle border-success/30 text-success'
            : overall === 'degraded'
            ? 'bg-warning-subtle border-warning/30 text-warning'
            : 'bg-error-subtle border-error/30 text-error'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor(overall)}`} />
          {overall === 'ok' ? 'Healthy' : overall === 'degraded' ? 'Degraded' : 'Error'}
        </span>

        {/* Refresh button */}
        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-mission-control-border transition-colors text-mission-control-text-dim hover:text-mission-control-text disabled:opacity-50"
          title="Refresh metrics"
          type="button"
          aria-label="Refresh metrics"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>

        {/* Export CSV */}
        <button
          onClick={() => exportCsv(history)}
          disabled={history.length === 0}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-mission-control-surface border border-mission-control-border hover:bg-mission-control-border transition-colors text-mission-control-text disabled:opacity-40"
          title="Export metrics as CSV"
          type="button"
        >
          <Download size={12} aria-hidden="true" />
          Export
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-mission-control-border transition-colors text-mission-control-text-dim hover:text-mission-control-text"
          type="button"
          aria-label="Close health dashboard"
        >
          <X size={14} />
        </button>
      </div>

      <div className="overflow-y-auto p-6 flex flex-col gap-6" style={{ maxHeight: 'calc(90vh - 64px)' }}>
        {/* ── Traffic light status row ── */}
        <section>
          <h3 className="text-[11px] uppercase tracking-widest text-mission-control-text-dim mb-3 font-medium">Component Status</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatusItem
              icon={<Database size={13} />}
              label="Database"
              status={current ? componentStatus(current.database.status === 'ok', current.database.queryTimeMs > 200) : 'ok'}
              detail={current ? `${current.database.queryTimeMs}ms · ${current.database.size}` : undefined}
            />
            <StatusItem
              icon={<Zap size={13} />}
              label="API"
              status={current ? componentStatus(true, current.api.errorsLastHour > 5) : 'ok'}
              detail={current ? `${current.api.avgResponseMs}ms avg` : undefined}
            />
            <StatusItem
              icon={<Circle size={13} />}
              label="Agents"
              status={current ? componentStatus(current.agents.error === 0, current.agents.active === 0 && current.agents.total > 0) : 'ok'}
              detail={current ? `${current.agents.active}/${current.agents.total} active` : undefined}
            />
            <StatusItem
              icon={<Activity size={13} />}
              label="Tasks"
              status={current ? componentStatus(current.tasks.failedToday === 0, current.tasks.failedToday > 0) : 'ok'}
              detail={current ? `${current.tasks.completedToday} done today` : undefined}
            />
          </div>
        </section>

        {/* ── Sparkline charts ── */}
        <section>
          <h3 className="text-[11px] uppercase tracking-widest text-mission-control-text-dim mb-3 font-medium">Trends (last {history.length} samples)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-mission-control-surface border border-mission-control-border">
            <Sparkline
              data={responseTimeSeries}
              width={SPARKLINE_WIDTH}
              height={SPARKLINE_HEIGHT}
              color="var(--color-info, #3b82f6)"
              label="API Response"
              unit="ms"
              currentValue={current ? String(current.api.avgResponseMs) : undefined}
            />
            <Sparkline
              data={activeAgentsSeries}
              width={SPARKLINE_WIDTH}
              height={SPARKLINE_HEIGHT}
              color="var(--color-success, #22c55e)"
              label="Active Agents"
              currentValue={current ? String(current.agents.active) : undefined}
            />
            <Sparkline
              data={completionRateSeries}
              width={SPARKLINE_WIDTH}
              height={SPARKLINE_HEIGHT}
              color="var(--mission-control-accent, #22c55e)"
              label="Task Completion"
              unit="%"
              currentValue={completionRate !== null ? String(completionRate) : '—'}
            />
            <Sparkline
              data={memUsageSeries}
              width={SPARKLINE_WIDTH}
              height={SPARKLINE_HEIGHT}
              color="var(--color-warning, #f59e0b)"
              label="Heap Used"
              unit="MB"
              currentValue={current ? String(current.memory.heapUsedMb) : undefined}
            />
          </div>
        </section>

        {/* ── Key stats grid ── */}
        {current && (
          <section>
            <h3 className="text-[11px] uppercase tracking-widest text-mission-control-text-dim mb-3 font-medium">Key Metrics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatCard
                label="Uptime"
                value={formatUptime(current.api.uptime)}
              />
              <StatCard
                label="Requests / hr"
                value={current.api.requestsLastHour.toLocaleString()}
                sub={`${current.api.errorsLastHour} errors`}
              />
              <StatCard
                label="Error Rate"
                value={`${errorRate}%`}
                sub={current.api.errorsLastHour > 0 ? 'errors last hour' : 'clean'}
              />
              <StatCard
                label="Agent Utilization"
                value={`${agentUtilization}%`}
                sub={`${current.agents.active} of ${current.agents.total} active`}
              />
              <StatCard
                label="Tasks Today"
                value={String(current.tasks.completedToday)}
                sub={`${current.tasks.failedToday} failed`}
              />
              <StatCard
                label="Avg Task Duration"
                value={current.tasks.avgDurationMs > 0
                  ? current.tasks.avgDurationMs < 60_000
                    ? `${(current.tasks.avgDurationMs / 1000).toFixed(0)}s`
                    : `${(current.tasks.avgDurationMs / 60_000).toFixed(1)}m`
                  : '—'}
              />
              <StatCard
                label="Heap Used"
                value={`${current.memory.heapUsedMb} MB`}
                sub={`of ${current.memory.heapTotalMb} MB total`}
              />
              <StatCard
                label="SSE Clients"
                value={String(current.sse.clientCount)}
                sub={current.sse.connected ? 'connected' : 'none connected'}
              />
            </div>
          </section>
        )}

        {!current && !loading && (
          <div className="flex items-center justify-center py-12 text-mission-control-text-dim text-sm">
            <Activity size={16} className="mr-2" aria-hidden="true" />
            No metrics available yet
          </div>
        )}

        {loading && !current && (
          <div className="flex items-center justify-center py-12 text-mission-control-text-dim text-sm">
            <RefreshCw size={16} className="mr-2 animate-spin" aria-hidden="true" />
            Loading metrics...
          </div>
        )}
      </div>
    </BaseModal>
  );
}
