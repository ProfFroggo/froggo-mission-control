import { useEffect, useState, memo } from 'react';
import { Zap, Code, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface Activity {
  id: string;
  type: 'thinking' | 'tool_use' | 'tool_result';
  name?: string;
  status: 'active' | 'complete' | 'error';
  timestamp: number;
}

interface LiveActivityProps {
  sessionKey?: string;
}

/** Counts up in seconds from a given epoch timestamp */
const ElapsedTimer = memo(function ElapsedTimer({ since }: { since: number }) {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - since) / 1000));

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - since) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [since]);

  return (
    <span className="text-[10px] tabular-nums text-mission-control-text-dim ml-auto">
      {elapsed}s
    </span>
  );
});

/** Left-border accent color class by activity type */
function borderAccent(activity: Activity): string {
  if (activity.type === 'thinking') return 'border-l-2 border-l-[var(--color-info)]';
  if (activity.type === 'tool_use') return 'border-l-2 border-l-[var(--color-warning)]';
  // tool_result: error vs success
  if (activity.status === 'error') return 'border-l-2 border-l-[var(--color-error)]';
  return 'border-l-2 border-l-[var(--color-success)]';
}

export default function LiveActivity({ sessionKey }: LiveActivityProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showAll, setShowAll] = useState(false);

  // Clear old activities after 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActivities(prev => prev.filter(a => Date.now() - a.timestamp < 5000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for real-time events
  useEffect(() => {
    if (!sessionKey) return;

    // Import gateway dynamically to avoid circular deps
    import('../lib/gateway').then(({ gateway }) => {
      const handleChatEvent = (data: any) => {
        // Only process events for THIS session
        if (!data.sessionKey || data.sessionKey !== sessionKey) return;

        // Check message content for blocks
        if (data.message?.content && Array.isArray(data.message.content)) {
          // Detect thinking blocks
          const thinkingBlocks = data.message.content.filter((c: any) => c.type === 'thinking');
          if (thinkingBlocks.length > 0) {
            setActivities(prev => {
              // Only add if not already present
              if (!prev.some(a => a.type === 'thinking' && Date.now() - a.timestamp < 1000)) {
                return [...prev, {
                  id: `thinking-${Date.now()}`,
                  type: 'thinking',
                  status: 'active',
                  timestamp: Date.now(),
                }];
              }
              return prev;
            });
          }

          // Detect tool use blocks
          const toolBlocks = data.message.content.filter((c: any) => c.type === 'tool_use');
          toolBlocks.forEach((tool: any) => {
            setActivities(prev => {
              // Only add if not already present
              if (!prev.some(a => a.id === tool.id)) {
                return [...prev, {
                  id: tool.id || `tool-${Date.now()}`,
                  type: 'tool_use',
                  name: tool.name,
                  status: 'active',
                  timestamp: Date.now(),
                }];
              }
              return prev;
            });
          });

          // Detect tool result blocks
          const resultBlocks = data.message.content.filter((c: any) => c.type === 'tool_result');
          resultBlocks.forEach((result: any) => {
            const isError = result.text?.includes('error') || result.text?.includes('Error');
            setActivities(prev => prev.map(a =>
              a.id === result.tool_use_id
                ? { ...a, status: isError ? 'error' as const : 'complete' as const }
                : a
            ));
          });
        }

        // Also detect from top-level content array
        if (data.content && Array.isArray(data.content)) {
          const thinkingBlocks = data.content.filter((c: any) => c.type === 'thinking');
          if (thinkingBlocks.length > 0) {
            setActivities(prev => {
              if (!prev.some(a => a.type === 'thinking' && Date.now() - a.timestamp < 1000)) {
                return [...prev, {
                  id: `thinking-${Date.now()}`,
                  type: 'thinking',
                  status: 'active',
                  timestamp: Date.now(),
                }];
              }
              return prev;
            });
          }

          const toolBlocks = data.content.filter((c: any) => c.type === 'tool_use');
          toolBlocks.forEach((tool: any) => {
            setActivities(prev => {
              if (!prev.some(a => a.id === tool.id)) {
                return [...prev, {
                  id: tool.id || `tool-${Date.now()}`,
                  type: 'tool_use',
                  name: tool.name,
                  status: 'active',
                  timestamp: Date.now(),
                }];
              }
              return prev;
            });
          });

          const resultBlocks = data.content.filter((c: any) => c.type === 'tool_result');
          resultBlocks.forEach((result: any) => {
            const isError = result.text?.includes('error') || result.text?.includes('Error');
            setActivities(prev => prev.map(a =>
              a.id === result.tool_use_id
                ? { ...a, status: isError ? 'error' as const : 'complete' as const }
                : a
            ));
          });
        }
      };

      // Subscribe to all chat events
      const unsub1 = gateway.on('chat.delta', handleChatEvent);
      const unsub2 = gateway.on('chat.message', handleChatEvent);
      const unsub3 = gateway.on('chat', handleChatEvent);
      const unsub4 = gateway.on('chat.end', handleChatEvent);

      return () => {
        unsub1();
        unsub2();
        unsub3();
        unsub4();
      };
    });

    return () => {
      // Cleanup handled by inner return
    };
  }, [sessionKey]);

  // Expose API for manual updates
  useEffect(() => {
    (window as any).__liveActivity = {
      addThinking: () => setActivities(prev => [...prev, {
        id: `thinking-${Date.now()}`,
        type: 'thinking',
        status: 'active',
        timestamp: Date.now(),
      }]),
      addTool: (name: string) => {
        const id = `tool-${Date.now()}`;
        setActivities(prev => [...prev, {
          id,
          type: 'tool_use',
          name,
          status: 'active',
          timestamp: Date.now(),
        }]);
        return id;
      },
      completeTool: (id: string, error = false) => {
        setActivities(prev => prev.map(a =>
          a.id === id ? { ...a, status: error ? 'error' as const : 'complete' as const } : a
        ));
      },
    };
  }, []);

  if (activities.length === 0) return null;

  const COLLAPSE_THRESHOLD = 3;
  const visibleActivities = showAll ? activities : activities.slice(0, COLLAPSE_THRESHOLD);
  const hiddenCount = activities.length - COLLAPSE_THRESHOLD;

  return (
    <div className="fixed bottom-20 right-4 z-40 w-80 max-w-sm">
      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2 border-b border-mission-control-border flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">
            Activity
          </span>
          <span className="inline-flex items-center justify-center rounded-full bg-mission-control-border/60 text-mission-control-text text-[10px] font-semibold tabular-nums min-w-[18px] h-[18px] px-1">
            {activities.length}
          </span>
        </div>

        {/* Activity rows */}
        <div className="overflow-hidden">
          {visibleActivities.map((activity) => (
            <div
              key={activity.id}
              className={`flex items-center gap-2 px-3 py-2 border-b border-mission-control-border/50 last:border-b-0 ${borderAccent(activity)} ${
                activity.status === 'complete' ? 'opacity-60' : ''
              }`}
            >
              {activity.type === 'thinking' ? (
                <Zap size={14} className="text-info flex-shrink-0 animate-pulse" />
              ) : activity.status === 'active' ? (
                <Loader2 size={14} className="text-warning flex-shrink-0 animate-spin" />
              ) : activity.status === 'error' ? (
                <XCircle size={14} className="text-error flex-shrink-0" />
              ) : (
                <CheckCircle size={14} className="text-success flex-shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">
                  {activity.type === 'thinking' ? (
                    'Thinking...'
                  ) : (
                    activity.name || 'Running tool'
                  )}
                </div>
                {activity.status !== 'active' && (
                  <div className="text-[10px] text-mission-control-text-dim">
                    {activity.status === 'complete' ? 'Done' : 'Failed'}
                  </div>
                )}
              </div>

              {activity.type === 'tool_use' && activity.status === 'active' && (
                <Code size={12} className="text-mission-control-text-dim flex-shrink-0" />
              )}

              {/* Elapsed timer shown while active */}
              {activity.status === 'active' && (
                <ElapsedTimer since={activity.timestamp} />
              )}
            </div>
          ))}
        </div>

        {/* Show all / collapse toggle */}
        {activities.length > COLLAPSE_THRESHOLD && (
          <button
            type="button"
            onClick={() => setShowAll(v => !v)}
            className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/20 border-t border-mission-control-border/50 transition-colors"
          >
            {showAll ? (
              <>
                <ChevronUp size={12} />
                Show less
              </>
            ) : (
              <>
                <ChevronDown size={12} />
                Show {hiddenCount} more
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
