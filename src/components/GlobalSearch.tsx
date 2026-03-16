import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Mail, MessageSquare, CheckSquare, Brain, Calendar, Filter, Clock, ChevronRight, Hash, User, Zap, Compass } from 'lucide-react';
import Fuse from 'fuse.js';
import { SkeletonList } from './Skeleton';
import { gateway } from '../lib/gateway';
import { sanitizeSearchSnippet } from '../utils/sanitize';

// X logo component
const XIcon = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const PANEL_NAV = [
  { id: 'dashboard',     label: 'Dashboard',     keywords: ['dashboard', 'home', 'overview'] },
  { id: 'projects',      label: 'Projects',       keywords: ['projects', 'project'] },
  { id: 'kanban',        label: 'Kanban',         keywords: ['kanban', 'board', 'tasks'] },
  { id: 'chat',          label: 'Chat',           keywords: ['chat', 'messages', 'rooms'] },
  { id: 'approvals',     label: 'Approvals',      keywords: ['approvals', 'approve', 'inbox'] },
  { id: 'schedule',      label: 'Schedule',       keywords: ['schedule', 'calendar', 'posts'] },
  { id: 'library',       label: 'Library',        keywords: ['library', 'files', 'documents'] },
  { id: 'knowledge',     label: 'Knowledge',      keywords: ['knowledge', 'wiki', 'base'] },
  { id: 'campaigns',     label: 'Campaigns',      keywords: ['campaigns', 'campaign', 'marketing'] },
  { id: 'agents',        label: 'Agents',         keywords: ['agents', 'agent', 'ai'] },
  { id: 'automations',   label: 'Automations',    keywords: ['automations', 'automation', 'workflows'] },
  { id: 'twitter',       label: 'Social Media',   keywords: ['social', 'twitter', 'x', 'posts'] },
  { id: 'notifications', label: 'Notifications',  keywords: ['notifications', 'alerts'] },
  { id: 'settings',      label: 'Settings',       keywords: ['settings', 'preferences', 'config'] },
];

interface SearchResult {
  id: string;
  type: 'task' | 'fact' | 'message' | 'email' | 'session' | 'calendar' | 'tweet' | 'agent' | 'automation';
  title: string;
  snippet: string;
  timestamp?: string;
  source?: string;
  status?: string;
  metadata?: any;
  score?: number;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (view: string, id?: string) => void;
}

type FilterType = 'all' | 'task' | 'fact' | 'message' | 'email' | 'session' | 'calendar' | 'tweet' | 'agent' | 'automation';
type DateFilter = 'all' | 'today' | 'week' | 'month';
type StatusFilter = 'all' | 'todo' | 'internal-review' | 'in-progress' | 'review' | 'human-review' | 'done';

const typeIcons = {
  task: CheckSquare,
  fact: Brain,
  message: MessageSquare,
  email: Mail,
  session: MessageSquare,
  calendar: Calendar,
  tweet: XIcon,
  agent: User,
  automation: Zap,
};

const typeColors = {
  task: 'text-info bg-info-subtle',
  fact: 'text-review bg-review-subtle',
  message: 'text-success bg-success-subtle',
  email: 'text-warning bg-warning-subtle',
  session: 'text-cyan-400 bg-cyan-500/10',
  calendar: 'text-warning bg-warning-subtle',
  tweet: 'text-sky-400 bg-sky-500/10',
  agent: 'text-pink-400 bg-pink-500/10',
  automation: 'text-violet-400 bg-violet-500/10',
};

const typeLabels = {
  task: 'Task',
  fact: 'Fact',
  message: 'Message',
  email: 'Email',
  session: 'Session',
  calendar: 'Event',
  tweet: 'Tweet',
  agent: 'Agent',
  automation: 'Automation',
};

const statusColors = {
  todo: 'text-mission-control-text-dim',
  'in-progress': 'text-info',
  done: 'text-success',
  blocked: 'text-error',
};

export default function GlobalSearch({ isOpen, onClose, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Compute matched panel navigation results from the search query
  const panelResults = query.trim().length >= 1
    ? PANEL_NAV.filter(p =>
        p.keywords.some(k => k.includes(query.toLowerCase())) ||
        p.label.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 3)
    : [];

  // Load search history from localStorage
  useEffect(() => {
    const history = localStorage.getItem('mission-control-search-history');
    if (history) {
      try {
        setSearchHistory(JSON.parse(history));
      } catch (e) {
        // 'Failed to load search history:', e;
      }
    }
  }, []);

  // Save search history
  const saveToHistory = useCallback((q: string) => {
    if (!q.trim() || q.length < 2) return;
    
    const updated = [q, ...searchHistory.filter(h => h !== q)].slice(0, 10);
    setSearchHistory(updated);
    localStorage.setItem('mission-control-search-history', JSON.stringify(updated));
  }, [searchHistory]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setResults([]);
      setFilteredResults([]);
      setSelectedIndex(0);
      setShowHistory(true);
      setShowFilters(false);
    }
  }, [isOpen]);

  // Apply filters to results
  useEffect(() => {
    let filtered = [...results];

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(r => r.type === typeFilter);
    }

    // Date filter
    if (dateFilter !== 'all' && filtered.length > 0) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      filtered = filtered.filter(r => {
        if (!r.timestamp) return true;
        const date = new Date(r.timestamp);
        
        switch (dateFilter) {
          case 'today':
            return date >= today;
          case 'week':
            return date >= weekAgo;
          case 'month':
            return date >= monthAgo;
          default:
            return true;
        }
      });
    }

    // Status filter (for tasks)
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => {
        if (r.type === 'task') {
          return r.status === statusFilter;
        }
        return true;
      });
    }

    setFilteredResults(filtered);
    setSelectedIndex(0);
  }, [results, typeFilter, dateFilter, statusFilter]);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setResults([]);
      setShowHistory(true);
      return;
    }

    setShowHistory(false);
    setLoading(true);
    const allResults: SearchResult[] = [];

    try {
      // Search tasks via REST API
      try {
        const tasksRes = await fetch('/api/tasks');
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          const taskItems = Array.isArray(tasksData) ? tasksData : (tasksData?.tasks || []);
          const matchingTasks = taskItems.filter((t: any) =>
            t.title?.toLowerCase().includes(q.toLowerCase()) ||
            t.description?.toLowerCase().includes(q.toLowerCase())
          ).slice(0, 10);
          allResults.push(...matchingTasks.map((t: any) => ({
            id: t.id,
            type: 'task' as const,
            title: t.title || 'Untitled Task',
            snippet: t.description?.slice(0, 100) || '',
            timestamp: t.updatedAt || t.createdAt,
            source: 'Tasks',
            status: t.status,
            metadata: t,
          })));
        }
      } catch { /* ignore */ }

      // Search sessions via gateway WebSocket
      try {
        const sessionsResult = await gateway.getSessions();
        if (sessionsResult?.sessions) {
          const matchingSessions = sessionsResult.sessions.filter((s: any) =>
            s.label?.toLowerCase().includes(q.toLowerCase()) ||
            s.channel?.toLowerCase().includes(q.toLowerCase()) ||
            s.key?.toLowerCase().includes(q.toLowerCase())
          ).slice(0, 5);

          allResults.push(...matchingSessions.map((s: any) => ({
            id: s.key,
            type: 'session' as const,
            title: s.label || s.key,
            snippet: `Channel: ${s.channel || 'unknown'}`,
            timestamp: s.updatedAt,
            source: 'Sessions',
            metadata: s,
          })));
        }
      } catch (_e) {
        // Gateway not connected or sessions unavailable - skip sessions search
      }

      // Search agents via REST API
      try {
        const agentsRes = await fetch('/api/agents');
        if (agentsRes.ok) {
          const agentsData = await agentsRes.json();
          const agentItems = Array.isArray(agentsData) ? agentsData : (agentsData?.agents || []);
          const matchingAgents = agentItems.filter((a: any) =>
            a.name?.toLowerCase().includes(q.toLowerCase()) ||
            a.role?.toLowerCase().includes(q.toLowerCase()) ||
            a.id?.toLowerCase().includes(q.toLowerCase())
          ).slice(0, 5);
          allResults.push(...matchingAgents.map((a: any) => ({
            id: `agent-${a.id}`,
            type: 'agent' as const,
            title: `${a.name} — ${a.role || ''}`,
            snippet: `${a.description || ''}${a.status ? ` • ${a.status}` : ''}`,
            source: 'Agents',
            metadata: { role: a.id, capabilities: a.capabilities, status: a.status },
            status: a.status === 'active' ? 'in-progress' : undefined,
          })));
        }
      } catch { /* ignore */ }

      // Apply fuzzy search with Fuse.js for better ranking
      if (allResults.length > 0) {
        const fuse = new Fuse(allResults, {
          keys: [
            { name: 'title', weight: 2 },
            { name: 'snippet', weight: 1 },
            { name: 'source', weight: 0.5 },
          ],
          threshold: 0.4,
          includeScore: true,
          minMatchCharLength: 2,
        });

        const fuseResults = fuse.search(q);
        const rankedResults = fuseResults.map(result => ({
          ...result.item,
          score: result.score,
        }));

        setResults(rankedResults);
      } else {
        setResults(allResults);
      }

      setSelectedIndex(0);
    } catch (error) {
      // '[GlobalSearch] Error:', error;
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search — 200ms prevents fetch on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        search(query);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const maxIndex = showHistory ? searchHistory.length - 1 : filteredResults.length - 1;
      setSelectedIndex(i => Math.min(i + 1, maxIndex));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showHistory && searchHistory[selectedIndex]) {
        setQuery(searchHistory[selectedIndex]);
        setShowHistory(false);
      } else if (filteredResults[selectedIndex]) {
        handleSelect(filteredResults[selectedIndex]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setShowFilters(!showFilters);
    }
  };

  const handleSelect = (result: SearchResult) => {
    saveToHistory(query);

    // Navigate based on result type
    if (onNavigate) {
      switch (result.type) {
        case 'task':
          onNavigate('kanban', result.id);
          break;
        case 'session':
          onNavigate('chat', result.id);
          break;
        case 'agent':
          onNavigate('agents', result.metadata?.role);
          break;
        case 'email':
          onNavigate('inbox', result.id);
          break;
        case 'calendar':
          onNavigate('calendar', result.id);
          break;
        case 'tweet':
          onNavigate('twitter', result.id);
          break;
        case 'automation':
          onNavigate('automations');
          break;
      }
    }

    onClose();
  };

  const handlePanelNavigate = (panelId: string) => {
    if (onNavigate) {
      onNavigate(panelId);
    }
    onClose();
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('mission-control-search-history');
  };

  if (!isOpen) return null;

  const activeFilters = [typeFilter, dateFilter, statusFilter].filter(f => f !== 'all').length;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }}
      role="button"
      tabIndex={0}
      aria-label="Close search"
    >
      <div 
        className="w-full max-w-3xl bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
        role="presentation"
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-mission-control-border">
          <Search size={20} className="text-mission-control-accent flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search everything... (⌘K or ⌘F)"
            aria-label="Search input"
            className="flex-1 bg-transparent text-lg outline-none placeholder-mission-control-text-dim"
          />
          <div className="flex items-center gap-2">
            {loading && (
              <div className="w-5 h-5 border-2 border-mission-control-accent border-t-transparent rounded-full animate-spin" />
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1.5 hover:bg-mission-control-border rounded-lg transition-colors relative ${
                showFilters ? 'bg-mission-control-border' : ''
              }`}
              title="Toggle filters (Tab)"
            >
              <Filter size={16} className={activeFilters > 0 ? 'text-mission-control-accent' : 'text-mission-control-text-dim'} />
              {activeFilters > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-mission-control-accent text-mission-control-bg text-xs rounded-full flex items-center justify-center font-bold">
                  {activeFilters}
                </span>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-mission-control-border rounded-lg transition-colors"
            >
              <X size={16} className="text-mission-control-text-dim" />
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="p-4 border-b border-mission-control-border bg-mission-control-bg/50 space-y-3">
            <div className="flex items-center gap-2">
              <Hash size={14} className="text-mission-control-text-dim" />
              <span className="text-sm text-mission-control-text-dim font-medium">Type:</span>
              <div className="flex gap-1 flex-wrap">
                {(['all', 'task', 'fact', 'message', 'email', 'session', 'agent', 'calendar'] as FilterType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      typeFilter === type
                        ? 'bg-mission-control-accent text-mission-control-bg font-medium'
                        : 'bg-mission-control-border hover:bg-mission-control-border/70 text-mission-control-text-dim'
                    }`}
                  >
                    {type === 'all' ? 'All' : typeLabels[type as keyof typeof typeLabels]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock size={14} className="text-mission-control-text-dim" />
              <span className="text-sm text-mission-control-text-dim font-medium">Date:</span>
              <div className="flex gap-1">
                {(['all', 'today', 'week', 'month'] as DateFilter[]).map(date => (
                  <button
                    key={date}
                    onClick={() => setDateFilter(date)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      dateFilter === date
                        ? 'bg-mission-control-accent text-mission-control-bg font-medium'
                        : 'bg-mission-control-border hover:bg-mission-control-border/70 text-mission-control-text-dim'
                    }`}
                  >
                    {date.charAt(0).toUpperCase() + date.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Zap size={14} className="text-mission-control-text-dim" />
              <span className="text-sm text-mission-control-text-dim font-medium">Status:</span>
              <div className="flex gap-1">
                {(['all', 'todo', 'internal-review', 'in-progress', 'review', 'human-review', 'done'] as StatusFilter[]).map(status => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      statusFilter === status
                        ? 'bg-mission-control-accent text-mission-control-bg font-medium'
                        : 'bg-mission-control-border hover:bg-mission-control-border/70 text-mission-control-text-dim'
                    }`}
                  >
                    {status === 'all' ? 'All' : status.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        <div ref={resultsRef} className="max-h-[28rem] overflow-y-auto">
          {/* Search History */}
          {showHistory && searchHistory.length > 0 && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-mission-control-text-dim" />
                  <span className="text-sm font-medium text-mission-control-text-dim">Recent Searches</span>
                </div>
                <button
                  onClick={clearHistory}
                  className="text-xs text-mission-control-text-dim hover:text-mission-control-accent transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-1">
                {searchHistory.map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    onClick={() => {
                      setQuery(item);
                      setShowHistory(false);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setQuery(item); setShowHistory(false); } }}
                    role="button"
                    tabIndex={0}
                    className={`p-2 rounded-lg cursor-pointer transition-colors flex items-center gap-2 ${
                      index === selectedIndex ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'hover:bg-mission-control-bg/50'
                    }`}
                  >
                    <Clock size={14} className="text-mission-control-text-dim" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && query.length >= 2 && !showHistory && (
            <div className="p-4">
              <SkeletonList count={4} />
            </div>
          )}

          {/* No Results */}
          {filteredResults.length === 0 && panelResults.length === 0 && query.length >= 2 && !loading && !showHistory && (
            <div className="p-12 text-center text-mission-control-text-dim">
              <Search size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-lg mb-2">No results found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          )}

          {/* Quick Navigation — shown when query is empty (with or without history) */}
          {query.length === 0 && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Compass size={16} className="text-mission-control-text-dim" />
                <span className="text-sm font-medium text-mission-control-text-dim">Quick Navigation</span>
              </div>
              <div className="space-y-1">
                {PANEL_NAV.slice(0, 5).map(panel => (
                  <div
                    key={panel.id}
                    onClick={() => handlePanelNavigate(panel.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePanelNavigate(panel.id); } }}
                    role="button"
                    tabIndex={0}
                    className="p-2 rounded-lg cursor-pointer transition-colors flex items-center gap-2 hover:bg-mission-control-bg/50"
                  >
                    <Compass size={14} className="text-mission-control-accent" />
                    <span className="text-sm">Go to {panel.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State — shown when there is a short query but no history */}
          {filteredResults.length === 0 && panelResults.length === 0 && query.length >= 1 && query.length < 2 && !showHistory && (
            <div className="p-12 text-center text-mission-control-text-dim">
              <Search size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm mb-4">Type at least 2 characters to search</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {Object.entries(typeLabels).map(([key, label]) => (
                  <span key={key} className="px-3 py-1.5 bg-mission-control-border rounded-lg text-xs">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Panel Navigation Results — shown at the top when query matches a panel */}
          {panelResults.length > 0 && (
            <div className="border-b border-mission-control-border">
              <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                <Compass size={14} className="text-mission-control-text-dim" />
                <span className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wide">Navigate to</span>
              </div>
              {panelResults.map(panel => (
                <div
                  key={panel.id}
                  onClick={() => handlePanelNavigate(panel.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePanelNavigate(panel.id); } }}
                  role="button"
                  tabIndex={0}
                  className="px-4 py-2.5 cursor-pointer transition-colors flex items-center gap-3 hover:bg-mission-control-bg/50 group"
                >
                  <div className="p-1.5 rounded-lg bg-mission-control-accent/10 flex-shrink-0">
                    <Compass size={14} className="text-mission-control-accent" />
                  </div>
                  <span className="text-sm font-medium">Go to {panel.label}</span>
                  <ChevronRight size={14} className="text-mission-control-text-dim ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          )}

          {/* Results List */}
          {filteredResults.map((result, index) => {
            const Icon = typeIcons[result.type];
            const colorClass = typeColors[result.type];
            
            return (
              <div
                key={`${result.type}-${result.id}-${index}`}
                onClick={() => handleSelect(result)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(result); } }}
                role="button"
                tabIndex={0}
                className={`p-4 border-b border-mission-control-border cursor-pointer transition-all group ${
                  index === selectedIndex 
                    ? 'bg-mission-control-accent/10 border-l-2 border-l-mission-control-accent' 
                    : 'hover:bg-mission-control-bg/50 border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${colorClass} flex-shrink-0`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">{result.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 whitespace-nowrap ${colorClass}`}>
                        {typeLabels[result.type]}
                      </span>
                      {result.status && (
                        <span className={`text-xs ${statusColors[result.status as keyof typeof statusColors] || 'text-mission-control-text-dim'}`}>
                          • {result.status}
                        </span>
                      )}
                    </div>
                    {/* Render snippet with HTML highlighting if it contains <mark> tags */}
                    {/* SECURITY: sanitizeSearchSnippet (DOMPurify) allows only <mark> tags; all other HTML stripped */}
                    {result.snippet?.includes('<mark>') ? (
                      <div
                        className="text-sm text-mission-control-text-dim line-clamp-2"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeSearchSnippet(result.snippet)
                        }}
                      />
                    ) : (
                      <p className="text-sm text-mission-control-text-dim truncate">
                        {result.snippet}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-mission-control-text-dim">
                      {result.source && <span>{result.source}</span>}
                      {result.timestamp && (
                        <>
                          <span>•</span>
                          <span>{new Date(result.timestamp).toLocaleDateString()}</span>
                        </>
                      )}
                      {result.score !== undefined && result.score > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-mission-control-accent font-medium">
                            {result.score.toFixed(2)} relevance
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight 
                    size={16} 
                    className={`text-mission-control-text-dim flex-shrink-0 transition-transform ${
                      index === selectedIndex ? 'translate-x-1 text-mission-control-accent' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-mission-control-border bg-mission-control-bg/50 flex items-center justify-between text-xs text-mission-control-text-dim">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-mission-control-border rounded">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-mission-control-border rounded">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-mission-control-border rounded">Tab</kbd>
              Filters
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-mission-control-border rounded">Esc</kbd>
              Close
            </span>
          </div>
          <div className="flex items-center gap-2">
            {filteredResults.length > 0 && (
              <span>{filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}</span>
            )}
            <span>⌘K • ⌘F</span>
          </div>
        </div>
      </div>
    </div>
  );
}
