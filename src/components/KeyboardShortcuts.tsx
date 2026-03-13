import { useEffect, useState, useMemo } from 'react';
import { Keyboard, X, Search } from 'lucide-react';

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { category: 'Global Navigation', items: [
    { keys: ['⌘', '1'], action: 'Inbox' },
    { keys: ['⌘', '2'], action: 'Dashboard' },
    { keys: ['⌘', '3'], action: 'Analytics' },
    { keys: ['⌘', '4'], action: 'Tasks (Kanban)' },
    { keys: ['⌘', '5'], action: 'Agents' },
    { keys: ['⌘', '6'], action: 'Social Media' },
    { keys: ['⌘', '7'], action: 'Meetings' },
    { keys: ['⌘', '8'], action: 'Voice Chat' },
    { keys: ['⌘', '9'], action: 'Connected Accounts' },
    { keys: ['⌘', '0'], action: 'Approvals' },
    { keys: ['⌘', ','], action: 'Settings' },
  ]},
  { category: 'Extended Navigation', items: [
    { keys: ['⌘', '⇧', 'C'], action: 'Context Control' },
    { keys: ['⌘', '⇧', 'I'], action: '3-Pane Inbox' },
    { keys: ['⌘', '⇧', 'L'], action: 'Library' },
    { keys: ['⌘', '⇧', 'S'], action: 'Starred Messages' },
  ]},
  { category: 'Appearance & Navigation', items: [
    { keys: ['⌘', '⇧', 'D'], action: 'Toggle Dark/Light Mode' },
    { keys: ['⌥', '↑'], action: 'Scroll Up' },
    { keys: ['⌥', '↓'], action: 'Scroll Down' },
    { keys: ['⌥', '⇞'], action: 'Scroll Page Up' },
    { keys: ['⌥', '⇟'], action: 'Scroll Page Down' },
  ]},
  { category: 'Global Actions', items: [
    { keys: ['⌘', 'K'], action: 'Global Search (primary)' },
    { keys: ['⌘', 'F'], action: 'Global Search (alt)' },
    { keys: ['⌘', '/'], action: 'Global Search (alt 2)' },
    { keys: ['⌘', 'P'], action: 'Command Palette' },
    { keys: ['⌘', 'H'], action: 'Help & Documentation' },
    { keys: ['⌘', '?'], action: 'Keyboard Shortcuts Help' },
    { keys: ['⌘', 'M'], action: 'Toggle Mute' },
  ]},
  { category: 'Quick Actions', items: [
    { keys: ['⌘', '⇧', 'M'], action: 'Quick Message' },
    { keys: ['⌘', '⇧', 'N'], action: 'Add Contact' },
    { keys: ['⌘', '⇧', 'K'], action: 'Add Skill' },
  ]},
  { category: 'Task Detail Panel', items: [
    { keys: ['⌘', 'S'], action: 'Save / Refresh Task' },
    { keys: ['⌘', 'Enter'], action: 'Complete Task' },
    { keys: ['⌘', 'N'], action: 'New Subtask' },
    { keys: ['⌘', '⇧', 'P'], action: 'Poke Agent' },
    { keys: ['⌘', '⇧', 'R'], action: 'Reopen Task' },
    { keys: ['⌘', 'E'], action: 'Edit Task (focus planning)' },
    { keys: ['⌘', '⌫'], action: 'Delete Task' },
    { keys: ['⌘', '1'], action: 'Subtasks Tab' },
    { keys: ['⌘', '2'], action: 'Planning Tab' },
    { keys: ['⌘', '3'], action: 'Activity Tab' },
    { keys: ['⌘', '4'], action: 'Files Tab' },
    { keys: ['⌘', '5'], action: 'Review Tab' },
    { keys: ['Esc'], action: 'Close Panel' },
  ]},
  { category: 'Agent Detail Modal', items: [
    { keys: ['⌘', 'R'], action: 'Refresh Agent Details' },
    { keys: ['⌘', 'N'], action: 'Add New Skill' },
    { keys: ['⌘', '1'], action: 'Performance Tab' },
    { keys: ['⌘', '2'], action: 'Skills Tab' },
    { keys: ['⌘', '3'], action: 'Tasks Tab' },
    { keys: ['⌘', '4'], action: 'Brain Tab' },
    { keys: ['⌘', '5'], action: 'Rules Tab' },
    { keys: ['Esc'], action: 'Close Modal' },
  ]},
  { category: 'Skill Modal', items: [
    { keys: ['⌘', 'S'], action: 'Save Skill' },
    { keys: ['⌘', 'Enter'], action: 'Save & Close' },
    { keys: ['⌘', '1'], action: 'Suggest Mode' },
    { keys: ['⌘', '2'], action: 'Dialogue Mode' },
    { keys: ['⌘', '3'], action: 'Manual Mode' },
    { keys: ['Esc'], action: 'Close Modal' },
  ]},
  { category: 'Kanban Board', items: [
    { keys: ['N'], action: 'New Task' },
    { keys: ['?'], action: 'Show Panel Help' },
  ]},
  { category: 'Approvals Queue', items: [
    { keys: ['A'], action: 'Approve focused item' },
    { keys: ['D'], action: 'Deny focused item' },
  ]},
  { category: 'Global (bare keys)', items: [
    { keys: ['?'], action: 'Show this shortcuts panel' },
    { keys: ['N'], action: 'New task (navigates to Kanban)' },
    { keys: ['Esc'], action: 'Close any open modal or panel' },
  ]},
  { category: 'Social Media', items: [
    { keys: ['⌘', 'N'], action: 'New Tweet' },
    { keys: ['⌘', 'Enter'], action: 'Send Tweet' },
    { keys: ['⌘', '⇧', 'R'], action: 'Retweet' },
    { keys: ['⌘', 'L'], action: 'Like' },
  ]},
  { category: 'Chat & Voice', items: [
    { keys: ['Enter'], action: 'Send message' },
    { keys: ['⌘', 'Enter'], action: 'Send message (alt)' },
    { keys: ['⇧', 'Enter'], action: 'New line' },
  ]},
  { category: 'General Navigation', items: [
    { keys: ['Esc'], action: 'Close modal/panel' },
    { keys: ['↑', '↓'], action: 'Navigate items' },
    { keys: ['⌘', '↑'], action: 'First item' },
    { keys: ['⌘', '↓'], action: 'Last item' },
    { keys: ['⌘', ']'], action: 'Next tab' },
    { keys: ['⌘', '['], action: 'Previous tab' },
    { keys: ['Tab'], action: 'Next field' },
    { keys: ['⇧', 'Tab'], action: 'Previous field' },
  ]},
];

export default function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Focus search on open
      setTimeout(() => {
        const searchInput = document.querySelector('[placeholder="Search shortcuts..."]') as HTMLInputElement;
        searchInput?.focus();
      }, 100);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Filter shortcuts based on search query
  const filteredShortcuts = useMemo(() => {
    if (!searchQuery.trim()) return shortcuts;
    
    const query = searchQuery.toLowerCase();
    return shortcuts.map(section => ({
      ...section,
      items: section.items.filter(item => 
        item.action.toLowerCase().includes(query) ||
        item.keys.some(key => key.toLowerCase().includes(query))
      )
    })).filter(section => section.items.length > 0);
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="button"
      tabIndex={0}
      aria-label="Close keyboard shortcuts"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); }}}
    >
      <div
        className="glass-modal rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="presentation"
        onKeyDown={(e) => { e.stopPropagation(); }}
      >
        {/* Header */}
        <div className="p-6 border-b border-mission-control-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-mission-control-accent/20 rounded-xl">
                <Keyboard size={24} className="text-mission-control-accent" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Keyboard Shortcuts</h2>
                <p className="text-sm text-mission-control-text-dim">Navigate faster with these shortcuts</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-mission-control-border rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shortcuts..."
              className="w-full pl-10 pr-4 py-2 bg-mission-control-bg border border-mission-control-border rounded-lg text-sm focus:outline-none focus:border-mission-control-accent"
            />
          </div>
        </div>

        {/* Shortcuts */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredShortcuts.length > 0 ? (
            <div className="grid grid-cols-2 gap-6">
              {filteredShortcuts.map((section) => (
                <div key={section.category} className="space-y-3">
                  <h3 className="text-sm font-medium text-mission-control-text-dim uppercase tracking-wide sticky top-0 bg-mission-control-surface pb-2">
                    {section.category}
                  </h3>
                  <div className="space-y-2">
                    {section.items.map((shortcut, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-mission-control-bg/50 transition-colors"
                      >
                        <span className="text-sm">{shortcut.action}</span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, keyIdx) => (
                            <kbd
                              key={keyIdx}
                              className="px-2 py-1 text-xs bg-mission-control-bg border border-mission-control-border rounded-md font-mono shadow-sm"
                            >
                              {key}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-mission-control-text-dim">
              <Keyboard size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No shortcuts found for &quot;{searchQuery}&quot;</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-mission-control-border bg-mission-control-bg">
          <div className="flex items-center justify-between text-sm text-mission-control-text-dim">
            <div className="flex items-center gap-4">
              <span>Press <kbd className="px-1.5 py-0.5 bg-mission-control-border rounded text-xs">Esc</kbd> to close</span>
              <span className="text-xs">• {filteredShortcuts.reduce((sum, s) => sum + s.items.length, 0)} shortcuts</span>
            </div>
            <span className="text-xs">⌘ = Cmd (macOS) / Ctrl (Windows/Linux)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
