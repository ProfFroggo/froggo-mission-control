import { create } from 'zustand';
import { useMemoryStore } from './memoryStore';
import { useResearchStore } from './researchStore';

export interface WritingProject {
  id: string;
  title: string;
  type: string;
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

export interface PendingInsert {
  content: string;
  mode: 'append' | 'cursor' | 'replace';
  sourceMessageId?: string;
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

  // Pending insert (chat-to-editor bridge)
  pendingInsert: PendingInsert | null;
  setPendingInsert: (insert: PendingInsert) => void;
  clearPendingInsert: () => void;

  // Actions
  loadProjects: () => Promise<void>;
  createProject: (title: string, type: string) => Promise<string | null>;
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

// ── localStorage helpers ──

const PROJECTS_KEY = 'writing:projects';
const CHAPTERS_KEY = (projectId: string) => `writing:${projectId}:chapters`;
const CONTENT_KEY = (projectId: string, chapterId: string) => `writing:${projectId}:content:${chapterId}`;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadProjects(): WritingProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProjects(projects: WritingProject[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

function loadChapters(projectId: string): WritingChapter[] {
  try {
    const raw = localStorage.getItem(CHAPTERS_KEY(projectId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveChapters(projectId: string, chapters: WritingChapter[]): void {
  localStorage.setItem(CHAPTERS_KEY(projectId), JSON.stringify(chapters));
}

function loadContent(projectId: string, chapterId: string): string {
  return localStorage.getItem(CONTENT_KEY(projectId, chapterId)) ?? '';
}

function saveContent(projectId: string, chapterId: string, content: string): void {
  localStorage.setItem(CONTENT_KEY(projectId, chapterId), content);
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

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
  pendingInsert: null,

  setPendingInsert: (insert) => set({ pendingInsert: insert }),
  clearPendingInsert: () => set({ pendingInsert: null }),

  // ── Project actions ──────────────────────────────────────

  loadProjects: async () => {
    set({ projectsLoading: true });
    try {
      set({ projects: loadProjects() });
    } finally {
      set({ projectsLoading: false });
    }
  },

  createProject: async (title, type) => {
    const now = Date.now();
    const project: WritingProject = {
      id: generateId(),
      title,
      type,
      chapterCount: 0,
      wordCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const projects = [...loadProjects(), project];
    saveProjects(projects);
    set({ projects });
    return project.id;
  },

  deleteProject: async (projectId) => {
    const projects = loadProjects().filter((p) => p.id !== projectId);
    saveProjects(projects);
    // Clean up chapters and content
    const chapters = loadChapters(projectId);
    for (const ch of chapters) {
      localStorage.removeItem(CONTENT_KEY(projectId, ch.id));
    }
    localStorage.removeItem(CHAPTERS_KEY(projectId));
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
    set({ projects });
  },

  openProject: async (projectId) => {
    const projects = loadProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const chapters = loadChapters(projectId);
    set({
      activeProjectId: projectId,
      activeProject: { ...project, chapters },
      activeChapterId: null,
      activeChapterContent: null,
      chapterDirty: false,
    });
    // Load memory store data for this project
    useMemoryStore.getState().loadMemory(projectId);
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
    useResearchStore.getState().clearSources();
  },

  // ── Chapter actions ──────────────────────────────────────

  openChapter: async (chapterId) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;

    set({ chapterLoading: true });
    try {
      const content = loadContent(activeProjectId, chapterId);
      set({
        activeChapterId: chapterId,
        activeChapterContent: content,
        chapterDirty: false,
      });
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

    const chapters = loadChapters(activeProjectId);
    const now = Date.now();
    const chapter: WritingChapter = {
      id: generateId(),
      title,
      filename: `${title.toLowerCase().replace(/\s+/g, '-')}.md`,
      position: chapters.length,
      wordCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...chapters, chapter];
    saveChapters(activeProjectId, updated);
    // Update project chapter count
    const projects = loadProjects().map((p) =>
      p.id === activeProjectId ? { ...p, chapterCount: updated.length, updatedAt: now } : p,
    );
    saveProjects(projects);
    // Refresh the active project
    await get().openProject(activeProjectId);
    return chapter.id;
  },

  renameChapter: async (chapterId, title) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;

    const chapters = loadChapters(activeProjectId).map((ch) =>
      ch.id === chapterId ? { ...ch, title, updatedAt: Date.now() } : ch,
    );
    saveChapters(activeProjectId, chapters);
    await get().openProject(activeProjectId);
  },

  deleteChapter: async (chapterId) => {
    const { activeProjectId, activeChapterId } = get();
    if (!activeProjectId) return;

    const chapters = loadChapters(activeProjectId).filter((ch) => ch.id !== chapterId);
    saveChapters(activeProjectId, chapters);
    localStorage.removeItem(CONTENT_KEY(activeProjectId, chapterId));
    // Update project chapter count
    const now = Date.now();
    const projects = loadProjects().map((p) =>
      p.id === activeProjectId ? { ...p, chapterCount: chapters.length, updatedAt: now } : p,
    );
    saveProjects(projects);
    // If we deleted the active chapter, close it
    if (activeChapterId === chapterId) {
      set({
        activeChapterId: null,
        activeChapterContent: null,
        chapterDirty: false,
      });
    }
    await get().openProject(activeProjectId);
  },

  reorderChapters: async (chapterIds) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;

    const chapters = loadChapters(activeProjectId);
    const reordered = chapterIds
      .map((id, idx) => {
        const ch = chapters.find((c) => c.id === id);
        return ch ? { ...ch, position: idx } : null;
      })
      .filter(Boolean) as WritingChapter[];
    saveChapters(activeProjectId, reordered);
    await get().openProject(activeProjectId);
  },

  saveChapter: async (content) => {
    const { activeProjectId, activeChapterId } = get();
    if (!activeProjectId || !activeChapterId) return;

    saveContent(activeProjectId, activeChapterId, content);
    set({ chapterDirty: false });
    // Update word count on chapter and project
    const wc = countWords(content);
    const chapters = loadChapters(activeProjectId).map((ch) =>
      ch.id === activeChapterId ? { ...ch, wordCount: wc, updatedAt: Date.now() } : ch,
    );
    saveChapters(activeProjectId, chapters);
    const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
    const projects = loadProjects().map((p) =>
      p.id === activeProjectId ? { ...p, wordCount: totalWords, updatedAt: Date.now() } : p,
    );
    saveProjects(projects);
    // Refresh project to update word counts
    await get().openProject(activeProjectId);
  },

  setChapterDirty: (dirty) => set({ chapterDirty: dirty }),

  setActiveChapterContent: (content) => set({ activeChapterContent: content, chapterDirty: true }),
}));
