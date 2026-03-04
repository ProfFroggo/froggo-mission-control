import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Calendar, Mail, MessageSquare, Mic, ListTodo, Bot, Settings, Moon, Sun, Zap, Inbox, Brain, Database, Plus, FileText, Home, Coffee, Play, Terminal, RefreshCw } from 'lucide-react';
import { useFocusTrap, useAnnounce } from '../hooks/useAccessibility';
import PromptDialog, { usePromptDialog } from './PromptDialog';

// X logo component
const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
import { gateway } from '../lib/gateway';
import { useStore } from '../store/store';
import { showToast } from './Toast';
import { useFocusMode } from './FocusMode';

interface Command {
  id: string;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  category: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
}

export default function CommandPalette({ isOpen, onClose, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addActivity, connected } = useStore();
  const dialogRef = useFocusTrap(isOpen);
  const announce = useAnnounce();
  const { setFocusMode } = useFocusMode();

  // Prompt dialog for text input (replaces window.prompt)
  const promptDialog = usePromptDialog();

  // Helper to show prompt and execute action with result
  const withPrompt = useCallback((
    options: { title: string; message?: string; placeholder?: string; multiline?: boolean },
    action: (value: string) => void | Promise<void>
  ) => {
    promptDialog.showPrompt(options, action);
  }, [promptDialog]);

  // Helper for two-step prompts (like add fact with category)
  const withPrompt2 = useCallback((
    options1: { title: string; message?: string; placeholder?: string },
    options2: { title: string; message?: string; placeholder?: string },
    action: (value1: string, value2: string) => void | Promise<void>
  ) => {
    promptDialog.showPrompt(options1, async (value1) => {
      promptDialog.showPrompt(options2, (value2) => action(value1, value2));
    });
  }, [promptDialog]);

  const commands: Command[] = [
    // Navigation
    { id: 'nav-inbox', icon: <Mail size={16} />, label: 'Go to Inbox', shortcut: '⌘1', category: 'Navigation', action: () => { onNavigate('inbox'); onClose(); } },
    { id: 'nav-dashboard', icon: <Home size={16} />, label: 'Go to Dashboard', shortcut: '⌘2', category: 'Navigation', action: () => { onNavigate('dashboard'); onClose(); } },
    { id: 'nav-analytics', icon: <Zap size={16} />, label: 'Go to Analytics', shortcut: '⌘3', category: 'Navigation', action: () => { onNavigate('analytics'); onClose(); } },
    { id: 'nav-tasks', icon: <ListTodo size={16} />, label: 'Go to Tasks', shortcut: '⌘4', category: 'Navigation', action: () => { onNavigate('kanban'); onClose(); } },
    { id: 'nav-agents', icon: <Bot size={16} />, label: 'Go to Agents', shortcut: '⌘5', category: 'Navigation', action: () => { onNavigate('agents'); onClose(); } },
    { id: 'nav-twitter', icon: <XIcon size={16} />, label: 'Go to Social Media', shortcut: '⌘6', category: 'Navigation', action: () => { onNavigate('twitter'); onClose(); } },
    { id: 'nav-meetings', icon: <Mic size={16} />, label: 'Go to Meetings', shortcut: '⌘7', category: 'Navigation', action: () => { onNavigate('meetings'); onClose(); } },
    { id: 'nav-voicechat', icon: <Mic size={16} />, label: 'Go to Voice Chat', shortcut: '⌘8', category: 'Navigation', action: () => { onNavigate('voicechat'); onClose(); } },
    { id: 'nav-chat', icon: <MessageSquare size={16} />, label: 'Go to Chat', shortcut: '', category: 'Navigation', action: () => { onNavigate('chat'); onClose(); } },
    { id: 'nav-accounts', icon: <Settings size={16} />, label: 'Go to Accounts', shortcut: '⌘9', category: 'Navigation', action: () => { onNavigate('accounts'); onClose(); } },
    { id: 'nav-approvals', icon: <Inbox size={16} />, label: 'Go to Approvals', shortcut: '⌘0', category: 'Navigation', action: () => { onNavigate('approvals'); onClose(); } },
    
    // Quick Actions
    { id: 'action-calendar', icon: <Calendar size={16} />, label: 'Check Calendar Today', category: 'Actions', action: async () => {
      if (connected) {
        await gateway.sendChat("What's on my calendar today?");
        addActivity({ type: 'chat', message: 'Checking calendar...', timestamp: Date.now() });
        onNavigate('chat');
      }
      onClose();
    }},
    { id: 'action-email', icon: <Mail size={16} />, label: 'Check Unread Emails', category: 'Actions', action: async () => {
      if (connected) {
        await gateway.sendChat("Check my unread emails and summarize the important ones");
        addActivity({ type: 'chat', message: 'Checking emails...', timestamp: Date.now() });
        onNavigate('chat');
      }
      onClose();
    }},
    { id: 'action-messages', icon: <MessageSquare size={16} />, label: 'Check Messages (WA/TG)', category: 'Actions', action: async () => {
      if (connected) {
        await gateway.sendChat("Check WhatsApp and Telegram for any important messages");
        addActivity({ type: 'chat', message: 'Checking messages...', timestamp: Date.now() });
        onNavigate('chat');
      }
      onClose();
    }},
    { id: 'action-twitter', icon: <XIcon size={16} />, label: 'Check X Mentions', category: 'Actions', action: async () => {
      if (connected) {
        await gateway.sendChat("Check @Prof_Frogo mentions on X and draft replies");
        addActivity({ type: 'chat', message: 'Checking X mentions...', timestamp: Date.now() });
        onNavigate('chat');
      }
      onClose();
    }},
    
    // Memory
    { id: 'memory-search', icon: <Brain size={16} />, label: 'Search Memory (froggo-db)', category: 'Memory', action: async () => {
      withPrompt(
        { title: 'Search Memory', message: 'Enter search query:', placeholder: 'Search for...' },
        async (searchQuery) => {
          if (connected) {
            await gateway.sendChat(`Search froggo-db for: ${searchQuery}`);
            addActivity({ type: 'chat', message: `Memory search: ${searchQuery}`, timestamp: Date.now() });
            onNavigate('chat');
          }
          onClose();
        }
      );
    }},
    { id: 'memory-fact', icon: <Database size={16} />, label: 'Add Fact to Memory', category: 'Memory', action: async () => {
      withPrompt2(
        { title: 'Add Fact', message: 'Enter fact:', placeholder: 'Fact to remember...' },
        { title: 'Category', message: 'Enter category:', placeholder: 'learning' },
        async (fact, category) => {
          if (connected) {
            await gateway.sendChat(`[SYSTEM] Add to froggo-db: froggo-db add-fact "${fact}" --category ${category}`);
            addActivity({ type: 'system', message: `Added fact: ${fact.slice(0, 30)}...`, timestamp: Date.now() });
          }
          onClose();
        }
      );
    }},
    
    // Settings
    { id: 'settings', icon: <Settings size={16} />, label: 'Open Settings', category: 'Settings', action: () => { onNavigate('settings'); onClose(); } },
    
    // Quick Actions - Power-ups
    { id: 'quick-tweet', icon: <XIcon size={16} />, label: 'Draft a Post', category: 'Quick', action: async () => {
      withPrompt(
        { title: 'Draft Tweet', message: 'Enter tweet content:', placeholder: 'What\'s happening?' },
        async (tweet) => {
          if (connected) {
            await gateway.sendChat(`Draft this tweet for approval: "${tweet}"`);
            showToast('info', 'Tweet drafted', 'Check inbox for approval');
            onNavigate('chat');
          }
          onClose();
        }
      );
    }},
    { id: 'quick-task', icon: <Plus size={16} />, label: 'Create Task', shortcut: '⌘N', category: 'Quick', action: async () => {
      withPrompt(
        { title: 'Create Task', message: 'Enter task title:', placeholder: 'Task title...' },
        async (title) => {
          await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: `task-${Date.now()}`, title, status: 'todo', project: 'General' }) });
          showToast('success', 'Task created', title);
          onClose();
        }
      );
    }},
    { id: 'quick-note', icon: <FileText size={16} />, label: 'Quick Note to Memory', category: 'Quick', action: async () => {
      withPrompt(
        { title: 'Quick Note', message: 'Enter note:', placeholder: 'Note...', multiline: true },
        async (note) => {
          if (connected) {
            await gateway.sendChat(`Add to today's memory log: ${note}`);
            showToast('success', 'Note saved');
          }
          onClose();
        }
      );
    }},
    
    // Focus Modes
    { id: 'focus-work', icon: <Coffee size={16} />, label: 'Work Mode', category: 'Focus', action: () => {
      setFocusMode('work');
      showToast('info', 'Work Mode', 'Focus on work tasks');
      onClose();
    }},
    { id: 'focus-family', icon: <Home size={16} />, label: 'Family Time', category: 'Focus', action: () => {
      setFocusMode('family');
      showToast('info', 'Family Time', 'Only urgent notifications');
      onClose();
    }},
    { id: 'focus-dnd', icon: <Moon size={16} />, label: 'Do Not Disturb', category: 'Focus', action: () => {
      setFocusMode('dnd');
      showToast('info', 'DND Active', 'All notifications muted');
      onClose();
    }},
    { id: 'focus-off', icon: <Sun size={16} />, label: 'Turn Off Focus Mode', category: 'Focus', action: () => {
      setFocusMode(null);
      showToast('info', 'Focus Mode Off');
      onClose();
    }},
    
    // System
    { id: 'sys-refresh', icon: <RefreshCw size={16} />, label: 'Refresh Data', category: 'System', action: () => {
      window.location.reload();
    }},
    { id: 'sys-shell', icon: <Terminal size={16} />, label: 'Run Shell Command', category: 'System', action: async () => {
      withPrompt(
        { title: 'Run Shell Command', message: 'Enter command:', placeholder: 'ls -la' },
        async (cmd) => {
          if (connected) {
            await gateway.sendChat(`Run: ${cmd}`);
            onNavigate('chat');
          }
          onClose();
        }
      );
    }},
    { id: 'sys-spawn', icon: <Play size={16} />, label: 'Spawn Agent Task', category: 'System', action: async () => {
      withPrompt2(
        { title: 'Spawn Agent', message: 'Task description:', placeholder: 'What should the agent do?' },
        { title: 'Agent Type', message: 'Agent name:', placeholder: 'coder' },
        async (task, agent) => {
          if (connected) {
            await gateway.sendChat(`Spawn ${agent} agent to: ${task}`);
            showToast('info', 'Agent spawning', task.slice(0, 30) + '...');
            onNavigate('chat');
          }
          onClose();
        }
      );
    }},
  ];

  const filteredCommands = commands.filter(cmd => 
    cmd.label.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      announce('Command palette opened');
    }
  }, [isOpen, announce]);

  useEffect(() => {
    setSelectedIndex(0);
    if (query) {
      announce(`${filteredCommands.length} commands found`);
    }
  }, [query, announce, filteredCommands.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
      e.preventDefault();
      filteredCommands[selectedIndex].action();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  let flatIndex = 0;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-palette-title"
    >
      <div 
        className="absolute inset-0 modal-backdrop backdrop-blur-sm" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      <div 
        ref={dialogRef as React.RefObject<HTMLDivElement>}
        className="relative w-full max-w-lg glass-modal rounded-2xl shadow-2xl overflow-hidden"
      >
        <h2 id="command-palette-title" className="sr-only">Command Palette</h2>
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-clawd-border">
          <Search size={20} className="text-clawd-text-dim" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands..."
            className="flex-1 bg-transparent outline-none text-lg"
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-controls="command-list"
            aria-activedescendant={filteredCommands[selectedIndex]?.id}
          />
          <kbd className="px-2 py-1 text-xs bg-clawd-border rounded" aria-label="Press Escape to close">ESC</kbd>
        </div>

        {/* Commands List */}
        <div 
          id="command-list"
          className="max-h-80 overflow-y-auto p-2"
          role="listbox"
          aria-label="Available commands"
        >
          {Object.entries(groupedCommands).map(([category, cmds]) => (
            <div key={category} className="mb-2" role="group" aria-labelledby={`category-${category}`}>
              <div 
                id={`category-${category}`}
                className="px-3 py-1 text-xs font-medium text-clawd-text-dim uppercase tracking-wider"
              >
                {category}
              </div>
              {cmds.map((cmd) => {
                const currentIndex = flatIndex++;
                const isSelected = currentIndex === selectedIndex;
                
                return (
                  <button
                    key={cmd.id}
                    id={cmd.id}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(currentIndex)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      isSelected ? 'bg-clawd-accent text-white' : 'hover:bg-clawd-border'
                    }`}
                    role="option"
                    aria-selected={isSelected}
                    aria-label={`${cmd.label}${cmd.shortcut ? ` (${cmd.shortcut})` : ''}`}
                  >
                    <span className={isSelected ? 'text-white' : 'text-clawd-text-dim'} aria-hidden="true">{cmd.icon}</span>
                    <span className="flex-1 text-left">{cmd.label}</span>
                    {cmd.shortcut && (
                      <kbd className={`px-2 py-0.5 text-xs rounded ${
                        isSelected ? 'bg-clawd-text/20' : 'bg-clawd-border'
                      }`} aria-hidden="true">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          
          {filteredCommands.length === 0 && (
            <div className="text-center py-8 text-clawd-text-dim">
              No commands found
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-clawd-border flex items-center justify-between text-xs text-clawd-text-dim">
          <div className="flex gap-2">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
        </div>
      </div>

      {/* Prompt Dialog for text input */}
      <PromptDialog
        open={promptDialog.open}
        onClose={promptDialog.closePrompt}
        onSubmit={promptDialog.onSubmit}
        title={promptDialog.config.title}
        message={promptDialog.config.message}
        placeholder={promptDialog.config.placeholder}
        multiline={promptDialog.config.multiline}
        confirmLabel={promptDialog.config.confirmLabel}
        cancelLabel={promptDialog.config.cancelLabel}
        defaultValue={promptDialog.config.defaultValue}
      />
    </div>
  );
}
