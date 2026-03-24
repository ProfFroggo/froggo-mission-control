import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Brain, BookOpen, RotateCcw, Zap, RefreshCw } from 'lucide-react';
import { IconButton, Text, Flex } from '@radix-ui/themes';

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
    <Flex direction="column" gap="1" className={`flex-shrink-0 ${className}`}>

      {/* Row 1: status + icon actions + context */}
      <Flex align="center" gap="2">
        <span className="flex items-center gap-1.5 text-xs text-mission-control-text-dim border border-mission-control-border rounded-full px-2 py-0.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot}`} />
          {statusText}
        </span>

        {isDisconnected ? (
          <IconButton
            variant="ghost"
            color="gray"
            size="1"
            onClick={onReconnect}
            title="Reconnect"
            aria-label="Reconnect"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </IconButton>
        ) : (
          <IconButton
            variant="ghost"
            color="gray"
            size="1"
            onClick={onReset}
            title="New session"
            aria-label="New session"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </IconButton>
        )}

        <IconButton
          variant="ghost"
          color="gray"
          size="1"
          onClick={onCompact}
          title="Compact — summarize context"
          aria-label="Compact context"
        >
          <Zap className="w-3.5 h-3.5" />
        </IconButton>

        {/* Context bar + % */}
        <Flex align="center" gap="1" className="text-xs text-mission-control-text-dim">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
          <div className="w-12 h-1 bg-mission-control-border rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(100, contextPct)}%` }} />
          </div>
          <Text size="1" color="gray">{contextPct}%</Text>
        </Flex>
      </Flex>

      {/* Row 2: msg / memory / KB counts */}
      <Flex align="center" gap="3" className="text-xs text-mission-control-text-dim">
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
      </Flex>

    </Flex>
  );
}
