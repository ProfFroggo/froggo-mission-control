/**
 * ModulesPage — Module management hub.
 *
 * Displays all registered modules as cards with:
 * - Name, version, author, description, category
 * - Credential status dot (green/yellow/red) with tooltip
 * - Enabled/disabled toggle wired to panelConfig + ModuleLoader lifecycle
 * - Configure button that opens IntegrationWizard for credential re-entry
 * - Category filter chips
 *
 * Three visual card states:
 *   Active        — full opacity, green dot (module status 'active' + panel visible)
 *   Disconnected  — opacity-60, yellow dot (credentials set but panel hidden)
 *   Unconfigured  — opacity-60, red dot (integration pending/failed, credentials required)
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Puzzle,
  Settings,
  DollarSign,
  BarChart2,
  FolderOpen,
  Users,
  Zap,
  Globe,
  Mail,
  MessageSquare,
  MessagesSquare,
  Kanban,
  Inbox,
  Calendar,
  Bell,
  Cloud,
  Code2,
  BookOpen,
  Mic,
  TrendingUp,
  Layout,
  Star,
  Layers,
  PenLine,
  Sparkles,
  Code,
  Boxes,
  Library,
  FolderKanban,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  Package,
  Key,
  Bot,
} from 'lucide-react';
import { ModuleLoader, type ModuleManifest } from '../core/ModuleLoader';
import { ViewRegistry } from '../core/ViewRegistry';
import { usePanelConfigStore } from '../store/panelConfig';
import IntegrationWizard from './IntegrationWizard';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';
import { Skeleton } from './LoadingStates';
import ModuleLibraryPanel from './ModuleLibraryPanel';
import type { CatalogModule } from '../types/catalog';

// ─── Activity log helpers ──────────────────────────────────────────────────────

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

// ─── Icon mapping ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Settings,
  DollarSign,
  BarChart2,
  FolderOpen,
  Puzzle,
  Users,
  Zap,
  Globe,
  Mail,
  MessageSquare,
  MessagesSquare,
  Kanban,
  Inbox,
  Calendar,
  Bell,
  Cloud,
  Code2,
  BookOpen,
  Mic,
  TrendingUp,
  Layout,
  Star,
  Layers,
  PenLine,
  Sparkles,
  Code,
  Boxes,
  FolderKanban,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveIcon(iconName?: string): React.ComponentType<any> {
  if (!iconName) return Puzzle;
  return ICON_MAP[iconName] ?? Puzzle;
}

// ─── Category filter ──────────────────────────────────────────────────────────

const CATEGORIES = ['productivity', 'communications', 'social', 'finance', 'system', 'agent'] as const;
type Category = (typeof CATEGORIES)[number];

// ─── Types ────────────────────────────────────────────────────────────────────

interface CredentialDetail {
  id: string;
  set: boolean;
}

interface CredStatusResult {
  status: 'green' | 'yellow' | 'red';
  details: CredentialDetail[];
}

interface IntegrationState {
  status: 'pending' | 'active' | 'failed' | string;
  wizard_step: number;
  wizard_data: Record<string, unknown>;
}

interface ModuleCardData {
  moduleId: string;
  manifest: ModuleManifest;
  moduleStatus: string; // 'active' | 'error' | 'registered' | etc.
  credStatus: CredStatusResult | null; // null if no credentials
  integration: IntegrationState | null; // null if no credentials
  panelVisible: boolean;
  viewId: string | null; // first view's id, or null if no views registered
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function ModuleCardSkeleton() {
  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <Skeleton width="w-10" height="h-10" rounded="lg" />
          <div className="space-y-1.5">
            <Skeleton width="w-24" height="h-4" />
            <Skeleton width="w-16" height="h-3" />
          </div>
        </div>
        <Skeleton width="w-10" height="h-5" rounded="full" />
      </div>
      <Skeleton width="w-full" height="h-3" />
      <Skeleton width="w-4/5" height="h-3" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton width="w-16" height="h-5" rounded="full" />
        <Skeleton width="w-20" height="h-6" rounded="lg" />
      </div>
    </div>
  );
}

// ─── Credential status dot ────────────────────────────────────────────────────

function CredentialStatusDot({
  status,
  details,
}: {
  status: 'green' | 'yellow' | 'red';
  details: CredentialDetail[];
}) {
  const colorMap = {
    green: 'bg-green-400',
    yellow: 'bg-yellow-400',
    red: 'bg-red-400',
  };

  const tooltip = details
    .map((d) => `${d.id}: ${d.set ? 'Set' : 'Missing'}`)
    .join('\n');

  return (
    <div className="relative group">
      <span
        className={`block w-2.5 h-2.5 rounded-full ${colorMap[status]} flex-shrink-0`}
        title={tooltip}
      />
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
        <div className="bg-mission-control-bg border border-mission-control-border rounded-lg px-2.5 py-1.5 text-xs text-mission-control-text whitespace-pre min-w-max shadow-lg">
          {tooltip}
        </div>
      </div>
    </div>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-mission-control-accent focus:ring-offset-2 focus:ring-offset-mission-control-bg disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'bg-mission-control-accent' : 'bg-mission-control-border'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ─── Category chip ────────────────────────────────────────────────────────────

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

// ─── Module card ──────────────────────────────────────────────────────────────

function ModuleCard({
  data,
  onToggle,
  onConfigure,
}: {
  data: ModuleCardData;
  onToggle: (card: ModuleCardData, newVal: boolean) => void;
  onConfigure: (card: ModuleCardData) => void;
}) {
  const { manifest, moduleStatus, credStatus, integration, panelVisible } = data;

  const hasCredentials = (manifest.credentials?.length ?? 0) > 0;

  // Determine visual state
  const isActive = moduleStatus === 'active' && panelVisible;
  const isDisabled = moduleStatus === 'disposed';
  const isUnconfigured =
    hasCredentials &&
    integration != null &&
    (integration.status === 'pending' || integration.status === 'failed');

  const cardClass = isDisabled
    ? 'opacity-40 grayscale'
    : isActive ? '' : 'opacity-60';

  const IconComponent = resolveIcon(manifest.icon);
  const category = manifest.category ?? 'system';

  return (
    <div
      className={`bg-mission-control-surface border border-mission-control-border rounded-xl p-4 transition-all hover:border-mission-control-text-dim/30 ${cardClass}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Icon */}
          <div className="w-10 h-10 rounded-lg bg-mission-control-accent/10 flex items-center justify-center flex-shrink-0">
            <IconComponent size={20} className="text-mission-control-accent" />
          </div>

          {/* Name + version */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-mission-control-text text-sm truncate">
                {manifest.name}
              </span>
              {credStatus && (
                <CredentialStatusDot
                  status={credStatus.status}
                  details={credStatus.details}
                />
              )}
            </div>
            <span className="text-xs text-mission-control-text-dim">
              v{manifest.version}
              {manifest.author && ` · ${manifest.author}`}
            </span>
          </div>
        </div>

        {/* Toggle or Core pill or Re-enable */}
        {manifest.core ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-mission-control-accent/20 text-mission-control-accent font-medium">
            Core
          </span>
        ) : isDisabled ? (
          <button
            type="button"
            onClick={() => onToggle(data, true)}
            className="text-xs px-2.5 py-1 rounded-lg border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-text-dim transition-colors"
          >
            Re-enable
          </button>
        ) : (
          <ToggleSwitch
            checked={panelVisible}
            onChange={(val) => onToggle(data, val)}
            disabled={data.viewId == null}
          />
        )}
      </div>

      {/* Description */}
      {manifest.description && (
        <p className="text-sm text-mission-control-text-dim line-clamp-2 mb-3">
          {manifest.description}
        </p>
      )}

      {/* Footer row: category badge + configure button */}
      <div className="flex items-center gap-2 mt-auto">
        <span className="text-xs px-2 py-0.5 rounded-full bg-mission-control-border/60 text-mission-control-text-dim capitalize">
          {category}
        </span>

        {isUnconfigured && (
          <span className="text-xs text-red-400">Unconfigured</span>
        )}

        {isDisabled && (
          <span className="text-xs text-mission-control-text-dim">Disabled</span>
        )}

        {hasCredentials && (
          <button
            type="button"
            onClick={() => onConfigure(data)}
            className="ml-auto flex items-center gap-1 text-xs text-mission-control-text-dim hover:text-mission-control-text transition-colors px-2 py-1 rounded-lg border border-mission-control-border hover:border-mission-control-text-dim"
          >
            <Settings size={12} />
            Configure
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ModulesPage() {
  const { savePanels, syncWithViewRegistry } = usePanelConfigStore();

  const [view, setView] = useState<'installed' | 'library'>('installed');
  const [cards, setCards] = useState<ModuleCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTarget, setWizardTarget] = useState<ModuleCardData | null>(null);

  // Confirm dialog (for re-enabling a previously configured module)
  const { open: confirmOpen, config: confirmConfig, onConfirm: confirmCallback, showConfirm, closeConfirm } = useConfirmDialog();

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadModules = async () => {
    setLoading(true);
    try {
      // Sync ViewRegistry → panelConfig so new modules appear
      syncWithViewRegistry();

      const registrations = ModuleLoader.getAll();
      const currentPanels = usePanelConfigStore.getState().panels;

      const results: ModuleCardData[] = await Promise.all(
        registrations.map(async (reg) => {
          const { manifest } = reg;
          const hasCredentials = (manifest.credentials?.length ?? 0) > 0;

          // Find the first view registered by this module
          const views = ViewRegistry.getByModule(manifest.id);
          const viewId = views.length > 0 ? views[0].id : null;

          // Check panel visibility
          const panel = viewId
            ? currentPanels.find((p) => p.id === viewId)
            : null;
          const panelVisible = panel?.visible ?? false;

          // Credential status
          let credStatus: CredStatusResult | null = null;

          // Integration state
          let integration: IntegrationState | null = null;
          if (hasCredentials) {
            try {
              const res = await fetch(`/api/modules/${manifest.id}`);
              if (res.ok) {
                const data = await res.json();
                if (data?.integration) {
                  integration = data.integration as IntegrationState;
                }
              }
            } catch {
              // fallback: no integration state
            }
          }

          return {
            moduleId: manifest.id,
            manifest,
            moduleStatus: reg.status,
            credStatus,
            integration,
            panelVisible,
            viewId,
          };
        }),
      );

      setCards(results);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Toggle handler ─────────────────────────────────────────────────────────

  function toggleModulePanel(viewId: string, visible: boolean) {
    const currentPanels = usePanelConfigStore.getState().panels;
    // If panel not in store yet, add it
    const exists = currentPanels.find((p) => p.id === viewId);
    if (!exists) {
      const maxOrder = Math.max(...currentPanels.map((p) => p.order), 0);
      const view = ViewRegistry.get(viewId);
      const updated = [
        ...currentPanels,
        { id: viewId, label: view?.label ?? viewId, visible, order: maxOrder + 1 },
      ];
      savePanels(updated);
    } else {
      const updated = currentPanels.map((p) =>
        p.id === viewId ? { ...p, visible } : p,
      );
      savePanels(updated);
    }
    // Refresh card data to reflect new visibility and module status optimistically
    setCards((prev) =>
      prev.map((c) =>
        c.viewId === viewId
          ? { ...c, panelVisible: visible, moduleStatus: visible ? 'active' : 'disposed' }
          : c
      ),
    );
  }

  function handleToggle(card: ModuleCardData, newVal: boolean) {
    if (card.viewId == null) return;

    if (!newVal) {
      // Toggling OFF: disable immediately
      toggleModulePanel(card.viewId, false);
      return;
    }

    const hasCredentials = (card.manifest.credentials?.length ?? 0) > 0;

    if (!hasCredentials) {
      // No credentials: enable freely
      toggleModulePanel(card.viewId, true);
      return;
    }

    const integrationActive = card.integration?.status === 'active';

    if (integrationActive) {
      // Previously configured: confirm before re-enabling
      showConfirm(
        {
          title: 'Re-enable Module',
          message: `Re-enable ${card.manifest.name} with existing credentials?`,
          confirmLabel: 'Re-enable',
          type: 'info',
        },
        () => {
          if (card.viewId) toggleModulePanel(card.viewId, true);
        },
      );
    } else {
      // Unconfigured: open wizard
      setWizardTarget(card);
      setWizardOpen(true);
    }
  }

  function handleConfigure(card: ModuleCardData) {
    setWizardTarget(card);
    setWizardOpen(true);
  }

  async function handleWizardComplete() {
    setWizardOpen(false);
    if (wizardTarget?.viewId) {
      toggleModulePanel(wizardTarget.viewId, true);
    }
    setWizardTarget(null);
    await loadModules();
  }

  function handleWizardCancel() {
    setWizardOpen(false);
    setWizardTarget(null);
  }

  // ── Category filter ────────────────────────────────────────────────────────

  // Only show categories that have at least one module
  const presentCategories = CATEGORIES.filter((cat) =>
    cards.some((c) => (c.manifest.category ?? 'system') === cat),
  );

  const filteredCards = (selectedCategory
    ? cards.filter((c) => (c.manifest.category ?? 'system') === selectedCategory)
    : cards
  ).sort((a, b) => {
    const aCore = a.manifest.core ? 0 : 1;
    const bCore = b.manifest.core ? 0 : 1;
    if (aCore !== bCore) return aCore - bCore;
    return a.manifest.name.localeCompare(b.manifest.name);
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-mission-control-accent/20 rounded-xl">
            <Puzzle size={24} className="text-mission-control-accent" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-mission-control-text">Modules</h1>
            <p className="text-sm text-mission-control-text-dim">Manage installed modules, configure credentials, and toggle features</p>
          </div>
        </div>
      </div>
      {/* View tabs */}
      <div className="flex border-b border-mission-control-border px-6">
        <button
          type="button"
          onClick={() => setView('installed')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            view === 'installed'
              ? 'border-mission-control-accent text-mission-control-accent'
              : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
          }`}
        >
          <Puzzle size={15} /> Installed
        </button>
        <button
          type="button"
          onClick={() => setView('library')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            view === 'library'
              ? 'border-mission-control-accent text-mission-control-accent'
              : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
          }`}
        >
          <Library size={15} /> Library
        </button>
      </div>
      <div className="p-6 space-y-6">

      {/* Library view */}
      {view === 'library' && (
        <ModuleLibraryPanel />
      )}

      {/* Installed view */}
      {view === 'installed' && (<>

      {/* Category filter */}
      {!loading && presentCategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <CategoryChip
            label="All"
            selected={selectedCategory === null}
            onClick={() => setSelectedCategory(null)}
          />
          {presentCategories.map((cat) => (
            <CategoryChip
              key={cat}
              label={cat}
              selected={selectedCategory === cat}
              onClick={() =>
                setSelectedCategory(selectedCategory === cat ? null : cat)
              }
            />
          ))}
        </div>
      )}

      {/* Card grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ModuleCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-mission-control-text-dim text-sm">
          {selectedCategory
            ? `No modules in "${selectedCategory}" category`
            : 'No modules registered'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCards.map((card) => (
            <ModuleCard
              key={card.moduleId}
              data={card}
              onToggle={handleToggle}
              onConfigure={handleConfigure}
            />
          ))}
        </div>
      )}

      </>)} {/* end installed view */}

      {/* Integration Wizard */}
      {wizardTarget && (
        <IntegrationWizard
          isOpen={wizardOpen}
          moduleId={wizardTarget.moduleId}
          moduleName={wizardTarget.manifest.name}
          credentials={wizardTarget.manifest.credentials ?? []}
          healthCheck={wizardTarget.manifest.healthCheck ?? null}
          onComplete={handleWizardComplete}
          onCancel={handleWizardCancel}
        />
      )}

      {/* Confirm dialog for re-enabling configured modules */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={closeConfirm}
        onConfirm={confirmCallback}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmLabel={confirmConfig.confirmLabel}
        cancelLabel={confirmConfig.cancelLabel}
        type={confirmConfig.type}
      />
      </div>
    </div>
  );
}
