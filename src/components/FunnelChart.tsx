// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';
import { Filter, Download, Copy, Check } from 'lucide-react';
import { Flex } from '@radix-ui/themes';

interface StatusCount {
  status: string;
  count: number;
}

interface FunnelStage {
  label: string;
  status: string;
  color: string;
}

const STAGES: FunnelStage[] = [
  { label: 'Todo', status: 'todo', color: 'var(--color-muted)' },
  { label: 'In Progress', status: 'in-progress', color: 'var(--color-info)' },
  { label: 'Review', status: 'review', color: 'var(--color-review)' },
  { label: 'Done', status: 'done', color: 'var(--color-success)' },
];

function buildBomCsv(stages: FunnelStage[], counts: Record<string, number>): string {
  const BOM = '\uFEFF';
  const header = 'Stage,Count\n';
  const rows = stages.map((s) => `${s.label},${counts[s.status] ?? 0}`).join('\n');
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

export default function FunnelChart() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics/task-stats');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        success: boolean;
        byStatus: Record<string, number>;
      };
      setCounts(json.byStatus ?? {});
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleExportCsv() {
    downloadCsv(
      buildBomCsv(STAGES, counts),
      `funnel-${new Date().toISOString().split('T')[0]}.csv`
    );
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildBomCsv(STAGES, counts));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="h-4 bg-mission-control-border/40 rounded animate-pulse w-24" />
            <div className="h-10 bg-mission-control-border/20 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-mission-control-text-dim">
        Failed to load funnel data.
      </div>
    );
  }

  const stageCounts = STAGES.map((s) => counts[s.status] ?? 0);
  const maxCount = Math.max(...stageCounts, 1);

  // Conversion rates between consecutive stages
  function conversionRate(from: number, to: number): string {
    if (from === 0) return 'N/A';
    return `${Math.round((to / from) * 100)}%`;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Flex align="center" gap="2">
          <Filter size={16} className="text-mission-control-accent" />
          <span className="text-sm font-semibold text-mission-control-text">Task Funnel</span>
          <span className="text-[10px] uppercase tracking-wider text-mission-control-text-dim">current pipeline</span>
        </Flex>
        <Flex align="center" gap="2">
          <button
            type="button"
            onClick={handleExportCsv}
            title="Export funnel as CSV"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <Download size={12} />
            CSV
          </button>
          <button
            type="button"
            onClick={handleCopy}
            title="Copy to clipboard"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </Flex>
      </div>

      {/* Horizontal funnel */}
      <div className="space-y-3">
        {STAGES.map((stage, idx) => {
          const count = stageCounts[idx];
          const widthPct = Math.max((count / maxCount) * 100, 4);
          const nextCount = idx < STAGES.length - 1 ? stageCounts[idx + 1] : null;

          return (
            <div key={stage.status} className="space-y-1">
              <Flex align="center" justify="between" className="text-sm mb-1">
                <span className="font-medium" style={{ color: stage.color }}>
                  {stage.label}
                </span>
                <span className="text-mission-control-text-dim tabular-nums">{count}</span>
              </Flex>

              {/* Bar */}
              <div className="h-10 bg-mission-control-bg rounded-lg overflow-hidden relative">
                <div
                  className="h-full rounded-lg flex items-center px-3 transition-colors duration-500"
                  style={{
                    width: `${widthPct}%`,
                    background: stage.color,
                    opacity: 0.85,
                  }}
                >
                  {widthPct > 15 && (
                    <span className="text-white text-xs font-semibold">{count}</span>
                  )}
                </div>
              </div>

              {/* Conversion rate to next stage */}
              {nextCount !== null && (
                <div className="flex items-center gap-1.5 text-xs text-mission-control-text-dim pl-2">
                  <span
                    className="w-0 h-0"
                    style={{
                      borderLeft: '4px solid transparent',
                      borderRight: '4px solid transparent',
                      borderTop: `6px solid var(--mission-control-text-dim)`,
                      display: 'inline-block',
                    }}
                  />
                  <span>
                    {conversionRate(count, nextCount)} moved to {STAGES[idx + 1].label}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-mission-control-border">
        {STAGES.map((stage, idx) => (
          <div
            key={stage.status}
            className="text-center p-3 rounded-xl bg-mission-control-surface border border-mission-control-border"
          >
            <div className="text-2xl font-bold tabular-nums text-mission-control-text">
              {stageCounts[idx]}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mt-0.5">{stage.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
