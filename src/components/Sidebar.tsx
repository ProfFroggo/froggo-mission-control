import { useState, useEffect, useCallback, type ComponentType } from 'react';
import {
  Settings, ChevronLeft, ChevronRight, HelpCircle, SlidersHorizontal,
  LayoutDashboard, Mail, Kanban, MessageSquare, ShieldAlert, Bot, Bell, Puzzle,
  FolderOpen, FolderKanban, CalendarClock,
} from 'lucide-react';
import { useStore } from '../store/store';
import { NumberBadge } from './BadgeWrapper';
import { usePanelConfigStore } from '../store/panelConfig';
import { FocusModeSelector, useFocusMode } from './FocusMode';
import { ViewRegistry } from '../core/ViewRegistry';

// Static icon map for built-in panels — renders nav instantly before ViewRegistry populates.
// Must include ALL DEFAULT_PANELS ids so panels appear immediately (before async initAll() runs).
const BUILTIN_PANEL_ICONS: Record<string, ComponentType<any>> = {
  dashboard:     LayoutDashboard,
  projects:      FolderKanban,
  inbox:         Mail,
  kanban:        Kanban,
  chat:          MessageSquare,
  approvals:     ShieldAlert,
  schedule:      CalendarClock,
  library:       FolderOpen,
  agents:        Bot,
  notifications: Bell,
  modules:       Puzzle,
};

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
  // Computed selectors — only re-render when the derived value changes
  const activeTasks = useStore(s =>
    s.tasks.filter(t => t.status === 'todo' || t.status === 'in-progress' || t.status === 'review').length
  );
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
  
  // Load pending inbox item count — used for both approvals and notifications badges
  const loadInboxCount = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox?status=pending');
      if (res.ok) {
        const data = await res.json();
        setInboxCount(Array.isArray(data) ? data.length : (data?.items?.length || 0));
      }
    } catch {
      // Failed to load inbox count
    }
  }, []);

  useEffect(() => {
    loadInboxCount();
    const interval = setInterval(loadInboxCount, 15000);
    return () => clearInterval(interval);
  }, [loadInboxCount]);

  return (
    <>
    <aside 
      className={`bg-mission-control-surface border-r border-mission-control-border flex flex-col transition-all duration-300 ease-in-out z-0 ${
        expanded ? 'w-52' : 'w-16'
      }`}
      aria-label="Main navigation"
    >
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto pt-[15px] pb-4 px-2" aria-label="Primary navigation">
        <div className="space-y-1">
          {/* Configurable panels - ordered and filtered by panel config */}
          {[...panelConfig]
            .sort((a, b) => a.order - b.order)
            .filter(p => p.visible)
            .map((p, idx) => {
              const Icon = ViewRegistry.getIcon(p.id) ?? BUILTIN_PANEL_ICONS[p.id];
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
            if (id === 'approvals') badge = inboxCount;
            if (id === 'notifications') badge = inboxCount;
            if (id === 'kanban') badge = activeTasks;
            
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`no-drag w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-mission-control-accent text-white shadow-lg shadow-mission-control-accent/20'
                    : 'text-mission-control-text-dim hover:bg-mission-control-border hover:text-mission-control-text'
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
                        className={isActive ? 'bg-mission-control-text/20 text-mission-control-text' : 'bg-mission-control-accent/20 text-mission-control-accent'}
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
      <div className="p-2 border-t border-mission-control-border space-y-1" role="group" aria-label="Settings">
        {/* Action icons in a compact horizontal row */}
        <div className={`flex items-center ${expanded ? 'justify-between' : 'justify-center'} gap-0.5 px-1`}>
          {/* Edit Panels - only visible when expanded */}
          {expanded && (
            <button
              onClick={openEditModal}
              className="no-drag p-1.5 rounded-lg transition-all duration-200 text-mission-control-text-dim hover:bg-mission-control-border hover:text-mission-control-text"
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
              className="no-drag p-1.5 rounded-lg transition-all duration-200 text-mission-control-text-dim hover:bg-mission-control-border hover:text-mission-control-text"
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
                ? 'bg-mission-control-accent text-white shadow-lg shadow-mission-control-accent/20'
                : 'text-mission-control-text-dim hover:bg-mission-control-border hover:text-mission-control-text'
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
            className="no-drag p-1.5 rounded-lg text-mission-control-text-dim hover:bg-mission-control-border hover:text-mission-control-text transition-all duration-200"
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
