// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect } from 'react';
import {
  FolderOpen,
  ArrowRight,
  Code2,
  Palette,
  FileText,
  Megaphone,
  FolderKanban,
  File,
} from 'lucide-react';
import { formatTimeAgo } from '../../utils/formatting';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FileItem {
  id: string;
  name: string;
  path: string;
  category: 'code' | 'design' | 'docs' | 'campaigns' | 'projects' | 'other';
  size: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  linkedTasks: string[];
  tags: string[];
  project: string | null;
}

interface DashRecentFilesProps {
  onNavigate?: (view: string) => void;
}

// ── Category maps ─────────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<string, React.ElementType> = {
  code:      Code2,
  design:    Palette,
  docs:      FileText,
  campaigns: Megaphone,
  projects:  FolderKanban,
  other:     File,
};

const CATEGORY_COLOR: Record<string, string> = {
  code:      'text-info-DEFAULT',
  design:    'text-warning-DEFAULT',
  docs:      'text-mission-control-text-dim',
  campaigns: 'text-mission-control-accent',
  projects:  'text-success-DEFAULT',
  other:     'text-mission-control-text-dim',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2">
          <div className="w-3.5 h-3.5 rounded bg-mission-control-border animate-pulse flex-shrink-0" />
          <div className="flex-1 h-3 rounded bg-mission-control-border animate-pulse" />
          <div className="w-12 h-3 rounded bg-mission-control-border animate-pulse" />
        </div>
      ))}
    </>
  );
}

function EmptyState() {
  return (
    <div className="px-4 py-3 flex items-center gap-2 text-mission-control-text-dim">
      <FolderOpen size={14} className="opacity-40" />
      <span className="text-xs">No files yet</span>
    </div>
  );
}

interface FileRowProps {
  file: FileItem;
  onNavigate?: (view: string) => void;
}

function FileRow({ file, onNavigate }: FileRowProps) {
  const Icon = CATEGORY_ICON[file.category] ?? File;
  const iconColor = CATEGORY_COLOR[file.category] ?? 'text-mission-control-text-dim';
  const timeAgo = formatTimeAgo(new Date(file.updatedAt).getTime());

  return (
    <button
      key={file.id}
      type="button"
      onClick={() => onNavigate?.('library')}
      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-mission-control-bg transition-colors text-left"
    >
      <Icon size={14} className={`${iconColor} flex-shrink-0`} />
      <span className="flex-1 min-w-0 text-xs text-mission-control-text truncate">{file.name}</span>
      <span className="text-[10px] text-mission-control-text-dim hidden sm:block shrink-0">{file.category}</span>
      {file.linkedTasks.length > 0 && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-info-DEFAULT shrink-0"
          title={`${file.linkedTasks.length} task`}
        />
      )}
      <span className="text-[10px] text-mission-control-text-dim tabular-nums shrink-0">
        {timeAgo}
      </span>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5 * 60 * 1000;

export default function DashRecentFiles({ onNavigate }: DashRecentFilesProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function fetchFiles() {
    try {
      const res = await fetch('/api/library/files');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { files: FileItem[] };
      setFiles(data.files.slice(0, 6));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFiles();
    const timer = setInterval(fetchFiles, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  if (error) return null;

  return (
    <div className="bg-mission-control-surface rounded-xl border border-mission-control-border overflow-hidden">

      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border">
        <h2 className="text-sm font-bold text-mission-control-text flex items-center gap-2">
          <FolderOpen size={16} className="text-mission-control-accent" />
          Recent Files
        </h2>
        <button
          type="button"
          onClick={() => onNavigate?.('library')}
          className="text-xs text-mission-control-text-dim hover:text-mission-control-accent transition-colors flex items-center gap-1"
        >
          View all <ArrowRight size={12} />
        </button>
      </div>

      {/* File list */}
      <div className="divide-y divide-mission-control-border">
        {loading ? (
          <SkeletonRows />
        ) : files.length === 0 ? (
          <EmptyState />
        ) : (
          files.map((file) => (
            <FileRow key={file.id} file={file} onNavigate={onNavigate} />
          ))
        )}
      </div>

    </div>
  );
}
