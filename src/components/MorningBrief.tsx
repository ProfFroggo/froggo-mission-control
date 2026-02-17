import { useState, useEffect } from 'react';
import { Sun, Moon, Inbox, Calendar, AlertCircle, CheckCircle, ChevronRight, Sparkles, Cloud, Activity, Bot, Users, AtSign } from 'lucide-react';

interface TwitterMention {
  id: string;
  text: string;
  createdAt: string;
  author: {
    username: string;
    name: string;
  };
  likeCount?: number;
  replyCount?: number;
}

interface BriefData {
  greeting: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  pendingApprovals: number;
  unreadMessages: number;
  upcomingEvents: { title: string; time: string }[];
  recentActivity: { action: string; time: string }[];
  urgentItems: string[];
  weather?: {
    temp: string;
    condition: string;
    forecast: string;
  };
  overnightActivity?: {
    tasksCompleted: number;
    agentSessions: string[];
    summary: string;
  };
  sessionStats?: {
    total: number;
    active: number;
    byType: { direct: number; group: number; cron: number; subagent: number };
    channels: { name: string; count: number }[];
  };
  agentStats?: {
    activeAgents: number;
    totalAgents: number;
    recentWork: string[];
    busyAgents: string[];
  };
  mentions?: TwitterMention[];
}

interface MorningBriefProps {
  onDismiss: () => void;
  onNavigate: (view: string) => void;
}

export default function MorningBrief({ onDismiss, onNavigate }: MorningBriefProps) {
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    loadBrief();
  }, []);

  // ESC key to dismiss
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onDismiss]);

  const loadBrief = async () => {
    try {
      // Get time of day
      const hour = new Date().getHours();
      let timeOfDay: BriefData['timeOfDay'] = 'morning';
      let greeting = 'Good morning';
      
      if (hour >= 12 && hour < 17) {
        timeOfDay = 'afternoon';
        greeting = 'Good afternoon';
      } else if (hour >= 17 && hour < 21) {
        timeOfDay = 'evening';
        greeting = 'Good evening';
      } else if (hour >= 21 || hour < 5) {
        timeOfDay = 'night';
        greeting = 'Good night';
      }

      // Fetch data - wait for Electron IPC to be ready with retry
      let pendingApprovals = 0;
      let unreadMessages = 0;
      let upcomingEventsData: any[] = [];
      let weatherData: BriefData['weather'] = undefined;
      let overnightData: BriefData['overnightActivity'] = undefined;
      
      // Initial delay to ensure IPC is ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Retry up to 8 times with increasing delay
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          if (window.clawdbot?.inbox?.list) {
            const inboxResult = await window.clawdbot.inbox.list();
            if (inboxResult?.success && Array.isArray(inboxResult?.items)) {
              // Backend already filters to status='pending', no need to filter again
              pendingApprovals = inboxResult.items.length;
              break; // Got result, stop retrying
            }
          }
        } catch (e) {
          console.error('[MorningBrief] Inbox error attempt', attempt + 1, ':', e);
        }
        // Wait before next attempt (longer delays)
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
      
      // Fetch unread messages count
      try {
        const unreadResult = await (window as any).clawdbot?.messages?.unread?.();
        if (unreadResult?.success) {
          unreadMessages = unreadResult.count || 0;
        }
      } catch (e) {
        console.error('[MorningBrief] Unread messages error:', e);
        // Keep as 0 on error - not critical
      }
      
      // Fetch work calendar events (from user settings)
      try {
        const calAccount = (await import('../store/userSettings')).useUserSettings.getState().emailAccounts[0]?.email || '';
        const calendarResult = calAccount ? await (window as any).clawdbot?.calendar?.events(calAccount, 1) : null;
        if (calendarResult?.events) {
          upcomingEventsData = calendarResult.events;
        }
      } catch (e) {
        console.error('[MorningBrief] Calendar error:', e);
      }

      // Fetch Gibraltar weather from wttr.in
      try {
        const weatherResponse = await fetch('https://wttr.in/Gibraltar?format=j1');
        if (weatherResponse.ok) {
          const wttr = await weatherResponse.json();
          const current = wttr.current_condition?.[0];
          const today = wttr.weather?.[0];
          if (current && today) {
            weatherData = {
              temp: `${current.temp_C}°C`,
              condition: current.weatherDesc?.[0]?.value || 'Unknown',
              forecast: `High ${today.maxtempC}°C, Low ${today.mintempC}°C`,
            };
          }
        }
      } catch (e) {
        console.error('[MorningBrief] Weather error:', e);
      }

      // Fetch overnight activity (23:00 yesterday to now)
      try {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(23, 0, 0, 0);
        const overnightStart = yesterday.getTime();

        // Get completed tasks from overnight
        const tasksResult = await (window as any).clawdbot?.tasks?.list('done');
        const overnightTasks = tasksResult?.tasks?.filter((t: any) => {
          const updated = t.updated_at ? new Date(t.updated_at).getTime() : 0;
          return updated >= overnightStart;
        }) || [];

        // Get agent sessions
        const sessionsResult = await (window as any).clawdbot?.sessions?.list();
        const agentSessions = sessionsResult?.sessions?.filter((s: any) => {
          // Filter for agent sessions that were active overnight
          return s.key?.includes('agent:') && !s.key?.includes('discord');
        }).map((s: any) => {
          // Extract agent name from session key
          const parts = s.key.split(':');
          return parts[parts.length - 1] || 'agent';
        }) || [];

        // Build summary
        let summary = '';
        if (overnightTasks.length > 0) {
          const taskTitles = overnightTasks.slice(0, 2).map((t: any) => t.title).join(', ');
          summary = `${overnightTasks.length} task${overnightTasks.length > 1 ? 's' : ''} completed: ${taskTitles}`;
          if (overnightTasks.length > 2) summary += `, +${overnightTasks.length - 2} more`;
        } else if (agentSessions.length > 0) {
          summary = `${agentSessions.length} agent session${agentSessions.length > 1 ? 's' : ''} ran`;
        } else {
          summary = 'Quiet night - no activity';
        }

        overnightData = {
          tasksCompleted: overnightTasks.length,
          agentSessions: agentSessions.slice(0, 3),
          summary,
        };
      } catch (e) {
        console.error('[MorningBrief] Overnight activity error:', e);
      }

      // Fetch session stats
      let sessionStatsData: BriefData['sessionStats'] = undefined;
      try {
        const sessionsResult = await (window as any).clawdbot?.gateway?.sessionsList();
        if (sessionsResult?.success && sessionsResult.sessions) {
          const sessions = sessionsResult.sessions;
          const now = Date.now();
          const activeThreshold = 30 * 60 * 1000; // 30 minutes
          
          // Count active sessions (updated in last 30 min)
          const activeSessions = sessions.filter((s: any) => 
            now - s.updatedAt < activeThreshold
          );

          // Count by type
          const byType = {
            direct: sessions.filter((s: any) => s.kind === 'direct').length,
            group: sessions.filter((s: any) => s.kind === 'group').length,
            cron: sessions.filter((s: any) => s.key?.includes(':cron:')).length,
            subagent: sessions.filter((s: any) => s.key?.includes(':subagent:')).length,
          };

          // Count by channel
          const channelMap: { [key: string]: number } = {};
          sessions.forEach((s: any) => {
            if (s.key?.includes('whatsapp')) channelMap['WhatsApp'] = (channelMap['WhatsApp'] || 0) + 1;
            else if (s.key?.includes('discord')) channelMap['Discord'] = (channelMap['Discord'] || 0) + 1;
            else if (s.key?.includes('telegram')) channelMap['Telegram'] = (channelMap['Telegram'] || 0) + 1;
            else if (s.key?.includes('froggo')) channelMap['Dashboard'] = (channelMap['Dashboard'] || 0) + 1;
            else if (s.key?.includes('cron')) channelMap['Cron Jobs'] = (channelMap['Cron Jobs'] || 0) + 1;
          });

          const channels = Object.entries(channelMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

          sessionStatsData = {
            total: sessions.length,
            active: activeSessions.length,
            byType,
            channels,
          };
        }
      } catch (e) {
        console.error('[MorningBrief] Session stats error:', e);
      }

      // Fetch agent stats
      let agentStatsData: BriefData['agentStats'] = undefined;
      try {
        const sessionsResult = await (window as any).clawdbot?.gateway?.sessionsList();
        const tasksResult = await (window as any).clawdbot?.tasks?.list('in-progress');
        
        if (sessionsResult?.success && sessionsResult.sessions) {
          const sessions = sessionsResult.sessions;
          const now = Date.now();
          const activeThreshold = 30 * 60 * 1000;

          // Find agent sessions (subagents)
          const agentSessions = sessions.filter((s: any) => 
            s.key?.includes(':subagent:') || s.key?.includes('agent:')
          );

          const activeAgentSessions = agentSessions.filter((s: any) => 
            now - s.updatedAt < activeThreshold
          );

          // Get busy agents from tasks
          const busyAgents: string[] = [];
          if (tasksResult?.tasks) {
            const agentNames: { [key: string]: string } = {
              'coder': 'Coder',
              'researcher': 'Researcher',
              'writer': 'Writer',
              'chief': 'Chief',
              'main': 'Main Agent',
            };
            
            tasksResult.tasks.forEach((task: any) => {
              if (task.assignedTo && agentNames[task.assignedTo]) {
                const agentName = agentNames[task.assignedTo];
                if (!busyAgents.includes(agentName)) {
                  busyAgents.push(agentName);
                }
              }
            });
          }

          // Get recent work from agent sessions
          const recentWork: string[] = [];
          activeAgentSessions.slice(0, 3).forEach((s: any) => {
            // Extract agent name and task from session key
            const keyParts = s.key.split(':');
            const agentType = keyParts[keyParts.length - 2] || 'agent';
            const taskId = keyParts[keyParts.length - 1] || '';
            
            if (agentType === 'coder') recentWork.push('Code development');
            else if (agentType === 'researcher') recentWork.push('Research task');
            else if (agentType === 'writer') recentWork.push('Content writing');
            else if (agentType === 'chief') recentWork.push('Engineering task');
            else if (taskId.includes('brief')) recentWork.push('Morning brief');
            else if (taskId.includes('cron')) recentWork.push('Scheduled task');
            else recentWork.push('Background work');
          });

          agentStatsData = {
            activeAgents: activeAgentSessions.length,
            totalAgents: agentSessions.length,
            recentWork: [...new Set(recentWork)], // Remove duplicates
            busyAgents,
          };
        }
      } catch (e) {
        console.error('[MorningBrief] Agent stats error:', e);
      }

      // Fetch Twitter mentions
      let mentionsData: TwitterMention[] | undefined = undefined;
      try {
        const mentionsResult = await (window as any).clawdbot?.twitter?.mentions();
        if (mentionsResult?.success && Array.isArray(mentionsResult.mentions)) {
          // Get recent mentions (last 24 hours)
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
          mentionsData = mentionsResult.mentions
            .filter((m: any) => {
              const mentionDate = new Date(m.createdAt).getTime();
              return mentionDate >= oneDayAgo;
            })
            .slice(0, 5) // Show max 5 recent mentions
            .map((m: any) => ({
              id: m.id,
              text: m.text,
              createdAt: m.createdAt,
              author: {
                username: m.author.username,
                name: m.author.name,
              },
              likeCount: m.likeCount,
              replyCount: m.replyCount,
            }));
        }
      } catch (e) {
        console.error('[MorningBrief] Twitter mentions error:', e);
      }

      const upcomingEvents = upcomingEventsData.slice(0, 3).map((e: any) => ({
        title: e.title || e.summary,
        time: e.start?.dateTime ? new Date(e.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'All day',
      }));

      // Determine urgent items - show ANY pending approvals
      const urgentItems: string[] = [];
      if (pendingApprovals > 0) urgentItems.push(`${pendingApprovals} item${pendingApprovals > 1 ? 's' : ''} need${pendingApprovals === 1 ? 's' : ''} approval`);
      if (upcomingEvents.length > 0) urgentItems.push(`Meeting: ${upcomingEvents[0].title} at ${upcomingEvents[0].time}`);

      setBrief({
        greeting,
        timeOfDay,
        pendingApprovals,
        unreadMessages,
        upcomingEvents,
        recentActivity: [],
        urgentItems,
        weather: weatherData,
        overnightActivity: overnightData,
        sessionStats: sessionStatsData,
        agentStats: agentStatsData,
        mentions: mentionsData,
      });
    } catch (error) {
      console.error('Failed to load brief:', error);
      // Set a minimal brief on error so UI doesn't blank
      setBrief({
        greeting: 'Good morning',
        timeOfDay: 'morning',
        pendingApprovals: 0,
        unreadMessages: 0,
        upcomingEvents: [],
        recentActivity: [],
        urgentItems: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const getIcon = () => {
    switch (brief?.timeOfDay) {
      case 'morning': return <Sun className="text-warning" size={32} />;
      case 'afternoon': return <Sun className="text-warning" size={32} />;
      case 'evening': return <Moon className="text-review" size={32} />;
      case 'night': return <Moon className="text-info" size={32} />;
      default: return <Sparkles className="text-clawd-accent" size={32} />;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 modal-backdrop backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="animate-pulse text-clawd-accent text-xl">Loading your brief...</div>
      </div>
    );
  }

  if (!brief) {
    // Fallback if brief failed to load - show dismiss button
    return (
      <div className="fixed inset-0 modal-backdrop backdrop-blur-lg z-50 flex items-center justify-center p-4">
        <div className="glass-modal rounded-3xl shadow-2xl max-w-lg w-full p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Good morning 👋</h1>
          <p className="text-clawd-text-dim mb-6">Couldn&apos;t load your brief data.</p>
          <button
            onClick={onDismiss}
            className="px-6 py-3 bg-clawd-accent text-white rounded-xl font-medium hover:bg-clawd-accent/80 transition-colors"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const hasItems = brief.pendingApprovals > 0 || brief.upcomingEvents.length > 0 || brief.urgentItems.length > 0;

  return (
    <div 
      className="fixed inset-0 modal-backdrop backdrop-blur-lg z-50 flex items-center justify-center p-4"
      onClick={onDismiss}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDismiss(); } }}
      role="button"
      tabIndex={0}
      aria-label="Close modal"
    >
      <div 
        className="glass-modal rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        {/* Header */}
        <div className="p-8 text-center border-b border-clawd-border bg-gradient-to-br from-clawd-accent/10 to-transparent">
          <div className="mb-4">{getIcon()}</div>
          <h1 className="text-3xl font-bold mb-2">{brief.greeting} 👋</h1>
          <p className="text-clawd-text-dim">
            {hasItems ? "Here's what needs your attention" : "All clear! Nothing urgent right now."}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Urgent Items */}
          {brief.urgentItems.length > 0 && (
            <div className="p-4 bg-error-subtle border border-error-border rounded-xl">
              <div className="flex items-center gap-2 text-error mb-2">
                <AlertCircle size={16} />
                <span className="font-medium">Needs attention</span>
              </div>
              <ul className="space-y-1 text-sm">
                {brief.urgentItems.map((item, i) => (
                  <li key={i} className="text-error">• {item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Pending Approvals */}
          {brief.pendingApprovals > 0 && (
            <button
              onClick={() => { onDismiss(); onNavigate('inbox'); }}
              className="w-full p-4 bg-clawd-bg rounded-xl hover:bg-clawd-border transition-colors text-left group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-clawd-accent/20 rounded-lg">
                    <Inbox size={20} className="text-clawd-accent" />
                  </div>
                  <div>
                    <div className="font-medium">{brief.pendingApprovals} pending approval{brief.pendingApprovals > 1 ? 's' : ''}</div>
                    <div className="text-sm text-clawd-text-dim">Tweets, emails, actions waiting</div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-clawd-text-dim group-hover:text-clawd-accent transition-colors" />
              </div>
            </button>
          )}

          {/* Gibraltar Weather */}
          {brief.weather && (
            <div className="p-4 bg-clawd-bg rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Cloud size={16} className="text-info" />
                <span className="font-medium">Gibraltar Weather</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">{brief.weather.temp}</span>
                  <span className="text-clawd-text-dim">{brief.weather.condition}</span>
                </div>
                <div className="text-sm text-clawd-text-dim">{brief.weather.forecast}</div>
              </div>
            </div>
          )}

          {/* Overnight Activity */}
          {brief.overnightActivity && (
            <div className="p-4 bg-clawd-bg rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Activity size={16} className="text-review" />
                <span className="font-medium">While You Slept</span>
              </div>
              <div className="space-y-2">
                <p className="text-sm">{brief.overnightActivity.summary}</p>
                {brief.overnightActivity.agentSessions.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {brief.overnightActivity.agentSessions.map((agent, i) => (
                      <span key={i} className="px-2 py-1 bg-review-subtle text-review rounded text-xs">
                        {agent}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Session Activity Stats */}
          {brief.sessionStats && (
            <div className="p-4 bg-clawd-bg rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-cyan-400" />
                <span className="font-medium">Session Activity</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-clawd-text-dim">Total Sessions</span>
                  <span className="font-semibold">{brief.sessionStats.total}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-clawd-text-dim">Active (30 min)</span>
                  <span className="font-semibold text-success">{brief.sessionStats.active}</span>
                </div>
                
                {/* Session Types */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-clawd-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-clawd-text-dim">Direct</span>
                    <span className="font-medium">{brief.sessionStats.byType.direct}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-clawd-text-dim">Group</span>
                    <span className="font-medium">{brief.sessionStats.byType.group}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-clawd-text-dim">Cron</span>
                    <span className="font-medium">{brief.sessionStats.byType.cron}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-clawd-text-dim">Agents</span>
                    <span className="font-medium">{brief.sessionStats.byType.subagent}</span>
                  </div>
                </div>

                {/* Top Channels */}
                {brief.sessionStats.channels.length > 0 && (
                  <div className="pt-2 border-t border-clawd-border">
                    <div className="text-xs text-clawd-text-dim mb-2">By Channel</div>
                    <div className="flex gap-2 flex-wrap">
                      {brief.sessionStats.channels.slice(0, 4).map((channel, i) => (
                        <span key={i} className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded text-xs">
                          {channel.name} ({channel.count})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Agent Activity Stats */}
          {brief.agentStats && (brief.agentStats.activeAgents > 0 || brief.agentStats.busyAgents.length > 0) && (
            <div className="p-4 bg-clawd-bg rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Bot size={16} className="text-success" />
                <span className="font-medium">Agent Activity</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-clawd-text-dim">Active Agents</span>
                  <span className="font-semibold text-success">{brief.agentStats.activeAgents} / {brief.agentStats.totalAgents}</span>
                </div>

                {/* Busy Agents */}
                {brief.agentStats.busyAgents.length > 0 && (
                  <div className="pt-2 border-t border-clawd-border">
                    <div className="text-xs text-clawd-text-dim mb-2">Working On Tasks</div>
                    <div className="flex gap-2 flex-wrap">
                      {brief.agentStats.busyAgents.map((agent, i) => (
                        <span key={i} className="px-2 py-1 bg-success-subtle text-success rounded text-xs">
                          {agent}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Work */}
                {brief.agentStats.recentWork.length > 0 && (
                  <div className="pt-2 border-t border-clawd-border">
                    <div className="text-xs text-clawd-text-dim mb-2">Recent Activity</div>
                    <ul className="space-y-1">
                      {brief.agentStats.recentWork.map((work, i) => (
                        <li key={i} className="text-xs text-clawd-text">• {work}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upcoming Events */}
          {brief.upcomingEvents.length > 0 && (
            <div className="p-4 bg-clawd-bg rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={16} className="text-clawd-accent" />
                <span className="font-medium">Today&apos;s Schedule</span>
              </div>
              <div className="space-y-2">
                {brief.upcomingEvents.map((event, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate">{event.title}</span>
                    <span className="text-clawd-text-dim ml-2">{event.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Twitter Mentions */}
          {brief.mentions && brief.mentions.length > 0 && (
            <div className="p-4 bg-clawd-bg rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <AtSign size={16} className="text-info" />
                <span className="font-medium">Recent Mentions</span>
                <span className="text-xs text-clawd-text-dim ml-auto">(last 24h)</span>
              </div>
              <div className="space-y-3">
                {brief.mentions.map((mention) => (
                  <div key={mention.id} className="p-3 bg-clawd-bg/30 rounded-lg border border-clawd-border hover:border-info-border transition-colors">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{mention.author.name}</span>
                          <span className="text-xs text-clawd-text-dim truncate">@{mention.author.username}</span>
                        </div>
                      </div>
                      <span className="text-xs text-clawd-text-dim whitespace-nowrap">
                        {new Date(mention.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-sm text-clawd-text line-clamp-2">{mention.text}</p>
                    {((mention.likeCount ?? 0) > 0 || (mention.replyCount ?? 0) > 0) && (
                      <div className="flex gap-3 mt-2 text-xs text-clawd-text-dim">
                        {(mention.replyCount ?? 0) > 0 && <span>💬 {mention.replyCount}</span>}
                        {(mention.likeCount ?? 0) > 0 && <span>❤️ {mention.likeCount}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Clear */}
          {!hasItems && (
            <div className="p-6 text-center">
              <CheckCircle size={48} className="text-success mx-auto mb-3" />
              <p className="text-lg font-medium text-success">You&apos;re all caught up!</p>
              <p className="text-sm text-clawd-text-dim">No pending items or upcoming events</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-clawd-border bg-clawd-bg">
          <button
            onClick={onDismiss}
            className="w-full py-3 bg-clawd-accent text-white rounded-xl font-medium hover:bg-clawd-accent/90 transition-colors"
          >
            {hasItems ? "Let's get to work" : "Start your day"}
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-2 text-clawd-text-dim text-sm hover:text-clawd-text mt-2"
          >
            Don&apos;t show again today
          </button>
        </div>
      </div>
    </div>
  );
}
