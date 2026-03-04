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

// ── localStorage helpers ──

function storageKey(projectId: string, kind: string): string {
  return `memory:${projectId}:${kind}`;
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

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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
      set({
        characters: loadFromStorage<CharacterProfile>(projectId, 'characters'),
        timeline: loadFromStorage<TimelineEvent>(projectId, 'timeline'),
        facts: loadFromStorage<VerifiedFact>(projectId, 'facts'),
      });
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
    const character: CharacterProfile = { ...data, id: generateId() };
    const updated = [...get().characters, character];
    saveToStorage(projectId, 'characters', updated);
    set({ characters: updated });
  },

  updateCharacter: async (projectId, id, data) => {
    const updated = get().characters.map((c) => (c.id === id ? { ...c, ...data } : c));
    saveToStorage(projectId, 'characters', updated);
    set({ characters: updated });
  },

  deleteCharacter: async (projectId, id) => {
    const updated = get().characters.filter((c) => c.id !== id);
    saveToStorage(projectId, 'characters', updated);
    set({ characters: updated });
    if (get().editingId === id) set({ editingId: null });
  },

  // ── Timeline ──

  addTimelineEvent: async (projectId, data) => {
    const event: TimelineEvent = { ...data, id: generateId() };
    const updated = [...get().timeline, event];
    saveToStorage(projectId, 'timeline', updated);
    set({ timeline: updated });
  },

  updateTimelineEvent: async (projectId, id, data) => {
    const updated = get().timeline.map((e) => (e.id === id ? { ...e, ...data } : e));
    saveToStorage(projectId, 'timeline', updated);
    set({ timeline: updated });
  },

  deleteTimelineEvent: async (projectId, id) => {
    const updated = get().timeline.filter((e) => e.id !== id);
    saveToStorage(projectId, 'timeline', updated);
    set({ timeline: updated });
    if (get().editingId === id) set({ editingId: null });
  },

  // ── Facts ──

  addFact: async (projectId, data) => {
    const fact: VerifiedFact = { ...data, id: generateId() };
    const updated = [...get().facts, fact];
    saveToStorage(projectId, 'facts', updated);
    set({ facts: updated });
  },

  updateFact: async (projectId, id, data) => {
    const updated = get().facts.map((f) => (f.id === id ? { ...f, ...data } : f));
    saveToStorage(projectId, 'facts', updated);
    set({ facts: updated });
  },

  deleteFact: async (projectId, id) => {
    const updated = get().facts.filter((f) => f.id !== id);
    saveToStorage(projectId, 'facts', updated);
    set({ facts: updated });
    if (get().editingId === id) set({ editingId: null });
  },
}));
