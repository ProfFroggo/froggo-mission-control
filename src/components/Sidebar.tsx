import { useState, useEffect } from 'react';
import { Settings, ChevronLeft, ChevronRight, HelpCircle, SlidersHorizontal } from 'lucide-react';
import { useStore } from '../store/store';
import { NumberBadge } from './BadgeWrapper';
import { usePanelConfigStore } from '../store/panelConfig';
import { FocusModeSelector, useFocusMode } from './FocusMode';
import { ViewRegistry } from '../core/ViewRegistry';

// View IDs are dynamic — any registered view ID is valid
type View = string;

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  onOpenHelp?: () => void;
  onWidthChange?: (width: number) => void; // Callback for width changes
}

// Icons are now provided by ViewRegistry — no hardcoded icon map needed

export default function Sidebar({ currentView, onNavigate, onOpenHelp, onWidthChange }: SidebarProps) {
  // Load persisted sidebar state from localStorage
  const [expanded, setExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebarExpanded');
    return saved !== null ? saved === 'true' : true; // Default: open
  });
  
  // Listen for sidebar state changes from settings
  useEffect(() => {
    const handler = () => {
      const saved = localStorage.getItem('sidebarExpanded');
      setExpanded(saved !== null ? saved === 'true' : true);
    };
    window.addEventListener('sidebarStateChange', handler);
    return () => window.removeEventListener('sidebarStateChange', handler);
  }, []);
  const [inboxCount, setInboxCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  // Computed selectors — only re-render when the derived value changes
  const activeTasks = useStore(s =>
    s.tasks.filter(t => t.status === 'todo' || t.status === 'in-progress' || t.status === 'review').length
  );
  const activities = useStore(s => s.activities);
  const { panels: panelConfig, openEditModal } = usePanelConfigStore();
  const { focusMode, setFocusMode } = useFocusMode();
  const [focusSelectorOpen, setFocusSelectorOpen] = useState(false);

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
  
  // Persist sidebar expanded state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarExpanded', String(expanded));
  }, [expanded]);
  
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
      // 'Failed to load inbox count:', error;
    }
  };
  
  // Load unread message count for comms inbox badge
  const loadUnreadMsgCount = async () => {
    try {
      const result = await window.clawdbot?.messages?.recent(50);
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
  
  const unreadNotifications = activities.length;

  return (
    <>
    <aside 
      className={`bg-clawd-surface border-r border-clawd-border flex flex-col transition-all duration-300 ease-in-out z-0 ${
        expanded ? 'w-52' : 'w-16'
      }`}
      aria-label="Main navigation"
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
              const Icon = ViewRegistry.getIcon(p.id);
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
            if (id === 'notifications') badge = unreadNotifications;
            
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
                        className={isActive ? 'bg-clawd-text/20 text-clawd-text' : 'bg-clawd-accent/20 text-clawd-accent'}
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
        </div>
      </nav>

      {/* Bottom section */}
      <div className="p-2 border-t border-clawd-border space-y-1" role="group" aria-label="Settings">
        {/* Action icons in a compact horizontal row */}
        <div className={`flex items-center ${expanded ? 'justify-between' : 'justify-center'} gap-0.5 px-1`}>
          {/* Edit Panels - only visible when expanded */}
          {expanded && (
            <button
              onClick={openEditModal}
              className="no-drag p-1.5 rounded-lg transition-all duration-200 text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text"
              title="Edit Panels (⌘⇧E)"
              aria-label="Edit Panels"
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
            </button>
          )}
          {/* Help - only visible when expanded */}
          {expanded && onOpenHelp && (
            <button 
              onClick={onOpenHelp}
              className="no-drag p-1.5 rounded-lg transition-all duration-200 text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text"
              title="Help (⌘H)"
              aria-label="Help"
            >
              <HelpCircle size={16} aria-hidden="true" />
            </button>
          )}
          {/* Settings - always visible */}
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
          {/* Expand/Collapse - always visible */}
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
