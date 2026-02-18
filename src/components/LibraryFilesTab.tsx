import { useState, useEffect, useCallback } from 'react';
import { FolderOpen, FileText, Image, Film, Music, File, Upload, Trash2, Link, RefreshCw, Plus, Search, Grid, List, Download, X, ExternalLink, TrendingUp, Palette, Code, DollarSign, TestTube, Share2, Tag, Edit2 } from 'lucide-react';
import EmptyState from './EmptyState';
import { showToast } from './Toast';
import { SkeletonList } from './Skeleton';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';

type FileCategory = 'marketing' | 'design' | 'dev' | 'research' | 'finance' | 'test-logs' | 'content' | 'social' | 'other';
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
  marketing:   { icon: TrendingUp,  color: 'text-pink-400 bg-pink-500/10',   label: 'Marketing' },
  design:      { icon: Palette,     color: 'text-purple-400 bg-purple-500/10', label: 'UI/Design' },
  dev:         { icon: Code,        color: 'text-green-400 bg-green-500/10',  label: 'Dev' },
  research:    { icon: Search,      color: 'text-cyan-400 bg-cyan-500/10',    label: 'Research' },
  finance:     { icon: DollarSign,  color: 'text-amber-400 bg-amber-500/10',  label: 'Finance' },
  'test-logs': { icon: TestTube,    color: 'text-orange-400 bg-orange-500/10', label: 'Test Logs' },
  content:     { icon: FileText,    color: 'text-blue-400 bg-blue-500/10',    label: 'Content' },
  social:      { icon: Share2,      color: 'text-indigo-400 bg-indigo-500/10', label: 'Social' },
  other:       { icon: File,        color: 'text-clawd-text-dim bg-clawd-bg0/10', label: 'Other' },
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

  // Apply initial path filter when provided
  useEffect(() => {
    if (initialPath) {
      setSearchQuery(initialPath);
    }
  }, [initialPath]);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const libraryResult = await window.clawdbot?.library?.list(selectedCategory === 'all' ? undefined : selectedCategory);
      const libraryFiles: LibraryFileItem[] = libraryResult?.success ? ((libraryResult.files || []) as unknown as LibraryFileItem[]) : [];

      const attachmentsResult = await window.clawdbot?.tasks?.attachments?.listAll();
      const taskAttachments = attachmentsResult?.success ? (attachmentsResult.attachments || []) : [];

      const convertedAttachments: LibraryFileItem[] = taskAttachments.map((att: any) => ({
        id: `attachment-${att.id}`,
        name: att.filename || 'Unnamed',
        path: att.file_path || '',
        category: att.category || 'other',
        size: att.file_size || 0,
        mimeType: att.mime_type,
        createdAt: att.uploaded_at || '',
        updatedAt: att.uploaded_at || '',
        linkedTasks: att.task_id ? [att.task_id] : [],
        tags: [],
        project: null,
      }));

      const allFiles = [...libraryFiles, ...convertedAttachments];

      if (selectedCategory !== 'all') {
        setFiles(allFiles.filter(f => f.category === selectedCategory));
      } else {
        setFiles(allFiles);
      }

      // Seed project inputs from loaded files
      const projectMap: Record<string, string> = {};
      for (const f of allFiles) {
        projectMap[f.id] = f.project || '';
      }
      setProjectInputs(projectMap);
    } catch (_error) {
      // '[Library] Load error:', error;
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleUpload = async () => {
    try {
      const result = await window.clawdbot?.library?.upload();
      if (result?.success) {
        showToast('success', 'File uploaded', result.file?.name);
        loadFiles();
      }
    } catch (error) {
      showToast('error', 'Upload failed', String(error));
    }
  };

  const handleDelete = async (file: LibraryFileItem) => {
    showConfirm({
      title: 'Delete File',
      message: `Are you sure you want to delete "${file.name}"?`,
      confirmLabel: 'Delete',
      type: 'danger',
    }, async () => {
      try {
        const result = await window.clawdbot?.library?.delete(file.id);
        if (result?.success) {
          showToast('success', 'File deleted');
          loadFiles();
        }
      } catch (error) {
        showToast('error', 'Delete failed', String(error));
      }
    });
  };

  const handleLinkToTask = async (file: LibraryFileItem) => {
    const taskId = prompt('Enter task ID to link:');
    if (!taskId) return;
    try {
      const result = await window.clawdbot?.library?.link(file.id, taskId);
      if (result?.success) {
        showToast('success', 'Linked to task');
        loadFiles();
      }
    } catch (error) {
      showToast('error', 'Link failed', String(error));
    }
  };

  const handleViewFile = async (file: LibraryFileItem) => {
    setSelectedFile(file);
    setViewerOpen(true);
    setViewerLoading(true);
    try {
      const result = await window.clawdbot?.library?.view(file.id);
      if (result?.success) {
        setViewerContent(result);
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

  const handleDownloadFile = async (file: LibraryFileItem) => {
    try {
      const result = await window.clawdbot?.library?.download(file.id);
      if (result?.success) {
        showToast('success', 'File saved', result.path);
      } else if (result?.error !== 'Cancelled') {
        showToast('error', 'Download failed', result?.error || 'Unknown error');
      }
    } catch (error) {
      showToast('error', 'Download failed', String(error));
    }
  };

  const openInDefaultApp = () => {
    if (viewerContent?.path) {
      window.clawdbot?.shell?.openPath(viewerContent.path);
    }
  };

  // Inline editing handlers
  const handleCategoryChange = async (file: LibraryFileItem, newCategory: string) => {
    try {
      await window.clawdbot?.library?.update(file.id, { category: newCategory });
      loadFiles();
    } catch (_error) {
      showToast('error', 'Failed to update category');
    }
  };

  const handleTagRemove = async (file: LibraryFileItem, tagToRemove: string) => {
    const updatedTags = (file.tags || []).filter(t => t !== tagToRemove);
    try {
      await window.clawdbot?.library?.update(file.id, { tags: updatedTags });
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
      await window.clawdbot?.library?.update(file.id, { tags: updatedTags });
      loadFiles();
    } catch (_error) {
      showToast('error', 'Failed to add tag');
    }
  };

  const handleProjectSave = async (file: LibraryFileItem) => {
    const newProject = (projectInputs[file.id] || '').trim() || null;
    try {
      await window.clawdbot?.library?.update(file.id, { project: newProject });
      loadFiles();
    } catch (_error) {
      showToast('error', 'Failed to update project');
    }
  };

  const filteredFiles = files.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Dynamic category counts from categoryConfig keys
  const categoryCounts: Record<string, number> = { all: files.length };
  for (const key of Object.keys(categoryConfig)) {
    categoryCounts[key] = files.filter(f => f.category === key).length;
  }

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

    for (const file of droppedFiles) {
      showToast('info', 'Uploading', file.name);
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const result = await window.clawdbot?.library?.uploadBuffer({
            name: file.name,
            type: file.type,
            buffer: reader.result,
          });
          if (result?.success) {
            showToast('success', 'Uploaded', file.name);
            loadFiles();
          }
        };
        reader.readAsArrayBuffer(file);
      } catch (_error) {
        showToast('error', 'Upload failed', file.name);
      }
    }
  };

  return (
    <div
      className={`h-full flex flex-col transition-all ${isDragOver ? 'ring-4 ring-clawd-accent ring-inset bg-clawd-accent/5' : ''}`}
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
        <div className="absolute inset-0 bg-clawd-accent/10 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-clawd-surface p-8 rounded-2xl border-2 border-dashed border-clawd-accent shadow-glow-lg">
            <Upload size={64} className="text-clawd-accent mx-auto mb-4" />
            <p className="text-xl font-medium text-clawd-accent">Drop files here</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="p-6 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-clawd-text-dim">
            {files.length} files • Marketing, Design, Dev and more
          </p>
          <div className="flex gap-2">
            <button
              onClick={loadFiles}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-clawd-border text-clawd-text-dim rounded-xl hover:bg-clawd-border/80 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={handleUpload}
              className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent/90 transition-colors"
            >
              <Upload size={16} />
              Upload
            </button>
          </div>
        </div>

        {/* Search and view toggle */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clawd-text-dim" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-10 pr-4 py-2 bg-clawd-bg border border-clawd-border rounded-lg focus:outline-none focus:border-clawd-accent"
            />
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-clawd-accent text-white' : 'bg-clawd-border text-clawd-text-dim'}`}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-clawd-accent text-white' : 'bg-clawd-border text-clawd-text-dim'}`}
            >
              <Grid size={16} />
            </button>
          </div>
        </div>

        {/* Category tabs - all 9 categories */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {(['all', ...Object.keys(categoryConfig)] as const).map((cat) => {
            const catConfig = cat === 'all'
              ? { icon: FolderOpen, color: 'text-clawd-text', label: 'All' }
              : categoryConfig[cat];
            const Icon = catConfig.icon;
            const count = categoryCounts[cat] ?? 0;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat as FileCategory | 'all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  selectedCategory === cat
                    ? 'bg-clawd-accent text-white'
                    : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
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
      <div className="flex-1 overflow-y-auto p-6">
        {loading && files.length === 0 ? (
          <SkeletonList count={5} />
        ) : filteredFiles.length === 0 ? (
          <EmptyState
            type="files"
            action={
              <button
                onClick={handleUpload}
                className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent/90 transition-colors"
              >
                <Plus size={16} />
                Add first file
              </button>
            }
          />
        ) : viewMode === 'list' ? (
          <div className="space-y-2">
            {filteredFiles.map((file) => {
              const FileIcon = getFileIcon(file.mimeType);
              const catConf = categoryConfig[file.category] || categoryConfig.other;
              const fileTags = file.tags || [];
              const tagInputVal = tagInputs[file.id] || '';
              const projectVal = projectInputs[file.id] !== undefined ? projectInputs[file.id] : (file.project || '');

              return (
                <div
                  key={file.id}
                  className={`p-4 bg-clawd-surface border border-clawd-border rounded-xl hover:border-clawd-accent/30 transition-colors ${
                    selectedFile?.id === file.id ? 'border-clawd-accent' : ''
                  }`}
                >
                  {/* Main row - clickable to open viewer */}
                  <div
                    onClick={() => handleViewFile(file)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleViewFile(file); } }}
                    role="button"
                    tabIndex={0}
                    className="flex items-center gap-4 cursor-pointer"
                  >
                    <div className={`p-3 rounded-lg flex-shrink-0 ${catConf.color}`}>
                      <FileIcon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{file.name}</div>
                      <div className="text-sm text-clawd-text-dim flex items-center gap-2">
                        <span>{formatSize(file.size)}</span>
                        <span>•</span>
                        <span>
                          {file.updatedAt
                            ? new Date(file.updatedAt).toLocaleDateString()
                            : file.createdAt
                            ? new Date(file.createdAt).toLocaleDateString()
                            : 'No date'}
                        </span>
                        {file.linkedTasks && file.linkedTasks.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Link size={14} />
                              {file.linkedTasks.length} tasks
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleLinkToTask(file); }}
                        className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
                        title="Link to task"
                      >
                        <Link size={16} className="text-clawd-text-dim" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(file); }}
                        className="p-2 hover:bg-error-subtle rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} className="text-error" />
                      </button>
                    </div>
                  </div>

                  {/* Inline editing row */}
                  <div
                    className="mt-3 pt-3 border-t border-clawd-border flex flex-wrap items-center gap-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Category dropdown */}
                    <div className="flex items-center gap-1.5">
                      <Edit2 size={12} className="text-clawd-text-dim flex-shrink-0" />
                      <select
                        value={file.category || 'other'}
                        onChange={(e) => { e.stopPropagation(); handleCategoryChange(file, e.target.value); }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-clawd-bg border border-clawd-border rounded text-sm px-2 py-1 text-clawd-text focus:outline-none focus:border-clawd-accent cursor-pointer"
                      >
                        {Object.entries(categoryConfig).map(([key, val]) => (
                          <option key={key} value={key}>{val.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Tags */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Tag size={12} className="text-clawd-text-dim flex-shrink-0" />
                      {fileTags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-clawd-accent/20 text-clawd-accent text-xs rounded-full flex items-center gap-1"
                        >
                          {tag}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleTagRemove(file, tag); }}
                            className="hover:text-white transition-colors ml-0.5"
                            title={`Remove tag "${tag}"`}
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={tagInputVal}
                        onChange={(e) => {
                          e.stopPropagation();
                          setTagInputs(prev => ({ ...prev, [file.id]: e.target.value }));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleTagAdd(file, tagInputVal);
                          }
                        }}
                        placeholder="+ tag"
                        className="text-xs text-clawd-text-dim bg-clawd-bg border border-clawd-border rounded px-2 py-0.5 w-16 focus:outline-none focus:border-clawd-accent focus:w-24 transition-all"
                      />
                    </div>

                    {/* Project */}
                    <div className="flex items-center gap-1.5">
                      <FolderOpen size={12} className="text-clawd-text-dim flex-shrink-0" />
                      <input
                        type="text"
                        value={projectVal}
                        onChange={(e) => {
                          e.stopPropagation();
                          setProjectInputs(prev => ({ ...prev, [file.id]: e.target.value }));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleProjectSave(file);
                          }
                        }}
                        onBlur={() => handleProjectSave(file)}
                        placeholder="Project..."
                        className="text-xs text-clawd-text-dim bg-transparent border-b border-transparent hover:border-clawd-border focus:border-clawd-accent focus:outline-none w-24 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                  className={`p-4 bg-clawd-surface border border-clawd-border rounded-xl hover:border-clawd-accent/30 cursor-pointer transition-colors ${
                    selectedFile?.id === file.id ? 'border-clawd-accent' : ''
                  }`}
                >
                  <div className={`p-4 rounded-lg ${catConf.color} mb-3`}>
                    <FileIcon size={32} className="mx-auto" />
                  </div>
                  <div className="font-medium truncate text-sm">{file.name}</div>
                  <div className="text-xs text-clawd-text-dim mt-1">{formatSize(file.size)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* File Viewer Modal */}
      {viewerOpen && selectedFile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-clawd-surface rounded-2xl border border-clawd-border shadow-glow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-clawd-border">
              <div className="flex-1 min-w-0 mr-4">
                <h3 className="font-bold text-lg truncate">{selectedFile.name}</h3>
                <p className="text-sm text-clawd-text-dim mt-1">
                  {formatSize(selectedFile.size)} • {selectedFile.mimeType || 'Unknown type'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={openInDefaultApp}
                  className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
                  title="Open in default app"
                >
                  <ExternalLink size={20} className="text-clawd-text-dim" />
                </button>
                <button
                  onClick={() => handleDownloadFile(selectedFile)}
                  className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/90 transition-colors"
                >
                  <Download size={16} />
                  Download
                </button>
                <button
                  onClick={() => setViewerOpen(false)}
                  className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {viewerLoading ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw size={32} className="text-clawd-text-dim animate-spin" />
                </div>
              ) : viewerContent?.viewType === 'text' ? (
                <pre className="text-sm bg-clawd-bg p-4 rounded-lg overflow-auto whitespace-pre-wrap font-mono">
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
              ) : viewerContent?.viewType === 'binary' ? (
                <div className="text-center py-12">
                  <File size={64} className="text-clawd-text-dim mx-auto mb-4" />
                  <p className="text-clawd-text-dim mb-6">
                    This file type cannot be previewed.<br />
                    Click Download to save it.
                  </p>
                  <button
                    onClick={() => handleDownloadFile(selectedFile)}
                    className="flex items-center gap-2 px-6 py-3 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent/90 transition-colors mx-auto"
                  >
                    <Download size={20} />
                    Download File
                  </button>
                </div>
              ) : (
                <div className="text-center py-12 text-clawd-text-dim">
                  Failed to load file content
                </div>
              )}
            </div>

            {/* Footer with metadata */}
            {selectedFile.linkedTasks && selectedFile.linkedTasks.length > 0 && (
              <div className="p-4 border-t border-clawd-border bg-clawd-bg/50">
                <p className="text-sm text-clawd-text-dim mb-2">Linked to tasks:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedFile.linkedTasks.map(taskId => (
                    <span
                      key={taskId}
                      className="px-2 py-1 bg-clawd-border rounded text-xs font-mono"
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
    </div>
  );
}
