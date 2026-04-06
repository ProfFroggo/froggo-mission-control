// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  X, RefreshCw, Play, CheckCircle, XCircle, Clock, ChevronRight, ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { Button, IconButton, Heading, Text, Spinner } from '@radix-ui/themes';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StepResult {
  stepIndex: number;
  type: string;
  status: 'success' | 'failed' | 'skipped';
  startedAt?: number;
  output?: string;
  error?: string;
}

interface AutomationRun {
  id: string;
  automationId: string;
  status: 'success' | 'failed' | 'running';
  startedAt: number;
  completedAt?: number;
  duration?: number;
  stepsRun: number;
  triggeredBy: string;
  stepResults: StepResult[];
}

interface Props {
  automationId: string;
  automationName?: string;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTs(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDuration(ms?: number): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'success': return <CheckCircle size={14} className="text-success flex-shrink-0" />;
    case 'failed':  return <XCircle size={14} className="text-error flex-shrink-0" />;
    case 'running': return <RefreshCw size={14} className="text-mission-control-accent flex-shrink-0 animate-spin" />;
    default:        return <AlertCircle size={14} className="text-mission-control-text-dim flex-shrink-0" />;
  }
}

function statusChipClass(status: string): string {
  switch (status) {
    case 'success': return 'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-success/10 text-success';
    case 'failed':  return 'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-error/10 text-error';
    case 'running': return 'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-mission-control-accent/10 text-mission-control-accent animate-pulse';
    default:        return 'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-mission-control-border/50 text-mission-control-text-dim';
  }
}

// ─── Run row ─────────────────────────────────────────────────────────────────

function RunRow({ run }: { run: AutomationRun }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-mission-control-border/40 last:border-0">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start gap-3 px-4 py-2 text-xs hover:bg-mission-control-surface/50 transition-colors text-left"
      >
        <div className="mt-0.5 flex-shrink-0">
          <StatusIcon status={run.status} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono tabular-nums text-[10px] text-mission-control-text-dim">
              {formatTs(run.startedAt)}
            </span>
            <span className={statusChipClass(run.status)}>
              <span className="w-1.5 h-1.5 rounded-full bg-current inline-block flex-shrink-0" />
              {run.status}
            </span>
            <span className="font-mono tabular-nums text-xs text-mission-control-text-dim">
              {formatDuration(run.duration)}
            </span>
            <span className="text-mission-control-text-dim">
              {run.stepsRun} step{run.stepsRun !== 1 ? 's' : ''}
            </span>
            <span className="text-mission-control-text-dim">
              via {run.triggeredBy}
            </span>
          </div>
        </div>
        {expanded
          ? <ChevronDown size={12} className="text-mission-control-text-dim flex-shrink-0 mt-0.5" />
          : <ChevronRight size={12} className="text-mission-control-text-dim flex-shrink-0 mt-0.5" />}
      </button>

      {expanded && run.stepResults && run.stepResults.length > 0 && (
        <div className="border-t border-mission-control-border/40 bg-mission-control-bg">
          {run.stepResults.map((sr, i) => (
            <div
              key={i}
              className="flex items-start gap-3 px-4 py-2 border-b border-mission-control-border/40 last:border-0 text-xs"
            >
              <div className="mt-0.5 flex-shrink-0">
                <StatusIcon status={sr.status} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-mission-control-text">
                  Step {sr.stepIndex + 1}: {sr.type}
                </span>
                {sr.output && (
                  <p className="text-mission-control-text-dim mt-0.5 m-0">{sr.output}</p>
                )}
                {sr.error && (
                  <p className="text-error mt-0.5 m-0">{sr.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {expanded && (!run.stepResults || run.stepResults.length === 0) && (
        <p className="px-4 py-2 text-xs text-mission-control-text-dim border-t border-mission-control-border/40 m-0">
          No per-step details recorded for this run.
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AutomationRunLog({ automationId, automationName, onClose }: Props) {
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/automations/${automationId}/runs?limit=20`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRuns(Array.isArray(data.runs) ? data.runs : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs');
    } finally {
      setLoading(false);
    }
  }, [automationId]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  const handleRerun = async () => {
    setRerunning(true);
    try {
      await fetch(`/api/automations/${automationId}/run`, { method: 'POST' });
      await fetchRuns();
    } catch (err) {
      console.warn('[AutomationRunLog] Non-critical:', err);
      // silent — run will appear on next refresh
    } finally {
      setRerunning(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        background: 'var(--black-a4)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 520,
          height: '100%',
          background: 'var(--mission-control-bg)',
          borderLeft: '1px solid var(--mission-control-border)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid var(--mission-control-border)',
          }}
        >
          <div>
            <Heading size="4" weight="medium">Run History</Heading>
            {automationName && (
              <Text size="1" className="text-mission-control-text-dim">
                {automationName}
              </Text>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <IconButton variant="surface" size="2" onClick={fetchRuns} title="Refresh">
              <RefreshCw size={14} />
            </IconButton>
            <Button variant="solid" size="2" onClick={handleRerun} disabled={rerunning}>
              <Play size={12} />
              {rerunning ? 'Running...' : 'Re-run'}
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }} className="py-4">
          {loading && (
            <div className="flex items-center justify-center gap-3 py-10 text-mission-control-text-dim">
              <Spinner size="2" />
              <Text size="2">Loading runs...</Text>
            </div>
          )}

          {error && (
            <div className="mx-4 text-[13px] text-error rounded-lg px-3.5 py-3 bg-error-subtle border border-error-border">
              {error}
            </div>
          )}

          {!loading && !error && runs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-5 text-center gap-3">
              <Clock size={32} className="text-mission-control-text-dim opacity-50" />
              <p className="text-sm font-medium m-0 text-mission-control-text">No runs recorded yet.</p>
              <p className="text-xs m-0 text-mission-control-text-dim max-w-[280px]">Click Re-run to execute this automation now.</p>
            </div>
          )}

          {!loading && runs.length > 0 && (
            <div className="mx-4 bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden">
              {runs.map(run => (
                <RunRow key={run.id} run={run} />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
