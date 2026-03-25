// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * ShortcutsModal — compact keyboard shortcut reference panel.
 *
 * Opens with the "?" key or the Keyboard icon button in the sidebar footer.
 * Groups shortcuts by category, displayed in a 2-column grid.
 * Closes on Escape or backdrop click.
 */

import { X, Keyboard } from 'lucide-react';
import { Box, Flex, Text, Heading, Grid } from '@radix-ui/themes';

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
    <kbd className="inline-flex items-center justify-center text-[11px] font-mono px-1.5 py-0.5 rounded bg-mission-control-border/60 text-mission-control-text border border-mission-control-border leading-none">
      {label}
    </kbd>
  );
}

function ShortcutEntry({ row, index }: { row: ShortcutRow; index: number }) {
  return (
    <Flex
      align="center"
      justify="between"
      gap="4"
      className={`py-2 border-b border-mission-control-border/40 last:border-0 px-2 rounded-md ${
        index % 2 === 1 ? 'bg-mission-control-border/5' : ''
      }`}
    >
      <Text size="2" className="text-sm text-mission-control-text">{row.description}</Text>
      <Flex align="center" gap="1" className="flex-shrink-0">
        {row.keys.map((k, i) => (
          <Key key={i} label={k} />
        ))}
      </Flex>
    </Flex>
  );
}

export default function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <Flex
      align="center"
      justify="center"
      p="4"
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
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
      <Flex
        direction="column"
        className="bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
          <Flex align="center" gap="3">
            <Box p="2" className="bg-mission-control-accent/20 rounded-lg">
              <Keyboard size={20} className="text-mission-control-accent" aria-hidden="true" />
            </Box>
            <Box>
              <Heading size="3" as="h2" className="text-mission-control-text">Keyboard Shortcuts</Heading>
              <Text size="1" className="text-mission-control-text-dim">Navigate faster without leaving the keyboard</Text>
            </Box>
          </Flex>
          <button
            onClick={onClose}
            aria-label="Close shortcuts"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Shortcut grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Grid columns="2" gap="5">
            {SHORTCUT_GROUPS.map((group) => (
              <Box key={group.category} className="space-y-1">
                <Text size="1" weight="bold" className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim pb-1" as="div">
                  {group.category}
                </Text>
                {group.items.map((row, i) => (
                  <ShortcutEntry key={i} row={row} index={i} />
                ))}
              </Box>
            ))}
          </Grid>
        </div>

        {/* Footer */}
        <div className="flex items-center px-6 py-4 border-t border-mission-control-border bg-mission-control-surface/80 flex-shrink-0">
          <Text size="1" className="text-mission-control-text-dim">
            Press{' '}
            <kbd className="inline-flex items-center text-[11px] font-mono px-1.5 py-0.5 rounded bg-mission-control-border/60 border border-mission-control-border text-mission-control-text">
              Esc
            </kbd>{' '}
            to close &nbsp;&bull;&nbsp; ⌘ = Cmd (macOS) / Ctrl (Windows/Linux) &nbsp;&bull;&nbsp; Tab past sidebar to activate the skip-to-content link
          </Text>
        </div>
      </Flex>
    </Flex>
  );
}
