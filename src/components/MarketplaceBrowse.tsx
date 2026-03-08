/**
 * MarketplaceBrowse — Marketplace browse page.
 *
 * Fetches the module registry via REST API and displays:
 * - Module cards with Install / Update / Uninstall actions
 * - Category filter chips
 * - Search input
 * - Update-available badges (registry version > installed version)
 * - Restart-required banner after install/update
 * - Loading skeleton cards while fetching
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Download,
  PackageCheck,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle,
  Store,
  Puzzle,
  DollarSign,
  Settings,
  BarChart2,
  FolderOpen,
  Twitter,
  BookOpen,
  MessageSquare,
  Users,
  Zap,
  Globe,
  Calendar,
  Bell,
  Code2,
  Mic,
  TrendingUp,
  Layout,
  Star,
  Layers,
  Search,
  ShieldCheck,
  Loader2,
  Bot,
} from 'lucide-react';
import { Skeleton } from './LoadingStates';
import AgentInstallModal from './AgentInstallModal';
import { marketplaceApi } from '../lib/api';
import { showToast } from './Toast';

// ─── Icon mapping ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  DollarSign,
  Settings,
  BarChart2,
  FolderOpen,
  Twitter,
  BookOpen,
  MessageSquare,
  Puzzle,
  Users,
  Zap,
  Globe,
  Calendar,
  Bell,
  Code2,
  Mic,
  TrendingUp,
  Layout,
  Star,
  Layers,
  Store,
  Bot,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveIcon(iconName?: string): React.ComponentType<any> {
  if (!iconName) return Puzzle;
  return ICON_MAP[iconName] ?? Puzzle;
}

// ─── Types matching IPC response shapes ───────────────────────────────────────

interface RegistryModule {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: string;
  downloads: number;
  verified: boolean;
  sha256: string;
  icon?: string;
  tags?: string[];
  manifestUrl: string;
  packageUrl: string;
  updatedAt?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent?: any;
}

interface InstalledModuleRow {
  installed_version: string;
  enabled: number;
  [key: string]: unknown;
}

interface InstalledInfo {
  installed: boolean;
  builtin?: boolean;
  module?: InstalledModuleRow;
}

interface UpdateInfo {
  moduleId: string;
  installedVersion: string;
  latestVersion: string;
}

// ─── Skeleton card ─────────────────────────────────────────────────────────────

function MarketplaceCardSkeleton() {
  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton width="w-10" height="h-10" rounded="lg" />
        <div className="flex-1 space-y-1.5">
          <Skeleton width="w-28" height="h-4" />
          <Skeleton width="w-20" height="h-3" />
        </div>
      </div>
      <Skeleton width="w-full" height="h-3" />
      <Skeleton width="w-4/5" height="h-3" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton width="w-16" height="h-5" rounded="full" />
        <Skeleton width="w-24" height="h-7" rounded="lg" />
      </div>
    </div>
  );
}

// ─── Category chip ─────────────────────────────────────────────────────────────

function CategoryChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
        selected
          ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent'
          : 'border-mission-control-border text-mission-control-text-dim hover:border-mission-control-text-dim'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Module card ───────────────────────────────────────────────────────────────

function ModuleCard({
  mod,
  installed,
  builtin,
  hasUpdate,
  isInstalling,
  onInstall,
  onUninstall,
  onUpdate,
}: {
  mod: RegistryModule;
  installed: boolean;
  builtin?: boolean;
  hasUpdate: boolean;
  isInstalling: boolean;
  onInstall: (mod: RegistryModule) => void;
  onUninstall: (moduleId: string) => void;
  onUpdate: (mod: RegistryModule) => void;
}) {
  const IconComponent = resolveIcon(mod.icon);

  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4 transition-all hover:border-mission-control-text-dim/30 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-mission-control-accent/10 flex items-center justify-center flex-shrink-0">
          <IconComponent size={20} className="text-mission-control-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-mission-control-text text-sm">{mod.name}</span>
            {mod.agent && (
              <span className="inline-flex items-center gap-0.5 text-xs bg-mission-control-accent/15 text-mission-control-accent px-1.5 py-0.5 rounded font-medium">
                <Bot size={10} />
                Agent
              </span>
            )}
            {mod.verified && (
              <ShieldCheck size={13} className="text-blue-400 flex-shrink-0" aria-label="Verified" />
            )}
            {hasUpdate && (
              <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-medium">
                Update available
              </span>
            )}
          </div>
          <span className="text-xs text-mission-control-text-dim">
            v{mod.version}
            {mod.author && ` · ${mod.author}`}
          </span>
        </div>
      </div>

      {/* Description */}
      {mod.description && (
        <p className="text-sm text-mission-control-text-dim line-clamp-2 leading-relaxed">
          {mod.description}
        </p>
      )}

      {/* Footer: category + downloads + actions */}
      <div className="mt-auto flex items-center gap-2 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded-full bg-mission-control-border/60 text-mission-control-text-dim capitalize">
          {mod.category}
        </span>
        {mod.downloads > 0 && (
          <span className="text-xs text-mission-control-text-dim">
            {mod.downloads.toLocaleString()} installs
          </span>
        )}

        {/* Action buttons */}
        <div className="ml-auto flex items-center gap-2">
          {isInstalling ? (
            <span className="flex items-center gap-1.5 text-xs text-mission-control-text-dim px-3 py-1.5">
              <Loader2 size={13} className="animate-spin" />
              Installing…
            </span>
          ) : !installed ? (
            <button
              type="button"
              onClick={() => onInstall(mod)}
              className="flex items-center gap-1.5 text-xs font-medium bg-success/90 hover:bg-success text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download size={13} />
              Install
            </button>
          ) : hasUpdate ? (
            <>
              <button
                type="button"
                onClick={() => onUpdate(mod)}
                className="flex items-center gap-1.5 text-xs font-medium bg-warning/90 hover:bg-warning text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                <RefreshCw size={13} />
                Update
              </button>
              <button
                type="button"
                onClick={() => onUninstall(mod.id)}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-2 py-1.5 rounded-lg border border-mission-control-border hover:border-red-500/40 transition-colors"
                title="Uninstall"
              >
                <Trash2 size={13} />
              </button>
            </>
          ) : builtin ? (
            <span className="flex items-center gap-1.5 text-xs text-mission-control-accent font-medium">
              <PackageCheck size={13} />
              Built-in
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                <CheckCircle size={13} />
                Installed
              </span>
              <button
                type="button"
                onClick={() => onUninstall(mod.id)}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-2 py-1.5 rounded-lg border border-mission-control-border hover:border-red-500/40 transition-colors"
                title="Uninstall"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function MarketplaceBrowse() {
  const [modules, setModules] = useState<RegistryModule[]>([]);
  const [installedMap, setInstalledMap] = useState<Record<string, InstalledInfo>>({});
  const [updates, setUpdates] = useState<UpdateInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [restartBanner, setRestartBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Agent package install modal state
  const [agentInstallEntry, setAgentInstallEntry] = useState<RegistryModule | null>(null);
  const [agentInstallOpen, setAgentInstallOpen] = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch module and agent listings from REST API
      const [modulesResult, agentsResult] = await Promise.all([
        marketplaceApi.listModules().catch(() => ({ modules: [] })),
        marketplaceApi.listAgents().catch(() => ({ agents: [] })),
      ]);

      const mods: RegistryModule[] = [
        ...(modulesResult?.modules || modulesResult || []),
        ...(agentsResult?.agents || agentsResult || []),
      ];
      setModules(mods);

      // 2. Build installed map from the data returned
      const statusEntries = mods.map((m: RegistryModule) => {
        return [
          m.id,
          {
            installed: !!(m as any).installed,
            builtin: !!(m as any).builtin,
            module: undefined,
          } as InstalledInfo,
        ] as const;
      });
      setInstalledMap(Object.fromEntries(statusEntries));
    } catch (err: any) {
      setError(err?.message ?? 'Unexpected error loading marketplace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-install from deep link
  useEffect(() => {
    const pendingId = sessionStorage.getItem('marketplace-pending-install');
    if (!pendingId || loading || !modules.length) return;
    sessionStorage.removeItem('marketplace-pending-install');
    const mod = modules.find(m => m.id === pendingId);
    if (mod && !installedMap[mod.id]?.installed) {
      handleInstall(mod);
    }
  }, [modules, loading, installedMap]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleInstall(mod: RegistryModule) {
    // Agent package — route to agent install modal
    if (mod.agent) {
      setAgentInstallEntry(mod);
      setAgentInstallOpen(true);
      return;
    }

    setInstalling(mod.id);
    try {
      const result = await marketplaceApi.installModule(mod.id);
      if (result?.success) {
        if (result.restartRequired) setRestartBanner(true);
        setInstalledMap((prev) => ({
          ...prev,
          [mod.id]: { installed: true, module: undefined },
        }));
        showToast('success', 'Installed', `${mod.name} installed successfully`);
      } else {
        setError(result?.error ?? `Failed to install ${mod.name}.`);
      }
    } catch (err: any) {
      setError(err?.message ?? `Error installing ${mod.name}.`);
    } finally {
      setInstalling(null);
    }
  }

  async function handleUninstall(moduleId: string) {
    try {
      const result = await fetch(`/api/marketplace/modules/${moduleId}/uninstall`, { method: 'POST' }).then(r => r.ok ? r.json() : null).catch(() => null);
      if (result?.success) {
        setInstalledMap((prev) => ({
          ...prev,
          [moduleId]: { installed: false, module: undefined },
        }));
        setUpdates((prev) => prev.filter((u) => u.moduleId !== moduleId));
        showToast('success', 'Uninstalled', 'Module removed');
      }
    } catch (err: any) {
      setError(err?.message ?? `Error uninstalling module.`);
    }
  }

  async function handleUpdate(mod: RegistryModule) {
    // Update is a re-install with newer version
    await handleInstall(mod);
    // Remove from pending updates list on success
    setUpdates((prev) => prev.filter((u) => u.moduleId !== mod.id));
  }

  // ── Filtering ─────────────────────────────────────────────────────────────────

  const categories = Array.from(new Set(modules.map((m) => m.category))).sort();

  const filteredModules = modules.filter((m) => {
    const matchesCategory = !activeCategory || m.category === activeCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      (m.tags ?? []).some((t) => t.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  const updateSet = new Set(updates.map((u) => u.moduleId));

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      {/* Restart banner */}
      {restartBanner && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
          <AlertCircle size={15} className="flex-shrink-0" />
          Please restart Mission Control.app to apply changes.
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle size={15} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <Store size={22} className="text-mission-control-accent flex-shrink-0" />
          <h1 className="text-xl font-semibold text-mission-control-text">Marketplace</h1>
        </div>
        <p className="text-mission-control-text-dim text-sm">Browse and install modules to extend your dashboard</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim pointer-events-none" />
        <input
          type="text"
          placeholder="Search modules…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg pl-9 pr-4 py-2 text-sm text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:border-mission-control-accent transition-colors"
        />
      </div>

      {/* Category filter */}
      {!loading && categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <CategoryChip
            label="All"
            selected={activeCategory === null}
            onClick={() => setActiveCategory(null)}
          />
          {categories.map((cat) => (
            <CategoryChip
              key={cat}
              label={cat}
              selected={activeCategory === cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            />
          ))}
        </div>
      )}

      {/* Module grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <MarketplaceCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-mission-control-text-dim">
          <PackageCheck size={36} className="opacity-40" />
          <span className="text-sm">
            {searchQuery || activeCategory
              ? 'No modules match your filter.'
              : 'No modules found in the registry.'}
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredModules.map((mod) => (
            <ModuleCard
              key={mod.id}
              mod={mod}
              installed={installedMap[mod.id]?.installed ?? false}
              builtin={installedMap[mod.id]?.builtin}
              hasUpdate={updateSet.has(mod.id)}
              isInstalling={installing === mod.id}
              onInstall={handleInstall}
              onUninstall={handleUninstall}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}

      {/* Agent install modal */}
      {agentInstallOpen && agentInstallEntry?.agent && (
        <AgentInstallModal
          isOpen={agentInstallOpen}
          entry={agentInstallEntry as any}
          onInstalled={() => {
            setAgentInstallOpen(false);
            setAgentInstallEntry(null);
            loadData();
          }}
          onCancel={() => {
            setAgentInstallOpen(false);
            setAgentInstallEntry(null);
          }}
        />
      )}
    </div>
  );
}
