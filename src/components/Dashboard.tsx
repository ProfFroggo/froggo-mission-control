import { useEffect, useState } from 'react';
import { Activity, CheckCircle, Bot, MessageSquare, Wifi, WifiOff, Clock, Zap, ArrowRight, Calendar, Mail, Search, Mic, Plus, RefreshCw, Bell, AlertCircle, Loader2, ChevronDown, ChevronRight, Inbox, ListTodo, CalendarDays, AlertTriangle } from 'lucide-react';

// X logo component  
const XIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
// CalendarWidget removed - replaced by EpicCalendar in Schedule panel
import EmailWidget from './EmailWidget';
import { CalendarModal, EmailModal, MentionsModal, MessagesModal } from './QuickModals';
import { useStore } from '../store/store';
import { gateway } from '../lib/gateway';
import { showToast } from './Toast';

type View = 'dashboard' | 'kanban' | 'agents' | 'chat' | 'voice' | 'settings' | 'notifications' | 'twitter' | 'inbox' | 'sessions' | 'library' | 'schedule' | 'codeagent' | 'context' | 'calendar' | 'templates' | 'analytics' | 'comms';

interface DashboardProps {
  onNavigate?: (view: View) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { connected, sessions, tasks, agents, activities, approvals, fetchSessions, addActivity, clearActivities, getUnassignedTasks, getTasksNeedingReview, gatewaySessions, loadGatewaySessions } = useStore();
  const [greeting, setGreeting] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'calendar' | 'email' | 'mentions' | 'messages' | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const [showAgents, setShowAgents] = useState(false);
  
  const activeTasks = tasks.filter(t => t.status === 'todo' || t.status === 'in-progress' || t.status === 'review').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
  const needsReview = tasks.filter(t => t.status === 'review');
  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  const busyAgents = agents.filter(a => a.status === 'busy').length;
  const unassignedTasks = tasks.filter(t => !t.assignedTo && t.status !== 'done');
  const urgentTasks = tasks.filter(t => t.priority === 'p0' && t.status !== 'done');
  const completedToday = tasks.filter(t => 
    t.status === 'done' && 
    new Date(t.updatedAt).toDateString() === new Date().toDateString()
  ).length;

  // Real agent counts from Gateway sessions
  const subagentSessions = gatewaySessions.filter(s => s.type === 'subagent');
  const activeSubagents = subagentSessions.filter(s => s.isActive);
  const totalAgentCount = activeSubagents.length + 1;

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  useEffect(() => {
    if (connected) {
      fetchSessions();
      const interval = setInterval(fetchSessions, 30000);
      return () => clearInterval(interval);
    }
  }, [connected, fetchSessions]);

  useEffect(() => {
    loadGatewaySessions();
    const interval = setInterval(loadGatewaySessions, 30000); // Reduced from 5s to 30s
    return () => clearInterval(interval);
  }, [loadGatewaySessions]);

  const handleQuickAction = (label: string) => {
    const modalMap: Record<string, 'calendar' | 'email' | 'mentions' | 'messages'> = {
      'Calendar': 'calendar',
      'Email': 'email',
      'X Mentions': 'mentions',
      'Messages': 'messages',
    };
    setActiveModal(modalMap[label] || null);
  };

  const quickActions = [
    { icon: Calendar, label: 'Calendar', color: 'text-blue-400' },
    { icon: Mail, label: 'Email', color: 'text-green-400' },
    { icon: XIcon, label: 'X Mentions', color: 'text-white' },
    { icon: MessageSquare, label: 'Messages', color: 'text-purple-400' },
  ];

  const getSessionIcon = (session: any) => {
    if (session.channel === 'whatsapp') return '💬';
    if (session.channel === 'telegram') return '✈️';
    if (session.channel === 'discord') return '🎮';
    if (session.key?.includes('subagent')) return '🤖';
    if (session.key?.includes('cron')) return '⏰';
    return '💻';
  };

  const getSessionName = (session: any) => {
    const key = session.key || '';
    const parts = key.split(':');
    const last = parts[parts.length - 1];
    if (last.includes('-') && last.length > 20) {
      return last.slice(0, 8) + '...';
    }
    return last || 'Unknown';
  };

  // Calculate what needs attention
  const attentionItems = [];
  if (pendingApprovals.length > 0) attentionItems.push(`${pendingApprovals.length} approval${pendingApprovals.length > 1 ? 's' : ''}`);
  if (needsReview.length > 0) attentionItems.push(`${needsReview.length} task${needsReview.length > 1 ? 's' : ''} to review`);
  if (urgentTasks.length > 0) attentionItems.push(`${urgentTasks.length} urgent`);
  if (unassignedTasks.length > 0) attentionItems.push(`${unassignedTasks.length} unassigned`);

  return (
    <div className="h-full overflow-auto">
      {/* Compact Header */}
      <div className="bg-gradient-to-r from-clawd-surface to-clawd-bg px-6 py-4 border-b border-clawd-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">{greeting}, Kevin</h1>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {connected ? 'Online' : 'Connecting...'}
            </div>
          </div>
          
          {/* Quick Actions - Compact */}
          <div className="flex gap-2">
            {quickActions.map(({ icon: Icon, label, color }, i) => (
              <button
                key={i}
                onClick={() => handleQuickAction(label)}
                disabled={loadingAction === label}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-clawd-bg/50 rounded-lg border border-clawd-border hover:border-clawd-accent transition-all text-sm"
                title={label}
              >
                <Icon size={14} className={color} />
                <span className="hidden lg:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        
        {/* Priority Cards Row - What Needs Attention */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {/* Pending Approvals - PRIMARY */}
          <button 
            onClick={() => onNavigate?.('inbox')}
            className={`col-span-1 bg-clawd-surface rounded-xl border p-4 text-left transition-all hover:scale-[1.02] ${
              pendingApprovals.length > 0 
                ? 'border-orange-500/50 bg-gradient-to-br from-orange-500/10 to-clawd-surface hover:border-orange-400' 
                : 'border-clawd-border hover:border-clawd-accent/50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Inbox size={20} className={pendingApprovals.length > 0 ? 'text-orange-400' : 'text-clawd-text-dim'} />
              {pendingApprovals.length > 0 && (
                <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full animate-pulse">
                  {pendingApprovals.length}
                </span>
              )}
            </div>
            <div className="text-2xl font-bold mb-0.5">{pendingApprovals.length}</div>
            <div className="text-xs text-clawd-text-dim">Pending Approvals</div>
            {pendingApprovals.length > 0 && (
              <div className="mt-2 text-xs text-orange-400 truncate">
                {pendingApprovals[0].title || pendingApprovals[0].type}
              </div>
            )}
          </button>

          {/* Active Tasks */}
          <button 
            onClick={() => onNavigate?.('kanban')}
            className={`col-span-1 bg-clawd-surface rounded-xl border p-4 text-left transition-all hover:scale-[1.02] ${
              inProgressTasks.length > 0 
                ? 'border-blue-500/50 hover:border-blue-400' 
                : 'border-clawd-border hover:border-clawd-accent/50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <ListTodo size={20} className={inProgressTasks.length > 0 ? 'text-blue-400' : 'text-clawd-text-dim'} />
              {needsReview.length > 0 && (
                <span className="px-2 py-0.5 bg-purple-500/80 text-white text-xs font-medium rounded-full">
                  {needsReview.length} review
                </span>
              )}
            </div>
            <div className="text-2xl font-bold mb-0.5">{inProgressTasks.length}</div>
            <div className="text-xs text-clawd-text-dim">In Progress</div>
            {inProgressTasks.length > 0 && (
              <div className="mt-2 text-xs text-blue-400 truncate">
                {inProgressTasks[0].title}
              </div>
            )}
          </button>

          {/* Urgent / Alerts */}
          <button 
            onClick={() => onNavigate?.('kanban')}
            className={`col-span-1 bg-clawd-surface rounded-xl border p-4 text-left transition-all hover:scale-[1.02] ${
              urgentTasks.length > 0 || unassignedTasks.length > 0
                ? 'border-yellow-500/50 hover:border-yellow-400' 
                : 'border-clawd-border hover:border-clawd-accent/50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle size={20} className={urgentTasks.length > 0 ? 'text-yellow-400' : 'text-clawd-text-dim'} />
              {urgentTasks.length > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                  {urgentTasks.length}
                </span>
              )}
            </div>
            <div className="text-2xl font-bold mb-0.5">{urgentTasks.length + unassignedTasks.length}</div>
            <div className="text-xs text-clawd-text-dim">Needs Attention</div>
            {unassignedTasks.length > 0 && (
              <div className="mt-2 text-xs text-yellow-400">
                {unassignedTasks.length} unassigned
              </div>
            )}
          </button>

          {/* Completed Today */}
          <div className="col-span-1 bg-clawd-surface rounded-xl border border-clawd-border p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle size={20} className={completedToday > 0 ? 'text-green-400' : 'text-clawd-text-dim'} />
              {activeSubagents.length > 0 && (
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full flex items-center gap-1">
                  <Bot size={10} /> {activeSubagents.length}
                </span>
              )}
            </div>
            <div className="text-2xl font-bold mb-0.5">{completedToday}</div>
            <div className="text-xs text-clawd-text-dim">Done Today</div>
            {busyAgents > 0 && (
              <div className="mt-2 text-xs text-green-400">
                {busyAgents} agent{busyAgents > 1 ? 's' : ''} working
              </div>
            )}
          </div>
        </div>

        {/* Main Grid - Calendar & Tasks Primary */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* Left Column - Calendar (Wider) */}
          <div className="col-span-2 space-y-6">
            {/* Calendar moved to Schedule panel (Cmd+Shift+S) → Epic Calendar */}

            {/* Active Tasks - What's Being Worked On */}
            <div className="bg-clawd-surface rounded-xl border border-clawd-border overflow-hidden">
              <div className="p-4 border-b border-clawd-border flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <Activity size={18} className="text-blue-400" /> Active Work
                </h2>
                <button 
                  onClick={() => onNavigate?.('kanban')}
                  className="flex items-center gap-1 text-sm text-clawd-accent hover:underline"
                >
                  View All <ArrowRight size={14} />
                </button>
              </div>
              
              <div className="divide-y divide-clawd-border">
                {[...inProgressTasks, ...needsReview].length === 0 ? (
                  <div className="p-6 text-center text-clawd-text-dim">
                    <CheckCircle size={28} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No active tasks</p>
                    <button 
                      onClick={() => onNavigate?.('kanban')}
                      className="mt-2 text-sm text-clawd-accent hover:underline"
                    >
                      Create a task
                    </button>
                  </div>
                ) : (
                  [...inProgressTasks, ...needsReview].slice(0, 5).map((task) => {
                    const agent = agents.find(a => a.id === task.assignedTo);
                    return (
                      <div 
                        key={task.id} 
                        className="p-3 hover:bg-clawd-bg/50 transition-colors cursor-pointer"
                        onClick={() => onNavigate?.('kanban')}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            task.status === 'review' ? 'bg-purple-400' :
                            task.status === 'in-progress' ? 'bg-blue-400 animate-pulse' :
                            'bg-gray-400'
                          }`} />
                          <span className="font-medium flex-1 truncate">{task.title}</span>
                          {agent && (
                            <span className="text-sm text-clawd-text-dim flex items-center gap-1 flex-shrink-0">
                              {agent.avatar}
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${
                            task.status === 'review' ? 'bg-purple-500/20 text-purple-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {task.status === 'in-progress' ? 'working' : task.status}
                          </span>
                        </div>
                        {task.project && (
                          <div className="mt-1 ml-5 text-xs text-clawd-text-dim">{task.project}</div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Email & Notifications */}
          <div className="col-span-1 space-y-6">
            {/* Email Widget */}
            <div className="bg-clawd-surface rounded-xl border border-clawd-border overflow-hidden">
              <EmailWidget />
            </div>

            {/* Recent Actions / Notifications */}
            <div className="bg-clawd-surface rounded-xl border border-clawd-border overflow-hidden">
              <div className="p-4 border-b border-clawd-border flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <Bell size={16} /> Notifications
                </h2>
                {activities.length > 0 && (
                  <button 
                    onClick={clearActivities}
                    className="text-xs text-clawd-text-dim hover:text-clawd-accent"
                  >
                    Clear
                  </button>
                )}
              </div>
              
              <div className="max-h-64 overflow-y-auto">
                {activities.length === 0 ? (
                  <div className="p-6 text-center text-clawd-text-dim">
                    <Bell size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No new notifications</p>
                  </div>
                ) : (
                  <div className="divide-y divide-clawd-border">
                    {activities.slice(0, 8).map((a) => (
                      <div key={a.id} className="p-3 text-sm hover:bg-clawd-bg/30">
                        <div className="flex items-start gap-2">
                          <span className="text-base flex-shrink-0">
                            {a.type === 'chat' ? '💬' : 
                             a.type === 'task' ? '✅' : 
                             a.type === 'agent' ? '🤖' : '⚙️'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-clawd-text truncate text-xs">{a.message}</p>
                            <p className="text-xs text-clawd-text-dim">{formatTimeAgo(a.timestamp)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Section - Collapsible */}
        <div className="space-y-3">
          {/* Sessions - Collapsible */}
          <div className="bg-clawd-surface rounded-xl border border-clawd-border overflow-hidden">
            <button 
              onClick={() => setShowSessions(!showSessions)}
              className="w-full p-3 flex items-center justify-between hover:bg-clawd-bg/30 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-clawd-text-dim">
                {showSessions ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <MessageSquare size={16} />
                Sessions
                <span className="px-2 py-0.5 bg-clawd-border rounded-full text-xs">
                  {sessions.length}
                </span>
                {sessions.filter(s => Date.now() - (s.lastActivity || 0) < 300000).length > 0 && (
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs">
                    {sessions.filter(s => Date.now() - (s.lastActivity || 0) < 300000).length} active
                  </span>
                )}
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); fetchSessions(); }}
                className="p-1 hover:bg-clawd-border rounded transition-colors"
                title="Refresh"
              >
                <RefreshCw size={12} />
              </button>
            </button>
            
            {showSessions && (
              <div className="border-t border-clawd-border divide-y divide-clawd-border max-h-64 overflow-y-auto">
                {sessions.length === 0 ? (
                  <div className="p-4 text-center text-clawd-text-dim text-sm">
                    {connected ? 'No active sessions' : 'Connecting...'}
                  </div>
                ) : (
                  sessions.slice(0, 8).map((s: any) => {
                    const isActive = Date.now() - (s.updatedAt || 0) < 300000;
                    return (
                      <div key={s.key} className="p-3 hover:bg-clawd-bg/30 transition-colors text-sm">
                        <div className="flex items-center gap-2">
                          <span>{getSessionIcon(s)}</span>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
                          <span className="font-medium truncate flex-1">{getSessionName(s)}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            s.channel === 'discord' ? 'badge-discord' :
                            s.channel === 'telegram' ? 'badge-telegram' :
                            s.channel === 'whatsapp' ? 'badge-whatsapp' :
                            'badge-webchat'
                          }`}>{s.channel || 'web'}</span>
                          <span className="text-xs text-clawd-text-dim">{formatTimeAgo(s.updatedAt)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
                {sessions.length > 8 && (
                  <div className="p-2 text-center">
                    <button 
                      onClick={() => onNavigate?.('sessions')}
                      className="text-xs text-clawd-accent hover:underline"
                    >
                      View all {sessions.length} sessions
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Agents - Collapsible */}
          <div className="bg-clawd-surface rounded-xl border border-clawd-border overflow-hidden">
            <button 
              onClick={() => setShowAgents(!showAgents)}
              className="w-full p-3 flex items-center justify-between hover:bg-clawd-bg/30 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-clawd-text-dim">
                {showAgents ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <Bot size={16} />
                Agents
                <span className="px-2 py-0.5 bg-clawd-border rounded-full text-xs">
                  {totalAgentCount}
                </span>
                {activeSubagents.length > 0 && (
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs">
                    {activeSubagents.length} sub-agent{activeSubagents.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); onNavigate?.('agents'); }}
                className="text-xs text-clawd-accent hover:underline"
              >
                Manage
              </button>
            </button>
            
            {showAgents && (
              <div className="border-t border-clawd-border p-3">
                <div className="grid grid-cols-4 gap-2">
                  {agents.slice(0, 4).map((agent) => (
                    <div key={agent.id} className="flex items-center gap-2 p-2 rounded-lg bg-clawd-bg/50 text-sm">
                      <span className="text-lg">{agent.avatar}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs truncate">{agent.name}</div>
                        <div className={`text-xs ${
                          agent.status === 'busy' ? 'text-yellow-400' :
                          agent.status === 'active' ? 'text-green-400' : 'text-clawd-text-dim'
                        }`}>{agent.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {activeSubagents.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-clawd-border">
                    <div className="text-xs text-clawd-text-dim uppercase tracking-wider mb-2">Running Sub-agents</div>
                    <div className="space-y-1">
                      {activeSubagents.slice(0, 3).map((session) => (
                        <div key={session.key} className="flex items-center gap-2 p-2 rounded bg-clawd-bg/30 text-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          <span className="font-medium text-xs truncate flex-1">{session.displayName}</span>
                          <span className="text-xs text-clawd-text-dim">{((session.totalTokens || 0) / 1000).toFixed(1)}k</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Quick Action Modals */}
      <CalendarModal isOpen={activeModal === 'calendar'} onClose={() => setActiveModal(null)} />
      <EmailModal isOpen={activeModal === 'email'} onClose={() => setActiveModal(null)} />
      <MentionsModal isOpen={activeModal === 'mentions'} onClose={() => setActiveModal(null)} />
      <MessagesModal isOpen={activeModal === 'messages'} onClose={() => setActiveModal(null)} />
    </div>
  );
}

function formatTimeAgo(ts: number): string {
  if (!ts) return 'unknown';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return new Date(ts).toLocaleDateString();
}
