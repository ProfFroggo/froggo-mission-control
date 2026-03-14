import { useEffect, type ComponentType } from 'react';
import {
  X, Settings, HelpCircle, SlidersHorizontal,
  LayoutDashboard, Mail, Kanban, MessageSquare, ShieldAlert, Bot, Bell, Puzzle,
  FolderOpen, FolderKanban, CalendarClock, BookOpen, Search, Megaphone, Zap,
} from 'lucide-react';
import { usePanelConfigStore } from '../store/panelConfig';
import { NumberBadge } from './BadgeWrapper';
import { ViewRegistry } from '../core/ViewRegistry';

// Mirror of BUILTIN_PANEL_ICONS from Sidebar — must stay in sync
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

type View = string;

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: View;
  onNavigate: (view: View) => void;
  inboxCount?: number;
  activeTasks?: number;
  onOpenSearch?: () => void;
  onOpenHelp?: () => void;
  onOpenEditPanels?: () => void;
}

export default function MobileNavDrawer({
  isOpen,
  onClose,
  currentView,
  onNavigate,
  inboxCount = 0,
  activeTasks = 0,
  onOpenSearch,
  onOpenHelp,
  onOpenEditPanels,
}: MobileNavDrawerProps) {
  const { panels: panelConfig } = usePanelConfigStore();

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleNavigate = (view: View) => {
    onNavigate(view);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-mission-control-surface border-r border-mission-control-border flex flex-col transition-transform duration-300 ease-in-out md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border">
          <span className="text-sm font-semibold text-mission-control-text">Navigation</span>
          <button
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-mission-control-text-dim hover:bg-mission-control-border hover:text-mission-control-text transition-all"
            aria-label="Close navigation"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Search button */}
        {onOpenSearch && (
          <div className="px-3 pt-3 pb-1">
            <button
              onClick={() => { onOpenSearch(); onClose(); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-mission-control-text-dim hover:bg-mission-control-border hover:text-mission-control-text transition-all border border-mission-control-border/50"
              aria-label="Search (Cmd+K)"
            >
              <Search size={16} className="flex-shrink-0" aria-hidden="true" />
              <span className="flex-1 text-sm text-left truncate">Search...</span>
              <kbd className="text-[10px] px-1.5 py-0.5 bg-mission-control-border/80 rounded font-mono flex-shrink-0">
                K
              </kbd>
            </button>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1" aria-label="Primary navigation">
          {[...panelConfig]
            .sort((a, b) => a.order - b.order)
            .filter(p => p.visible)
            .map((p, idx) => {
              const Icon = ViewRegistry.getIcon(p.id) ?? BUILTIN_PANEL_ICONS[p.id];
              if (!Icon) return null;
              const id = p.id as View;
              const label = p.label;
              const shortcutNum = idx < 10 ? `${idx + 1 > 9 ? 0 : idx + 1}` : undefined;
              return { id, icon: Icon, label, shortcutNum };
            })
            .filter(Boolean)
            .map(({ id, icon: Icon, label, shortcutNum }: any) => {
              const isActive = currentView === id;
              let badge = 0;
              if (id === 'inbox') badge = inboxCount;
              if (id === 'approvals') badge = inboxCount;
              if (id === 'notifications') badge = inboxCount;
              if (id === 'kanban') badge = activeTasks;

              return (
                <button
                  key={id}
                  onClick={() => handleNavigate(id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all relative focus-visible:ring-2 focus-visible:ring-mission-control-accent focus-visible:ring-offset-1 focus-visible:ring-offset-mission-control-bg ${
                    isActive
                      ? 'bg-mission-control-accent text-white shadow-lg shadow-mission-control-accent/20'
                      : 'text-mission-control-text-dim hover:bg-mission-control-border hover:text-mission-control-text'
                  }`}
                  aria-label={`${label}${badge > 0 ? ` (${badge} items)` : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={20} className="flex-shrink-0" aria-hidden="true" />
                  <span className="text-sm font-medium flex-1 text-left truncate">{label}</span>
                  {shortcutNum !== undefined && (
                    <kbd className={`text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-mission-control-border/80 text-mission-control-text-dim'
                    }`}>
                      {shortcutNum}
                    </kbd>
                  )}
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
                </button>
              );
            })}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 border-t border-mission-control-border space-y-1">
          {onOpenEditPanels && (
            <button
              onClick={() => { onOpenEditPanels(); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-mission-control-text-dim hover:bg-mission-control-border hover:text-mission-control-text transition-all"
              aria-label="Edit Panels"
            >
              <SlidersHorizontal size={18} aria-hidden="true" />
              <span className="text-sm font-medium">Edit Panels</span>
            </button>
          )}

          {onOpenHelp && (
            <button
              onClick={() => { onOpenHelp(); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-mission-control-text-dim hover:bg-mission-control-border hover:text-mission-control-text transition-all"
              aria-label="Help"
            >
              <HelpCircle size={18} aria-hidden="true" />
              <span className="text-sm font-medium">Help</span>
            </button>
          )}

          <button
            onClick={() => handleNavigate('settings')}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
              currentView === 'settings'
                ? 'bg-mission-control-accent text-white shadow-lg shadow-mission-control-accent/20'
                : 'text-mission-control-text-dim hover:bg-mission-control-border hover:text-mission-control-text'
            }`}
            aria-label="Settings"
            aria-current={currentView === 'settings' ? 'page' : undefined}
          >
            <Settings size={18} aria-hidden="true" />
            <span className="text-sm font-medium">Settings</span>
          </button>
        </div>
      </div>
    </>
  );
}
