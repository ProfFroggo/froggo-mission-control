// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  X, RefreshCw, Play, CheckCircle, XCircle, Clock, ChevronRight, ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { Button, IconButton, Badge, Heading, Text, Spinner } from '@radix-ui/themes';

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
    case 'success': return <CheckCircle size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />;
    case 'failed':  return <XCircle size={14} style={{ color: 'var(--error)', flexShrink: 0 }} />;
    case 'running': return <RefreshCw size={14} style={{ color: 'var(--warning)', flexShrink: 0, animation: 'spin 1s linear infinite' }} />;
    default:        return <AlertCircle size={14} style={{ color: 'var(--mission-control-text-dim)', flexShrink: 0 }} />;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'success': return 'var(--success)';
    case 'failed':  return 'var(--error)';
    case 'running': return 'var(--warning)';
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
      <Button
        variant="ghost"
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'transparent', cursor: 'pointer', textAlign: 'left', justifyContent: 'flex-start', height: 'auto' }}
      >
        <StatusIcon status={run.status} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mission-control-text)', fontVariantNumeric: 'tabular-nums' }}>
              {formatTs(run.startedAt)}
            </span>
            <Badge
              color={run.status === 'success' ? 'grass' : run.status === 'failed' ? 'red' : 'amber'}
              variant="soft"
            >
              {run.status}
            </Badge>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
            <span style={{ fontSize: 12, color: 'var(--mission-control-text-dim)', display: 'flex', alignItems: 'center', gap: 3, fontVariantNumeric: 'tabular-nums' }}>
              <Clock size={10} /> {formatDuration(run.duration)}
            </span>
            <span style={{ fontSize: 12, color: 'var(--mission-control-text-dim)', fontVariantNumeric: 'tabular-nums' }}>
              {run.stepsRun} step{run.stepsRun !== 1 ? 's' : ''} run
            </span>
            <span style={{ fontSize: 12, color: 'var(--mission-control-text-dim)' }}>
              via {run.triggeredBy}
            </span>
          </div>
        </div>
        {expanded
          ? <ChevronDown size={14} style={{ color: 'var(--mission-control-text-dim)', flexShrink: 0 }} />
          : <ChevronRight size={14} style={{ color: 'var(--mission-control-text-dim)', flexShrink: 0 }} />}
      </Button>

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
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mission-control-text)' }}>
                    Step {sr.stepIndex + 1}: {sr.type}
                  </div>
                  {sr.output && (
                    <div style={{ fontSize: 12, color: 'var(--mission-control-text-dim)', marginTop: 2 }}>{sr.output}</div>
                  )}
                  {sr.error && (
                    <div style={{ fontSize: 12, color: 'var(--error)', marginTop: 2 }}>{sr.error}</div>
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
            <Heading size="4" weight="medium">Run History</Heading>
            {automationName && (
              <Text size="1" style={{ color: 'var(--mission-control-text-dim)' }}>
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
            <IconButton variant="ghost" size="2" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 0', justifyContent: 'center', color: 'var(--mission-control-text-dim)' }}>
              <Spinner size="2" />
              <Text size="2">Loading runs...</Text>
            </div>
          )}

          {error && (
            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'color-mix(in srgb, var(--error) 10%, transparent)', color: 'var(--error)', fontSize: 13 }}>
              {error}
            </div>
          )}

          {!loading && !error && runs.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center', gap: 12 }}>
              <Clock size={32} style={{ color: 'var(--mission-control-text-dim)', opacity: 0.5 }} />
              <p style={{ fontSize: 14, fontWeight: 500, margin: 0, color: 'var(--mission-control-text)' }}>No runs recorded yet.</p>
              <p style={{ fontSize: 12, margin: 0, color: 'var(--mission-control-text-dim)', maxWidth: 280 }}>Click Re-run to execute this automation now.</p>
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
