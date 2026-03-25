import { useState, useEffect, useRef } from 'react';
import { Search, Filter, Star, Mail, Paperclip, X, Save, Reply, MessageCircle, Gamepad2, Send as SendPlane, AlertTriangle } from 'lucide-react';
import { showToast } from './Toast';
import { Button, Flex, IconButton, TextField, Box } from '@radix-ui/themes';

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

const PLATFORM_OPTIONS: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: 'email', label: 'Email', icon: <Mail size={14} /> },
  { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={14} /> },
  { id: 'telegram', label: 'Telegram', icon: <SendPlane size={14} /> },
  { id: 'discord', label: 'Discord', icon: <Gamepad2 size={14} /> },
  { id: 'twitter', label: 'Social Media', icon: <span className="text-sm font-bold">𝕏</span> },
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
  const [flags, setFlags] = useState<NonNullable<FilterCriteria['flags']>>({});
  const [logicMode, setLogicMode] = useState<'AND' | 'OR'>('AND');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSavedFilters, setShowSavedFilters] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [filterName, setFilterName] = useState('');
  const [showQuickHelp, setShowQuickHelp] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Load saved filters from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('inbox-saved-filters');
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved));
      } catch (e) {
        // 'Failed to load saved filters:', e;
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
    showToast('success', 'Filter Saved', `"${newFilter.name}" has been saved`);
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
    <Box className="bg-mission-control-surface border-b border-mission-control-border">
      {/* Main Filter Bar */}
      <div className="p-3 space-y-3">
        {/* Search Row */}
        <Flex gap="2">
          {/* Semantic Search */}
          <div className="flex-1 relative">
            <TextField.Root
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Semantic search across all messages..."
              size="2"
              className="flex-1"
            >
              <TextField.Slot>
                <Search size={14} className="text-mission-control-text-dim" />
              </TextField.Slot>
            </TextField.Root>
          </div>

          {/* Quick Filter with Help */}
          <div className="flex-1 relative">
            <TextField.Root
              value={quickFilterInput}
              onChange={(e) => setQuickFilterInput(e.target.value)}
              onFocus={() => setShowQuickHelp(true)}
              onBlur={() => setTimeout(() => setShowQuickHelp(false), 200)}
              placeholder="Quick filter (is:unread, from:sender, has:attachment)"
              size="2"
              className="flex-1"
            >
              <TextField.Slot>
                <Filter size={14} className="text-mission-control-text-dim" />
              </TextField.Slot>
            </TextField.Root>
            {showQuickHelp && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-mission-control-bg border border-mission-control-border rounded-lg p-2 text-xs z-10 shadow-lg">
                <div className="font-semibold mb-1">Quick Filter Syntax:</div>
                <div className="space-y-0.5 text-mission-control-text-dim">
                  {QUICK_FILTER_EXAMPLES.map(ex => (
                    <div
                      key={ex}
                      role="button"
                      tabIndex={0}
                      className="hover:text-mission-control-text cursor-pointer py-0.5 px-1 rounded hover:bg-mission-control-border"
                      onClick={() => setQuickFilterInput(ex)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setQuickFilterInput(ex); }}}
                    >
                      {ex}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <Button
            variant={showAdvanced ? 'solid' : 'soft'}
            color={showAdvanced ? 'blue' : 'gray'}
            size="2"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Filter size={14} />
            Advanced
          </Button>

          <Button
            variant="soft"
            color="gray"
            size="2"
            onClick={() => setShowSavedFilters(!showSavedFilters)}
          >
            <Star size={14} />
            Saved ({savedFilters.length})
          </Button>

          {hasActiveFilters && (
            <Button
              variant="soft"
              color="red"
              size="2"
              onClick={clearFilters}
            >
              <X size={14} />
              Clear
            </Button>
          )}
        </Flex>

        {/* Results Count */}
        <Flex align="center" justify="between" className="text-xs text-mission-control-text-dim">
          <span>
            Showing {filteredCount} of {totalMessages} messages
            {hasActiveFilters && <span className="text-mission-control-accent ml-1">(filtered)</span>}
          </span>
          <Flex align="center" gap="2">
            <span>Logic:</span>
            <Button
              variant={logicMode === 'AND' ? 'solid' : 'soft'}
              color={logicMode === 'AND' ? 'blue' : 'gray'}
              size="1"
              onClick={() => setLogicMode(logicMode === 'AND' ? 'OR' : 'AND')}
              className="font-mono"
            >
              {logicMode}
            </Button>
          </Flex>
        </Flex>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="px-3 pb-3 space-y-3 border-t border-mission-control-border pt-3">
          {/* Platform Filters */}
          <div>
            <div className="text-xs font-semibold mb-2 text-mission-control-text-dim">Platforms</div>
            <div className="flex gap-2 flex-wrap">
              {PLATFORM_OPTIONS.map(platform => (
                <Button
                  key={platform.id}
                  variant={platforms.includes(platform.id) ? 'solid' : 'soft'}
                  color={platforms.includes(platform.id) ? 'blue' : 'gray'}
                  size="2"
                  onClick={() => togglePlatform(platform.id)}
                >
                  <span>{platform.icon}</span>
                  {platform.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Flag Filters */}
          <div>
            <div className="text-xs font-semibold mb-2 text-mission-control-text-dim">Flags</div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={flags.unread ? 'solid' : 'soft'}
                color={flags.unread ? 'blue' : 'gray'}
                size="2"
                onClick={() => toggleFlag('unread')}
              >
                <Mail size={14} /> Unread
              </Button>
              <Button
                variant={flags.unreplied ? 'solid' : 'soft'}
                color={flags.unreplied ? 'amber' : 'gray'}
                size="2"
                onClick={() => toggleFlag('unreplied')}
              >
                <Reply size={14} /> Awaiting Reply
              </Button>
              <Button
                variant={flags.starred ? 'solid' : 'soft'}
                color={flags.starred ? 'amber' : 'gray'}
                size="2"
                onClick={() => toggleFlag('starred')}
              >
                <Star size={14} /> Starred
              </Button>
              <Button
                variant={flags.hasAttachment ? 'solid' : 'soft'}
                color={flags.hasAttachment ? 'grass' : 'gray'}
                size="2"
                onClick={() => toggleFlag('hasAttachment')}
              >
                <Paperclip size={14} /> Has Attachment
              </Button>
              <Button
                variant={flags.urgent ? 'solid' : 'soft'}
                color={flags.urgent ? 'red' : 'gray'}
                size="2"
                onClick={() => toggleFlag('urgent')}
              >
                <AlertTriangle size={14} /> Urgent
              </Button>
            </div>
          </div>

          {/* Save Filter */}
          <Flex gap="2" align="center" className="pt-2 border-t border-mission-control-border">
            <TextField.Root
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Filter name..."
              className="flex-1"
            />
            <Button
              variant="solid"
              color="violet"
              size="2"
              onClick={saveCurrentFilter}
              disabled={!filterName.trim() || !hasActiveFilters}
            >
              <Save size={14} /> Save Filter
            </Button>
          </Flex>
        </div>
      )}

      {/* Saved Filters Dropdown */}
      {showSavedFilters && (
        <div className="px-3 pb-3 border-t border-mission-control-border pt-3">
          <div className="text-xs font-semibold mb-2 text-mission-control-text-dim">Saved Filters</div>
          {savedFilters.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 text-center px-6 py-8">
              <Filter size={32} className="text-mission-control-text-dim opacity-40" />
              <p className="text-sm font-semibold text-mission-control-text">No saved filters</p>
              <p className="text-xs text-mission-control-text-dim max-w-xs">Save a filter to quickly apply it later</p>
            </div>
          ) : (
            <div className="space-y-2">
              {savedFilters.map(filter => (
                <div
                  key={filter.id}
                  className="bg-mission-control-bg border border-mission-control-border rounded-lg p-2 flex items-center justify-between hover:border-mission-control-accent/50 transition-colors"
                >
                  <Button
                    variant="ghost"
                    color="gray"
                    size="2"
                    onClick={() => applySavedFilter(filter)}
                    className="flex-1 justify-start"
                  >
                    {filter.name}
                  </Button>
                  <IconButton
                    variant="ghost"
                    size="1"
                    color="red"
                    onClick={() => deleteSavedFilter(filter.id)}
                    aria-label="Delete saved filter"
                  >
                    <X size={14} />
                  </IconButton>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Box>
  );
}
