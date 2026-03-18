import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Brain, BookOpen, RotateCcw, RefreshCw } from 'lucide-react';

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

  return (
    <div className={`flex flex-col gap-1.5 flex-shrink-0 ${className}`}>

      {/* Row 1: status pill + new session pill */}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-[11px] text-mission-control-text-dim border border-mission-control-border rounded-full px-2.5 py-0.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot}`} />
          {statusText}
        </span>
        {isDisconnected ? (
          <button
            onClick={onReconnect}
            className="flex items-center gap-1 text-[11px] text-mission-control-accent border border-mission-control-accent/40 rounded-full px-2.5 py-0.5 hover:bg-mission-control-accent/10 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Reconnect
          </button>
        ) : (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-[11px] text-mission-control-text-dim border border-mission-control-border rounded-full px-2.5 py-0.5 hover:text-mission-control-text hover:border-mission-control-text-dim transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            New session
          </button>
        )}
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

      {/* Row 3: context bar — click to /compact */}
      <button
        onClick={onCompact}
        title="/compact — summarize context and free up space"
        className="flex items-center gap-1.5 text-[11px] text-mission-control-text-dim hover:text-mission-control-text transition-colors w-fit"
      >
        <span>Context:</span>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
        <div className="w-16 h-1 bg-mission-control-border rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(100, contextPct)}%` }} />
        </div>
        <span>{contextPct}%</span>
      </button>

    </div>
  );
}
