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

const bridge = () => window.clawdbot?.writing?.research;

export const useResearchStore = create<ResearchState>((set, get) => ({
  sources: [],
  factSourceMap: {},
  loading: false,
  editingId: null,

  // ── Sources ──

  loadSources: async (projectId) => {
    set({ loading: true });
    try {
      const result = await bridge()?.sources?.list(projectId);
      if (result?.success) {
        set({ sources: result.sources || [] });
      }
    } catch (err) {
      // '[researchStore] loadSources failed:', err;
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
    try {
      const result = await bridge()?.sources?.create(projectId, data);
      if (result?.success) {
        const listResult = await bridge()?.sources?.list(projectId);
        if (listResult?.success) set({ sources: listResult.sources });
      }
    } catch (err) {
      // '[researchStore] addSource failed:', err;
    }
  },

  updateSource: async (projectId, id, data) => {
    try {
      const result = await bridge()?.sources?.update(projectId, id, data);
      if (result?.success) {
        const listResult = await bridge()?.sources?.list(projectId);
        if (listResult?.success) set({ sources: listResult.sources });
      }
    } catch (err) {
      // '[researchStore] updateSource failed:', err;
    }
  },

  deleteSource: async (projectId, id) => {
    try {
      const result = await bridge()?.sources?.delete(projectId, id);
      if (result?.success) {
        const listResult = await bridge()?.sources?.list(projectId);
        if (listResult?.success) set({ sources: listResult.sources });
        if (get().editingId === id) set({ editingId: null });
      }
    } catch (err) {
      // '[researchStore] deleteSource failed:', err;
    }
  },

  // ── Fact-source linking ──

  loadLinksForFact: async (projectId, factId) => {
    try {
      const result = await bridge()?.links?.forFact(projectId, factId);
      if (result?.success) {
        const sourceIds = (result.sources || []).map((s: any) => s.id);
        set((state) => ({
          factSourceMap: { ...state.factSourceMap, [factId]: sourceIds },
        }));
      }
    } catch (err) {
      // '[researchStore] loadLinksForFact failed:', err;
    }
  },

  linkSourceToFact: async (projectId, factId, sourceId) => {
    try {
      await bridge()?.links?.link(projectId, factId, sourceId);
      await get().loadLinksForFact(projectId, factId);
    } catch (err) {
      // '[researchStore] linkSourceToFact failed:', err;
    }
  },

  unlinkSourceFromFact: async (projectId, factId, sourceId) => {
    try {
      await bridge()?.links?.unlink(projectId, factId, sourceId);
      await get().loadLinksForFact(projectId, factId);
    } catch (err) {
      // '[researchStore] unlinkSourceFromFact failed:', err;
    }
  },

  loadAllFactLinks: async (projectId, factIds) => {
    try {
      const results = await Promise.all(
        factIds.map(async (factId) => {
          const result = await bridge()?.links?.forFact(projectId, factId);
          const sourceIds = result?.success
            ? (result.sources || []).map((s: any) => s.id)
            : [];
          return [factId, sourceIds] as const;
        }),
      );
      const map: Record<string, string[]> = {};
      for (const [factId, sourceIds] of results) {
        map[factId] = sourceIds;
      }
      set({ factSourceMap: map });
    } catch (err) {
      // '[researchStore] loadAllFactLinks failed:', err;
    }
  },
}));
