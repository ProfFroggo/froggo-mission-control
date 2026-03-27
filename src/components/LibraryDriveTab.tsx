// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';
import { Flex, IconButton } from '@radix-ui/themes';
import {
  Folder, FolderOpen, File, FileText, Image, Film, Presentation,
  ChevronRight, RefreshCw, ExternalLink, Home, AlertCircle,
  FileSpreadsheet, Grid, List,
} from 'lucide-react';
import SearchInput from './SearchInput';
import { showToast } from './Toast';
import { SkeletonList } from './Skeleton';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size: number | null;
  modifiedTime: string | null;
  createdTime: string | null;
  webViewLink: string | null;
  kind: string;
}

interface BreadcrumbEntry {
  id: string;
  name: string;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function DriveFileIcon({ kind, isFolder, open }: { kind: string; isFolder: boolean; open?: boolean }) {
  const cls = 'flex-shrink-0';
  if (isFolder) {
    return open
      ? <FolderOpen size={16} className={`text-[var(--color-warning)] ${cls}`} />
      : <Folder size={16} className={`text-[var(--color-warning)] ${cls}`} />;
  }
  switch (kind) {
    case 'doc':    return <FileText size={14} className={`text-[var(--color-info)] ${cls}`} />;
    case 'sheet':  return <FileSpreadsheet size={14} className={`text-[var(--color-success)] ${cls}`} />;
    case 'slides': return <Presentation size={14} className={`text-[var(--color-review)] ${cls}`} />;
    case 'image':  return <Image size={14} className={`text-pink-400 ${cls}`} />;
    case 'video':  return <Film size={14} className={`text-purple-400 ${cls}`} />;
    case 'pdf':    return <FileText size={14} className={`text-[var(--color-error)] ${cls}`} />;
    default:       return <File size={14} className={`text-mission-control-text-dim ${cls}`} />;
  }
}

function DriveIconBox({ kind, isFolder }: { kind: string; isFolder: boolean }) {
  const baseClass = 'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0';
  if (isFolder) return <div className={`${baseClass} bg-[var(--color-warning)]/10`}><Folder size={16} className="text-[var(--color-warning)]" /></div>;
  switch (kind) {
    case 'doc':    return <div className={`${baseClass} bg-[var(--color-info)]/10`}><FileText size={14} className="text-[var(--color-info)]" /></div>;
    case 'sheet':  return <div className={`${baseClass} bg-[var(--color-success)]/10`}><FileSpreadsheet size={14} className="text-[var(--color-success)]" /></div>;
    case 'slides': return <div className={`${baseClass} bg-[var(--color-review)]/10`}><Presentation size={14} className="text-[var(--color-review)]" /></div>;
    case 'image':  return <div className={`${baseClass} bg-pink-500/10`}><Image size={14} className="text-pink-400" /></div>;
    case 'video':  return <div className={`${baseClass} bg-purple-500/10`}><Film size={14} className="text-purple-400" /></div>;
    case 'pdf':    return <div className={`${baseClass} bg-[var(--color-error)]/10`}><FileText size={14} className="text-[var(--color-error)]" /></div>;
    default:       return <div className={`${baseClass} bg-mission-control-border/40`}><File size={14} className="text-mission-control-text-dim" /></div>;
  }
}

export default function LibraryDriveTab() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([{ id: 'root', name: 'My Drive' }]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');

  const currentFolderId = breadcrumbs[breadcrumbs.length - 1].id;

  const loadFiles = useCallback(async (folderId: string, pageToken?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ folderId });
      if (pageToken) params.set('pageToken', pageToken);
      if (searchQuery) params.set('q', searchQuery);
      const res = await fetch(`/api/drive/files?${params}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.needsAuth) { setNeedsAuth(true); return; }
        throw new Error(data.error || 'Failed to load Drive files');
      }
      setFiles(pageToken ? prev => [...prev, ...data.files] : data.files);
      setNextPageToken(data.nextPageToken);
    } catch (err: any) {
      setError(err.message ?? 'Drive error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadFiles(currentFolderId);
  }, [currentFolderId, loadFiles]);

  const navigateInto = (folder: DriveFile) => {
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
    setFiles([]);
    setNextPageToken(null);
  };

  const navigateTo = (idx: number) => {
    setBreadcrumbs(prev => prev.slice(0, idx + 1));
    setFiles([]);
    setNextPageToken(null);
  };

  const handleFileClick = (f: DriveFile) => {
    if (f.isFolder) {
      navigateInto(f);
    } else if (f.webViewLink) {
      window.open(f.webViewLink, '_blank', 'noopener');
    } else {
      showToast('error', 'No preview link for this file');
    }
  };

  if (needsAuth) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
        <div className="p-3 bg-[var(--color-warning)]/10 rounded-full">
          <AlertCircle size={24} className="text-[var(--color-warning)]" />
        </div>
        <div className="text-center">
          <p className="font-medium text-mission-control-text">Google Drive not connected</p>
          <p className="text-sm text-mission-control-text-dim mt-1">
            Connect your Google account in Settings to browse Drive files here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 border-b border-mission-control-border bg-mission-control-bg px-4 py-2">
        <Flex align="center" gap="2">
          {/* Search */}
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onKeyDown={e => { if (e.key === 'Enter') loadFiles(currentFolderId); }}
            placeholder="Search Drive..."
            className="flex-1"
          />
          {/* View toggle */}
          <div className="flex flex-shrink-0 border border-mission-control-border rounded-lg overflow-hidden">
            <button type="button" onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'} className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'}`}>
              <List size={14} />
            </button>
            <button type="button" onClick={() => setViewMode('grid')} aria-pressed={viewMode === 'grid'} className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'}`}>
              <Grid size={14} />
            </button>
          </div>
          <IconButton variant="ghost" size="1" color="gray" onClick={() => loadFiles(currentFolderId)} disabled={loading} aria-label="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </IconButton>
        </Flex>
      </div>

      {/* Breadcrumb */}
      <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2 border-b border-mission-control-border bg-mission-control-surface overflow-x-auto">
        {breadcrumbs.map((crumb, idx) => (
          <Flex key={crumb.id} align="center" gap="1">
            {idx > 0 && <ChevronRight size={12} className="text-mission-control-text-dim flex-shrink-0" />}
            <button
              type="button"
              onClick={() => navigateTo(idx)}
              className={`flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded transition-colors flex-shrink-0 ${
                idx === breadcrumbs.length - 1
                  ? 'text-mission-control-text cursor-default'
                  : 'text-mission-control-accent hover:text-mission-control-accent/80'
              }`}
            >
              {idx === 0 && <Home size={11} />}
              {crumb.name}
            </button>
          </Flex>
        ))}
      </div>

      {/* File list / grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && files.length === 0 ? (
          <SkeletonList count={6} />
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <AlertCircle size={24} className="text-[var(--color-error)]" />
            <p className="text-sm text-mission-control-text-dim">{error}</p>
            <button onClick={() => loadFiles(currentFolderId)} className="text-xs text-mission-control-accent hover:underline">Try again</button>
          </div>
        ) : files.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-mission-control-text-dim">
            <FolderOpen size={32} className="opacity-30" />
            <p className="text-sm">This folder is empty</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="rounded-xl border border-mission-control-border overflow-hidden">
            {/* Header */}
            <div className="grid border-b border-mission-control-border bg-mission-control-bg px-3 py-2" style={{ gridTemplateColumns: '2rem 1fr 7rem 5rem 3rem' }}>
              <span />
              <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Name</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Modified</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim text-right">Size</span>
              <span />
            </div>
            {files.map((f, idx) => (
              <div
                key={f.id}
                onClick={() => handleFileClick(f)}
                className={`group grid items-center px-3 py-2.5 cursor-pointer hover:bg-mission-control-border/10 transition-colors ${idx < files.length - 1 ? 'border-b border-mission-control-border/50' : ''}`}
                style={{ gridTemplateColumns: '2rem 1fr 7rem 5rem 3rem' }}
              >
                <DriveFileIcon kind={f.kind} isFolder={f.isFolder} />
                <span className="text-xs font-medium truncate px-2 hover:text-mission-control-accent transition-colors">
                  {f.name}
                </span>
                <span className="text-xs text-mission-control-text-dim">{formatDate(f.modifiedTime)}</span>
                <span className="text-xs text-mission-control-text-dim text-right">{formatSize(f.size)}</span>
                <Flex justify="end">
                  {!f.isFolder && f.webViewLink && (
                    <a
                      href={f.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 inline-flex items-center justify-center w-6 h-6 rounded text-mission-control-text-dim hover:text-mission-control-text transition-all"
                      title="Open in Drive"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                  {f.isFolder && <ChevronRight size={12} className="text-mission-control-text-dim" />}
                </Flex>
              </div>
            ))}
          </div>
        ) : (
          // Grid view
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {files.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => handleFileClick(f)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border border-mission-control-border bg-mission-control-surface hover:border-mission-control-accent/40 hover:bg-mission-control-accent/5 transition-colors text-left"
              >
                <DriveIconBox kind={f.kind} isFolder={f.isFolder} />
                <span className="text-xs font-medium text-center line-clamp-2 w-full">{f.name}</span>
                <span className="text-[10px] text-mission-control-text-dim">{formatDate(f.modifiedTime)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Load more */}
        {nextPageToken && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => loadFiles(currentFolderId, nextPageToken)}
              disabled={loading}
              className="text-xs text-mission-control-accent hover:underline disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
