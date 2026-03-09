// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { create } from 'zustand';

export interface ParsedAlternative {
  text: string;
  commentary?: string;
}

interface FeedbackState {
  selectedAgent: string;       // 'writer' | 'researcher' | 'jess'
  instructions: string;
  streaming: boolean;
  streamContent: string;       // raw accumulated stream text
  alternatives: ParsedAlternative[];  // parsed alternatives (set on stream end)
  error: string | null;
  savedSelection: { from: number; to: number } | null;

  setSelectedAgent: (agent: string) => void;
  setInstructions: (text: string) => void;
  setStreaming: (streaming: boolean) => void;
  setStreamContent: (content: string) => void;
  setAlternatives: (alts: ParsedAlternative[]) => void;
  setError: (error: string | null) => void;
  setSavedSelection: (sel: { from: number; to: number } | null) => void;
  reset: () => void;
}

export const useFeedbackStore = create<FeedbackState>((set) => ({
  selectedAgent: 'writer',
  instructions: '',
  streaming: false,
  streamContent: '',
  alternatives: [],
  error: null,
  savedSelection: null,

  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  setInstructions: (text) => set({ instructions: text }),
  setStreaming: (streaming) => set({ streaming }),
  setStreamContent: (content) => set({ streamContent: content }),
  setAlternatives: (alts) => set({ alternatives: alts }),
  setError: (error) => set({ error }),
  setSavedSelection: (sel) => set({ savedSelection: sel }),
  reset: () => set({
    instructions: '',
    streaming: false,
    streamContent: '',
    alternatives: [],
    error: null,
    savedSelection: null,
  }),
}));
