import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Brain, BookOpen, RotateCcw, Zap, RefreshCw } from 'lucide-react';
import { Flex } from '@radix-ui/themes';

/** Format a raw token / count number as a compact string (e.g. 4200 → "4.2k") */
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

interface SessionStats {
  messageCount: number;
  age: number;
  compacted: boolean;
  lastActivity: number;
  tokenEstimate: number;
  memoryFileCount: number;
  kbArticleCount: number;
}

interface SessionStatsBarProps {
  sessionKey: string;
  statusText?: string;
  isDisconnected?: boolean;
  onReconnect?: () => void;
  onCompact?: () => void;
  onReset?: () => void;
  className?: string;
}

export default function SessionStatsBar({
  sessionKey,
  statusText = 'Connected',
  isDisconnected = false,
  onReconnect,
  onCompact,
  onReset,
  className = '',
}: SessionStatsBarProps) {
  const [stats, setStats] = useState<SessionStats | null>(null);

  const fetchStats = useCallback(async () => {
    if (!sessionKey) return;
    try {
      const res = await fetch(`/api/sessions/stats?key=${encodeURIComponent(sessionKey)}`);
      if (res.ok) setStats(await res.json());
    } catch { /* non-critical */ }
  }, [sessionKey]);

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 30_000);
    return () => clearInterval(id);
  }, [fetchStats]);

  if (!stats) return null;

  const contextPct = Math.round((stats.tokenEstimate / 32000) * 100);
  const dotColor = contextPct > 80 ? 'bg-[var(--color-error)]' : contextPct > 50 ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-success)]';
  const barColor = contextPct > 80 ? 'bg-[var(--color-error)]' : contextPct > 50 ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-success)]';

  return (
    <div className={`flex-shrink-0 px-3 py-2 ${className}`}>
      <Flex align="center" gap="3" wrap="wrap">

        {/* Action buttons */}
        {isDisconnected ? (
          <button
            onClick={onReconnect}
            title="Reconnect"
            aria-label="Reconnect"
            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={onReset}
            title="New session"
            aria-label="New session"
            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={onCompact}
          title="Compact — summarize context"
          aria-label="Compact context"
          className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
        >
          <Zap className="w-3.5 h-3.5" />
        </button>

        {/* Divider */}
        <span className="w-px h-3 bg-mission-control-border flex-shrink-0" />

        {/* Compact stats — icon + value, label revealed on hover */}
        <Flex align="center" gap="2" className="text-xs text-mission-control-text-dim">

          {/* Messages */}
          <span
            className="group/stat relative flex items-center gap-1 cursor-default"
            title={`${stats.messageCount} messages`}
          >
            <MessageSquare className="w-3 h-3 flex-shrink-0" />
            <span className="tabular-nums">{formatCompact(stats.messageCount)}</span>
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap bg-mission-control-surface border border-mission-control-border text-[10px] px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover/stat:opacity-100 transition-opacity z-10">
              {stats.messageCount} msgs
            </span>
          </span>

          {/* Memory files */}
          <span
            className={`group/stat relative flex items-center gap-1 cursor-default ${stats.memoryFileCount === 0 ? 'opacity-35' : ''}`}
            title={`${stats.memoryFileCount} memory files`}
          >
            <Brain className="w-3 h-3 flex-shrink-0" />
            <span className="tabular-nums">{stats.memoryFileCount}</span>
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap bg-mission-control-surface border border-mission-control-border text-[10px] px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover/stat:opacity-100 transition-opacity z-10">
              {stats.memoryFileCount} mem
            </span>
          </span>

          {/* KB articles */}
          <span
            className={`group/stat relative flex items-center gap-1 cursor-default ${stats.kbArticleCount === 0 ? 'opacity-35' : ''}`}
            title={`${stats.kbArticleCount} KB articles`}
          >
            <BookOpen className="w-3 h-3 flex-shrink-0" />
            <span className="tabular-nums">{stats.kbArticleCount}</span>
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap bg-mission-control-surface border border-mission-control-border text-[10px] px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover/stat:opacity-100 transition-opacity z-10">
              {stats.kbArticleCount} kb
            </span>
          </span>

        </Flex>

        {/* Divider */}
        <span className="w-px h-3 bg-mission-control-border flex-shrink-0" />

        {/* Context bar — token % */}
        <span
          className="group/ctx relative flex items-center gap-1.5 cursor-default"
          title={`Context: ${formatCompact(stats.tokenEstimate)} tokens (${contextPct}%)`}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
          <div className="w-14 h-1 bg-mission-control-border rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-[width] duration-500 ${barColor}`} style={{ width: `${Math.min(100, contextPct)}%` }} />
          </div>
          <span className="text-[10px] tabular-nums text-mission-control-text-dim">{contextPct}%</span>
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap bg-mission-control-surface border border-mission-control-border text-[10px] px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover/ctx:opacity-100 transition-opacity z-10">
            {formatCompact(stats.tokenEstimate)} tokens
          </span>
        </span>

      </Flex>
    </div>
  );
}
