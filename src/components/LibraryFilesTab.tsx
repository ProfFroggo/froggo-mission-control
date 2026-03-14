import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderOpen, FileText, Image, Film, Music, File, Upload, Trash2, Link,
  RefreshCw, Plus, Search, Grid, List, Download, X, Megaphone, Palette,
  Code, BookOpen, Bot, PanelLeftClose, PanelLeftOpen, Star, Copy,
  ChevronRight, ChevronDown, Clock, Send, Tag, Info, Check, FolderPlus,
  Wand2, Loader2,
} from 'lucide-react';
import EmptyState from './EmptyState';
import { showToast } from './Toast';
import { SkeletonList } from './Skeleton';
import ErrorDisplay from './ErrorDisplay';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';
import PromptDialog, { usePromptDialog } from './PromptDialog';
import { libraryApi } from '../lib/api';

type FileCategory = 'code' | 'design' | 'docs' | 'campaigns' | 'projects' | 'other';
type ViewMode = 'grid' | 'list';
type SearchMode = 'filter' | 'ask';
type SortMode = 'newest' | 'oldest' | 'name';
type TypeFilter = 'all' | 'text' | 'images' | 'code' | 'data';

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
  createdBy?: string | null;
}

interface LibraryFolder {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  sort_order?: number;
}

interface MiniChatMessage {
  role: 'user' | 'assistant';
  content: string;
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

const isTextFile = (mimeType?: string, name?: string): boolean => {
  if (!mimeType && !name) return false;
  if (mimeType) {
    if (mimeType.startsWith('text/')) return true;
    if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('python') || mimeType.includes('shellscript')) return true;
  }
  if (name) {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    return ['txt', 'md', 'ts', 'tsx', 'js', 'jsx', 'py', 'sh', 'json', 'css', 'html', 'csv'].includes(ext);
  }
  return false;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatRelative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

// ─── Starred storage helpers ─────────────────────────────────────────────────
const STARRED_KEY = 'library.starred';

function loadStarred(): Set<string> {
  try {
    const raw = localStorage.getItem(STARRED_KEY);
    return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function saveStarred(set: Set<string>) {
  localStorage.setItem(STARRED_KEY, JSON.stringify([...set]));
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface LibraryFilesTabProps {
  initialPath?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LibraryFilesTab({ initialPath }: LibraryFilesTabProps = {}) {
  const [files, setFiles] = useState<LibraryFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState(initialPath || '');
  const [searchMode, setSearchMode] = useState<SearchMode>('filter');
  const [askResponse, setAskResponse] = useState<string | null>(null);
  const [askLoading, setAskLoading] = useState(false);

  // Category / view
  const [selectedCategory, setSelectedCategory] = useState<FileCategory | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  // Folder sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('all'); // 'all' | 'recent' | 'starred' | folderId

  // File detail panel
  const [detailFile, setDetailFile] = useState<LibraryFileItem | null>(null);
  const [detailContent, setDetailContent] = useState<string | null>(null);
  const [detailContentLoading, setDetailContentLoading] = useState(false);
  const [miniChatMessages, setMiniChatMessages] = useState<MiniChatMessage[]>([]);
  const [miniChatInput, setMiniChatInput] = useState('');
  const [miniChatLoading, setMiniChatLoading] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const miniChatEndRef = useRef<HTMLDivElement>(null);

  // Drag & drop
  const [isDragOver, setIsDragOver] = useState(false);

  // Starred
  const [starred, setStarred] = useState<Set<string>>(loadStarred);

  // Available tags (from API) and active tag filter
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [activeTagFilters, setActiveTagFilters] = useState<Set<string>>(new Set());

  // New folder inline input
  const [newFolderInputVisible, setNewFolderInputVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderCreating, setNewFolderCreating] = useState(false);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  // Viewer modal (kept for video / audio / binary)
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerContent, setViewerContent] = useState<any>(null);
  const [viewerLoading, setViewerLoading] = useState(false);

  // Generate image modal
  const [genImageOpen, setGenImageOpen] = useState(false);
  const [genImagePrompt, setGenImagePrompt] = useState('');
  const [genImageLoading, setGenImageLoading] = useState(false);
  const [genImageResult, setGenImageResult] = useState<{ url: string; filename: string } | null>(null);
  const [genImageError, setGenImageError] = useState<string | null>(null);

  // Inline editing
  const [projectInputs, setProjectInputs] = useState<Record<string, string>>({});

  const { open, config, onConfirm, showConfirm, closeConfirm } = useConfirmDialog();
  const { open: promptOpen, config: promptConfig, onSubmit: promptOnSubmit, showPrompt, closePrompt } = usePromptDialog();

  // ─── Data loading ──────────────────────────────────────────────────────────
  const loadFiles = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const libraryResult = await libraryApi.getFiles();
      const libraryFiles: LibraryFileItem[] = Array.isArray(libraryResult?.files)
        ? (libraryResult.files as unknown as LibraryFileItem[])
        : [];
      setFiles(libraryFiles);
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

  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch('/api/library/folders');
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
      }
    } catch {
      // silent
    }
  }, []);

  const loadTags = useCallback(async () => {
    try {
      const res = await fetch('/api/library/tags');
      if (res.ok) {
        const data = await res.json();
        setAvailableTags(data.tags || []);
      }
    } catch {
      // silent
    }
  }, []);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setNewFolderCreating(true);
    try {
      const res = await fetch('/api/library/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        showToast('success', `Folder "${name}" created`);
        setNewFolderName('');
        setNewFolderInputVisible(false);
        loadFolders();
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string };
        showToast('error', data.error || 'Failed to create folder');
      }
    } catch {
      showToast('error', 'Failed to create folder');
    } finally {
      setNewFolderCreating(false);
    }
  };

  const toggleTagFilter = (tag: string) => {
    setActiveTagFilters(prev => {
      const next = new Set<string>(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  useEffect(() => {
    loadFiles();
    loadFolders();
    loadTags();
  }, [loadFiles, loadFolders, loadTags]);

  useEffect(() => {
    if (newFolderInputVisible) {
      newFolderInputRef.current?.focus();
    }
  }, [newFolderInputVisible]);

  useEffect(() => {
    if (initialPath) setSearchQuery(initialPath);
  }, [initialPath]);

  useEffect(() => {
    if (miniChatEndRef.current) {
      miniChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [miniChatMessages]);

  // ─── Starred helpers ────────────────────────────────────────────────────────
  const toggleStar = (id: string) => {
    setStarred(prev => {
      const next = new Set<string>(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveStarred(next);
      return next;
    });
  };

  // ─── File detail panel ──────────────────────────────────────────────────────
  const openDetail = async (file: LibraryFileItem) => {
    setDetailFile(file);
    setDetailContent(null);
    setMiniChatMessages([]);
    setTagInput('');

    // Load preview for text / image files
    if (isTextFile(file.mimeType, file.name)) {
      setDetailContentLoading(true);
      try {
        const res = await fetch(`/api/library?action=view&id=${encodeURIComponent(file.id)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && !data.isBinary && typeof data.content === 'string') {
            setDetailContent(data.content.slice(0, 2000));
          }
        }
      } catch {
        // silent
      } finally {
        setDetailContentLoading(false);
      }
    } else if (file.mimeType?.startsWith('image/')) {
      setDetailContent(`/api/library?action=raw&id=${encodeURIComponent(file.id)}`);
    }
  };

  const closeDetail = () => {
    setDetailFile(null);
    setDetailContent(null);
    setMiniChatMessages([]);
  };

  // ─── Mini chat in detail panel ──────────────────────────────────────────────
  const sendMiniChat = async () => {
    if (!miniChatInput.trim() || !detailFile) return;
    const userMsg = miniChatInput.trim();
    setMiniChatInput('');
    setMiniChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setMiniChatLoading(true);

    try {
      const contextMsg = `File: ${detailFile.name} (${detailFile.category}, ${formatSize(detailFile.size)})\nTags: ${(detailFile.tags || []).join(', ')}\nLinked tasks: ${(detailFile.linkedTasks || []).join(', ')}\n\nUser question: ${userMsg}`;
      const res = await fetch(`/api/chat/sessions/library-assistant/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: contextMsg, timestamp: Date.now() }),
      });
      if (res.ok) {
        const data = await res.json();
        const reply = data.reply || data.content || data.message || 'No response from assistant.';
        setMiniChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      } else {
        setMiniChatMessages(prev => [...prev, { role: 'assistant', content: 'Could not reach the assistant. Check if the library-assistant agent is running.' }]);
      }
    } catch {
      setMiniChatMessages(prev => [...prev, { role: 'assistant', content: 'Failed to send message.' }]);
    } finally {
      setMiniChatLoading(false);
    }
  };

  // ─── Ask Agent (global search) ──────────────────────────────────────────────
  const handleAskAgent = async () => {
    if (!searchQuery.trim()) return;
    setAskLoading(true);
    setAskResponse(null);

    const fileContext = files.slice(0, 50).map(f => `- ${f.name} [${f.category}] ${f.tags?.join(', ')}`).join('\n');
    const contextMsg = `Library files:\n${fileContext}\n\nQuery: ${searchQuery}`;

    try {
      const res = await fetch(`/api/chat/sessions/library-assistant/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: contextMsg, timestamp: Date.now() }),
      });
      if (res.ok) {
        const data = await res.json();
        setAskResponse(data.reply || data.content || data.message || 'No response.');
      } else {
        setAskResponse('Could not reach the library assistant. Make sure the agent is running.');
      }
    } catch {
      setAskResponse('Failed to query the agent.');
    } finally {
      setAskLoading(false);
    }
  };

  // ─── Viewer modal (for non-text/image) ─────────────────────────────────────
  const openViewer = async (file: LibraryFileItem) => {
    setDetailFile(file);
    setViewerOpen(true);
    setViewerLoading(true);
    try {
      const result = await fetch(`/api/library?action=view&id=${encodeURIComponent(file.id)}`).then(r => r.ok ? r.json() : { success: false, error: 'Failed to load file' });
      if (result?.success) {
        const mime = result.mimeType || file.mimeType || '';
        const viewType = result.isBinary
          ? (mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'binary')
          : (mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio'
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

  const handleFileClick = (file: LibraryFileItem) => {
    const mime = file.mimeType || '';
    const nameLc = file.name.toLowerCase();
    // Open inline detail for text, images, code, audio, video, and PDF
    if (
      isTextFile(mime, file.name) ||
      mime.startsWith('image/') ||
      mime.startsWith('audio/') ||
      mime.startsWith('video/') ||
      mime === 'application/pdf' ||
      nameLc.endsWith('.pdf')
    ) {
      openDetail(file);
    } else {
      // Open viewer modal for other binary types
      openViewer(file);
    }
  };

  // ─── Mutations ──────────────────────────────────────────────────────────────
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
          if (detailFile?.id === file.id) closeDetail();
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

  const handleCategoryChange = async (file: LibraryFileItem, newCategory: string) => {
    try {
      await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: file.id, category: newCategory }),
      });
      loadFiles();
    } catch {
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
      if (detailFile?.id === file.id) {
        setDetailFile(prev => prev ? { ...prev, tags: updatedTags } : prev);
      }
    } catch {
      showToast('error', 'Failed to remove tag');
    }
  };

  const handleTagAdd = async (file: LibraryFileItem, tagValue: string) => {
    const trimmed = tagValue.trim();
    if (!trimmed) return;
    const existing = file.tags || [];
    if (existing.includes(trimmed)) return;
    const updatedTags = [...existing, trimmed];
    setTagInput('');
    try {
      await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: file.id, tags: updatedTags }),
      });
      loadFiles();
      if (detailFile?.id === file.id) {
        setDetailFile(prev => prev ? { ...prev, tags: updatedTags } : prev);
      }
    } catch {
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
    } catch {
      showToast('error', 'Failed to update project');
    }
  };

  const handleCopyPath = (file: LibraryFileItem) => {
    navigator.clipboard.writeText(file.path).then(() => {
      showToast('success', 'Path copied');
    }).catch(() => {
      showToast('error', 'Copy failed');
    });
  };

  const handleGenerateImage = async () => {
    const prompt = genImagePrompt.trim();
    if (!prompt) return;
    setGenImageLoading(true);
    setGenImageResult(null);
    setGenImageError(null);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setGenImageError(data.error || 'Image generation failed');
      } else {
        setGenImageResult({ url: data.url, filename: data.filename });
      }
    } catch (err) {
      setGenImageError(String(err));
    } finally {
      setGenImageLoading(false);
    }
  };

  const handleSaveGeneratedImage = () => {
    showToast('success', 'Image saved to library');
    setGenImageOpen(false);
    setGenImagePrompt('');
    setGenImageResult(null);
    loadFiles();
  };

  // ─── Drag & drop ────────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    showToast('info', 'File upload not available in web mode');
  };

  // ─── Filtering ──────────────────────────────────────────────────────────────
  const categoryCounts: Record<string, number> = { all: files.length };
  for (const key of Object.keys(categoryConfig)) {
    categoryCounts[key] = files.filter(f => f.category === key).length;
  }

  const recentFiles = [...files]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const applyFolderFilter = (fileList: LibraryFileItem[]): LibraryFileItem[] => {
    if (selectedFolder === 'all') return fileList;
    if (selectedFolder === 'recent') {
      return [...fileList].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 20);
    }
    if (selectedFolder === 'starred') {
      return fileList.filter(f => starred.has(f.id));
    }
    // Real folder: match by folder_id field (DB-tracked files) or project name (legacy)
    const folder = folders.find(f => f.id === selectedFolder);
    if (folder) {
      return fileList.filter(f =>
        (f as unknown as Record<string, unknown>).folder_id === folder.id || f.project === folder.name
      );
    }
    return fileList;
  };

  const TEXT_EXTS = new Set(['.txt', '.md', '.markdown', '.rst', '.log']);
  const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.tiff']);
  const CODE_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.py', '.json', '.html', '.css', '.scss', '.sh', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.php', '.yaml', '.yml', '.toml', '.xml', '.sql']);
  const DATA_EXTS = new Set(['.csv', '.xlsx', '.xls', '.ods', '.parquet', '.ndjson', '.jsonl']);
  const getExt = (name: string) => { const d = name.lastIndexOf('.'); return d >= 0 ? name.slice(d).toLowerCase() : ''; };
  const getTypeFilter = (f: LibraryFileItem): TypeFilter => {
    const ext = getExt(f.name);
    if (IMAGE_EXTS.has(ext) || f.mimeType?.startsWith('image/')) return 'images';
    if (DATA_EXTS.has(ext)) return 'data';
    if (CODE_EXTS.has(ext)) return 'code';
    if (TEXT_EXTS.has(ext) || f.mimeType?.startsWith('text/')) return 'text';
    return 'all';
  };

  const categoryFiltered = selectedCategory === 'all' ? files : files.filter(f => f.category === selectedCategory);
  const typeFiltered = typeFilter === 'all' ? categoryFiltered : categoryFiltered.filter(f => getTypeFilter(f) === typeFilter);
  const folderFiltered = applyFolderFilter(typeFiltered);
  const searchFiltered = searchMode === 'filter'
    ? folderFiltered.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : folderFiltered;
  // Apply active tag pill filters
  const tagFiltered = activeTagFilters.size === 0
    ? searchFiltered
    : searchFiltered.filter(f =>
        [...activeTagFilters].every(tag =>
          (f.tags || []).map(t => t.toLowerCase()).includes(tag.toLowerCase())
        )
      );
  const filteredFiles = [...tagFiltered].sort((a, b) => {
    if (sortMode === 'oldest') return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    if (sortMode === 'name') return a.name.localeCompare(b.name);
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(); // newest
  });

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className={`h-full flex flex-col transition-all ${isDragOver ? 'ring-4 ring-mission-control-accent ring-inset bg-mission-control-accent/5' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="p-4 border-b border-mission-control-border bg-mission-control-surface flex-shrink-0">
        {/* Top row */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-mission-control-text-dim">
            {files.length} files
          </p>
          <div className="flex gap-2">
            <button
              onClick={loadFiles}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-mission-control-border text-mission-control-text-dim rounded-lg hover:bg-mission-control-border/80 transition-colors text-xs"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => { setGenImageOpen(true); setGenImageResult(null); setGenImageError(null); setGenImagePrompt(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs"
            >
              <Wand2 size={13} />
              Generate Image
            </button>
            <button
              onClick={handleUpload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors text-xs"
            >
              <Upload size={13} />
              Upload
            </button>
          </div>
        </div>

        {/* Search bar with mode toggle */}
        <div className="flex items-center gap-2 mb-3">
          {/* Mode pill toggle */}
          <div className="flex rounded-lg border border-mission-control-border overflow-hidden flex-shrink-0">
            <button
              onClick={() => { setSearchMode('filter'); setAskResponse(null); }}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${
                searchMode === 'filter'
                  ? 'bg-mission-control-accent text-white'
                  : 'bg-mission-control-surface text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              <Search size={12} />
              Filter
            </button>
            <button
              onClick={() => { setSearchMode('ask'); setAskResponse(null); }}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${
                searchMode === 'ask'
                  ? 'bg-mission-control-accent text-white'
                  : 'bg-mission-control-surface text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              <Bot size={12} />
              Ask Agent
            </button>
          </div>

          {/* Search input */}
          <div className="flex-1 relative">
            {searchMode === 'filter' ? (
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
            ) : (
              <Bot size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-accent" />
            )}
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && searchMode === 'ask') handleAskAgent(); }}
              placeholder={searchMode === 'filter' ? 'Search files...' : 'Ask about your files...'}
              className="w-full pl-9 pr-4 py-1.5 bg-mission-control-bg border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent text-sm"
            />
          </div>

          {searchMode === 'ask' && (
            <button
              onClick={handleAskAgent}
              disabled={askLoading || !searchQuery.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors text-xs disabled:opacity-50"
            >
              {askLoading ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
              Ask
            </button>
          )}

          {/* Sort */}
          <select
            value={sortMode}
            onChange={e => setSortMode(e.target.value as SortMode)}
            className="text-xs px-2 py-1.5 rounded-lg bg-mission-control-border border border-mission-control-border/60 text-mission-control-text-dim focus:outline-none focus:border-mission-control-accent flex-shrink-0"
            aria-label="Sort files"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
          </select>

          {/* View toggle */}
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-mission-control-accent text-white' : 'bg-mission-control-border text-mission-control-text-dim'}`}
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-mission-control-accent text-white' : 'bg-mission-control-border text-mission-control-text-dim'}`}
            >
              <Grid size={14} />
            </button>
          </div>
        </div>

        {/* Type filter tabs */}
        {searchMode === 'filter' && (
          <div className="flex items-center gap-1 mb-2 overflow-x-auto pb-0.5">
            {(['all', 'text', 'images', 'code', 'data'] as TypeFilter[]).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 transition-colors ${
                  typeFilter === t
                    ? 'bg-mission-control-accent text-white'
                    : 'bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
            {/* Starred quick-filter toggle */}
            <button
              onClick={() => setSelectedFolder(prev => prev === 'starred' ? 'all' : 'starred')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 transition-colors ml-auto ${
                selectedFolder === 'starred'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  : 'bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
              }`}
              title="Show starred files only"
            >
              <Star size={11} className={selectedFolder === 'starred' ? 'fill-yellow-400' : ''} />
              Starred
            </button>
          </div>
        )}

        {/* Tag filter pills */}
        {searchMode === 'filter' && availableTags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap pb-0.5">
            <Tag size={11} className="text-mission-control-text-dim flex-shrink-0" />
            {availableTags.slice(0, 20).map(tag => (
              <button
                key={tag}
                onClick={() => toggleTagFilter(tag)}
                className={`px-2 py-0.5 rounded-full text-xs flex-shrink-0 transition-colors ${
                  activeTagFilters.has(tag)
                    ? 'bg-mission-control-accent text-white'
                    : 'bg-mission-control-border/60 text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                {tag}
              </button>
            ))}
            {activeTagFilters.size > 0 && (
              <button
                onClick={() => setActiveTagFilters(new Set())}
                className="px-2 py-0.5 rounded-full text-xs flex-shrink-0 text-mission-control-text-dim hover:text-error transition-colors flex items-center gap-0.5"
                title="Clear tag filters"
              >
                <X size={10} />
                Clear
              </button>
            )}
          </div>
        )}

        {/* Ask response */}
        {askResponse && (
          <div className="mb-3 p-3 bg-mission-control-accent/5 border border-mission-control-accent/20 rounded-lg text-sm text-mission-control-text">
            <div className="flex items-start gap-2">
              <Bot size={14} className="text-mission-control-accent flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">{askResponse}</p>
              <button onClick={() => setAskResponse(null)} className="ml-auto flex-shrink-0 text-mission-control-text-dim hover:text-mission-control-text">
                <X size={14} />
              </button>
            </div>
          </div>
        )}
        {askLoading && (
          <div className="mb-3 p-3 bg-mission-control-accent/5 border border-mission-control-accent/20 rounded-lg text-sm text-mission-control-text-dim flex items-center gap-2">
            <RefreshCw size={14} className="animate-spin text-mission-control-accent" />
            Asking library agent...
          </div>
        )}

        {/* Category tabs */}
        <div className="flex gap-1.5 flex-wrap">
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
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                  selectedCategory === cat
                    ? 'bg-mission-control-accent text-white'
                    : 'bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                <Icon size={12} />
                {catConfig.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Body: sidebar + main + detail ───────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Folder Sidebar ──────────────────────────────────────────────── */}
        {sidebarOpen && (
          <div className="w-48 flex-shrink-0 border-r border-mission-control-border bg-mission-control-surface flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-mission-control-border">
              <span className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wide">Folders</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setNewFolderInputVisible(v => !v)}
                  className="p-0.5 hover:bg-mission-control-border rounded text-mission-control-text-dim"
                  title="New folder"
                >
                  <FolderPlus size={13} />
                </button>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-0.5 hover:bg-mission-control-border rounded text-mission-control-text-dim"
                  title="Collapse sidebar"
                >
                  <PanelLeftClose size={13} />
                </button>
              </div>
            </div>
            {/* New folder inline input */}
            {newFolderInputVisible && (
              <div className="px-2 py-1.5 border-b border-mission-control-border flex items-center gap-1">
                <input
                  ref={newFolderInputRef}
                  type="text"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateFolder();
                    if (e.key === 'Escape') { setNewFolderInputVisible(false); setNewFolderName(''); }
                  }}
                  placeholder="Folder name..."
                  className="flex-1 px-2 py-1 bg-mission-control-bg border border-mission-control-border rounded text-xs focus:outline-none focus:border-mission-control-accent min-w-0"
                />
                <button
                  onClick={handleCreateFolder}
                  disabled={newFolderCreating || !newFolderName.trim()}
                  className="p-1 bg-mission-control-accent text-white rounded disabled:opacity-50 flex-shrink-0"
                  title="Create folder"
                >
                  {newFolderCreating ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
                </button>
                <button
                  onClick={() => { setNewFolderInputVisible(false); setNewFolderName(''); }}
                  className="p-1 hover:bg-mission-control-border rounded text-mission-control-text-dim flex-shrink-0"
                  title="Cancel"
                >
                  <X size={11} />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {/* Virtual: All Files */}
              <SidebarItem
                label="All Files"
                icon={FolderOpen}
                count={files.length}
                selected={selectedFolder === 'all'}
                onClick={() => setSelectedFolder('all')}
              />
              {/* Virtual: Recent */}
              <SidebarItem
                label="Recent"
                icon={Clock}
                count={recentFiles.length}
                selected={selectedFolder === 'recent'}
                onClick={() => setSelectedFolder('recent')}
              />
              {/* Virtual: Starred */}
              <SidebarItem
                label="Starred"
                icon={Star}
                count={files.filter(f => starred.has(f.id)).length}
                selected={selectedFolder === 'starred'}
                onClick={() => setSelectedFolder('starred')}
              />

              {/* Real folders */}
              {folders.length > 0 && (
                <div className="pt-2 mt-2 border-t border-mission-control-border">
                  {folders.map(folder => {
                    const count = files.filter(f =>
                      (f as unknown as Record<string, unknown>).folder_id === folder.id || f.project === folder.name
                    ).length;
                    return (
                      <SidebarItem
                        key={folder.id}
                        label={folder.name}
                        icon={FolderOpen}
                        count={count}
                        selected={selectedFolder === folder.id}
                        onClick={() => setSelectedFolder(folder.id)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Collapsed sidebar toggle */}
        {!sidebarOpen && (
          <div className="flex-shrink-0 border-r border-mission-control-border bg-mission-control-surface flex flex-col items-center py-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 hover:bg-mission-control-border rounded text-mission-control-text-dim"
              title="Expand sidebar"
            >
              <PanelLeftOpen size={14} />
            </button>
          </div>
        )}

        {/* ── Main File Area ───────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Recent files strip */}
          {selectedFolder === 'all' && recentFiles.length > 0 && (
            <div className="px-4 pt-3 pb-2 border-b border-mission-control-border bg-mission-control-bg flex-shrink-0">
              <p className="text-xs font-medium text-mission-control-text-dim mb-2 flex items-center gap-1">
                <Clock size={11} />
                Recent
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {recentFiles.map(file => {
                  const FileIcon = getFileIcon(file.mimeType);
                  const catConf = categoryConfig[file.category] || categoryConfig.other;
                  return (
                    <button
                      key={file.id}
                      onClick={() => handleFileClick(file)}
                      className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-left ${
                        detailFile?.id === file.id
                          ? 'border-mission-control-accent bg-mission-control-accent/5'
                          : 'border-mission-control-border bg-mission-control-surface hover:border-mission-control-accent/30'
                      }`}
                      style={{ minWidth: 140, maxWidth: 180 }}
                    >
                      <div className={`p-1.5 rounded ${catConf.color} flex-shrink-0`}>
                        <FileIcon size={12} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate max-w-[110px]">{file.name}</div>
                        <div className="text-xs text-mission-control-text-dim">{formatRelative(file.updatedAt)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* File list / grid */}
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
                {/* Header */}
                <div className="grid gap-0 border-b border-mission-control-border bg-mission-control-bg px-3 py-1.5" style={{ gridTemplateColumns: '1rem 1fr 6rem 5rem 5rem 4rem' }}>
                  <span />
                  <span className="text-xs text-mission-control-text-dim font-medium">Name</span>
                  <span className="text-xs text-mission-control-text-dim font-medium">Category</span>
                  <span className="text-xs text-mission-control-text-dim font-medium text-right">Size</span>
                  <span className="text-xs text-mission-control-text-dim font-medium text-right">Modified</span>
                  <span />
                </div>
                {filteredFiles.map((file, idx) => {
                  const FileIcon = getFileIcon(file.mimeType);
                  const isLast = idx === filteredFiles.length - 1;
                  const isSelected = detailFile?.id === file.id;
                  const isStarred = starred.has(file.id);

                  return (
                    <div
                      key={file.id}
                      className={`group grid items-center gap-0 px-3 py-1.5 hover:bg-mission-control-surface/60 transition-colors cursor-pointer ${
                        !isLast ? 'border-b border-mission-control-border/50' : ''
                      } ${isSelected ? 'bg-mission-control-accent/5' : ''}`}
                      style={{ gridTemplateColumns: '1rem 1fr 6rem 5rem 5rem 4rem' }}
                      onClick={() => handleFileClick(file)}
                    >
                      <FileIcon size={12} className="text-mission-control-text-dim flex-shrink-0" />
                      <span className="text-xs font-medium truncate px-2 text-left hover:text-mission-control-accent transition-colors">
                        {file.name}
                      </span>
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
                      <span className="text-xs text-mission-control-text-dim text-right tabular-nums">{formatSize(file.size)}</span>
                      <span className="text-xs text-mission-control-text-dim text-right tabular-nums">
                        {file.updatedAt ? new Date(file.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                      </span>
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleStar(file.id)}
                          className="p-1 hover:bg-mission-control-border rounded transition-colors"
                          title={isStarred ? 'Unstar' : 'Star'}
                        >
                          <Star size={11} className={isStarred ? 'text-yellow-400 fill-yellow-400' : 'text-mission-control-text-dim'} />
                        </button>
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
                  const isStarred = starred.has(file.id);

                  return (
                    <div
                      key={file.id}
                      onClick={() => handleFileClick(file)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFileClick(file); } }}
                      role="button"
                      tabIndex={0}
                      className={`p-3 bg-mission-control-surface border border-mission-control-border rounded-lg hover:border-mission-control-accent/40 cursor-pointer transition-colors group relative ${
                        detailFile?.id === file.id ? 'border-mission-control-accent' : ''
                      }`}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleStar(file.id); }}
                        className={`absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${isStarred ? 'opacity-100' : ''}`}
                        title={isStarred ? 'Unstar' : 'Star'}
                      >
                        <Star size={12} className={isStarred ? 'text-yellow-400 fill-yellow-400' : 'text-mission-control-text-dim'} />
                      </button>
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
        </div>

        {/* ── File Detail Panel ─────────────────────────────────────────────── */}
        {detailFile && !viewerOpen && (
          <div className="w-80 flex-shrink-0 border-l border-mission-control-border bg-mission-control-surface flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {(() => {
                  const FileIcon = getFileIcon(detailFile.mimeType);
                  return <FileIcon size={14} className="text-mission-control-accent flex-shrink-0" />;
                })()}
                <span className="text-sm font-medium truncate">{detailFile.name}</span>
              </div>
              <button onClick={closeDetail} className="p-1 hover:bg-mission-control-border rounded flex-shrink-0">
                <X size={14} className="text-mission-control-text-dim" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Metadata */}
              <div className="px-4 py-3 border-b border-mission-control-border space-y-2">
                <MetaRow label="Size" value={formatSize(detailFile.size)} />
                <MetaRow label="Type" value={detailFile.mimeType || 'Unknown'} />
                <MetaRow label="Modified" value={new Date(detailFile.updatedAt).toLocaleString()} />
                <MetaRow label="Created" value={new Date(detailFile.createdAt).toLocaleString()} />
                {detailFile.createdBy && <MetaRow label="Created by" value={detailFile.createdBy} />}
                {detailFile.linkedTasks && detailFile.linkedTasks.length > 0 && (
                  <div>
                    <span className="text-xs text-mission-control-text-dim">Linked tasks</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {detailFile.linkedTasks.map(t => (
                        <span key={t} className="px-1.5 py-0.5 bg-mission-control-border rounded text-xs font-mono">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="px-4 py-3 border-b border-mission-control-border">
                <div className="flex items-center gap-1 mb-2">
                  <Tag size={11} className="text-mission-control-text-dim" />
                  <span className="text-xs font-medium text-mission-control-text-dim">Tags</span>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(detailFile.tags || []).map(tag => (
                    <span
                      key={tag}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 bg-mission-control-border rounded text-xs"
                    >
                      {tag}
                      <button
                        onClick={() => handleTagRemove(detailFile, tag)}
                        className="ml-0.5 hover:text-error"
                      >
                        <X size={9} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { handleTagAdd(detailFile, tagInput); } }}
                    placeholder="Add tag..."
                    className="flex-1 px-2 py-1 bg-mission-control-bg border border-mission-control-border rounded text-xs focus:outline-none focus:border-mission-control-accent"
                  />
                  <button
                    onClick={() => handleTagAdd(detailFile, tagInput)}
                    className="px-2 py-1 bg-mission-control-border rounded text-xs hover:bg-mission-control-border/80"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Preview */}
              <div className="px-4 py-3 border-b border-mission-control-border">
                <div className="flex items-center gap-1 mb-2">
                  <Info size={11} className="text-mission-control-text-dim" />
                  <span className="text-xs font-medium text-mission-control-text-dim">Preview</span>
                </div>
                {detailContentLoading ? (
                  <div className="flex items-center gap-2 text-xs text-mission-control-text-dim py-2">
                    <RefreshCw size={12} className="animate-spin" />
                    Loading preview...
                  </div>
                ) : detailFile.mimeType?.startsWith('image/') && detailContent ? (
                  <img
                    src={detailContent}
                    alt={detailFile.name}
                    className="w-full rounded-lg max-h-48 object-contain bg-mission-control-bg"
                  />
                ) : (detailFile.mimeType === 'application/pdf' || detailFile.name.toLowerCase().endsWith('.pdf')) ? (
                  <iframe
                    src={`/api/library?action=raw&id=${encodeURIComponent(detailFile.id)}`}
                    className="w-full rounded-lg bg-white"
                    style={{ height: 200 }}
                    title={detailFile.name}
                  />
                ) : detailFile.mimeType?.startsWith('audio/') ? (
                  <audio
                    controls
                    className="w-full"
                    src={`/api/library?action=raw&id=${encodeURIComponent(detailFile.id)}`}
                  />
                ) : detailFile.mimeType?.startsWith('video/') ? (
                  <video
                    controls
                    className="w-full rounded-lg"
                    style={{ maxHeight: 160 }}
                    src={`/api/library?action=raw&id=${encodeURIComponent(detailFile.id)}`}
                  />
                ) : detailContent ? (
                  <pre className="text-xs font-mono bg-mission-control-bg p-2 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap leading-relaxed">
                    {detailContent}
                  </pre>
                ) : (
                  <p className="text-xs text-mission-control-text-dim">No preview available for this file type.</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="px-4 py-3 border-b border-mission-control-border space-y-1.5">
                <a
                  href={`/api/library?action=raw&id=${encodeURIComponent(detailFile.id)}`}
                  download={detailFile.name}
                  className="flex items-center gap-2 px-3 py-1.5 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors text-xs w-full justify-center"
                >
                  <Download size={13} />
                  Download
                </a>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => toggleStar(detailFile.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-xs flex-1 justify-center border ${
                      starred.has(detailFile.id)
                        ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                        : 'bg-mission-control-border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                    }`}
                  >
                    <Star size={12} className={starred.has(detailFile.id) ? 'fill-yellow-400' : ''} />
                    {starred.has(detailFile.id) ? 'Starred' : 'Star'}
                  </button>
                  <button
                    onClick={() => handleCopyPath(detailFile)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-mission-control-border text-mission-control-text-dim rounded-lg hover:text-mission-control-text transition-colors text-xs flex-1 justify-center"
                  >
                    <Copy size={12} />
                    Copy path
                  </button>
                </div>
              </div>

              {/* Activity */}
              <div className="px-4 py-3 border-b border-mission-control-border">
                <div className="flex items-center gap-1 mb-2">
                  <Clock size={11} className="text-mission-control-text-dim" />
                  <span className="text-xs font-medium text-mission-control-text-dim">Activity</span>
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs text-mission-control-text-dim">
                    Created {formatRelative(detailFile.createdAt)}
                  </div>
                  {detailFile.updatedAt !== detailFile.createdAt && (
                    <div className="text-xs text-mission-control-text-dim">
                      Modified {formatRelative(detailFile.updatedAt)}
                    </div>
                  )}
                  {detailFile.linkedTasks && detailFile.linkedTasks.length > 0 && (
                    <div className="text-xs text-mission-control-text-dim">
                      Linked to {detailFile.linkedTasks.length} task{detailFile.linkedTasks.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* Mini chat */}
              <div className="px-4 py-3 flex flex-col">
                <div className="flex items-center gap-1 mb-2">
                  <Bot size={11} className="text-mission-control-accent" />
                  <span className="text-xs font-medium text-mission-control-text-dim">Ask about this file</span>
                </div>
                {miniChatMessages.length > 0 && (
                  <div className="space-y-2 mb-2 max-h-48 overflow-y-auto">
                    {miniChatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`text-xs p-2 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-mission-control-accent/10 text-mission-control-text ml-4'
                            : 'bg-mission-control-bg text-mission-control-text mr-4'
                        }`}
                      >
                        {msg.content}
                      </div>
                    ))}
                    {miniChatLoading && (
                      <div className="text-xs p-2 rounded-lg bg-mission-control-bg text-mission-control-text-dim mr-4 flex items-center gap-1">
                        <RefreshCw size={10} className="animate-spin" />
                        Thinking...
                      </div>
                    )}
                    <div ref={miniChatEndRef} />
                  </div>
                )}
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={miniChatInput}
                    onChange={e => setMiniChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') sendMiniChat(); }}
                    placeholder="Ask a question..."
                    className="flex-1 px-2 py-1.5 bg-mission-control-bg border border-mission-control-border rounded-lg text-xs focus:outline-none focus:border-mission-control-accent"
                  />
                  <button
                    onClick={sendMiniChat}
                    disabled={miniChatLoading || !miniChatInput.trim()}
                    className="p-1.5 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 disabled:opacity-50 transition-colors"
                  >
                    <Send size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Viewer Modal (video, audio, binary) ─────────────────────────────── */}
      {viewerOpen && detailFile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-mission-control-surface rounded-2xl border border-mission-control-border shadow-glow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-mission-control-border">
              <div className="flex-1 min-w-0 mr-4">
                <h3 className="font-bold text-lg truncate">{detailFile.name}</h3>
                <p className="text-sm text-mission-control-text-dim mt-1">
                  {formatSize(detailFile.size)} • {detailFile.mimeType || 'Unknown type'}
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  href={`/api/library?action=raw&id=${encodeURIComponent(detailFile.id)}`}
                  download={detailFile.name}
                  className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors"
                >
                  <Download size={16} />
                  Download
                </a>
                <button
                  onClick={() => { setViewerOpen(false); setDetailFile(null); }}
                  className="p-2 hover:bg-mission-control-border rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
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
                  <img src={viewerContent.content} alt={detailFile.name} className="max-w-full max-h-[60vh] object-contain rounded-lg" />
                </div>
              ) : viewerContent?.viewType === 'video' ? (
                <div className="flex items-center justify-center">
                  <video controls className="max-w-full max-h-[60vh] rounded-lg">
                    <source src={viewerContent.content} />
                  </video>
                </div>
              ) : viewerContent?.viewType === 'audio' ? (
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <audio controls className="w-full max-w-lg">
                    <source src={viewerContent.content} />
                  </audio>
                </div>
              ) : (
                <div className="text-center py-12">
                  <File size={64} className="text-mission-control-text-dim mx-auto mb-4" />
                  <p className="text-mission-control-text-dim mb-6">This file type cannot be previewed.</p>
                  <a
                    href={`/api/library?action=raw&id=${encodeURIComponent(detailFile.id)}`}
                    download={detailFile.name}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent/90 transition-colors"
                  >
                    <Download size={20} />
                    Download File
                  </a>
                </div>
              )}
            </div>
            {detailFile.linkedTasks && detailFile.linkedTasks.length > 0 && (
              <div className="p-4 border-t border-mission-control-border bg-mission-control-bg/50">
                <p className="text-sm text-mission-control-text-dim mb-2">Linked to tasks:</p>
                <div className="flex flex-wrap gap-2">
                  {detailFile.linkedTasks.map(taskId => (
                    <span key={taskId} className="px-2 py-1 bg-mission-control-border rounded text-xs font-mono">{taskId}</span>
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

// ─── Sub-components ─────────────────────────────────────────────────────────

interface SidebarItemProps {
  label: string;
  icon: any;
  count: number;
  selected: boolean;
  onClick: () => void;
}

function SidebarItem({ label, icon: Icon, count, selected, onClick }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
        selected
          ? 'bg-mission-control-accent/10 text-mission-control-accent'
          : 'text-mission-control-text-dim hover:bg-mission-control-border hover:text-mission-control-text'
      }`}
    >
      <span className="flex items-center gap-2 min-w-0">
        <Icon size={13} className="flex-shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <span className={`text-xs flex-shrink-0 ml-1 ${selected ? 'text-mission-control-accent' : 'text-mission-control-text-dim'}`}>
        {count}
      </span>
    </button>
  );
}

interface MetaRowProps {
  label: string;
  value: string;
}

function MetaRow({ label, value }: MetaRowProps) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs text-mission-control-text-dim flex-shrink-0">{label}</span>
      <span className="text-xs text-mission-control-text text-right break-all">{value}</span>
    </div>
  );
}
