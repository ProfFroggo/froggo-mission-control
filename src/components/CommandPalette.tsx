// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, Calendar, Mail, MessageSquare, Mic, ListTodo, Bot, Settings, Moon, Sun, Zap, Inbox,
  Brain, Database, Plus, FileText, Home, Coffee, Play, Terminal, RefreshCw, BookOpen, Library,
  Bell, LayoutGrid, Clock, FolderOpen, Megaphone, CheckSquare, Star, ChevronRight, ArrowUp,
  ArrowDown, CornerDownLeft, X, Filter,
} from 'lucide-react';
import Fuse from 'fuse.js';
import { useFocusTrap, useAnnounce } from '../hooks/useAccessibility';
import PromptDialog, { usePromptDialog } from './PromptDialog';
import { gateway } from '../lib/gateway';
import { useStore } from '../store/store';
import { showToast } from './Toast';
import { useFocusMode } from './FocusMode';

// X logo component
const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// ── Storage keys ─────────────────────────────────────────────────────────────
const SEARCH_HISTORY_KEY = 'mission-control.search-history';
const SAVED_SEARCHES_KEY = 'mission-control.saved-searches';
const RECENT_ITEMS_KEY = 'mission-control.recent-items';
const MAX_HISTORY = 20;
const MAX_RECENT = 5;

// ── Types ─────────────────────────────────────────────────────────────────────
type FilterType = 'all' | 'tasks' | 'agents' | 'knowledge' | 'library' | 'campaigns' | 'automations';

interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  type: FilterType;
  nav: string;
}

interface SearchGroup {
  type: FilterType;
  label: string;
  items: SearchResultItem[];
  total: number;
}

interface RecentItem {
  id: string;
  title: string;
  type: FilterType;
  nav: string;
  visitedAt: number;
}

interface ActionCommand {
  id: string;
  trigger: string;
  label: string;
  icon: React.ReactNode;
  action: (arg?: string) => void;
}

interface Command {
  id: string;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  category: string;
  action: () => void;
  meta?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string, id?: string) => void;
}

// ── localStorage helpers ──────────────────────────────────────────────────────
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded — ignore
  }
}

// ── Fuzzy score ───────────────────────────────────────────────────────────────
// Returns 0–1: 0 = no match, 0.95 = prefix, 0.8 = contained, 0.5 = scattered
function fuzzyScore(text: string, query: string): number {
  if (!query) return 1;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t.startsWith(q)) return 0.95;
  if (t.includes(q)) return 0.8;
  // Scattered: every char of query appears in order in text
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length ? 0.5 : 0;
}

// ── Action command parsing ────────────────────────────────────────────────────
function parseActionCommand(query: string): { trigger: string; arg: string } | null {
  if (!query.startsWith('>')) return null;
  const rest = query.slice(1).trimStart();
  const spaceIdx = rest.search(/\s/);
  if (spaceIdx === -1) return { trigger: rest.toLowerCase(), arg: '' };
  return {
    trigger: rest.slice(0, spaceIdx).toLowerCase(),
    arg: rest.slice(spaceIdx + 1).trim(),
  };
}

// ── Type-to-nav mapping ───────────────────────────────────────────────────────
const TYPE_NAV: Record<FilterType, string> = {
  all: 'dashboard',
  tasks: 'kanban',
  agents: 'agents',
  knowledge: 'knowledge',
  library: 'library',
  campaigns: 'campaigns',
  automations: 'automations',
};

const TYPE_ICONS: Record<FilterType, React.ReactNode> = {
  all: <Search size={14} />,
  tasks: <CheckSquare size={14} />,
  agents: <Bot size={14} />,
  knowledge: <BookOpen size={14} />,
  library: <Library size={14} />,
  campaigns: <Megaphone size={14} />,
  automations: <Zap size={14} />,
};

const FILTER_PILLS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'agents', label: 'Agents' },
  { key: 'knowledge', label: 'Knowledge' },
  { key: 'library', label: 'Library' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'automations', label: 'Automations' },
];

// ── Inline actions per type ───────────────────────────────────────────────────
interface InlineAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  closeAfter: boolean;
  run: () => void | Promise<void>;
}

export default function CommandPalette({ isOpen, onClose, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchGroups, setSearchGroups] = useState<SearchGroup[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>(() =>
    loadFromStorage<string[]>(SEARCH_HISTORY_KEY, [])
  );
  const [savedSearches, setSavedSearches] = useState<string[]>(() =>
    loadFromStorage<string[]>(SAVED_SEARCHES_KEY, [])
  );
  const [recentItems, setRecentItems] = useState<RecentItem[]>(() =>
    loadFromStorage<RecentItem[]>(RECENT_ITEMS_KEY, [])
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { addActivity, connected } = useStore();
  const tasks = useStore(s => s.tasks);
  const agents = useStore(s => s.agents);
  const dialogRef = useFocusTrap(isOpen);
  const announce = useAnnounce();
  const { setFocusMode } = useFocusMode();
  const promptDialog = usePromptDialog();

  // ── History / saved search helpers ─────────────────────────────────────────
  const pushHistory = useCallback((q: string) => {
    if (!q.trim()) return;
    setSearchHistory(prev => {
      const next = [q, ...prev.filter(h => h !== q)].slice(0, MAX_HISTORY);
      saveToStorage(SEARCH_HISTORY_KEY, next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    saveToStorage(SEARCH_HISTORY_KEY, []);
  }, []);

  const saveSearch = useCallback((q: string) => {
    if (!q.trim()) return;
    setSavedSearches(prev => {
      if (prev.includes(q)) return prev;
      const next = [q, ...prev];
      saveToStorage(SAVED_SEARCHES_KEY, next);
      return next;
    });
  }, []);

  const removeSavedSearch = useCallback((q: string) => {
    setSavedSearches(prev => {
      const next = prev.filter(s => s !== q);
      saveToStorage(SAVED_SEARCHES_KEY, next);
      return next;
    });
  }, []);

  const trackRecentItem = useCallback((item: Omit<RecentItem, 'visitedAt'>) => {
    setRecentItems(prev => {
      const next = [
        { ...item, visitedAt: Date.now() },
        ...prev.filter(r => r.id !== item.id),
      ].slice(0, MAX_RECENT);
      saveToStorage(RECENT_ITEMS_KEY, next);
      return next;
    });
  }, []);

  // ── Prompt helpers ──────────────────────────────────────────────────────────
  const withPrompt = useCallback((
    options: { title: string; message?: string; placeholder?: string; multiline?: boolean },
    action: (value: string) => void | Promise<void>
  ) => {
    promptDialog.showPrompt(options, action);
  }, [promptDialog]);

  const withPrompt2 = useCallback((
    options1: { title: string; message?: string; placeholder?: string },
    options2: { title: string; message?: string; placeholder?: string },
    action: (value1: string, value2: string) => void | Promise<void>
  ) => {
    promptDialog.showPrompt(options1, async (value1) => {
      promptDialog.showPrompt(options2, (value2) => action(value1, value2));
    });
  }, [promptDialog]);

  // ── Remote search (200ms debounce, AbortController) ────────────────────────
  useEffect(() => {
    if (!query || query.startsWith('>') || query.length < 2) {
      setSearchGroups([]);
      return;
    }
    const timer = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      setSearchLoading(true);
      try {
        const typesParam = activeFilter === 'all' ? '' : `&types=${activeFilter}`;
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=5${typesParam}`, {
          signal: abortRef.current.signal,
        });
        if (!res.ok) throw new Error('search failed');
        const data = await res.json() as Record<string, { items: Record<string, unknown>[]; total: number }>;
        const groups: SearchGroup[] = [];
        const groupDefs: { key: FilterType; label: string; titleField: string; subtitleField?: string }[] = [
          { key: 'tasks', label: 'Tasks', titleField: 'title', subtitleField: 'status' },
          { key: 'agents', label: 'Agents', titleField: 'name', subtitleField: 'role' },
          { key: 'knowledge', label: 'Knowledge', titleField: 'title', subtitleField: 'category' },
          { key: 'library', label: 'Library', titleField: 'name', subtitleField: 'category' },
          { key: 'campaigns', label: 'Campaigns', titleField: 'name', subtitleField: 'status' },
          { key: 'automations', label: 'Automations', titleField: 'name', subtitleField: 'status' },
        ];
        for (const def of groupDefs) {
          const group = data[def.key];
          if (!group || group.items.length === 0) continue;
          groups.push({
            type: def.key,
            label: def.label,
            total: group.total,
            items: group.items.map(item => ({
              id: String(item.id ?? ''),
              title: String(item[def.titleField] ?? ''),
              subtitle: def.subtitleField ? String(item[def.subtitleField] ?? '') : undefined,
              type: def.key,
              nav: TYPE_NAV[def.key],
            })),
          });
        }
        setSearchGroups(groups);
        announce(`${groups.reduce((s, g) => s + g.items.length, 0)} results found`);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setSearchGroups([]);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, activeFilter, announce]);

  // ── Action commands (> prefix) ──────────────────────────────────────────────
  const ACTION_COMMANDS: ActionCommand[] = useMemo(() => [
    {
      id: 'action-create-task',
      trigger: 'create task',
      label: 'Create task',
      icon: <Plus size={16} />,
      action: () => { window.dispatchEvent(new CustomEvent('new-task')); onClose(); },
    },
    {
      id: 'action-new-campaign',
      trigger: 'new campaign',
      label: 'New campaign',
      icon: <Megaphone size={16} />,
      action: () => { onNavigate('campaigns'); onClose(); setTimeout(() => window.dispatchEvent(new CustomEvent('new-campaign')), 100); },
    },
    {
      id: 'action-run-automation',
      trigger: 'run automation',
      label: 'Run automation',
      icon: <Zap size={16} />,
      action: (arg?: string) => { onNavigate('automations'); onClose(); if (arg) window.dispatchEvent(new CustomEvent('run-automation', { detail: { name: arg } })); },
    },
    {
      id: 'action-navigate',
      trigger: 'navigate',
      label: 'Navigate to panel',
      icon: <FolderOpen size={16} />,
      action: (arg?: string) => { if (arg) onNavigate(arg); onClose(); },
    },
    {
      id: 'action-hire-agent',
      trigger: 'hire agent',
      label: 'Hire agent',
      icon: <Bot size={16} />,
      action: () => { onNavigate('agents'); onClose(); setTimeout(() => window.dispatchEvent(new CustomEvent('hire-agent')), 100); },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [onNavigate, onClose]);

  const filteredActionCommands = useMemo(() => {
    const parsed = parseActionCommand(query);
    if (!parsed) return [];
    const { trigger } = parsed;
    if (!trigger) return ACTION_COMMANDS;
    return ACTION_COMMANDS.filter(a =>
      fuzzyScore(a.label, trigger) > 0 || fuzzyScore(a.trigger, trigger) > 0
    );
  }, [query, ACTION_COMMANDS]);

  // ── Regular commands ────────────────────────────────────────────────────────
  const commands: Command[] = useMemo(() => [
    { id: 'nav-inbox', icon: <Mail size={16} />, label: 'Go to Inbox', shortcut: '⌘1', category: 'Navigation', action: () => { onNavigate('inbox'); onClose(); } },
    { id: 'nav-dashboard', icon: <Home size={16} />, label: 'Go to Dashboard', shortcut: '⌘2', category: 'Navigation', action: () => { onNavigate('dashboard'); onClose(); } },
    { id: 'nav-analytics', icon: <Zap size={16} />, label: 'Go to Analytics', shortcut: '⌘3', category: 'Navigation', action: () => { onNavigate('analytics'); onClose(); } },
    { id: 'nav-tasks', icon: <ListTodo size={16} />, label: 'Go to Tasks', shortcut: '⌘4', category: 'Navigation', action: () => { onNavigate('kanban'); onClose(); } },
    { id: 'nav-agents', icon: <Bot size={16} />, label: 'Go to Agents', shortcut: '⌘5', category: 'Navigation', action: () => { onNavigate('agents'); onClose(); } },
    { id: 'nav-twitter', icon: <XIcon size={16} />, label: 'Go to Social Media', shortcut: '⌘6', category: 'Navigation', action: () => { onNavigate('twitter'); onClose(); } },
    { id: 'nav-meetings', icon: <Mic size={16} />, label: 'Go to Meetings', shortcut: '⌘7', category: 'Navigation', action: () => { onNavigate('meetings'); onClose(); } },
    { id: 'nav-voicechat', icon: <Mic size={16} />, label: 'Go to Voice Chat', shortcut: '⌘8', category: 'Navigation', action: () => { onNavigate('voicechat'); onClose(); } },
    { id: 'nav-chat', icon: <MessageSquare size={16} />, label: 'Go to Chat', category: 'Navigation', action: () => { onNavigate('chat'); onClose(); } },
    { id: 'nav-accounts', icon: <Settings size={16} />, label: 'Go to Accounts', shortcut: '⌘9', category: 'Navigation', action: () => { onNavigate('accounts'); onClose(); } },
    { id: 'nav-approvals', icon: <Inbox size={16} />, label: 'Go to Approvals', shortcut: '⌘0', category: 'Navigation', action: () => { onNavigate('approvals'); onClose(); } },
    { id: 'nav-projects', icon: <FolderOpen size={16} />, label: 'Go to Projects', category: 'Navigation', action: () => { onNavigate('projects'); onClose(); } },
    { id: 'nav-campaigns', icon: <Megaphone size={16} />, label: 'Go to Campaigns', category: 'Navigation', action: () => { onNavigate('campaigns'); onClose(); } },
    { id: 'nav-knowledge', icon: <BookOpen size={16} />, label: 'Go to Knowledge', category: 'Navigation', action: () => { onNavigate('knowledge'); onClose(); } },
    { id: 'nav-library', icon: <Library size={16} />, label: 'Go to Library', category: 'Navigation', action: () => { onNavigate('library'); onClose(); } },
    { id: 'nav-schedule', icon: <Clock size={16} />, label: 'Go to Schedule', category: 'Navigation', action: () => { onNavigate('schedule'); onClose(); } },
    { id: 'nav-notifications', icon: <Bell size={16} />, label: 'Go to Notifications', category: 'Navigation', action: () => { onNavigate('notifications'); onClose(); } },
    { id: 'nav-modules', icon: <LayoutGrid size={16} />, label: 'Go to Modules', category: 'Navigation', action: () => { onNavigate('modules'); onClose(); } },

    { id: 'create-task', icon: <Plus size={16} />, label: 'Create new task', category: 'Create', action: () => { window.dispatchEvent(new CustomEvent('new-task')); onClose(); } },
    { id: 'create-project', icon: <Plus size={16} />, label: 'Create new project', category: 'Create', action: () => { onNavigate('projects'); onClose(); setTimeout(() => window.dispatchEvent(new CustomEvent('new-project')), 100); } },
    { id: 'create-campaign', icon: <Plus size={16} />, label: 'Create new campaign', category: 'Create', action: () => { onNavigate('campaigns'); onClose(); setTimeout(() => window.dispatchEvent(new CustomEvent('new-campaign')), 100); } },

    { id: 'action-calendar', icon: <Calendar size={16} />, label: 'Check Calendar Today', category: 'Actions', action: async () => {
      if (connected) { await gateway.sendChat("What's on my calendar today?"); addActivity({ type: 'chat', message: 'Checking calendar...', timestamp: Date.now() }); onNavigate('chat'); }
      onClose();
    }},
    { id: 'action-email', icon: <Mail size={16} />, label: 'Check Unread Emails', category: 'Actions', action: async () => {
      if (connected) { await gateway.sendChat("Check my unread emails and summarize the important ones"); addActivity({ type: 'chat', message: 'Checking emails...', timestamp: Date.now() }); onNavigate('chat'); }
      onClose();
    }},
    { id: 'action-messages', icon: <MessageSquare size={16} />, label: 'Check Messages (WA/TG)', category: 'Actions', action: async () => {
      if (connected) { await gateway.sendChat("Check WhatsApp and Telegram for any important messages"); addActivity({ type: 'chat', message: 'Checking messages...', timestamp: Date.now() }); onNavigate('chat'); }
      onClose();
    }},
    { id: 'action-twitter', icon: <XIcon size={16} />, label: 'Check X Mentions', category: 'Actions', action: async () => {
      if (connected) { await gateway.sendChat("Check @Prof_Frogo mentions on X and draft replies"); addActivity({ type: 'chat', message: 'Checking X mentions...', timestamp: Date.now() }); onNavigate('chat'); }
      onClose();
    }},

    { id: 'memory-search', icon: <Brain size={16} />, label: 'Search Memory', category: 'Memory', action: async () => {
      withPrompt({ title: 'Search Memory', message: 'Enter search query:', placeholder: 'Search for...' }, async (sq) => {
        await fetch('/api/chat/sessions/web:dashboard/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'user', content: `Search memory for: ${sq}` }) }).catch(() => {});
        addActivity({ type: 'chat', message: `Memory search: ${sq}`, timestamp: Date.now() }); onNavigate('chat'); onClose();
      });
    }},
    { id: 'memory-fact', icon: <Database size={16} />, label: 'Add Fact to Memory', category: 'Memory', action: async () => {
      withPrompt2(
        { title: 'Add Fact', message: 'Enter fact:', placeholder: 'Fact to remember...' },
        { title: 'Category', message: 'Enter category:', placeholder: 'learning' },
        async (fact, category) => {
          await fetch('/api/chat/sessions/web:dashboard/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'user', content: `Remember this fact (category: ${category}): ${fact}` }) }).catch(() => {});
          addActivity({ type: 'system', message: `Added fact: ${fact.slice(0, 30)}...`, timestamp: Date.now() }); onClose();
        }
      );
    }},

    { id: 'settings', icon: <Settings size={16} />, label: 'Open Settings', category: 'Settings', action: () => { onNavigate('settings'); onClose(); } },

    { id: 'quick-tweet', icon: <XIcon size={16} />, label: 'Draft a Post', category: 'Quick', action: async () => {
      withPrompt({ title: 'Draft Tweet', message: 'Enter tweet content:', placeholder: "What's happening?" }, async (tweet) => {
        if (connected) { await gateway.sendChat(`Draft this tweet for approval: "${tweet}"`); showToast('info', 'Tweet drafted', 'Check inbox for approval'); onNavigate('chat'); }
        onClose();
      });
    }},
    { id: 'quick-task', icon: <Plus size={16} />, label: 'Create Task', shortcut: '⌘N', category: 'Quick', action: async () => {
      withPrompt({ title: 'Create Task', message: 'Enter task title:', placeholder: 'Task title...' }, async (title) => {
        await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: `task-${Date.now()}`, title, status: 'todo', project: 'General' }) });
        showToast('success', 'Task created', title); onClose();
      });
    }},
    { id: 'quick-note', icon: <FileText size={16} />, label: 'Quick Note to Memory', category: 'Quick', action: async () => {
      withPrompt({ title: 'Quick Note', message: 'Enter note:', placeholder: 'Note...', multiline: true }, async (note) => {
        if (connected) { await gateway.sendChat(`Add to today's memory log: ${note}`); showToast('success', 'Note saved'); }
        onClose();
      });
    }},

    { id: 'focus-work', icon: <Coffee size={16} />, label: 'Work Mode', category: 'Focus', action: () => { setFocusMode('work'); showToast('info', 'Work Mode', 'Focus on work tasks'); onClose(); } },
    { id: 'focus-family', icon: <Home size={16} />, label: 'Family Time', category: 'Focus', action: () => { setFocusMode('family'); showToast('info', 'Family Time', 'Only urgent notifications'); onClose(); } },
    { id: 'focus-dnd', icon: <Moon size={16} />, label: 'Do Not Disturb', category: 'Focus', action: () => { setFocusMode('dnd'); showToast('info', 'DND Active', 'All notifications muted'); onClose(); } },
    { id: 'focus-off', icon: <Sun size={16} />, label: 'Turn Off Focus Mode', category: 'Focus', action: () => { setFocusMode(null); showToast('info', 'Focus Mode Off'); onClose(); } },

    { id: 'sys-refresh', icon: <RefreshCw size={16} />, label: 'Refresh Data', category: 'System', action: () => { window.location.reload(); } },
    { id: 'sys-shell', icon: <Terminal size={16} />, label: 'Run Shell Command', category: 'System', action: async () => {
      withPrompt({ title: 'Run Shell Command', message: 'Enter command:', placeholder: 'ls -la' }, async (cmd) => {
        if (connected) { await gateway.sendChat(`Run: ${cmd}`); onNavigate('chat'); }
        onClose();
      });
    }},
    { id: 'sys-spawn', icon: <Play size={16} />, label: 'Spawn Agent Task', category: 'System', action: async () => {
      withPrompt2(
        { title: 'Spawn Agent', message: 'Task description:', placeholder: 'What should the agent do?' },
        { title: 'Agent Type', message: 'Agent name:', placeholder: 'coder' },
        async (task, agent) => {
          if (connected) { await gateway.sendChat(`Spawn ${agent} agent to: ${task}`); showToast('info', 'Agent spawning', task.slice(0, 30) + '...'); onNavigate('chat'); }
          onClose();
        }
      );
    }},
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [connected, addActivity, withPrompt, withPrompt2, onNavigate, onClose, setFocusMode]);

  // ── Recent tasks (empty query) ─────────────────────────────────────────────
  const recentTaskCommands: Command[] = useMemo(() => {
    if (query) return [];
    return [...tasks]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5)
      .map(task => ({
        id: `recent-task-${task.id}`,
        icon: <CheckSquare size={16} />,
        label: task.title,
        category: 'Recent',
        meta: task.status,
        action: () => { onNavigate('kanban'); onClose(); },
      }));
  }, [query, tasks, onNavigate, onClose]);

  // ── Active agents (empty query) ────────────────────────────────────────────
  const activeAgentCommands: Command[] = useMemo(() => {
    if (query) return [];
    return agents
      .filter(a => a.status === 'active' || a.status === 'busy')
      .slice(0, 5)
      .map(agent => ({
        id: `agent-${agent.id}`,
        icon: <Bot size={16} />,
        label: agent.name,
        category: 'Agents',
        meta: agent.status,
        action: () => { onNavigate('agents'); onClose(); },
      }));
  }, [query, agents, onNavigate, onClose]);

  // ── Task Fuse search ────────────────────────────────────────────────────────
  const taskSearchCommands: Command[] = useMemo(() => {
    if (!query || query.startsWith('>') || tasks.length === 0) return [];
    const fuse = new Fuse(tasks, { keys: ['title', 'description'], threshold: 0.4 });
    return fuse.search(query).slice(0, 5).map(({ item }) => ({
      id: `task-${item.id}`,
      icon: <CheckSquare size={16} />,
      label: item.title,
      category: 'Tasks',
      meta: item.status,
      action: () => { onNavigate('kanban'); onClose(); },
    }));
  }, [query, tasks, onNavigate, onClose]);

  // ── Filtered regular commands ───────────────────────────────────────────────
  const filteredCommands = useMemo(() => {
    if (query.startsWith('>')) return [];
    const base = query
      ? commands.filter(cmd =>
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.category.toLowerCase().includes(query.toLowerCase())
        )
      : commands;
    return [...recentTaskCommands, ...activeAgentCommands, ...base, ...taskSearchCommands];
  }, [query, commands, recentTaskCommands, activeAgentCommands, taskSearchCommands]);

  // ── Inline actions for search result items ──────────────────────────────────
  const getInlineActions = useCallback((type: FilterType, itemId: string, itemTitle: string): InlineAction[] => {
    switch (type) {
      case 'tasks':
        return [
          {
            id: 'open',
            label: 'Open',
            icon: <FolderOpen size={14} />,
            closeAfter: true,
            run: () => { trackRecentItem({ id: itemId, title: itemTitle, type, nav: TYPE_NAV[type] }); onNavigate(TYPE_NAV[type], itemId); onClose(); },
          },
          {
            id: 'done',
            label: 'Mark Done',
            icon: <CheckSquare size={14} />,
            closeAfter: false,
            run: async () => {
              await fetch(`/api/tasks/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'done' }) }).catch(() => {});
              showToast('success', 'Task marked done');
            },
          },
          {
            id: 'assign',
            label: 'Assign Agent',
            icon: <Bot size={14} />,
            closeAfter: false,
            run: () => { onNavigate('agents'); },
          },
        ];
      case 'agents':
        return [
          {
            id: 'chat',
            label: 'Chat',
            icon: <MessageSquare size={14} />,
            closeAfter: true,
            run: () => { trackRecentItem({ id: itemId, title: itemTitle, type, nav: TYPE_NAV[type] }); onNavigate('chat'); onClose(); },
          },
          {
            id: 'assign-task',
            label: 'Assign Task',
            icon: <ListTodo size={14} />,
            closeAfter: true,
            run: () => { onNavigate('kanban'); onClose(); },
          },
          {
            id: 'profile',
            label: 'View Profile',
            icon: <FolderOpen size={14} />,
            closeAfter: true,
            run: () => { trackRecentItem({ id: itemId, title: itemTitle, type, nav: TYPE_NAV[type] }); onNavigate(TYPE_NAV[type], itemId); onClose(); },
          },
        ];
      case 'knowledge':
        return [
          {
            id: 'open',
            label: 'Open',
            icon: <FolderOpen size={14} />,
            closeAfter: true,
            run: () => { trackRecentItem({ id: itemId, title: itemTitle, type, nav: TYPE_NAV[type] }); onNavigate(TYPE_NAV[type], itemId); onClose(); },
          },
          {
            id: 'edit',
            label: 'Edit',
            icon: <FileText size={14} />,
            closeAfter: true,
            run: () => { onNavigate(TYPE_NAV[type], itemId); onClose(); },
          },
          {
            id: 'copy-link',
            label: 'Copy Link',
            icon: <ChevronRight size={14} />,
            closeAfter: false,
            run: () => { navigator.clipboard.writeText(`${window.location.origin}/knowledge/${itemId}`).catch(() => {}); showToast('success', 'Link copied'); },
          },
        ];
      default:
        return [
          {
            id: 'open',
            label: 'Open',
            icon: <FolderOpen size={14} />,
            closeAfter: true,
            run: () => { trackRecentItem({ id: itemId, title: itemTitle, type, nav: TYPE_NAV[type] }); onNavigate(TYPE_NAV[type], itemId); onClose(); },
          },
        ];
    }
  }, [onNavigate, onClose, trackRecentItem]);

  // ── Flat item list for keyboard nav ────────────────────────────────────────
  const flatItems = useMemo(() => {
    if (query.startsWith('>')) {
      return filteredActionCommands.map(a => ({
        id: a.id,
        type: 'action' as const,
        action: a.action,
      }));
    }
    if (searchGroups.length > 0) {
      return searchGroups.flatMap(g =>
        g.items.map(item => ({
          id: item.id,
          type: 'search-result' as const,
          itemType: item.type,
          title: item.title,
          action: () => { trackRecentItem({ id: item.id, title: item.title, type: item.type, nav: item.nav }); onNavigate(item.nav, item.id); onClose(); },
        }))
      );
    }
    return filteredCommands.map(cmd => ({
      id: cmd.id,
      type: 'command' as const,
      action: cmd.action,
    }));
  }, [query, filteredActionCommands, searchGroups, filteredCommands, onNavigate, onClose, trackRecentItem]);

  // ── Keyboard handler ────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const item = flatItems[selectedIndex];
      if (item?.type === 'search-result') {
        setExpandedItemId(id => id === item.id ? null : item.id);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flatItems[selectedIndex];
      if (!item) return;
      if (query.startsWith('>')) {
        const parsed = parseActionCommand(query);
        const actionCmd = filteredActionCommands[selectedIndex];
        if (actionCmd) actionCmd.action(parsed?.arg);
      } else {
        item.action();
        if (query.trim() && !query.startsWith('>')) pushHistory(query.trim());
      }
    } else if (e.key === 'Escape') {
      if (expandedItemId) {
        setExpandedItemId(null);
      } else {
        onClose();
      }
    }
  }, [flatItems, selectedIndex, query, filteredActionCommands, pushHistory, expandedItemId, onClose]);

  // ── Reset on open ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setExpandedItemId(null);
      setSearchGroups([]);
      setTimeout(() => inputRef.current?.focus(), 50);
      announce('Command palette opened');
    }
  }, [isOpen, announce]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeFilter]);

  if (!isOpen) return null;

  const isActionMode = query.startsWith('>');
  const hasSearchResults = searchGroups.length > 0;
  const showCommands = !isActionMode && !hasSearchResults;
  const showEmpty = !isActionMode && !hasSearchResults && !searchLoading && query.length >= 2 && searchGroups.length === 0 && filteredCommands.length === 0;

  // Group regular commands for display
  const groupedCommands = showCommands
    ? filteredCommands.reduce((acc, cmd) => {
        if (!acc[cmd.category]) acc[cmd.category] = [];
        acc[cmd.category].push(cmd);
        return acc;
      }, {} as Record<string, Command[]>)
    : {};

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

        {/* Header: search input + filter pills */}
        <div className="border-b border-mission-control-border">
          <div className="flex items-center gap-3 p-4">
            <Search size={20} className="text-mission-control-text-dim flex-shrink-0" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isActionMode ? 'Type a command... (e.g. >create task)' : 'Search or type > for commands...'}
              className="flex-1 bg-transparent outline-none text-lg"
              aria-label="Search commands and content"
              aria-autocomplete="list"
              aria-controls="command-list"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-mission-control-text-dim hover:text-mission-control-text"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
            {query && !isActionMode && (
              <button
                onClick={() => saveSearch(query.trim())}
                className={`text-mission-control-text-dim hover:text-mission-control-accent ${savedSearches.includes(query.trim()) ? 'text-mission-control-accent' : ''}`}
                aria-label="Save search"
                title="Save search"
              >
                <Star size={16} />
              </button>
            )}
            <kbd className="px-2 py-1 text-xs bg-mission-control-border rounded flex-shrink-0" aria-label="Press Escape to close">ESC</kbd>
          </div>

          {/* Filter pills */}
          {!isActionMode && (
            <div className="flex gap-1 px-4 pb-3 overflow-x-auto" role="group" aria-label="Filter by type">
              <Filter size={12} className="text-mission-control-text-dim self-center mr-1 flex-shrink-0" aria-hidden="true" />
              {FILTER_PILLS.map(pill => (
                <button
                  key={pill.key}
                  onClick={() => setActiveFilter(pill.key)}
                  className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap transition-colors ${
                    activeFilter === pill.key
                      ? 'bg-mission-control-accent text-white'
                      : 'bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-surface'
                  }`}
                  aria-pressed={activeFilter === pill.key}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div
          id="command-list"
          className="max-h-80 overflow-y-auto p-2"
          role="listbox"
          aria-label="Search results and commands"
        >

          {/* Empty query: recent items + history chips */}
          {!query && (
            <>
              {recentItems.length > 0 && (
                <div className="mb-3" role="group" aria-labelledby="recent-items-header">
                  <div id="recent-items-header" className="px-3 py-1 text-xs font-medium text-mission-control-text-dim uppercase tracking-wider">
                    Recently Opened
                  </div>
                  {recentItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => { onNavigate(item.nav, item.id); onClose(); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-mission-control-border transition-colors"
                    >
                      <span className="text-mission-control-text-dim" aria-hidden="true">{TYPE_ICONS[item.type]}</span>
                      <span className="flex-1 text-left text-sm truncate">{item.title}</span>
                      <span className="text-xs text-mission-control-text-dim capitalize">{item.type}</span>
                    </button>
                  ))}
                </div>
              )}

              {(searchHistory.length > 0 || savedSearches.length > 0) && (
                <div className="mb-3 px-3">
                  {savedSearches.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider mb-1">Saved Searches</div>
                      <div className="flex flex-wrap gap-1">
                        {savedSearches.map(s => (
                          <div key={s} className="flex items-center gap-0.5 bg-mission-control-border rounded-full pl-2 pr-1 py-0.5">
                            <button
                              onClick={() => setQuery(s)}
                              className="text-xs text-mission-control-text hover:text-mission-control-accent"
                            >
                              {s}
                            </button>
                            <button
                              onClick={() => removeSavedSearch(s)}
                              className="text-mission-control-text-dim hover:text-mission-control-text ml-0.5"
                              aria-label={`Remove saved search "${s}"`}
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchHistory.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider">Recent Searches</div>
                        <button onClick={clearHistory} className="text-xs text-mission-control-text-dim hover:text-mission-control-text">Clear</button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {searchHistory.slice(0, 8).map(h => (
                          <button
                            key={h}
                            onClick={() => setQuery(h)}
                            className="px-2 py-0.5 text-xs bg-mission-control-border rounded-full text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                          >
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Action mode */}
          {isActionMode && (
            <div role="group" aria-labelledby="action-commands-header">
              <div id="action-commands-header" className="px-3 py-1 text-xs font-medium text-mission-control-text-dim uppercase tracking-wider">
                Commands
              </div>
              {filteredActionCommands.length === 0 && (
                <div className="text-center py-6 text-mission-control-text-dim text-sm">
                  No matching commands
                </div>
              )}
              {filteredActionCommands.map((cmd, idx) => (
                <button
                  key={cmd.id}
                  onClick={() => { const parsed = parseActionCommand(query); cmd.action(parsed?.arg); }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    selectedIndex === idx ? 'bg-mission-control-accent text-white' : 'hover:bg-mission-control-border'
                  }`}
                  role="option"
                  aria-selected={selectedIndex === idx}
                >
                  <span className={selectedIndex === idx ? 'text-white' : 'text-mission-control-text-dim'} aria-hidden="true">{cmd.icon}</span>
                  <span className="flex-1 text-left">{cmd.label}</span>
                  <ChevronRight size={14} className="text-mission-control-text-dim" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {/* Remote search results */}
          {!isActionMode && hasSearchResults && (
            <>
              {searchGroups.map(group => (
                <div key={group.type} className="mb-3" role="group" aria-labelledby={`group-${group.type}`}>
                  <div id={`group-${group.type}`} className="px-3 py-1 text-xs font-medium text-mission-control-text-dim uppercase tracking-wider flex items-center gap-2">
                    <span aria-hidden="true">{TYPE_ICONS[group.type]}</span>
                    {group.label} ({group.total})
                  </div>
                  {group.items.map(item => {
                    const currentIndex = flatIndex++;
                    const isSelected = currentIndex === selectedIndex;
                    const isExpanded = expandedItemId === item.id;
                    const inlineActions = getInlineActions(item.type, item.id, item.title);

                    return (
                      <div key={item.id}>
                        <div
                          onClick={() => {
                            trackRecentItem({ id: item.id, title: item.title, type: item.type, nav: item.nav });
                            onNavigate(item.nav, item.id);
                            pushHistory(query.trim());
                            onClose();
                          }}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                            isSelected ? 'bg-mission-control-accent text-white' : 'hover:bg-mission-control-border'
                          }`}
                          role="option"
                          aria-selected={isSelected}
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter') { trackRecentItem({ id: item.id, title: item.title, type: item.type, nav: item.nav }); onNavigate(item.nav, item.id); onClose(); } }}
                        >
                          <span className={isSelected ? 'text-white' : 'text-mission-control-text-dim'} aria-hidden="true">
                            {TYPE_ICONS[item.type]}
                          </span>
                          <span className="flex-1 text-left min-w-0">
                            <span className="block text-sm truncate">{item.title}</span>
                            {item.subtitle && (
                              <span className={`block text-xs truncate ${isSelected ? 'text-white/70' : 'text-mission-control-text-dim'}`}>
                                {item.subtitle}
                              </span>
                            )}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedItemId(isExpanded ? null : item.id); }}
                            className={`flex-shrink-0 px-1.5 py-0.5 text-xs rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-mission-control-border text-mission-control-text-dim'} hover:opacity-80`}
                            aria-expanded={isExpanded}
                            aria-label="Show inline actions"
                            title="Tab for actions"
                          >
                            Tab
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="flex gap-1 px-8 pb-2" role="group" aria-label={`Actions for ${item.title}`}>
                            {inlineActions.map(action => (
                              <button
                                key={action.id}
                                onClick={() => action.run()}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-mission-control-border hover:bg-mission-control-surface rounded transition-colors"
                              >
                                <span aria-hidden="true">{action.icon}</span>
                                {action.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}

          {/* Loading */}
          {searchLoading && (
            <div className="text-center py-6 text-mission-control-text-dim text-sm">
              Searching...
            </div>
          )}

          {/* No results */}
          {showEmpty && (
            <div className="text-center py-8 text-mission-control-text-dim">
              No results for &quot;{query}&quot;
            </div>
          )}

          {/* Regular commands (empty query or command filter) */}
          {showCommands && Object.entries(groupedCommands).map(([category, cmds]) => (
            <div key={category} className="mb-2" role="group" aria-labelledby={`category-${category}`}>
              <div
                id={`category-${category}`}
                className="px-3 py-1 text-xs font-medium text-mission-control-text-dim uppercase tracking-wider"
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
                      isSelected ? 'bg-mission-control-accent text-white' : 'hover:bg-mission-control-border'
                    }`}
                    role="option"
                    aria-selected={isSelected}
                    aria-label={`${cmd.label}${cmd.shortcut ? ` (${cmd.shortcut})` : ''}`}
                  >
                    <span className={isSelected ? 'text-white' : 'text-mission-control-text-dim'} aria-hidden="true">{cmd.icon}</span>
                    <span className="flex-1 text-left">{cmd.label}</span>
                    {cmd.meta && (
                      <span className={`px-2 py-0.5 text-xs rounded ${isSelected ? 'bg-mission-control-text/20' : 'bg-mission-control-border'}`}>
                        {cmd.meta}
                      </span>
                    )}
                    {cmd.shortcut && (
                      <kbd className={`px-2 py-0.5 text-xs rounded ${isSelected ? 'bg-mission-control-text/20' : 'bg-mission-control-border'}`} aria-hidden="true">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-mission-control-border flex items-center justify-between text-xs text-mission-control-text-dim">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><ArrowUp size={10} /><ArrowDown size={10} /> Navigate</span>
            <span className="flex items-center gap-1"><CornerDownLeft size={10} /> Select</span>
            {hasSearchResults && <span>Tab expand actions</span>}
          </div>
          {!isActionMode && <span className="text-mission-control-text-dim/60">Type &gt; for commands</span>}
        </div>
      </div>

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
