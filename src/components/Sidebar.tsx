import { useState, useEffect } from 'react';
import { LayoutDashboard, Kanban, Bot, MessageSquare, Phone, Settings, ChevronLeft, ChevronRight, Bell, Command, Inbox, FolderOpen, Calendar, Code, Sparkles, BarChart2, Mail, Cloud, HelpCircle, SlidersHorizontal, Star, Users, Zap } from 'lucide-react';
import { useStore } from '../store/store';
import { NumberBadge } from './BadgeWrapper';
import { usePanelConfigStore } from '../store/panelConfig';

// X logo as SVG component
const XIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

type View = 'dashboard' | 'kanban' | 'agents' | 'chat' | 'meetings' | 'voice-chat' | 'voice-live' | 'gemini-voice' | 'multi-agent-voice' | 'settings' | 'notifications' | 'twitter' | 'inbox' | 'approvals' | 'library' | 'schedule' | 'codeagent' | 'context' | 'analytics' | 'comms' | 'accounts' | 'starred' | 'contacts' | 'sessions' | 'calendar' | 'templates' | 'error-test';

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
  { id: 'voice-chat' as View, icon: Phone, label: 'Voice Chat', shortcut: '⌘⇧V' },
  { id: 'gemini-voice' as View, icon: Zap, label: 'Gemini Live', shortcut: '⌘⇧G' },
  { id: 'multi-agent-voice' as View, icon: Users, label: 'Multi-Agent Voice', shortcut: '⌘⇧M' },
  { id: 'context' as View, icon: Sparkles, label: 'Context', shortcut: '⌘⇧C' },
  { id: 'codeagent' as View, icon: Code, label: 'Dev', shortcut: '⌘⇧D' },
  { id: 'library' as View, icon: FolderOpen, label: 'Library', shortcut: '⌘⇧L' },
  { id: 'schedule' as View, icon: Calendar, label: 'Schedule', shortcut: '' },
  { id: 'starred' as View, icon: Star, label: 'Starred', shortcut: '⌘⇧S' },
];

interface SystemStatus {
  watcherRunning: boolean;
  killSwitchOn: boolean;
}

export default function Sidebar({ currentView, onNavigate, onOpenHelp, onWidthChange }: SidebarProps) {
  const [expanded, setExpanded] = useState(true); // Open by default
  const [inboxCount, setInboxCount] = useState(0);
  const [sysStatus, setSysStatus] = useState<SystemStatus>({ watcherRunning: false, killSwitchOn: true });
  const { connected, tasks } = useStore();
  const { panels: panelConfig, openEditModal } = usePanelConfigStore();
  
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
  
  useEffect(() => {
    loadInboxCount();
    const interval = setInterval(loadInboxCount, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  // System status polling
  useEffect(() => {
    const check = async () => {
      try {
        const result = await (window as any).clawdbot?.system?.status();
        if (result?.success) setSysStatus(result.status);
      } catch {}
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);
  
  const unreadNotifications = inboxCount;

  return (
    <aside 
      className={`bg-clawd-surface border-r border-clawd-border flex flex-col transition-all duration-300 ease-in-out ${
        expanded ? 'w-52' : 'w-16'
      }`}
      role="navigation"
      aria-label="Main navigation"
      aria-expanded={expanded}
    >
      {/* Drag region — traffic light safe zone */}
      <div className="drag-region h-12 pl-[76px] border-b border-clawd-border">
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 py-4 px-2" aria-label="Primary navigation">
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
            if (id === 'inbox') badge = inboxCount;
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

      {/* Bottom section */}
      <div className="p-2 border-t border-clawd-border space-y-1" role="group" aria-label="Settings and status">
        {/* Command Palette hint */}
        <div 
          className={`flex items-center gap-3 px-3 py-2.5 text-clawd-text-dim ${expanded ? '' : 'justify-center'}`}
          role="status"
          aria-label="Keyboard shortcut hint"
        >
          <Command size={20} className="flex-shrink-0" aria-hidden="true" />
          {expanded && <span className="text-xs">⌘K for commands</span>}
        </div>

        {/* Connection + System status */}
        <div 
          className={`flex flex-col gap-1 px-3 py-2 rounded-lg`}
          role="status"
          aria-live="polite"
        >
          <div className={`flex items-center gap-2 ${expanded ? '' : 'justify-center'}`}>
            <span 
              className={`w-2 h-2 rounded-full transition-colors flex-shrink-0 ${connected ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`}
              aria-hidden="true"
            />
            {expanded && (
              <span className="text-xs text-clawd-text-dim">
                {connected ? 'Connected' : 'Connecting...'}
              </span>
            )}
          </div>
          {expanded && (
            <div className="flex items-center gap-2 pl-4 text-[10px] font-medium">
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
        
        {/* Edit Panels */}
        <button
          onClick={openEditModal}
          className={`no-drag w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text ${
            expanded ? '' : 'justify-center'
          }`}
          title="Edit Panels (⌘⇧E)"
          aria-label="Edit Panels (Command Shift E)"
        >
          <SlidersHorizontal size={20} className="flex-shrink-0" aria-hidden="true" />
          {expanded && <span className="text-sm font-medium">Edit Panels</span>}
        </button>

        {/* Help */}
        {onOpenHelp && (
          <button 
            onClick={onOpenHelp}
            className={`no-drag w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text ${
              expanded ? '' : 'justify-center'
            }`}
            title="Help & Documentation (⌘H)"
            aria-label="Help & Documentation (Command H)"
          >
            <HelpCircle size={20} className="flex-shrink-0" aria-hidden="true" />
            {expanded && <span className="text-sm font-medium">Help</span>}
          </button>
        )}

        {/* Settings */}
        <button 
          onClick={() => onNavigate('settings')}
          className={`no-drag w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
            currentView === 'settings'
              ? 'bg-clawd-accent text-white shadow-lg shadow-clawd-accent/20'
              : 'text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text'
          } ${expanded ? '' : 'justify-center'}`}
          title="Settings (⌘,)"
          aria-label="Settings (Command comma)"
          aria-current={currentView === 'settings' ? 'page' : undefined}
        >
          <Settings size={20} className="flex-shrink-0" aria-hidden="true" />
          {expanded && <span className="text-sm font-medium">Settings</span>}
        </button>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`no-drag w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text transition-all duration-200 ${
            expanded ? '' : 'justify-center'
          }`}
          title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronLeft size={20} className="flex-shrink-0" aria-hidden="true" /> : <ChevronRight size={20} className="flex-shrink-0" aria-hidden="true" />}
          {expanded && <span className="text-sm font-medium">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
