import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Brain, BookOpen, RotateCcw, Zap, RefreshCw } from 'lucide-react';

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
  const statusDot = isDisconnected ? 'bg-error' : 'bg-success';
  const dotColor = contextPct > 80 ? 'bg-error' : contextPct > 50 ? 'bg-warning' : 'bg-success';
  const barColor = contextPct > 80 ? 'bg-error' : contextPct > 50 ? 'bg-warning' : 'bg-success';
  const iconBtn = 'p-1 rounded text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border transition-colors';

  return (
    <div className={`flex flex-col gap-1 flex-shrink-0 ${className}`}>

      {/* Row 1: status + icon actions + context */}
      <div className="flex items-center gap-1.5">
        <span className="flex items-center gap-1.5 text-[11px] text-mission-control-text-dim border border-mission-control-border rounded-full px-2 py-0.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot}`} />
          {statusText}
        </span>

        {isDisconnected ? (
          <button onClick={onReconnect} title="Reconnect" className={iconBtn}>
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button onClick={onReset} title="New session" className={iconBtn}>
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}

        <button onClick={onCompact} title="Compact — summarize context" className={iconBtn}>
          <Zap className="w-3.5 h-3.5" />
        </button>

        {/* Context bar + % */}
        <div className="flex items-center gap-1 text-[11px] text-mission-control-text-dim">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
          <div className="w-12 h-1 bg-mission-control-border rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(100, contextPct)}%` }} />
          </div>
          <span>{contextPct}%</span>
        </div>
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

    </div>
  );
}
