import { useState, useEffect } from 'react';
import { LayoutDashboard, Kanban, Bot, MessageSquare, Mic, Settings, ChevronLeft, ChevronRight, Bell, Command, Inbox, Radio, FolderOpen, Calendar, Code, Sparkles, BarChart2, Mail } from 'lucide-react';
import { useStore } from '../store/store';

// X logo as SVG component
const XIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

type View = 'dashboard' | 'kanban' | 'agents' | 'chat' | 'voice' | 'settings' | 'notifications' | 'twitter' | 'inbox' | 'sessions' | 'library' | 'schedule' | 'codeagent' | 'context' | 'templates' | 'analytics' | 'comms';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

const navItems = [
  { id: 'dashboard' as View, icon: LayoutDashboard, label: 'Dashboard', shortcut: '⌘1' },
  { id: 'inbox' as View, icon: Inbox, label: 'Approvals', shortcut: '⌘2', badge: 'inbox' },
  { id: 'comms' as View, icon: Mail, label: 'Inbox', shortcut: '⌘3' },
  { id: 'chat' as View, icon: MessageSquare, label: 'Chat', shortcut: '⌘4' },
  { id: 'kanban' as View, icon: Kanban, label: 'Tasks', shortcut: '⌘5' },
  { id: 'agents' as View, icon: Bot, label: 'Agents', shortcut: '⌘6' },
  { id: 'twitter' as View, icon: XIcon, label: 'X', shortcut: '⌘7' },
  { id: 'voice' as View, icon: Mic, label: 'Voice', shortcut: '⌘8' },
  { id: 'context' as View, icon: Sparkles, label: 'Context', shortcut: '⌘⇧C' },
  { id: 'codeagent' as View, icon: Code, label: 'Dev', shortcut: '⌘⇧D' },
  { id: 'library' as View, icon: FolderOpen, label: 'Library', shortcut: '⌘⇧L' },
  { id: 'schedule' as View, icon: Calendar, label: 'Schedule', shortcut: '⌘⇧S' },
  { id: 'templates' as View, icon: FolderOpen, label: 'Templates', shortcut: '' },
  { id: 'sessions' as View, icon: Radio, label: 'Sessions', shortcut: '⌘9' },
  { id: 'analytics' as View, icon: BarChart2, label: 'Analytics', shortcut: '⌘0' },
];

export default function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const [expanded, setExpanded] = useState(true); // Open by default
  const [inboxCount, setInboxCount] = useState(0);
  const { connected, tasks, sessions, activities } = useStore();
  
  const activeTasks = tasks.filter(t => t.status === 'todo' || t.status === 'in-progress' || t.status === 'review').length;
  
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
  
  const unreadNotifications = inboxCount;

  return (
    <aside 
      className={`bg-clawd-surface border-r border-clawd-border flex flex-col transition-all duration-200 ${
        expanded ? 'w-52' : 'w-16'
      }`}
    >
      {/* Drag region */}
      <div className="drag-region h-12 flex items-center justify-center border-b border-clawd-border">
        <div className="no-drag text-2xl cursor-pointer hover:scale-110 transition-transform" onClick={() => onNavigate('dashboard')}>
          🐸
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 py-4 px-2">
        <div className="space-y-1">
          {navItems.map(({ id, icon: Icon, label, shortcut }) => {
            const isActive = currentView === id;
            let badge = 0;
            if (id === 'inbox') badge = inboxCount;
            if (id === 'kanban') badge = activeTasks;
            if (id === 'sessions') badge = sessions.length;
            
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`no-drag w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative ${
                  isActive
                    ? 'bg-clawd-accent text-white shadow-lg shadow-clawd-accent/20'
                    : 'text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text'
                }`}
                title={expanded ? undefined : `${label} (${shortcut})`}
              >
                <Icon size={20} className="flex-shrink-0" />
                
                {expanded && (
                  <>
                    <span className="text-sm font-medium flex-1 text-left">{label}</span>
                    {badge > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-white/20' : 'bg-clawd-accent/20 text-clawd-accent'
                      }`}>
                        {badge}
                      </span>
                    )}
                  </>
                )}
                
                {!expanded && badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] bg-clawd-accent text-white rounded-full flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-clawd-border" />

        {/* Secondary Nav */}
        <div className="space-y-1">
          <button
            onClick={() => onNavigate('notifications')}
            className={`no-drag w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative ${
              currentView === 'notifications'
                ? 'bg-clawd-accent text-white'
                : 'text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text'
            }`}
            title={expanded ? undefined : 'Notifications'}
          >
            <Bell size={20} />
            {expanded && <span className="text-sm font-medium flex-1 text-left">Notifications</span>}
            {unreadNotifications > 0 && (
              <span className={`${expanded ? '' : 'absolute -top-1 -right-1'} w-4 h-4 text-[10px] bg-red-500 text-white rounded-full flex items-center justify-center`}>
                {unreadNotifications}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Bottom section */}
      <div className="p-2 border-t border-clawd-border space-y-1">
        {/* Command Palette hint */}
        <div className={`flex items-center gap-2 px-3 py-2 text-clawd-text-dim ${expanded ? '' : 'justify-center'}`}>
          <Command size={14} />
          {expanded && <span className="text-xs">⌘K for commands</span>}
        </div>

        {/* Connection status */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${expanded ? '' : 'justify-center'}`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`} />
          {expanded && (
            <span className="text-xs text-clawd-text-dim">
              {connected ? 'Connected' : 'Connecting...'}
            </span>
          )}
        </div>
        
        {/* Settings */}
        <button 
          onClick={() => onNavigate('settings')}
          className={`no-drag w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
            currentView === 'settings'
              ? 'bg-clawd-accent text-white'
              : 'text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text'
          } ${expanded ? '' : 'justify-center'}`}
          title="Settings (⌘,)"
        >
          <Settings size={20} />
          {expanded && <span className="text-sm">Settings</span>}
        </button>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`no-drag w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text transition-colors ${
            expanded ? '' : 'justify-center'
          }`}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          {expanded && <span className="text-sm">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
