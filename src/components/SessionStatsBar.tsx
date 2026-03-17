import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Brain, BookOpen, Archive, RotateCcw } from 'lucide-react';

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
  /** Show "New session" reset button. Default true. */
  showReset?: boolean;
  /** Called after a successful session reset */
  onReset?: () => void;
  className?: string;
}

export default function SessionStatsBar({ sessionKey, showReset = true, onReset, className = '' }: SessionStatsBarProps) {
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
  }, [fetchStats]);

  const handleReset = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', key: sessionKey }),
      });
      if (res.ok) {
        setStats(null);
        onReset?.();
      }
    } catch { /* ignore */ }
  }, [sessionKey, onReset]);

  if (!stats) return null;

  const contextPct = Math.round((stats.tokenEstimate / 32000) * 100);
  const barColor = contextPct > 80 ? 'bg-error' : contextPct > 50 ? 'bg-warning' : 'bg-success';

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      <span className="flex items-center gap-1 text-[10px] text-mission-control-text-dim">
        <MessageSquare className="w-3 h-3" />
        {stats.messageCount} msgs
      </span>
      <span className={`flex items-center gap-1 text-[10px] ${stats.memoryFileCount > 0 ? 'text-mission-control-text-dim' : 'text-mission-control-text-dim/50'}`}>
        <Brain className="w-3 h-3" />
        {stats.memoryFileCount > 0 ? `${stats.memoryFileCount} memory files` : 'No memory'}
      </span>
      <span className={`flex items-center gap-1 text-[10px] ${stats.kbArticleCount > 0 ? 'text-mission-control-text-dim' : 'text-mission-control-text-dim/50'}`}>
        <BookOpen className="w-3 h-3" />
        {stats.kbArticleCount > 0 ? `${stats.kbArticleCount} KB articles` : 'No KB'}
      </span>
      {stats.compacted && (
        <span className="flex items-center gap-1 text-[10px] text-info">
          <Archive className="w-3 h-3" />
          Compacted
        </span>
      )}
      <div className="flex items-center gap-1 text-[10px] text-mission-control-text-dim">
        <span>Context:</span>
        <div className="w-16 h-1.5 bg-mission-control-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(100, contextPct)}%` }}
          />
        </div>
        <span>{contextPct}%</span>
      </div>
      {showReset && (
        <button
          onClick={handleReset}
          title="New session"
          className="flex items-center gap-1 text-[10px] text-mission-control-text-dim hover:text-mission-control-text transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          New session
        </button>
      )}
    </div>
  );
}
