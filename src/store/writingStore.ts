import { create } from 'zustand';
import { useMemoryStore } from './memoryStore';

export interface WritingProject {
  id: string;
  title: string;
  type: 'memoir' | 'novel';
  chapterCount: number;
  wordCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface WritingChapter {
  id: string;
  title: string;
  filename: string;
  position: number;
  wordCount: number;
  createdAt: number;
  updatedAt: number;
}

interface WritingState {
  // Project list
  projects: WritingProject[];
  projectsLoading: boolean;

  // Active project
  activeProjectId: string | null;
  activeProject: (WritingProject & { chapters: WritingChapter[] }) | null;

  // Active chapter
  activeChapterId: string | null;
  activeChapterContent: string | null;
  chapterLoading: boolean;
  chapterDirty: boolean;

  // Actions
  loadProjects: () => Promise<void>;
  createProject: (title: string, type: 'memoir' | 'novel') => Promise<string | null>;
  deleteProject: (projectId: string) => Promise<void>;
  openProject: (projectId: string) => Promise<void>;
  closeProject: () => void;

  openChapter: (chapterId: string) => Promise<void>;
  closeChapter: () => void;
  createChapter: (title: string) => Promise<string | null>;
  renameChapter: (chapterId: string, title: string) => Promise<void>;
  deleteChapter: (chapterId: string) => Promise<void>;
  reorderChapters: (chapterIds: string[]) => Promise<void>;

  saveChapter: (content: string) => Promise<void>;
  setChapterDirty: (dirty: boolean) => void;
  setActiveChapterContent: (content: string) => void;
}

const bridge = () => (window as any).clawdbot?.writing;

export const useWritingStore = create<WritingState>((set, get) => ({
  // Initial state
  projects: [],
  projectsLoading: false,
  activeProjectId: null,
  activeProject: null,
  activeChapterId: null,
  activeChapterContent: null,
  chapterLoading: false,
  chapterDirty: false,

  // ── Project actions ──────────────────────────────────────

  loadProjects: async () => {
    set({ projectsLoading: true });
    try {
      const result = await bridge()?.project?.list();
      if (result?.success) {
        set({ projects: result.projects || [] });
      }
    } catch (err) {
      console.error('[writingStore] loadProjects failed:', err);
    } finally {
      set({ projectsLoading: false });
    }
  },

  createProject: async (title, type) => {
    try {
      const result = await bridge()?.project?.create(title, type);
      if (result?.success) {
        await get().loadProjects();
        return result.projectId || null;
      }
    } catch (err) {
      console.error('[writingStore] createProject failed:', err);
    }
    return null;
  },

  deleteProject: async (projectId) => {
    try {
      await bridge()?.project?.delete(projectId);
      // If we deleted the active project, close it
      if (get().activeProjectId === projectId) {
        set({
          activeProjectId: null,
          activeProject: null,
          activeChapterId: null,
          activeChapterContent: null,
          chapterDirty: false,
        });
      }
      await get().loadProjects();
    } catch (err) {
      console.error('[writingStore] deleteProject failed:', err);
    }
  },

  openProject: async (projectId) => {
    try {
      const result = await bridge()?.project?.get(projectId);
      if (result?.success) {
        set({
          activeProjectId: projectId,
          activeProject: {
            id: result.project.id,
            title: result.project.title,
            type: result.project.type,
            chapterCount: result.project.chapterCount,
            wordCount: result.project.wordCount,
            createdAt: result.project.createdAt,
            updatedAt: result.project.updatedAt,
            chapters: result.chapters || [],
          },
          activeChapterId: null,
          activeChapterContent: null,
          chapterDirty: false,
        });
        // Load memory store data for this project
        useMemoryStore.getState().loadMemory(projectId);
      }
    } catch (err) {
      console.error('[writingStore] openProject failed:', err);
    }
  },

  closeProject: () => {
    set({
      activeProjectId: null,
      activeProject: null,
      activeChapterId: null,
      activeChapterContent: null,
      chapterDirty: false,
    });
    useMemoryStore.getState().clearMemory();
  },

  // ── Chapter actions ──────────────────────────────────────

  openChapter: async (chapterId) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;

    set({ chapterLoading: true });
    try {
      const result = await bridge()?.chapter?.read(activeProjectId, chapterId);
      if (result?.success) {
        set({
          activeChapterId: chapterId,
          activeChapterContent: result.content ?? '',
          chapterDirty: false,
        });
      }
    } catch (err) {
      console.error('[writingStore] openChapter failed:', err);
    } finally {
      set({ chapterLoading: false });
    }
  },

  closeChapter: () => {
    set({
      activeChapterId: null,
      activeChapterContent: null,
      chapterDirty: false,
    });
  },

  createChapter: async (title) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return null;

    try {
      const result = await bridge()?.chapter?.create(activeProjectId, title);
      if (result?.success) {
        // Refresh the active project to get updated chapter list
        await get().openProject(activeProjectId);
        return result.chapterId || null;
      }
    } catch (err) {
      console.error('[writingStore] createChapter failed:', err);
    }
    return null;
  },

  renameChapter: async (chapterId, title) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;

    try {
      await bridge()?.chapter?.rename(activeProjectId, chapterId, title);
      await get().openProject(activeProjectId);
    } catch (err) {
      console.error('[writingStore] renameChapter failed:', err);
    }
  },

  deleteChapter: async (chapterId) => {
    const { activeProjectId, activeChapterId } = get();
    if (!activeProjectId) return;

    try {
      await bridge()?.chapter?.delete(activeProjectId, chapterId);
      // If we deleted the active chapter, close it
      if (activeChapterId === chapterId) {
        set({
          activeChapterId: null,
          activeChapterContent: null,
          chapterDirty: false,
        });
      }
      await get().openProject(activeProjectId);
    } catch (err) {
      console.error('[writingStore] deleteChapter failed:', err);
    }
  },

  reorderChapters: async (chapterIds) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;

    try {
      await bridge()?.chapter?.reorder(activeProjectId, chapterIds);
      await get().openProject(activeProjectId);
    } catch (err) {
      console.error('[writingStore] reorderChapters failed:', err);
    }
  },

  saveChapter: async (content) => {
    const { activeProjectId, activeChapterId } = get();
    if (!activeProjectId || !activeChapterId) return;

    try {
      await bridge()?.chapter?.save(activeProjectId, activeChapterId, content);
      set({ chapterDirty: false });
      // Refresh project to update word counts
      await get().openProject(activeProjectId);
    } catch (err) {
      console.error('[writingStore] saveChapter failed:', err);
    }
  },

  setChapterDirty: (dirty) => set({ chapterDirty: dirty }),

  setActiveChapterContent: (content) => set({ activeChapterContent: content, chapterDirty: true }),
}));
