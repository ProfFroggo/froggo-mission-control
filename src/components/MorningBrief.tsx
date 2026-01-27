import { useState, useEffect } from 'react';
import { Sun, Moon, Inbox, Calendar, MessageSquare, AlertCircle, CheckCircle, X, ChevronRight, Sparkles } from 'lucide-react';

interface BriefData {
  greeting: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  pendingApprovals: number;
  unreadMessages: number;
  upcomingEvents: { title: string; time: string }[];
  recentActivity: { action: string; time: string }[];
  urgentItems: string[];
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
      let upcomingEventsData: any[] = [];
      
      // Initial delay to ensure IPC is ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Retry up to 5 times with increasing delay
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          if (window.clawdbot?.inbox?.list) {
            const inboxResult = await window.clawdbot.inbox.list();
            console.log('[MorningBrief] Inbox result attempt', attempt + 1, ':', JSON.stringify(inboxResult));
            if (inboxResult?.success && Array.isArray(inboxResult?.items)) {
              pendingApprovals = inboxResult.items.filter((i: any) => i.status === 'pending').length;
              console.log('[MorningBrief] Pending count:', pendingApprovals);
              break; // Got result, stop retrying (even if 0)
            }
          } else {
            console.log('[MorningBrief] clawdbot.inbox.list not available, waiting...');
          }
        } catch (e) {
          console.error('[MorningBrief] Inbox error attempt', attempt + 1, ':', e);
        }
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
      }
      
      try {
        const calendarResult = await (window as any).clawdbot?.calendar?.today();
        if (calendarResult?.events) {
          upcomingEventsData = calendarResult.events;
        }
      } catch (e) {
        console.error('[MorningBrief] Calendar error:', e);
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
        unreadMessages: 0, // TODO: Fetch from messaging
        upcomingEvents,
        recentActivity: [],
        urgentItems,
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
      case 'morning': return <Sun className="text-yellow-400" size={32} />;
      case 'afternoon': return <Sun className="text-orange-400" size={32} />;
      case 'evening': return <Moon className="text-purple-400" size={32} />;
      case 'night': return <Moon className="text-blue-400" size={32} />;
      default: return <Sparkles className="text-clawd-accent" size={32} />;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="animate-pulse text-clawd-accent text-xl">Loading your brief...</div>
      </div>
    );
  }

  if (!brief) {
    // Fallback if brief failed to load - show dismiss button
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-lg z-50 flex items-center justify-center p-4">
        <div className="glass-modal rounded-3xl shadow-2xl max-w-lg w-full p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Good morning, Kevin 👋</h1>
          <p className="text-clawd-text-dim mb-6">Couldn't load your brief data.</p>
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-lg z-50 flex items-center justify-center p-4">
      <div className="glass-modal rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="p-8 text-center border-b border-clawd-border bg-gradient-to-br from-clawd-accent/10 to-transparent">
          <div className="mb-4">{getIcon()}</div>
          <h1 className="text-3xl font-bold mb-2">{brief.greeting}, Kevin 👋</h1>
          <p className="text-clawd-text-dim">
            {hasItems ? "Here's what needs your attention" : "All clear! Nothing urgent right now."}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Urgent Items */}
          {brief.urgentItems.length > 0 && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <AlertCircle size={18} />
                <span className="font-medium">Needs attention</span>
              </div>
              <ul className="space-y-1 text-sm">
                {brief.urgentItems.map((item, i) => (
                  <li key={i} className="text-red-300">• {item}</li>
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

          {/* Upcoming Events */}
          {brief.upcomingEvents.length > 0 && (
            <div className="p-4 bg-clawd-bg rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={18} className="text-clawd-accent" />
                <span className="font-medium">Today's Schedule</span>
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

          {/* All Clear */}
          {!hasItems && (
            <div className="p-6 text-center">
              <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
              <p className="text-lg font-medium text-green-400">You're all caught up!</p>
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
            Don't show again today
          </button>
        </div>
      </div>
    </div>
  );
}
