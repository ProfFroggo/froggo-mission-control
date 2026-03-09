// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { create } from 'zustand';

// ── Types ──

export interface ResearchSource {
  id: string;
  title: string;
  author: string;
  type: 'book' | 'article' | 'interview' | 'website' | 'document' | 'other';
  url: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface FactSourceLink {
  fact_id: string;
  source_id: string;
  notes: string;
  created_at: string;
}

interface ResearchState {
  sources: ResearchSource[];
  factSourceMap: Record<string, string[]>; // factId -> sourceId[]
  loading: boolean;
  editingId: string | null;

  // Sources CRUD
  loadSources: (projectId: string) => Promise<void>;
  clearSources: () => void;
  setEditingId: (id: string | null) => void;
  addSource: (projectId: string, data: Omit<ResearchSource, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateSource: (projectId: string, id: string, data: Partial<ResearchSource>) => Promise<void>;
  deleteSource: (projectId: string, id: string) => Promise<void>;

  // Fact-source linking
  loadLinksForFact: (projectId: string, factId: string) => Promise<void>;
  linkSourceToFact: (projectId: string, factId: string, sourceId: string) => Promise<void>;
  unlinkSourceFromFact: (projectId: string, factId: string, sourceId: string) => Promise<void>;
  loadAllFactLinks: (projectId: string, factIds: string[]) => Promise<void>;
}

// ── localStorage helpers ──

function storageKey(projectId: string, kind: string): string {
  return `research:${projectId}:${kind}`;
}

function loadFromStorage<T>(projectId: string, kind: string): T[] {
  try {
    const raw = localStorage.getItem(storageKey(projectId, kind));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage<T>(projectId: string, kind: string, data: T[]): void {
  localStorage.setItem(storageKey(projectId, kind), JSON.stringify(data));
}

function loadLinksMap(projectId: string): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(storageKey(projectId, 'links'));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLinksMap(projectId: string, map: Record<string, string[]>): void {
  localStorage.setItem(storageKey(projectId, 'links'), JSON.stringify(map));
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useResearchStore = create<ResearchState>((set, get) => ({
  sources: [],
  factSourceMap: {},
  loading: false,
  editingId: null,

  // ── Sources ──

  loadSources: async (projectId) => {
    set({ loading: true });
    try {
      const sources = loadFromStorage<ResearchSource>(projectId, 'sources');
      set({ sources });
    } finally {
      set({ loading: false });
    }
  },

  clearSources: () => set({
    sources: [],
    factSourceMap: {},
    editingId: null,
  }),

  setEditingId: (id) => set({ editingId: id }),

  addSource: async (projectId, data) => {
    const now = new Date().toISOString();
    const source: ResearchSource = { ...data, id: generateId(), created_at: now, updated_at: now };
    const updated = [...get().sources, source];
    saveToStorage(projectId, 'sources', updated);
    set({ sources: updated });
  },

  updateSource: async (projectId, id, data) => {
    const updated = get().sources.map((s) =>
      s.id === id ? { ...s, ...data, updated_at: new Date().toISOString() } : s,
    );
    saveToStorage(projectId, 'sources', updated);
    set({ sources: updated });
  },

  deleteSource: async (projectId, id) => {
    const updated = get().sources.filter((s) => s.id !== id);
    saveToStorage(projectId, 'sources', updated);
    set({ sources: updated });
    if (get().editingId === id) set({ editingId: null });
  },

  // ── Fact-source linking ──

  loadLinksForFact: async (projectId, factId) => {
    const map = loadLinksMap(projectId);
    set((state) => ({
      factSourceMap: { ...state.factSourceMap, [factId]: map[factId] || [] },
    }));
  },

  linkSourceToFact: async (projectId, factId, sourceId) => {
    const map = loadLinksMap(projectId);
    const existing = map[factId] || [];
    if (!existing.includes(sourceId)) {
      map[factId] = [...existing, sourceId];
      saveLinksMap(projectId, map);
    }
    set((state) => ({
      factSourceMap: { ...state.factSourceMap, [factId]: map[factId] },
    }));
  },

  unlinkSourceFromFact: async (projectId, factId, sourceId) => {
    const map = loadLinksMap(projectId);
    map[factId] = (map[factId] || []).filter((id) => id !== sourceId);
    saveLinksMap(projectId, map);
    set((state) => ({
      factSourceMap: { ...state.factSourceMap, [factId]: map[factId] },
    }));
  },

  loadAllFactLinks: async (projectId, factIds) => {
    const map = loadLinksMap(projectId);
    const result: Record<string, string[]> = {};
    for (const factId of factIds) {
      result[factId] = map[factId] || [];
    }
    set({ factSourceMap: result });
  },
}));
