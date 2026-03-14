import { useState, useEffect, useCallback } from 'react';
import {
  Puzzle,
  CheckCircle,
  Download,
  Search,
  RefreshCw,
  Shield,
  Bot,
  Key,
  Package,
  Trash2,
  MessageSquare,
  Settings,
  Calendar,
  BarChart3,
  Inbox,
  LayoutGrid,
  Wrench,
  Library,
  PenLine,
  Bell,
  Users,
  Clock,
  CheckSquare,
  Megaphone,
  User,
  DollarSign,
  Mic,
  FolderKanban,
  AlertTriangle,
  XCircle,
  Loader2,
  Filter,
  type LucideIcon,
} from 'lucide-react';
import { useStore } from '../store/store';

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
  'agent-mgmt':   Users,
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
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';
import { showToast } from './Toast';
import EmptyState from './EmptyState';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  core:           'text-review border-review-border bg-review-subtle',
  productivity:   'text-info border-info-border bg-info-subtle',
  communications: 'text-success border-success-border bg-success-subtle',
  social:         'text-violet-400 border-violet-400/30 bg-violet-400/10',
  finance:        'text-amber-400 border-amber-400/30 bg-amber-400/10',
  system:         'text-mission-control-text-dim border-mission-control-border bg-mission-control-surface',
  agent:          'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',
};

const FILTER_CATEGORIES = ['All', 'Productivity', 'Social', 'Analytics', 'Custom'] as const;
type FilterCategory = (typeof FILTER_CATEGORIES)[number];

// ─── Activity log helpers ────────────────────────────────────────────────────

const ACTIVITY_KEY = 'module_activity_log';

interface ModuleActivityEntry {
  id: string;
  moduleId: string;
  moduleName: string;
  action: 'install' | 'uninstall' | 'enable' | 'disable';
  timestamp: number;
}

function readActivityLog(): ModuleActivityEntry[] {
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function appendActivity(entry: Omit<ModuleActivityEntry, 'id' | 'timestamp'>) {
  const log = readActivityLog();
  const next: ModuleActivityEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };
  // Keep last 20 entries in storage, display last 5
  const updated = [next, ...log].slice(0, 20);
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(updated));
}

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.system;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type InstallPhase = 'idle' | 'installing' | 'installed' | 'error';

interface ModuleLibraryPanelProps {
  onInstall?: (module: CatalogModule) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ModuleLibraryPanel({ onInstall }: ModuleLibraryPanelProps) {
  const agents = useStore(s => s.agents);
  const installedAgentIds = agents.map(a => a.id);

  const [modules, setModules]           = useState<CatalogModule[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [search, setSearch]             = useState('');
  const [filter, setFilter]             = useState<'all' | 'installed' | 'available'>('all');
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('All');
  const [refreshing, setRefreshing]     = useState(false);
  const [installTarget, setInstallTarget] = useState<CatalogModule | null>(null);
  const [uninstalling, setUninstalling] = useState<string | null>(null);
  const [installState, setInstallState] = useState<Record<string, InstallPhase>>({});
  const [installErrors, setInstallErrors] = useState<Record<string, string>>({});
  const [activityLog, setActivityLog]   = useState<ModuleActivityEntry[]>([]);

  const { open: confirmOpen, config: confirmConfig, onConfirm: onConfirmCallback, showConfirm, closeConfirm } = useConfirmDialog();

  const refreshActivity = useCallback(() => {
    setActivityLog(readActivityLog().slice(0, 5));
  }, []);

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

  useEffect(() => {
    load();
    refreshActivity();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Filtering ──────────────────────────────────────────────────────────────

  const filtered = modules
    .filter(m => {
      const matchesSearch = !search ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        (m.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
        m.category.toLowerCase().includes(search.toLowerCase());

      const matchesInstallFilter =
        filter === 'all' ? true :
        filter === 'installed' ? m.installed :
        !m.installed;

      const matchesCategoryFilter =
        categoryFilter === 'All' ? true :
        categoryFilter === 'Custom' ? !m.core :
        m.category.toLowerCase() === categoryFilter.toLowerCase();

      return matchesSearch && matchesInstallFilter && matchesCategoryFilter;
    })
    .sort((a, b) => {
      if (a.core && !b.core) return -1;
      if (!a.core && b.core) return 1;
      return 0;
    });

  const installedCount = modules.filter(m => m.installed).length;
  const availableCount = modules.filter(m => !m.installed).length;
  const coreCount      = modules.filter(m => m.core).length;

  // ─── Install handler ────────────────────────────────────────────────────────

  function handleInstallClick(module: CatalogModule) {
    setInstallTarget(module);
    setInstallState(prev => ({ ...prev, [module.id]: 'installing' }));
    onInstall?.(module);
  }

  // ─── Settings navigation ────────────────────────────────────────────────────

  function navigateToModuleSettings(moduleId: string) {
    // Store the target module so SettingsPanel can scroll/focus to it
    sessionStorage.setItem('settings-focus-module', moduleId);
    window.dispatchEvent(new CustomEvent('tour-navigate', { detail: { view: 'settings' } }));
  }

  // ─── Loading / Error states ─────────────────────────────────────────────────

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
          className="px-4 py-2 text-sm border border-mission-control-border rounded-lg hover:bg-mission-control-surface transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

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

      {/* Search + installed/available toggle */}
      <div className="flex items-center gap-2 mb-3">
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

      {/* Category filter pills */}
      <div className="flex items-center gap-1.5 mb-5 flex-wrap">
        <Filter size={12} className="text-mission-control-text-dim flex-shrink-0" />
        {FILTER_CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              categoryFilter === cat
                ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent'
                : 'border-mission-control-border text-mission-control-text-dim hover:border-mission-control-text-dim'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Module grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Puzzle}
          title="No modules found"
          description="No modules match your current search or filters."
          size="sm"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(module => {
            const catCls      = categoryColor(module.category);
            const phase       = installState[module.id] ?? 'idle';
            const installErr  = installErrors[module.id];

            // Module-level dependencies from manifest (modules field)
            // CatalogModule doesn't expose dependencies.modules directly,
            // but requiredAgents and requiredNpm serve this purpose.
            const deps = [
              ...module.requiredAgents,
              ...module.requiredNpm,
              ...module.requiredApis,
            ];
            const missingDeps = module.requiredAgents.filter(id => !installedAgentIds.includes(id));

            return (
              <div
                key={module.id}
                className={`rounded-xl border-2 p-4 transition-all duration-200 flex flex-col ${
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
                      {/* Core badge */}
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

                  {/* Settings gear for installed non-core modules */}
                  {module.installed && !module.core && (
                    <button
                      type="button"
                      title={`Open settings for ${module.name}`}
                      aria-label={`Open settings for ${module.name}`}
                      onClick={() => navigateToModuleSettings(module.id)}
                      className="flex-shrink-0 p-1.5 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                    >
                      <Settings size={14} />
                    </button>
                  )}
                </div>

                {/* Category badge + agent badge */}
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

                {/* Dependency tags */}
                {deps.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {module.requiredApis.map(api => (
                      <span
                        key={`api-${api}`}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border border-amber-400/30 bg-amber-400/10 text-amber-400"
                        title="API key required"
                      >
                        <Key size={9} />
                        {api}
                      </span>
                    ))}
                    {module.requiredNpm.map(pkg => (
                      <span
                        key={`npm-${pkg}`}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border border-mission-control-border bg-mission-control-surface text-mission-control-text-dim"
                        title="npm package required"
                      >
                        <Package size={9} />
                        {pkg}
                      </span>
                    ))}
                    {module.requiredAgents.map(agentId => {
                      const installed = installedAgentIds.includes(agentId);
                      return (
                        <span
                          key={`agent-${agentId}`}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${
                            installed
                              ? 'border-success-border bg-success-subtle text-success'
                              : 'border-amber-400/30 bg-amber-400/10 text-amber-400'
                          }`}
                          title={installed ? `Agent ${agentId} installed` : `Requires agent: ${agentId}`}
                        >
                          <Bot size={9} />
                          {!installed && <span>Requires:</span>}
                          {agentId}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Dependencies warnings (not-installed modules) */}
                {!module.installed && missingDeps.length > 0 && (
                  <div className="flex items-center gap-1 text-[11px] text-warning mb-2">
                    <AlertTriangle size={10} className="flex-shrink-0" />
                    <span>Missing agents: {missingDeps.join(', ')}</span>
                  </div>
                )}

                {/* Spacer pushes action to bottom */}
                <div className="flex-1" />

                {/* Action area */}
                <div className="pt-2 border-t border-mission-control-border">
                  {module.core ? (
                    /* Core module — always active, no toggle */
                    <div className="flex items-center gap-1.5 text-xs text-review">
                      <Shield size={12} className="flex-shrink-0" />
                      <span>Core module — always active</span>
                    </div>
                  ) : module.installed ? (
                    /* Installed non-core — show state + uninstall */
                    <div className="flex items-center gap-2">
                      {phase === 'installing' ? (
                        <div className="flex items-center gap-1.5 text-xs text-info flex-1">
                          <Loader2 size={12} className="animate-spin flex-shrink-0" />
                          <span>Installing…</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-success flex-1">
                          <CheckCircle size={12} className="flex-shrink-0" />
                          <span>Installed{module.enabled ? ' & enabled' : ' (disabled)'}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={uninstalling === module.id}
                        onClick={() => {
                          showConfirm({
                            title: `Uninstall ${module.name}?`,
                            message: `This will remove ${module.name} from the nav and disable its features.`,
                            confirmLabel: 'Uninstall',
                            type: 'danger',
                          }, async () => {
                            setUninstalling(module.id);
                            try {
                              await catalogApi.uninstallModule(module.id);
                              ModuleLoader.disableModule(module.id);
                              usePanelConfigStore.getState().syncWithViewRegistry();
                              appendActivity({ moduleId: module.id, moduleName: module.name, action: 'uninstall' });
                              refreshActivity();
                              await load(false);
                            } catch (err) {
                              showToast('error', 'Uninstall failed', (err as Error).message);
                            } finally {
                              setUninstalling(null);
                            }
                          });
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] text-error border border-error-border rounded hover:bg-error-subtle transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={10} /> Uninstall
                      </button>
                    </div>
                  ) : phase === 'installing' ? (
                    /* In-flight install indicator on the card */
                    <div className="flex items-center gap-1.5 text-xs text-info">
                      <Loader2 size={12} className="animate-spin flex-shrink-0" />
                      <span>Installing…</span>
                    </div>
                  ) : phase === 'error' ? (
                    /* Error state */
                    <div className="flex items-center gap-1.5 text-xs text-error">
                      <XCircle size={12} className="flex-shrink-0" />
                      <span className="line-clamp-1">{installErr ?? 'Installation failed'}</span>
                    </div>
                  ) : (
                    /* Default: install button */
                    <button
                      type="button"
                      onClick={() => handleInstallClick(module)}
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

      {/* Install modal */}
      {installTarget && (
        <ModuleInstallModal
          module={installTarget}
          onClose={() => {
            // If modal closed without completion, revert to idle
            setInstallState(prev => {
              if (prev[installTarget.id] === 'installing') {
                return { ...prev, [installTarget.id]: 'idle' };
              }
              return prev;
            });
            setInstallTarget(null);
          }}
          onInstalled={async (moduleId: string) => {
            setInstallState(prev => ({ ...prev, [moduleId]: 'installed' }));
            appendActivity({
              moduleId,
              moduleName: modules.find(m => m.id === moduleId)?.name ?? moduleId,
              action: 'install',
            });
            refreshActivity();
            setInstallTarget(null);
            await ModuleLoader.enableModule(moduleId);
            usePanelConfigStore.getState().syncWithViewRegistry();
            load(false);
          }}
        />
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={closeConfirm}
        onConfirm={onConfirmCallback}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmLabel={confirmConfig.confirmLabel}
        cancelLabel={confirmConfig.cancelLabel}
        type={confirmConfig.type}
      />

      {/* Recent activity log */}
      {activityLog.length > 0 && (
        <div className="mt-8 border-t border-mission-control-border pt-5">
          <h3 className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wide mb-3">
            Recent Activity
          </h3>
          <div className="space-y-1.5">
            {activityLog.map(entry => (
              <div key={entry.id} className="flex items-center gap-2.5 text-xs text-mission-control-text-dim">
                {entry.action === 'install' && <CheckCircle size={12} className="text-success flex-shrink-0" />}
                {entry.action === 'uninstall' && <Trash2 size={12} className="text-error flex-shrink-0" />}
                {entry.action === 'enable' && <CheckCircle size={12} className="text-info flex-shrink-0" />}
                {entry.action === 'disable' && <XCircle size={12} className="text-mission-control-text-dim flex-shrink-0" />}
                <span className="flex-1">
                  <span className="text-mission-control-text font-medium">{entry.moduleName}</span>
                  {' '}{entry.action}ed
                </span>
                <span className="flex-shrink-0 tabular-nums">{formatRelativeTime(entry.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
