// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Image, FileText, Film, Palette, Type, Layout, BookOpen,
  Plus, Search, X, Trash2, Edit, ExternalLink,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type AssetCategory =
  | 'all'
  | 'logos'
  | 'colors'
  | 'typography'
  | 'imagery'
  | 'presentations'
  | 'guidelines'
  | 'other';

type AssetFileType = 'image' | 'pdf' | 'video' | 'document' | 'other';

interface BrandAsset {
  id: string;
  name: string;
  description: string;
  category: string;
  fileType: string;
  fileName: string;
  filePath: string;
  url: string;
  tags: string[];
  scope: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ASSET_CATEGORIES: { value: AssetCategory; label: string; icon: React.ElementType }[] = [
  { value: 'all',           label: 'All',           icon: Image     },
  { value: 'logos',         label: 'Logos',         icon: Image     },
  { value: 'colors',        label: 'Colors',        icon: Palette   },
  { value: 'typography',    label: 'Typography',    icon: Type      },
  { value: 'imagery',       label: 'Imagery',       icon: Image     },
  { value: 'presentations', label: 'Presentations', icon: Layout    },
  { value: 'guidelines',    label: 'Guidelines',    icon: BookOpen  },
  { value: 'other',         label: 'Other',         icon: FileText  },
];

const FILE_TYPE_OPTIONS: { value: AssetFileType; label: string }[] = [
  { value: 'image',    label: 'Image'    },
  { value: 'pdf',      label: 'PDF'      },
  { value: 'video',    label: 'Video'    },
  { value: 'document', label: 'Document' },
  { value: 'other',    label: 'Other'    },
];

const SCOPE_OPTIONS = [
  { value: 'all',      label: 'Public'   },
  { value: 'internal', label: 'Internal' },
  { value: 'external', label: 'External' },
];

const CATEGORY_COLORS: Record<string, string> = {
  logos:         'text-blue-400 bg-blue-500/10',
  colors:        'text-purple-400 bg-purple-500/10',
  typography:    'text-green-400 bg-green-500/10',
  imagery:       'text-orange-400 bg-orange-500/10',
  presentations: 'text-pink-400 bg-pink-500/10',
  guidelines:    'text-teal-400 bg-teal-500/10',
  general:       'text-gray-400 bg-gray-500/10',
  other:         'text-gray-400 bg-gray-500/10',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isImageUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('data:image/')) return true;
  const clean = url.split('?')[0].toLowerCase();
  return /\.(jpg|jpeg|png|gif|svg|webp|avif|bmp)$/.test(clean);
}

function getFileIcon(fileType: string): React.ElementType {
  switch (fileType) {
    case 'pdf':      return FileText;
    case 'video':    return Film;
    case 'document': return FileText;
    default:         return Image;
  }
}

function getFileTypeBg(fileType: string): string {
  switch (fileType) {
    case 'pdf':      return 'bg-red-500/10';
    case 'video':    return 'bg-purple-500/10';
    case 'document': return 'bg-blue-500/10';
    default:         return 'bg-gray-500/10';
  }
}

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface AssetCardProps {
  asset: BrandAsset;
  onClick: () => void;
}

function AssetCard({ asset, onClick }: AssetCardProps) {
  const showImage = isImageUrl(asset.url);
  const FileIcon = getFileIcon(asset.fileType);
  const bgCls = getFileTypeBg(asset.fileType);
  const tagChips = asset.tags.slice(0, 2);
  const extraTags = asset.tags.length - 2;

  return (
    <div
      onClick={onClick}
      className="group rounded-lg bg-mission-control-surface border border-mission-control-border hover:border-blue-500/40 cursor-pointer transition-colors overflow-hidden"
    >
      {/* Preview area */}
      <div className="w-full h-28 overflow-hidden flex items-center justify-center bg-mission-control-bg">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.url}
            alt={asset.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className={`flex items-center justify-center w-full h-full ${bgCls}`}>
            <FileIcon size={32} className="text-mission-control-text-dim opacity-50" />
          </div>
        )}
      </div>

      {/* Info area */}
      <div className="p-2.5">
        <p className="text-sm font-medium text-mission-control-text truncate mb-1">{asset.name}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${getCategoryColor(asset.category)}`}>
            {asset.category}
          </span>
          {tagChips.map(tag => (
            <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-mission-control-border text-mission-control-text-dim">
              {tag}
            </span>
          ))}
          {extraTags > 0 && (
            <span className="text-xs text-mission-control-text-dim">+{extraTags}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add/Edit Modal ─────────────────────────────────────────────────────────────

interface AssetFormState {
  name: string;
  description: string;
  category: string;
  fileType: AssetFileType;
  fileName: string;
  url: string;
  tags: string;
  scope: string;
}

const BLANK_FORM: AssetFormState = {
  name: '',
  description: '',
  category: 'general',
  fileType: 'image',
  fileName: '',
  url: '',
  tags: '',
  scope: 'all',
};

interface AssetModalProps {
  initial?: BrandAsset | null;
  onClose: () => void;
  onSaved: () => void;
}

function AssetModal({ initial, onClose, onSaved }: AssetModalProps) {
  const [form, setForm] = useState<AssetFormState>(
    initial
      ? {
          name: initial.name,
          description: initial.description ?? '',
          category: initial.category,
          fileType: (initial.fileType as AssetFileType) ?? 'image',
          fileName: initial.fileName ?? '',
          url: initial.url ?? '',
          tags: initial.tags.join(', '),
          scope: initial.scope,
        }
      : BLANK_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
      const payload = { ...form, tags, fileName: form.fileName || undefined };
      const url = initial ? `/api/brand-assets/${initial.id}` : '/api/brand-assets';
      const method = initial ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (!data.success) { setError(data.error ?? 'Save failed'); return; }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof AssetFormState>(key: K, val: AssetFormState[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg bg-mission-control-surface border border-mission-control-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border">
          <span className="font-semibold text-mission-control-text text-sm">
            {initial ? 'Edit Asset' : 'Add Brand Asset'}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-mission-control-border text-mission-control-text-dim"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 overflow-y-auto max-h-[70vh]">
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{error}</p>
          )}

          <input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Asset name..."
            className="w-full px-3 py-2 rounded bg-mission-control-bg border border-mission-control-border text-mission-control-text text-sm focus:outline-none focus:border-blue-500"
          />

          <div className="flex gap-2">
            <select
              value={form.category}
              onChange={e => set('category', e.target.value)}
              className="flex-1 px-3 py-2 rounded bg-mission-control-bg border border-mission-control-border text-mission-control-text text-sm focus:outline-none"
            >
              {ASSET_CATEGORIES.filter(c => c.value !== 'all').map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>

            <select
              value={form.fileType}
              onChange={e => set('fileType', e.target.value as AssetFileType)}
              className="flex-1 px-3 py-2 rounded bg-mission-control-bg border border-mission-control-border text-mission-control-text text-sm focus:outline-none"
            >
              {FILE_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <select
              value={form.scope}
              onChange={e => set('scope', e.target.value)}
              className="w-28 px-3 py-2 rounded bg-mission-control-bg border border-mission-control-border text-mission-control-text text-sm focus:outline-none"
            >
              {SCOPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <input
            value={form.url}
            onChange={e => set('url', e.target.value)}
            placeholder="URL or image link..."
            className="w-full px-3 py-2 rounded bg-mission-control-bg border border-mission-control-border text-mission-control-text text-sm focus:outline-none focus:border-blue-500"
          />

          <input
            value={form.fileName}
            onChange={e => set('fileName', e.target.value)}
            placeholder="File name (optional)..."
            className="w-full px-3 py-2 rounded bg-mission-control-bg border border-mission-control-border text-mission-control-text text-sm focus:outline-none focus:border-blue-500"
          />

          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Description (optional)..."
            rows={3}
            className="w-full px-3 py-2 rounded bg-mission-control-bg border border-mission-control-border text-mission-control-text text-sm focus:outline-none focus:border-blue-500 resize-none"
          />

          <input
            value={form.tags}
            onChange={e => set('tags', e.target.value)}
            placeholder="Tags: brand, primary, dark (comma-separated)..."
            className="w-full px-3 py-2 rounded bg-mission-control-bg border border-mission-control-border text-mission-control-text text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-mission-control-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : initial ? 'Save Changes' : 'Add Asset'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

interface AssetDrawerProps {
  asset: BrandAsset;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function AssetDrawer({ asset, onClose, onEdit, onDelete }: AssetDrawerProps) {
  const showImage = isImageUrl(asset.url);
  const FileIcon = getFileIcon(asset.fileType);
  const bgCls = getFileTypeBg(asset.fileType);

  const handleDelete = () => {
    if (!confirm('Delete this asset?')) return;
    onDelete();
  };

  return (
    <div className="w-80 shrink-0 border-l border-mission-control-border flex flex-col h-full bg-mission-control-surface overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border">
        <span className="font-semibold text-mission-control-text text-sm truncate">{asset.name}</span>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-mission-control-border text-mission-control-text-dim shrink-0 ml-2"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Preview */}
      <div className="w-full h-44 flex items-center justify-center bg-mission-control-bg border-b border-mission-control-border overflow-hidden">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.url}
            alt={asset.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className={`flex items-center justify-center w-full h-full ${bgCls}`}>
            <FileIcon size={48} className="text-mission-control-text-dim opacity-40" />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 p-4 space-y-3">
        {/* Category + file type */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${getCategoryColor(asset.category)}`}>
            {asset.category}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-mission-control-border text-mission-control-text-dim capitalize">
            {asset.fileType}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-mission-control-border text-mission-control-text-dim capitalize">
            {asset.scope}
          </span>
        </div>

        {/* Description */}
        {asset.description && (
          <p className="text-sm text-mission-control-text-dim leading-relaxed">{asset.description}</p>
        )}

        {/* URL link */}
        {asset.url && !asset.url.startsWith('data:') && (
          <a
            href={asset.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors truncate"
          >
            <ExternalLink size={12} className="shrink-0" />
            <span className="truncate">{asset.url}</span>
          </a>
        )}

        {/* File name */}
        {asset.fileName && (
          <p className="text-xs text-mission-control-text-dim">
            <span className="text-mission-control-text">File:</span> {asset.fileName}
          </p>
        )}

        {/* Tags */}
        {asset.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {asset.tags.map(tag => (
              <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-mission-control-border text-mission-control-text-dim">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Timestamps */}
        <p className="text-xs text-mission-control-text-dim">
          Added {new Date(asset.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 p-4 border-t border-mission-control-border">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-mission-control-bg border border-mission-control-border text-mission-control-text text-xs hover:border-blue-500/40 transition-colors"
        >
          <Edit size={12} />
          Edit
        </button>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-mission-control-bg border border-mission-control-border text-red-400 text-xs hover:border-red-500/40 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={12} />
          Delete
        </button>
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function BrandAssetsPanel() {
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<AssetCategory>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<BrandAsset | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<BrandAsset | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (category !== 'all') params.set('category', category);
      const res = await fetch(`/api/brand-assets?${params}`);
      const data = await res.json() as { success: boolean; assets?: BrandAsset[] };
      if (data.success && data.assets) setAssets(data.assets);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, category]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    await fetch(`/api/brand-assets/${id}`, { method: 'DELETE' });
    setSelected(null);
    load();
  };

  const handleSaved = () => {
    setShowModal(false);
    setEditing(null);
    load();
  };

  const openEdit = (asset: BrandAsset) => {
    setEditing(asset);
    setShowModal(true);
    setSelected(null);
  };

  const categoryCounts = assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.category] = (acc[a.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      {/* Modal */}
      {showModal && (
        <AssetModal
          initial={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}

      <div className="flex h-full">
        {/* Category sidebar */}
        <nav className="w-36 shrink-0 border-r border-mission-control-border flex flex-col h-full overflow-y-auto py-3 px-2 space-y-0.5">
          {ASSET_CATEGORIES.map(({ value, label }) => {
            const count = value === 'all' ? assets.length : (categoryCounts[value] ?? 0);
            const active = category === value;
            return (
              <button
                key={value}
                onClick={() => setCategory(value)}
                className={`w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                  active
                    ? 'bg-blue-600/20 text-blue-400 font-medium'
                    : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface'
                }`}
              >
                <span className="capitalize truncate">{label}</span>
                {count > 0 && (
                  <span className="opacity-60 shrink-0 ml-1">{count}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Main content */}
        <div className="flex flex-col flex-1 min-w-0 h-full">
          {/* Toolbar */}
          <div className="flex items-center gap-2 p-4 border-b border-mission-control-border">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search brand assets..."
                className="w-full pl-8 pr-3 py-2 rounded bg-mission-control-surface border border-mission-control-border text-mission-control-text text-sm focus:outline-none focus:border-blue-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mission-control-text-dim hover:text-mission-control-text"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <button
              onClick={() => { setEditing(null); setShowModal(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs shrink-0"
            >
              <Plus size={12} />
              Add Asset
            </button>
          </div>

          {/* Grid + drawer */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Asset grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-sm text-mission-control-text-dim">Loading...</p>
                </div>
              ) : assets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
                  <Image size={32} className="text-mission-control-text-dim opacity-30" />
                  <div>
                    <p className="text-sm font-medium text-mission-control-text">No brand assets yet</p>
                    <p className="text-xs text-mission-control-text-dim mt-1">
                      Add logos, color palettes, typography guides, and other visual resources.
                    </p>
                  </div>
                  <button
                    onClick={() => { setEditing(null); setShowModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs"
                  >
                    <Plus size={12} />
                    Add first asset
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {assets.map(asset => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      onClick={() => setSelected(prev => prev?.id === asset.id ? null : asset)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Detail drawer */}
            {selected && (
              <AssetDrawer
                asset={selected}
                onClose={() => setSelected(null)}
                onEdit={() => openEdit(selected)}
                onDelete={() => handleDelete(selected.id)}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
