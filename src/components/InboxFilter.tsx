import { useState, useEffect, useRef } from 'react';
import { Search, Filter, Star, Mail, Paperclip, X, Save, Reply } from 'lucide-react';

export interface FilterCriteria {
  search?: string;
  quickFilter?: string;
  platforms?: string[];
  senders?: string[];
  projects?: string[];
  dateRange?: { start?: string; end?: string };
  flags?: {
    unread?: boolean;
    unreplied?: boolean;
    starred?: boolean;
    hasAttachment?: boolean;
    hasReply?: boolean;
    urgent?: boolean;
  };
  logicMode?: 'AND' | 'OR';
}

export interface SavedFilter {
  id: string;
  name: string;
  criteria: FilterCriteria;
  color?: string;
}

interface InboxFilterProps {
  onFilterChange: (criteria: FilterCriteria) => void;
  totalMessages: number;
  filteredCount: number;
}

const PLATFORM_OPTIONS = [
  { id: 'email', label: 'Email', icon: '📧' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { id: 'telegram', label: 'Telegram', icon: '✈️' },
  { id: 'discord', label: 'Discord', icon: '🎮' },
  { id: 'twitter', label: 'X/Twitter', icon: '𝕏' },
];

const QUICK_FILTER_EXAMPLES = [
  'is:unread',
  'is:unreplied',
  'is:starred',
  'has:attachment',
  'from:sender@email.com',
  'project:bitso',
  'before:2024-01-30',
  'after:2024-01-01',
];

export default function InboxFilter({ onFilterChange, totalMessages, filteredCount }: InboxFilterProps) {
  const [searchInput, setSearchInput] = useState('');
  const [quickFilterInput, setQuickFilterInput] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [flags, setFlags] = useState<FilterCriteria['flags']>({});
  const [logicMode, setLogicMode] = useState<'AND' | 'OR'>('AND');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSavedFilters, setShowSavedFilters] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [filterName, setFilterName] = useState('');
  const [showQuickHelp, setShowQuickHelp] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout>();

  // Load saved filters from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('inbox-saved-filters');
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved filters:', e);
      }
    }
  }, []);

  // Parse quick filter syntax (is:unread, from:person, etc.)
  const parseQuickFilter = (input: string): Partial<FilterCriteria> => {
    const criteria: Partial<FilterCriteria> = {};
    const parts = input.toLowerCase().split(/\s+/);

    for (const part of parts) {
      if (part.startsWith('is:')) {
        const flag = part.slice(3);
        if (!criteria.flags) criteria.flags = {};
        if (flag === 'unread') criteria.flags.unread = true;
        if (flag === 'unreplied') criteria.flags.unreplied = true;
        if (flag === 'starred') criteria.flags.starred = true;
        if (flag === 'urgent') criteria.flags.urgent = true;
      } else if (part.startsWith('has:')) {
        const has = part.slice(4);
        if (!criteria.flags) criteria.flags = {};
        if (has === 'attachment') criteria.flags.hasAttachment = true;
        if (has === 'reply') criteria.flags.hasReply = true;
      } else if (part.startsWith('from:')) {
        const sender = part.slice(5);
        criteria.senders = [sender];
      } else if (part.startsWith('project:')) {
        const project = part.slice(8);
        criteria.projects = [project];
      } else if (part.startsWith('platform:')) {
        const platform = part.slice(9);
        criteria.platforms = [platform];
      } else if (part.startsWith('before:')) {
        const date = part.slice(7);
        if (!criteria.dateRange) criteria.dateRange = {};
        criteria.dateRange.end = date;
      } else if (part.startsWith('after:')) {
        const date = part.slice(6);
        if (!criteria.dateRange) criteria.dateRange = {};
        criteria.dateRange.start = date;
      }
    }

    return criteria;
  };

  // Apply filters with debounce
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      const criteria: FilterCriteria = {
        search: searchInput.trim() || undefined,
        platforms: platforms.length > 0 ? platforms : undefined,
        flags: Object.keys(flags).length > 0 ? flags : undefined,
        logicMode,
      };

      // Apply quick filter parsing
      if (quickFilterInput.trim()) {
        const quickCriteria = parseQuickFilter(quickFilterInput);
        Object.assign(criteria, {
          ...quickCriteria,
          quickFilter: quickFilterInput.trim(),
        });
      }

      onFilterChange(criteria);
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchInput, quickFilterInput, platforms, flags, logicMode, onFilterChange]);

  const togglePlatform = (platform: string) => {
    setPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const toggleFlag = (flag: keyof NonNullable<FilterCriteria['flags']>) => {
    setFlags(prev => ({
      ...prev,
      [flag]: !prev[flag],
    }));
  };

  const clearFilters = () => {
    setSearchInput('');
    setQuickFilterInput('');
    setPlatforms([]);
    setFlags({});
    setLogicMode('AND');
  };

  const saveCurrentFilter = () => {
    if (!filterName.trim()) return;

    const newFilter: SavedFilter = {
      id: `filter-${Date.now()}`,
      name: filterName.trim(),
      criteria: {
        search: searchInput.trim() || undefined,
        quickFilter: quickFilterInput.trim() || undefined,
        platforms: platforms.length > 0 ? platforms : undefined,
        flags: Object.keys(flags).length > 0 ? flags : undefined,
        logicMode,
      },
    };

    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    localStorage.setItem('inbox-saved-filters', JSON.stringify(updated));
    setFilterName('');
    alert(`✅ Filter "${newFilter.name}" saved!`);
  };

  const applySavedFilter = (filter: SavedFilter) => {
    const { criteria } = filter;
    setSearchInput(criteria.search || '');
    setQuickFilterInput(criteria.quickFilter || '');
    setPlatforms(criteria.platforms || []);
    setFlags(criteria.flags || {});
    setLogicMode(criteria.logicMode || 'AND');
    setShowSavedFilters(false);
  };

  const deleteSavedFilter = (id: string) => {
    const updated = savedFilters.filter(f => f.id !== id);
    setSavedFilters(updated);
    localStorage.setItem('inbox-saved-filters', JSON.stringify(updated));
  };

  const hasActiveFilters = searchInput || quickFilterInput || platforms.length > 0 || Object.keys(flags).length > 0;

  return (
    <div className="bg-clawd-surface border-b border-clawd-border">
      {/* Main Filter Bar */}
      <div className="p-3 space-y-3">
        {/* Search Row */}
        <div className="flex gap-2">
          {/* Semantic Search */}
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clawd-text-dim" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Semantic search across all messages..."
              className="w-full bg-clawd-bg border border-clawd-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-clawd-accent"
            />
          </div>

          {/* Quick Filter with Help */}
          <div className="flex-1 relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clawd-text-dim" />
            <input
              type="text"
              value={quickFilterInput}
              onChange={(e) => setQuickFilterInput(e.target.value)}
              onFocus={() => setShowQuickHelp(true)}
              onBlur={() => setTimeout(() => setShowQuickHelp(false), 200)}
              placeholder="Quick filter (is:unread, from:sender, has:attachment)"
              className="w-full bg-clawd-bg border border-clawd-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-clawd-accent"
            />
            {showQuickHelp && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-clawd-bg border border-clawd-border rounded-lg p-2 text-xs z-10 shadow-lg">
                <div className="font-semibold mb-1">Quick Filter Syntax:</div>
                <div className="space-y-0.5 text-clawd-text-dim">
                  {QUICK_FILTER_EXAMPLES.map(ex => (
                    <div key={ex} className="hover:text-clawd-text cursor-pointer" onClick={() => setQuickFilterInput(ex)}>
                      {ex}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
              showAdvanced ? 'bg-clawd-accent text-white' : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            <Filter size={14} />
            Advanced
          </button>

          <button
            onClick={() => setShowSavedFilters(!showSavedFilters)}
            className="px-3 py-2 bg-clawd-border rounded-lg text-sm flex items-center gap-2 text-clawd-text-dim hover:text-clawd-text relative"
          >
            <Star size={14} />
            Saved ({savedFilters.length})
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm flex items-center gap-2 hover:bg-red-500/30"
            >
              <X size={14} />
              Clear
            </button>
          )}
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between text-xs text-clawd-text-dim">
          <span>
            Showing {filteredCount} of {totalMessages} messages
            {hasActiveFilters && <span className="text-clawd-accent ml-1">(filtered)</span>}
          </span>
          <div className="flex items-center gap-2">
            <span>Logic:</span>
            <button
              onClick={() => setLogicMode(logicMode === 'AND' ? 'OR' : 'AND')}
              className={`px-2 py-0.5 rounded text-xs font-mono ${
                logicMode === 'AND' ? 'bg-clawd-accent text-white' : 'bg-clawd-border'
              }`}
            >
              {logicMode}
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="px-3 pb-3 space-y-3 border-t border-clawd-border pt-3">
          {/* Platform Filters */}
          <div>
            <div className="text-xs font-semibold mb-2 text-clawd-text-dim">Platforms</div>
            <div className="flex gap-2 flex-wrap">
              {PLATFORM_OPTIONS.map(platform => (
                <button
                  key={platform.id}
                  onClick={() => togglePlatform(platform.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-all ${
                    platforms.includes(platform.id)
                      ? 'bg-clawd-accent text-white'
                      : 'bg-clawd-bg border border-clawd-border text-clawd-text-dim hover:text-clawd-text'
                  }`}
                >
                  <span>{platform.icon}</span>
                  {platform.label}
                </button>
              ))}
            </div>
          </div>

          {/* Flag Filters */}
          <div>
            <div className="text-xs font-semibold mb-2 text-clawd-text-dim">Flags</div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => toggleFlag('unread')}
                className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${
                  flags.unread ? 'bg-blue-500/20 text-blue-400' : 'bg-clawd-bg border border-clawd-border text-clawd-text-dim'
                }`}
              >
                <Mail size={14} /> Unread
              </button>
              <button
                onClick={() => toggleFlag('unreplied')}
                className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${
                  flags.unreplied ? 'bg-orange-500/20 text-orange-500' : 'bg-clawd-bg border border-clawd-border text-clawd-text-dim'
                }`}
              >
                <Reply size={14} /> Awaiting Reply
              </button>
              <button
                onClick={() => toggleFlag('starred')}
                className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${
                  flags.starred ? 'bg-yellow-500/20 text-yellow-400' : 'bg-clawd-bg border border-clawd-border text-clawd-text-dim'
                }`}
              >
                <Star size={14} /> Starred
              </button>
              <button
                onClick={() => toggleFlag('hasAttachment')}
                className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${
                  flags.hasAttachment ? 'bg-green-500/20 text-green-400' : 'bg-clawd-bg border border-clawd-border text-clawd-text-dim'
                }`}
              >
                <Paperclip size={14} /> Has Attachment
              </button>
              <button
                onClick={() => toggleFlag('urgent')}
                className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${
                  flags.urgent ? 'bg-red-500/20 text-red-400' : 'bg-clawd-bg border border-clawd-border text-clawd-text-dim'
                }`}
              >
                <span>🚨</span> Urgent
              </button>
            </div>
          </div>

          {/* Save Filter */}
          <div className="flex gap-2 items-center pt-2 border-t border-clawd-border">
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Filter name..."
              className="flex-1 bg-clawd-bg border border-clawd-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-clawd-accent"
            />
            <button
              onClick={saveCurrentFilter}
              disabled={!filterName.trim() || !hasActiveFilters}
              className="px-3 py-1.5 bg-clawd-accent text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={14} /> Save Filter
            </button>
          </div>
        </div>
      )}

      {/* Saved Filters Dropdown */}
      {showSavedFilters && (
        <div className="px-3 pb-3 border-t border-clawd-border pt-3">
          <div className="text-xs font-semibold mb-2 text-clawd-text-dim">Saved Filters</div>
          {savedFilters.length === 0 ? (
            <p className="text-sm text-clawd-text-dim text-center py-2">No saved filters</p>
          ) : (
            <div className="space-y-2">
              {savedFilters.map(filter => (
                <div
                  key={filter.id}
                  className="bg-clawd-bg border border-clawd-border rounded-lg p-2 flex items-center justify-between hover:border-clawd-accent/50 transition-colors"
                >
                  <button
                    onClick={() => applySavedFilter(filter)}
                    className="flex-1 text-left text-sm font-medium"
                  >
                    {filter.name}
                  </button>
                  <button
                    onClick={() => deleteSavedFilter(filter.id)}
                    className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
