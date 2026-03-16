// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  X, RefreshCw, Play, CheckCircle, XCircle, Clock, ChevronRight, ChevronDown,
  AlertCircle,
} from 'lucide-react';

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
    case 'success': return <CheckCircle size={14} style={{ color: 'var(--status-active, #22c55e)', flexShrink: 0 }} />;
    case 'failed':  return <XCircle size={14} style={{ color: 'var(--status-error, #ef4444)', flexShrink: 0 }} />;
    case 'running': return <RefreshCw size={14} style={{ color: '#f59e0b', flexShrink: 0, animation: 'spin 1s linear infinite' }} />;
    default:        return <AlertCircle size={14} style={{ color: 'var(--mission-control-text-dim)', flexShrink: 0 }} />;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'success': return 'var(--status-active, #22c55e)';
    case 'failed':  return 'var(--status-error, #ef4444)';
    case 'running': return '#f59e0b';
    default:        return 'var(--mission-control-text-dim)';
  }
}

// ─── Run row ─────────────────────────────────────────────────────────────────

function RunRow({ run }: { run: AutomationRun }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        border: '1px solid var(--mission-control-border)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--mission-control-surface)',
      }}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <StatusIcon status={run.status} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mission-control-text)' }}>
              {formatTs(run.startedAt)}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 4,
                color: statusColor(run.status),
                background: `color-mix(in srgb, ${statusColor(run.status)} 15%, transparent)`,
                textTransform: 'uppercase',
              }}
            >
              {run.status}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
            <span style={{ fontSize: 11, color: 'var(--mission-control-text-dim)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={10} /> {formatDuration(run.duration)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--mission-control-text-dim)' }}>
              {run.stepsRun} step{run.stepsRun !== 1 ? 's' : ''} run
            </span>
            <span style={{ fontSize: 11, color: 'var(--mission-control-text-dim)' }}>
              via {run.triggeredBy}
            </span>
          </div>
        </div>
        {expanded
          ? <ChevronDown size={14} style={{ color: 'var(--mission-control-text-dim)', flexShrink: 0 }} />
          : <ChevronRight size={14} style={{ color: 'var(--mission-control-text-dim)', flexShrink: 0 }} />}
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--mission-control-border)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {run.stepResults && run.stepResults.length > 0 ? (
            run.stepResults.map((sr, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: 'var(--mission-control-bg)',
                  border: '1px solid var(--mission-control-border)',
                }}
              >
                <StatusIcon status={sr.status} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--mission-control-text)' }}>
                    Step {sr.stepIndex + 1}: {sr.type}
                  </div>
                  {sr.output && (
                    <div style={{ fontSize: 11, color: 'var(--mission-control-text-dim)', marginTop: 2 }}>{sr.output}</div>
                  )}
                  {sr.error && (
                    <div style={{ fontSize: 11, color: 'var(--status-error, #ef4444)', marginTop: 2 }}>{sr.error}</div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p style={{ fontSize: 12, color: 'var(--mission-control-text-dim)', margin: 0 }}>
              No per-step details recorded for this run.
            </p>
          )}
        </div>
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
    } catch {
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
        background: 'rgba(0,0,0,0.4)',
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
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--mission-control-text)', margin: 0 }}>
              Run History
            </h2>
            {automationName && (
              <p style={{ fontSize: 12, color: 'var(--mission-control-text-dim)', margin: '2px 0 0' }}>
                {automationName}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={fetchRuns}
              title="Refresh"
              style={{
                padding: 6,
                borderRadius: 6,
                border: '1px solid var(--mission-control-border)',
                background: 'var(--mission-control-surface)',
                color: 'var(--mission-control-text-dim)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={handleRerun}
              disabled={rerunning}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                background: rerunning ? 'var(--mission-control-border)' : 'var(--mission-control-accent)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: rerunning ? 'not-allowed' : 'pointer',
              }}
            >
              <Play size={12} />
              {rerunning ? 'Running...' : 'Re-run'}
            </button>
            <button
              onClick={onClose}
              style={{
                padding: 6,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--mission-control-text-dim)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 0', justifyContent: 'center', color: 'var(--mission-control-text-dim)' }}>
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13 }}>Loading runs...</span>
            </div>
          )}

          {error && (
            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'color-mix(in srgb, var(--status-error, #ef4444) 10%, transparent)', color: 'var(--status-error, #ef4444)', fontSize: 13 }}>
              {error}
            </div>
          )}

          {!loading && !error && runs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--mission-control-text-dim)' }}>
              <Clock size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
              <p style={{ fontSize: 14, margin: 0 }}>No runs recorded yet.</p>
              <p style={{ fontSize: 12, margin: '4px 0 0' }}>Click Re-run to execute this automation now.</p>
            </div>
          )}

          {!loading && runs.map(run => (
            <RunRow key={run.id} run={run} />
          ))}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
