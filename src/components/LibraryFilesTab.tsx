import { useState, useEffect, useCallback } from 'react';
import { FolderOpen, FileText, Image, Film, Music, File, Upload, Trash2, Link, RefreshCw, Plus, Search, Grid, List, Download, X, ExternalLink } from 'lucide-react';
import EmptyState from './EmptyState';
import { showToast } from './Toast';
import { SkeletonList } from './Skeleton';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';

type FileCategory = 'draft' | 'document' | 'media' | 'strategy' | 'research' | 'other';
type ViewMode = 'grid' | 'list';

interface LibraryFile {
  id: string;
  name: string;
  path: string;
  category: string; // Allow any category from database
  size: number;
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
  linkedTasks?: string[];
  tags?: string[];
}

const categoryConfig: Record<string, { icon: any; color: string; label: string }> = {
  draft: { icon: FileText, color: 'text-info bg-info-subtle', label: 'Drafts' },
  document: { icon: FileText, color: 'text-success bg-success-subtle', label: 'Documents' },
  media: { icon: Image, color: 'text-review bg-review-subtle', label: 'Media' },
  strategy: { icon: FileText, color: 'text-amber-400 bg-warning/10', label: 'Strategy' },
  research: { icon: FileText, color: 'text-cyan-400 bg-cyan-500/10', label: 'Research' },
  other: { icon: File, color: 'text-clawd-text-dim bg-clawd-bg0/10', label: 'Other' },
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
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialPath || '');
  const [selectedCategory, setSelectedCategory] = useState<FileCategory | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedFile, setSelectedFile] = useState<LibraryFile | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerContent, setViewerContent] = useState<any>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
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
      // Fetch library files
      const libraryResult = await (window as any).clawdbot?.library?.list(selectedCategory === 'all' ? undefined : selectedCategory);
      const libraryFiles: LibraryFile[] = libraryResult?.success ? (libraryResult.files || []) : [];
      
      // Fetch task attachments
      const attachmentsResult = await (window as any).clawdbot?.tasks?.attachments?.listAll();
      const taskAttachments = attachmentsResult?.success ? (attachmentsResult.attachments || []) : [];
      
      // Convert task attachments to LibraryFile format
      const convertedAttachments: LibraryFile[] = taskAttachments.map((att: any) => ({
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
      }));
      
      // Merge both sources
      const allFiles = [...libraryFiles, ...convertedAttachments];
      
      // Apply category filter if needed
      if (selectedCategory !== 'all') {
        setFiles(allFiles.filter(f => f.category === selectedCategory));
      } else {
        setFiles(allFiles);
      }
    } catch (error) {
      console.error('[Library] Load error:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleUpload = async () => {
    try {
      const result = await (window as any).clawdbot?.library?.upload();
      if (result?.success) {
        showToast('success', 'File uploaded', result.file?.name);
        loadFiles();
      }
    } catch (error) {
      console.error('[Library] Upload error:', error);
      showToast('error', 'Upload failed', String(error));
    }
  };

  const handleDelete = async (file: LibraryFile) => {
    showConfirm({
      title: 'Delete File',
      message: `Are you sure you want to delete "${file.name}"?`,
      confirmLabel: 'Delete',
      type: 'danger',
    }, async () => {
      try {
        const result = await (window as any).clawdbot?.library?.delete(file.id);
        if (result?.success) {
          showToast('success', 'File deleted');
          loadFiles();
        }
      } catch (error) {
        showToast('error', 'Delete failed', String(error));
      }
    });
  };

  const handleLinkToTask = async (file: LibraryFile) => {
    const taskId = prompt('Enter task ID to link:');
    if (!taskId) return;
    
    try {
      const result = await (window as any).clawdbot?.library?.link(file.id, taskId);
      if (result?.success) {
        showToast('success', 'Linked to task');
        loadFiles();
      }
    } catch (error) {
      showToast('error', 'Link failed', String(error));
    }
  };

  const handleViewFile = async (file: LibraryFile) => {
    setSelectedFile(file);
    setViewerOpen(true);
    setViewerLoading(true);
    
    try {
      const result = await (window as any).clawdbot?.library?.view(file.id);
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

  const handleDownloadFile = async (file: LibraryFile) => {
    try {
      const result = await (window as any).clawdbot?.library?.download(file.id);
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
      (window as any).clawdbot?.shell?.openPath(viewerContent.path);
    }
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const categoryCounts = {
    all: files.length,
    draft: files.filter(f => f.category === 'draft').length,
    document: files.filter(f => f.category === 'document').length,
    media: files.filter(f => f.category === 'media').length,
    strategy: files.filter(f => f.category === 'strategy').length,
    research: files.filter(f => f.category === 'research').length,
    other: files.filter(f => f.category === 'other').length,
  };

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
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    
    for (const file of files) {
      showToast('info', 'Uploading', file.name);
      try {
        // Convert file to upload format
        const reader = new FileReader();
        reader.onload = async () => {
          const result = await (window as any).clawdbot?.library?.uploadBuffer({
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
            {files.length} files • Drafts, documents, media
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

        {/* Search and filters */}
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

        {/* Category tabs */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {(['all', 'draft', 'document', 'media', 'other'] as const).map((cat) => {
            const config = cat === 'all' ? { icon: FolderOpen, color: 'text-clawd-text', label: 'All' } : categoryConfig[cat];
            const Icon = config.icon;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  selectedCategory === cat
                    ? 'bg-clawd-accent text-white'
                    : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
                }`}
              >
                <Icon size={14} />
                {config.label} ({categoryCounts[cat]})
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
              const config = categoryConfig[file.category] || categoryConfig.other;
              
              return (
                <div
                  key={file.id}
                  onClick={() => handleViewFile(file)}
                  className={`p-4 bg-clawd-surface border border-clawd-border rounded-xl hover:border-clawd-accent/30 cursor-pointer transition-colors ${
                    selectedFile?.id === file.id ? 'border-clawd-accent' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${config.color}`}>
                      <FileIcon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{file.name}</div>
                      <div className="text-sm text-clawd-text-dim flex items-center gap-2">
                        <span>{formatSize(file.size)}</span>
                        <span>•</span>
                        <span>{file.updatedAt ? new Date(file.updatedAt).toLocaleDateString() : file.createdAt ? new Date(file.createdAt).toLocaleDateString() : 'No date'}</span>
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
                    <div className="flex gap-2">
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
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredFiles.map((file) => {
              const FileIcon = getFileIcon(file.mimeType);
              const config = categoryConfig[file.category] || categoryConfig.other;
              
              return (
                <div
                  key={file.id}
                  onClick={() => handleViewFile(file)}
                  className={`p-4 bg-clawd-surface border border-clawd-border rounded-xl hover:border-clawd-accent/30 cursor-pointer transition-colors ${
                    selectedFile?.id === file.id ? 'border-clawd-accent' : ''
                  }`}
                >
                  <div className={`p-4 rounded-lg ${config.color} mb-3`}>
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
