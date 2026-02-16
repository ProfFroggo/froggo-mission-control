import { useEffect, useState, useRef } from 'react';
import { 
  Activity, CheckCircle, Bot, MessageSquare, Wifi, WifiOff, 
  ArrowRight, Calendar, RefreshCw, Bell, ChevronDown, 
  Inbox, ListTodo, AlertTriangle, Sparkles, 
  TrendingUp, Clock, Zap, Users, Edit3, Plus, RotateCcw,
  X, Minus, Maximize2, Shield, type LucideIcon
} from 'lucide-react';
import { ResponsiveGridLayout } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { TaskCardSkeleton, SessionCardSkeleton } from './LoadingStates';
import AgentAvatar from './AgentAvatar';
import TodayCalendarWidget from './TodayCalendarWidget';
import QuickStatsWidget from './QuickStatsWidget';
import WeatherWidget from './WeatherWidget';
import TokenSummaryWidget from './TokenSummaryWidget';
import HealthStatusWidget from './HealthStatusWidget';
import InboxWidget from './InboxWidget';
import NewContentWidget from './NewContentWidget';
import { useStore } from '../store/store';

type View = 'dashboard' | 'kanban' | 'agents' | 'chat' | 'meetings' | 'voicechat' | 'settings' | 'notifications' | 'twitter' | 'inbox' | 'approvals' | 'library' | 'schedule' | 'codeagent' | 'context' | 'analytics' | 'comms' | 'contacts' | 'accounts' | 'sessions' | 'calendar' | 'templates' | 'agentdms' | 'finance' | 'writing';

interface DashboardProps {
  onNavigate?: (view: View) => void;
  onShowBrief?: () => void;
}

interface WidgetConfig {
  id: string;
  title: string;
  icon: LucideIcon;
  removable: boolean;
}

const WIDGET_CONFIGS: WidgetConfig[] = [
  { id: 'hero', title: 'Dashboard Header', icon: Sparkles, removable: false },
  { id: 'approvals', title: 'Pending Approvals', icon: Inbox, removable: true },
  { id: 'inbox', title: 'Unread Inbox', icon: Inbox, removable: true },
  { id: 'active-tasks', title: 'Active Tasks', icon: ListTodo, removable: true },
  { id: 'urgent', title: 'Needs Attention', icon: AlertTriangle, removable: true },
  { id: 'agents-count', title: 'Active Agents', icon: Bot, removable: true },
  { id: 'new-content', title: 'New Content', icon: Sparkles, removable: true },
  { id: 'active-work', title: 'Active Work', icon: Activity, removable: true },
  { id: 'calendar', title: 'Calendar', icon: Calendar, removable: true },
  { id: 'weather', title: 'Weather', icon: TrendingUp, removable: true },
  { id: 'quick-stats', title: 'Quick Stats', icon: TrendingUp, removable: true },
  { id: 'token-usage', title: 'Token Usage', icon: Zap, removable: true },
  { id: 'health-status', title: 'System Health', icon: Shield, removable: true },
  { id: 'activity', title: 'Activity Stream', icon: Users, removable: true },
];

const DEFAULT_LAYOUT: Layout[] = [
  { i: 'hero', x: 0, y: 0, w: 12, h: 5, static: true },
  { i: 'approvals', x: 0, y: 5, w: 2, h: 4 },
  { i: 'inbox', x: 2, y: 5, w: 2, h: 4 },
  { i: 'active-tasks', x: 4, y: 5, w: 2, h: 4 },
  { i: 'urgent', x: 6, y: 5, w: 2, h: 4 },
  { i: 'agents-count', x: 8, y: 5, w: 2, h: 4 },
  { i: 'new-content', x: 10, y: 5, w: 2, h: 4 },
  { i: 'active-work', x: 0, y: 9, w: 8, h: 8 },
  { i: 'calendar', x: 8, y: 9, w: 4, h: 4 },
  { i: 'weather', x: 8, y: 13, w: 2, h: 3 },
  { i: 'quick-stats', x: 10, y: 13, w: 2, h: 3 },
  { i: 'token-usage', x: 8, y: 16, w: 4, h: 3 },
  { i: 'health-status', x: 0, y: 17, w: 4, h: 4 },
  { i: 'activity', x: 0, y: 21, w: 12, h: 5 },
];

interface DashboardWidgetProps {
  id: string;
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  onRemove?: () => void;
  editMode: boolean;
  minimized: boolean;
  onToggleMinimize: () => void;
  removable?: boolean;
}

function DashboardWidget({ 
  id, 
  title, 
  icon: Icon, 
  children, 
  onRemove, 
  editMode, 
  minimized, 
  onToggleMinimize,
  removable = true 
}: DashboardWidgetProps) {
  return (
    <div className="h-full bg-clawd-surface/80 backdrop-blur-xl rounded-2xl border border-clawd-border overflow-hidden shadow-xl flex flex-col relative">
      {/* Minimal drag handle - only visible in edit mode */}
      {editMode && (
        <div className="widget-drag-handle absolute top-2 left-1/2 -translate-x-1/2 z-10 cursor-move">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-clawd-bg/80 backdrop-blur-sm border border-clawd-border/50">
            <div className="w-1 h-1 rounded-full bg-clawd-text-dim/50"></div>
            <div className="w-1 h-1 rounded-full bg-clawd-text-dim/50"></div>
            <div className="w-1 h-1 rounded-full bg-clawd-text-dim/50"></div>
          </div>
        </div>
      )}
      
      {/* Control buttons - only in edit mode */}
      {editMode && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          <button
            onClick={onToggleMinimize}
            className="p-1.5 bg-clawd-bg/80 backdrop-blur-sm hover:bg-clawd-border/80 rounded-lg transition-colors border border-clawd-border/50"
            title={minimized ? "Maximize" : "Minimize"}
          >
            {minimized ? <Maximize2 size={14} className="text-clawd-text-dim" /> : <Minus size={14} className="text-clawd-text-dim" />}
          </button>
          {removable && onRemove && (
            <button
              onClick={onRemove}
              className="p-1.5 bg-clawd-bg/80 backdrop-blur-sm hover:bg-red-500/20 rounded-lg transition-colors border border-clawd-border/50"
              title="Remove widget"
            >
              <X size={14} className="text-error" />
            </button>
          )}
        </div>
      )}
      
      {/* Content - no header bar, full height */}
      <div className={`flex-1 overflow-auto ${minimized ? 'hidden' : ''} ${editMode ? 'pt-2' : ''}`}>
        {children}
      </div>
      
      {minimized && (
        <div className="flex-1 flex items-center justify-center text-clawd-text-dim text-sm">
          <div className="flex items-center gap-2">
            <Icon size={16} className="text-clawd-text-dim/50" />
            <span>{title} (minimized)</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardRedesigned({ onNavigate, onShowBrief }: DashboardProps) {
  const { 
    connected, sessions, tasks, agents, activities, approvals, 
    fetchSessions, fetchAgents, clearActivities, gatewaySessions, loadGatewaySessions, loading 
  } = useStore();
  
  const [greeting, setGreeting] = useState('');
  const [showActivityStream, setShowActivityStream] = useState(false);
  
  // Widget customization state
  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState<Layout[]>(() => {
    const saved = localStorage.getItem('dashboard-widget-layout');
    return saved ? JSON.parse(saved) : DEFAULT_LAYOUT;
  });
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('dashboard-hidden-widgets');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [minimizedWidgets, setMinimizedWidgets] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('dashboard-minimized-widgets');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [showAddWidget, setShowAddWidget] = useState(false);

  // Grid container width
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  
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
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (connected) {
      loadGatewaySessions();
      const interval = setInterval(loadGatewaySessions, 30000);
      return () => clearInterval(interval);
    }
  }, [connected, loadGatewaySessions]);

  const handleLayoutChange = (newLayout: Layout[]) => {
    setLayout(newLayout);
    localStorage.setItem('dashboard-widget-layout', JSON.stringify(newLayout));
  };

  const handleRemoveWidget = (widgetId: string) => {
    const newHidden = new Set(hiddenWidgets);
    newHidden.add(widgetId);
    setHiddenWidgets(newHidden);
    localStorage.setItem('dashboard-hidden-widgets', JSON.stringify([...newHidden]));
  };

  const handleAddWidget = (widgetId: string) => {
    const newHidden = new Set(hiddenWidgets);
    newHidden.delete(widgetId);
    setHiddenWidgets(newHidden);
    localStorage.setItem('dashboard-hidden-widgets', JSON.stringify([...newHidden]));
    setShowAddWidget(false);
  };

  const handleResetLayout = () => {
    if (confirm('Reset dashboard to default layout?')) {
      setLayout(DEFAULT_LAYOUT);
      setHiddenWidgets(new Set());
      setMinimizedWidgets(new Set());
      localStorage.setItem('dashboard-widget-layout', JSON.stringify(DEFAULT_LAYOUT));
      localStorage.removeItem('dashboard-hidden-widgets');
      localStorage.removeItem('dashboard-minimized-widgets');
    }
  };

  const handleToggleMinimize = (widgetId: string) => {
    const newMinimized = new Set(minimizedWidgets);
    if (newMinimized.has(widgetId)) {
      newMinimized.delete(widgetId);
    } else {
      newMinimized.add(widgetId);
    }
    setMinimizedWidgets(newMinimized);
    localStorage.setItem('dashboard-minimized-widgets', JSON.stringify([...newMinimized]));
  };

  /** Session object from gateway */
  interface SessionInfo {
    key?: string;
    channel?: string;
    displayName?: string;
  }

  const getSessionIcon = (session: SessionInfo) => {
    if (session.channel === 'whatsapp') return '💬';
    if (session.channel === 'telegram') return '✈️';
    if (session.channel === 'discord') return '🎮';
    if (session.key?.includes('subagent')) return '🤖';
    if (session.key?.includes('cron')) return '⏰';
    return '💻';
  };

  const getSessionName = (session: SessionInfo) => {
    const key = session.key || '';
    const parts = key.split(':');
    const last = parts[parts.length - 1];
    if (last.includes('-') && last.length > 20) {
      return last.slice(0, 8) + '...';
    }
    return last || 'Unknown';
  };

  const visibleWidgets = WIDGET_CONFIGS.filter(w => !hiddenWidgets.has(w.id));
  const availableWidgets = WIDGET_CONFIGS.filter(w => hiddenWidgets.has(w.id) && w.removable);

  return (
    <div className="h-full overflow-auto bg-gradient-to-b from-clawd-bg to-clawd-surface">
      {/* Grid Layout */}
      <div ref={gridContainerRef} className="px-6 py-4">
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: layout }}
          width={containerWidth}
          breakpoints={{ lg: 1200, md: 996, sm: 768 }}
          cols={{ lg: 12, md: 12, sm: 12 }}
          rowHeight={40}
          margin={[8, 8]}
          onLayoutChange={handleLayoutChange}
          isDraggable={editMode}
          isResizable={editMode}
          draggableHandle=".widget-drag-handle"
          compactType="vertical"
          preventCollision={false}
        >
          {/* HERO WIDGET */}
          {/* Hero is NOT a widget — static header, no wrapper */}
            <div key="hero">
              <div className="h-full flex flex-col justify-center px-6 py-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-3">
                      <h1 className="text-3xl font-bold tracking-tight leading-tight bg-gradient-to-r from-clawd-text via-clawd-text to-clawd-accent bg-clip-text text-transparent">
                        {greeting}, Kevin
                      </h1>
                      
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm ${
                          connected 
                            ? 'bg-green-500/20 text-success border border-success-border' 
                            : 'bg-red-500/20 text-error border border-error-border'
                        }`}>
                          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
                          {connected ? 'All Systems Online' : 'Connecting...'}
                        </div>

                        {urgentCount > 0 && (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-orange-500/20 text-warning border border-orange-500/30 backdrop-blur-sm animate-pulse">
                            <AlertTriangle size={12} />
                            {urgentCount} urgent {urgentCount === 1 ? 'item' : 'items'}
                          </div>
                        )}

                        {activeSubagents.length > 0 && (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/20 text-info border border-info-border backdrop-blur-sm">
                            <Bot size={12} />
                            {activeSubagents.length} agent{activeSubagents.length > 1 ? 's' : ''} working
                          </div>
                        )}

                        {completedToday > 0 && (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-green-500/20 text-success border border-success-border backdrop-blur-sm">
                            <CheckCircle size={12} />
                            {completedToday} completed today
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Edit layout controls - compact floating panel */}
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        {/* Single compact button to toggle edit mode */}
                        <button
                          onClick={() => setEditMode(!editMode)}
                          className={`p-2 rounded-lg transition-all ${
                            editMode 
                              ? 'bg-clawd-accent text-white shadow-lg' 
                              : 'bg-clawd-surface/50 text-clawd-text-dim hover:bg-clawd-surface border border-clawd-border'
                          }`}
                          title={editMode ? 'Exit edit mode' : 'Edit layout'}
                        >
                          <Edit3 size={18} />
                        </button>
                        
                        {/* Floating panel with edit tools - only shown in edit mode */}
                        {editMode && (
                          <div className="absolute right-0 top-full mt-2 bg-clawd-surface border border-clawd-border rounded-xl shadow-2xl z-50 p-3 min-w-[200px]">
                            <div className="space-y-2">
                              {/* Add Widget */}
                              <button
                                onClick={() => setShowAddWidget(!showAddWidget)}
                                className="w-full flex items-center gap-2 px-3 py-2 bg-clawd-accent/20 text-clawd-accent rounded-lg hover:bg-clawd-accent/30 transition-colors text-sm font-medium"
                              >
                                <Plus size={16} />
                                Add Widget
                              </button>
                              
                              {/* Reset Layout */}
                              <button
                                onClick={handleResetLayout}
                                className="w-full flex items-center gap-2 px-3 py-2 bg-clawd-bg text-clawd-text-dim rounded-lg hover:bg-clawd-border transition-colors text-sm font-medium"
                                title="Reset to default layout"
                              >
                                <RotateCcw size={16} />
                                Reset Layout
                              </button>
                              
                              {/* Done button */}
                              <button
                                onClick={() => setEditMode(false)}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors text-sm font-medium"
                              >
                                Done Editing
                              </button>
                            </div>
                            
                            {/* Add widget dropdown */}
                            {showAddWidget && (
                              <div className="mt-2 pt-2 border-t border-clawd-border max-h-48 overflow-y-auto">
                                {WIDGET_CONFIGS.filter(w => hiddenWidgets.has(w.id) && w.removable).map(w => (
                                  <button
                                    key={w.id}
                                    onClick={() => { handleAddWidget(w.id); setShowAddWidget(false); }}
                                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-clawd-border/50 rounded-lg transition-colors text-left"
                                  >
                                    <w.icon size={16} className="text-clawd-accent" />
                                    <span className="text-sm">{w.title}</span>
                                  </button>
                                ))}
                                {WIDGET_CONFIGS.filter(w => hiddenWidgets.has(w.id) && w.removable).length === 0 && (
                                  <div className="px-3 py-2 text-xs text-clawd-text-dim text-center">All widgets visible</div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
              </div>
            </div>

          {/* APPROVALS WIDGET */}
          {!hiddenWidgets.has('approvals') && (
            <div key="approvals">
              <DashboardWidget
                id="approvals"
                title="Pending Approvals"
                icon={Inbox}
                editMode={editMode}
                minimized={minimizedWidgets.has('approvals')}
                onToggleMinimize={() => handleToggleMinimize('approvals')}
                onRemove={() => handleRemoveWidget('approvals')}
              >
                <button 
                  onClick={() => onNavigate?.('approvals')}
                  className="w-full h-full p-6 text-left hover:bg-clawd-bg/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-4">
                    <Inbox size={28} className={`${pendingApprovals.length > 0 ? 'text-warning' : 'text-clawd-text-dim'}`} />
                    {pendingApprovals.length > 0 && (
                      <span className="px-3 py-1 bg-orange-500 text-white text-sm font-bold rounded-full animate-pulse shadow-lg">
                        {pendingApprovals.length}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-5xl font-bold mb-2 bg-gradient-to-br from-clawd-text to-orange-400 bg-clip-text text-transparent">
                    {pendingApprovals.length}
                  </div>
                  
                  <div className="text-sm font-medium text-clawd-text-dim mb-3">Pending Approvals</div>
                  
                  {pendingApprovals.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-warning font-medium">
                      <Zap size={14} />
                      Action required
                    </div>
                  )}
                </button>
              </DashboardWidget>
            </div>
          )}

          {/* INBOX WIDGET */}
          {!hiddenWidgets.has('inbox') && (
            <div key="inbox">
              <DashboardWidget
                id="inbox"
                title="Unread Inbox"
                icon={Inbox}
                editMode={editMode}
                minimized={minimizedWidgets.has('inbox')}
                onToggleMinimize={() => handleToggleMinimize('inbox')}
                onRemove={() => handleRemoveWidget('inbox')}
              >
                <InboxWidget />
              </DashboardWidget>
            </div>
          )}

          {/* ACTIVE TASKS WIDGET */}
          {!hiddenWidgets.has('active-tasks') && (
            <div key="active-tasks">
              <DashboardWidget
                id="active-tasks"
                title="Active Tasks"
                icon={ListTodo}
                editMode={editMode}
                minimized={minimizedWidgets.has('active-tasks')}
                onToggleMinimize={() => handleToggleMinimize('active-tasks')}
                onRemove={() => handleRemoveWidget('active-tasks')}
              >
                <button 
                  onClick={() => onNavigate?.('kanban')}
                  className="w-full h-full p-6 text-left hover:bg-clawd-bg/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-4">
                    <ListTodo size={28} className={`${inProgressTasks.length > 0 ? 'text-info' : 'text-clawd-text-dim'}`} />
                    {needsReview.length > 0 && (
                      <span className="px-2.5 py-0.5 bg-purple-500/80 text-white text-xs font-medium rounded-full">
                        {needsReview.length} review
                      </span>
                    )}
                  </div>
                  
                  <div className="text-5xl font-bold mb-2 bg-gradient-to-br from-clawd-text to-blue-400 bg-clip-text text-transparent">
                    {inProgressTasks.length}
                  </div>
                  
                  <div className="text-sm font-medium text-clawd-text-dim mb-2">In Progress</div>
                  
                  {inProgressTasks.length > 0 && (
                    <div className="h-2 bg-clawd-bg/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((inProgressTasks.length / (inProgressTasks.length + needsReview.length)) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </button>
              </DashboardWidget>
            </div>
          )}

          {/* URGENT TASKS WIDGET */}
          {!hiddenWidgets.has('urgent') && (
            <div key="urgent">
              <DashboardWidget
                id="urgent"
                title="Needs Attention"
                icon={AlertTriangle}
                editMode={editMode}
                minimized={minimizedWidgets.has('urgent')}
                onToggleMinimize={() => handleToggleMinimize('urgent')}
                onRemove={() => handleRemoveWidget('urgent')}
              >
                <button 
                  onClick={() => onNavigate?.('kanban')}
                  className="w-full h-full p-6 text-left hover:bg-clawd-bg/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-4">
                    <AlertTriangle size={28} className={`${urgentTasks.length > 0 ? 'text-warning' : 'text-clawd-text-dim'}`} />
                    {urgentTasks.length > 0 && (
                      <span className="px-2.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                        P0
                      </span>
                    )}
                  </div>
                  
                  <div className="text-5xl font-bold mb-2 bg-gradient-to-br from-clawd-text to-yellow-400 bg-clip-text text-transparent">
                    {urgentTasks.length + unassignedTasks.length}
                  </div>
                  
                  <div className="text-sm font-medium text-clawd-text-dim">Needs Attention</div>
                  
                  {urgentTasks.length > 0 && (
                    <div className="mt-2 text-xs text-warning">
                      {urgentTasks.length} urgent • {unassignedTasks.length} unassigned
                    </div>
                  )}
                </button>
              </DashboardWidget>
            </div>
          )}

          {/* AGENTS COUNT WIDGET */}
          {!hiddenWidgets.has('agents-count') && (
            <div key="agents-count">
              <DashboardWidget
                id="agents-count"
                title="Active Agents"
                icon={Bot}
                editMode={editMode}
                minimized={minimizedWidgets.has('agents-count')}
                onToggleMinimize={() => handleToggleMinimize('agents-count')}
                onRemove={() => handleRemoveWidget('agents-count')}
              >
                <button 
                  onClick={() => onNavigate?.('agents')}
                  className="w-full h-full p-6 text-left hover:bg-clawd-bg/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-4">
                    <Bot size={28} className={`${activeSubagents.length > 0 ? 'text-success' : 'text-clawd-text-dim'}`} />
                    {activeSubagents.length > 0 && (
                      <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse shadow-lg shadow-green-400/50" />
                    )}
                  </div>
                  
                  <div className="text-5xl font-bold mb-2 bg-gradient-to-br from-clawd-text to-green-400 bg-clip-text text-transparent">
                    {totalAgentCount}
                  </div>
                  
                  <div className="text-sm font-medium text-clawd-text-dim">Active Agents</div>
                  
                  {activeSubagents.length > 0 && (
                    <div className="mt-2 text-xs text-success">
                      {activeSubagents.length} sub-agent{activeSubagents.length > 1 ? 's' : ''} running
                    </div>
                  )}
                </button>
              </DashboardWidget>
            </div>
          )}

          {/* NEW CONTENT WIDGET */}
          {!hiddenWidgets.has('new-content') && (
            <div key="new-content">
              <DashboardWidget
                id="new-content"
                title="New Content"
                icon={Sparkles}
                editMode={editMode}
                minimized={minimizedWidgets.has('new-content')}
                onToggleMinimize={() => handleToggleMinimize('new-content')}
                onRemove={() => handleRemoveWidget('new-content')}
              >
                <NewContentWidget />
              </DashboardWidget>
            </div>
          )}

          {/* ACTIVE WORK WIDGET */}
          {!hiddenWidgets.has('active-work') && (
            <div key="active-work">
              <DashboardWidget
                id="active-work"
                title="Active Work"
                icon={Activity}
                editMode={editMode}
                minimized={minimizedWidgets.has('active-work')}
                onToggleMinimize={() => handleToggleMinimize('active-work')}
                onRemove={() => handleRemoveWidget('active-work')}
              >
                <div>
                  <div className="p-4 border-b border-clawd-border/50 flex items-center justify-between bg-gradient-to-r from-clawd-surface to-clawd-bg">
                    <div className="flex items-center gap-2">
                      {inProgressTasks.length > 0 && (
                        <span className="px-2 py-0.5 bg-info-subtle text-info text-xs font-medium rounded-full">
                          {inProgressTasks.length}
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={() => onNavigate?.('kanban')}
                      className="flex items-center gap-2 text-sm text-clawd-accent hover:text-clawd-accent-dim transition-colors group"
                    >
                      View All 
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                  
                  <div className="divide-y divide-clawd-border/30 max-h-96 overflow-y-auto">
                    {loading.tasks ? (
                      <div className="p-4 space-y-3">
                        <TaskCardSkeleton />
                        <TaskCardSkeleton />
                        <TaskCardSkeleton />
                      </div>
                    ) : [...inProgressTasks, ...needsReview].length === 0 ? (
                      <div className="p-12 text-center">
                        <CheckCircle size={48} className="mx-auto mb-4 text-success/50" />
                        <p className="text-lg font-medium text-clawd-text-dim mb-2">All caught up!</p>
                        <p className="text-sm text-clawd-text-dim mb-4">No active tasks at the moment</p>
                        <button 
                          onClick={() => onNavigate?.('kanban')}
                          className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors"
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
                            className="group p-4 hover:bg-clawd-bg/30 transition-all cursor-pointer border-l-4 border-transparent hover:border-l-blue-400"
                            onClick={() => onNavigate?.('kanban')}
                          >
                            <div className="flex items-start gap-4">
                              <div className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                task.status === 'review' ? 'bg-purple-400 shadow-lg shadow-purple-400/50' :
                                task.status === 'in-progress' ? 'bg-blue-400 animate-pulse shadow-lg shadow-blue-400/50' :
                                'bg-gray-400'
                              }`} />
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3 mb-1">
                                  <h3 className="font-medium text-clawd-text group-hover:text-clawd-accent transition-colors">
                                    {task.title}
                                  </h3>
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize flex-shrink-0 ${
                                    task.status === 'review' 
                                      ? 'bg-review-subtle text-review border border-purple-500/30' 
                                      : 'bg-info-subtle text-info border border-info-border'
                                  }`}>
                                    {task.status === 'in-progress' ? 'working' : task.status}
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-3 text-sm text-clawd-text-dim">
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
              </DashboardWidget>
            </div>
          )}

          {/* CALENDAR WIDGET */}
          {!hiddenWidgets.has('calendar') && (
            <div key="calendar">
              <DashboardWidget
                id="calendar"
                title="Calendar"
                icon={Calendar}
                editMode={editMode}
                minimized={minimizedWidgets.has('calendar')}
                onToggleMinimize={() => handleToggleMinimize('calendar')}
                onRemove={() => handleRemoveWidget('calendar')}
              >
                <TodayCalendarWidget onNavigate={onNavigate} />
              </DashboardWidget>
            </div>
          )}

          {/* WEATHER WIDGET */}
          {!hiddenWidgets.has('weather') && (
            <div key="weather">
              <DashboardWidget
                id="weather"
                title="Weather"
                icon={TrendingUp}
                editMode={editMode}
                minimized={minimizedWidgets.has('weather')}
                onToggleMinimize={() => handleToggleMinimize('weather')}
                onRemove={() => handleRemoveWidget('weather')}
              >
                <WeatherWidget />
              </DashboardWidget>
            </div>
          )}

          {/* QUICK STATS WIDGET */}
          {!hiddenWidgets.has('quick-stats') && (
            <div key="quick-stats">
              <DashboardWidget
                id="quick-stats"
                title="Quick Stats"
                icon={TrendingUp}
                editMode={editMode}
                minimized={minimizedWidgets.has('quick-stats')}
                onToggleMinimize={() => handleToggleMinimize('quick-stats')}
                onRemove={() => handleRemoveWidget('quick-stats')}
              >
                <QuickStatsWidget />
              </DashboardWidget>
            </div>
          )}

          {/* TOKEN USAGE WIDGET */}
          {!hiddenWidgets.has('token-usage') && (
            <div key="token-usage">
              <DashboardWidget
                id="token-usage"
                title="Token Usage"
                icon={Zap}
                editMode={editMode}
                minimized={minimizedWidgets.has('token-usage')}
                onToggleMinimize={() => handleToggleMinimize('token-usage')}
                onRemove={() => handleRemoveWidget('token-usage')}
              >
                <TokenSummaryWidget />
              </DashboardWidget>
            </div>
          )}

          {/* HEALTH STATUS WIDGET */}
          {!hiddenWidgets.has('health-status') && (
            <div key="health-status">
              <DashboardWidget
                id="health-status"
                title="System Health"
                icon={Shield}
                editMode={editMode}
                minimized={minimizedWidgets.has('health-status')}
                onToggleMinimize={() => handleToggleMinimize('health-status')}
                onRemove={() => handleRemoveWidget('health-status')}
              >
                <HealthStatusWidget />
              </DashboardWidget>
            </div>
          )}

          {/* ACTIVITY STREAM WIDGET */}
          {!hiddenWidgets.has('activity') && (
            <div key="activity">
              <DashboardWidget
                id="activity"
                title="Activity Stream"
                icon={Users}
                editMode={editMode}
                minimized={minimizedWidgets.has('activity')}
                onToggleMinimize={() => handleToggleMinimize('activity')}
                onRemove={() => handleRemoveWidget('activity')}
              >
                <div>
                  <div 
                    onClick={() => setShowActivityStream(!showActivityStream)}
                    className="w-full p-4 flex items-center justify-between hover:bg-clawd-bg/20 transition-all group cursor-pointer border-b border-clawd-border/30"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowActivityStream(!showActivityStream); } }}
                  >
                    <div className="text-sm text-clawd-text-dim">
                      {sessions.length} sessions • {totalAgentCount} agents • {activities.length} notifications
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={(e) => { e.stopPropagation(); fetchSessions(); }}
                        className="p-2 hover:bg-clawd-border/50 rounded-lg transition-colors"
                        title="Refresh"
                      >
                        <RefreshCw size={18} className="text-clawd-text-dim hover:text-clawd-accent transition-colors" />
                      </button>
                      <div className={`transform transition-transform duration-200 ${showActivityStream ? 'rotate-180' : ''}`}>
                        <ChevronDown size={24} className="text-clawd-text-dim group-hover:text-clawd-accent transition-colors" />
                      </div>
                    </div>
                  </div>
                  
                  {showActivityStream && (
                    <div className="bg-clawd-bg/20">
                      <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-clawd-border/30">
                        {/* Sessions */}
                        <div className="p-6">
                          <h4 className="text-sm font-semibold text-clawd-text-dim uppercase tracking-wider mb-4 flex items-center gap-2">
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
                              <p className="text-sm text-clawd-text-dim text-center py-8">No active sessions</p>
                            ) : (
                              sessions.slice(0, 6).map((s: SessionInfo & { updatedAt?: number }) => {
                                const isActive = Date.now() - (s.updatedAt || 0) < 300000;
                                return (
                                  <div 
                                    key={s.key} 
                                    className="flex items-center gap-3 p-3 rounded-lg bg-clawd-surface/50 hover:bg-clawd-surface transition-colors"
                                  >
                                    <span className="text-xl">{getSessionIcon(s)}</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium truncate">{getSessionName(s)}</div>
                                      <div className="text-xs text-clawd-text-dim">{formatTimeAgo(s.updatedAt)}</div>
                                    </div>
                                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400' : 'bg-clawd-bg0'}`} />
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Agents */}
                        <div className="p-6">
                          <h4 className="text-sm font-semibold text-clawd-text-dim uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Bot size={14} />
                            Agents ({totalAgentCount})
                          </h4>
                          <div className="space-y-2">
                            {agents.slice(0, 4).map((agent) => (
                              <div 
                                key={agent.id} 
                                className="flex items-center gap-3 p-3 rounded-lg bg-clawd-surface/50 hover:bg-clawd-surface transition-colors"
                              >
                                <AgentAvatar agentId={agent.id} fallbackEmoji={agent.avatar} size="lg" />
                                <div className="flex-1">
                                  <div className="text-sm font-medium">{agent.name}</div>
                                  <div className={`text-xs ${
                                    agent.status === 'busy' ? 'text-warning' :
                                    agent.status === 'active' ? 'text-success' : 'text-clawd-text-dim'
                                  }`}>
                                    {agent.status}
                                  </div>
                                </div>
                              </div>
                            ))}
                            
                            {activeSubagents.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-clawd-border/30 space-y-2">
                                {activeSubagents.slice(0, 3).map((session) => (
                                  <div 
                                    key={session.key}
                                    className="flex items-center gap-3 p-2 rounded-lg bg-success-subtle border border-green-500/20"
                                  >
                                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs font-medium truncate">{session.displayName}</div>
                                      <div className="text-xs text-clawd-text-dim">{((session.totalTokens || 0) / 1000).toFixed(1)}k tokens</div>
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
                            <h4 className="text-sm font-semibold text-clawd-text-dim uppercase tracking-wider flex items-center gap-2">
                              <Bell size={14} />
                              Notifications ({activities.length})
                            </h4>
                            {activities.length > 0 && (
                              <button 
                                onClick={clearActivities}
                                className="text-xs text-clawd-text-dim hover:text-clawd-accent transition-colors"
                              >
                                Clear all
                              </button>
                            )}
                          </div>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {activities.length === 0 ? (
                              <div className="text-center py-8">
                                <Bell size={32} className="mx-auto mb-2 text-clawd-text-dim/30" />
                                <p className="text-sm text-clawd-text-dim">All caught up</p>
                              </div>
                            ) : (
                              activities.slice(0, 8).map((a) => (
                                <div 
                                  key={a.id} 
                                  className="flex items-start gap-3 p-3 rounded-lg bg-clawd-surface/50 hover:bg-clawd-surface transition-colors"
                                >
                                  <span className="text-lg flex-shrink-0">
                                    {a.type === 'chat' ? '💬' : 
                                     a.type === 'task' ? '✅' : 
                                     a.type === 'agent' ? '🤖' : '⚙️'}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-clawd-text line-clamp-2">{a.message}</p>
                                    <p className="text-xs text-clawd-text-dim mt-1">{formatTimeAgo(a.timestamp)}</p>
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
              </DashboardWidget>
            </div>
          )}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}

function formatTimeAgo(ts: number): string {
  if (!ts) return 'unknown';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(ts).toLocaleDateString();
}
