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
    electron?: {
      execute: (command: string) => Promise<{ stdout?: string; stderr?: string; error?: string }>;
    };
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
        sync: (task: { id: string; title: string; status: string; project?: string; assignedTo?: string; description?: string }) => Promise<{ success: boolean; error?: string }>;
        update: (taskId: string, updates: { status?: string; assignedTo?: string }) => Promise<{ success: boolean }>;
        list: (status?: string) => Promise<{ success: boolean; tasks: any[] }>;
        start: (taskId: string) => Promise<{ success: boolean }>;
        complete: (taskId: string, outcome?: string) => Promise<{ success: boolean }>;
        // Poke Brain for status update
        poke: (taskId: string, title: string) => Promise<{ success: boolean; message?: string; error?: string }>;
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
        // Add with custom metadata (for Stage 2 email items)
        addWithMetadata: (item: { type: string; title: string; content: string; context?: string; channel?: string; metadata?: string }) => Promise<{ success: boolean; error?: string }>;
        update: (id: number, updates: { status?: string; feedback?: string }) => Promise<{ success: boolean }>;
        approveAll: () => Promise<{ success: boolean; count?: number }>;
        // Revision handlers for 'needs-revision' items
        listRevisions: () => Promise<{ success: boolean; items: any[] }>;
        submitRevision: (originalId: number, revisedContent: string, revisedTitle?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
        getRevisionContext: (itemId: number) => Promise<{ success: boolean; item?: { id: number; type: string; title: string; originalContent: string; feedback: string; context: string; created: string; sourceChannel: string }; error?: string }>;
        onUpdate: (callback: (data: { newItems?: number; revision?: boolean; originalId?: number }) => void) => () => void;
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
        suggestReplies: (context: { role: string; content: string }[]) => Promise<{ success: boolean; suggestions: string[]; error?: string }>;
      };
      // Filesystem
      fs: {
        writeBase64: (path: string, base64: string) => Promise<{ success: boolean; path?: string }>;
        readFile: (path: string, encoding?: string) => Promise<{ success: boolean; content?: string; error?: string }>;
        append: (path: string, content: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      };
      // Database
      db: {
        exec: (query: string, params?: any[]) => Promise<{ success: boolean; result?: any[]; error?: string }>;
        query: (query: string, params?: any[]) => Promise<{ success: boolean; rows?: any[]; error?: string }>;
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
      // X (bird CLI)
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
        // Direct send (Stage 2 email workflow)
        send: (options: { to: string; subject: string; body: string; account?: string }) => Promise<{ success: boolean; output?: string; error?: string }>;
      };
      // Calendar (gog CLI + aggregation service)
      calendar: {
        events: (account?: string, days?: number) => Promise<{ success: boolean; events: any[]; account?: string }>;
        today: () => Promise<{ success: boolean; events: any[]; account?: string }>;
        // Calendar aggregation service
        aggregate: (options?: {
          days?: number;
          includeGoogle?: boolean;
          includeMissionControl?: boolean;
          accounts?: string[];
        }) => Promise<{
          success: boolean;
          events: any[];
          sources: {
            google: { [account: string]: number };
            missionControl: number;
          };
          errors: string[];
          error?: string;
        }>;
        clearCache: (source?: 'google' | 'mission-control' | 'all') => Promise<{ success: boolean; error?: string }>;
        cacheStats: () => Promise<{
          success: boolean;
          stats?: {
            totalEntries: number;
            validEntries: number;
            expiredEntries: number;
            entries: Array<{
              key: string;
              age: number;
              valid: boolean;
              eventCount: number;
            }>;
          };
          error?: string;
        }>;
      };
      // Sessions management
      sessions: {
        list: () => Promise<{ success: boolean; sessions: any[] }>;
        history: (sessionKey: string, limit?: number) => Promise<{ success: boolean; messages: any[] }>;
      };
      // Pinned Conversations
      pins: {
        list: () => Promise<{ success: boolean; pins: Array<{ id: number; session_key: string; pinned_at: number; pinned_by: string; notes?: string }> }>;
        isPinned: (sessionKey: string) => Promise<{ success: boolean; pinned: boolean }>;
        pin: (sessionKey: string, notes?: string) => Promise<{ success: boolean; error?: string }>;
        unpin: (sessionKey: string) => Promise<{ success: boolean; error?: string }>;
        toggle: (sessionKey: string) => Promise<{ success: boolean; pinned: boolean; error?: string }>;
        reorder: (order: string[]) => Promise<{ success: boolean; error?: string }>;
      };
      // Message Folders
      folders: {
        list: () => Promise<{ success: boolean; folders: any[]; error?: string }>;
        create: (folder: { name: string; icon?: string; color?: string; description?: string }) => Promise<{ success: boolean; folder?: any; error?: string }>;
        update: (folderId: number, updates: { name?: string; icon?: string; color?: string; description?: string }) => Promise<{ success: boolean; error?: string }>;
        delete: (folderId: number) => Promise<{ success: boolean; error?: string }>;
        assign: (folderId: number, sessionKey: string, notes?: string) => Promise<{ success: boolean; error?: string }>;
        unassign: (folderId: number, sessionKey: string) => Promise<{ success: boolean; error?: string }>;
        forConversation: (sessionKey: string) => Promise<{ success: boolean; folders: any[]; error?: string }>;
        conversations: (folderId: number) => Promise<{ success: boolean; conversations: any[]; error?: string }>;
      };
      // Conversations
      conversations: {
        archive: (sessionKey: string) => Promise<{ success: boolean; error?: string }>;
        unarchive: (sessionKey: string) => Promise<{ success: boolean; error?: string }>;
        archived: () => Promise<{ success: boolean; conversations: any[]; error?: string }>;
        isArchived: (sessionKey: string) => Promise<{ success: boolean; archived: boolean; error?: string }>;
        markRead: (sessionKey: string) => Promise<{ success: boolean; error?: string }>;
        delete: (sessionKey: string) => Promise<{ success: boolean; error?: string }>;
      };
      // Shell execution
      exec: {
        run: (command: string) => Promise<{ success: boolean; stdout: string; stderr: string }>;
      };
      // Notification settings (per-conversation)
      notificationSettings: {
        get: (sessionKey: string) => Promise<{ success: boolean; settings?: any; error?: string }>;
        set: (sessionKey: string, settings: any) => Promise<{ success: boolean; error?: string }>;
        delete: (sessionKey: string) => Promise<{ success: boolean; error?: string }>;
        getEffective: (sessionKey: string) => Promise<{ success: boolean; settings?: any; error?: string }>;
        getGlobalDefaults: () => Promise<{ success: boolean; defaults?: any; error?: string }>;
        setGlobalDefaults: (defaults: any) => Promise<{ success: boolean; error?: string }>;
        muteConversation: (sessionKey: string, until?: string) => Promise<{ success: boolean; error?: string }>;
        unmuteConversation: (sessionKey: string) => Promise<{ success: boolean; error?: string }>;
      };
      // VIP contacts
      vip: {
        list: (category?: string) => Promise<any>;
        add: (vip: { identifier: string; label?: string; category?: string; boost?: number }) => Promise<{ success: boolean; error?: string }>;
        update: (id: number | string, updates: { label?: string; boost?: number; category?: string }) => Promise<{ success: boolean; error?: string }>;
        remove: (id: number | string) => Promise<{ success: boolean; error?: string }>;
      };
      // Snooze conversations
      snooze: {
        list: () => Promise<{ success: boolean; snoozes?: any[]; error?: string }>;
        get: (sessionKey: string) => Promise<{ success: boolean; snooze?: any; error?: string }>;
        set: (sessionKey: string, until: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
        unset: (sessionKey: string) => Promise<{ success: boolean; error?: string }>;
      };
      // Froggo DB direct queries
      froggo: {
        query: (sql: string, params?: any[]) => Promise<{ success: boolean; rows?: any[]; error?: string }>;
      };
      // System notifications
      notifications: {
        getPrefs: () => Promise<any>;
        updatePrefs: (updates: any) => Promise<void>;
        send: (options: any) => Promise<void>;
        test: () => Promise<void>;
        onReceived: (callback: (notification: any) => void) => () => void;
        onAction: (callback: (action: any) => void) => () => void;
      };
      // Navigation
      onNavigate: (callback: (view: string, data?: any) => void) => () => void;
      // Starred messages
      starred: {
        star: (messageId: number, note?: string, category?: string) => Promise<{ success: boolean; error?: string }>;
        unstar: (identifier: number) => Promise<{ success: boolean; error?: string }>;
        list: (options?: { category?: string; sessionKey?: string; limit?: number }) => Promise<{ success: boolean; starred: any[]; error?: string }>;
        search: (query: string, limit?: number) => Promise<{ success: boolean; results: any[]; error?: string }>;
        stats: () => Promise<{ success: boolean; stats: { total: number; byCategory?: any[] } }>;
        check: (messageId: number) => Promise<{ success: boolean; isStarred: boolean }>;
      };
    };
  }
}
