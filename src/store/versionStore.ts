import { create } from 'zustand';

// ── Types ──

export interface VersionMeta {
  id: string;
  chapterId: string;
  label: string;
  createdAt: string;
  filename: string;
  wordCount: number;
}

export interface DiffChange {
  value: string;
  added?: boolean;
  removed?: boolean;
}

interface VersionState {
  versions: VersionMeta[];
  loading: boolean;
  activeDiff: { changes: DiffChange[]; versionLabel: string } | null;
  diffLoading: boolean;

  loadVersions: (projectId: string, chapterId: string) => Promise<void>;
  saveVersion: (projectId: string, chapterId: string, label?: string) => Promise<boolean>;
  deleteVersion: (projectId: string, chapterId: string, versionId: string) => Promise<void>;
  restoreVersion: (projectId: string, chapterId: string, versionId: string) => Promise<boolean>;
  loadDiff: (projectId: string, chapterId: string, versionId: string) => Promise<void>;
  clearDiff: () => void;
  reset: () => void;
}

// ── localStorage helpers ──

function versionsKey(projectId: string, chapterId: string): string {
  return `version:${projectId}:${chapterId}:meta`;
}

function versionContentKey(projectId: string, chapterId: string, versionId: string): string {
  return `version:${projectId}:${chapterId}:content:${versionId}`;
}

function currentContentKey(projectId: string, chapterId: string): string {
  return `writing:${projectId}:content:${chapterId}`;
}

function loadVersionsMeta(projectId: string, chapterId: string): VersionMeta[] {
  try {
    const raw = localStorage.getItem(versionsKey(projectId, chapterId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveVersionsMeta(projectId: string, chapterId: string, versions: VersionMeta[]): void {
  localStorage.setItem(versionsKey(projectId, chapterId), JSON.stringify(versions));
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// Simple diff: split by lines and compare
function computeDiff(oldText: string, newText: string): DiffChange[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const changes: DiffChange[] = [];

  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    if (oldLine === newLine) {
      if (oldLine !== undefined) changes.push({ value: oldLine + '\n' });
    } else {
      if (oldLine !== undefined) changes.push({ value: oldLine + '\n', removed: true });
      if (newLine !== undefined) changes.push({ value: newLine + '\n', added: true });
    }
  }
  return changes;
}

export const useVersionStore = create<VersionState>((set) => ({
  versions: [],
  loading: false,
  activeDiff: null,
  diffLoading: false,

  loadVersions: async (projectId, chapterId) => {
    set({ loading: true });
    try {
      set({ versions: loadVersionsMeta(projectId, chapterId) });
    } finally {
      set({ loading: false });
    }
  },

  saveVersion: async (projectId, chapterId, label?) => {
    const content = localStorage.getItem(currentContentKey(projectId, chapterId)) ?? '';
    const id = generateId();
    const version: VersionMeta = {
      id,
      chapterId,
      label: label || `v${Date.now()}`,
      createdAt: new Date().toISOString(),
      filename: `${chapterId}-${id}`,
      wordCount: countWords(content),
    };
    // Save version content
    localStorage.setItem(versionContentKey(projectId, chapterId, id), content);
    // Update meta list
    const versions = [...loadVersionsMeta(projectId, chapterId), version];
    saveVersionsMeta(projectId, chapterId, versions);
    set({ versions });
    return true;
  },

  deleteVersion: async (projectId, chapterId, versionId) => {
    localStorage.removeItem(versionContentKey(projectId, chapterId, versionId));
    const versions = loadVersionsMeta(projectId, chapterId).filter((v) => v.id !== versionId);
    saveVersionsMeta(projectId, chapterId, versions);
    set({ versions });
  },

  restoreVersion: async (projectId, chapterId, versionId) => {
    const content = localStorage.getItem(versionContentKey(projectId, chapterId, versionId));
    if (content !== null) {
      localStorage.setItem(currentContentKey(projectId, chapterId), content);
      return true;
    }
    return false;
  },

  loadDiff: async (projectId, chapterId, versionId) => {
    set({ diffLoading: true });
    try {
      const versionContent = localStorage.getItem(versionContentKey(projectId, chapterId, versionId)) ?? '';
      const currentContent = localStorage.getItem(currentContentKey(projectId, chapterId)) ?? '';
      const versions = loadVersionsMeta(projectId, chapterId);
      const version = versions.find((v) => v.id === versionId);
      set({
        activeDiff: {
          changes: computeDiff(versionContent, currentContent),
          versionLabel: version?.label || '',
        },
      });
    } finally {
      set({ diffLoading: false });
    }
  },

  clearDiff: () => set({ activeDiff: null }),

  reset: () => set({
    versions: [],
    loading: false,
    activeDiff: null,
    diffLoading: false,
  }),
}));
