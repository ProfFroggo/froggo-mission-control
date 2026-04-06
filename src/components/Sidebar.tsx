import { useState, useEffect, type ComponentType } from 'react';
import { IconButton, Box, Flex } from '@radix-ui/themes';
import {
  Settings, ChevronLeft, ChevronRight, HelpCircle, SlidersHorizontal,
  LayoutDashboard, Mail, Kanban, MessageSquare, ShieldAlert, Bot, Bell, Puzzle,
  FolderOpen, FolderKanban, CalendarClock, BookOpen, Search, Megaphone, Menu, X, Zap, Keyboard, Workflow,
} from 'lucide-react';
import { useStore } from '../store/store';
import { NumberBadge } from './BadgeWrapper';
import { usePanelConfigStore } from '../store/panelConfig';
import { FocusModeSelector, useFocusMode } from './FocusMode';
import { ViewRegistry } from '../core/ViewRegistry';
import { useVisibilityPolling } from '../hooks/useVisibilityPolling';
import { useEventBus } from '../lib/useEventBus';
import { useInboxCount, setInboxCountExternal } from '../hooks/useInboxCount';
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
  'workflow-studio': Workflow,
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
  // Always start expanded (SSR-safe); hydrate from localStorage after mount
  const [expanded, setExpanded] = useState(true);

  // Mobile: sidebar hidden by default; toggled via hamburger button
  const [mobileOpen, setMobileOpen] = useState(false);

  // Hydrate from localStorage after mount + listen for settings changes
  useEffect(() => {
    const saved = localStorage.getItem('sidebarExpanded');
    if (saved !== null) setExpanded(saved === 'true');
    const handler = () => {
      const s = localStorage.getItem('sidebarExpanded');
      setExpanded(s !== null ? s === 'true' : true);
    };
    window.addEventListener('sidebarStateChange', handler);
    return () => window.removeEventListener('sidebarStateChange', handler);
  }, []);
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

  // Shared inbox count hook — deduplicates with DashInboxCard and other consumers
  const { count: inboxCount, refresh: refreshInboxCount } = useInboxCount();

  // Periodic refresh of inbox count (visibility-aware)
  useVisibilityPolling(refreshInboxCount, 60_000);

  // Subscribe to SSE inbox.count events — updates badge immediately when approvals are resolved
  useEventBus('inbox.count', (data) => {
    const d = data as { count: number };
    if (typeof d?.count === 'number') {
      setInboxCountExternal(d.count);
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
      className={`bg-mission-control-surface border-r border-mission-control-border flex flex-col transition-colors duration-300 ease-in-out
        fixed inset-y-0 left-0 z-40
        md:relative md:translate-x-0 md:z-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${expanded ? 'w-52' : 'w-16'}
      `}
      aria-label="Main navigation"
    >
      {/* Mobile close button inside the sidebar */}
      <button
        type="button"
        onClick={() => setMobileOpen(false)}
        className="absolute top-3 right-3 md:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mission-control-accent)]/50"
        aria-label="Close navigation"
      >
        <X size={16} aria-hidden="true" />
      </button>

      {/* Search button */}
      <Box px="2" pt="3" pb="1">
        <button
          type="button"
          onClick={onOpenSearch}
          className={`no-drag w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mission-control-accent)]/50 ${expanded ? 'justify-start' : 'justify-center'}`}
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
        </button>
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
              if (id === 'kanban') badge = activeTasks;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleNavigate(id)}
                  className={`no-drag w-full flex items-center gap-3 px-3 py-2.5 relative group transition-colors text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mission-control-accent)]/50 ${expanded ? '' : 'justify-center'} ${
                    isActive
                      ? 'bg-mission-control-accent/12 text-mission-control-accent rounded-lg'
                      : 'rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30'
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
                            className="min-w-[18px] h-[18px] rounded-full text-[10px] font-bold tabular-nums flex items-center justify-center bg-mission-control-accent text-white px-1"
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
      <Box p="2" className="border-t border-mission-control-border mt-2 space-y-1" role="group" aria-label="Settings">
        {/* Action icons in a compact horizontal row */}
        <Flex align="center" justify={expanded ? 'between' : 'center'} gap="1" px="1">
          {/* Edit Panels - only visible when expanded */}
          {expanded && (
            <button
              type="button"
              onClick={openEditModal}
              className="no-drag p-1.5 rounded-lg transition-colors text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mission-control-accent)]/50"
              title="Edit Panels (⌘⇧E)"
              aria-label="Edit Panels"
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
            </button>
          )}
          {/* Help - only visible when expanded */}
          {expanded && onOpenHelp && (
            <button
              type="button"
              onClick={onOpenHelp}
              className="no-drag p-1.5 rounded-lg transition-colors text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mission-control-accent)]/50"
              title="Help (⌘H)"
              aria-label="Help"
            >
              <HelpCircle size={16} aria-hidden="true" />
            </button>
          )}
          {/* Keyboard shortcuts — always visible */}
          {onOpenShortcuts && (
            <button
              type="button"
              onClick={onOpenShortcuts}
              className="no-drag p-1.5 rounded-lg transition-colors text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mission-control-accent)]/50"
              title="Keyboard shortcuts (?)"
              aria-label="Keyboard shortcuts"
            >
              <Keyboard size={16} aria-hidden="true" />
            </button>
          )}
          {/* Settings - always visible */}
          <button
            type="button"
            onClick={() => handleNavigate('settings')}
            className={`no-drag p-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mission-control-accent)]/50 ${
              currentView === 'settings'
                ? 'bg-mission-control-accent/10 text-mission-control-accent'
                : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30'
            }`}
            title="Settings (⌘,)"
            aria-label="Settings"
            aria-current={currentView === 'settings' ? 'page' : undefined}
          >
            <Settings size={16} aria-hidden="true" />
          </button>
          {/* Expand/Collapse - always visible */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="no-drag w-6 h-6 rounded-md flex items-center justify-center transition-colors text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mission-control-accent)]/50"
            title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronLeft size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
          </button>
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
