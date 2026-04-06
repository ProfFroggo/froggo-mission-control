import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bot, CheckCircle, Search, RefreshCw, Cpu, Star, Trash2,
  ArrowUpDown, Zap, BarChart2, Clock, SortAsc, GitCompare, X, Table2,
} from 'lucide-react';
import { catalogApi } from '../lib/api';
import type { CatalogAgent } from '../types/catalog';
import { Spinner } from './LoadingStates';
import { useStore } from '../store/store';
import AgentHireWizard from './AgentHireWizard';
import AgentCompareModal from './AgentCompareModal';
import EmptyState from './EmptyState';
import AgentCapabilityMatrix from './AgentCapabilityMatrix';
import { getAgentTheme } from '../utils/agentThemes';
import { Button, TextField, Box, Flex } from '@radix-ui/themes';

const CORE_AGENT_IDS = ['mission-control', 'clara', 'hr', 'coder', 'inbox'];

// Role-based categories for the filter sidebar
const ROLE_CATEGORIES = [
  { id: 'all',          label: 'All Agents' },
  { id: 'Engineering',  label: 'Engineering' },
  { id: 'Marketing',    label: 'Marketing' },
  { id: 'Operations',   label: 'Operations' },
  { id: 'Creative',     label: 'Creative' },
  { id: 'Research',     label: 'Research' },
  { id: 'Finance',      label: 'Finance' },
] as const;

type RoleCategory = typeof ROLE_CATEGORIES[number]['id'];

type SortOption = 'most-used' | 'success-rate' | 'newest' | 'name';

const SORT_OPTIONS: { id: SortOption; label: string; icon: typeof SortAsc }[] = [
  { id: 'name',         label: 'Name',         icon: SortAsc },
  { id: 'most-used',    label: 'Most Used',    icon: BarChart2 },
  { id: 'success-rate', label: 'Success Rate', icon: Zap },
  { id: 'newest',       label: 'Newest',       icon: Clock },
];

const MODEL_BADGE: Record<string, { label: string; cls: string }> = {
  opus:    { label: 'Opus',    cls: 'bg-review-subtle text-review border border-review-border' },
  sonnet:  { label: 'Sonnet',  cls: 'bg-info/10 text-info border border-info/30' },
  haiku:   { label: 'Haiku',   cls: 'bg-warning/10 text-warning border border-warning/30' },
};

const CATEGORY_LABELS: Record<string, string> = {
  core:       'Core',
  specialist: 'Specialist',
  creative:   'Creative',
  ops:        'Ops',
  finance:    'Finance',
  comms:      'Comms',
  dev:        'Dev',
};

/** Derive a role category from an agent's role string */
function deriveRoleCategory(role: string | null): RoleCategory {
  if (!role) return 'all';
  const r = role.toLowerCase();
  if (r.includes('engineer') || r.includes('dev') || r.includes('code') || r.includes('coder')) return 'Engineering';
  if (r.includes('market') || r.includes('growth') || r.includes('content') || r.includes('social')) return 'Marketing';
  if (r.includes('ops') || r.includes('operation') || r.includes('project') || r.includes('manage')) return 'Operations';
  if (r.includes('creat') || r.includes('design') || r.includes('brand') || r.includes('video')) return 'Creative';
  if (r.includes('research') || r.includes('analyt') || r.includes('data') || r.includes('insight')) return 'Research';
  if (r.includes('financ') || r.includes('account') || r.includes('budget') || r.includes('tax')) return 'Finance';
  return 'all';
}

const FEATURED_THRESHOLD = 0.85;

/** Derive 1-2 character initials from agent name or id */
function getInitials(name?: string, id?: string): string {
  const source = name || id || '?';
  const parts = source.replace(/[-_]/g, ' ').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

/** Avatar with graceful fallback for library cards */
function LibraryAvatar({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const theme = getAgentTheme(agentId);
  return (
    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-mission-control-bg border border-mission-control-border overflow-hidden flex items-center justify-center">
      {!imgFailed ? (
        <img
          src={`/api/agents/${agentId}/avatar`}
          alt={agentName}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          width={48}
          height={48}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span
          className={`flex items-center justify-center w-full h-full text-sm font-semibold ${theme.text}`}
          style={{ backgroundColor: theme.color + '22' }}
        >
          {getInitials(agentName, agentId)}
        </span>
      )}
    </div>
  );
}

interface AgentLibraryPanelProps {
  onHire?: (agent: CatalogAgent) => void;
}

type LibraryTab = 'catalog' | 'capabilities';

export default function AgentLibraryPanel({ onHire }: AgentLibraryPanelProps) {
  const fetchAgents = useStore(s => s.fetchAgents);
  const [activeTab, setActiveTab]     = useState<LibraryTab>('catalog');
  const [agents, setAgents]           = useState<CatalogAgent[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [filter, setFilter]           = useState<'all' | 'hired' | 'available'>('all');
  const [roleCategory, setRoleCategory] = useState<RoleCategory>('all');
  const [sortBy, setSortBy]           = useState<SortOption>('name');
  const [refreshing, setRefreshing]   = useState(false);
  const [firing, setFiring]           = useState<string | null>(null);
  const [hiringAgent, setHiringAgent] = useState<CatalogAgent | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [compareIds, setCompareIds]   = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘F keyboard shortcut for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close sort menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const load = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await catalogApi.listAgents();
      setAgents(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load catalog');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleCompare = useCallback((agentId: string) => {
    setCompareIds(prev => {
      if (prev.includes(agentId)) return prev.filter(id => id !== agentId);
      if (prev.length >= 2) return prev; // max 2
      return [...prev, agentId];
    });
  }, []);

  const filtered = agents
    .filter(a => {
      const matchesSearch = !search ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        (a.role ?? '').toLowerCase().includes(search.toLowerCase()) ||
        a.capabilities.some(c => c.toLowerCase().includes(search.toLowerCase()));
      const effectiveInstalled = a.installed || CORE_AGENT_IDS.includes(a.id);
      const matchesFilter =
        filter === 'all' ? true :
        filter === 'hired' ? effectiveInstalled :
        !effectiveInstalled;
      const matchesRole = roleCategory === 'all' || deriveRoleCategory(a.role) === roleCategory;
      return matchesSearch && matchesFilter && matchesRole;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        const aCore = CORE_AGENT_IDS.indexOf(a.id);
        const bCore = CORE_AGENT_IDS.indexOf(b.id);
        if (aCore !== -1 && bCore !== -1) return aCore - bCore;
        if (aCore !== -1) return -1;
        if (bCore !== -1) return 1;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'newest') return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      if (sortBy === 'most-used') {
        // Approximate by installed first, then alphabetical
        const aInst = a.installed ? 1 : 0;
        const bInst = b.installed ? 1 : 0;
        return bInst - aInst || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });

  const hiredCount     = agents.filter(a => a.installed || CORE_AGENT_IDS.includes(a.id)).length;
  const availableCount = agents.filter(a => !a.installed && !CORE_AGENT_IDS.includes(a.id)).length;
  const currentSortLabel = SORT_OPTIONS.find(s => s.id === sortBy)?.label ?? 'Name';

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-error mb-3">{error}</p>
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Library tabs */}
      <Flex align="center" gap="1" mb="4" className="border-b border-mission-control-border">
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'catalog'
              ? 'border-mission-control-accent text-mission-control-accent'
              : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
          }`}
        >
          <Bot size={14} />
          Catalog
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('capabilities')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'capabilities'
              ? 'border-mission-control-accent text-mission-control-accent'
              : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
          }`}
        >
          <Table2 size={14} />
          Capabilities
        </button>
      </Flex>

      {activeTab === 'capabilities' && <AgentCapabilityMatrix />}
      {activeTab === 'catalog' && <Flex gap="4">
        {/* ── Category sidebar ── */}
        <aside className="flex-shrink-0 w-44">
          <p className="text-[10px] font-bold uppercase tracking-widest text-mission-control-text-dim mb-2 px-1">
            Roles
          </p>
          <nav className="space-y-0.5">
            {ROLE_CATEGORIES.map(cat => {
              const count = cat.id === 'all'
                ? agents.length
                : agents.filter(a => deriveRoleCategory(a.role) === cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setRoleCategory(cat.id)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-left ${
                    roleCategory === cat.id
                      ? 'bg-mission-control-accent/10 text-mission-control-accent'
                      : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/50'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className="text-xs tabular-nums opacity-60">
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0">
          {/* Stats bar */}
          <Flex align="center" gap="4" className="mb-4 text-sm">
            <span className="icon-text text-success">
              <CheckCircle size={14} className="flex-shrink-0" />
              {hiredCount} hired
            </span>
            <span className="icon-text text-mission-control-text-dim">
              <Bot size={14} className="flex-shrink-0" />
              {availableCount} available
            </span>
            <div className="flex-1" />
            {/* Sort dropdown */}
            <div className="relative" ref={sortMenuRef}>
              <button
                type="button"
                onClick={() => setShowSortMenu(v => !v)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
              >
                <ArrowUpDown size={12} />
                {currentSortLabel}
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-1 z-20 bg-mission-control-surface border border-mission-control-border rounded-lg shadow-xl w-40 py-1 overflow-hidden">
                  {SORT_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => { setSortBy(opt.id); setShowSortMenu(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-left ${
                          sortBy === opt.id
                            ? 'bg-mission-control-accent/10 text-mission-control-accent'
                            : 'text-mission-control-text hover:bg-mission-control-bg'
                        }`}
                      >
                        <Icon size={12} className="flex-shrink-0" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => load(false)}
              disabled={refreshing}
              title="Refresh catalog"
              aria-label="Refresh catalog"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </Flex>

          {/* Search + filter */}
          <Flex align="center" gap="2" className="mb-4">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim pointer-events-none z-[1]" />
              <TextField.Root
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search agents…"
                className="w-full"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-xs font-mono border border-mission-control-border rounded select-none bg-mission-control-bg text-mission-control-text-dim">
                ⌘F
              </kbd>
            </div>
            <div className="flex items-center gap-0.5 p-1 rounded-lg bg-mission-control-bg border border-mission-control-border text-xs">
              {(['all', 'hired', 'available'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 capitalize rounded-md transition-colors ${
                    filter === f
                      ? 'bg-mission-control-accent/10 text-mission-control-accent border border-mission-control-accent/30'
                      : 'text-mission-control-text-dim hover:text-mission-control-text'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </Flex>

          {/* Compare bar */}
          {compareIds.length > 0 && (
            <Flex align="center" gap="3" className="mb-4 px-3 py-2.5 bg-info/10 border border-info/30 rounded-lg text-sm">
              <GitCompare size={14} className="text-info flex-shrink-0" />
              <span className="text-info flex-1">
                {compareIds.length === 1
                  ? 'Select 1 more agent to compare'
                  : `${compareIds.length} agents selected`}
              </span>
              {compareIds.length === 2 && (
                <Button
                  type="button"
                  onClick={() => setShowCompare(true)}
                  size="1"
                  variant="solid"
                  color="blue"
                 
                >
                  Compare
                </Button>
              )}
              <button
                type="button"
                onClick={() => setCompareIds([])}
                aria-label="Clear comparison"
                className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
              >
                <X size={12} />
              </button>
            </Flex>
          )}

          {filtered.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="No agents found"
              description={search ? `No agents match "${search}". Try a different search term.` : 'No agents match the current filters.'}
              action={search ? { label: 'Clear search', onClick: () => setSearch('') } : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(agent => {
                const modelBadge    = MODEL_BADGE[agent.model] ?? MODEL_BADGE.sonnet;
                const categoryLabel = CATEGORY_LABELS[agent.category] ?? agent.category;
                const isInstalled   = agent.installed || CORE_AGENT_IDS.includes(agent.id);
                const isFeatured    = (agent as any).successRate > FEATURED_THRESHOLD;
                const isHovered     = hoveredCard === agent.id;
                const isInCompare   = compareIds.includes(agent.id);

                return (
                  <div
                    key={agent.id}
                    className={`relative rounded-xl bg-mission-control-surface border p-4 transition-colors duration-200 flex flex-col cursor-pointer hover:-translate-y-0.5 hover:shadow-lg ${
                      isInCompare
                        ? 'border-info/40'
                        : isInstalled
                          ? 'border-success/30'
                          : 'border-mission-control-border hover:border-mission-control-accent/30'
                    }`}
                    onMouseEnter={() => setHoveredCard(agent.id)}
                    onMouseLeave={() => setHoveredCard(null)}
                  >
                    {/* Featured badge */}
                    {isFeatured && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-warning/10 border border-warning/30 text-warning text-xs font-medium">
                        <Star size={9} className="fill-current" />
                        Featured
                      </div>
                    )}

                    {/* Header */}
                    <Flex align="start" gap="3" className="mb-3">
                      <LibraryAvatar agentId={agent.id} agentName={agent.name} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className="font-semibold text-sm leading-tight text-mission-control-text">{agent.name}</span>
                          {isInstalled && (
                            <CheckCircle size={13} className="text-success flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-mission-control-text-dim line-clamp-2">
                          {agent.role || agent.description || '—'}
                        </p>
                      </div>
                    </Flex>

                    {/* Badges row */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-mission-control-bg border border-mission-control-border text-mission-control-text-dim uppercase tracking-wide">
                        {categoryLabel}
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${modelBadge.cls}`}>
                        {modelBadge.label}
                      </span>
                    </div>

                    {/* Capabilities */}
                    {agent.capabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {agent.capabilities.slice(0, 4).map((cap, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-mission-control-bg border border-mission-control-border text-mission-control-text-dim">
                            {cap}
                          </span>
                        ))}
                        {agent.capabilities.length > 4 && (
                          <span className="text-xs text-mission-control-text-dim px-1">
                            +{agent.capabilities.length - 4}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Required APIs warning */}
                    {agent.requiredApis.length > 0 && !isInstalled && (
                      <Flex align="center" gap="1" className="text-xs text-warning mb-3">
                        <Cpu size={11} className="flex-shrink-0" />
                        <span>Requires: {agent.requiredApis.join(', ')}</span>
                      </Flex>
                    )}

                    {/* Action */}
                    <div className="pt-2 border-t border-mission-control-border/40 mt-auto">
                      {isInstalled ? (
                        <Flex align="center" gap="2">
                          <div className="flex items-center gap-1.5 text-xs text-success flex-1">
                            <CheckCircle size={13} className="flex-shrink-0" />
                            <span>Hired &amp; active{CORE_AGENT_IDS.includes(agent.id) ? ' · Core' : ''}</span>
                          </div>
                          {/* Compare toggle for installed agents */}
                          <button
                            type="button"
                            onClick={() => toggleCompare(agent.id)}
                            title="Compare this agent"
                            className={`flex items-center justify-center w-6 h-6 rounded border transition-colors ${
                              isInCompare
                                ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                                : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                            }`}
                          >
                            <GitCompare size={11} />
                          </button>
                          {!CORE_AGENT_IDS.includes(agent.id) && (
                            <button
                              type="button"
                              disabled={firing === agent.id}
                              onClick={async () => {
                                if (!confirm(`Fire ${agent.name}? Their workspace will be archived.`)) return;
                                setFiring(agent.id);
                                try {
                                  await catalogApi.fireAgent(agent.id);
                                  await fetchAgents();
                                  await load(false);
                                } finally { setFiring(null); }
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-error hover:bg-mission-control-border/40 transition-colors disabled:opacity-50"
                            >
                              <Trash2 size={10} /> Fire
                            </button>
                          )}
                        </Flex>
                      ) : (
                        <Flex gap="2">
                          {/* Quick Hire / Hire Agent */}
                          <Button
                            type="button"
                            onClick={() => setHiringAgent(agent)}
                            size="1"
                            variant="soft"
                            style={{ flex: 1, justifyContent: 'center' }}
                          >
                            {isHovered ? <><Zap size={12} /> Quick Hire</> : <><Bot size={12} /> Hire Agent</>}
                          </Button>
                          {/* Compare toggle */}
                          <button
                            type="button"
                            onClick={() => toggleCompare(agent.id)}
                            title={isInCompare ? 'Remove from comparison' : 'Add to comparison'}
                            className={`flex items-center justify-center w-6 h-6 rounded border transition-colors ${
                              isInCompare
                                ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                                : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                            }`}
                          >
                            <GitCompare size={11} />
                          </button>
                        </Flex>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Flex>}

      {/* Hire wizard */}
      {hiringAgent && (
        <AgentHireWizard
          agent={hiringAgent}
          onClose={() => setHiringAgent(null)}
          onHired={() => { load(false); onHire?.(hiringAgent); }}
        />
      )}

      {/* Compare modal */}
      {showCompare && compareIds.length === 2 && (
        <AgentCompareModal
          agentIds={compareIds}
          onClose={() => setShowCompare(false)}
        />
      )}
    </>
  );
}
