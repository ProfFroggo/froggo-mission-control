import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, Calendar, Mail, MessageSquare, Mic, ListTodo, Bot, Settings, Moon, Sun, Zap,
  Inbox, Brain, Database, Plus, FileText, Home, Coffee, Play, Terminal, RefreshCw,
  BookOpen, Library, Bell, LayoutGrid, Clock, FolderOpen, Megaphone, CheckSquare,
  Star, ChevronRight, Command, ArrowUp, ArrowDown, CornerDownLeft, X, Filter,
} from 'lucide-react';
import Fuse from 'fuse.js';
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

// ─── Constants ────────────────────────────────────────────────────────────────

const SEARCH_HISTORY_KEY = 'mission-control.search-history';
const SAVED_SEARCHES_KEY = 'mission-control.saved-searches';
const RECENT_ITEMS_KEY = 'mission-control.recent-items';
const MAX_HISTORY = 20;
const MAX_RECENT = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Command {
  id: string;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  category: string;
  action: () => void;
  meta?: string;
}

interface SearchGroup {
  type: 'tasks' | 'agents' | 'knowledge' | 'library' | 'campaigns' | 'automations';
  label: string;
  icon: React.ReactNode;
  items: SearchResultItem[];
  total: number;
}

interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  type: string;
  raw: Record<string, unknown>;
}

interface RecentItem {
  id: string;
  type: string;
  title: string;
  timestamp: number;
}

type FilterType = 'all' | 'tasks' | 'agents' | 'knowledge' | 'library' | 'campaigns' | 'automations';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable — ignore
  }
}

/** Score a string match: contiguous substring scores higher than scattered chars */
function fuzzyScore(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 1;
  const contiguousIdx = t.indexOf(q);
  if (contiguousIdx === 0) return 0.95;
  if (contiguousIdx > 0) return 0.8;
  // scattered: every char present
  let idx = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, idx);
    if (found === -1) return 0;
    idx = found + 1;
  }
  return 0.5;
}

/** Parse action command prefix ">" from query */
function parseActionCommand(query: string): { isAction: boolean; cmd: string } {
  const trimmed = query.trimStart();
  if (trimmed.startsWith('>')) {
    return { isAction: true, cmd: trimmed.slice(1).trimStart() };
  }
  return { isAction: false, cmd: query };
}

// ─── Action commands list ─────────────────────────────────────────────────────

const ACTION_COMMANDS = [
  { id: 'act-create-task',   label: '>create task',       hint: 'Open new task dialog',     nav: 'kanban',      event: 'new-task' },
  { id: 'act-new-campaign',  label: '>new campaign',      hint: 'Open campaign creator',    nav: 'campaigns',   event: 'new-campaign' },
  { id: 'act-run-auto',      label: '>run automation',    hint: 'Trigger an automation',    nav: 'automations', event: null },
  { id: 'act-navigate',      label: '>navigate',          hint: 'Jump to a panel',          nav: null,          event: null },
  { id: 'act-hire-agent',    label: '>hire agent',        hint: 'Open agent hire wizard',   nav: 'agents',      event: 'hire-agent' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CommandPalette({ isOpen, onClose, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchGroups, setSearchGroups] = useState<SearchGroup[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<string[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [inlineActions, setInlineActions] = useState<{ itemId: string; type: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const { addActivity, connected } = useStore();
  const tasks = useStore(s => s.tasks);
  const agents = useStore(s => s.agents);
  const dialogRef = useFocusTrap(isOpen);
  const announce = useAnnounce();
  const { setFocusMode } = useFocusMode();
  const promptDialog = usePromptDialog();

  // Load persisted state on mount
  useEffect(() => {
    setSearchHistory(loadFromStorage<string[]>(SEARCH_HISTORY_KEY, []));
    setSavedSearches(loadFromStorage<string[]>(SAVED_SEARCHES_KEY, []));
    setRecentItems(loadFromStorage<RecentItem[]>(RECENT_ITEMS_KEY, []));
  }, []);

  // Reset state when palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setActiveFilter('all');
      setSearchGroups([]);
      setInlineActions(null);
      setTimeout(() => inputRef.current?.focus(), 50);
      announce('Command palette opened');
    }
  }, [isOpen, announce]);

  // ── Prompts ──────────────────────────────────────────────────────────────

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

  // ── History & saved searches ─────────────────────────────────────────────

  const pushHistory = useCallback((q: string) => {
    if (!q.trim() || q.length < 2) return;
    setSearchHistory(prev => {
      const updated = [q, ...prev.filter(h => h !== q)].slice(0, MAX_HISTORY);
      saveToStorage(SEARCH_HISTORY_KEY, updated);
      return updated;
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
      const updated = [q, ...prev];
      saveToStorage(SAVED_SEARCHES_KEY, updated);
      return updated;
    });
    showToast('success', 'Search saved', q);
  }, []);

  const removeSavedSearch = useCallback((q: string) => {
    setSavedSearches(prev => {
      const updated = prev.filter(s => s !== q);
      saveToStorage(SAVED_SEARCHES_KEY, updated);
      return updated;
    });
  }, []);

  const trackRecentItem = useCallback((item: RecentItem) => {
    setRecentItems(prev => {
      const updated = [item, ...prev.filter(r => r.id !== item.id)].slice(0, MAX_RECENT);
      saveToStorage(RECENT_ITEMS_KEY, updated);
      return updated;
    });
  }, []);

  // ── Commands definition ───────────────────────────────────────────────────

  const commands: Command[] = useMemo(() => [
    // Navigation
    { id: 'nav-inbox',         icon: <Mail size={16} />,         label: 'Go to Inbox',          shortcut: '⌘1', category: 'Navigation', action: () => { onNavigate('inbox');         onClose(); } },
    { id: 'nav-dashboard',     icon: <Home size={16} />,         label: 'Go to Dashboard',      shortcut: '⌘2', category: 'Navigation', action: () => { onNavigate('dashboard');     onClose(); } },
    { id: 'nav-analytics',     icon: <Zap size={16} />,          label: 'Go to Analytics',      shortcut: '⌘3', category: 'Navigation', action: () => { onNavigate('analytics');     onClose(); } },
    { id: 'nav-tasks',         icon: <ListTodo size={16} />,     label: 'Go to Tasks',          shortcut: '⌘4', category: 'Navigation', action: () => { onNavigate('kanban');        onClose(); } },
    { id: 'nav-agents',        icon: <Bot size={16} />,          label: 'Go to Agents',         shortcut: '⌘5', category: 'Navigation', action: () => { onNavigate('agents');        onClose(); } },
    { id: 'nav-twitter',       icon: <XIcon size={16} />,        label: 'Go to Social Media',   shortcut: '⌘6', category: 'Navigation', action: () => { onNavigate('twitter');       onClose(); } },
    { id: 'nav-meetings',      icon: <Mic size={16} />,          label: 'Go to Meetings',       shortcut: '⌘7', category: 'Navigation', action: () => { onNavigate('meetings');      onClose(); } },
    { id: 'nav-voicechat',     icon: <Mic size={16} />,          label: 'Go to Voice Chat',     shortcut: '⌘8', category: 'Navigation', action: () => { onNavigate('voicechat');     onClose(); } },
    { id: 'nav-chat',          icon: <MessageSquare size={16} />, label: 'Go to Chat',          shortcut: '',   category: 'Navigation', action: () => { onNavigate('chat');          onClose(); } },
    { id: 'nav-accounts',      icon: <Settings size={16} />,     label: 'Go to Accounts',       shortcut: '⌘9', category: 'Navigation', action: () => { onNavigate('accounts');      onClose(); } },
    { id: 'nav-approvals',     icon: <Inbox size={16} />,        label: 'Go to Approvals',      shortcut: '⌘0', category: 'Navigation', action: () => { onNavigate('approvals');     onClose(); } },
    { id: 'nav-projects',      icon: <FolderOpen size={16} />,   label: 'Go to Projects',                       category: 'Navigation', action: () => { onNavigate('projects');      onClose(); } },
    { id: 'nav-campaigns',     icon: <Megaphone size={16} />,    label: 'Go to Campaigns',                      category: 'Navigation', action: () => { onNavigate('campaigns');     onClose(); } },
    { id: 'nav-knowledge',     icon: <BookOpen size={16} />,     label: 'Go to Knowledge',                      category: 'Navigation', action: () => { onNavigate('knowledge');     onClose(); } },
    { id: 'nav-library',       icon: <Library size={16} />,      label: 'Go to Library',                        category: 'Navigation', action: () => { onNavigate('library');       onClose(); } },
    { id: 'nav-schedule',      icon: <Clock size={16} />,        label: 'Go to Schedule',                       category: 'Navigation', action: () => { onNavigate('schedule');      onClose(); } },
    { id: 'nav-notifications', icon: <Bell size={16} />,         label: 'Go to Notifications',                  category: 'Navigation', action: () => { onNavigate('notifications'); onClose(); } },
    { id: 'nav-modules',       icon: <LayoutGrid size={16} />,   label: 'Go to Modules',                        category: 'Navigation', action: () => { onNavigate('modules');       onClose(); } },

    // Create
    { id: 'create-task',     icon: <Plus size={16} />, label: 'Create new task',     category: 'Create', action: () => { window.dispatchEvent(new CustomEvent('new-task'));     onClose(); } },
    { id: 'create-project',  icon: <Plus size={16} />, label: 'Create new project',  category: 'Create', action: () => { onNavigate('projects');  onClose(); setTimeout(() => window.dispatchEvent(new CustomEvent('new-project')),  100); } },
    { id: 'create-campaign', icon: <Plus size={16} />, label: 'Create new campaign', category: 'Create', action: () => { onNavigate('campaigns'); onClose(); setTimeout(() => window.dispatchEvent(new CustomEvent('new-campaign')), 100); } },

    // Quick Actions
    { id: 'action-calendar', icon: <Calendar size={16} />,      label: "Check Calendar Today",       category: 'Actions', action: async () => { if (connected) { await gateway.sendChat("What's on my calendar today?"); addActivity({ type: 'chat', message: 'Checking calendar...', timestamp: Date.now() }); onNavigate('chat'); } onClose(); } },
    { id: 'action-email',    icon: <Mail size={16} />,           label: 'Check Unread Emails',        category: 'Actions', action: async () => { if (connected) { await gateway.sendChat("Check my unread emails and summarize the important ones"); addActivity({ type: 'chat', message: 'Checking emails...', timestamp: Date.now() }); onNavigate('chat'); } onClose(); } },
    { id: 'action-messages', icon: <MessageSquare size={16} />, label: 'Check Messages (WA/TG)',     category: 'Actions', action: async () => { if (connected) { await gateway.sendChat("Check WhatsApp and Telegram for any important messages"); addActivity({ type: 'chat', message: 'Checking messages...', timestamp: Date.now() }); onNavigate('chat'); } onClose(); } },
    { id: 'action-twitter',  icon: <XIcon size={16} />,          label: 'Check X Mentions',           category: 'Actions', action: async () => { if (connected) { await gateway.sendChat("Check @Prof_Frogo mentions on X and draft replies"); addActivity({ type: 'chat', message: 'Checking X mentions...', timestamp: Date.now() }); onNavigate('chat'); } onClose(); } },

    // Memory
    { id: 'memory-search', icon: <Brain size={16} />,    label: 'Search Memory (mission-control-db)', category: 'Memory', action: async () => { withPrompt({ title: 'Search Memory', message: 'Enter search query:', placeholder: 'Search for...' }, async (searchQuery) => { await fetch('/api/chat/sessions/web:dashboard/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'user', content: `Search memory for: ${searchQuery}` }) }).catch(() => {}); addActivity({ type: 'chat', message: `Memory search: ${searchQuery}`, timestamp: Date.now() }); onNavigate('chat'); onClose(); }); } },
    { id: 'memory-fact',   icon: <Database size={16} />, label: 'Add Fact to Memory',                 category: 'Memory', action: async () => { withPrompt2({ title: 'Add Fact', message: 'Enter fact:', placeholder: 'Fact to remember...' }, { title: 'Category', message: 'Enter category:', placeholder: 'learning' }, async (fact, category) => { await fetch('/api/chat/sessions/web:dashboard/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'user', content: `Remember this fact (category: ${category}): ${fact}` }) }).catch(() => {}); addActivity({ type: 'system', message: `Added fact: ${fact.slice(0, 30)}...`, timestamp: Date.now() }); onClose(); }); } },

    // Settings
    { id: 'settings', icon: <Settings size={16} />, label: 'Open Settings', category: 'Settings', action: () => { onNavigate('settings'); onClose(); } },

    // Quick
    { id: 'quick-tweet', icon: <XIcon size={16} />,        label: 'Draft a Post',           shortcut: undefined, category: 'Quick', action: async () => { withPrompt({ title: 'Draft Tweet', message: 'Enter tweet content:', placeholder: "What's happening?" }, async (tweet) => { if (connected) { await gateway.sendChat(`Draft this tweet for approval: "${tweet}"`); showToast('info', 'Tweet drafted', 'Check inbox for approval'); onNavigate('chat'); } onClose(); }); } },
    { id: 'quick-task', icon: <Plus size={16} />,           label: 'Create Task',            shortcut: '⌘N',      category: 'Quick', action: async () => { withPrompt({ title: 'Create Task', message: 'Enter task title:', placeholder: 'Task title...' }, async (title) => { await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: `task-${Date.now()}`, title, status: 'todo', project: 'General' }) }); showToast('success', 'Task created', title); onClose(); }); } },
    { id: 'quick-note', icon: <FileText size={16} />,       label: 'Quick Note to Memory',   shortcut: undefined, category: 'Quick', action: async () => { withPrompt({ title: 'Quick Note', message: 'Enter note:', placeholder: 'Note...', multiline: true }, async (note) => { if (connected) { await gateway.sendChat(`Add to today's memory log: ${note}`); showToast('success', 'Note saved'); } onClose(); }); } },

    // Focus
    { id: 'focus-work',   icon: <Coffee size={16} />, label: 'Work Mode',             category: 'Focus', action: () => { setFocusMode('work');   showToast('info', 'Work Mode',   'Focus on work tasks');           onClose(); } },
    { id: 'focus-family', icon: <Home size={16} />,   label: 'Family Time',           category: 'Focus', action: () => { setFocusMode('family'); showToast('info', 'Family Time', 'Only urgent notifications');     onClose(); } },
    { id: 'focus-dnd',    icon: <Moon size={16} />,   label: 'Do Not Disturb',        category: 'Focus', action: () => { setFocusMode('dnd');    showToast('info', 'DND Active',  'All notifications muted');       onClose(); } },
    { id: 'focus-off',    icon: <Sun size={16} />,    label: 'Turn Off Focus Mode',   category: 'Focus', action: () => { setFocusMode(null);     showToast('info', 'Focus Mode Off');                               onClose(); } },

    // System
    { id: 'sys-refresh', icon: <RefreshCw size={16} />, label: 'Refresh Data',        category: 'System', action: () => { window.location.reload(); } },
    { id: 'sys-shell',   icon: <Terminal size={16} />,  label: 'Run Shell Command',   category: 'System', action: async () => { withPrompt({ title: 'Run Shell Command', message: 'Enter command:', placeholder: 'ls -la' }, async (cmd) => { if (connected) { await gateway.sendChat(`Run: ${cmd}`); onNavigate('chat'); } onClose(); }); } },
    { id: 'sys-spawn',   icon: <Play size={16} />,      label: 'Spawn Agent Task',    category: 'System', action: async () => { withPrompt2({ title: 'Spawn Agent', message: 'Task description:', placeholder: 'What should the agent do?' }, { title: 'Agent Type', message: 'Agent name:', placeholder: 'coder' }, async (task, agent) => { if (connected) { await gateway.sendChat(`Spawn ${agent} agent to: ${task}`); showToast('info', 'Agent spawning', task.slice(0, 30) + '...'); onNavigate('chat'); } onClose(); }); } },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [connected, addActivity, withPrompt, withPrompt2, onNavigate, onClose, setFocusMode]);

  // ── Recent items for empty state ──────────────────────────────────────────

  const recentItemCommands: Command[] = useMemo(() => {
    if (query) return [];
    return recentItems.map(item => ({
      id: `recent-${item.id}`,
      icon: item.type === 'task' ? <CheckSquare size={16} /> : item.type === 'agent' ? <Bot size={16} /> : <FileText size={16} />,
      label: item.title,
      category: 'Recent',
      action: () => {
        if (item.type === 'task') onNavigate('kanban');
        else if (item.type === 'agent') onNavigate('agents');
        else if (item.type === 'knowledge') onNavigate('knowledge');
        onClose();
      },
    }));
  }, [query, recentItems, onNavigate, onClose]);

  // Recent tasks from store (empty query fallback)
  const recentTaskCommands: Command[] = useMemo(() => {
    if (query) return [];
    if (recentItems.length > 0) return []; // prefer tracked recent items
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
  }, [query, tasks, recentItems.length, onNavigate, onClose]);

  // Active agents (empty query)
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

  // Task search via Fuse (local store)
  const taskSearchCommands: Command[] = useMemo(() => {
    if (!query || tasks.length === 0) return [];
    const fuse = new Fuse(tasks, { keys: ['title', 'description'], threshold: 0.4 });
    return fuse.search(query).slice(0, 5).map(({ item }) => ({
      id: `task-${item.id}`,
      icon: <CheckSquare size={16} />,
      label: item.title,
      category: 'Tasks',
      meta: item.status,
      action: () => {
        trackRecentItem({ id: item.id, type: 'task', title: item.title, timestamp: Date.now() });
        onNavigate('kanban');
        onClose();
      },
    }));
  }, [query, tasks, onNavigate, onClose, trackRecentItem]);

  // ── Action mode (">") ────────────────────────────────────────────────────

  const { isAction, cmd: actionCmd } = useMemo(() => parseActionCommand(query), [query]);

  const filteredActionCommands: Command[] = useMemo(() => {
    if (!isAction) return [];
    const q = actionCmd.toLowerCase();
    return ACTION_COMMANDS
      .filter(a => !q || a.label.toLowerCase().includes(q) || a.hint.toLowerCase().includes(q))
      .map(a => ({
        id: a.id,
        icon: <Command size={16} />,
        label: a.label,
        category: 'Actions',
        meta: a.hint,
        action: () => {
          if (a.nav) { onNavigate(a.nav); }
          if (a.event) { window.dispatchEvent(new CustomEvent(a.event)); }
          onClose();
        },
      }));
  }, [isAction, actionCmd, onNavigate, onClose]);

  // ── Remote search (API) ───────────────────────────────────────────────────

  useEffect(() => {
    if (!query || query.length < 2 || isAction) {
      setSearchGroups([]);
      return;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const typesParam = activeFilter !== 'all' ? `&types=${activeFilter}` : '';
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=5&offset=0${typesParam}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error('Search failed');

        const data = await res.json() as Record<string, { items: Record<string, unknown>[]; total: number }>;

        const typeConfig: { key: string; label: string; icon: React.ReactNode; nav: string; titleField: string; subtitleField?: string }[] = [
          { key: 'tasks',       label: 'Tasks',       icon: <CheckSquare size={14} />, nav: 'kanban',      titleField: 'title',       subtitleField: 'status' },
          { key: 'agents',      label: 'Agents',      icon: <Bot size={14} />,         nav: 'agents',      titleField: 'name',        subtitleField: 'role' },
          { key: 'knowledge',   label: 'Knowledge',   icon: <BookOpen size={14} />,    nav: 'knowledge',   titleField: 'title',       subtitleField: 'category' },
          { key: 'library',     label: 'Library',     icon: <Library size={14} />,     nav: 'library',     titleField: 'name',        subtitleField: 'category' },
          { key: 'campaigns',   label: 'Campaigns',   icon: <Megaphone size={14} />,   nav: 'campaigns',   titleField: 'name',        subtitleField: 'status' },
          { key: 'automations', label: 'Automations', icon: <Zap size={14} />,         nav: 'automations', titleField: 'name',        subtitleField: 'status' },
        ];

        const groups: SearchGroup[] = [];
        for (const cfg of typeConfig) {
          const group = data[cfg.key];
          if (!group || group.total === 0) continue;

          // Score & sort items by fuzzy match quality
          const scoredItems = group.items.map(item => {
            const titleVal = String(item[cfg.titleField] ?? '');
            return { item, score: fuzzyScore(titleVal, query) };
          }).sort((a, b) => b.score - a.score);

          groups.push({
            type: cfg.key as SearchGroup['type'],
            label: cfg.label,
            icon: cfg.icon,
            total: group.total,
            items: scoredItems.map(({ item }) => ({
              id: String(item.id ?? ''),
              title: String(item[cfg.titleField] ?? ''),
              subtitle: cfg.subtitleField ? String(item[cfg.subtitleField] ?? '') : undefined,
              type: cfg.key,
              raw: item,
            })),
          });
        }

        setSearchGroups(groups);
        announce(`${groups.reduce((n, g) => n + g.items.length, 0)} results found`);
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') {
          setSearchGroups([]);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, activeFilter, isAction, announce]);

  // ── Flat list of all items for keyboard nav ───────────────────────────────

  const flatItems = useMemo(() => {
    if (isAction) return filteredActionCommands;

    if (!query) {
      const base = [...recentItemCommands, ...recentTaskCommands, ...activeAgentCommands];
      const filtered = activeFilter === 'all' ? base : base.filter(c =>
        c.category.toLowerCase() === activeFilter.replace('s', '') ||
        c.category.toLowerCase() === activeFilter
      );
      return filtered;
    }

    // Build flat list from search groups + local task results
    const fromGroups: Command[] = [];
    for (const group of searchGroups) {
      for (const item of group.items) {
        const nav = (() => {
          switch (group.type) {
            case 'tasks':       return 'kanban';
            case 'agents':      return 'agents';
            case 'knowledge':   return 'knowledge';
            case 'library':     return 'library';
            case 'campaigns':   return 'campaigns';
            case 'automations': return 'automations';
          }
        })();
        fromGroups.push({
          id: `group-${group.type}-${item.id}`,
          icon: group.icon,
          label: item.title,
          category: group.label,
          meta: item.subtitle,
          action: () => {
            trackRecentItem({ id: item.id, type: group.type, title: item.title, timestamp: Date.now() });
            pushHistory(query);
            onNavigate(nav);
            onClose();
          },
        });
      }
    }

    // Combine with local command search
    const localMatches = commands.filter(cmd =>
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.category.toLowerCase().includes(query.toLowerCase())
    );

    const combined = [...fromGroups, ...taskSearchCommands, ...localMatches];

    if (activeFilter === 'all') return combined;
    return combined.filter(c => c.category.toLowerCase() === activeFilter || c.category.toLowerCase() === activeFilter.replace(/s$/, ''));
  }, [
    isAction, filteredActionCommands,
    query, activeFilter,
    recentItemCommands, recentTaskCommands, activeAgentCommands,
    searchGroups, taskSearchCommands, commands,
    onNavigate, onClose, pushHistory, trackRecentItem,
  ]);

  // Reset selection when list changes
  useEffect(() => { setSelectedIndex(0); }, [flatItems.length, query]);

  // ── Keyboard nav ──────────────────────────────────────────────────────────

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatItems[selectedIndex]) {
      e.preventDefault();
      flatItems[selectedIndex].action();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Tab expands inline actions for selected search result
      const item = flatItems[selectedIndex];
      if (item && item.id.startsWith('group-')) {
        const parts = item.id.split('-');
        const type = parts[1];
        const id = parts.slice(2).join('-');
        setInlineActions(prev => prev?.itemId === id ? null : { itemId: id, type });
      }
    } else if (e.key === 'Escape') {
      if (inlineActions) {
        setInlineActions(null);
      } else {
        onClose();
      }
    }
  }, [flatItems, selectedIndex, inlineActions, onClose]);

  // ── Inline actions ────────────────────────────────────────────────────────

  function getInlineActions(type: string, itemId: string): { label: string; icon: React.ReactNode; action: () => void }[] {
    switch (type) {
      case 'tasks':
        return [
          { label: 'Open',       icon: <ChevronRight size={14} />, action: () => { onNavigate('kanban');    onClose(); } },
          { label: 'Mark Done',  icon: <CheckSquare size={14} />,  action: async () => { await fetch(`/api/tasks/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'done' }) }).catch(() => {}); showToast('success', 'Task marked done'); onClose(); } },
          { label: 'Assign Agent', icon: <Bot size={14} />,        action: () => { onNavigate('kanban'); onClose(); } },
        ];
      case 'agents':
        return [
          { label: 'Chat',         icon: <MessageSquare size={14} />, action: () => { onNavigate('chat');   onClose(); } },
          { label: 'Assign Task',  icon: <CheckSquare size={14} />,   action: () => { onNavigate('kanban'); onClose(); } },
          { label: 'View Profile', icon: <ChevronRight size={14} />,  action: () => { onNavigate('agents'); onClose(); } },
        ];
      case 'knowledge':
        return [
          { label: 'Open',      icon: <ChevronRight size={14} />, action: () => { onNavigate('knowledge'); onClose(); } },
          { label: 'Edit',      icon: <FileText size={14} />,     action: () => { onNavigate('knowledge'); onClose(); } },
          { label: 'Copy Link', icon: <Star size={14} />,         action: () => { navigator.clipboard.writeText(`/knowledge/${itemId}`).catch(() => {}); showToast('success', 'Link copied'); } },
        ];
      default:
        return [
          { label: 'Open', icon: <ChevronRight size={14} />, action: () => { onClose(); } },
        ];
    }
  }

  if (!isOpen) return null;

  // ── Grouped view for search results display ───────────────────────────────

  const showGrouped = !!query && searchGroups.length > 0 && !isAction;
  const showEmpty = !searchLoading && !!query && query.length >= 2 && !isAction && flatItems.length === 0;

  // Build category groups for command list
  const commandGroups = useMemo(() => {
    if (showGrouped) return null; // use searchGroups instead
    return flatItems.reduce((acc, cmd) => {
      if (!acc[cmd.category]) acc[cmd.category] = [];
      acc[cmd.category].push(cmd);
      return acc;
    }, {} as Record<string, Command[]>);
  }, [showGrouped, flatItems]);

  let globalFlatIndex = 0;

  // Filter pills
  const filterPills: { key: FilterType; label: string }[] = [
    { key: 'all',         label: 'All' },
    { key: 'tasks',       label: 'Tasks' },
    { key: 'agents',      label: 'Agents' },
    { key: 'knowledge',   label: 'Knowledge' },
    { key: 'library',     label: 'Library' },
    { key: 'campaigns',   label: 'Campaigns' },
    { key: 'automations', label: 'Automations' },
  ];

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
        className="relative w-full max-w-xl glass-modal rounded-2xl shadow-2xl overflow-hidden"
      >
        <h2 id="command-palette-title" className="sr-only">Command Palette</h2>

        {/* ── Search Input ── */}
        <div className="flex items-center gap-3 p-4 border-b border-mission-control-border">
          {isAction
            ? <Command size={20} className="text-mission-control-accent flex-shrink-0" aria-hidden="true" />
            : <Search size={20} className="text-mission-control-text-dim flex-shrink-0" aria-hidden="true" />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isAction ? 'Type a command...' : 'Search or type > for commands...'}
            className="flex-1 bg-transparent outline-none text-lg"
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-controls="command-list"
            aria-activedescendant={flatItems[selectedIndex]?.id}
          />
          {searchLoading && (
            <div className="w-4 h-4 border-2 border-mission-control-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
          {query && !searchLoading && (
            <button
              onClick={() => saveSearch(query)}
              className="p-1 hover:text-mission-control-accent text-mission-control-text-dim transition-colors"
              title="Save this search"
              aria-label="Save search"
            >
              <Star size={16} />
            </button>
          )}
          <kbd className="px-2 py-1 text-xs bg-mission-control-border rounded flex-shrink-0" aria-label="Press Escape to close">ESC</kbd>
        </div>

        {/* ── Filter Pills (shown when there are search groups or a query) ── */}
        {(query.length >= 2 && !isAction) && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-mission-control-border overflow-x-auto scrollbar-none">
            <Filter size={13} className="text-mission-control-text-dim flex-shrink-0" aria-hidden="true" />
            {filterPills.map(pill => (
              <button
                key={pill.key}
                onClick={() => setActiveFilter(pill.key)}
                className={`px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors flex-shrink-0 ${
                  activeFilter === pill.key
                    ? 'bg-mission-control-accent text-white font-medium'
                    : 'bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-border/70'
                }`}
              >
                {pill.label}
                {pill.key !== 'all' && searchGroups.find(g => g.type === pill.key)?.total
                  ? ` (${searchGroups.find(g => g.type === pill.key)!.total})`
                  : ''}
              </button>
            ))}
          </div>
        )}

        {/* ── Commands / Results List ── */}
        <div
          id="command-list"
          className="max-h-96 overflow-y-auto p-2"
          role="listbox"
          aria-label="Available commands"
        >
          {/* Empty query: history + recent items */}
          {!query && (
            <>
              {/* Search history chips */}
              {searchHistory.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center justify-between px-3 py-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-mission-control-text-dim uppercase tracking-wider">
                      <Clock size={12} aria-hidden="true" />
                      <span>Recent Searches</span>
                    </div>
                    <button
                      onClick={clearHistory}
                      className="text-xs text-mission-control-text-dim hover:text-mission-control-accent transition-colors flex items-center gap-1"
                    >
                      <X size={12} /> Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-3 py-1">
                    {searchHistory.slice(0, 8).map(h => (
                      <button
                        key={h}
                        onClick={() => setQuery(h)}
                        className="px-2.5 py-1 text-xs bg-mission-control-border hover:bg-mission-control-border/70 rounded-full text-mission-control-text-dim transition-colors"
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Saved searches */}
              {savedSearches.length > 0 && (
                <div className="mb-3">
                  <div className="px-3 py-1 text-xs font-medium text-mission-control-text-dim uppercase tracking-wider flex items-center gap-1.5">
                    <Star size={12} aria-hidden="true" />
                    <span>Saved Searches</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-3 py-1">
                    {savedSearches.map(s => (
                      <div key={s} className="flex items-center gap-0.5">
                        <button
                          onClick={() => setQuery(s)}
                          className="px-2.5 py-1 text-xs bg-mission-control-accent/10 hover:bg-mission-control-accent/20 rounded-l-full text-mission-control-accent transition-colors"
                        >
                          {s}
                        </button>
                        <button
                          onClick={() => removeSavedSearch(s)}
                          className="px-1.5 py-1 text-xs bg-mission-control-accent/10 hover:bg-red-500/20 rounded-r-full text-mission-control-accent hover:text-red-400 transition-colors"
                          aria-label={`Remove saved search: ${s}`}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Action commands mode (">") */}
          {isAction && (
            <div className="mb-2" role="group" aria-label="Action commands">
              <div className="px-3 py-1 text-xs font-medium text-mission-control-text-dim uppercase tracking-wider flex items-center gap-1.5">
                <Command size={12} aria-hidden="true" />
                <span>Commands</span>
              </div>
              {filteredActionCommands.map((cmd, i) => {
                const isSelected = i === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    id={cmd.id}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      isSelected ? 'bg-mission-control-accent text-white' : 'hover:bg-mission-control-border'
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className={isSelected ? 'text-white' : 'text-mission-control-text-dim'} aria-hidden="true">{cmd.icon}</span>
                    <span className="flex-1 text-left font-mono text-sm">{cmd.label}</span>
                    {cmd.meta && (
                      <span className={`text-xs ${isSelected ? 'text-white/70' : 'text-mission-control-text-dim'}`}>{cmd.meta}</span>
                    )}
                  </button>
                );
              })}
              {filteredActionCommands.length === 0 && (
                <p className="px-3 py-2 text-sm text-mission-control-text-dim">No matching commands</p>
              )}
            </div>
          )}

          {/* Grouped search results */}
          {showGrouped && searchGroups.map(group => {
            const visibleGroup = activeFilter === 'all' || activeFilter === group.type;
            if (!visibleGroup) return null;

            return (
              <div key={group.type} className="mb-3" role="group" aria-labelledby={`group-header-${group.type}`}>
                <div
                  id={`group-header-${group.type}`}
                  className="px-3 py-1 text-xs font-medium text-mission-control-text-dim uppercase tracking-wider flex items-center gap-1.5"
                >
                  <span aria-hidden="true">{group.icon}</span>
                  <span>{group.label}</span>
                  <span className="ml-auto normal-case text-mission-control-text-dim/60">
                    {group.total > group.items.length ? `${group.items.length} of ${group.total}` : group.total}
                  </span>
                </div>

                {group.items.map(item => {
                  const cmdId = `group-${group.type}-${item.id}`;
                  const cmdIndex = flatItems.findIndex(f => f.id === cmdId);
                  const isSelected = cmdIndex === selectedIndex;
                  const showItemActions = inlineActions?.itemId === item.id;

                  return (
                    <div key={item.id}>
                      <button
                        id={cmdId}
                        onClick={() => {
                          trackRecentItem({ id: item.id, type: group.type, title: item.title, timestamp: Date.now() });
                          pushHistory(query);
                          const nav = group.type === 'tasks' ? 'kanban' : group.type === 'agents' ? 'agents' : group.type;
                          onNavigate(nav);
                          onClose();
                        }}
                        onMouseEnter={() => cmdIndex >= 0 && setSelectedIndex(cmdIndex)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                          isSelected ? 'bg-mission-control-accent/10 border-l-2 border-mission-control-accent pl-2.5' : 'hover:bg-mission-control-border border-l-2 border-transparent pl-2.5'
                        }`}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <span className={`flex-shrink-0 ${isSelected ? 'text-mission-control-accent' : 'text-mission-control-text-dim'}`} aria-hidden="true">
                          {group.icon}
                        </span>
                        <span className="flex-1 text-left text-sm truncate">{item.title}</span>
                        {item.subtitle && (
                          <span className="text-xs text-mission-control-text-dim flex-shrink-0 mr-1">{item.subtitle}</span>
                        )}
                        {isSelected && (
                          <span className="text-xs text-mission-control-text-dim flex-shrink-0">
                            <kbd className="px-1 py-0.5 bg-mission-control-border rounded text-xs">Tab</kbd> actions
                          </span>
                        )}
                      </button>

                      {/* Inline actions panel */}
                      {showItemActions && (
                        <div className="ml-8 mb-1 flex gap-1 flex-wrap">
                          {getInlineActions(group.type, item.id).map(action => (
                            <button
                              key={action.label}
                              onClick={(e) => { e.stopPropagation(); action.action(); }}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-mission-control-border hover:bg-mission-control-accent hover:text-white rounded-lg transition-colors"
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
            );
          })}

          {/* Command groups (non-search state) */}
          {!showGrouped && !isAction && commandGroups && Object.entries(commandGroups).map(([category, cmds]) => (
            <div key={category} className="mb-2" role="group" aria-labelledby={`category-${category}`}>
              <div
                id={`category-${category}`}
                className="px-3 py-1 text-xs font-medium text-mission-control-text-dim uppercase tracking-wider"
              >
                {category}
              </div>
              {cmds.map((cmd) => {
                const currentIndex = globalFlatIndex++;
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
                      <span className={`px-2 py-0.5 text-xs rounded ${isSelected ? 'bg-white/20' : 'bg-mission-control-border'}`}>
                        {cmd.meta}
                      </span>
                    )}
                    {cmd.shortcut && (
                      <kbd className={`px-2 py-0.5 text-xs rounded ${isSelected ? 'bg-white/20' : 'bg-mission-control-border'}`} aria-hidden="true">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {/* No results */}
          {showEmpty && (
            <div className="text-center py-8 text-mission-control-text-dim">
              <Search size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No results for &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {/* Empty state: no query, no recent items, no history */}
          {!query && recentItemCommands.length === 0 && recentTaskCommands.length === 0 && activeAgentCommands.length === 0 && searchHistory.length === 0 && savedSearches.length === 0 && (
            <div className="text-center py-6 text-mission-control-text-dim">
              <Command size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Type to search or use <kbd className="px-1 py-0.5 bg-mission-control-border rounded text-xs">&gt;</kbd> for commands</p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="p-2 border-t border-mission-control-border flex items-center justify-between text-xs text-mission-control-text-dim">
          <div className="flex gap-3">
            <span className="flex items-center gap-1"><ArrowUp size={12} /><ArrowDown size={12} /> Navigate</span>
            <span className="flex items-center gap-1"><CornerDownLeft size={12} /> Select</span>
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-mission-control-border rounded">Tab</kbd> Actions</span>
          </div>
          <div className="flex items-center gap-2">
            {query && <span className="text-mission-control-text-dim/60">&gt; for commands</span>}
            <span>⌘K</span>
          </div>
        </div>
      </div>

      {/* Prompt Dialog */}
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
