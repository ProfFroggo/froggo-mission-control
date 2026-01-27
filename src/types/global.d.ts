export {};

interface VoskWord {
  word: string;
  start: number;
  end: number;
  conf: number;
}

interface VoskAudioResult {
  final?: boolean;
  text?: string;
  partial?: string;
  words?: VoskWord[];
  error?: string;
}

declare global {
  interface Window {
    clawdbot?: {
      gateway: {
        status: () => Promise<unknown>;
        sessions: () => Promise<unknown>;
      };
      approvals: {
        read: () => Promise<{ items: any[] }>;
        clear: () => Promise<{ success: boolean }>;
        remove: (id: string) => Promise<{ success: boolean }>;
        onUpdate: (callback: (items: any[]) => void) => () => void;
      };
      // Vosk real-time streaming API
      vosk: {
        check: () => Promise<{ available: boolean; modelPath: string; modelExists: boolean }>;
        start: (sampleRate?: number) => Promise<{ success?: boolean; error?: string }>;
        audio: (audioData: ArrayBuffer) => Promise<VoskAudioResult>;
        final: (reset?: boolean) => Promise<{ text?: string; words?: VoskWord[]; error?: string }>;
        stop: () => Promise<{ text?: string; error?: string }>;
      };
      // Whisper (legacy/fallback)
      whisper: {
        check: () => Promise<{ available: boolean; path: string }>;
        transcribe: (audioData: ArrayBuffer) => Promise<{ transcript?: string; error?: string }>;
      };
      platform: string;
      // Voice helpers
      voice?: {
        getModelUrl: () => Promise<string>;
        speak: (text: string, voice?: string) => Promise<{ success: boolean; path?: string; error?: string }>;
        isDev: () => boolean;
      };
      // Task sync to froggo-db
      tasks: {
        sync: (task: { id: string; title: string; status: string; project?: string; assignedTo?: string }) => Promise<{ success: boolean }>;
        update: (taskId: string, updates: { status?: string; assignedTo?: string }) => Promise<{ success: boolean }>;
        list: (status?: string) => Promise<{ success: boolean; tasks: any[] }>;
        start: (taskId: string) => Promise<{ success: boolean }>;
        complete: (taskId: string, outcome?: string) => Promise<{ success: boolean }>;
      };
      // Rejection logging
      rejections: {
        log: (rejection: { type: string; title: string; content?: string; reason?: string }) => Promise<{ success: boolean }>;
      };
      // Inbox (froggo-db backed)
      inbox: {
        list: (status?: string) => Promise<{ success: boolean; items: any[] }>;
        add: (item: { type: string; title: string; content: string; context?: string; channel?: string }) => Promise<{ success: boolean }>;
        update: (id: number, updates: { status?: string; feedback?: string }) => Promise<{ success: boolean }>;
      };
      // Execution
      execute: {
        tweet: (content: string, taskId?: string) => Promise<{ success: boolean; output?: string; error?: string }>;
      };
    };
  }
}
