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
    };
  }
}
