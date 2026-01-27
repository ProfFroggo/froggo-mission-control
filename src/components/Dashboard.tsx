import { useEffect, useState } from 'react';
import { Activity, CheckCircle, Bot, MessageSquare, Wifi, WifiOff, Clock, Zap, ArrowRight, Calendar, Mail, Search, Mic, Plus, RefreshCw, Twitter, Bell, AlertCircle, Loader2 } from 'lucide-react';
import ActivityFeed from './ActivityFeed';
import CalendarWidget from './CalendarWidget';
import EmailWidget from './EmailWidget';
import { useStore } from '../store/store';
import { gateway } from '../lib/gateway';
import { showToast } from './Toast';

interface DashboardProps {
  onNavigate?: (view: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { connected, sessions, tasks, agents, activities, approvals, fetchSessions, addActivity, clearActivities, getUnassignedTasks, getTasksNeedingReview } = useStore();
  const [greeting, setGreeting] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  
  const activeTasks = tasks.filter(t => t.status === 'todo' || t.status === 'in-progress' || t.status === 'review').length;
  const needsReview = tasks.filter(t => t.status === 'review').length;
  const pendingApprovals = approvals.filter(a => a.status === 'pending').length;
  const busyAgents = agents.filter(a => a.status === 'busy').length;
  const unassignedTasks = tasks.filter(t => !t.assignedTo && t.status !== 'done').length;
  const completedToday = tasks.filter(t => 
    t.status === 'done' && 
    new Date(t.updatedAt).toDateString() === new Date().toDateString()
  ).length;

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

  const handleQuickAction = async (label: string, prompt: string) => {
    if (!connected) {
      showToast('error', 'Not connected to gateway');
      return;
    }
    
    setLoadingAction(label);
    showToast('info', `Asking Froggo about ${label.toLowerCase()}...`);
    
    try {
      await gateway.sendChat(prompt);
      // Navigate to chat to see the response
      if (onNavigate) {
        onNavigate('chat');
      }
    } catch (error) {
      console.error('Quick action error:', error);
      showToast('error', `Failed to check ${label.toLowerCase()}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const quickActions = [
    { icon: Calendar, label: 'Calendar', color: 'text-blue-400', prompt: "What's on my calendar today? Give me a quick summary." },
    { icon: Mail, label: 'Email', color: 'text-green-400', prompt: "Check my unread emails and highlight anything important" },
    { icon: Twitter, label: 'X Mentions', color: 'text-sky-400', prompt: "Check @Prof_Frogo mentions on X and draft replies for approval" },
    { icon: MessageSquare, label: 'Messages', color: 'text-purple-400', prompt: "Check WhatsApp and Telegram for any important messages" },
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

  return (
    <div className="h-full overflow-auto">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-clawd-accent/20 via-clawd-surface to-clawd-bg p-8 border-b border-clawd-border">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{greeting}, Kevin 👋</h1>
              <p className="text-clawd-text-dim">
                {pendingApprovals > 0 
                  ? `${pendingApprovals} item${pendingApprovals > 1 ? 's' : ''} waiting for your approval.`
                  : activeTasks > 0 
                    ? `${activeTasks} active task${activeTasks > 1 ? 's' : ''}, ${busyAgents} agent${busyAgents !== 1 ? 's' : ''} working.`
                    : 'All caught up! Ready to get things done?'}
              </p>
              
              {/* Orchestration Status */}
              {(busyAgents > 0 || unassignedTasks > 0 || needsReview > 0) && (
                <div className="flex gap-3 mt-3">
                  {busyAgents > 0 && (
                    <span className="flex items-center gap-1 text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full">
                      <Zap size={12} /> {busyAgents} agent{busyAgents > 1 ? 's' : ''} working
                    </span>
                  )}
                  {unassignedTasks > 0 && (
                    <span className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full">
                      <Clock size={12} /> {unassignedTasks} unassigned
                    </span>
                  )}
                  {needsReview > 0 && (
                    <span className="flex items-center gap-1 text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full">
                      <AlertCircle size={12} /> {needsReview} needs review
                    </span>
                  )}
                </div>
              )}
            </div>
            
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
              connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
              <span className="text-sm font-medium">{connected ? 'Online' : 'Connecting...'}</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-6 flex gap-3">
            {quickActions.map(({ icon: Icon, label, color, prompt }, i) => (
              <button
                key={i}
                onClick={() => handleQuickAction(label, prompt)}
                disabled={loadingAction === label}
                className="flex items-center gap-2 px-4 py-2 bg-clawd-surface/80 backdrop-blur rounded-xl border border-clawd-border hover:border-clawd-accent transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-wait"
              >
                {loadingAction === label ? (
                  <Loader2 size={18} className={`${color} animate-spin`} />
                ) : (
                  <Icon size={18} className={color} />
                )}
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard 
            icon={<MessageSquare className="text-clawd-accent" />} 
            label="Sessions" 
            value={sessions.length}
            subtext={sessions.filter(s => Date.now() - (s.updatedAt || 0) < 300000).length + ' active'}
          />
          <StatCard 
            icon={<Bot className="text-blue-400" />} 
            label="Agents" 
            value={agents.length}
            subtext={agents.filter(a => a.status === 'active').length + ' online'}
          />
          <StatCard 
            icon={<Activity className="text-yellow-400" />} 
            label="Tasks" 
            value={activeTasks}
            subtext={tasks.filter(t => t.status === 'in-progress').length + ' in progress'}
          />
          <StatCard 
            icon={<CheckCircle className="text-green-400" />} 
            label="Done Today" 
            value={completedToday}
            subtext="tasks completed"
          />
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Sessions Column */}
          <div className="col-span-2 space-y-6">
            {/* Active Sessions */}
            <div className="bg-clawd-surface rounded-2xl border border-clawd-border overflow-hidden shadow-card-lg">
              <div className="p-4 border-b border-clawd-border flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <MessageSquare size={18} /> Sessions
                </h2>
                <button 
                  onClick={fetchSessions}
                  className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
              
              <div className="divide-y divide-clawd-border">
                {sessions.length === 0 ? (
                  <div className="p-8 text-center text-clawd-text-dim">
                    <MessageSquare size={32} className="mx-auto mb-3 opacity-50" />
                    <p>{connected ? 'No active sessions' : 'Connecting...'}</p>
                  </div>
                ) : (
                  sessions.slice(0, 6).map((s: any) => {
                    const isActive = Date.now() - (s.updatedAt || 0) < 300000;
                    return (
                      <div 
                        key={s.key} 
                        className="p-4 hover:bg-clawd-bg/50 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">{getSessionIcon(s)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
                              <span className="font-medium truncate">{getSessionName(s)}</span>
                              <span className="text-xs text-clawd-text-dim ml-auto flex items-center gap-1">
                                <Clock size={10} />
                                {formatTimeAgo(s.updatedAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-clawd-text-dim">
                              <span className={`px-2 py-0.5 rounded-full text-xs border ${
                                s.channel === 'discord' ? 'badge-discord' :
                                s.channel === 'telegram' ? 'badge-telegram' :
                                s.channel === 'whatsapp' ? 'badge-whatsapp' :
                                s.channel === 'agents' ? 'badge-agents' :
                                'badge-webchat'
                              }`}>{s.channel || 'web'}</span>
                              <span>{(s.totalTokens || 0).toLocaleString()} tokens</span>
                              {s.model && <span className="truncate">{s.model.split('/').pop()}</span>}
                            </div>
                          </div>
                          <ArrowRight size={16} className="text-clawd-text-dim opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              
              {sessions.length > 6 && (
                <div className="p-3 border-t border-clawd-border text-center">
                  <button 
                    onClick={() => onNavigate?.('sessions')}
                    className="text-sm text-clawd-accent hover:underline"
                  >
                    View all {sessions.length} sessions
                  </button>
                </div>
              )}
            </div>

            {/* Recent Tasks */}
            <div className="bg-clawd-surface rounded-2xl border border-clawd-border overflow-hidden shadow-card-lg">
              <div className="p-4 border-b border-clawd-border flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <Activity size={18} /> Recent Tasks
                </h2>
                <button 
                  onClick={() => onNavigate?.('kanban')}
                  className="flex items-center gap-1 text-sm text-clawd-accent hover:underline"
                >
                  <Plus size={14} /> New Task
                </button>
              </div>
              
              <div className="divide-y divide-clawd-border">
                {tasks.length === 0 ? (
                  <div className="p-8 text-center text-clawd-text-dim">
                    <CheckCircle size={32} className="mx-auto mb-3 opacity-50" />
                    <p>No tasks yet</p>
                    <p className="text-sm">Create one from the Tasks tab</p>
                  </div>
                ) : (
                  tasks.slice(0, 4).map((task) => {
                    const agent = agents.find(a => a.id === task.assignedTo);
                    return (
                      <div key={task.id} className="p-4 hover:bg-clawd-bg/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            task.status === 'done' ? 'bg-green-400' :
                            task.status === 'in-progress' ? 'bg-yellow-400' :
                            task.status === 'todo' ? 'bg-blue-400' : 'bg-gray-400'
                          }`} />
                          <span className="font-medium flex-1 truncate">{task.title}</span>
                          {agent && (
                            <span className="text-sm text-clawd-text-dim flex items-center gap-1">
                              {agent.avatar} {agent.name}
                            </span>
                          )}
                          <span className="text-xs px-2 py-0.5 bg-clawd-border rounded-full capitalize">
                            {task.status.replace('-', ' ')}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Activity Feed Column */}
          <div className="space-y-6">
            {/* Calendar Widget */}
            <CalendarWidget />
            
            {/* Email Widget */}
            <EmailWidget />
            
            {/* Channel Activity Feed */}
            <div className="bg-clawd-surface rounded-2xl border border-clawd-border overflow-hidden shadow-card-lg h-64">
              <ActivityFeed />
            </div>
            
            {/* Recent Activity */}
            <div className="bg-clawd-surface rounded-2xl border border-clawd-border overflow-hidden shadow-card-lg">
              <div className="p-4 border-b border-clawd-border flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <Zap size={18} /> Recent Actions
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
              
              <div className="max-h-96 overflow-y-auto">
                {activities.length === 0 ? (
                  <div className="p-8 text-center text-clawd-text-dim">
                    <Zap size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Activity will appear here</p>
                  </div>
                ) : (
                  <div className="divide-y divide-clawd-border">
                    {activities.slice(0, 15).map((a) => (
                      <div key={a.id} className="p-3 text-sm">
                        <div className="flex items-start gap-2">
                          <span className="text-base">
                            {a.type === 'chat' ? '💬' : 
                             a.type === 'task' ? '✅' : 
                             a.type === 'agent' ? '🤖' : '⚙️'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-clawd-text truncate">{a.message}</p>
                            <p className="text-xs text-clawd-text-dim">{formatTimeAgo(a.timestamp)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Agents */}
            <div className="bg-clawd-surface rounded-2xl border border-clawd-border p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Bot size={16} /> Agents
              </h3>
              <div className="space-y-2">
                {agents.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-clawd-bg transition-colors cursor-pointer">
                    <span className="text-xl">{agent.avatar}</span>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{agent.name}</div>
                      <div className="text-xs text-clawd-text-dim">{agent.description}</div>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      agent.status === 'active' ? 'bg-green-400' :
                      agent.status === 'busy' ? 'bg-yellow-400' : 'bg-gray-400'
                    }`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subtext }: { icon: React.ReactNode; label: string; value: number; subtext: string }) {
  return (
    <div className="bg-clawd-surface rounded-2xl border border-clawd-border p-5 hover:border-clawd-accent/50 transition-colors">
      <div className="flex items-center gap-2 mb-3 text-clawd-text-dim">{icon}<span className="text-sm">{label}</span></div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-xs text-clawd-text-dim">{subtext}</div>
    </div>
  );
}

function formatTimeAgo(ts: number): string {
  if (!ts) return 'unknown';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}
