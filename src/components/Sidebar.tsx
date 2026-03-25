import { useState, useEffect, useCallback, type ComponentType } from 'react';
import { IconButton, Button, Box, Flex } from '@radix-ui/themes';
import {
  Settings, ChevronLeft, ChevronRight, HelpCircle, SlidersHorizontal,
  LayoutDashboard, Mail, Kanban, MessageSquare, ShieldAlert, Bot, Bell, Puzzle,
  FolderOpen, FolderKanban, CalendarClock, BookOpen, Search, Megaphone, Menu, X, Zap, Keyboard,
} from 'lucide-react';
import { useStore } from '../store/store';
import { NumberBadge } from './BadgeWrapper';
import { usePanelConfigStore } from '../store/panelConfig';
import { FocusModeSelector, useFocusMode } from './FocusMode';
import { ViewRegistry } from '../core/ViewRegistry';
import { useVisibilityPolling } from '../hooks/useVisibilityPolling';
import { useEventBus } from '../lib/useEventBus';
import AgentActivityBar from './AgentActivityBar';

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
  knowledge:     BookOpen,
  campaigns:     Megaphone,
  automations:   Zap,
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
  onOpenSearch?: () => void;
  onOpenShortcuts?: () => void;
}

// Icons are now provided by ViewRegistry — no hardcoded icon map needed

export default function Sidebar({ currentView, onNavigate, onOpenHelp, onWidthChange, onOpenSearch, onOpenShortcuts }: SidebarProps) {
  // Load persisted sidebar state from localStorage
  const [expanded, setExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebarExpanded');
    return saved !== null ? saved === 'true' : true; // Default: open
  });

  // Mobile: sidebar hidden by default; toggled via hamburger button
  const [mobileOpen, setMobileOpen] = useState(false);

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
  // Also counts human-review tasks so the approvals badge reflects "needs your attention" total
  const loadInboxCount = useCallback(async () => {
    try {
      const [inboxRes, humanReviewRes, approvalsRes] = await Promise.allSettled([
        fetch('/api/inbox?status=pending'),
        fetch('/api/tasks?status=human-review'),
        fetch('/api/approvals?status=pending'),
      ]);
      let count = 0;
      if (inboxRes.status === 'fulfilled' && inboxRes.value.ok) {
        const data = await inboxRes.value.json();
        count += Array.isArray(data) ? data.length : (data?.items?.length || 0);
      }
      if (humanReviewRes.status === 'fulfilled' && humanReviewRes.value.ok) {
        const data = await humanReviewRes.value.json();
        count += Array.isArray(data) ? data.length : 0;
      }
      if (approvalsRes.status === 'fulfilled' && approvalsRes.value.ok) {
        const data = await approvalsRes.value.json();
        count += Array.isArray(data) ? data.length : 0;
      }
      setInboxCount(count);
    } catch {
      // Failed to load inbox count
    }
  }, []);

  useVisibilityPolling(loadInboxCount, 60_000);

  // Subscribe to SSE inbox.count events — updates badge immediately when approvals are resolved
  useEventBus('inbox.count', (data) => {
    const d = data as { count: number };
    if (typeof d?.count === 'number') {
      setInboxCount(d.count);
    }
  });

  // Subscribe to module.installed events — refresh nav when a new module is installed
  useEventBus('module.installed', () => {
    usePanelConfigStore.getState().syncWithViewRegistry();
  });

  // Helper: navigate and close mobile sidebar
  const handleNavigate = (view: View) => {
    onNavigate(view);
    setMobileOpen(false);
  };

  return (
    <>
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:text-xs focus:bg-mission-control-accent focus:text-white focus:rounded-md"
    >
      Skip to content
    </a>

    {/* Mobile hamburger button — only visible on small screens when sidebar is closed */}
    <IconButton
      onClick={() => setMobileOpen(true)}
      size="3"
      variant="outline"
     
      className={`fixed top-3 left-3 z-40 md:hidden ${mobileOpen ? 'hidden' : 'flex'}`}
      aria-label="Open navigation"
    >
      <Menu size={20} aria-hidden="true" />
    </IconButton>

    {/* Mobile backdrop — closes sidebar when tapped outside */}
    {mobileOpen && (
      <div
        className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
    )}

    <aside
      className={`bg-mission-control-surface border-r border-mission-control-border flex flex-col transition-all duration-300 ease-in-out
        fixed inset-y-0 left-0 z-40
        md:relative md:translate-x-0 md:z-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${expanded ? 'w-52' : 'w-16'}
      `}
      aria-label="Main navigation"
    >
      {/* Mobile close button inside the sidebar */}
      <IconButton
        onClick={() => setMobileOpen(false)}
        size="2"
        variant="ghost"
       
        className="absolute top-3 right-3 md:hidden"
        aria-label="Close navigation"
      >
        <X size={16} aria-hidden="true" />
      </IconButton>

      {/* Search button */}
      <Box px="2" pt="3" pb="1">
        <Button
          onClick={onOpenSearch}
          variant="ghost"
          color="gray"
          size="2"
         
          className={`w-full ${expanded ? 'justify-start' : 'justify-center'}`}
          title={expanded ? undefined : 'Search (⌘K)'}
          aria-label="Search (⌘K)"
        >
          <Search size={16} className="flex-shrink-0" aria-hidden="true" />
          {expanded && (
            <span className="flex-1 text-sm text-left truncate">Search...</span>
          )}
          {expanded && (
            <kbd className="text-[10px] px-1.5 py-0.5 bg-mission-control-border/80 rounded font-mono flex-shrink-0">
              ⌘K
            </kbd>
          )}
        </Button>
      </Box>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto pt-2 pb-4 px-2" aria-label="Primary navigation">
        <div className="space-y-1">
          {/* Configurable panels - ordered and filtered by panel config */}
          {(() => {
            const navItems = [...panelConfig]
              .sort((a, b) => a.order - b.order)
              .filter(p => p.visible)
              .reduce<{ id: string; icon: any; label: string; shortcut: string }[]>((acc, p, idx) => {
                const Icon = ViewRegistry.getIcon(p.id) ?? BUILTIN_PANEL_ICONS[p.id];
                if (!Icon) return acc;
                const shortcutNum = acc.length < 10 ? `⌘${acc.length + 1 > 9 ? 0 : acc.length + 1}` : undefined;
                acc.push({ id: p.id as View, icon: Icon, label: p.label, shortcut: shortcutNum || '' });
                return acc;
              }, []);

            return navItems.map(({ id, icon: Icon, label, shortcut }) => {
              const isActive = currentView === id;
              let badge = 0;
              if (id === 'inbox') badge = inboxCount;
              if (id === 'approvals') badge = inboxCount;
              if (id === 'notifications') badge = inboxCount;
              if (id === 'kanban') badge = activeTasks;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleNavigate(id)}
                  className={`no-drag w-full flex items-center gap-3 px-3 py-2.5 rounded-lg relative group transition-colors text-sm font-medium ${expanded ? '' : 'justify-center'} ${
                    isActive
                      ? 'bg-mission-control-accent/10 text-mission-control-accent'
                      : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40'
                  }`}
                  title={expanded ? undefined : `${label} (${shortcut})`}
                  aria-label={`${label}${badge > 0 ? ` (${badge} items)` : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  data-view={id}
                >
                    <Icon size={20} className="flex-shrink-0" aria-hidden="true" />

                    {expanded && (
                      <>
                        <span className="flex-1 text-left truncate">{label}</span>
                        {badge > 0 && (
                          <NumberBadge
                            count={badge}
                            maxCount={999}
                            position="inline"
                            variant={isActive ? 'secondary' : 'primary'}
                            size="sm"
                            className={isActive ? 'bg-mission-control-accent/20 text-mission-control-accent' : 'bg-mission-control-accent/20 text-mission-control-accent'}
                          />
                        )}
                      </>
                    )}

                    {!expanded && badge > 0 && (
                      <NumberBadge
                        count={badge}
                        maxCount={999}
                        position="absolute-top-right"
                        variant="primary"
                        size="sm"
                      />
                    )}
                </button>
              );
            });
          })()}
        </div>
      </nav>

      {/* Live Agent Activity Bar */}
      <AgentActivityBar onNavigate={handleNavigate} expanded={expanded} />

      {/* Bottom section */}
      <Box p="2" className="border-t border-mission-control-border space-y-1" role="group" aria-label="Settings">
        {/* Action icons in a compact horizontal row */}
        <Flex align="center" justify={expanded ? 'between' : 'center'} gap="1" px="1">
          {/* Edit Panels - only visible when expanded */}
          {expanded && (
            <IconButton
              onClick={openEditModal}
              size="2"
              variant="ghost"
              color="gray"
             
              className="no-drag"
              title="Edit Panels (⌘⇧E)"
              aria-label="Edit Panels"
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
            </IconButton>
          )}
          {/* Help - only visible when expanded */}
          {expanded && onOpenHelp && (
            <IconButton
              onClick={onOpenHelp}
              size="2"
              variant="ghost"
              color="gray"
             
              className="no-drag"
              title="Help (⌘H)"
              aria-label="Help"
            >
              <HelpCircle size={16} aria-hidden="true" />
            </IconButton>
          )}
          {/* Keyboard shortcuts — always visible */}
          {onOpenShortcuts && (
            <IconButton
              onClick={onOpenShortcuts}
              size="2"
              variant="ghost"
              color="gray"
             
              className="no-drag"
              title="Keyboard shortcuts (?)"
              aria-label="Keyboard shortcuts"
            >
              <Keyboard size={16} aria-hidden="true" />
            </IconButton>
          )}
          {/* Settings - always visible */}
          <button
            type="button"
            onClick={() => handleNavigate('settings')}
            className={`no-drag p-1.5 rounded-lg transition-colors ${
              currentView === 'settings'
                ? 'bg-mission-control-accent/10 text-mission-control-accent'
                : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40'
            }`}
            title="Settings (⌘,)"
            aria-label="Settings"
            aria-current={currentView === 'settings' ? 'page' : undefined}
          >
            <Settings size={16} aria-hidden="true" />
          </button>
          {/* Expand/Collapse - always visible */}
          <IconButton
            onClick={() => setExpanded(!expanded)}
            size="2"
            variant="ghost"
            color="gray"
           
            className="no-drag"
            title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronLeft size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
          </IconButton>
        </Flex>
      </Box>
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
