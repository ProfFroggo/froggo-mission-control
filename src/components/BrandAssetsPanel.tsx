// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Image, FileText, Film, Palette, Type, Layout, BookOpen,
  Plus, Search, X, Trash2, Edit, ExternalLink,
} from 'lucide-react';
// eslint-disable-next-line import/order
import { Button, IconButton, Select, TextArea, TextField } from '@radix-ui/themes';

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
  logos:         'text-info bg-info',
  colors:        'text-review bg-review',
  typography:    'text-success bg-success',
  imagery:       'text-danger bg-danger',
  presentations: 'text-pink-400 bg-pink-500/10',
  guidelines:    'text-mission-control-accent bg-mission-control-accent/10',
  general:       'text-mission-control-text-dim bg-muted-subtle',
  other:         'text-mission-control-text-dim bg-muted-subtle',
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
    case 'pdf':      return 'bg-error';
    case 'video':    return 'bg-review';
    case 'document': return 'bg-info';
    default:         return 'bg-muted-subtle';
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
      className="group rounded-lg bg-mission-control-surface border border-mission-control-border hover:border-info/40 cursor-pointer transition-colors overflow-hidden"
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
      <div className="w-full max-w-lg bg-mission-control-surface border border-mission-control-border rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border">
          <span className="font-semibold text-mission-control-text text-sm">
            {initial ? 'Edit Asset' : 'Add Brand Asset'}
          </span>
          <IconButton
            onClick={onClose}
            variant="ghost"
            color="gray"
            size="2"
            aria-label="Close"
          >
            <X size={14} />
          </IconButton>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 overflow-y-auto max-h-[70vh]">
          {error && (
            <p className="text-xs text-error bg-error border border-error rounded px-3 py-2">{error}</p>
          )}

          <TextField.Root
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Asset name..."
            style={{ width: '100%' }}
          />

          <div className="flex gap-2">
            <Select.Root value={form.category} onValueChange={(val) => set('category', val)}>
              <Select.Trigger style={{ flex: 1 }} />
              <Select.Content>
                {ASSET_CATEGORIES.filter(c => c.value !== 'all').map(c => (
                  <Select.Item key={c.value} value={c.value}>{c.label}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>

            <Select.Root value={form.fileType} onValueChange={(val) => set('fileType', val as AssetFileType)}>
              <Select.Trigger style={{ flex: 1 }} />
              <Select.Content>
                {FILE_TYPE_OPTIONS.map(o => (
                  <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>

            <Select.Root value={form.scope} onValueChange={(val) => set('scope', val)}>
              <Select.Trigger style={{ width: 112 }} />
              <Select.Content>
                {SCOPE_OPTIONS.map(o => (
                  <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </div>

          <TextField.Root
            value={form.url}
            onChange={e => set('url', e.target.value)}
            placeholder="URL or image link..."
            style={{ width: '100%' }}
          />

          <TextField.Root
            value={form.fileName}
            onChange={e => set('fileName', e.target.value)}
            placeholder="File name (optional)..."
            style={{ width: '100%' }}
          />

          <TextArea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Description (optional)..."
            rows={3}
            style={{ width: '100%' }}
          />

          <TextField.Root
            value={form.tags}
            onChange={e => set('tags', e.target.value)}
            placeholder="Tags: brand, primary, dark (comma-separated)..."
            style={{ width: '100%' }}
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-mission-control-border">
          <Button
            onClick={onClose}
            variant="ghost"
            color="gray"
            size="2"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            size="2"
          >
            {saving ? 'Saving...' : initial ? 'Save Changes' : 'Add Asset'}
          </Button>
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
        <IconButton
          onClick={onClose}
          variant="ghost"
          color="gray"
          size="2"
          aria-label="Close"
          className="shrink-0 ml-2"
        >
          <X size={14} />
        </IconButton>
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
            className="flex items-center gap-1.5 text-xs text-info hover:text-info transition-colors truncate"
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
        <Button
          onClick={onEdit}
          variant="outline"
          color="gray"
          size="1"
        >
          <Edit size={12} />
          Edit
        </Button>
        <Button
          onClick={handleDelete}
          variant="outline"
          color="red"
          size="1"
        >
          <Trash2 size={12} />
          Delete
        </Button>
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
                type="button"
                key={value}
                onClick={() => setCategory(value)}
                className={`w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                  active
                    ? 'bg-info/20 text-info font-medium'
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
            <div className="flex-1">
              <TextField.Root
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search brand assets..."
                style={{ width: '100%' }}
              >
                <TextField.Slot>
                  <Search size={13} />
                </TextField.Slot>
              </TextField.Root>
              {search && (
                <IconButton
                  onClick={() => setSearch('')}
                  variant="ghost"
                  color="gray"
                  size="1"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </IconButton>
              )}
            </div>
            <Button
              onClick={() => { setEditing(null); setShowModal(true); }}
              size="2"
              className="shrink-0"
            >
              <Plus size={12} />
              Add Asset
            </Button>
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
                  <Button
                    onClick={() => { setEditing(null); setShowModal(true); }}
                    size="1"
                  >
                    <Plus size={12} />
                    Add first asset
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {assets.map(asset => {
                    const FileIcon = getFileIcon(asset.fileType);
                    const isSelected = selected?.id === asset.id;
                    return (
                      <div
                        key={asset.id}
                        onClick={() => setSelected(prev => prev?.id === asset.id ? null : asset)}
                        className={`border rounded-lg p-4 bg-mission-control-surface cursor-pointer transition-colors hover:border-info/40 ${
                          isSelected ? 'border-mission-control-accent/60' : 'border-mission-control-border'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-mission-control-accent/20 rounded-lg shrink-0">
                            <FileIcon size={18} className="text-mission-control-accent" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-mission-control-text truncate">{asset.name}</p>
                            {asset.description && (
                              <p className="text-xs text-mission-control-text-dim mt-0.5 line-clamp-2">{asset.description}</p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${getCategoryColor(asset.category)}`}>
                                {asset.category}
                              </span>
                              {asset.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-mission-control-border text-mission-control-text-dim">
                                  {tag}
                                </span>
                              ))}
                              {asset.tags.length > 2 && (
                                <span className="text-xs text-mission-control-text-dim">+{asset.tags.length - 2}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
