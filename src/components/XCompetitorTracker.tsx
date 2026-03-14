// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// XCompetitorTracker — competitor handle tracking with mock engagement data and gap analysis

import { useState, useCallback } from 'react';
import {
  Target,
  TrendingUp,
  Plus,
  X,
  RefreshCw,
  AlertCircle,
  Users,
  BarChart2,
} from 'lucide-react';
import { showToast } from './Toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CompetitorData {
  handle: string;
  followerCount: number;
  postsPerWeek: number;
  avgEngagementRate: number;
  topContentTypes: string[];
  doingWell: string[];
  gapOpportunities: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LS_KEY = 'x-competitor-handles';

function loadHandles(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function saveHandles(handles: string[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(handles));
  } catch {
    // best-effort
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Competitor card ─────────────────────────────────────────────────────────

interface CompetitorCardProps {
  data: CompetitorData;
  onRemove: (handle: string) => void;
}

function CompetitorCard({ data, onRemove }: CompetitorCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-mission-control-border rounded-lg bg-mission-control-surface overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between p-4 border-b border-mission-control-border">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: 'var(--color-info-subtle)', color: 'var(--color-info)' }}
          >
            {data.handle[0].toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium text-mission-control-text">@{data.handle}</div>
            <div className="text-xs text-mission-control-text-dim flex items-center gap-1">
              <Users size={11} />
              {formatNumber(data.followerCount)} followers
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs px-2 py-1 rounded border border-mission-control-border hover:bg-mission-control-bg-alt transition-colors text-mission-control-text-dim"
          >
            {expanded ? 'Less' : 'Details'}
          </button>
          <button
            onClick={() => onRemove(data.handle)}
            aria-label={`Remove @${data.handle}`}
            className="text-mission-control-text-dim hover:text-error transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 divide-x divide-mission-control-border text-center py-3">
        <div className="px-3">
          <div className="text-base font-semibold text-mission-control-text">{data.postsPerWeek}</div>
          <div className="text-xs text-mission-control-text-dim mt-0.5">posts/week</div>
        </div>
        <div className="px-3">
          <div className="text-base font-semibold text-mission-control-text">{data.avgEngagementRate}%</div>
          <div className="text-xs text-mission-control-text-dim mt-0.5">avg engagement</div>
        </div>
        <div className="px-3">
          <div className="text-base font-semibold text-mission-control-text">{data.topContentTypes.length}</div>
          <div className="text-xs text-mission-control-text-dim mt-0.5">content types</div>
        </div>
      </div>

      {/* Top content types */}
      <div className="px-4 pb-3">
        <div className="text-xs text-mission-control-text-dim mb-1.5">Top content types</div>
        <div className="flex flex-wrap gap-1.5">
          {data.topContentTypes.map(type => (
            <span
              key={type}
              className="px-2 py-0.5 text-xs rounded"
              style={{ background: 'var(--color-mission-control-bg-alt)', color: 'var(--color-mission-control-text-dim)' }}
            >
              {type}
            </span>
          ))}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-mission-control-border p-4 space-y-4">
          {/* Doing well */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium mb-2" style={{ color: 'var(--color-success)' }}>
              <TrendingUp size={13} />
              What they are doing well
            </div>
            <ul className="space-y-1">
              {data.doingWell.map((point, i) => (
                <li key={i} className="text-xs text-mission-control-text flex items-start gap-2">
                  <span className="mt-1 flex-shrink-0 w-1 h-1 rounded-full" style={{ background: 'var(--color-success)' }} />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Gap opportunities */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium mb-2" style={{ color: 'var(--color-warning)' }}>
              <Target size={13} />
              Gap opportunities for you
            </div>
            <ul className="space-y-1">
              {data.gapOpportunities.map((point, i) => (
                <li key={i} className="text-xs text-mission-control-text flex items-start gap-2">
                  <span className="mt-1 flex-shrink-0 w-1 h-1 rounded-full" style={{ background: 'var(--color-warning)' }} />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function XCompetitorTracker() {
  const [handles, setHandles] = useState<string[]>(loadHandles);
  const [competitors, setCompetitors] = useState<CompetitorData[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCompetitors = useCallback(async (hs: string[]) => {
    if (hs.length === 0) {
      setCompetitors([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/x/competitors?handles=${hs.join(',')}`);
      if (!res.ok) throw new Error('Failed to fetch competitor data');
      const data: { competitors: CompetitorData[] } = await res.json();
      setCompetitors(data.competitors);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAdd = () => {
    const handle = inputValue.trim().replace(/^@/, '').toLowerCase();
    if (!handle) return;
    if (handles.includes(handle)) {
      showToast('info', 'Already tracking', `@${handle} is already in your list`);
      setInputValue('');
      return;
    }
    if (handles.length >= 10) {
      showToast('error', 'Limit reached', 'You can track up to 10 competitors');
      return;
    }
    const updated = [...handles, handle];
    setHandles(updated);
    saveHandles(updated);
    setInputValue('');
    fetchCompetitors(updated);
  };

  const handleRemove = (handle: string) => {
    const updated = handles.filter(h => h !== handle);
    setHandles(updated);
    saveHandles(updated);
    setCompetitors(prev => prev.filter(c => c.handle !== handle));
  };

  const handleRefresh = () => fetchCompetitors(handles);

  // Auto-fetch on mount if handles exist
  useState(() => {
    if (handles.length > 0) {
      fetchCompetitors(handles);
    }
  });

  return (
    <div className="flex flex-col h-full bg-mission-control-bg overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-mission-control-border">
        <div className="flex items-center gap-2 mb-1">
          <Target size={20} style={{ color: 'var(--color-warning)' }} />
          <h2 className="text-lg font-semibold text-mission-control-text">Competitor Tracker</h2>
        </div>
        <p className="text-sm text-mission-control-text-dim">
          Monitor competitor accounts and identify content gaps.
        </p>
      </div>

      <div className="flex-1 p-4 space-y-6">
        {/* Add handle input */}
        <div>
          <label className="block text-sm font-medium text-mission-control-text mb-2">
            Track a competitor
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mission-control-text-dim">@</span>
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                placeholder="handle"
                className="w-full pl-7 pr-3 py-2 text-sm border border-mission-control-border rounded-lg bg-mission-control-bg text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': 'var(--color-info)' } as React.CSSProperties}
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!inputValue.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg transition-colors disabled:opacity-50"
              style={{ background: 'var(--color-info)', color: '#fff' }}
            >
              <Plus size={16} />
              Add
            </button>
          </div>
          <p className="text-xs text-mission-control-text-dim mt-1.5">
            Track up to 10 competitors. Data is mocked — real API integration is stubbed.
          </p>
        </div>

        {/* Tracked handles chips */}
        {handles.length > 0 && competitors.length === 0 && !loading && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-mission-control-text">Tracked accounts ({handles.length})</span>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1 text-xs text-mission-control-text-dim hover:text-mission-control-text"
              >
                <RefreshCw size={12} />
                Load data
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {handles.map(h => (
                <div
                  key={h}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-mission-control-border text-mission-control-text"
                >
                  @{h}
                  <button onClick={() => handleRemove(h)} aria-label={`Remove @${h}`}>
                    <X size={12} className="text-mission-control-text-dim hover:text-error" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12 text-mission-control-text-dim">
            <div className="w-6 h-6 border-2 border-info border-t-transparent rounded-full animate-spin mr-3" />
            Loading competitor data...
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div
            className="flex items-center gap-2 p-3 rounded-lg text-sm"
            style={{ background: 'var(--color-error-subtle)', color: 'var(--color-error)' }}
          >
            <AlertCircle size={16} />
            {error}
            <button onClick={handleRefresh} className="ml-auto underline text-xs">Retry</button>
          </div>
        )}

        {/* Competitor cards */}
        {!loading && competitors.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart2 size={16} className="text-mission-control-text-dim" />
                <span className="text-sm font-medium text-mission-control-text">
                  Competitor Analysis ({competitors.length})
                </span>
              </div>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-1 text-xs text-mission-control-text-dim hover:text-mission-control-text"
              >
                <RefreshCw size={12} />
                Refresh
              </button>
            </div>
            <div className="space-y-3">
              {competitors.map(c => (
                <CompetitorCard key={c.handle} data={c} onRemove={handleRemove} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {handles.length === 0 && (
          <div className="text-center py-12 text-mission-control-text-dim border border-dashed border-mission-control-border rounded-lg">
            <Target size={36} className="mx-auto mb-3 opacity-40" />
            <div className="text-sm font-medium mb-1">No competitors tracked yet</div>
            <div className="text-xs">Add competitor handles above to start monitoring</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default XCompetitorTracker;
