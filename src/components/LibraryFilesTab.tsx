import { useState, useEffect, useCallback } from 'react';
import { FolderOpen, FileText, Image, Film, Music, File, Upload, Trash2, Link, RefreshCw, Plus, Search, Grid, List, Download, X, Megaphone, Palette, Code, BookOpen } from 'lucide-react';
import EmptyState from './EmptyState';
import { showToast } from './Toast';
import { SkeletonList } from './Skeleton';
import ErrorDisplay from './ErrorDisplay';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';
import PromptDialog, { usePromptDialog } from './PromptDialog';
import { libraryApi } from '../lib/api';

type FileCategory = 'code' | 'design' | 'docs' | 'campaigns' | 'projects' | 'other';
type ViewMode = 'grid' | 'list';

interface LibraryFileItem {
  id: string;
  name: string;
  path: string;
  category: string;
  size: number;
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
  linkedTasks?: string[];
  tags?: string[];
  project?: string | null;
}

const categoryConfig: Record<string, { icon: any; color: string; label: string }> = {
  code:      { icon: Code,      color: 'text-green-400 bg-green-500/10',    label: 'Code' },
  design:    { icon: Palette,   color: 'text-purple-400 bg-purple-500/10',  label: 'Design' },
  docs:      { icon: BookOpen,  color: 'text-cyan-400 bg-cyan-500/10',      label: 'Docs' },
  campaigns: { icon: Megaphone, color: 'text-pink-400 bg-pink-500/10',      label: 'Campaigns' },
  projects:  { icon: FolderOpen,color: 'text-amber-400 bg-amber-500/10',    label: 'Projects' },
  other:     { icon: File,      color: 'text-mission-control-text-dim bg-mission-control-bg0/10', label: 'Other' },
};

const getFileIcon = (mimeType?: string) => {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Film;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('pdf') || mimeType.includes('document')) return FileText;
  return File;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface LibraryFilesTabProps {
  initialPath?: string | null;
}

export default function LibraryFilesTab({ initialPath }: LibraryFilesTabProps = {}) {
  const [files, setFiles] = useState<LibraryFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialPath || '');
  const [selectedCategory, setSelectedCategory] = useState<FileCategory | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedFile, setSelectedFile] = useState<LibraryFileItem | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerContent, setViewerContent] = useState<any>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  // Inline editing state per file: tagInput
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  const [projectInputs, setProjectInputs] = useState<Record<string, string>>({});
  const { open, config, onConfirm, showConfirm, closeConfirm } = useConfirmDialog();
  const { open: promptOpen, config: promptConfig, onSubmit: promptOnSubmit, showPrompt, closePrompt } = usePromptDialog();

  // Apply initial path filter when provided
  useEffect(() => {
    if (initialPath) {
      setSearchQuery(initialPath);
    }
  }, [initialPath]);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Fetch files via REST API
      const libraryResult = await libraryApi.getFiles();
      const libraryFiles: LibraryFileItem[] = Array.isArray(libraryResult?.files) ? (libraryResult.files as unknown as LibraryFileItem[]) : [];

      setFiles(libraryFiles);

      // Seed project inputs from loaded files
      const projectMap: Record<string, string> = {};
      for (const f of libraryFiles) {
        projectMap[f.id] = f.project || '';
      }
      setProjectInputs(projectMap);
    } catch (_error) {
      setLoadError(_error instanceof Error ? _error : new Error(String(_error)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleUpload = async () => {
    showToast('info', 'File upload not available in web mode');
  };

  const handleDelete = async (file: LibraryFileItem) => {
    showConfirm({
      title: 'Delete File',
      message: `Are you sure you want to delete "${file.name}"?`,
      confirmLabel: 'Delete',
      type: 'danger',
    }, async () => {
      try {
        const result = await fetch('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', id: file.id }),
        }).then(r => r.ok ? r.json() : { success: false });
        if (result?.success) {
          showToast('success', 'File deleted');
          loadFiles();
        } else {
          showToast('error', 'Delete failed');
        }
      } catch (error) {
        showToast('error', 'Delete failed', String(error));
      }
    });
  };

  const handleLinkToTask = (file: LibraryFileItem) => {
    showPrompt({
      title: 'Link to Task',
      message: `Enter the task ID to link "${file.name}" to:`,
      placeholder: 'task-1234567890',
      confirmLabel: 'Link',
    }, async (taskId: string) => {
      const result = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link', fileId: file.id, taskId }),
      }).then(r => r.ok ? r.json() : { success: false });
      if (result?.success) {
        showToast('success', 'Linked to task');
        loadFiles();
      } else {
        throw new Error(result?.error || 'Link failed');
      }
    });
  };

  const handleViewFile = async (file: LibraryFileItem) => {
    setSelectedFile(file);
    setViewerOpen(true);
    setViewerLoading(true);
    try {
      const result = await fetch(`/api/library?action=view&id=${encodeURIComponent(file.id)}`).then(r => r.ok ? r.json() : { success: false, error: 'Failed to load file' });
      if (result?.success) {
        const mime = result.mimeType || file.mimeType || '';
        const viewType = result.isBinary
          ? (mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'binary')
          : (mime.startsWith('image/') ? 'image'
          : mime.startsWith('video/') ? 'video'
          : mime.startsWith('audio/') ? 'audio'
          : (mime.startsWith('text/') || mime.includes('json') || mime.includes('javascript') || mime.includes('typescript') || mime.includes('python') || mime.includes('shellscript'))
          ? 'text' : 'binary');
        setViewerContent({ ...result, viewType });
      } else {
        showToast('error', 'View failed', result?.error || 'Unknown error');
        setViewerOpen(false);
      }
    } catch (error) {
      showToast('error', 'View failed', String(error));
      setViewerOpen(false);
    } finally {
      setViewerLoading(false);
    }
  };


  // Inline editing handlers
  const handleCategoryChange = async (file: LibraryFileItem, newCategory: string) => {
    try {
      await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: file.id, category: newCategory }),
      });
      loadFiles();
    } catch (_error) {
      showToast('error', 'Failed to update category');
    }
  };

  const handleTagRemove = async (file: LibraryFileItem, tagToRemove: string) => {
    const updatedTags = (file.tags || []).filter(t => t !== tagToRemove);
    try {
      await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: file.id, tags: updatedTags }),
      });
      loadFiles();
    } catch (_error) {
      showToast('error', 'Failed to remove tag');
    }
  };

  const handleTagAdd = async (file: LibraryFileItem, tagValue: string) => {
    const trimmed = tagValue.trim();
    if (!trimmed) return;
    const existing = file.tags || [];
    if (existing.includes(trimmed)) return;
    const updatedTags = [...existing, trimmed];
    setTagInputs(prev => ({ ...prev, [file.id]: '' }));
    try {
      await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: file.id, tags: updatedTags }),
      });
      loadFiles();
    } catch (_error) {
      showToast('error', 'Failed to add tag');
    }
  };

  const handleProjectSave = async (file: LibraryFileItem) => {
    const newProject = (projectInputs[file.id] || '').trim() || null;
    try {
      await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: file.id, project: newProject }),
      });
      loadFiles();
    } catch (_error) {
      showToast('error', 'Failed to update project');
    }
  };

  // Category counts always reflect the full dataset
  const categoryCounts: Record<string, number> = { all: files.length };
  for (const key of Object.keys(categoryConfig)) {
    categoryCounts[key] = files.filter(f => f.category === key).length;
  }

  // Apply category filter then search filter
  const categoryFiltered = selectedCategory === 'all' ? files : files.filter(f => f.category === selectedCategory);
  const filteredFiles = categoryFiltered.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Drag-drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    showToast('info', 'File upload not available in web mode');
  };

  return (
    <div
      className={`h-full flex flex-col transition-all ${isDragOver ? 'ring-4 ring-mission-control-accent ring-inset bg-mission-control-accent/5' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
        }
      }}
      aria-label="Library files drop zone"
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-mission-control-accent/10 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-mission-control-surface p-8 rounded-2xl border-2 border-dashed border-mission-control-accent shadow-glow-lg">
            <Upload size={64} className="text-mission-control-accent mx-auto mb-4" />
            <p className="text-xl font-medium text-mission-control-accent">Drop files here</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="p-6 border-b border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-mission-control-text-dim">
            {files.length} files • Code, Design, Docs, Campaigns, Projects
          </p>
          <div className="flex gap-2">
            <button
              onClick={loadFiles}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-mission-control-border text-mission-control-text-dim rounded-xl hover:bg-mission-control-border/80 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={handleUpload}
              className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent/90 transition-colors"
            >
              <Upload size={16} />
              Upload
            </button>
          </div>
        </div>

        {/* Search and view toggle */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-10 pr-4 py-2 bg-mission-control-bg border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent"
            />
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-mission-control-accent text-white' : 'bg-mission-control-border text-mission-control-text-dim'}`}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-mission-control-accent text-white' : 'bg-mission-control-border text-mission-control-text-dim'}`}
            >
              <Grid size={16} />
            </button>
          </div>
        </div>

        {/* Category tabs - all 9 categories */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {(['all', ...Object.keys(categoryConfig)] as const).map((cat) => {
            const catConfig = cat === 'all'
              ? { icon: FolderOpen, color: 'text-mission-control-text', label: 'All' }
              : categoryConfig[cat];
            const Icon = catConfig.icon;
            const count = categoryCounts[cat] ?? 0;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat as FileCategory | 'all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  selectedCategory === cat
                    ? 'bg-mission-control-accent text-white'
                    : 'bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                <Icon size={14} />
                {catConfig.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && files.length === 0 ? (
          <SkeletonList count={5} />
        ) : loadError ? (
          <ErrorDisplay error={loadError} onRetry={loadFiles} context={{ action: 'load files' }} />
        ) : filteredFiles.length === 0 ? (
          <EmptyState
            type="files"
            action={
              <button
                onClick={handleUpload}
                className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent/90 transition-colors"
              >
                <Plus size={16} />
                Add first file
              </button>
            }
          />
        ) : viewMode === 'list' ? (
          <div className="rounded-lg border border-mission-control-border overflow-hidden">
            {/* Table header */}
            <div className="grid gap-0 border-b border-mission-control-border bg-mission-control-bg px-3 py-1.5" style={{gridTemplateColumns:'1rem 1fr 6rem 5rem 5rem 3.5rem'}}>
              <span/>
              <span className="text-xs text-mission-control-text-dim font-medium">Name</span>
              <span className="text-xs text-mission-control-text-dim font-medium">Category</span>
              <span className="text-xs text-mission-control-text-dim font-medium text-right">Size</span>
              <span className="text-xs text-mission-control-text-dim font-medium text-right">Modified</span>
              <span/>
            </div>
            {filteredFiles.map((file, idx) => {
              const FileIcon = getFileIcon(file.mimeType);
              const catConf = categoryConfig[file.category] || categoryConfig.other;
              const CatIcon = catConf.icon;
              const isLast = idx === filteredFiles.length - 1;

              return (
                <div
                  key={file.id}
                  className={`group grid items-center gap-0 px-3 py-1.5 hover:bg-mission-control-surface/60 transition-colors cursor-pointer ${
                    !isLast ? 'border-b border-mission-control-border/50' : ''
                  } ${selectedFile?.id === file.id ? 'bg-mission-control-accent/5' : ''}`}
                  style={{gridTemplateColumns:'1rem 1fr 6rem 5rem 5rem 3.5rem'}}
                  onClick={() => handleViewFile(file)}
                >
                  {/* File type icon */}
                  <FileIcon size={12} className="text-mission-control-text-dim flex-shrink-0" />

                  {/* Name */}
                  <span className="text-xs font-medium truncate px-2 text-left hover:text-mission-control-accent transition-colors">
                    {file.name}
                  </span>

                  {/* Category badge */}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={file.category || 'other'}
                      onChange={(e) => { e.stopPropagation(); handleCategoryChange(file, e.target.value); }}
                      className="text-xs text-mission-control-text-dim bg-transparent border-0 p-0 focus:outline-none cursor-pointer w-full"
                    >
                      {Object.entries(categoryConfig).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Size */}
                  <span className="text-xs text-mission-control-text-dim text-right tabular-nums">{formatSize(file.size)}</span>

                  {/* Date */}
                  <span className="text-xs text-mission-control-text-dim text-right tabular-nums">
                    {file.updatedAt ? new Date(file.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleLinkToTask(file)} className="p-1 hover:bg-mission-control-border rounded transition-colors" title="Link to task">
                      <Link size={11} className="text-mission-control-text-dim" />
                    </button>
                    <button onClick={() => handleDelete(file)} className="p-1 hover:bg-error-subtle rounded transition-colors" title="Delete">
                      <Trash2 size={11} className="text-error" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {filteredFiles.map((file) => {
              const FileIcon = getFileIcon(file.mimeType);
              const catConf = categoryConfig[file.category] || categoryConfig.other;

              return (
                <div
                  key={file.id}
                  onClick={() => handleViewFile(file)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleViewFile(file); } }}
                  role="button"
                  tabIndex={0}
                  className={`p-3 bg-mission-control-surface border border-mission-control-border rounded-lg hover:border-mission-control-accent/40 cursor-pointer transition-colors group ${
                    selectedFile?.id === file.id ? 'border-mission-control-accent' : ''
                  }`}
                >
                  <div className={`p-2.5 rounded-lg ${catConf.color} mb-2 flex items-center justify-center`}>
                    <FileIcon size={20} />
                  </div>
                  <div className="text-xs font-medium truncate leading-tight">{file.name}</div>
                  <div className="text-xs text-mission-control-text-dim mt-0.5">{formatSize(file.size)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* File Viewer Modal */}
      {viewerOpen && selectedFile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-mission-control-surface rounded-2xl border border-mission-control-border shadow-glow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-mission-control-border">
              <div className="flex-1 min-w-0 mr-4">
                <h3 className="font-bold text-lg truncate">{selectedFile.name}</h3>
                <p className="text-sm text-mission-control-text-dim mt-1">
                  {formatSize(selectedFile.size)} • {selectedFile.mimeType || 'Unknown type'}
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  href={`/api/library?action=raw&id=${encodeURIComponent(selectedFile.id)}`}
                  download={selectedFile.name}
                  className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors"
                >
                  <Download size={16} />
                  Download
                </a>
                <button
                  onClick={() => setViewerOpen(false)}
                  className="p-2 hover:bg-mission-control-border rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {viewerLoading ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw size={32} className="text-mission-control-text-dim animate-spin" />
                </div>
              ) : viewerContent?.viewType === 'text' ? (
                <pre className="text-sm bg-mission-control-bg p-4 rounded-lg overflow-auto whitespace-pre-wrap font-mono">
                  {viewerContent.content}
                </pre>
              ) : viewerContent?.viewType === 'image' ? (
                <div className="flex items-center justify-center">
                  <img
                    src={viewerContent.content}
                    alt={selectedFile.name}
                    className="max-w-full max-h-[60vh] object-contain rounded-lg"
                  />
                </div>
              ) : viewerContent?.viewType === 'video' ? (
                <div className="flex items-center justify-center">
                  <video
                    controls
                    className="max-w-full max-h-[60vh] rounded-lg"
                  >
                    <source src={viewerContent.content} />
                    Your browser does not support the video tag.
                  </video>
                </div>
              ) : viewerContent?.viewType === 'audio' ? (
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <audio controls className="w-full max-w-lg">
                    <source src={viewerContent.content} />
                    Your browser does not support the audio tag.
                  </audio>
                </div>
              ) : viewerContent?.viewType === 'binary' ? (
                <div className="text-center py-12">
                  <File size={64} className="text-mission-control-text-dim mx-auto mb-4" />
                  <p className="text-mission-control-text-dim mb-6">
                    This file type cannot be previewed.<br />
                    Click Download to save it.
                  </p>
                  <a
                    href={`/api/library?action=raw&id=${encodeURIComponent(selectedFile.id)}`}
                    download={selectedFile.name}
                    className="flex items-center gap-2 px-6 py-3 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent/90 transition-colors mx-auto"
                  >
                    <Download size={20} />
                    Download File
                  </a>
                </div>
              ) : (
                <div className="text-center py-12 text-mission-control-text-dim">
                  Failed to load file content
                </div>
              )}
            </div>

            {/* Footer with metadata */}
            {selectedFile.linkedTasks && selectedFile.linkedTasks.length > 0 && (
              <div className="p-4 border-t border-mission-control-border bg-mission-control-bg/50">
                <p className="text-sm text-mission-control-text-dim mb-2">Linked to tasks:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedFile.linkedTasks.map(taskId => (
                    <span
                      key={taskId}
                      className="px-2 py-1 bg-mission-control-border rounded text-xs font-mono"
                    >
                      {taskId}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={open}
        onClose={closeConfirm}
        onConfirm={onConfirm}
        title={config.title}
        message={config.message}
        confirmLabel={config.confirmLabel}
        cancelLabel={config.cancelLabel}
        type={config.type}
      />
      <PromptDialog
        open={promptOpen}
        onClose={closePrompt}
        onSubmit={promptOnSubmit}
        title={promptConfig.title}
        message={promptConfig.message}
        placeholder={promptConfig.placeholder}
        confirmLabel={promptConfig.confirmLabel}
      />
    </div>
  );
}
