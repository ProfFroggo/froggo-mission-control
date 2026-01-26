import { useState, useEffect, useRef } from 'react';
import { Search, Calendar, Mail, MessageSquare, Mic, ListTodo, Bot, Settings, Moon, Zap, X, Send, Radio, Inbox, Brain, Database } from 'lucide-react';
import { gateway } from '../lib/gateway';
import { useStore } from '../store/store';

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

  const commands: Command[] = [
    // Navigation
    { id: 'nav-inbox', icon: <Inbox size={16} />, label: 'Go to Inbox', shortcut: '⌘1', category: 'Navigation', action: () => { onNavigate('inbox'); onClose(); } },
    { id: 'nav-dashboard', icon: <Zap size={16} />, label: 'Go to Dashboard', shortcut: '⌘2', category: 'Navigation', action: () => { onNavigate('dashboard'); onClose(); } },
    { id: 'nav-chat', icon: <MessageSquare size={16} />, label: 'Go to Chat', shortcut: '⌘3', category: 'Navigation', action: () => { onNavigate('chat'); onClose(); } },
    { id: 'nav-sessions', icon: <Radio size={16} />, label: 'Go to Sessions', shortcut: '⌘4', category: 'Navigation', action: () => { onNavigate('sessions'); onClose(); } },
    { id: 'nav-tasks', icon: <ListTodo size={16} />, label: 'Go to Tasks', shortcut: '⌘5', category: 'Navigation', action: () => { onNavigate('kanban'); onClose(); } },
    { id: 'nav-agents', icon: <Bot size={16} />, label: 'Go to Agents', shortcut: '⌘6', category: 'Navigation', action: () => { onNavigate('agents'); onClose(); } },
    { id: 'nav-twitter', icon: <Send size={16} />, label: 'Go to X/Twitter', shortcut: '⌘7', category: 'Navigation', action: () => { onNavigate('twitter'); onClose(); } },
    { id: 'nav-voice', icon: <Mic size={16} />, label: 'Go to Voice', shortcut: '⌘8', category: 'Navigation', action: () => { onNavigate('voice'); onClose(); } },
    
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
    { id: 'action-twitter', icon: <Send size={16} />, label: 'Check X/Twitter Mentions', category: 'Actions', action: async () => {
      if (connected) {
        await gateway.sendChat("Check @Prof_Frogo mentions on X and draft replies");
        addActivity({ type: 'chat', message: 'Checking X mentions...', timestamp: Date.now() });
        onNavigate('chat');
      }
      onClose();
    }},
    
    // Memory
    { id: 'memory-search', icon: <Brain size={16} />, label: 'Search Memory (froggo-db)', category: 'Memory', action: async () => {
      const searchQuery = window.prompt('Search memory for:');
      if (searchQuery && connected) {
        await gateway.sendChat(`Search froggo-db for: ${searchQuery}`);
        addActivity({ type: 'chat', message: `Memory search: ${searchQuery}`, timestamp: Date.now() });
        onNavigate('chat');
      }
      onClose();
    }},
    { id: 'memory-fact', icon: <Database size={16} />, label: 'Add Fact to Memory', category: 'Memory', action: async () => {
      const fact = window.prompt('Add fact:');
      const category = window.prompt('Category (preference/decision/learning/person/project):') || 'learning';
      if (fact && connected) {
        await gateway.sendChat(`[SYSTEM] Add to froggo-db: froggo-db add-fact "${fact}" --category ${category}`);
        addActivity({ type: 'system', message: `Added fact: ${fact.slice(0, 30)}...`, timestamp: Date.now() });
      }
      onClose();
    }},
    
    // Settings
    { id: 'settings', icon: <Settings size={16} />, label: 'Open Settings', category: 'Settings', action: () => { onNavigate('settings'); onClose(); } },
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
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-clawd-surface border border-clawd-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-clawd-border">
          <Search size={20} className="text-clawd-text-dim" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands..."
            className="flex-1 bg-transparent outline-none text-lg"
          />
          <kbd className="px-2 py-1 text-xs bg-clawd-border rounded">ESC</kbd>
        </div>

        {/* Commands List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {Object.entries(groupedCommands).map(([category, cmds]) => (
            <div key={category} className="mb-2">
              <div className="px-3 py-1 text-xs font-medium text-clawd-text-dim uppercase tracking-wider">
                {category}
              </div>
              {cmds.map((cmd) => {
                const currentIndex = flatIndex++;
                const isSelected = currentIndex === selectedIndex;
                
                return (
                  <button
                    key={cmd.id}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(currentIndex)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      isSelected ? 'bg-clawd-accent text-white' : 'hover:bg-clawd-border'
                    }`}
                  >
                    <span className={isSelected ? 'text-white' : 'text-clawd-text-dim'}>{cmd.icon}</span>
                    <span className="flex-1 text-left">{cmd.label}</span>
                    {cmd.shortcut && (
                      <kbd className={`px-2 py-0.5 text-xs rounded ${
                        isSelected ? 'bg-white/20' : 'bg-clawd-border'
                      }`}>
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
          <span>⌘K to toggle</span>
        </div>
      </div>
    </div>
  );
}
