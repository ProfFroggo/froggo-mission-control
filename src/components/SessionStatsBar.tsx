import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Brain, BookOpen, Archive, RotateCcw, Zap } from 'lucide-react';

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
  /** Connection state text — passed in from ChatPanel */
  statusText?: string;
  /** Called when user clicks /compact */
  onCompact?: () => void;
  /** Called when user clicks New session */
  onReset?: () => void;
  className?: string;
}

export default function SessionStatsBar({
  sessionKey,
  statusText = 'Connected',
  onCompact,
  onReset,
  className = '',
}: SessionStatsBarProps) {
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!stats) return null;

  const contextPct = Math.round((stats.tokenEstimate / 32000) * 100);
  const dotColor = contextPct > 80 ? 'bg-error' : contextPct > 50 ? 'bg-warning' : 'bg-success';
  const barColor = contextPct > 80 ? 'bg-error' : contextPct > 50 ? 'bg-warning' : 'bg-success';

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger — compact inline pill */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Session stats"
        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border transition-colors"
      >
        <div className="w-8 h-1 bg-mission-control-border rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(100, contextPct)}%` }} />
        </div>
        <span>{contextPct}%</span>
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 w-64 rounded-lg border border-mission-control-border bg-mission-control-surface shadow-lg p-3 flex flex-col gap-2.5">

          {/* Row 1: status + new session */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-mission-control-text-dim">
              <span className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
              {statusText}
              {stats.compacted && <Archive className="w-3 h-3 text-info ml-1" />}
            </div>
            <button
              onClick={() => { onReset?.(); setOpen(false); }}
              className="flex items-center gap-1 text-[11px] text-mission-control-text-dim hover:text-mission-control-text transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              New session
            </button>
          </div>

          {/* Row 2: msg / memory / KB counts */}
          <div className="flex items-center gap-3 text-[11px] text-mission-control-text-dim">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3 flex-shrink-0" />
              {stats.messageCount} msgs
            </span>
            <span className={`flex items-center gap-1 ${stats.memoryFileCount === 0 ? 'opacity-40' : ''}`}>
              <Brain className="w-3 h-3 flex-shrink-0" />
              {stats.memoryFileCount} memory files
            </span>
            <span className={`flex items-center gap-1 ${stats.kbArticleCount === 0 ? 'opacity-40' : ''}`}>
              <BookOpen className="w-3 h-3 flex-shrink-0" />
              {stats.kbArticleCount} KB articles
            </span>
          </div>

          {/* Row 3: context bar */}
          <div className="flex items-center gap-2 text-[11px] text-mission-control-text-dim">
            <span>Context:</span>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
            <div className="flex-1 h-1 bg-mission-control-border rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(100, contextPct)}%` }} />
            </div>
            <span>{contextPct}%</span>
          </div>

          {/* Compact action */}
          {onCompact && (
            <button
              onClick={() => { onCompact(); setOpen(false); }}
              className="flex items-center gap-1.5 text-[11px] text-mission-control-text-dim hover:text-mission-control-text border-t border-mission-control-border pt-2 transition-colors"
            >
              <Zap className="w-3 h-3" />
              /compact — summarize &amp; free context
            </button>
          )}
        </div>
      )}
    </div>
  );
}
