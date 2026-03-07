import { useState, useEffect } from 'react';
import { Puzzle, CheckCircle, Download, Search, RefreshCw, Shield, Bot, Key, Package, Trash2, MessageSquare, Settings, Calendar, BarChart3, Inbox, LayoutGrid, Wrench, Library, PenLine, Bell, Users, Clock, CheckSquare, Megaphone, User, DollarSign, Mic, FolderKanban, type LucideIcon } from 'lucide-react';

const MODULE_ICONS: Record<string, LucideIcon> = {
  chat:           MessageSquare,
  settings:       Settings,
  meetings:       Calendar,
  analytics:      BarChart3,
  inbox:          Inbox,
  kanban:         LayoutGrid,
  dev:            Wrench,
  library:        Library,
  writing:        PenLine,
  notifications:  Bell,
  'agent-mgmt':   Bot,
  schedule:       Clock,
  approvals:      CheckSquare,
  twitter:        Megaphone,
  accounts:       User,
  'module-builder': Puzzle,
  finance:        DollarSign,
  voice:          Mic,
  modules:        Package,
  projects:       FolderKanban,
};
import { catalogApi } from '../lib/api';
import type { CatalogModule } from '../types/catalog';
import { Spinner } from './LoadingStates';
import ModuleInstallModal from './ModuleInstallModal';
import { ModuleLoader } from '../core/ModuleLoader';
import { usePanelConfigStore } from '../store/panelConfig';

const CATEGORY_COLORS: Record<string, string> = {
  core:           'text-review border-review-border bg-review-subtle',
  productivity:   'text-info border-info-border bg-info-subtle',
  communications: 'text-success border-success-border bg-success-subtle',
  social:         'text-violet-400 border-violet-400/30 bg-violet-400/10',
  finance:        'text-amber-400 border-amber-400/30 bg-amber-400/10',
  system:         'text-mission-control-text-dim border-mission-control-border bg-mission-control-surface',
  agent:          'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',
};

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.system;
}

interface ModuleLibraryPanelProps {
  onInstall?: (module: CatalogModule) => void;
}

export default function ModuleLibraryPanel({ onInstall }: ModuleLibraryPanelProps) {
  const [modules, setModules]       = useState<CatalogModule[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [filter, setFilter]             = useState<'all' | 'installed' | 'available'>('all');
  const [refreshing, setRefreshing]     = useState(false);
  const [installTarget, setInstallTarget] = useState<CatalogModule | null>(null);
  const [uninstalling, setUninstalling] = useState<string | null>(null);

  const load = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await catalogApi.listModules();
      setModules(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load module catalog');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = modules
    .filter(m => {
      const matchesSearch = !search ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        (m.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
        m.category.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === 'all' ? true :
        filter === 'installed' ? m.installed :
        !m.installed;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      // Core modules always first
      if (a.core && !b.core) return -1;
      if (!a.core && b.core) return 1;
      return 0;
    });

  const installedCount = modules.filter(m => m.installed).length;
  const availableCount = modules.filter(m => !m.installed).length;
  const coreCount = modules.filter(m => m.core).length;

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
      <div className="flex items-center gap-4 mb-4 text-sm flex-wrap">
        <span className="icon-text text-success">
          <CheckCircle size={14} className="flex-shrink-0" />
          {installedCount} installed
        </span>
        <span className="icon-text text-mission-control-text-dim">
          <Package size={14} className="flex-shrink-0" />
          {availableCount} available
        </span>
        <span className="icon-text text-review">
          <Shield size={14} className="flex-shrink-0" />
          {coreCount} core
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
      <div className="flex items-center gap-2 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search modules…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent"
          />
        </div>
        <div className="flex border border-mission-control-border rounded-lg overflow-hidden text-xs">
          {(['all', 'installed', 'available'] as const).map(f => (
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
          <Puzzle size={32} className="mx-auto mb-2 opacity-40" />
          <p>No modules match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(module => {
            const catCls = categoryColor(module.category);

            return (
              <div
                key={module.id}
                className={`rounded-xl border-2 p-4 transition-all duration-200 ${
                  module.installed
                    ? 'border-success-border bg-success-subtle/20'
                    : 'border-mission-control-border hover:border-mission-control-accent/40'
                }`}
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-mission-control-bg flex items-center justify-center border border-mission-control-border text-mission-control-text-dim">
                    {(() => { const Icon = MODULE_ICONS[module.id] ?? Package; return <Icon size={20} />; })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span className="font-semibold text-sm leading-tight">{module.name}</span>
                      {module.core && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-review border border-review-border bg-review-subtle">
                          Core
                        </span>
                      )}
                      {module.installed && !module.core && (
                        <CheckCircle size={12} className="text-success flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-mission-control-text-dim line-clamp-2">
                      {module.description || '—'}
                    </p>
                  </div>
                </div>

                {/* Category badge */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border capitalize ${catCls}`}>
                    {module.category}
                  </span>
                  {module.responsibleAgent && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-mission-control-surface border border-mission-control-border text-mission-control-text-dim">
                      <Bot size={9} />
                      {module.responsibleAgent}
                    </span>
                  )}
                </div>

                {/* Dependencies warnings (only for not-installed) */}
                {!module.installed && (
                  <div className="space-y-1 mb-3">
                    {module.requiredApis.length > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-warning">
                        <Key size={10} className="flex-shrink-0" />
                        <span>Requires: {module.requiredApis.join(', ')}</span>
                      </div>
                    )}
                    {module.requiredAgents.length > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-info">
                        <Bot size={10} className="flex-shrink-0" />
                        <span>Needs agents: {module.requiredAgents.join(', ')}</span>
                      </div>
                    )}
                    {module.requiredNpm.length > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-mission-control-text-dim">
                        <Package size={10} className="flex-shrink-0" />
                        <span>npm: {module.requiredNpm.join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action */}
                <div className="pt-2 border-t border-mission-control-border">
                  {module.core ? (
                    <div className="flex items-center gap-1.5 text-xs text-review">
                      <Shield size={12} className="flex-shrink-0" />
                      <span>Core module — always active</span>
                    </div>
                  ) : module.installed ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-success flex-1">
                        <CheckCircle size={12} className="flex-shrink-0" />
                        <span>Installed{module.enabled ? ' & enabled' : ' (disabled)'}</span>
                      </div>
                      <button
                        type="button"
                        disabled={uninstalling === module.id}
                        onClick={async () => {
                          if (!confirm(`Uninstall ${module.name}? It will be removed from the nav.`)) return;
                          setUninstalling(module.id);
                          try {
                            await catalogApi.uninstallModule(module.id);
                            ModuleLoader.disableModule(module.id);
                            usePanelConfigStore.getState().syncWithViewRegistry();
                            await load(false);
                          } finally { setUninstalling(null); }
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] text-error border border-error-border rounded hover:bg-error-subtle transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={10} /> Uninstall
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setInstallTarget(module); onInstall?.(module); }}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors"
                    >
                      <Download size={12} />
                      Install Module
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {installTarget && (
        <ModuleInstallModal
          module={installTarget}
          onClose={() => setInstallTarget(null)}
          onInstalled={async (moduleId: string) => {
            setInstallTarget(null);
            await ModuleLoader.enableModule(moduleId);
            usePanelConfigStore.getState().syncWithViewRegistry();
            load(false);
          }}
        />
      )}
    </div>
  );
}
