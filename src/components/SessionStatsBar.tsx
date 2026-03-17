import { useState, useEffect, useCallback } from 'react';
import { Archive } from 'lucide-react';

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
  /** Called when user clicks the compact button */
  onCompact?: () => void;
  className?: string;
}

export default function SessionStatsBar({ sessionKey, onCompact, className = '' }: SessionStatsBarProps) {
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
  const barColor = contextPct > 80 ? 'bg-error' : contextPct > 50 ? 'bg-warning' : 'bg-success';

  const parts: string[] = [];
  if (stats.messageCount > 0) parts.push(`${stats.messageCount} msgs`);
  if (stats.memoryFileCount > 0) parts.push(`${stats.memoryFileCount} mem`);
  if (stats.kbArticleCount > 0) parts.push(`${stats.kbArticleCount} KB`);

  return (
    <button
      onClick={onCompact}
      title="Click to /compact — summarize context and free up space"
      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border transition-colors ${className}`}
    >
      {stats.compacted && <Archive className="w-3 h-3 text-info flex-shrink-0" />}
      {parts.length > 0 && (
        <span className="opacity-70">{parts.join(' · ')}</span>
      )}
      {/* Context bar + % */}
      <span className="flex items-center gap-1">
        <div className="w-10 h-1 bg-mission-control-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(100, contextPct)}%` }}
          />
        </div>
        <span>{contextPct}%</span>
      </span>
    </button>
  );
}
