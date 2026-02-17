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

const bridge = () => (window as any).clawdbot?.writing?.version;

export const useVersionStore = create<VersionState>((set, get) => ({
  versions: [],
  loading: false,
  activeDiff: null,
  diffLoading: false,

  loadVersions: async (projectId, chapterId) => {
    set({ loading: true });
    try {
      const result = await bridge()?.list(projectId, chapterId);
      if (result?.success) {
        set({ versions: result.versions || [] });
      }
    } catch (err) {
      // '[versionStore] loadVersions failed:', err;
    } finally {
      set({ loading: false });
    }
  },

  saveVersion: async (projectId, chapterId, label?) => {
    try {
      const result = await bridge()?.save(projectId, chapterId, label);
      if (result?.success) {
        await get().loadVersions(projectId, chapterId);
        return true;
      }
    } catch (err) {
      // '[versionStore] saveVersion failed:', err;
    }
    return false;
  },

  deleteVersion: async (projectId, chapterId, versionId) => {
    try {
      const result = await bridge()?.delete(projectId, chapterId, versionId);
      if (result?.success) {
        await get().loadVersions(projectId, chapterId);
      }
    } catch (err) {
      // '[versionStore] deleteVersion failed:', err;
    }
  },

  restoreVersion: async (projectId, chapterId, versionId) => {
    try {
      const result = await bridge()?.restore(projectId, chapterId, versionId);
      if (result?.success) {
        return true;
      }
    } catch (err) {
      // '[versionStore] restoreVersion failed:', err;
    }
    return false;
  },

  loadDiff: async (projectId, chapterId, versionId) => {
    set({ diffLoading: true });
    try {
      const result = await bridge()?.diff(projectId, chapterId, versionId);
      if (result?.success) {
        set({
          activeDiff: {
            changes: result.changes || [],
            versionLabel: result.versionLabel || '',
          },
        });
      }
    } catch (err) {
      // '[versionStore] loadDiff failed:', err;
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
