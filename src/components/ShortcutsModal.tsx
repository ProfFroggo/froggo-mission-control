// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * ShortcutsModal — compact keyboard shortcut reference panel.
 *
 * Opens with the "?" key or the Keyboard icon button in the sidebar footer.
 * Groups shortcuts by category, displayed in a 2-column grid.
 * Closes on Escape or backdrop click.
 */

import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutRow {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  category: string;
  items: ShortcutRow[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    category: 'Navigation',
    items: [
      { keys: ['G', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'T'], description: 'Go to Tasks / Kanban' },
      { keys: ['G', 'P'], description: 'Go to Projects' },
      { keys: ['G', 'A'], description: 'Go to Agents' },
      { keys: ['G', 'C'], description: 'Go to Chat' },
      { keys: ['⌘', '1–9'], description: 'Jump to numbered panel' },
      { keys: ['⌘', ','], description: 'Settings' },
    ],
  },
  {
    category: 'Tasks',
    items: [
      { keys: ['⌘', 'N'], description: 'New task' },
      { keys: ['N'], description: 'New task (bare key)' },
      { keys: ['Esc'], description: 'Close task detail panel' },
      { keys: ['Tab'], description: 'Navigate fields in task panel' },
      { keys: ['Enter'], description: 'Save inline Kanban card' },
      { keys: ['Esc'], description: 'Cancel inline Kanban card' },
    ],
  },
  {
    category: 'Kanban',
    items: [
      { keys: ['Shift', 'Click'], description: 'Range-select cards' },
      { keys: ['Esc'], description: 'Clear card selection' },
    ],
  },
  {
    category: 'Search',
    items: [
      { keys: ['⌘', 'K'], description: 'Open global search' },
      { keys: ['/'], description: 'Open global search (bare key)' },
      { keys: ['⌘', 'F'], description: 'Open global search (alt)' },
      { keys: ['↑ ↓'], description: 'Navigate search results' },
      { keys: ['Esc'], description: 'Close search' },
    ],
  },
  {
    category: 'Knowledge Base',
    items: [
      { keys: ['↑ ↓'], description: 'Navigate search results' },
      { keys: ['Enter'], description: 'Open selected result' },
      { keys: ['Esc'], description: 'Clear search' },
    ],
  },
  {
    category: 'Schedule',
    items: [
      { keys: ['M'], description: 'Switch to month view' },
      { keys: ['W'], description: 'Switch to week view' },
      { keys: ['A'], description: 'Switch to agenda view' },
    ],
  },
  {
    category: 'Chat Rooms',
    items: [
      { keys: ['⌘', 'F'], description: 'Search messages' },
      { keys: ['Esc'], description: 'Close message search' },
    ],
  },
  {
    category: 'General',
    items: [
      { keys: ['?'], description: 'Show this shortcuts reference' },
      { keys: ['Esc'], description: 'Close any open modal' },
      { keys: ['⌘', 'P'], description: 'Command palette' },
      { keys: ['⌘', 'H'], description: 'Help & documentation' },
      { keys: ['⌘', '⇧', 'D'], description: 'Toggle dark / light mode' },
      { keys: ['⌘', 'M'], description: 'Toggle mute' },
    ],
  },
  {
    category: 'Accessibility',
    items: [
      { keys: ['Tab'], description: 'Skip to main content (focus sidebar first)' },
      { keys: ['Tab / Shift+Tab'], description: 'Cycle focus within open modals' },
      { keys: ['Esc'], description: 'Close modal and return focus to trigger' },
    ],
  },
];

function Key({ label }: { label: string }) {
  return (
    <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-mono bg-mission-control-border rounded border border-mission-control-border/50 text-mission-control-text leading-none">
      {label}
    </kbd>
  );
}

function ShortcutEntry({ row }: { row: ShortcutRow }) {
  return (
    <div className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-mission-control-bg/50 transition-colors gap-4">
      <span className="text-sm text-mission-control-text truncate">{row.description}</span>
      <div className="flex items-center gap-1 flex-shrink-0">
        {row.keys.map((k, i) => (
          <Key key={i} label={k} />
        ))}
      </div>
    </div>
  );
}

export default function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="button"
      tabIndex={0}
      aria-label="Close keyboard shortcuts"
      onKeyDown={(e) => {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div
        className="glass-modal rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-mission-control-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mission-control-accent/20 rounded-xl">
              <Keyboard size={20} className="text-mission-control-accent" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-mission-control-text">Keyboard Shortcuts</h2>
              <p className="text-xs text-mission-control-text-dim">Navigate faster without leaving the keyboard</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-mission-control-border rounded-xl transition-colors text-mission-control-text-dim hover:text-mission-control-text"
            aria-label="Close shortcuts"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Shortcut grid */}
        <div className="overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-6">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.category} className="space-y-1">
                <h3 className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wide mb-2">
                  {group.category}
                </h3>
                {group.items.map((row, i) => (
                  <ShortcutEntry key={i} row={row} />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-mission-control-border bg-mission-control-bg flex-shrink-0">
          <p className="text-xs text-mission-control-text-dim">
            Press{' '}
            <kbd className="inline-flex items-center px-1.5 py-0.5 text-xs font-mono bg-mission-control-border rounded border border-mission-control-border/50 text-mission-control-text">
              Esc
            </kbd>{' '}
            to close &nbsp;&bull;&nbsp; ⌘ = Cmd (macOS) / Ctrl (Windows/Linux) &nbsp;&bull;&nbsp; Tab past sidebar to activate the skip-to-content link
          </p>
        </div>
      </div>
    </div>
  );
}
