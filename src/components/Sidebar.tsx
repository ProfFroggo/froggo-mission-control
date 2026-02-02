import { useState, useEffect } from 'react';
import { LayoutDashboard, Kanban, Bot, MessageSquare, Settings, ChevronLeft, ChevronRight, Bell, Command, Inbox, FolderOpen, Calendar, Code, Sparkles, BarChart2, Mail, Cloud, HelpCircle, SlidersHorizontal,  Users, Mic, Loader } from 'lucide-react';
import { useStore } from '../store/store';
import { NumberBadge } from './BadgeWrapper';
import { usePanelConfigStore } from '../store/panelConfig';
import { FocusModeIndicator, FocusModeSelector, useFocusMode } from './FocusMode';

// X logo as SVG component
const XIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

type View = 'dashboard' | 'kanban' | 'agents' | 'chat' | 'meetings' | 'voicechat' | 'settings' | 'notifications' | 'twitter' | 'inbox' | 'approvals' | 'library' | 'schedule' | 'codeagent' | 'context' | 'analytics' | 'comms' | 'accounts' | 'starred' | 'contacts' | 'sessions' | 'calendar' | 'templates' | 'error-test';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  onOpenHelp?: () => void;
  onWidthChange?: (width: number) => void; // Callback for width changes
}

// Icon map for panel config lookups
const panelIconMap: Record<string, any> = {
  inbox: Mail,
  dashboard: LayoutDashboard,
  analytics: BarChart2,
  kanban: Kanban,
  agents: Bot,
  twitter: XIcon,
  meetings: Users,
  voicechat: Mic,
  chat: MessageSquare,
  accounts: Cloud,
  approvals: Inbox,
  context: Sparkles,
  codeagent: Code,
  library: FolderOpen,
  schedule: Calendar,
};

// Static items not managed by panel config (always shown)
const staticNavItems = [
  { id: 'context' as View, icon: Sparkles, label: 'Context', shortcut: '⌘⇧C' },
  { id: 'codeagent' as View, icon: Code, label: 'Dev', shortcut: '⌘⇧D' },
  { id: 'library' as View, icon: FolderOpen, label: 'Library', shortcut: '⌘⇧L' },
  { id: 'schedule' as View, icon: Calendar, label: 'Schedule', shortcut: '' },
];

interface SystemStatus {
  watcherRunning: boolean;
  killSwitchOn: boolean;
}

export default function Sidebar({ currentView, onNavigate, onOpenHelp, onWidthChange }: SidebarProps) {
  const [expanded, setExpanded] = useState(true); // Open by default
  const [inboxCount, setInboxCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [sysStatus, setSysStatus] = useState<SystemStatus>({ watcherRunning: false, killSwitchOn: true });
  const { connected, tasks } = useStore();
  const { panels: panelConfig, openEditModal } = usePanelConfigStore();
  const { focusMode, setFocusMode } = useFocusMode();
  const [focusSelectorOpen, setFocusSelectorOpen] = useState(false);
  const [inProgressTasks, setInProgressTasks] = useState(0);
  
  const activeTasks = tasks.filter(t => t.status === 'todo' || t.status === 'in-progress' || t.status === 'review').length;

  // Keyboard shortcut: Cmd+Shift+E to open Edit Panels
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        openEditModal();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openEditModal]);

  // Report width changes to parent
  useEffect(() => {
    const width = expanded ? 208 : 64; // w-52 = 208px, w-16 = 64px
    onWidthChange?.(width);
  }, [expanded, onWidthChange]);
  
  // Load inbox count from froggo-db
  const loadInboxCount = async () => {
    try {
      // Check if running in Electron with clawdbot API
      if (!window.clawdbot?.inbox?.list) {
        // Web mode - skip inbox loading
        return;
      }
      const result = await window.clawdbot.inbox.list('pending');
      if (result.success) {
        setInboxCount(result.items?.length || 0);
      }
    } catch (error) {
      console.error('Failed to load inbox count:', error);
    }
  };
  
  // Load unread message count for comms inbox badge
  const loadUnreadMsgCount = async () => {
    try {
      const result = await (window as any).clawdbot?.messages?.recent(50);
      if (result?.success && result.chats) {
        const unread = result.chats.filter((c: any) => !c.is_read).length;
        setUnreadMsgCount(unread);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadInboxCount();
    loadUnreadMsgCount();
    const interval = setInterval(() => { loadInboxCount(); loadUnreadMsgCount(); }, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

  // System status polling
  useEffect(() => {
    const check = async () => {
      try {
        const result = await (window as any).clawdbot?.system?.status();
        if (result?.success) {
          setSysStatus(result.status);
          setInProgressTasks(result.status.inProgressTasks || 0);
        }
      } catch {}
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);
  
  const unreadNotifications = inboxCount;

  return (
    <>
    <aside 
      className={`bg-clawd-surface border-r border-clawd-border flex flex-col transition-all duration-300 ease-in-out ${
        expanded ? 'w-52' : 'w-16'
      }`}
      role="navigation"
      aria-label="Main navigation"
      aria-expanded={expanded}
    >
      {/* Drag region — traffic light safe zone */}
      <div className="drag-region h-12 border-b border-clawd-border">
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto pt-1 pb-4 px-2" aria-label="Primary navigation">
        <div className="space-y-1">
          {/* Configurable panels - ordered and filtered by panel config */}
          {[...panelConfig]
            .sort((a, b) => a.order - b.order)
            .filter(p => p.visible)
            .map((p, idx) => {
              const Icon = panelIconMap[p.id];
              if (!Icon) return null;
              const id = p.id as View;
              const label = p.label;
              const shortcutNum = idx < 10 ? `⌘${idx + 1 > 9 ? 0 : idx + 1}` : undefined;
              const shortcut = shortcutNum || '';
              return { id, icon: Icon, label, shortcut };
            })
            .filter(Boolean)
            .map(({ id, icon: Icon, label, shortcut }: any) => {
            const isActive = currentView === id;
            let badge = 0;
            if (id === 'inbox') badge = unreadMsgCount;
            if (id === 'approvals') badge = inboxCount;
            if (id === 'kanban') badge = activeTasks;
            
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`no-drag w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-clawd-accent text-white shadow-lg shadow-clawd-accent/20'
                    : 'text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text'
                } ${expanded ? '' : 'justify-center'}`}
                title={expanded ? undefined : `${label} (${shortcut})`}
                aria-label={`${label}${badge > 0 ? ` (${badge} items)` : ''}`}
                aria-current={isActive ? 'page' : undefined}
                data-view={id}
              >
                <Icon size={20} className="flex-shrink-0" aria-hidden="true" />
                
                {expanded && (
                  <>
                    <span className="text-sm font-medium flex-1 text-left truncate">{label}</span>
                    {badge > 0 && (
                      <NumberBadge
                        count={badge}
                        maxCount={99}
                        position="inline"
                        variant={isActive ? 'secondary' : 'primary'}
                        size="sm"
                        className={isActive ? 'bg-white/20 text-white' : 'bg-clawd-accent/20 text-clawd-accent'}
                      />
                    )}
                  </>
                )}
                
                {!expanded && badge > 0 && (
                  <NumberBadge
                    count={badge}
                    maxCount={99}
                    position="absolute-top-right"
                    variant="primary"
                    size="sm"
                  />
                )}
              </button>
            );
          })}

          {/* Static nav items (not configurable) */}
          {staticNavItems.map(({ id, icon: Icon, label, shortcut }) => {
            const isActive = currentView === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`no-drag w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-clawd-accent text-white shadow-lg shadow-clawd-accent/20'
                    : 'text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text'
                } ${expanded ? '' : 'justify-center'}`}
                title={expanded ? undefined : `${label} (${shortcut})`}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                data-view={id}
              >
                <Icon size={20} className="flex-shrink-0" aria-hidden="true" />
                {expanded && <span className="text-sm font-medium flex-1 text-left truncate">{label}</span>}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-clawd-border" role="separator" aria-hidden="true" />

        {/* Secondary Nav */}
        <div className="space-y-1" role="group" aria-label="Secondary navigation">
          <button
            onClick={() => onNavigate('notifications')}
            className={`no-drag w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative ${
              currentView === 'notifications'
                ? 'bg-clawd-accent text-white shadow-lg shadow-clawd-accent/20'
                : 'text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text'
            } ${expanded ? '' : 'justify-center'}`}
            title={expanded ? undefined : 'Notifications'}
            aria-label={`Notifications${unreadNotifications > 0 ? ` (${unreadNotifications} unread)` : ''}`}
            aria-current={currentView === 'notifications' ? 'page' : undefined}
          >
            <Bell size={20} className="flex-shrink-0" aria-hidden="true" />
            {expanded && <span className="text-sm font-medium flex-1 text-left">Notifications</span>}
            {unreadNotifications > 0 && (
              <NumberBadge
                count={unreadNotifications}
                maxCount={99}
                position={expanded ? 'inline' : 'absolute-top-right'}
                variant="danger"
                size="sm"
              />
            )}
          </button>
        </div>
      </nav>

      {/* Bottom section - condensed 2-line layout */}
      <div className="p-2 border-t border-clawd-border space-y-1" role="group" aria-label="Settings and status">
        {/* Line 1: Status indicators */}
        <div className={`flex items-center gap-2 px-2 py-1 ${expanded ? '' : 'justify-center'}`} role="status" aria-live="polite">
          <span 
            className={`w-2 h-2 rounded-full transition-colors flex-shrink-0 ${connected ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`}
            aria-hidden="true"
            title={connected ? 'Connected' : 'Connecting...'}
          />
          {expanded && (
            <div className="flex items-center gap-2 text-[10px] font-medium">
              <span className={`${connected ? 'text-green-400' : 'text-clawd-text-dim'}`}>Online</span>
              <span className={`${sysStatus.watcherRunning ? 'text-green-400' : 'text-red-400'}`}>
                {sysStatus.watcherRunning ? 'Watcher' : 'Watcher ✗'}
              </span>
              {sysStatus.killSwitchOn && (
                <span className="text-red-400">Blocked</span>
              )}
            </div>
          )}
        </div>

        {/* Focus mode + counters */}
        {expanded && (
          <div className="flex items-center gap-2 px-2 py-1">
            {focusMode && (
              <FocusModeIndicator mode={focusMode} onClick={() => setFocusSelectorOpen(true)} />
            )}
            <div className="flex items-center gap-2 ml-auto">
              {inboxCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-yellow-400" title={`${inboxCount} pending inbox items`}>
                  <Inbox size={12} />
                  <span className="tabular-nums">{inboxCount}</span>
                </span>
              )}
              {inProgressTasks > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-400" title={`${inProgressTasks} tasks in progress`}>
                  <Loader size={12} className="animate-spin" />
                  <span className="tabular-nums">{inProgressTasks}</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Line 2: Action icons in a compact horizontal row */}
        <div className={`flex items-center ${expanded ? 'justify-between' : 'justify-center'} gap-0.5 px-1`}>
          <button
            onClick={openEditModal}
            className="no-drag p-1.5 rounded-lg transition-all duration-200 text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text"
            title="Edit Panels (⌘⇧E)"
            aria-label="Edit Panels"
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
          </button>
          <button
            className="no-drag p-1.5 rounded-lg transition-all duration-200 text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text"
            title="⌘K for commands"
            aria-label="Command palette"
          >
            <Command size={16} aria-hidden="true" />
          </button>
          {onOpenHelp && (
            <button 
              onClick={onOpenHelp}
              className="no-drag p-1.5 rounded-lg transition-all duration-200 text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text"
              title="Help (⌘H)"
              aria-label="Help"
            >
              <HelpCircle size={16} aria-hidden="true" />
            </button>
          )}
          <button 
            onClick={() => onNavigate('settings')}
            className={`no-drag p-1.5 rounded-lg transition-all duration-200 ${
              currentView === 'settings'
                ? 'bg-clawd-accent text-white shadow-lg shadow-clawd-accent/20'
                : 'text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text'
            }`}
            title="Settings (⌘,)"
            aria-label="Settings"
            aria-current={currentView === 'settings' ? 'page' : undefined}
          >
            <Settings size={16} aria-hidden="true" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="no-drag p-1.5 rounded-lg text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text transition-all duration-200"
            title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronLeft size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </aside>

    {/* Focus Mode Selector */}
    <FocusModeSelector
      isOpen={focusSelectorOpen}
      onClose={() => setFocusSelectorOpen(false)}
      currentMode={focusMode}
      onSelectMode={setFocusMode}
    />
    </>
  );
}
