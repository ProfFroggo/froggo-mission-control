'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, CheckCircle, XCircle, Clock, Play,
  ChevronDown, ChevronRight, RefreshCw,
} from 'lucide-react';
import { wsClient, type ExecutionResult } from '@/lib/workflow-studio-client';
import { useCanvasStore } from './store';

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  completed: { icon: CheckCircle, color: 'var(--color-success)', label: 'Completed' },
  failed: { icon: XCircle, color: 'var(--color-error)', label: 'Failed' },
  running: { icon: Loader2, color: 'var(--color-warning)', label: 'Running' },
  cancelled: { icon: XCircle, color: 'var(--color-muted)', label: 'Cancelled' },
};

export default function RunsTab() {
  const workflowId = useCanvasStore((s) => s.workflowId);
  const [executions, setExecutions] = useState<ExecutionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadExecutions = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    try {
      const execs = await wsClient.listExecutions(workflowId);
      setExecutions(execs);
    } catch {
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    loadExecutions();
  }, [loadExecutions]);

  if (!workflowId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-mission-control-text-dim">Open a workflow to see its run history.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-mission-control-text-dim">
            Execution history for this workflow.
          </p>
          <button
            type="button"
            onClick={loadExecutions}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-mission-control-text-dim hover:text-mission-control-text transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {loading && executions.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-mission-control-text-dim" />
          </div>
        ) : executions.length === 0 ? (
          <div className="text-center py-8">
            <Play size={24} className="mx-auto text-mission-control-text-dim mb-2" />
            <p className="text-sm text-mission-control-text-dim">No runs yet. Execute the workflow to see results here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {executions.map((exec) => {
              const cfg = STATUS_CONFIG[exec.status] ?? STATUS_CONFIG.completed;
              const StatusIcon = cfg.icon;
              const isExpanded = expanded === exec.id;
              const duration = exec.duration_ms ? `${(exec.duration_ms / 1000).toFixed(1)}s` : '—';
              const startedAt = exec.started_at ? new Date(exec.started_at).toLocaleString() : '—';

              return (
                <div
                  key={exec.id}
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: 'var(--mission-control-surface)',
                    border: '1px solid var(--mission-control-border)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : exec.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-mission-control-bg"
                  >
                    <StatusIcon
                      size={16}
                      style={{ color: cfg.color }}
                      className={exec.status === 'running' ? 'animate-spin' : ''}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-mission-control-text">
                          {cfg.label}
                        </span>
                        <span className="text-[10px] text-mission-control-text-dim font-mono">
                          {exec.id.slice(0, 8)}
                        </span>
                      </div>
                      <div className="text-[10px] text-mission-control-text-dim mt-0.5">
                        {startedAt} · {duration} · {exec.trigger}
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown size={14} className="text-mission-control-text-dim" /> : <ChevronRight size={14} className="text-mission-control-text-dim" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-mission-control-border px-4 py-3">
                      {exec.error && (
                        <div className="mb-3 p-2 rounded-lg text-xs bg-error/10 text-error">
                          {exec.error}
                        </div>
                      )}
                      {exec.result && (
                        <div>
                          <p className="text-[10px] font-medium text-mission-control-text-dim uppercase tracking-wider mb-1">Result</p>
                          <pre
                            className="text-[11px] p-2 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-60"
                            style={{
                              background: 'var(--mission-control-bg)',
                              color: 'var(--mission-control-text)',
                              fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                            }}
                          >
                            {JSON.stringify(exec.result, null, 2)}
                          </pre>
                        </div>
                      )}
                      {!exec.result && !exec.error && (
                        <p className="text-xs text-mission-control-text-dim italic">No output data.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
