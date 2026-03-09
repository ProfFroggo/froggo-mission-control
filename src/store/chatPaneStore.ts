// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent: string;
  timestamp: number;
  insertedToEditor?: boolean;
}

interface ChatPaneState {
  messages: ChatMessage[];
  input: string;
  streaming: boolean;
  streamContent: string;
  selectedAgent: string;
  error: string | null;

  // Actions
  setInput: (text: string) => void;
  setSelectedAgent: (agentId: string) => void;
  setStreaming: (streaming: boolean) => void;
  setStreamContent: (content: string) => void;
  addMessage: (msg: ChatMessage) => void;
  setError: (error: string | null) => void;
  markInserted: (messageId: string) => void;
  removeMessagesFrom: (index: number) => void;
  clearMessages: () => void;
  loadMessages: (messages: ChatMessage[]) => void;
}

export const useChatPaneStore = create<ChatPaneState>((set) => ({
  messages: [],
  input: '',
  streaming: false,
  streamContent: '',
  selectedAgent: 'writer',
  error: null,

  setInput: (text) => set({ input: text }),
  setSelectedAgent: (agentId) => set({ selectedAgent: agentId }),
  setStreaming: (streaming) => set({ streaming }),
  setStreamContent: (content) => set({ streamContent: content }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setError: (error) => set({ error }),
  markInserted: (messageId) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, insertedToEditor: true } : m
      ),
    })),
  removeMessagesFrom: (index) =>
    set((s) => ({ messages: s.messages.slice(0, index) })),
  clearMessages: () => set({ messages: [], streamContent: '', error: null }),
  loadMessages: (messages) => set({ messages }),
}));
