import { useEffect, useState } from 'react';
import { formatTimeAgo } from '../utils/formatting';
import {
  Activity, CheckCircle, Bot, MessageSquare, Wifi, WifiOff,
  ArrowRight, Calendar, Mail, RefreshCw, Bell, ChevronDown,
  Inbox, ListTodo, AlertTriangle, Sparkles,
  TrendingUp, Clock, Zap, Users, Send, Gamepad2, Monitor, Settings
} from 'lucide-react';
import { Spinner, TaskCardSkeleton, SessionCardSkeleton } from './LoadingStates';
import AgentAvatar from './AgentAvatar';

// X logo component  
const XIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

import TodayCalendarWidget from './TodayCalendarWidget';
import EmailWidget from './EmailWidget';
import QuickStatsWidget from './QuickStatsWidget';
import WeatherWidget from './WeatherWidget';
import { CalendarModal, EmailModal, MentionsModal, MessagesModal } from './QuickModals';
import { useStore } from '../store/store';

type View = 'dashboard' | 'kanban' | 'agents' | 'chat' | 'meetings' | 'settings' | 'notifications' | 'twitter' | 'inbox' | 'sessions' | 'library' | 'schedule' | 'codeagent' | 'calendar' | 'templates' | 'analytics' | 'comms' | 'accounts' | 'starred' | 'approvals';

interface DashboardProps {
  onNavigate?: (view: View) => void;
  onShowBrief?: () => void;
}

export default function DashboardRedesigned({ onNavigate, onShowBrief }: DashboardProps) {
  const { 
    connected, sessions, tasks, agents, activities, approvals, 
    fetchSessions, fetchAgents, clearActivities, gatewaySessions, loadGatewaySessions, loading 
  } = useStore();
  
  const [greeting, setGreeting] = useState('');
  const [loadingAction, _setLoadingAction] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'calendar' | 'email' | 'mentions' | 'messages' | null>(null);
  const [showActivityStream, setShowActivityStream] = useState(false);
  
  // Computed metrics
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
  const needsReview = tasks.filter(t => t.status === 'review');
  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  const unassignedTasks = tasks.filter(t => !t.assignedTo && t.status !== 'done');
  const urgentTasks = tasks.filter(t => t.priority === 'p0' && t.status !== 'done');
  const completedToday = tasks.filter(t => 
    t.status === 'done' && 
    new Date(t.updatedAt).toDateString() === new Date().toDateString()
  ).length;

  // Agent counts from Gateway
  const subagentSessions = gatewaySessions.filter(s => s.type === 'subagent');
  const activeSubagents = subagentSessions.filter(s => s.isActive);
  
  // Agent count from registry (exclude phantom agents like 'main', 'chat-agent')
  const PHANTOM_AGENTS = ['main', 'chat-agent'];
  const realAgents = agents.filter(a => !PHANTOM_AGENTS.includes(a.id));
  const totalAgentCount = realAgents.length;

  // Attention items for hero
  const urgentCount = pendingApprovals.length + urgentTasks.length + unassignedTasks.length;

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  useEffect(() => {
    // Load agents from registry on mount
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (connected) {
      loadGatewaySessions();
      const interval = setInterval(loadGatewaySessions, 30000);
      return () => clearInterval(interval);
    }
  }, [connected, loadGatewaySessions]);

  const handleQuickAction = (label: string) => {
    if (label === 'Daily Brief') {
      onShowBrief?.();
      return;
    }
    const modalMap: Record<string, 'calendar' | 'email' | 'mentions' | 'messages'> = {
      'Calendar': 'calendar',
      'Email': 'email',
      'X Mentions': 'mentions',
      'Messages': 'messages',
    };
    setActiveModal(modalMap[label] || null);
  };

  const quickActions = [
    { icon: Calendar, label: 'Calendar', color: 'from-blue-600 to-blue-700' },
    { icon: Mail, label: 'Email', color: 'from-green-600 to-green-700' },
    { icon: XIcon, label: 'X Mentions', color: 'from-gray-700 to-gray-900' },
    { icon: MessageSquare, label: 'Messages', color: 'from-purple-600 to-purple-700' },
    { icon: Sparkles, label: 'Daily Brief', color: 'from-orange-600 to-orange-700' },
  ];

  const getSessionIcon = (session: any) => {
    if (session.channel === 'whatsapp') return <MessageSquare size={18} />;
    if (session.channel === 'telegram') return <Send size={18} />;
    if (session.channel === 'discord') return <Gamepad2 size={18} />;
    if (session.key?.includes('subagent')) return <Bot size={18} />;
    if (session.key?.includes('cron')) return <Clock size={18} />;
    return <Monitor size={18} />;
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
    <div className="h-full overflow-auto bg-gradient-to-b from-mission-control-bg to-mission-control-surface">
      {/* HERO SECTION - Modern, spacious, attention-grabbing */}
      <div className="relative overflow-hidden bg-gradient-to-br from-mission-control-surface via-mission-control-bg to-mission-control-surface border-b border-mission-control-border/50">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-mission-control-accent/5 via-transparent to-purple-500/5 animate-gradient-x opacity-50" />
        
        <div className="relative w-full px-8 py-8">
          {/* Greeting & Status Row */}
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-mission-control-text via-mission-control-text to-mission-control-accent bg-clip-text text-transparent">
                {greeting}, Kevin
              </h1>
              
              {/* Status Pills */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Connection Status */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm ${
                  connected 
                    ? 'bg-success-subtle text-success border border-success-border' 
                    : 'bg-error-subtle text-error border border-error-border'
                }`}>
                  {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
                  {connected ? 'All Systems Online' : 'Connecting...'}
                </div>

                {/* Urgent Items */}
                {urgentCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-warning-subtle text-warning border border-warning-border backdrop-blur-sm animate-pulse">
                    <AlertTriangle size={12} />
                    {urgentCount} urgent {urgentCount === 1 ? 'item' : 'items'}
                  </div>
                )}

                {/* Active Agents */}
                {activeSubagents.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-info-subtle text-info border border-info-border backdrop-blur-sm">
                    <Bot size={12} />
                    {activeSubagents.length} agent{activeSubagents.length > 1 ? 's' : ''} working
                  </div>
                )}

                {/* Completed Today */}
                {completedToday > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-success-subtle text-success border border-success-border backdrop-blur-sm">
                    <CheckCircle size={12} />
                    {completedToday} completed today
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Pills - Large & Prominent */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {quickActions.map(({ icon: Icon, label, color }) => (
              <button
                key={label}
                onClick={() => handleQuickAction(label)}
                disabled={loadingAction === label}
                className={`group relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br ${color} 
                  hover:scale-105 active:scale-95 transition-all duration-200 
                  shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed
                  border border-black/10`}
              >
                <div className="relative z-10 flex flex-col items-center gap-2">
                  {loadingAction === label ? (
                    <Spinner size={24} className="text-white" />
                  ) : (
                    <Icon size={24} className="text-white" />
                  )}
                  <span className="text-sm font-medium text-white">{label}</span>
                </div>
                
                {/* Shine effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="w-full px-8 py-8 space-y-8">
        
        {/* PRIORITY METRICS - Larger, more prominent cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Pending Approvals - HERO CARD */}
          <button 
            onClick={() => onNavigate?.('approvals')}
            className={`group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 
              ${pendingApprovals.length > 0 
                ? 'bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-transparent border-2 border-warning-border hover:border-warning-border shadow-xl shadow-orange-500/20' 
                : 'bg-mission-control-surface border border-mission-control-border hover:border-mission-control-accent/50 shadow-lg'
              } hover:scale-105`}
          >
            {/* Animated background gradient */}
            {pendingApprovals.length > 0 && (
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10 animate-gradient-x opacity-50" />
            )}
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <Inbox size={28} className={`${pendingApprovals.length > 0 ? 'text-warning' : 'text-mission-control-text-dim'}`} />
                {pendingApprovals.length > 0 && (
                  <span className="px-3 py-1 bg-orange-500 text-white text-sm font-bold rounded-full animate-pulse shadow-lg">
                    {pendingApprovals.length}
                  </span>
                )}
              </div>
              
              <div className="text-5xl font-bold mb-2 bg-gradient-to-br from-mission-control-text to-orange-600 bg-clip-text text-transparent">
                {pendingApprovals.length}
              </div>
              
              <div className="text-sm font-medium text-mission-control-text-dim mb-3">Pending Approvals</div>
              
              {pendingApprovals.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-warning font-medium">
                  <Zap size={14} />
                  Action required
                </div>
              )}
            </div>
          </button>

          {/* Active Tasks */}
          <button 
            onClick={() => onNavigate?.('kanban')}
            className={`group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 
              ${inProgressTasks.length > 0 
                ? 'bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-transparent border border-info-border hover:border-info-border shadow-lg' 
                : 'bg-mission-control-surface border border-mission-control-border hover:border-mission-control-accent/50 shadow-lg'
              } hover:scale-105`}
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <ListTodo size={28} className={`${inProgressTasks.length > 0 ? 'text-info' : 'text-mission-control-text-dim'}`} />
                {needsReview.length > 0 && (
                  <span className="px-2.5 py-0.5 bg-review-subtle text-white text-xs font-medium rounded-full">
                    {needsReview.length} review
                  </span>
                )}
              </div>
              
              <div className="text-5xl font-bold mb-2 bg-gradient-to-br from-mission-control-text to-blue-600 bg-clip-text text-transparent">
                {inProgressTasks.length}
              </div>
              
              <div className="text-sm font-medium text-mission-control-text-dim mb-2">In Progress</div>
              
              {/* Mini progress bar */}
              {inProgressTasks.length > 0 && (
                <div className="h-2 bg-mission-control-border/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((inProgressTasks.length / (inProgressTasks.length + needsReview.length)) * 100, 100)}%` }}
                  />
                </div>
              )}
            </div>
          </button>

          {/* Urgent Tasks */}
          <button 
            onClick={() => onNavigate?.('kanban')}
            className={`group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 
              ${urgentTasks.length > 0 || unassignedTasks.length > 0
                ? 'bg-gradient-to-br from-yellow-500/20 via-yellow-500/10 to-transparent border border-warning-border hover:border-warning-border shadow-lg' 
                : 'bg-mission-control-surface border border-mission-control-border hover:border-mission-control-accent/50 shadow-lg'
              } hover:scale-105`}
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <AlertTriangle size={28} className={`${urgentTasks.length > 0 ? 'text-warning' : 'text-mission-control-text-dim'}`} />
                {urgentTasks.length > 0 && (
                  <span className="px-2.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                    P0
                  </span>
                )}
              </div>
              
              <div className="text-5xl font-bold mb-2 bg-gradient-to-br from-mission-control-text to-yellow-600 bg-clip-text text-transparent">
                {urgentTasks.length + unassignedTasks.length}
              </div>
              
              <div className="text-sm font-medium text-mission-control-text-dim">Needs Attention</div>
              
              {urgentTasks.length > 0 && (
                <div className="mt-2 text-xs text-warning">
                  {urgentTasks.length} urgent • {unassignedTasks.length} unassigned
                </div>
              )}
            </div>
          </button>

          {/* Active Agents */}
          <button 
            onClick={() => onNavigate?.('agents')}
            className={`group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 
              ${activeSubagents.length > 0
                ? 'bg-gradient-to-br from-green-500/20 via-green-500/10 to-transparent border border-success-border hover:border-success-border shadow-lg' 
                : 'bg-mission-control-surface border border-mission-control-border hover:border-mission-control-accent/50 shadow-lg'
              } hover:scale-105`}
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <Bot size={28} className={`${activeSubagents.length > 0 ? 'text-success' : 'text-mission-control-text-dim'}`} />
                {activeSubagents.length > 0 && (
                  <span className="w-3 h-3 rounded-full bg-success animate-pulse shadow-lg shadow-green-400/50" />
                )}
              </div>
              
              <div className="text-5xl font-bold mb-2 bg-gradient-to-br from-mission-control-text to-green-600 bg-clip-text text-transparent">
                {totalAgentCount}
              </div>
              
              <div className="text-sm font-medium text-mission-control-text-dim">Active Agents</div>
              
              {activeSubagents.length > 0 && (
                <div className="mt-2 text-xs text-success">
                  {activeSubagents.length} sub-agent{activeSubagents.length > 1 ? 's' : ''} running
                </div>
              )}
            </div>
          </button>
        </div>

        {/* MAIN 2-COLUMN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: Active Work (2 columns) */}
          <div className="lg:col-span-2">
            <div className="bg-mission-control-surface/80 backdrop-blur-xl rounded-2xl border border-mission-control-border/50 overflow-hidden shadow-xl">
              <div className="p-6 border-b border-mission-control-border/50 flex items-center justify-between bg-gradient-to-r from-mission-control-surface to-mission-control-bg">
                <h2 className="flex items-center gap-3 text-lg font-semibold">
                  <Activity size={20} className="text-info" />
                  Active Work
                  {inProgressTasks.length > 0 && (
                    <span className="px-2 py-0.5 bg-info-subtle text-info text-xs font-medium rounded-full">
                      {inProgressTasks.length}
                    </span>
                  )}
                </h2>
                <button 
                  onClick={() => onNavigate?.('kanban')}
                  className="flex items-center gap-2 text-sm text-mission-control-accent hover:text-mission-control-accent-dim transition-colors group"
                >
                  View All 
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
              
              <div className="divide-y divide-mission-control-border/30 max-h-96 overflow-y-auto">
                {loading.tasks ? (
                  <div className="p-4 space-y-3">
                    <TaskCardSkeleton />
                    <TaskCardSkeleton />
                    <TaskCardSkeleton />
                  </div>
                ) : [...inProgressTasks, ...needsReview].length === 0 ? (
                  <div className="p-12 text-center">
                    <CheckCircle size={48} className="mx-auto mb-4 text-success/50" />
                    <p className="text-lg font-medium text-mission-control-text-dim mb-2">All caught up!</p>
                    <p className="text-sm text-mission-control-text-dim mb-4">No active tasks at the moment</p>
                    <button 
                      onClick={() => onNavigate?.('kanban')}
                      className="px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors"
                    >
                      Create a task
                    </button>
                  </div>
                ) : (
                  [...inProgressTasks, ...needsReview].slice(0, 8).map((task) => {
                    const agent = agents.find(a => a.id === task.assignedTo);
                    return (
                      <div 
                        key={task.id} 
                        className="group p-4 hover:bg-mission-control-bg/30 transition-all cursor-pointer border-l-4 border-transparent hover:border-l-blue-400"
                        onClick={() => onNavigate?.('kanban')}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate?.('kanban'); } }}
                        role="button"
                        tabIndex={0}
                        aria-label={`Task: ${task.title}, status: ${task.status}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                            task.status === 'review' ? 'bg-review shadow-lg shadow-purple-400/50' :
                            task.status === 'in-progress' ? 'bg-info animate-pulse shadow-lg shadow-blue-400/50' :
                            'bg-mission-control-bg0'
                          }`} />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3 mb-1">
                              <h3 className="font-medium text-mission-control-text group-hover:text-mission-control-accent transition-colors">
                                {task.title}
                              </h3>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize flex-shrink-0 ${
                                task.status === 'review' 
                                  ? 'bg-review-subtle text-review border border-review-border' 
                                  : 'bg-info-subtle text-info border border-info-border'
                              }`}>
                                {task.status === 'in-progress' ? 'working' : task.status}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-3 text-sm text-mission-control-text-dim">
                              {task.project && (
                                <span className="flex items-center gap-1.5">
                                  <TrendingUp size={14} />
                                  {task.project}
                                </span>
                              )}
                              {agent && (
                                <span className="flex items-center gap-1.5">
                                  <AgentAvatar agentId={agent.id} fallbackEmoji={agent.avatar} size="xs" />
                                  {agent.name}
                                </span>
                              )}
                              {task.updatedAt && (
                                <span className="flex items-center gap-1.5">
                                  <Clock size={14} />
                                  {formatTimeAgo(task.updatedAt)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Today at a Glance (1 column) */}
          <div className="space-y-6">
            {/* Calendar Widget */}
            <div className="bg-mission-control-surface/80 backdrop-blur-xl rounded-2xl border border-mission-control-border/50 overflow-hidden shadow-xl">
              <TodayCalendarWidget onNavigate={onNavigate} />
            </div>

            {/* Email Widget */}
            <div className="bg-mission-control-surface/80 backdrop-blur-xl rounded-2xl border border-mission-control-border/50 overflow-hidden shadow-xl">
              <EmailWidget />
            </div>

            {/* Weather & Quick Stats side-by-side */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-mission-control-surface/80 backdrop-blur-xl rounded-2xl border border-mission-control-border/50 overflow-hidden shadow-xl">
                <WeatherWidget />
              </div>
              <div className="bg-mission-control-surface/80 backdrop-blur-xl rounded-2xl border border-mission-control-border/50 overflow-hidden shadow-xl">
                <QuickStatsWidget />
              </div>
            </div>
          </div>
        </div>

        {/* ACTIVITY STREAM - Collapsible glass panel */}
        <div className="bg-mission-control-surface/60 backdrop-blur-2xl rounded-2xl border border-mission-control-border/30 overflow-hidden shadow-2xl">
          <button 
            onClick={() => setShowActivityStream(!showActivityStream)}
            className="w-full p-6 flex items-center justify-between hover:bg-mission-control-bg/20 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-review-border">
                <Users size={24} className="text-review" />
              </div>
              
              <div className="text-left">
                <h3 className="text-lg font-semibold mb-1">Activity Stream</h3>
                <p className="text-sm text-mission-control-text-dim">
                  {sessions.length} sessions • {totalAgentCount} agents • {activities.length} notifications
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={(e) => { e.stopPropagation(); fetchSessions(); }}
                className="p-2 hover:bg-mission-control-border/50 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw size={18} className="text-mission-control-text-dim hover:text-mission-control-accent transition-colors" />
              </button>
              <div className={`transform transition-transform duration-200 ${showActivityStream ? 'rotate-180' : ''}`}>
                <ChevronDown size={24} className="text-mission-control-text-dim group-hover:text-mission-control-accent transition-colors" />
              </div>
            </div>
          </button>
          
          {showActivityStream && (
            <div className="border-t border-mission-control-border/30 bg-mission-control-bg/20">
              <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-mission-control-border/30">
                {/* Sessions */}
                <div className="p-6">
                  <h4 className="text-sm font-semibold text-mission-control-text-dim uppercase tracking-wider mb-4 flex items-center gap-2">
                    <MessageSquare size={14} />
                    Sessions ({sessions.length})
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {loading.sessions ? (
                      <>
                        <SessionCardSkeleton />
                        <SessionCardSkeleton />
                        <SessionCardSkeleton />
                      </>
                    ) : sessions.length === 0 ? (
                      <p className="text-sm text-mission-control-text-dim text-center py-8">No active sessions</p>
                    ) : (
                      sessions.slice(0, 6).map((s: any) => {
                        const isActive = Date.now() - (s.updatedAt || 0) < 300000;
                        return (
                          <div 
                            key={s.key} 
                            className="flex items-center gap-3 p-3 rounded-lg bg-mission-control-surface/50 hover:bg-mission-control-surface transition-colors"
                          >
                            <span className="text-mission-control-text-dim flex-shrink-0">{getSessionIcon(s)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{getSessionName(s)}</div>
                              <div className="text-xs text-mission-control-text-dim">{formatTimeAgo(s.updatedAt)}</div>
                            </div>
                            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-success' : 'bg-mission-control-bg0'}`} />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Agents */}
                <div className="p-6">
                  <h4 className="text-sm font-semibold text-mission-control-text-dim uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Bot size={14} />
                    Agents ({totalAgentCount})
                  </h4>
                  <div className="space-y-2">
                    {agents.slice(0, 4).map((agent) => (
                      <div 
                        key={agent.id} 
                        className="flex items-center gap-3 p-3 rounded-lg bg-mission-control-surface/50 hover:bg-mission-control-surface transition-colors"
                      >
                        <AgentAvatar agentId={agent.id} fallbackEmoji={agent.avatar} size="lg" />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{agent.name}</div>
                          <div className={`text-xs ${
                            agent.status === 'busy' ? 'text-success' :
                            agent.status === 'active' ? 'text-success' : 'text-mission-control-text-dim'
                          }`}>
                            {agent.status}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {activeSubagents.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-mission-control-border/30 space-y-2">
                        {activeSubagents.slice(0, 3).map((session) => (
                          <div 
                            key={session.key}
                            className="flex items-center gap-3 p-2 rounded-lg bg-success-subtle border border-success-border"
                          >
                            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate">{session.displayName}</div>
                              <div className="text-xs text-mission-control-text-dim">{((session.totalTokens || 0) / 1000).toFixed(1)}k tokens</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Notifications */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-mission-control-text-dim uppercase tracking-wider flex items-center gap-2">
                      <Bell size={14} />
                      Notifications ({activities.length})
                    </h4>
                    {activities.length > 0 && (
                      <button 
                        onClick={clearActivities}
                        className="text-xs text-mission-control-text-dim hover:text-mission-control-accent transition-colors"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {activities.length === 0 ? (
                      <div className="text-center py-8">
                        <Bell size={32} className="mx-auto mb-2 text-mission-control-text-dim/30" />
                        <p className="text-sm text-mission-control-text-dim">All caught up</p>
                      </div>
                    ) : (
                      activities.slice(0, 8).map((a) => (
                        <div 
                          key={a.id} 
                          className="flex items-start gap-3 p-3 rounded-lg bg-mission-control-surface/50 hover:bg-mission-control-surface transition-colors"
                        >
                          <span className="text-mission-control-text-dim flex-shrink-0">
                            {a.type === 'chat' ? <MessageSquare size={16} /> :
                             a.type === 'task' ? <CheckCircle size={16} /> :
                             a.type === 'agent' ? <Bot size={16} /> : <Settings size={16} />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-mission-control-text line-clamp-2">{a.message}</p>
                            <p className="text-xs text-mission-control-text-dim mt-1">{formatTimeAgo(a.timestamp)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
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

