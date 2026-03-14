// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, CheckSquare, Bot, BookOpen, Library, Megaphone, Zap,
  Download, X, ArrowUpDown, Calendar,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
type SortMode = 'relevance' | 'date' | 'name';

interface GroupConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
  titleField: string;
  subtitleField?: string;
  dateField?: string;
  nav: string;
}

const GROUP_CONFIGS: GroupConfig[] = [
  { key: 'tasks', label: 'Tasks', icon: <CheckSquare size={16} />, titleField: 'title', subtitleField: 'status', dateField: 'updatedAt', nav: 'kanban' },
  { key: 'agents', label: 'Agents', icon: <Bot size={16} />, titleField: 'name', subtitleField: 'role', nav: 'agents' },
  { key: 'knowledge', label: 'Knowledge', icon: <BookOpen size={16} />, titleField: 'title', subtitleField: 'category', dateField: 'updatedAt', nav: 'knowledge' },
  { key: 'library', label: 'Library', icon: <Library size={16} />, titleField: 'name', subtitleField: 'category', dateField: 'createdAt', nav: 'library' },
  { key: 'campaigns', label: 'Campaigns', icon: <Megaphone size={16} />, titleField: 'name', subtitleField: 'status', dateField: 'updatedAt', nav: 'campaigns' },
  { key: 'automations', label: 'Automations', icon: <Zap size={16} />, titleField: 'name', subtitleField: 'status', dateField: 'updated_at', nav: 'automations' },
];

interface SearchResultsPageProps {
  initialQuery?: string;
  onNavigate?: (view: string, id?: string) => void;
  onClose?: () => void;
}

interface GroupResult {
  items: Record<string, unknown>[];
  total: number;
}

type SearchData = Record<string, GroupResult>;

// ── Helpers ───────────────────────────────────────────────────────────────────
function getField(item: Record<string, unknown>, field: string): string {
  return String(item[field] ?? '');
}

function sortItems(items: Record<string, unknown>[], cfg: GroupConfig, mode: SortMode): Record<string, unknown>[] {
  if (mode === 'date' && cfg.dateField) {
    return [...items].sort((a, b) => {
      const da = Number(a[cfg.dateField!]) || new Date(String(a[cfg.dateField!] ?? '')).getTime() || 0;
      const db = Number(b[cfg.dateField!]) || new Date(String(b[cfg.dateField!] ?? '')).getTime() || 0;
      return db - da;
    });
  }
  if (mode === 'name') {
    return [...items].sort((a, b) =>
      getField(a, cfg.titleField).localeCompare(getField(b, cfg.titleField))
    );
  }
  return items; // relevance = API order
}

function filterByDate(
  items: Record<string, unknown>[],
  dateField: string | undefined,
  from: string,
  to: string
): Record<string, unknown>[] {
  if (!dateField || (!from && !to)) return items;
  const fromMs = from ? new Date(from).getTime() : 0;
  const toMs = to ? new Date(to).getTime() + 86400000 : Infinity; // inclusive end
  return items.filter(item => {
    const raw = item[dateField];
    const ms = typeof raw === 'number' ? raw : new Date(String(raw ?? '')).getTime();
    if (isNaN(ms)) return true; // keep items without date
    return ms >= fromMs && ms <= toMs;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SearchResultsPage({ initialQuery = '', onNavigate, onClose }: SearchResultsPageProps) {
  const [draftQuery, setDraftQuery] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [data, setData] = useState<SearchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(
    () => new Set(GROUP_CONFIGS.map(g => g.key))
  );
  const [sortMode, setSortMode] = useState<SortMode>('relevance');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const runSearch = useCallback(async (q: string, types: Set<string>) => {
    if (!q || q.trim().length < 2) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const typesParam = types.size < GROUP_CONFIGS.length
        ? `&types=${[...types].join(',')}`
        : '';
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&limit=50${typesParam}`);
      if (!res.ok) throw new Error('Search failed');
      const json = await res.json() as SearchData;
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runSearch(query, enabledTypes);
  }, [query, enabledTypes, runSearch]);

  // ── Handle search submit ───────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(draftQuery.trim());
  };

  // ── Toggle type filter ─────────────────────────────────────────────────────
  const toggleType = (key: string) => {
    setEnabledTypes(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // keep at least 1
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    if (!data) return;
    const rows: string[] = ['Type,Title,Subtitle,Date'];
    for (const cfg of GROUP_CONFIGS) {
      const group = data[cfg.key];
      if (!group || group.items.length === 0) continue;
      for (const item of group.items) {
        const title = getField(item, cfg.titleField).replace(/"/g, '""');
        const subtitle = cfg.subtitleField ? getField(item, cfg.subtitleField).replace(/"/g, '""') : '';
        const date = cfg.dateField ? getField(item, cfg.dateField) : '';
        rows.push(`"${cfg.label}","${title}","${subtitle}","${date}"`);
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-${query.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, query]);

  // ── Processed groups for display ───────────────────────────────────────────
  const processedGroups = useMemo(() => {
    if (!data) return [];
    return GROUP_CONFIGS
      .filter(cfg => enabledTypes.has(cfg.key))
      .map(cfg => {
        const group = data[cfg.key];
        if (!group || group.items.length === 0) return null;
        const dated = filterByDate(group.items, cfg.dateField, dateFrom, dateTo);
        const sorted = sortItems(dated, cfg, sortMode);
        return { cfg, items: sorted, total: group.total };
      })
      .filter(Boolean) as { cfg: GroupConfig; items: Record<string, unknown>[]; total: number }[];
  }, [data, enabledTypes, sortMode, dateFrom, dateTo]);

  const totalResults = processedGroups.reduce((s, g) => s + g.total, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-mission-control-border">
        <form onSubmit={handleSubmit} className="flex items-center gap-3 flex-1">
          <Search size={20} className="text-mission-control-text-dim flex-shrink-0" aria-hidden="true" />
          <input
            type="text"
            value={draftQuery}
            onChange={e => setDraftQuery(e.target.value)}
            placeholder="Search everything..."
            className="flex-1 bg-transparent outline-none text-lg"
            aria-label="Search query"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-mission-control-accent text-white rounded-lg text-sm hover:opacity-90 transition-opacity"
          >
            Search
          </button>
        </form>
        {query && (
          <span className="text-sm text-mission-control-text-dim flex-shrink-0">
            {loading ? 'Searching...' : `${totalResults} results`}
          </span>
        )}
        {data && (
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-mission-control-border hover:bg-mission-control-surface rounded-lg transition-colors flex-shrink-0"
            title="Export as CSV"
          >
            <Download size={14} aria-hidden="true" />
            Export
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="text-mission-control-text-dim hover:text-mission-control-text flex-shrink-0"
            aria-label="Close search"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Body: sidebar + results */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 border-r border-mission-control-border p-4 overflow-y-auto">
          {/* Type filters */}
          <div className="mb-6">
            <div className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider mb-2">
              Result Types
            </div>
            <div className="space-y-1.5">
              {GROUP_CONFIGS.map(cfg => (
                <label
                  key={cfg.key}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={enabledTypes.has(cfg.key)}
                    onChange={() => toggleType(cfg.key)}
                    className="rounded"
                  />
                  <span className="text-mission-control-text-dim group-hover:text-mission-control-text transition-colors" aria-hidden="true">
                    {cfg.icon}
                  </span>
                  <span className="text-sm">{cfg.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="mb-6">
            <div className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider mb-2 flex items-center gap-1">
              <Calendar size={12} aria-hidden="true" />
              Date Range
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-mission-control-text-dim mb-0.5 block">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full text-xs bg-mission-control-surface border border-mission-control-border rounded px-2 py-1 outline-none focus:border-mission-control-accent"
                />
              </div>
              <div>
                <label className="text-xs text-mission-control-text-dim mb-0.5 block">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full text-xs bg-mission-control-surface border border-mission-control-border rounded px-2 py-1 outline-none focus:border-mission-control-accent"
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-xs text-mission-control-text-dim hover:text-mission-control-text"
                >
                  Clear dates
                </button>
              )}
            </div>
          </div>

          {/* Sort */}
          <div>
            <div className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider mb-2 flex items-center gap-1">
              <ArrowUpDown size={12} aria-hidden="true" />
              Sort By
            </div>
            <div className="space-y-1">
              {(['relevance', 'date', 'name'] as SortMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setSortMode(mode)}
                  className={`w-full text-left px-2 py-1 text-sm rounded transition-colors capitalize ${
                    sortMode === mode
                      ? 'bg-mission-control-accent text-white'
                      : 'text-mission-control-text-dim hover:bg-mission-control-border'
                  }`}
                  aria-pressed={sortMode === mode}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Results area */}
        <main className="flex-1 overflow-y-auto p-4">
          {!query && (
            <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim">
              <Search size={48} className="mb-4 opacity-30" aria-hidden="true" />
              <p className="text-lg">Enter a query to search across all content</p>
            </div>
          )}

          {query && loading && (
            <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim">
              <p>Searching for &quot;{query}&quot;...</p>
            </div>
          )}

          {query && !loading && processedGroups.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim">
              <p className="text-lg">No results found for &quot;{query}&quot;</p>
              <p className="text-sm mt-2">Try different keywords or adjust the filters</p>
            </div>
          )}

          {processedGroups.map(({ cfg, items, total }) => (
            <section key={cfg.key} className="mb-8" aria-labelledby={`section-${cfg.key}`}>
              <h2
                id={`section-${cfg.key}`}
                className="flex items-center gap-2 text-sm font-semibold text-mission-control-text-dim uppercase tracking-wider mb-3 pb-2 border-b border-mission-control-border"
              >
                <span aria-hidden="true">{cfg.icon}</span>
                {cfg.label}
                <span className="ml-auto font-normal normal-case tracking-normal">
                  {items.length < total ? `${items.length} of ${total}` : `${total}`}
                </span>
              </h2>

              <div className="space-y-2">
                {items.map(item => {
                  const itemId = String(item.id ?? '');
                  const title = getField(item, cfg.titleField);
                  const subtitle = cfg.subtitleField ? getField(item, cfg.subtitleField) : '';
                  const dateRaw = cfg.dateField ? item[cfg.dateField] : undefined;
                  const dateStr = dateRaw
                    ? typeof dateRaw === 'number'
                      ? new Date(dateRaw).toLocaleDateString()
                      : String(dateRaw).split('T')[0]
                    : '';

                  return (
                    <div
                      key={itemId}
                      role="button"
                      tabIndex={0}
                      onClick={() => onNavigate?.(cfg.nav, itemId)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onNavigate?.(cfg.nav, itemId); }}
                      className="flex items-center gap-3 p-3 rounded-lg border border-mission-control-border hover:bg-mission-control-surface transition-colors cursor-pointer"
                    >
                      <span className="text-mission-control-text-dim flex-shrink-0" aria-hidden="true">{cfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{title}</div>
                        {subtitle && (
                          <div className="text-xs text-mission-control-text-dim truncate">{subtitle}</div>
                        )}
                      </div>
                      {dateStr && (
                        <div className="text-xs text-mission-control-text-dim flex-shrink-0">{dateStr}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
