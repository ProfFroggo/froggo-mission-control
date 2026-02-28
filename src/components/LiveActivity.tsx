import { useEffect, useState } from 'react';
import { Zap, Code, CheckCircle, XCircle, Loader2 } from 'lucide-react';

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

export default function LiveActivity({ sessionKey }: LiveActivityProps) {
  const [activities, setActivities] = useState<Activity[]>([]);

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

  return (
    <div className="fixed bottom-20 right-4 z-40 w-80 max-w-sm">
      <div className="bg-clawd-surface/95 backdrop-blur-sm border border-clawd-border rounded-lg shadow-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-clawd-border">
          <span className="text-xs font-semibold text-clawd-text-dim uppercase tracking-wide">
            Live Activity
          </span>
        </div>
        <div className="max-h-48 overflow-y-auto">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className={`px-3 py-2 flex items-center gap-2 border-b border-clawd-border/50 last:border-b-0 ${
                activity.status === 'complete' ? 'opacity-60' : ''
              }`}
            >
              {activity.type === 'thinking' ? (
                <Zap size={14} className="text-violet-500 flex-shrink-0 animate-pulse" />
              ) : activity.status === 'active' ? (
                <Loader2 size={14} className="text-blue-500 flex-shrink-0 animate-spin" />
              ) : activity.status === 'error' ? (
                <XCircle size={14} className="text-red-500 flex-shrink-0" />
              ) : (
                <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
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
                  <div className="text-[10px] text-clawd-text-dim">
                    {activity.status === 'complete' ? 'Done' : 'Failed'}
                  </div>
                )}
              </div>
              
              {activity.type === 'tool_use' && activity.status === 'active' && (
                <Code size={12} className="text-clawd-text-dim" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
