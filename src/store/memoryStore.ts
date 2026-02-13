import { create } from 'zustand';

// ── Types ──

export interface CharacterProfile {
  id: string;
  name: string;
  relationship: string;
  description: string;
  traits: string[];
}

export interface TimelineEvent {
  id: string;
  date: string;
  description: string;
  chapterRefs: string[];
  position: number;
}

export interface VerifiedFact {
  id: string;
  claim: string;
  source: string;
  status: 'unverified' | 'verified' | 'disputed' | 'needs-source';
}

interface MemoryState {
  characters: CharacterProfile[];
  timeline: TimelineEvent[];
  facts: VerifiedFact[];
  loading: boolean;
  activeTab: 'characters' | 'timeline' | 'facts' | 'sources';
  editingId: string | null;

  // Bulk load
  loadMemory: (projectId: string) => Promise<void>;
  clearMemory: () => void;

  // Tab / editing UI state
  setActiveTab: (tab: 'characters' | 'timeline' | 'facts' | 'sources') => void;
  setEditingId: (id: string | null) => void;

  // Characters
  addCharacter: (projectId: string, data: Omit<CharacterProfile, 'id'>) => Promise<void>;
  updateCharacter: (projectId: string, id: string, data: Partial<CharacterProfile>) => Promise<void>;
  deleteCharacter: (projectId: string, id: string) => Promise<void>;

  // Timeline
  addTimelineEvent: (projectId: string, data: Omit<TimelineEvent, 'id'>) => Promise<void>;
  updateTimelineEvent: (projectId: string, id: string, data: Partial<TimelineEvent>) => Promise<void>;
  deleteTimelineEvent: (projectId: string, id: string) => Promise<void>;

  // Facts
  addFact: (projectId: string, data: Omit<VerifiedFact, 'id'>) => Promise<void>;
  updateFact: (projectId: string, id: string, data: Partial<VerifiedFact>) => Promise<void>;
  deleteFact: (projectId: string, id: string) => Promise<void>;
}

const bridge = () => (window as any).clawdbot?.writing?.memory;

export const useMemoryStore = create<MemoryState>((set, get) => ({
  characters: [],
  timeline: [],
  facts: [],
  loading: false,
  activeTab: 'characters',
  editingId: null,

  // ── Bulk operations ──

  loadMemory: async (projectId) => {
    set({ loading: true });
    try {
      const b = bridge();
      if (!b) return;

      const [charResult, timeResult, factResult] = await Promise.all([
        b.characters.list(projectId),
        b.timeline.list(projectId),
        b.facts.list(projectId),
      ]);

      set({
        characters: charResult?.success ? charResult.characters : [],
        timeline: timeResult?.success ? timeResult.timeline : [],
        facts: factResult?.success ? factResult.facts : [],
      });
    } catch (err) {
      console.error('[memoryStore] loadMemory failed:', err);
    } finally {
      set({ loading: false });
    }
  },

  clearMemory: () => set({
    characters: [],
    timeline: [],
    facts: [],
    editingId: null,
  }),

  // ── UI state ──

  setActiveTab: (tab) => set({ activeTab: tab, editingId: null }),
  setEditingId: (id) => set({ editingId: id }),

  // ── Characters ──

  addCharacter: async (projectId, data) => {
    try {
      const result = await bridge()?.characters?.create(projectId, data);
      if (result?.success) {
        const listResult = await bridge()?.characters?.list(projectId);
        if (listResult?.success) set({ characters: listResult.characters });
      }
    } catch (err) {
      console.error('[memoryStore] addCharacter failed:', err);
    }
  },

  updateCharacter: async (projectId, id, data) => {
    try {
      const result = await bridge()?.characters?.update(projectId, id, data);
      if (result?.success) {
        const listResult = await bridge()?.characters?.list(projectId);
        if (listResult?.success) set({ characters: listResult.characters });
      }
    } catch (err) {
      console.error('[memoryStore] updateCharacter failed:', err);
    }
  },

  deleteCharacter: async (projectId, id) => {
    try {
      const result = await bridge()?.characters?.delete(projectId, id);
      if (result?.success) {
        const listResult = await bridge()?.characters?.list(projectId);
        if (listResult?.success) set({ characters: listResult.characters });
        if (get().editingId === id) set({ editingId: null });
      }
    } catch (err) {
      console.error('[memoryStore] deleteCharacter failed:', err);
    }
  },

  // ── Timeline ──

  addTimelineEvent: async (projectId, data) => {
    try {
      const result = await bridge()?.timeline?.create(projectId, data);
      if (result?.success) {
        const listResult = await bridge()?.timeline?.list(projectId);
        if (listResult?.success) set({ timeline: listResult.timeline });
      }
    } catch (err) {
      console.error('[memoryStore] addTimelineEvent failed:', err);
    }
  },

  updateTimelineEvent: async (projectId, id, data) => {
    try {
      const result = await bridge()?.timeline?.update(projectId, id, data);
      if (result?.success) {
        const listResult = await bridge()?.timeline?.list(projectId);
        if (listResult?.success) set({ timeline: listResult.timeline });
      }
    } catch (err) {
      console.error('[memoryStore] updateTimelineEvent failed:', err);
    }
  },

  deleteTimelineEvent: async (projectId, id) => {
    try {
      const result = await bridge()?.timeline?.delete(projectId, id);
      if (result?.success) {
        const listResult = await bridge()?.timeline?.list(projectId);
        if (listResult?.success) set({ timeline: listResult.timeline });
        if (get().editingId === id) set({ editingId: null });
      }
    } catch (err) {
      console.error('[memoryStore] deleteTimelineEvent failed:', err);
    }
  },

  // ── Facts ──

  addFact: async (projectId, data) => {
    try {
      const result = await bridge()?.facts?.create(projectId, data);
      if (result?.success) {
        const listResult = await bridge()?.facts?.list(projectId);
        if (listResult?.success) set({ facts: listResult.facts });
      }
    } catch (err) {
      console.error('[memoryStore] addFact failed:', err);
    }
  },

  updateFact: async (projectId, id, data) => {
    try {
      const result = await bridge()?.facts?.update(projectId, id, data);
      if (result?.success) {
        const listResult = await bridge()?.facts?.list(projectId);
        if (listResult?.success) set({ facts: listResult.facts });
      }
    } catch (err) {
      console.error('[memoryStore] updateFact failed:', err);
    }
  },

  deleteFact: async (projectId, id) => {
    try {
      const result = await bridge()?.facts?.delete(projectId, id);
      if (result?.success) {
        const listResult = await bridge()?.facts?.list(projectId);
        if (listResult?.success) set({ facts: listResult.facts });
        if (get().editingId === id) set({ editingId: null });
      }
    } catch (err) {
      console.error('[memoryStore] deleteFact failed:', err);
    }
  },
}));
