// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback, useRef } from 'react';
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
  Star,
  Activity,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  X,
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
import ModuleDependencyGraph from './ModuleDependencyGraph';

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

// Hardcoded featured module IDs (can be replaced with a DB flag)
const FEATURED_IDS = ['analytics', 'inbox', 'finance', 'voice', 'library'];

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
  const updated = [next, ...log].slice(0, 20);
  try {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(updated));
  } catch {
    try { localStorage.removeItem(ACTIVITY_KEY); localStorage.setItem(ACTIVITY_KEY, JSON.stringify([next])); } catch { /* skip */ }
  }
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

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Types ────────────────────────────────────────────────────────────────────

type InstallPhase = 'idle' | 'installing' | 'installed' | 'error';

export type ModuleHealthStatus = 'healthy' | 'warning' | 'error';

interface ModuleHealthData {
  moduleId: string;
  status: ModuleHealthStatus;
  lastActivityAt: number | null;
  errorCount24h: number;
}

interface ReviewData {
  id: number;
  moduleId: string;
  rating: number;
  review: string | null;
  reviewedBy: string;
  createdAt: number;
}

interface ReviewsState {
  reviews: ReviewData[];
  averageRating: number | null;
  reviewCount: number;
}

interface ModuleLibraryPanelProps {
  onInstall?: (module: CatalogModule) => void;
}

// ─── StarRating ───────────────────────────────────────────────────────────────

function StarRating({ rating, max = 5, size = 12 }: { rating: number; max?: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={size}
          className={i < Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-mission-control-border'}
        />
      ))}
    </span>
  );
}

function InteractiveStarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="inline-flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => {
        const v = i + 1;
        const filled = v <= (hover || value);
        return (
          <button
            key={i}
            type="button"
            onMouseEnter={() => setHover(v)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(v)}
            aria-label={`Rate ${v} star${v > 1 ? 's' : ''}`}
            className="focus:outline-none"
          >
            <Star
              size={20}
              className={filled ? 'text-amber-400 fill-amber-400' : 'text-mission-control-border hover:text-amber-300 transition-colors'}
            />
          </button>
        );
      })}
    </span>
  );
}

// ─── Health dot ───────────────────────────────────────────────────────────────

function HealthDot({ status }: { status: ModuleHealthStatus }) {
  const cls =
    status === 'healthy' ? 'bg-success' :
    status === 'warning' ? 'bg-amber-400' :
    'bg-error';
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${cls}`}
      title={`Health: ${status}`}
    />
  );
}

// ─── ReviewModal ──────────────────────────────────────────────────────────────

function ReviewModal({
  module,
  existingReviews,
  onClose,
  onSubmit,
}: {
  module: CatalogModule;
  existingReviews: ReviewsState | null;
  onClose: () => void;
  onSubmit: (rating: number, review: string) => Promise<void>;
}) {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await onSubmit(rating, reviewText);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-mission-control-border bg-mission-control-bg p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-base">Write a Review</h3>
          <button type="button" onClick={onClose} className="icon-btn">
            <X size={16} />
          </button>
        </div>

        <p className="text-sm text-mission-control-text-dim mb-4">
          Reviewing: <span className="text-mission-control-text font-medium">{module.name}</span>
        </p>

        {/* Existing reviews summary */}
        {existingReviews && existingReviews.reviewCount > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-mission-control-surface border border-mission-control-border text-sm">
            <div className="flex items-center gap-2 mb-2">
              <StarRating rating={existingReviews.averageRating ?? 0} size={14} />
              <span className="font-medium">{existingReviews.averageRating?.toFixed(1)}</span>
              <span className="text-mission-control-text-dim">
                ({existingReviews.reviewCount} review{existingReviews.reviewCount !== 1 ? 's' : ''})
              </span>
            </div>
            <div className="space-y-1.5 max-h-28 overflow-y-auto">
              {existingReviews.reviews.slice(0, 3).map(r => (
                <div key={r.id} className="text-xs text-mission-control-text-dim border-t border-mission-control-border pt-1.5">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <StarRating rating={r.rating} size={10} />
                    <span className="opacity-60">{formatRelativeTime(r.createdAt)}</span>
                  </div>
                  {r.review && <p className="line-clamp-2">{r.review}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-mission-control-text-dim mb-1.5">
              Your rating <span className="text-error">*</span>
            </label>
            <InteractiveStarRating value={rating} onChange={setRating} />
          </div>

          <div>
            <label className="block text-xs font-medium text-mission-control-text-dim mb-1.5">
              Review (optional)
            </label>
            <textarea
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              rows={3}
              placeholder="Share your experience with this module…"
              className="w-full px-3 py-2 text-sm bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent resize-none"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-mission-control-border rounded-lg hover:bg-mission-control-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={rating === 0 || submitting}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Submit Review
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── ConfigurePanel ───────────────────────────────────────────────────────────

function ConfigurePanel({
  module,
  onClose,
  onSave,
}: {
  module: CatalogModule;
  onClose: () => void;
  onSave: (config: Record<string, unknown>) => Promise<void>;
}) {
  const [config, setConfig] = useState<Record<string, unknown>>(
    Object.keys(module.configuration ?? {}).length > 0
      ? { ...module.configuration }
      : { enabled: true, debugMode: false, maxRetries: 3 }
  );
  const [saving, setSaving] = useState(false);

  const defaults = useRef<Record<string, unknown>>({ ...config });

  function setValue(key: string, value: unknown) {
    setConfig(prev => ({ ...prev, [key]: value }));
  }

  function resetToDefaults() {
    setConfig({ ...defaults.current });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(config);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function renderField(key: string, value: unknown) {
    if (typeof value === 'boolean') {
      return (
        <div key={key} className="flex items-center justify-between py-2 border-b border-mission-control-border last:border-0">
          <label className="text-sm font-medium">{key}</label>
          <button
            type="button"
            onClick={() => setValue(key, !value)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
              value ? 'bg-mission-control-accent' : 'bg-mission-control-border'
            }`}
            role="switch"
            aria-checked={value}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                value ? 'translate-x-4' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      );
    }
    if (typeof value === 'number') {
      return (
        <div key={key} className="flex items-center justify-between py-2 border-b border-mission-control-border last:border-0">
          <label className="text-sm font-medium">{key}</label>
          <input
            type="number"
            value={String(value)}
            onChange={e => setValue(key, Number(e.target.value))}
            className="w-24 px-2 py-1 text-sm text-right bg-mission-control-surface border border-mission-control-border rounded focus:outline-none focus:border-mission-control-accent"
          />
        </div>
      );
    }
    if (Array.isArray(value)) {
      return (
        <div key={key} className="py-2 border-b border-mission-control-border last:border-0">
          <label className="text-sm font-medium block mb-1">{key}</label>
          <input
            type="text"
            value={(value as unknown[]).join(', ')}
            onChange={e => setValue(key, e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            placeholder="comma-separated values"
            className="w-full px-2 py-1.5 text-sm bg-mission-control-surface border border-mission-control-border rounded focus:outline-none focus:border-mission-control-accent"
          />
        </div>
      );
    }
    // string / fallback
    return (
      <div key={key} className="py-2 border-b border-mission-control-border last:border-0">
        <label className="text-sm font-medium block mb-1">{key}</label>
        <input
          type="text"
          value={String(value ?? '')}
          onChange={e => setValue(key, e.target.value)}
          className="w-full px-2 py-1.5 text-sm bg-mission-control-surface border border-mission-control-border rounded focus:outline-none focus:border-mission-control-accent"
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end p-0 sm:p-4 bg-black/50" onClick={onClose}>
      <div
        className="w-full sm:w-96 max-h-screen sm:max-h-[80vh] rounded-t-xl sm:rounded-lg border border-mission-control-border bg-mission-control-bg shadow-xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-mission-control-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-mission-control-text-dim" />
            <h3 className="font-semibold text-sm">Configure {module.name}</h3>
          </div>
          <button type="button" onClick={onClose} className="icon-btn">
            <X size={15} />
          </button>
        </div>

        {/* Fields */}
        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-3">
            {Object.keys(config).length === 0 ? (
              <p className="text-sm text-mission-control-text-dim py-4 text-center">
                No configurable options for this module.
              </p>
            ) : (
              <div className="divide-y divide-mission-control-border">
                {Object.entries(config).map(([k, v]) => renderField(k, v))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 px-5 py-4 border-t border-mission-control-border flex-shrink-0">
            <button
              type="button"
              onClick={resetToDefaults}
              className="text-xs text-mission-control-text-dim hover:text-mission-control-text transition-colors"
            >
              Reset to defaults
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs border border-mission-control-border rounded-lg hover:bg-mission-control-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── FeaturedCarousel ─────────────────────────────────────────────────────────

function FeaturedCarousel({
  modules,
  onInstall,
  reviewsMap,
}: {
  modules: CatalogModule[];
  onInstall: (m: CatalogModule) => void;
  reviewsMap: Map<string, ReviewsState>;
}) {
  const featured = modules.filter(m => FEATURED_IDS.includes(m.id));
  const [offset, setOffset] = useState(0);
  const CARD_W = 220;
  const VISIBLE = Math.min(featured.length, 3);
  const maxOffset = Math.max(0, featured.length - VISIBLE);
  const now = Date.now();

  if (featured.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-mission-control-text-dim">
          Featured Modules
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset(o => Math.max(0, o - 1))}
            className="icon-btn border border-mission-control-border disabled:opacity-30"
            aria-label="Previous featured modules"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            disabled={offset >= maxOffset}
            onClick={() => setOffset(o => Math.min(maxOffset, o + 1))}
            className="icon-btn border border-mission-control-border disabled:opacity-30"
            aria-label="Next featured modules"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div style={{ overflow: 'hidden' }}>
        <div
          className="flex gap-3 transition-transform duration-300"
          style={{ transform: `translateX(-${offset * (CARD_W + 12)}px)` }}
        >
          {featured.map(mod => {
            const Icon = MODULE_ICONS[mod.id] ?? Package;
            const reviewData = reviewsMap.get(mod.id);
            const isNew = now - mod.createdAt < ONE_WEEK_MS;

            return (
              <div
                key={mod.id}
                style={{ minWidth: CARD_W, maxWidth: CARD_W }}
                className="rounded-lg border-2 border-mission-control-border p-4 flex flex-col gap-2 bg-mission-control-surface flex-shrink-0 hover:border-mission-control-accent/40 transition-colors"
              >
                {/* Icon + badges */}
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg bg-mission-control-bg flex items-center justify-center border border-mission-control-border text-mission-control-text-dim">
                    <Icon size={18} />
                  </div>
                  {isNew && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-mission-control-accent/20 text-mission-control-accent border border-mission-control-accent/30 font-medium">
                      New
                    </span>
                  )}
                </div>

                {/* Name + description */}
                <div>
                  <p className="font-semibold text-sm leading-tight mb-0.5">{mod.name}</p>
                  <p className="text-xs text-mission-control-text-dim line-clamp-2">{mod.description || '—'}</p>
                </div>

                {/* Rating */}
                {reviewData && reviewData.reviewCount > 0 ? (
                  <div className="flex items-center gap-1.5 text-xs text-mission-control-text-dim">
                    <StarRating rating={reviewData.averageRating ?? 0} size={11} />
                    <span>{reviewData.averageRating?.toFixed(1)}</span>
                    <span>({reviewData.reviewCount})</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-mission-control-text-dim">
                    <Star size={11} className="text-mission-control-border" />
                    <span>No reviews yet</span>
                  </div>
                )}

                {/* CTA */}
                {mod.installed ? (
                  <div className="flex items-center gap-1 text-xs text-success mt-auto">
                    <CheckCircle2 size={12} />
                    Installed
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onInstall(mod)}
                    className="mt-auto w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors"
                  >
                    <Download size={11} />
                    Install
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
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

  // Reviews
  const [reviewsMap, setReviewsMap]     = useState<Map<string, ReviewsState>>(new Map());
  const [reviewTarget, setReviewTarget] = useState<CatalogModule | null>(null);

  // Health
  const [healthMap, setHealthMap]       = useState<Map<string, ModuleHealthData>>(new Map());
  const [healthSummary, setHealthSummary] = useState<{ healthy: number; warning: number; error: number; total: number } | null>(null);

  // Configure
  const [configTarget, setConfigTarget] = useState<CatalogModule | null>(null);

  // Dependency graph
  const [showDepGraph, setShowDepGraph] = useState(false);

  const { open: confirmOpen, config: confirmConfig, onConfirm: onConfirmCallback, showConfirm, closeConfirm } = useConfirmDialog();

  const refreshActivity = useCallback(() => {
    setActivityLog(readActivityLog().slice(0, 5));
  }, []);

  const loadReviews = useCallback(async (moduleIds: string[]) => {
    const results = await Promise.allSettled(
      moduleIds.map(id => catalogApi.getModuleReviews(id).then(data => ({ id, data })))
    );
    setReviewsMap(prev => {
      const next = new Map(prev);
      for (const r of results) {
        if (r.status === 'fulfilled') {
          next.set(r.value.id, r.value.data as ReviewsState);
        }
      }
      return next;
    });
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const data = await catalogApi.getModulesHealth() as { health: ModuleHealthData[]; summary: typeof healthSummary };
      const map = new Map<string, ModuleHealthData>();
      for (const h of data.health) map.set(h.moduleId, h);
      setHealthMap(map);
      setHealthSummary(data.summary);
    } catch {
      // Non-critical — health is best-effort
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await catalogApi.listModules();
      setModules(data);
      // Load reviews for installed modules in background
      const installed = data.filter((m: CatalogModule) => m.installed).map((m: CatalogModule) => m.id);
      if (installed.length > 0) loadReviews(installed);
      loadHealth();
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
    sessionStorage.setItem('settings-focus-module', moduleId);
    window.dispatchEvent(new CustomEvent('tour-navigate', { detail: { view: 'settings' } }));
  }

  // ─── Review submit ───────────────────────────────────────────────────────────

  async function handleReviewSubmit(rating: number, review: string) {
    if (!reviewTarget) return;
    await catalogApi.submitModuleReview(reviewTarget.id, { rating, review });
    showToast('success', 'Review submitted', `Your review for ${reviewTarget.name} has been saved.`);
    await loadReviews([reviewTarget.id]);
  }

  // ─── Configure save ──────────────────────────────────────────────────────────

  async function handleConfigSave(config: Record<string, unknown>) {
    if (!configTarget) return;
    await catalogApi.updateModuleConfiguration(configTarget.id, config);
    showToast('success', 'Configuration saved', `${configTarget.name} configuration updated.`);
    // Refresh module data to get updated config
    await load(false);
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
      {/* Featured carousel */}
      <FeaturedCarousel
        modules={modules}
        onInstall={handleInstallClick}
        reviewsMap={reviewsMap}
      />

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

        {/* Health summary */}
        {healthSummary && healthSummary.total > 0 && (
          <span className="icon-text text-mission-control-text-dim">
            <Activity size={14} className="flex-shrink-0" />
            <span className="text-success">{healthSummary.healthy}</span>
            {' '}healthy
            {healthSummary.warning > 0 && (
              <span>, <span className="text-amber-400">{healthSummary.warning}</span> warning{healthSummary.warning > 1 ? 's' : ''}</span>
            )}
            {healthSummary.error > 0 && (
              <span>, <span className="text-error">{healthSummary.error}</span> error{healthSummary.error > 1 ? 's' : ''}</span>
            )}
          </span>
        )}

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

      {/* Dependency graph (collapsible) */}
      {showDepGraph && (
        <div className="mb-5">
          <ModuleDependencyGraph modules={modules.filter(m => m.installed)} />
        </div>
      )}

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
            const reviewData  = reviewsMap.get(module.id);
            const health      = healthMap.get(module.id);
            const isNew       = Date.now() - module.createdAt < ONE_WEEK_MS;

            const deps = [
              ...module.requiredAgents,
              ...module.requiredNpm,
              ...module.requiredApis,
            ];
            const missingDeps = module.requiredAgents.filter(id => !installedAgentIds.includes(id));

            return (
              <div
                key={module.id}
                className={`rounded-lg border-2 p-4 transition-all duration-200 flex flex-col ${
                  module.installed
                    ? 'border-success-border bg-success-subtle/20'
                    : 'border-mission-control-border hover:border-mission-control-accent/40'
                }`}
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-11 h-11 rounded-lg bg-mission-control-bg flex items-center justify-center border border-mission-control-border text-mission-control-text-dim">
                      {(() => { const Icon = MODULE_ICONS[module.id] ?? Package; return <Icon size={20} />; })()}
                    </div>
                    {/* Health dot */}
                    {health && (
                      <span className="absolute -bottom-0.5 -right-0.5">
                        <HealthDot status={health.status} />
                      </span>
                    )}
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
                      {/* New badge */}
                      {isNew && !module.core && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-mission-control-accent border border-mission-control-accent/30 bg-mission-control-accent/10">
                          New
                        </span>
                      )}
                      {module.installed && !module.core && (
                        <CheckCircle size={12} className="text-success flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-mission-control-text-dim line-clamp-2">
                      {module.description || '—'}
                    </p>
                    {/* Star rating */}
                    {reviewData && reviewData.reviewCount > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <StarRating rating={reviewData.averageRating ?? 0} size={11} />
                        <span className="text-[11px] text-mission-control-text-dim">
                          {reviewData.averageRating?.toFixed(1)} ({reviewData.reviewCount})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons top-right */}
                  <div className="flex flex-col gap-1">
                    {/* Configure gear for installed non-core modules */}
                    {module.installed && !module.core && (
                      <button
                        type="button"
                        title={`Configure ${module.name}`}
                        aria-label={`Configure ${module.name}`}
                        onClick={() => setConfigTarget(module)}
                        className="flex-shrink-0 p-1.5 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                      >
                        <Settings size={14} />
                      </button>
                    )}
                    {/* Settings nav for installed non-core modules */}
                    {module.installed && !module.core && (
                      <button
                        type="button"
                        title={`Open settings for ${module.name}`}
                        aria-label={`Open settings for ${module.name}`}
                        onClick={() => navigateToModuleSettings(module.id)}
                        className="flex-shrink-0 p-1.5 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                      >
                        <Activity size={14} />
                      </button>
                    )}
                  </div>
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
                    <div className="flex items-center gap-1.5 text-xs text-review">
                      <Shield size={12} className="flex-shrink-0" />
                      <span>Core module — always active</span>
                    </div>
                  ) : module.installed ? (
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
                      {/* Write a review */}
                      <button
                        type="button"
                        onClick={() => setReviewTarget(module)}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] text-amber-400 border border-amber-400/30 rounded hover:bg-amber-400/10 transition-colors"
                        title="Write a review"
                      >
                        <Star size={10} />
                        Review
                      </button>
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
                    <div className="flex items-center gap-1.5 text-xs text-info">
                      <Loader2 size={12} className="animate-spin flex-shrink-0" />
                      <span>Installing…</span>
                    </div>
                  ) : phase === 'error' ? (
                    <div className="flex items-center gap-1.5 text-xs text-error">
                      <XCircle size={12} className="flex-shrink-0" />
                      <span className="line-clamp-1">{installErr ?? 'Installation failed'}</span>
                    </div>
                  ) : (
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

      {/* Review modal */}
      {reviewTarget && (
        <ReviewModal
          module={reviewTarget}
          existingReviews={reviewsMap.get(reviewTarget.id) ?? null}
          onClose={() => setReviewTarget(null)}
          onSubmit={handleReviewSubmit}
        />
      )}

      {/* Configure panel */}
      {configTarget && (
        <ConfigurePanel
          module={configTarget}
          onClose={() => setConfigTarget(null)}
          onSave={handleConfigSave}
        />
      )}

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
