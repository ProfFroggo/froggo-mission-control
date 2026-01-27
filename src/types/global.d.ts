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

interface SubtaskData {
  id: string;
  taskId?: string;
  title: string;
  description?: string;
  completed: boolean;
  completedAt?: number;
  completedBy?: string;
  assignedTo?: string;
  position?: number;
  createdAt?: number;
}

interface ActivityData {
  id: number;
  taskId: string;
  agentId?: string;
  action: string;
  message: string;
  details?: string;
  timestamp: number;
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
        // Subtask operations
        subtasks: {
          list: (taskId: string) => Promise<{ success: boolean; subtasks: SubtaskData[] }>;
          add: (taskId: string, subtask: { id: string; title: string; description?: string; assignedTo?: string }) => Promise<{ success: boolean; id?: string }>;
          update: (subtaskId: string, updates: { completed?: boolean; completedBy?: string; title?: string; assignedTo?: string }) => Promise<{ success: boolean }>;
          delete: (subtaskId: string) => Promise<{ success: boolean }>;
          reorder: (subtaskIds: string[]) => Promise<{ success: boolean }>;
        };
        // Activity log operations
        activity: {
          list: (taskId: string, limit?: number) => Promise<{ success: boolean; activities: ActivityData[] }>;
          add: (taskId: string, entry: { action: string; message: string; agentId?: string; details?: string }) => Promise<{ success: boolean }>;
        };
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
        approveAll: () => Promise<{ success: boolean; count?: number }>;
      };
      // Execution
      execute: {
        tweet: (content: string, taskId?: string) => Promise<{ success: boolean; output?: string; error?: string }>;
      };
      // Chat message persistence
      chat: {
        saveMessage: (msg: { role: string; content: string; timestamp: number; sessionKey?: string }) => Promise<{ success: boolean }>;
        loadMessages: (limit?: number, sessionKey?: string) => Promise<{ success: boolean; messages: any[] }>;
        clearMessages: (sessionKey?: string) => Promise<{ success: boolean }>;
      };
      // Filesystem
      fs: {
        writeBase64: (path: string, base64: string) => Promise<{ success: boolean; path?: string }>;
        readFile: (path: string, encoding?: string) => Promise<{ success: boolean; content?: string; error?: string }>;
      };
      // Library
      library: {
        list: (category?: string) => Promise<{ success: boolean; files: any[] }>;
        upload: () => Promise<{ success: boolean; file?: any; error?: string }>;
        delete: (fileId: string) => Promise<{ success: boolean }>;
        link: (fileId: string, taskId: string) => Promise<{ success: boolean }>;
      };
      // Screenshot
      screenshot: {
        capture: (outputPath: string) => Promise<{ success: boolean; path?: string; size?: number }>;
        navigate: (view: string) => Promise<{ success: boolean }>;
      };
      // Schedule
      schedule: {
        list: () => Promise<{ success: boolean; items: any[] }>;
        add: (item: { type: string; content: string; scheduledFor: string; metadata?: any }) => Promise<{ success: boolean; id?: string }>;
        update: (id: string, item: { type?: string; content?: string; scheduledFor?: string; metadata?: any }) => Promise<{ success: boolean }>;
        cancel: (id: string) => Promise<{ success: boolean }>;
        sendNow: (id: string) => Promise<{ success: boolean }>;
      };
      // Search
      search: {
        local: (query: string) => Promise<{ success: boolean; results: any[] }>;
        discord: (query: string) => Promise<{ success: boolean; messages: any[] }>;
        telegram: (query: string) => Promise<{ success: boolean; messages: any[] }>;
        whatsapp: (query: string) => Promise<{ success: boolean; messages: any[] }>;
      };
      // System status
      system: {
        status: () => Promise<{ success: boolean; status: any }>;
      };
      // Settings
      settings: {
        get: () => Promise<{ success: boolean; settings: any }>;
        save: (settings: any) => Promise<{ success: boolean }>;
      };
      // Twitter (bird CLI)
      twitter: {
        mentions: () => Promise<{ success: boolean; mentions?: any[]; raw?: string }>;
        home: (limit?: number) => Promise<{ success: boolean; tweets?: any[]; raw?: string }>;
        queuePost: (text: string, context?: string) => Promise<{ success: boolean; message?: string }>;
      };
      // Messages (wacli)
      messages: {
        recent: (limit?: number) => Promise<{ success: boolean; chats: any[] }>;
      };
      // Email (gog CLI)
      email: {
        unread: (account?: string) => Promise<{ success: boolean; emails: any[]; account?: string }>;
        search: (query: string, account?: string) => Promise<{ success: boolean; emails: any[]; account?: string }>;
        queueSend: (to: string, subject: string, body: string, account?: string) => Promise<{ success: boolean; message?: string }>;
      };
      // Calendar (gog CLI)
      calendar: {
        events: (account?: string, days?: number) => Promise<{ success: boolean; events: any[]; account?: string }>;
        today: () => Promise<{ success: boolean; events: any[]; account?: string }>;
      };
      // Sessions management
      sessions: {
        list: () => Promise<{ success: boolean; sessions: any[] }>;
        history: (sessionKey: string, limit?: number) => Promise<{ success: boolean; messages: any[] }>;
      };
      // Shell execution
      exec: {
        run: (command: string) => Promise<{ success: boolean; stdout: string; stderr: string }>;
      };
    };
  }
}
