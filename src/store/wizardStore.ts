/**
 * Wizard Store — state management for the Setup Wizard.
 *
 * State machine: idle -> braindump -> conversation -> extracting -> review -> creating -> complete
 *
 * Persists wizard state to localStorage so the user can
 * resume an in-progress wizard after navigating away.
 */

import { create } from 'zustand';
import type { WizardPlan } from '../lib/wizardSchema';
import type { ChatMessage } from './chatPaneStore';

export type { ChatMessage } from './chatPaneStore';

export type WizardStep =
  | 'idle'
  | 'braindump'
  | 'conversation'
  | 'extracting'
  | 'review'
  | 'creating'
  | 'complete';

interface WizardState {
  step: WizardStep;
  sessionId: string | null;
  messages: ChatMessage[];
  streaming: boolean;
  streamContent: string;
  selectedAgent: string;
  brainDump: string;
  plan: WizardPlan | null;
  extractionError: string | null;
  error: string | null;

  // Actions
  startWizard: () => void;
  cancelWizard: () => void;
  setStep: (step: WizardStep) => void;
  setBrainDump: (text: string) => void;
  setSelectedAgent: (agent: string) => void;
  setStreaming: (streaming: boolean) => void;
  setStreamContent: (content: string) => void;
  addMessage: (msg: ChatMessage) => void;
  setPlan: (plan: WizardPlan | null) => void;
  updatePlan: (updates: Partial<WizardPlan>) => void;
  setExtractionError: (err: string | null) => void;
  setError: (err: string | null) => void;
  clearMessages: () => void;
  loadState: (state: Partial<WizardState>) => void;
  reset: () => void;
}

const WIZARD_STORAGE_KEY = 'wizard:state';

function cleanupWizardStorage(sessionId: string | null): void {
  if (sessionId) {
    localStorage.removeItem(`${WIZARD_STORAGE_KEY}:${sessionId}`);
  }
}

export const useWizardStore = create<WizardState>((set, get) => ({
  step: 'idle',
  sessionId: null,
  messages: [],
  streaming: false,
  streamContent: '',
  selectedAgent: 'writer',
  brainDump: '',
  plan: null,
  extractionError: null,
  error: null,

  startWizard: () => {
    const sessionId = `wiz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set({
      step: 'braindump',
      sessionId,
      messages: [],
      plan: null,
      extractionError: null,
      error: null,
    });
  },

  cancelWizard: () => {
    const { sessionId } = get();
    cleanupWizardStorage(sessionId);
    set({
      step: 'idle',
      sessionId: null,
      messages: [],
      streaming: false,
      streamContent: '',
      brainDump: '',
      plan: null,
      extractionError: null,
      error: null,
    });
  },

  setStep: (step) => set({ step }),
  setBrainDump: (text) => set({ brainDump: text }),
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  setStreaming: (streaming) => set({ streaming }),
  setStreamContent: (content) => set({ streamContent: content }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setPlan: (plan) => set({ plan }),
  updatePlan: (updates) =>
    set((s) => ({
      plan: s.plan ? { ...s.plan, ...updates } : null,
    })),
  setExtractionError: (err) => set({ extractionError: err }),
  setError: (err) => set({ error: err }),
  clearMessages: () => set({ messages: [], streamContent: '' }),
  loadState: (state) => set(state),
  reset: () =>
    set({
      step: 'idle',
      sessionId: null,
      messages: [],
      streaming: false,
      streamContent: '',
      selectedAgent: 'writer',
      brainDump: '',
      plan: null,
      extractionError: null,
      error: null,
    }),
}));
