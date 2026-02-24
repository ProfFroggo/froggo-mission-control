/**
 * MarketplaceBrowse — Marketplace browse page.
 *
 * Fetches the module registry from froggo.pro via IPC and displays:
 * - Module cards with Install / Update / Uninstall actions
 * - Category filter chips
 * - Search input
 * - Update-available badges (registry version > installed version)
 * - Restart-required banner after install/update
 * - Loading skeleton cards while fetching
 *
 * All IPC calls go through window.clawdbot.marketplace.* preload bridges.
 * Uninstall confirmation is handled by Electron's dialog.showMessageBox in the
 * main process — no ConfirmDialog import needed here.
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
    <div className="bg-clawd-surface border border-clawd-border rounded-xl p-4 space-y-3">
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
          ? 'border-clawd-accent bg-clawd-accent/10 text-clawd-accent'
          : 'border-clawd-border text-clawd-text-dim hover:border-clawd-text-dim'
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
  hasUpdate,
  isInstalling,
  onInstall,
  onUninstall,
  onUpdate,
}: {
  mod: RegistryModule;
  installed: boolean;
  hasUpdate: boolean;
  isInstalling: boolean;
  onInstall: (mod: RegistryModule) => void;
  onUninstall: (moduleId: string) => void;
  onUpdate: (mod: RegistryModule) => void;
}) {
  const IconComponent = resolveIcon(mod.icon);

  return (
    <div className="bg-clawd-surface border border-clawd-border rounded-xl p-4 transition-all hover:border-clawd-text-dim/30 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-clawd-accent/10 flex items-center justify-center flex-shrink-0">
          <IconComponent size={20} className="text-clawd-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-clawd-text text-sm">{mod.name}</span>
            {mod.agent && (
              <span className="inline-flex items-center gap-0.5 text-xs bg-clawd-accent/15 text-clawd-accent px-1.5 py-0.5 rounded font-medium">
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
          <span className="text-xs text-clawd-text-dim">
            v{mod.version}
            {mod.author && ` · ${mod.author}`}
          </span>
        </div>
      </div>

      {/* Description */}
      {mod.description && (
        <p className="text-sm text-clawd-text-dim line-clamp-2 leading-relaxed">
          {mod.description}
        </p>
      )}

      {/* Footer: category + downloads + actions */}
      <div className="mt-auto flex items-center gap-2 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded-full bg-clawd-border/60 text-clawd-text-dim capitalize">
          {mod.category}
        </span>
        {mod.downloads > 0 && (
          <span className="text-xs text-clawd-text-dim">
            {mod.downloads.toLocaleString()} installs
          </span>
        )}

        {/* Action buttons */}
        <div className="ml-auto flex items-center gap-2">
          {isInstalling ? (
            <span className="flex items-center gap-1.5 text-xs text-clawd-text-dim px-3 py-1.5">
              <Loader2 size={13} className="animate-spin" />
              Installing…
            </span>
          ) : !installed ? (
            <button
              type="button"
              onClick={() => onInstall(mod)}
              className="flex items-center gap-1.5 text-xs font-medium bg-green-600/90 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download size={13} />
              Install
            </button>
          ) : hasUpdate ? (
            <>
              <button
                type="button"
                onClick={() => onUpdate(mod)}
                className="flex items-center gap-1.5 text-xs font-medium bg-amber-500/90 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                <RefreshCw size={13} />
                Update
              </button>
              <button
                type="button"
                onClick={() => onUninstall(mod.id)}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-2 py-1.5 rounded-lg border border-clawd-border hover:border-red-500/40 transition-colors"
                title="Uninstall"
              >
                <Trash2 size={13} />
              </button>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                <CheckCircle size={13} />
                Installed
              </span>
              <button
                type="button"
                onClick={() => onUninstall(mod.id)}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-2 py-1.5 rounded-lg border border-clawd-border hover:border-red-500/40 transition-colors"
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
      const mp = (window as any).clawdbot.marketplace;
      if (!mp) {
        setError('Marketplace IPC bridge not available.');
        return;
      }

      // 1. Fetch registry
      const registryResult = await mp.fetchRegistry();
      if (!registryResult?.success) {
        setError(registryResult?.error ?? 'Failed to load marketplace registry.');
        return;
      }

      const mods: RegistryModule[] = registryResult.registry?.modules ?? [];
      setModules(mods);

      // 2. Fetch status for each module in parallel
      const statusEntries = await Promise.all(
        mods.map(async (m: RegistryModule) => {
          try {
            const result = await mp.getModuleStatus(m.id);
            return [
              m.id,
              {
                installed: !!result?.installed,
                module: result?.module ?? undefined,
              } as InstalledInfo,
            ] as const;
          } catch {
            return [m.id, { installed: false }] as const;
          }
        }),
      );
      setInstalledMap(Object.fromEntries(statusEntries));

      // 3. Check for available updates
      try {
        const updatesResult = await mp.checkUpdates();
        if (updatesResult?.success) {
          setUpdates(updatesResult.updates ?? []);
        }
      } catch {
        // Non-critical — just leave updates empty
      }
    } catch (err: any) {
      setError(err?.message ?? 'Unexpected error loading marketplace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Subscribe to restart-required events
    const mp = (window as any).clawdbot?.marketplace;
    if (!mp?.onRestartRequired) return;
    const unsub = mp.onRestartRequired(() => setRestartBanner(true));
    return unsub;
  }, [loadData]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleInstall(mod: RegistryModule) {
    // Agent package — route to agent install modal
    if (mod.agent) {
      setAgentInstallEntry(mod);
      setAgentInstallOpen(true);
      return;
    }

    const mp = (window as any).clawdbot?.marketplace;
    if (!mp) return;
    setInstalling(mod.id);
    try {
      const result = await mp.installModule(mod.id, mod.name, mod.version);
      if (result?.success) {
        if (result.restartRequired) setRestartBanner(true);
        // Refresh status for this module
        const statusResult = await mp.getModuleStatus(mod.id);
        setInstalledMap((prev) => ({
          ...prev,
          [mod.id]: {
            installed: !!statusResult?.installed,
            module: statusResult?.module ?? undefined,
          },
        }));
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
    const mp = (window as any).clawdbot?.marketplace;
    if (!mp) return;
    try {
      const result = await mp.uninstallModule(moduleId);
      if (result?.success && result.uninstalled) {
        // Refresh status
        const statusResult = await mp.getModuleStatus(moduleId);
        setInstalledMap((prev) => ({
          ...prev,
          [moduleId]: {
            installed: !!statusResult?.installed,
            module: statusResult?.module ?? undefined,
          },
        }));
        // Remove from updates list
        setUpdates((prev) => prev.filter((u) => u.moduleId !== moduleId));
      }
      // If result.uninstalled === false, user cancelled — no-op
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
          Please restart Froggo.app to apply changes.
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
          <Store size={22} className="text-clawd-accent flex-shrink-0" />
          <h1 className="text-2xl font-semibold text-clawd-text">Marketplace</h1>
        </div>
        <p className="text-clawd-text-dim text-sm">Browse and install modules to extend your dashboard</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-clawd-text-dim pointer-events-none" />
        <input
          type="text"
          placeholder="Search modules…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-clawd-surface border border-clawd-border rounded-lg pl-9 pr-4 py-2 text-sm text-clawd-text placeholder:text-clawd-text-dim focus:outline-none focus:border-clawd-accent transition-colors"
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
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-clawd-text-dim">
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
