// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Full-page search results — triggered by pressing Enter in command palette.
// Features: type filter sidebar, date range, sort, export CSV.

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, CheckSquare, Bot, BookOpen, Library, Megaphone, Zap,
  ChevronRight, Clock, ArrowUp, ArrowDown, Download, X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupedResult {
  items: Record<string, unknown>[];
  total: number;
}

interface SearchResponse {
  tasks: GroupedResult;
  agents: GroupedResult;
  knowledge: GroupedResult;
  library: GroupedResult;
  campaigns: GroupedResult;
  automations: GroupedResult;
}

type SortMode = 'relevance' | 'date' | 'name';
type GroupKey = keyof SearchResponse;

interface SearchResultsPageProps {
  initialQuery?: string;
  onNavigate?: (view: string, id?: string) => void;
  onClose?: () => void;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const GROUP_CONFIG: {
  key: GroupKey;
  label: string;
  icon: React.ReactNode;
  titleField: string;
  subtitleField?: string;
  dateField?: string;
  nav: string;
}[] = [
  { key: 'tasks',       label: 'Tasks',       icon: <CheckSquare size={16} />, titleField: 'title',  subtitleField: 'status',      dateField: 'updatedAt',   nav: 'kanban' },
  { key: 'agents',      label: 'Agents',      icon: <Bot size={16} />,         titleField: 'name',   subtitleField: 'role',        dateField: undefined,     nav: 'agents' },
  { key: 'knowledge',   label: 'Knowledge',   icon: <BookOpen size={16} />,    titleField: 'title',  subtitleField: 'category',    dateField: 'updatedAt',   nav: 'knowledge' },
  { key: 'library',     label: 'Library',     icon: <Library size={16} />,     titleField: 'name',   subtitleField: 'category',    dateField: 'createdAt',   nav: 'library' },
  { key: 'campaigns',   label: 'Campaigns',   icon: <Megaphone size={16} />,   titleField: 'name',   subtitleField: 'status',      dateField: 'updatedAt',   nav: 'campaigns' },
  { key: 'automations', label: 'Automations', icon: <Zap size={16} />,         titleField: 'name',   subtitleField: 'status',      dateField: 'updated_at',  nav: 'automations' },
];

const PAGE_SIZE = 20;

// ─── Component ────────────────────────────────────────────────────────────────

export default function SearchResultsPage({ initialQuery = '', onNavigate, onClose }: SearchResultsPageProps) {
  const [query, setQuery] = useState(initialQuery);
  const [draftQuery, setDraftQuery] = useState(initialQuery);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [enabledTypes, setEnabledTypes] = useState<Set<GroupKey>>(new Set(GROUP_CONFIG.map(g => g.key)));
  const [sortMode, setSortMode] = useState<SortMode>('relevance');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [offsets, setOffsets] = useState<Record<GroupKey, number>>({
    tasks: 0, agents: 0, knowledge: 0, library: 0, campaigns: 0, automations: 0,
  });

  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(async (q: string, currentOffsets: Record<GroupKey, number>) => {
    if (!q || q.length < 2) { setData(null); return; }
    setLoading(true);
    try {
      const types = [...enabledTypes].join(',');
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&types=${types}&limit=${PAGE_SIZE}&offset=0`
      );
      if (!res.ok) throw new Error('Search failed');
      const json = await res.json() as SearchResponse;
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [enabledTypes]);

  // Run search when query or type filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      runSearch(query, offsets);
    }, 250);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, enabledTypes]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(draftQuery);
    setOffsets({ tasks: 0, agents: 0, knowledge: 0, library: 0, campaigns: 0, automations: 0 });
  };

  const toggleType = (key: GroupKey) => {
    setEnabledTypes(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // ── Sort items in a group ─────────────────────────────────────────────────

  function sortItems(items: Record<string, unknown>[], cfg: typeof GROUP_CONFIG[0]): Record<string, unknown>[] {
    if (sortMode === 'name') {
      return [...items].sort((a, b) =>
        String(a[cfg.titleField] ?? '').localeCompare(String(b[cfg.titleField] ?? ''))
      );
    }
    if (sortMode === 'date' && cfg.dateField) {
      return [...items].sort((a, b) => {
        const da = a[cfg.dateField!] ? new Date(String(a[cfg.dateField!])).getTime() : 0;
        const db_ = b[cfg.dateField!] ? new Date(String(b[cfg.dateField!])).getTime() : 0;
        return db_ - da;
      });
    }
    return items; // relevance = API order
  }

  // ── Date filter ───────────────────────────────────────────────────────────

  function filterByDate(items: Record<string, unknown>[], dateField?: string): Record<string, unknown>[] {
    if (!dateField || (!dateFrom && !dateTo)) return items;
    return items.filter(item => {
      const raw = item[dateField];
      if (!raw) return true;
      const d = new Date(String(raw)).getTime();
      const from = dateFrom ? new Date(dateFrom).getTime() : 0;
      const to = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : Infinity;
      return d >= from && d <= to;
    });
  }

  // ── CSV export ────────────────────────────────────────────────────────────

  const exportCSV = () => {
    if (!data) return;
    const rows: string[][] = [['type', 'id', 'title', 'subtitle', 'status', 'date']];
    for (const cfg of GROUP_CONFIG) {
      if (!enabledTypes.has(cfg.key)) continue;
      const group = data[cfg.key];
      for (const item of group.items) {
        rows.push([
          cfg.label,
          String(item.id ?? ''),
          String(item[cfg.titleField] ?? ''),
          cfg.subtitleField ? String(item[cfg.subtitleField] ?? '') : '',
          String(item.status ?? ''),
          cfg.dateField ? String(item[cfg.dateField] ?? '') : '',
        ]);
      }
    }
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-${query}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Total count ───────────────────────────────────────────────────────────

  const totalCount = data
    ? GROUP_CONFIG.filter(g => enabledTypes.has(g.key)).reduce((n, g) => n + (data[g.key]?.total ?? 0), 0)
    : 0;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-mission-control-bg text-mission-control-text">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 p-4 border-b border-mission-control-border bg-mission-control-surface">
        <form onSubmit={handleSubmit} className="flex items-center gap-3 flex-1">
          <Search size={20} className="text-mission-control-accent flex-shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={draftQuery}
            onChange={e => setDraftQuery(e.target.value)}
            placeholder="Search everything..."
            aria-label="Search query"
            className="flex-1 bg-transparent outline-none text-base placeholder-mission-control-text-dim"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-mission-control-accent text-white text-sm rounded-lg hover:bg-mission-control-accent-dim transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2 ml-2">
          {totalCount > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-mission-control-border hover:bg-mission-control-border rounded-lg transition-colors"
              title="Export results as CSV"
            >
              <Download size={14} />
              Export CSV
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-mission-control-border rounded-lg transition-colors"
              aria-label="Close search"
            >
              <X size={16} className="text-mission-control-text-dim" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Sidebar ── */}
        <aside className="w-56 flex-shrink-0 border-r border-mission-control-border bg-mission-control-surface overflow-y-auto p-4 space-y-6">
          {/* Type filters */}
          <div>
            <p className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider mb-2">Content Type</p>
            <div className="space-y-1">
              {GROUP_CONFIG.map(cfg => {
                const count = data?.[cfg.key]?.total ?? 0;
                const checked = enabledTypes.has(cfg.key);
                return (
                  <label key={cfg.key} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleType(cfg.key)}
                      className="rounded border-mission-control-border text-mission-control-accent focus:ring-mission-control-accent"
                    />
                    <span className={`flex items-center gap-1.5 text-sm flex-1 ${checked ? 'text-mission-control-text' : 'text-mission-control-text-dim'}`}>
                      <span aria-hidden="true">{cfg.icon}</span>
                      {cfg.label}
                    </span>
                    {data && (
                      <span className="text-xs text-mission-control-text-dim">{count}</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Date range */}
          <div>
            <p className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock size={12} aria-hidden="true" />
              Date Range
            </p>
            <div className="space-y-2">
              <div>
                <label htmlFor="srp-date-from" className="text-xs text-mission-control-text-dim">From</label>
                <input
                  id="srp-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full mt-0.5 px-2 py-1 text-xs bg-mission-control-bg-alt border border-mission-control-border rounded-lg outline-none focus:border-mission-control-accent"
                />
              </div>
              <div>
                <label htmlFor="srp-date-to" className="text-xs text-mission-control-text-dim">To</label>
                <input
                  id="srp-date-to"
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full mt-0.5 px-2 py-1 text-xs bg-mission-control-bg-alt border border-mission-control-border rounded-lg outline-none focus:border-mission-control-accent"
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-xs text-mission-control-text-dim hover:text-mission-control-accent transition-colors"
                >
                  Clear dates
                </button>
              )}
            </div>
          </div>

          {/* Sort */}
          <div>
            <p className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider mb-2">Sort By</p>
            <div className="space-y-1">
              {(['relevance', 'date', 'name'] as SortMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setSortMode(mode)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-lg transition-colors text-left ${
                    sortMode === mode
                      ? 'bg-mission-control-accent text-white'
                      : 'hover:bg-mission-control-border text-mission-control-text-dim'
                  }`}
                >
                  {mode === 'relevance' && <Search size={13} aria-hidden="true" />}
                  {mode === 'date' && <ArrowDown size={13} aria-hidden="true" />}
                  {mode === 'name' && <ArrowUp size={13} aria-hidden="true" />}
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Results Area ── */}
        <main className="flex-1 overflow-y-auto p-6" aria-label="Search results">
          {/* Summary bar */}
          {data && query.length >= 2 && (
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-mission-control-text-dim">
                {loading ? 'Searching...' : `${totalCount} result${totalCount !== 1 ? 's' : ''} for "${query}"`}
              </p>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-mission-control-surface rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {/* Empty query state */}
          {!loading && !query && (
            <div className="flex flex-col items-center justify-center h-64 text-mission-control-text-dim">
              <Search size={40} className="mb-3 opacity-30" />
              <p className="text-lg">Enter a query to search</p>
              <p className="text-sm mt-1">Type in the search bar above and press Enter</p>
            </div>
          )}

          {/* No results */}
          {!loading && data && totalCount === 0 && query.length >= 2 && (
            <div className="flex flex-col items-center justify-center h-64 text-mission-control-text-dim">
              <Search size={40} className="mb-3 opacity-30" />
              <p className="text-lg">No results found</p>
              <p className="text-sm mt-1">Try adjusting your filters or search terms</p>
            </div>
          )}

          {/* Result groups */}
          {!loading && data && GROUP_CONFIG.map(cfg => {
            if (!enabledTypes.has(cfg.key)) return null;
            const group = data[cfg.key];
            if (!group || group.total === 0) return null;

            const displayed = sortItems(filterByDate(group.items, cfg.dateField), cfg);

            if (displayed.length === 0) return null;

            return (
              <section key={cfg.key} className="mb-8" aria-labelledby={`srp-section-${cfg.key}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-mission-control-accent" aria-hidden="true">{cfg.icon}</span>
                  <h2
                    id={`srp-section-${cfg.key}`}
                    className="font-semibold text-base"
                  >
                    {cfg.label}
                  </h2>
                  <span className="text-sm text-mission-control-text-dim">
                    ({group.total})
                  </span>
                </div>

                <div className="space-y-2">
                  {displayed.map((item, idx) => {
                    const title = String(item[cfg.titleField] ?? '');
                    const subtitle = cfg.subtitleField ? String(item[cfg.subtitleField] ?? '') : '';
                    const dateRaw = cfg.dateField ? item[cfg.dateField] : undefined;
                    const dateStr = dateRaw ? new Date(String(dateRaw)).toLocaleDateString() : '';
                    const id = String(item.id ?? idx);

                    return (
                      <div
                        key={id}
                        onClick={() => onNavigate?.(cfg.nav, id)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate?.(cfg.nav, id); } }}
                        role="button"
                        tabIndex={0}
                        className="flex items-center gap-3 p-3 bg-mission-control-surface border border-mission-control-border rounded-xl cursor-pointer hover:border-mission-control-accent/40 hover:bg-mission-control-bg-alt transition-all group"
                      >
                        <span className="text-mission-control-text-dim flex-shrink-0" aria-hidden="true">{cfg.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{title}</p>
                          {subtitle && (
                            <p className="text-xs text-mission-control-text-dim truncate">{subtitle}</p>
                          )}
                        </div>
                        {dateStr && (
                          <span className="text-xs text-mission-control-text-dim flex-shrink-0">{dateStr}</span>
                        )}
                        <ChevronRight
                          size={14}
                          className="text-mission-control-text-dim flex-shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Load more (client-side — show all from API response for now) */}
                {group.total > displayed.length && (
                  <p className="mt-2 text-xs text-mission-control-text-dim text-center">
                    Showing {displayed.length} of {group.total} — refine your query to see more
                  </p>
                )}
              </section>
            );
          })}
        </main>
      </div>
    </div>
  );
}
