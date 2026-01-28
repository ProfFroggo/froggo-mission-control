import { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { category: 'Navigation', items: [
    { keys: ['⌘', '1'], action: 'Dashboard' },
    { keys: ['⌘', '2'], action: 'Approvals' },
    { keys: ['⌘', '3'], action: 'Inbox' },
    { keys: ['⌘', '4'], action: 'Analytics' },
    { keys: ['⌘', '5'], action: 'Tasks (Kanban)' },
    { keys: ['⌘', '6'], action: 'Agents' },
    { keys: ['⌘', '7'], action: 'X' },
    { keys: ['⌘', '8'], action: 'Voice' },
    { keys: ['⌘', '9'], action: 'Chat' },
  ]},
  { category: 'Actions', items: [
    { keys: ['⌘', 'K'], action: 'Command Palette' },
    { keys: ['⌘', '/'], action: 'Global Search' },
    { keys: ['⌘', ','], action: 'Settings' },
    { keys: ['⌘', '?'], action: 'Keyboard Shortcuts' },
    { keys: ['⌘', 'M'], action: 'Toggle Mute' },
  ]},
  { category: 'Chat', items: [
    { keys: ['Enter'], action: 'Send message' },
    { keys: ['⌘', 'Enter'], action: 'Send message' },
    { keys: ['Shift', 'Enter'], action: 'New line' },
  ]},
  { category: 'Global', items: [
    { keys: ['Esc'], action: 'Close modal/panel' },
    { keys: ['↑', '↓'], action: 'Navigate list items' },
  ]},
];

export default function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="glass-modal rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-clawd-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-clawd-accent/20 rounded-xl">
              <Keyboard size={24} className="text-clawd-accent" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Keyboard Shortcuts</h2>
              <p className="text-sm text-clawd-text-dim">Navigate faster with these shortcuts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-clawd-border rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Shortcuts */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-2 gap-6">
            {shortcuts.map((section) => (
              <div key={section.category}>
                <h3 className="text-sm font-medium text-clawd-text-dim mb-3 uppercase tracking-wide">
                  {section.category}
                </h3>
                <div className="space-y-2">
                  {section.items.map((shortcut, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className="text-sm">{shortcut.action}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIdx) => (
                          <kbd
                            key={keyIdx}
                            className="px-2 py-1 text-xs bg-clawd-bg border border-clawd-border rounded-md font-mono"
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
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-clawd-border bg-clawd-bg text-center text-sm text-clawd-text-dim">
          Press <kbd className="px-1.5 py-0.5 bg-clawd-border rounded text-xs">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
