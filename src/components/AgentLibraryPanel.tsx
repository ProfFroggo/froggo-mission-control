import { useState, useEffect } from 'react';
import { Bot, CheckCircle, UserPlus, Search, RefreshCw, Cpu, Sparkles } from 'lucide-react';
import { catalogApi } from '../lib/api';
import type { CatalogAgent } from '../types/catalog';
import { Spinner } from './LoadingStates';

const CATEGORY_LABELS: Record<string, string> = {
  core:       'Core',
  specialist: 'Specialist',
  creative:   'Creative',
  ops:        'Ops',
  finance:    'Finance',
  comms:      'Comms',
  dev:        'Dev',
};

const MODEL_BADGE: Record<string, { label: string; cls: string }> = {
  opus:    { label: 'Opus',    cls: 'bg-review-subtle text-review border border-review-border' },
  sonnet:  { label: 'Sonnet',  cls: 'bg-info-subtle text-info border border-info-border' },
  haiku:   { label: 'Haiku',   cls: 'bg-warning-subtle text-warning border border-warning-border' },
};

interface AgentLibraryPanelProps {
  onHire?: (agent: CatalogAgent) => void;
}

export default function AgentLibraryPanel({ onHire }: AgentLibraryPanelProps) {
  const [agents, setAgents]       = useState<CatalogAgent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState<'all' | 'hired' | 'available'>('all');
  const [refreshing, setRefreshing] = useState(false);

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

  const filtered = agents.filter(a => {
    const matchesSearch = !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.role ?? '').toLowerCase().includes(search.toLowerCase()) ||
      a.capabilities.some(c => c.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter =
      filter === 'all' ? true :
      filter === 'hired' ? a.installed :
      !a.installed;
    return matchesSearch && matchesFilter;
  });

  const hiredCount = agents.filter(a => a.installed).length;
  const availableCount = agents.filter(a => !a.installed).length;

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
        <button type="button" onClick={() => load()} className="px-4 py-2 text-sm border border-mission-control-border rounded-lg hover:bg-mission-control-surface transition-colors">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <span className="icon-text text-success">
          <CheckCircle size={14} className="flex-shrink-0" />
          {hiredCount} hired
        </span>
        <span className="icon-text text-mission-control-text-dim">
          <Bot size={14} className="flex-shrink-0" />
          {availableCount} available
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => load(false)}
          disabled={refreshing}
          className="icon-btn border border-mission-control-border disabled:opacity-50"
          title="Refresh catalog"
          aria-label="Refresh catalog"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search agents…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent"
          />
        </div>
        <div className="flex border border-mission-control-border rounded-lg overflow-hidden text-xs">
          {(['all', 'hired', 'available'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-2 capitalize transition-colors ${
                filter === f
                  ? 'bg-mission-control-accent text-white'
                  : 'hover:bg-mission-control-surface'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-mission-control-text-dim">
          <Bot size={32} className="mx-auto mb-2 opacity-40" />
          <p>No agents match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(agent => {
            const modelBadge = MODEL_BADGE[agent.model] ?? MODEL_BADGE.sonnet;
            const categoryLabel = CATEGORY_LABELS[agent.category] ?? agent.category;

            return (
              <div
                key={agent.id}
                className={`rounded-xl border-2 p-4 transition-all duration-200 ${
                  agent.installed
                    ? 'border-success-border bg-success-subtle/30'
                    : 'border-mission-control-border hover:border-mission-control-accent/40'
                }`}
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-mission-control-bg flex items-center justify-center text-2xl border border-mission-control-border">
                    {agent.emoji || '🤖'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span className="font-semibold text-sm leading-tight">{agent.name}</span>
                      {agent.installed && (
                        <CheckCircle size={13} className="text-success flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-mission-control-text-dim line-clamp-2">
                      {agent.role || agent.description || '—'}
                    </p>
                  </div>
                </div>

                {/* Badges row */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-mission-control-bg border border-mission-control-border text-mission-control-text-dim uppercase tracking-wide">
                    {categoryLabel}
                  </span>
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${modelBadge.cls}`}>
                    {modelBadge.label}
                  </span>
                </div>

                {/* Capabilities */}
                {agent.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {agent.capabilities.slice(0, 4).map((cap, i) => (
                      <span key={i} className="px-1.5 py-0.5 text-[11px] rounded-md bg-mission-control-surface border border-mission-control-border text-mission-control-text-dim">
                        {cap}
                      </span>
                    ))}
                    {agent.capabilities.length > 4 && (
                      <span className="text-[11px] text-mission-control-text-dim px-1">
                        +{agent.capabilities.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {/* Required APIs warning */}
                {agent.requiredApis.length > 0 && !agent.installed && (
                  <div className="flex items-center gap-1 text-[11px] text-warning mb-3">
                    <Cpu size={11} className="flex-shrink-0" />
                    <span>Requires: {agent.requiredApis.join(', ')}</span>
                  </div>
                )}

                {/* Action */}
                <div className="pt-2 border-t border-mission-control-border">
                  {agent.installed ? (
                    <div className="flex items-center gap-1.5 text-xs text-success">
                      <CheckCircle size={13} className="flex-shrink-0" />
                      <span>Hired &amp; active</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onHire?.(agent)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors"
                    >
                      <Sparkles size={12} />
                      Hire Agent
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
