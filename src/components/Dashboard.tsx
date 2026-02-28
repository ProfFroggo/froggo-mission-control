import { useEffect, useState, useMemo } from 'react';
import {
  Wifi, WifiOff, CheckCircle, Bot, ArrowRight, Calendar,
  Zap, Shield, AlertTriangle, Inbox,
  ListTodo, Activity, MapPin, Video, ChevronRight,
  Loader2, XCircle, DollarSign,
  MessageSquare, Mail, Twitter, FileText, type LucideIcon
} from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import { useStore } from '../store/store';
import type { ApprovalItem, Task, Agent, GatewaySession } from '../store/store';

type View = 'dashboard' | 'kanban' | 'agents' | 'chat' | 'meetings' | 'voicechat' | 'settings' | 'notifications' | 'twitter' | 'inbox' | 'approvals' | 'library' | 'schedule' | 'codeagent' | 'context' | 'analytics' | 'comms' | 'contacts' | 'accounts' | 'sessions' | 'calendar' | 'templates' | 'agentdms' | 'finance' | 'writing';

interface DashboardProps {
  onNavigate?: (view: View) => void;
  onShowBrief?: () => void;
}

// ── Utilities ──────────────────────────────────────────────

function formatTimeAgo(ts: number): string {
  if (!ts) return 'unknown';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

function formatCost(cost: number): string {
  if (cost >= 1) return `$${cost.toFixed(2)}`;
  if (cost >= 0.01) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(4)}`;
}

const APPROVAL_ICONS: Record<string, LucideIcon> = {
  tweet: Twitter,
  reply: Twitter,
  email: Mail,
  message: MessageSquare,
  task: ListTodo,
  action: Zap,
};

const PHANTOM_AGENTS = ['main', 'chat-agent'];

// ── HeaderBar ──────────────────────────────────────────────

function HeaderBar({ connected }: { connected: boolean }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-clawd-border/50">
      <div>
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-clawd-text to-clawd-accent bg-clip-text text-transparent">
          {greeting}, Kevin
        </h1>
        <p className="text-sm text-clawd-text-dim mt-0.5">{dateStr}</p>
      </div>
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm ${
        connected
          ? 'bg-success-subtle text-success border border-success-border'
          : 'bg-error-subtle text-error border border-error-border'
      }`}>
        {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
        {connected ? 'Online' : 'Connecting...'}
      </div>
    </div>
  );
}

// ── StatStrip ──────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  pulse?: boolean;
  onClick?: () => void;
  sub?: string;
}

function StatCard({ label, value, icon: Icon, color, pulse, onClick, sub }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex-1 min-w-0 p-4 bg-clawd-surface/80 backdrop-blur-xl rounded-xl border border-clawd-border hover:border-clawd-accent/50 transition-all group text-left"
    >
      <div className="flex items-center justify-between mb-2">
        <Icon size={18} className={color} />
        {pulse && value > 0 && (
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
        )}
      </div>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-clawd-text-dim mt-1 font-medium">{label}</div>
      {sub && <div className="text-xs text-clawd-text-dim/70 mt-0.5">{sub}</div>}
    </button>
  );
}

function StatStrip({
  pendingApprovals,
  inProgressCount,
  completedToday,
  activeAgentCount,
  totalAgentCount,
  onNavigate,
}: {
  pendingApprovals: number;
  inProgressCount: number;
  completedToday: number;
  activeAgentCount: number;
  totalAgentCount: number;
  onNavigate?: (view: View) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-4">
      <StatCard
        label="Pending Approvals"
        value={pendingApprovals}
        icon={Inbox}
        color={pendingApprovals > 0 ? 'text-orange-400' : 'text-clawd-text-dim'}
        pulse={pendingApprovals > 0}
        onClick={() => onNavigate?.('approvals')}
      />
      <StatCard
        label="In Progress"
        value={inProgressCount}
        icon={Activity}
        color={inProgressCount > 0 ? 'text-blue-400' : 'text-clawd-text-dim'}
        onClick={() => onNavigate?.('kanban')}
      />
      <StatCard
        label="Done Today"
        value={completedToday}
        icon={CheckCircle}
        color={completedToday > 0 ? 'text-emerald-400' : 'text-clawd-text-dim'}
        onClick={() => onNavigate?.('kanban')}
      />
      <StatCard
        label="Active Agents"
        value={activeAgentCount}
        icon={Bot}
        color={activeAgentCount > 0 ? 'text-green-400' : 'text-clawd-text-dim'}
        onClick={() => onNavigate?.('agents')}
        sub={`${totalAgentCount} total`}
      />
    </div>
  );
}

// ── ApprovalsQueue ─────────────────────────────────────────

function ApprovalCard({
  item,
  onApprove,
  onReject,
}: {
  item: ApprovalItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const Icon = APPROVAL_ICONS[item.type] || FileText;

  return (
    <div className="p-4 border-b border-clawd-border/30 hover:bg-clawd-bg/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="mt-1 p-2 rounded-lg bg-clawd-bg/50">
          <Icon size={16} className="text-clawd-text-dim" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-xs font-medium text-clawd-text-dim uppercase tracking-wide">
                {item.type}
              </span>
              <h4 className="font-medium text-clawd-text mt-0.5 line-clamp-1">{item.title}</h4>
            </div>
            <span className="text-xs text-clawd-text-dim flex-shrink-0">
              {formatTimeAgo(item.createdAt)}
            </span>
          </div>
          <p className="text-sm text-clawd-text-dim mt-1 line-clamp-2">{item.content}</p>
          {item.metadata?.to && (
            <p className="text-xs text-clawd-text-dim/70 mt-1">To: {item.metadata.to}</p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => onApprove(item.id)}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => onReject(item.id)}
              className="px-4 py-1.5 bg-clawd-bg hover:bg-red-500/20 text-clawd-text-dim hover:text-red-400 text-xs font-medium rounded-lg border border-clawd-border transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApprovalsQueue({
  approvals,
  onApprove,
  onReject,
  onNavigate,
}: {
  approvals: ApprovalItem[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onNavigate?: (view: View) => void;
}) {
  const pending = approvals.filter(a => a.status === 'pending');

  return (
    <div className={`bg-clawd-surface/80 backdrop-blur-xl rounded-xl border overflow-hidden flex flex-col ${
      pending.length > 0 ? 'border-orange-500/50 shadow-lg shadow-orange-500/5' : 'border-clawd-border'
    }`}>
      <div className="p-4 border-b border-clawd-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox size={16} className={pending.length > 0 ? 'text-orange-400' : 'text-clawd-text-dim'} />
          <h2 className="font-semibold text-sm">Needs Your Decision</h2>
          {pending.length > 0 && (
            <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
              {pending.length}
            </span>
          )}
        </div>
        <button
          onClick={() => onNavigate?.('approvals')}
          className="flex items-center gap-1 text-xs text-clawd-accent hover:text-clawd-accent-dim transition-colors"
        >
          View All <ArrowRight size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[400px]">
        {pending.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle size={32} className="mx-auto mb-2 text-emerald-400/50" />
            <p className="text-sm text-clawd-text-dim font-medium">All caught up</p>
            <p className="text-xs text-clawd-text-dim/70 mt-1">No pending approvals</p>
          </div>
        ) : (
          pending.slice(0, 10).map(item => (
            <ApprovalCard
              key={item.id}
              item={item}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── ActivityFeed ───────────────────────────────────────────

function ActivityFeed({
  inProgressTasks,
  agents,
  activities,
  onNavigate,
}: {
  inProgressTasks: Task[];
  agents: Agent[];
  activities: { id: string; type: string; message: string; timestamp: number }[];
  onNavigate?: (view: View) => void;
}) {
  return (
    <div className="bg-clawd-surface/80 backdrop-blur-xl rounded-xl border border-clawd-border overflow-hidden flex flex-col">
      <div className="p-4 border-b border-clawd-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-blue-400" />
          <h2 className="font-semibold text-sm">What&apos;s Happening</h2>
          {inProgressTasks.length > 0 && (
            <span className="px-2 py-0.5 bg-info-subtle text-info text-xs font-medium rounded-full">
              {inProgressTasks.length} active
            </span>
          )}
        </div>
        <button
          onClick={() => onNavigate?.('kanban')}
          className="flex items-center gap-1 text-xs text-clawd-accent hover:text-clawd-accent-dim transition-colors"
        >
          All Tasks <ArrowRight size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[400px]">
        {/* Active work */}
        {inProgressTasks.length > 0 && (
          <div className="divide-y divide-clawd-border/30">
            {inProgressTasks.slice(0, 6).map(task => {
              const agent = agents.find(a => a.id === task.assignedTo);
              return (
                <div
                  key={task.id}
                  className="p-3 hover:bg-clawd-bg/30 transition-colors cursor-pointer"
                  onClick={() => onNavigate?.('kanban')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-clawd-text truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {agent && (
                          <span className="flex items-center gap-1 text-xs text-clawd-text-dim">
                            <AgentAvatar agentId={agent.id} fallbackEmoji={agent.avatar} size="xs" />
                            {agent.name}
                          </span>
                        )}
                        {task.updatedAt && (
                          <span className="text-xs text-clawd-text-dim">{formatTimeAgo(task.updatedAt)}</span>
                        )}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-info-subtle text-info text-xs rounded-full flex-shrink-0">
                      working
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent activity */}
        {activities.length > 0 && (
          <div className={inProgressTasks.length > 0 ? 'border-t border-clawd-border/50' : ''}>
            <div className="px-4 py-2 bg-clawd-bg/30">
              <span className="text-xs font-medium text-clawd-text-dim uppercase tracking-wider">Recent Activity</span>
            </div>
            <div className="divide-y divide-clawd-border/20">
              {activities.slice(0, 8).map(a => (
                <div key={a.id} className="px-4 py-2.5 flex items-start gap-3">
                  <span className="text-sm flex-shrink-0 mt-0.5">
                    {a.type === 'chat' ? '💬' : a.type === 'task' ? '📋' : a.type === 'agent' ? '🤖' : a.type === 'error' ? '⚠️' : '📡'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-clawd-text-dim line-clamp-1">{a.message}</p>
                  </div>
                  <span className="text-xs text-clawd-text-dim/50 flex-shrink-0">
                    {formatTimeAgo(a.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {inProgressTasks.length === 0 && activities.length === 0 && (
          <div className="p-8 text-center">
            <Activity size={32} className="mx-auto mb-2 text-clawd-text-dim/30" />
            <p className="text-sm text-clawd-text-dim">No active work right now</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── TodaySchedule ──────────────────────────────────────────

function TodaySchedule({ onNavigate }: { onNavigate?: (view: View) => void }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = async () => {
    try {
      if (!window.clawdbot?.calendar?.today) {
        setEvents([]);
        setLoading(false);
        return;
      }
      const result = await window.clawdbot.calendar.today();
      if (result?.success && result.events) {
        const sorted = result.events.sort((a: CalendarEvent, b: CalendarEvent) => {
          const aTime = a.start.dateTime || a.start.date || '';
          const bTime = b.start.dateTime || b.start.date || '';
          return aTime.localeCompare(bTime);
        });
        setEvents(sorted);
      } else {
        setEvents([]);
      }
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    const interval = setInterval(loadEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTime = (event: CalendarEvent): string => {
    if (event.start.date && !event.start.dateTime) return 'All day';
    if (event.start.dateTime) {
      return new Date(event.start.dateTime).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
      });
    }
    return '';
  };

  const isNow = (event: CalendarEvent): boolean => {
    const start = event.start.dateTime;
    const end = event.end?.dateTime;
    if (!start || !end) return false;
    const now = Date.now();
    return now >= new Date(start).getTime() && now <= new Date(end).getTime();
  };

  const getMeetingLink = (event: CalendarEvent): string | null => {
    if (!event.conferenceData?.entryPoints) return null;
    const videoEntry = event.conferenceData.entryPoints.find(e =>
      e.entryPointType === 'video' || e.uri.includes('meet.google.com') || e.uri.includes('zoom.us')
    );
    return videoEntry?.uri || null;
  };

  return (
    <div className="bg-clawd-surface/80 backdrop-blur-xl rounded-xl border border-clawd-border overflow-hidden flex flex-col">
      <div className="p-4 border-b border-clawd-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-blue-400" />
          <h2 className="font-semibold text-sm">Today&apos;s Schedule</h2>
        </div>
        <button
          onClick={() => onNavigate?.('schedule')}
          className="flex items-center gap-1 text-xs text-clawd-accent hover:text-clawd-accent-dim transition-colors"
        >
          Full Calendar <ChevronRight size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[300px]">
        {loading ? (
          <div className="p-6 text-center">
            <Loader2 size={20} className="mx-auto mb-2 animate-spin text-clawd-text-dim" />
            <p className="text-xs text-clawd-text-dim">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="p-6 text-center">
            <Calendar size={28} className="mx-auto mb-2 text-clawd-text-dim/30" />
            <p className="text-sm text-clawd-text-dim">No events today</p>
          </div>
        ) : (
          <div className="divide-y divide-clawd-border/30">
            {events.slice(0, 6).map(event => {
              const happening = isNow(event);
              const meetingLink = getMeetingLink(event);
              return (
                <div
                  key={event.id}
                  className={`p-3 hover:bg-clawd-bg/30 transition-colors ${
                    happening ? 'bg-info-subtle/30 border-l-2 border-l-blue-400' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-14 text-right flex-shrink-0 ${
                      happening ? 'text-blue-400 font-semibold' : 'text-clawd-text-dim'
                    }`}>
                      <span className="text-xs">{formatTime(event)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${happening ? 'text-blue-400' : 'text-clawd-text'}`}>
                        {event.summary}
                        {happening && (
                          <span className="ml-2 px-1.5 py-0.5 bg-blue-500 text-white text-[10px] rounded-full font-bold">
                            NOW
                          </span>
                        )}
                      </p>
                      {event.location && (
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-clawd-text-dim">
                          <MapPin size={10} />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                    </div>
                    {meetingLink && (
                      <a
                        href={meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 p-1.5 bg-clawd-accent/20 text-clawd-accent rounded-lg hover:bg-clawd-accent hover:text-white transition-all"
                        title="Join meeting"
                        onClick={e => e.stopPropagation()}
                      >
                        <Video size={14} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            {events.length > 6 && (
              <div className="p-2 text-center">
                <button
                  onClick={() => onNavigate?.('schedule')}
                  className="text-xs text-clawd-accent hover:underline"
                >
                  +{events.length - 6} more
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── SystemHealth ───────────────────────────────────────────

interface SystemStatus {
  watcherRunning: boolean;
  killSwitchOn: boolean;
  inProgressTasks: number;
}

interface TokenSummary {
  totalTokens: number;
  totalCost: number;
  topAgent?: string;
  topAgentTokens?: number;
}

function SystemHealth({ gatewaySessions, connected }: { gatewaySessions: GatewaySession[]; connected: boolean }) {
  const [sysStatus, setSysStatus] = useState<SystemStatus | null>(null);
  const [tokenSummary, setTokenSummary] = useState<TokenSummary | null>(null);

  const loadAll = async () => {
    // System status
    try {
      const result = await window.clawdbot?.system?.status();
      if (result?.success && result.status) {
        setSysStatus(result.status as unknown as SystemStatus);
      }
    } catch { /* ignore */ }

    // Token summary
    try {
      const result = await window.clawdbot?.tokens?.summary({ period: 'day' });
      if (result?.by_agent && result.by_agent.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalTokens = result.by_agent.reduce((sum: number, a: any) => sum + a.total_all, 0);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalCost = result.by_agent.reduce((sum: number, a: any) => sum + (a.total_cost || 0), 0);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sorted = [...result.by_agent].sort((a: any, b: any) => b.total_all - a.total_all);
        setTokenSummary({
          totalTokens,
          totalCost,
          topAgent: sorted[0]?.agent,
          topAgentTokens: sorted[0]?.total_all,
        });
      } else {
        setTokenSummary({ totalTokens: 0, totalCost: 0 });
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSessions = gatewaySessions.filter(s => s.isActive);
  const health = sysStatus
    ? sysStatus.killSwitchOn ? 'critical' : !sysStatus.watcherRunning ? 'warning' : 'healthy'
    : 'unknown';

  return (
    <div className="bg-clawd-surface/80 backdrop-blur-xl rounded-xl border border-clawd-border overflow-hidden flex flex-col">
      <div className="p-4 border-b border-clawd-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={16} className={
            health === 'healthy' ? 'text-emerald-400' :
            health === 'warning' ? 'text-yellow-400' :
            health === 'critical' ? 'text-red-400' :
            'text-clawd-text-dim'
          } />
          <h2 className="font-semibold text-sm">System Health</h2>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-medium ${
          health === 'healthy' ? 'text-emerald-400' :
          health === 'warning' ? 'text-yellow-400' :
          health === 'critical' ? 'text-red-400' :
          'text-clawd-text-dim'
        }`}>
          {health === 'healthy' ? <CheckCircle size={12} /> :
           health === 'warning' ? <AlertTriangle size={12} /> :
           health === 'critical' ? <XCircle size={12} /> :
           <Loader2 size={12} className="animate-spin" />}
          {health === 'healthy' ? 'All Good' :
           health === 'warning' ? 'Warning' :
           health === 'critical' ? 'Critical' : 'Loading'}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Gateway */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-clawd-text-dim">Gateway</span>
          <span className={connected ? 'text-emerald-400' : 'text-red-400'}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Sessions */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-clawd-text-dim">Active Sessions</span>
          <span className="text-clawd-text">{activeSessions.length}</span>
        </div>

        {/* Watcher */}
        {sysStatus && (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="text-clawd-text-dim">Task Watcher</span>
              <span className={sysStatus.watcherRunning ? 'text-emerald-400' : 'text-red-400'}>
                {sysStatus.watcherRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-clawd-text-dim">Safety Lock</span>
              <span className={sysStatus.killSwitchOn ? 'text-red-400' : 'text-emerald-400'}>
                {sysStatus.killSwitchOn ? 'Engaged' : 'Normal'}
              </span>
            </div>
          </>
        )}

        {/* Token usage */}
        {tokenSummary && (
          <div className="pt-3 border-t border-clawd-border/50 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-clawd-text-dim flex items-center gap-1">
                <Zap size={10} /> Tokens Today
              </span>
              <span className="text-clawd-text font-medium">{formatTokens(tokenSummary.totalTokens)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-clawd-text-dim flex items-center gap-1">
                <DollarSign size={10} /> Cost
              </span>
              <span className="text-clawd-text font-medium">{formatCost(tokenSummary.totalCost)}</span>
            </div>
            {tokenSummary.topAgent && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-clawd-text-dim">Top Agent</span>
                <span className="text-clawd-text capitalize">
                  {tokenSummary.topAgent} ({formatTokens(tokenSummary.topAgentTokens || 0)})
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────

export default function DashboardRedesigned({ onNavigate }: DashboardProps) {
  const {
    connected, tasks, agents, activities, approvals,
    fetchAgents, gatewaySessions, loadGatewaySessions,
    approveItem, rejectItem, loadApprovals,
  } = useStore();

  // Load data on mount
  useEffect(() => {
    fetchAgents().catch(() => {});
    loadApprovals().catch(() => {});
  }, [fetchAgents, loadApprovals]);

  useEffect(() => {
    if (connected) {
      loadGatewaySessions().catch(() => {});
      const interval = setInterval(() => loadGatewaySessions().catch(() => {}), 30000);
      return () => clearInterval(interval);
    }
  }, [connected, loadGatewaySessions]);

  // Computed metrics
  const inProgressTasks = useMemo(() => tasks.filter(t => t.status === 'in-progress'), [tasks]);
  const completedToday = useMemo(() =>
    tasks.filter(t =>
      t.status === 'done' &&
      new Date(t.updatedAt).toDateString() === new Date().toDateString()
    ).length,
    [tasks]
  );

  const realAgents = useMemo(() => agents.filter(a => !PHANTOM_AGENTS.includes(a.id)), [agents]);
  const activeSubagents = useMemo(() => gatewaySessions.filter(s => s.type === 'subagent' && s.isActive), [gatewaySessions]);
  const activeAgentCount = useMemo(() => {
    const activeFromRegistry = realAgents.filter(a => a.status === 'active').length;
    return activeFromRegistry + activeSubagents.length;
  }, [realAgents, activeSubagents]);

  const pendingApprovals = useMemo(() => approvals.filter(a => a.status === 'pending'), [approvals]);

  return (
    <div className="h-full overflow-auto bg-gradient-to-b from-clawd-bg to-clawd-surface">
      {/* Header */}
      <HeaderBar connected={connected} />

      {/* Stat Strip */}
      <StatStrip
        pendingApprovals={pendingApprovals.length}
        inProgressCount={inProgressTasks.length}
        completedToday={completedToday}
        activeAgentCount={activeAgentCount}
        totalAgentCount={realAgents.length}
        onNavigate={onNavigate}
      />

      {/* Main content: Approvals + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-6 pb-4">
        <ApprovalsQueue
          approvals={approvals}
          onApprove={approveItem}
          onReject={rejectItem}
          onNavigate={onNavigate}
        />
        <ActivityFeed
          inProgressTasks={inProgressTasks}
          agents={agents}
          activities={activities}
          onNavigate={onNavigate}
        />
      </div>

      {/* Bottom row: Schedule + System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-6 pb-6">
        <TodaySchedule onNavigate={onNavigate} />
        <SystemHealth gatewaySessions={gatewaySessions} connected={connected} />
      </div>
    </div>
  );
}
