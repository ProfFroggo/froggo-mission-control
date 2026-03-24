// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * ShortcutsModal — compact keyboard shortcut reference panel.
 *
 * Opens with the "?" key or the Keyboard icon button in the sidebar footer.
 * Groups shortcuts by category, displayed in a 2-column grid.
 * Closes on Escape or backdrop click.
 */

import { X, Keyboard } from 'lucide-react';
import { IconButton, Box, Flex, Text, Heading, Grid } from '@radix-ui/themes';

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
    <Flex align="center" justify="between" py="1" px="2" gap="4" className="rounded-lg hover:bg-mission-control-bg/50 transition-colors">
      <Text size="2" className="text-mission-control-text truncate">{row.description}</Text>
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
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-50"
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
        className="glass-modal rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Flex align="center" justify="between" p="5" className="border-b border-mission-control-border flex-shrink-0">
          <Flex align="center" gap="3">
            <Box p="2" className="bg-mission-control-accent/20 rounded-lg">
              <Keyboard size={20} className="text-mission-control-accent" aria-hidden="true" />
            </Box>
            <Box>
              <Heading size="3" as="h2" className="text-mission-control-text">Keyboard Shortcuts</Heading>
              <Text size="1" className="text-mission-control-text-dim">Navigate faster without leaving the keyboard</Text>
            </Box>
          </Flex>
          <IconButton
            onClick={onClose}
            size="2"
            variant="ghost"
            aria-label="Close shortcuts"
          >
            <X size={18} aria-hidden="true" />
          </IconButton>
        </Flex>

        {/* Shortcut grid */}
        <Box p="5" className="overflow-y-auto">
          <Grid columns="2" gap="5">
            {SHORTCUT_GROUPS.map((group) => (
              <Box key={group.category} className="space-y-1">
                <Text size="1" weight="medium" className="text-mission-control-text-dim uppercase tracking-wide" mb="2" as="div">
                  {group.category}
                </Text>
                {group.items.map((row, i) => (
                  <ShortcutEntry key={i} row={row} />
                ))}
              </Box>
            ))}
          </Grid>
        </Box>

        {/* Footer */}
        <Box px="5" py="3" className="border-t border-mission-control-border bg-mission-control-bg flex-shrink-0">
          <Text size="1" className="text-mission-control-text-dim">
            Press{' '}
            <kbd className="inline-flex items-center px-1.5 py-0.5 text-xs font-mono bg-mission-control-border rounded border border-mission-control-border/50 text-mission-control-text">
              Esc
            </kbd>{' '}
            to close &nbsp;&bull;&nbsp; ⌘ = Cmd (macOS) / Ctrl (Windows/Linux) &nbsp;&bull;&nbsp; Tab past sidebar to activate the skip-to-content link
          </Text>
        </Box>
      </Flex>
    </Flex>
  );
}
