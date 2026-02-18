export {};

declare global {
  // ============================================
  // Base Types
  // ============================================

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

  // ============================================
  // Task Types
  // ============================================

  interface Task {
    id: string;
    title: string;
    description?: string;
    status: 'todo' | 'in-progress' | 'review' | 'done' | 'internal-review';
    project?: string;
    assignedTo?: string;
    priority?: 'p0' | 'p1' | 'p2' | 'p3' | string;
    createdAt?: number;
    updatedAt?: number;
    completedAt?: number;
    dueDate?: string;
    subtasks?: SubtaskData[];
  }

  // ============================================
  // Inbox Types
  // ============================================

  interface InboxItem {
    id: number | string;
    type: string;
    title: string;
    content: string;
    context?: string;
    channel?: string;
    source_channel?: string;
    status?: string;
    createdAt?: number;
    created?: string;
    metadata?: string;
    isTask?: boolean;
  }

  interface RevisionItem {
    id: number;
    type: string;
    title: string;
    originalContent: string;
    feedback: string;
    context: string;
    created: string;
    sourceChannel: string;
  }

  // ============================================
  // Chat Types
  // ============================================

  interface ChatMessage {
    id?: string;
    role: string;
    content: string;
    timestamp: number;
    sessionKey?: string;
    streaming?: boolean;
  }

  // ============================================
  // Library Types
  // ============================================

  interface LibraryFile {
    id: string;
    name: string;
    path: string;
    size?: number;
    type?: string;
    category?: string;
    createdAt?: number;
  }

  // ============================================
  // Schedule Types
  // ============================================

  interface ScheduleItem {
    id: string;
    type: string;
    content: string;
    scheduledFor: string;
    metadata?: Record<string, unknown>;
  }

  // ============================================
  // Search Types
  // ============================================

  interface SearchResult {
    id: string;
    title: string;
    snippet?: string;
    type?: string;
  }

  // ============================================
  // X/Twitter Types
  // ============================================

  interface XTweet {
    id: string;
    text: string;
    authorId?: string;
    createdAt?: string;
  }

  interface XMention {
    id: string;
    text: string;
    authorUsername?: string;
    createdAt?: string;
  }

  // ============================================
  // Message Types
  // ============================================

  interface MessageChat {
    id: string;
    name?: string;
    platform: string;
    lastMessage?: string;
    timestamp?: number;
  }

  // ============================================
  // Email Types
  // ============================================

  interface Email {
    id: string;
    subject: string;
    from: string;
    to?: string;
    body?: string;
    date?: string;
    account?: string;
  }

  // ============================================
  // Calendar Types
  // ============================================

  interface CalendarEvent {
    id: string;
    summary: string;
    title?: string;  // alias for summary in some contexts
    description?: string;
    location?: string;
    account?: string;
    source?: 'google' | 'mission-control';
    start: {
      dateTime?: string;
      date?: string;
      timeZone?: string;
    };
    end?: {
      dateTime?: string;
      date?: string;
      timeZone?: string;
    };
    attendees?: Array<{
      email: string;
      responseStatus: string;
      organizer?: boolean;
    }>;
    conferenceData?: {
      entryPoints?: Array<{
        uri: string;
        entryPointType: string;
      }>;
    };
    colorId?: string;
  }

  interface CalendarCacheEntry {
    key: string;
    age: number;
    valid: boolean;
    eventCount: number;
  }

  interface CalendarCacheStats {
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
    entries: CalendarCacheEntry[];
  }

  // ============================================
  // Session Types
  // ============================================

  interface Session {
    sessionKey: string;
    agentId?: string;
    channel?: string;
    lastMessageAt?: number;
    messageCount?: number;
  }

  interface SessionMessage {
    role: string;
    content: string;
    timestamp: number;
    agentId?: string;
  }

  // ============================================
  // Folder Types
  // ============================================

  interface MessageFolder {
    id: number;
    name: string;
    icon?: string;
    color?: string;
    description?: string;
    sort_order?: number;
    sortOrder?: number;
    is_smart?: number;
    conversation_count?: number;
  }

  interface AssignedFolder extends MessageFolder {
    added_at: string;
    notes?: string;
  }

  interface FolderRule {
    id?: number;
    folderId: number;
    conditions: Array<{
      field: string;
      operator: string;
      value: string;
    }>;
  }

  // ============================================
  // VIP Types
  // ============================================

  interface VIPContact {
    id: number | string;
    identifier: string;
    label?: string;
    type?: string;
    category?: string;
    boost?: number;
    notes?: string;
  }

  // ============================================
  // Snooze Types
  // ============================================

  interface SnoozeEntry {
    sessionKey: string;
    until: string;
    reason?: string;
    snooze_reason?: string;  // alias used in some components
    createdAt?: number;
  }

  // ============================================
  // Starred Types
  // ============================================

  interface StarredMessage {
    id: number;
    messageId: number;
    sessionKey?: string;
    content?: string;
    note?: string;
    category?: string;
    starredAt?: number;
  }

  interface StarredStats {
    total: number;
    byCategory?: Array<{ category: string; count: number }>;
  }

  // ============================================
  // Agent Registry Types
  // ============================================

  interface AgentRegistryEntry {
    id: string;
    name: string;
    role: string;
    description: string;
    color: string;
    image_path: string;
    status: string;
    trust_tier: string;
  }

  // ============================================
  // DM Feed Types
  // ============================================

  interface DMMessage {
    id: number;
    correlation_id: string;
    from_agent: string;
    to_agent: string;
    message_type: string;
    subject: string;
    body: string;
    status: string;
    created_at: number;
    read_at: number | null;
  }

  // ============================================
  // Circuit Breaker Types
  // ============================================

  interface CircuitBreakerStatus {
    state: 'closed' | 'open' | 'half_open';
    consecutive_failures: number;
    last_failure_time: number | null;
    suspended_until: number | null;
    last_state_change: number;
  }

  // ============================================
  // Performance Types
  // ============================================

  interface AgentPerformance {
    agent_id: string;
    status: string;
    success_rate: number;
    avg_completion_hours: number;
    clara_approval_rate: number;
    tokens_per_task: number;
    total_tasks: number;
    total_cost: number;
  }

  interface PerformanceReport {
    days: number;
    agents: AgentPerformance[];
    error?: string;
  }

  // ============================================
  // Audit Types
  // ============================================

  interface AuditTimelineEntry {
    timestamp: string;
    type: 'lifecycle' | 'activity';
    action: string;
    task_id?: string;
    message?: string;
    outcome?: string;
    field?: string;
    from_value?: string;
    to_value?: string;
    changed_by?: string;
    reason?: string;
  }

  interface AgentAudit {
    agent_id: string;
    days: number;
    timeline: AuditTimelineEntry[];
    error?: string;
  }

  // ============================================
  // Widget Types
  // ============================================

  interface WidgetManifest {
    version?: string;
    widgets?: WidgetDefinition[];
    error?: string;
  }

  interface WidgetDefinition {
    id: string;
    name: string;
    component: string;
    permissions: string[];
    panelType: 'dashboard' | 'sidebar' | 'modal';
    icon: string;
    description: string;
  }

  // ============================================
  // Settings Types
  // ============================================

  interface UserSettings {
    theme?: 'light' | 'dark' | 'system';
    notifications?: boolean;
    sidebarCollapsed?: boolean;
    [key: string]: unknown;
  }

  // ============================================
  // Notification Types
  // ============================================

  interface NotificationPrefs {
    // Per-conversation settings
    notification_level?: string;
    sound_enabled?: number;
    sound_type?: string;
    desktop_notifications?: number;
    quiet_hours_enabled?: number;
    quiet_start?: string;
    quiet_end?: string;
    keyword_alerts?: string;
    priority_level?: string;
    notification_frequency?: string;
    show_message_preview?: number;
    badge_count_enabled?: number;
    mute_until?: string | null;
    notes?: string;
    // Global defaults
    default_notification_level?: string;
    default_sound_enabled?: number;
    default_sound_type?: string;
    default_desktop_notifications?: number;
    default_priority_level?: string;
    batch_interval_minutes?: number;
    // Legacy
    enabled?: boolean;
    sound?: boolean;
    desktop?: boolean;
    [key: string]: unknown;
  }

  interface Notification {
    id: string;
    title: string;
    body?: string;
    icon?: string;
    data?: Record<string, unknown>;
  }

  // ============================================
  // Window API
  // ============================================

  interface Window {
    electron?: {
      execute: (command: string) => Promise<{ stdout?: string; stderr?: string; error?: string }>;
    };
    clawdbot?: {
      gateway: {
        status: () => Promise<unknown>;
        sessions: () => Promise<unknown>;
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
        update: (taskId: string, updates: { status?: string; assignedTo?: string; reviewStatus?: string; priority?: string; title?: string; description?: string }) => Promise<{ success: boolean }>;
        list: (status?: string) => Promise<{ success: boolean; tasks: Task[] }>;
        start: (taskId: string) => Promise<{ success: boolean }>;
        complete: (taskId: string, outcome?: string) => Promise<{ success: boolean }>;
        // Poke Brain for status update
        poke: (taskId: string, title: string) => Promise<{ success: boolean; message?: string; error?: string }>;
        pokeInternal: (taskId: string, title: string) => Promise<{ success: boolean; sessionKey?: string; response?: string; error?: string }>;
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
        // Task attachments
        attachments?: {
          list: (taskId: string) => Promise<{ success: boolean; attachments: unknown[] }>;
          listAll: () => Promise<{ success: boolean; attachments: unknown[] }>;
          add: (taskId: string, filePath: string, category?: string, uploadedBy?: string) => Promise<{ success: boolean }>;
          delete: (attachmentId: number) => Promise<{ success: boolean }>;
          open: (filePath: string) => Promise<{ success: boolean }>;
          autoDetect: (taskId: string) => Promise<{ success: boolean }>;
        };
      };
      // Rejection logging
      rejections: {
        log: (rejection: { type: string; title: string; content?: string; reason?: string }) => Promise<{ success: boolean }>;
      };
      // Inbox (froggo-db backed)
      inbox: {
        list: (status?: string) => Promise<{ success: boolean; items: InboxItem[] }>;
        add: (item: { type: string; title: string; content: string; context?: string; channel?: string }) => Promise<{ success: boolean }>;
        // Add with custom metadata (for Stage 2 email items)
        addWithMetadata: (item: { type: string; title: string; content: string; context?: string; channel?: string; metadata?: string }) => Promise<{ success: boolean; error?: string }>;
        update: (id: number, updates: { status?: string; feedback?: string }) => Promise<{ success: boolean }>;
        approveAll: () => Promise<{ success: boolean; count?: number }>;
        // Revision handlers for 'needs-revision' items
        listRevisions: () => Promise<{ success: boolean; items: RevisionItem[] }>;
        submitRevision: (originalId: number, revisedContent: string, revisedTitle?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
        getRevisionContext: (itemId: number) => Promise<{ success: boolean; item?: RevisionItem; error?: string }>;
        onUpdate: (callback: (data: { newItems?: number; revision?: boolean; originalId?: number }) => void) => () => void;
      };
      // Execution
      execute: {
        tweet: (content: string, taskId?: string) => Promise<{ success: boolean; output?: string; error?: string }>;
      };
      // Chat message persistence
      chat: {
        saveMessage: (msg: ChatMessage) => Promise<{ success: boolean }>;
        loadMessages: (limit?: number, sessionKey?: string) => Promise<{ success: boolean; messages: ChatMessage[] }>;
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
        exec: (query: string, params?: unknown[]) => Promise<{ success: boolean; result?: unknown[]; error?: string }>;
        query: (query: string, params?: unknown[]) => Promise<{ success: boolean; rows?: unknown[]; error?: string }>;
      };
      // Skills (agent_skills table)
      skills?: {
        list: () => Promise<{ success: boolean; skills: Array<{
          agent_id: string;
          skill_name: string;
          proficiency: number;
          success_count: number;
          failure_count: number;
          last_used: string | null;
          notes: string | null;
          agent_name: string | null;
          agent_emoji: string | null;
        }> }>;
      };
      // Library
      library: {
        list: (category?: string) => Promise<{ success: boolean; files: LibraryFile[] }>;
        upload: () => Promise<{ success: boolean; file?: LibraryFile; error?: string }>;
        delete: (fileId: string) => Promise<{ success: boolean }>;
        link: (fileId: string, taskId: string) => Promise<{ success: boolean }>;
        view: (fileId: string) => Promise<{ success: boolean; viewType?: string; content?: string; path?: string; error?: string }>;
        download: (fileId: string) => Promise<{ success: boolean; path?: string; error?: string }>;
        update: (fileId: string, updates: { category?: string; tags?: string[]; project?: string | null }) => Promise<{ success: boolean; error?: string }>;
        uploadBuffer: (file: { name: string; type: string; buffer: ArrayBuffer | string | null }) => Promise<{ success: boolean; error?: string }>;
      };
      // Shell helpers
      shell?: {
        openPath: (path: string) => void;
      };
      // Screenshot
      screenshot: {
        capture: (outputPath: string) => Promise<{ success: boolean; path?: string; size?: number }>;
        navigate: (view: string) => Promise<{ success: boolean }>;
      };
      // Schedule
      schedule: {
        list: () => Promise<{ success: boolean; items: ScheduleItem[] }>;
        add: (item: { type: string; content: string; scheduledFor: string; metadata?: Record<string, unknown> }) => Promise<{ success: boolean; id?: string }>;
        update: (id: string, item: { type?: string; content?: string; scheduledFor?: string; metadata?: Record<string, unknown> }) => Promise<{ success: boolean }>;
        cancel: (id: string) => Promise<{ success: boolean }>;
        sendNow: (id: string) => Promise<{ success: boolean }>;
      };
      // Search
      search: {
        local: (query: string) => Promise<{ success: boolean; results: SearchResult[] }>;
        discord: (query: string) => Promise<{ success: boolean; messages: unknown[] }>;
        telegram: (query: string) => Promise<{ success: boolean; messages: unknown[] }>;
        whatsapp: (query: string) => Promise<{ success: boolean; messages: unknown[] }>;
      };
      // System status
      system: {
        status: () => Promise<{ success: boolean; status: Record<string, unknown> }>;
      };
      // Settings
      settings: {
        get: () => Promise<{ success: boolean; settings: UserSettings }>;
        save: (settings: UserSettings) => Promise<{ success: boolean }>;
        getApiKey: (keyName: string) => Promise<string | null>;
        storeApiKey: (keyName: string, value: string) => Promise<{ success: boolean; error?: string }>;
        hasApiKey: (keyName: string) => Promise<boolean>;
        deleteApiKey: (keyName: string) => Promise<{ success: boolean; error?: string }>;
      };
      // X (bird CLI)
      twitter: {
        mentions: () => Promise<{ success: boolean; mentions?: XMention[]; raw?: string }>;
        home: (limit?: number) => Promise<{ success: boolean; tweets?: XTweet[]; raw?: string }>;
        queuePost: (text: string, context?: string) => Promise<{ success: boolean; message?: string }>;
      };
      // Messages (wacli)
      messages: {
        recent: (limit?: number) => Promise<{ success: boolean; chats: MessageChat[] }>;
        unread: () => Promise<{ success: boolean; count: number; byPlatform?: { [platform: string]: number } }>;
      };
      // Email (gog CLI)
      email: {
        unread: (account?: string) => Promise<{ success: boolean; emails: Email[]; account?: string }>;
        search: (query: string, account?: string) => Promise<{ success: boolean; emails: Email[]; account?: string }>;
        queueSend: (to: string, subject: string, body: string, account?: string) => Promise<{ success: boolean; message?: string }>;
        // Direct send (Stage 2 email workflow)
        send: (options: { to: string; subject: string; body: string; account?: string }) => Promise<{ success: boolean; output?: string; error?: string }>;
      };
      // Calendar (gog CLI + aggregation service)
      calendar: {
        events: (account?: string, days?: number) => Promise<{ success: boolean; events: CalendarEvent[]; account?: string }>;
        today: () => Promise<{ success: boolean; events: CalendarEvent[]; account?: string }>;
        // Calendar aggregation service
        aggregate: (options?: {
          days?: number;
          includeGoogle?: boolean;
          includeMissionControl?: boolean;
          accounts?: string[];
        }) => Promise<{
          success: boolean;
          events: CalendarEvent[];
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
          stats?: CalendarCacheStats;
          error?: string;
        }>;
      };
      // Sessions management
      sessions: {
        list: () => Promise<{ success: boolean; sessions: Session[] }>;
        history: (sessionKey: string, limit?: number) => Promise<{ success: boolean; messages: SessionMessage[] }>;
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
        list: () => Promise<{ success: boolean; folders: MessageFolder[]; error?: string }>;
        create: (folder: { name: string; icon?: string; color?: string; description?: string }) => Promise<{ success: boolean; folder?: MessageFolder; error?: string }>;
        update: (folderId: number, updates: { name?: string; icon?: string; color?: string; description?: string; sort_order?: number }) => Promise<{ success: boolean; error?: string }>;
        delete: (folderId: number) => Promise<{ success: boolean; error?: string }>;
        assign: (folderId: number, sessionKey: string, notes?: string) => Promise<{ success: boolean; error?: string }>;
        unassign: (folderId: number, sessionKey: string) => Promise<{ success: boolean; error?: string }>;
        forConversation: (sessionKey: string) => Promise<{ success: boolean; folders: AssignedFolder[]; error?: string }>;
        conversations: (folderId: number) => Promise<{ success: boolean; conversations: unknown[]; error?: string }>;
        rules: {
          get: (folderId: number) => Promise<{ success: boolean; rule?: FolderRule; error?: string }>;
          save: (folderId: number, rule: FolderRule) => Promise<{ success: boolean; error?: string }>;
          delete: (folderId: number) => Promise<{ success: boolean; error?: string }>;
        };
      };
      // Conversations
      conversations: {
        archive: (sessionKey: string) => Promise<{ success: boolean; error?: string }>;
        unarchive: (sessionKey: string) => Promise<{ success: boolean; error?: string }>;
        archived: () => Promise<{ success: boolean; conversations: unknown[]; error?: string }>;
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
        get: (sessionKey: string) => Promise<{ success: boolean; settings?: NotificationPrefs; error?: string }>;
        set: (sessionKey: string, settings: NotificationPrefs) => Promise<{ success: boolean; error?: string }>;
        delete: (sessionKey: string) => Promise<{ success: boolean; error?: string }>;
        getEffective: (sessionKey: string) => Promise<{ success: boolean; settings?: NotificationPrefs; error?: string }>;
        getGlobalDefaults: () => Promise<{ success: boolean; defaults?: NotificationPrefs; error?: string }>;
        setGlobalDefaults: (defaults: NotificationPrefs) => Promise<{ success: boolean; error?: string }>;
        muteConversation: (sessionKey: string, until?: string) => Promise<{ success: boolean; error?: string }>;
        unmuteConversation: (sessionKey: string) => Promise<{ success: boolean; error?: string }>;
      };
      // VIP contacts
      vip: {
        list: (category?: string) => Promise<VIPContact[]>;
        add: (vip: { identifier: string; label?: string; type?: string; category?: string; boost?: number; notes?: string }) => Promise<{ success: boolean; error?: string }>;
        update: (id: number | string, updates: { label?: string; boost?: number; category?: string; notes?: string }) => Promise<{ success: boolean; error?: string }>;
        remove: (id: number | string) => Promise<{ success: boolean; error?: string }>;
      };
      // Snooze conversations
      snooze: {
        list: () => Promise<{ success: boolean; snoozes?: SnoozeEntry[]; error?: string }>;
        get: (sessionKey: string) => Promise<{ success: boolean; snooze?: SnoozeEntry; error?: string }>;
        set: (sessionKey: string, until: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
        unset: (sessionKey: string) => Promise<{ success: boolean; error?: string }>;
      };
      // Froggo DB direct queries
      froggo: {
        query: (sql: string, params?: unknown[]) => Promise<{ success: boolean; rows?: unknown[]; error?: string }>;
      };
      // System notifications
      notifications: {
        getPrefs: () => Promise<NotificationPrefs>;
        updatePrefs: (updates: NotificationPrefs) => Promise<void>;
        send: (options: Notification) => Promise<void>;
        test: () => Promise<void>;
        onReceived: (callback: (notification: Notification) => void) => () => void;
        onAction: (callback: (action: { action: string; notificationId: string }) => void) => () => void;
      };
      // Navigation
      onNavigate: (callback: (view: string, data?: unknown) => void) => () => void;
      // Starred messages
      starred: {
        star: (messageId: number, note?: string, category?: string) => Promise<{ success: boolean; error?: string }>;
        unstar: (identifier: number) => Promise<{ success: boolean; error?: string }>;
        list: (options?: { category?: string; sessionKey?: string; limit?: number }) => Promise<{ success: boolean; starred: StarredMessage[]; error?: string }>;
        search: (query: string, limit?: number) => Promise<{ success: boolean; results: StarredMessage[]; error?: string }>;
        stats: () => Promise<{ success: boolean; stats: StarredStats }>;
        check: (messageId: number) => Promise<{ success: boolean; isStarred: boolean }>;
      };
      // Agent registry (dynamic agent loading)
      getAgentRegistry: () => Promise<AgentRegistryEntry[]>;
      // DM Feed & Circuit Breakers
      getDMHistory: (args?: { limit?: number; agent?: string }) => Promise<DMMessage[]>;
      getCircuitStatus: () => Promise<Record<string, CircuitBreakerStatus>>;
      // Agent performance & governance
      getPerformanceReport: (days: number) => Promise<PerformanceReport>;
      getAgentAudit: (agentId: string, days: number) => Promise<AgentAudit>;
      // Widget API - dynamic agent widget loading
      widgetAPI?: {
        scanManifest: (agentId: string) => Promise<WidgetManifest>;
      };
      // Toolbar pop-out API
      toolbar?: {
        popOut: (data?: { x?: number; y?: number; width?: number; height?: number }) => Promise<{ success: boolean; error?: string }>;
        popIn: () => Promise<{ success: boolean; error?: string }>;
        getState: () => Promise<{ poppedOut: boolean; windowId?: number }>;
        onClosed: (callback: () => void) => () => void;
        onPoppedIn: (callback: () => void) => () => void;
      };
      // Finance API
      finance?: {
        triggerAnalysis: (options: { daysBack?: number; focus?: string }) => Promise<{ success: boolean; error?: string }>;
        dismissInsight: (insightId: string) => Promise<{ success: boolean; error?: string }>;
        getTransactions: (limit?: number) => Promise<{ success: boolean; transactions?: unknown[]; error?: string }>;
        getBudgetStatus: (budgetType: 'family' | 'crypto') => Promise<{ success: boolean; status?: unknown; error?: string }>;
        uploadCSV: (csvContent: string, filename: string) => Promise<{ success: boolean; imported?: number; skipped?: number; error?: string }>;
        uploadPDF: (pdfBuffer: ArrayBuffer, filename: string) => Promise<{ success: boolean; message?: string; error?: string }>;
        createBudget: (data: { name: string; budgetType: string; totalBudget: number; currency?: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
        getAlerts: () => Promise<{ success: boolean; alerts?: unknown[]; error?: string }>;
        getInsights: () => Promise<{ success: boolean; insights?: unknown[]; error?: string }>;
      };
      // Finance Agent
      financeAgent?: {
        sendMessage: (message: string, context?: unknown) => Promise<{ success: boolean; response?: string; error?: string }>;
        getChatHistory: () => Promise<{ success: boolean; history?: unknown[]; error?: string }>;
        clearHistory: () => Promise<{ success: boolean; error?: string }>;
        triggerAnalysis: (analysisType?: 'csv_upload' | 'manual') => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<{ success: boolean; status?: unknown; error?: string }>;
      };
      // HR Reports
      hrReports?: {
        list: () => Promise<{ success: boolean; files?: string[]; error?: string }>;
        read: (filename: string) => Promise<{ success: boolean; content?: string; error?: string }>;
      };
      // X Automations
      xAutomations?: {
        list: () => Promise<{ success: boolean; automations?: unknown[]; error?: string }>;
        get: (id: string) => Promise<{ success: boolean; automation?: unknown; error?: string }>;
        create: (automation: {
          name: string;
          description?: string;
          trigger_type: string;
          trigger_config: string;
          conditions?: string;
          actions: string;
          max_executions_per_hour?: number;
          max_executions_per_day?: number;
        }) => Promise<{ success: boolean; id?: string; error?: string }>;
        update: (id: string, updates: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
        delete: (id: string) => Promise<{ success: boolean; error?: string }>;
        toggle: (id: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>;
        executions: (automationId?: string, limit?: number) => Promise<{ success: boolean; executions?: unknown[]; error?: string }>;
        rateLimit: (automationId: string) => Promise<{ success: boolean; rateLimit?: unknown; error?: string }>;
      };
      // X Research
      xResearch?: {
        propose: (data: { title: string; description: string; citations: string[]; proposedBy: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
        list: (filters?: { status?: string; limit?: number }) => Promise<{ success: boolean; ideas?: unknown[]; error?: string }>;
        approve: (data: { id: string; approvedBy: string }) => Promise<{ success: boolean; error?: string }>;
        reject: (data: { id: string; reason?: string }) => Promise<{ success: boolean; error?: string }>;
      };
      // X Plan
      xPlan?: {
        create: (data: { researchIdeaId: string; title: string; contentType: string; threadLength: number; description: string; proposedBy: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
        list: (filters?: { status?: string; contentType?: string; limit?: number }) => Promise<{ success: boolean; plans?: unknown[]; error?: string }>;
        approve: (data: { id: string; approvedBy: string }) => Promise<{ success: boolean; error?: string }>;
        reject: (data: { id: string; reason?: string }) => Promise<{ success: boolean; error?: string }>;
      };
      // X Draft
      xDraft?: {
        create: (data: { planId: string; version: string; content: string; mediaUrls?: string[]; proposedBy: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
        list: (filters?: { status?: string; planId?: string; limit?: number }) => Promise<{ success: boolean; drafts?: unknown[]; error?: string }>;
        approve: (data: { id: string; approvedBy: string }) => Promise<{ success: boolean; error?: string }>;
        reject: (data: { id: string; reason?: string }) => Promise<{ success: boolean; error?: string }>;
        pickImage: () => Promise<{ success: boolean; filePaths: string[] }>;
      };
      // X Schedule
      xSchedule?: {
        create: (data: { draftId: string; scheduledFor: number; timeSlotReason?: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
        list: (filters?: { status?: string; dateFrom?: number; dateTo?: number; limit?: number }) => Promise<{ success: boolean; scheduled?: unknown[]; error?: string }>;
        update: (data: { id: string; scheduledFor?: number; status?: string }) => Promise<{ success: boolean; error?: string }>;
        delete: (data: { id: string }) => Promise<{ success: boolean; error?: string }>;
      };
      // Simple scheduled posts
      xScheduled?: {
        schedule: (text: string, scheduledTime: number) => Promise<{ success: boolean; id?: string; error?: string }>;
        list: () => Promise<{ success: boolean; scheduled?: unknown[]; error?: string }>;
        cancel: (id: string) => Promise<{ success: boolean; error?: string }>;
      };
      // X Mention
      xMention?: {
        fetch: () => Promise<{ success: boolean; count?: number; error?: string }>;
        list: (filters?: { replyStatus?: string; limit?: number; offset?: number }) => Promise<{ success: boolean; mentions?: unknown[]; error?: string }>;
        update: (data: { id: string; replyStatus?: string; repliedAt?: number; repliedWithId?: string; notes?: string }) => Promise<{ success: boolean; error?: string }>;
        reply: (data: { mentionId: string; replyText: string; tweetId: string }) => Promise<{ success: boolean; tweetId?: string; error?: string }>;
      };
      // X Reply Guy
      xReplyGuy?: {
        listHotMentions: (filters?: { minLikes?: number; minRetweets?: number; limit?: number }) => Promise<{ success: boolean; mentions?: unknown[]; error?: string }>;
        createQuickDraft: (data: { mentionId: string; replyText: string; fastTrack?: boolean }) => Promise<{ success: boolean; draftId?: string; error?: string }>;
        postNow: (data: { draftId: string }) => Promise<{ success: boolean; tweetId?: string; error?: string }>;
      };
      // Reddit Monitor
      xReddit?: {
        createMonitor: (data: { productUrl: string; keywords: string; subreddits: string }) => Promise<{ success: boolean; monitorId?: string; error?: string }>;
        listMonitors: () => Promise<{ success: boolean; monitors?: unknown[]; error?: string }>;
        fetch: () => Promise<{ success: boolean; count?: number; error?: string }>;
        listThreads: (filters?: { status?: string; limit?: number; offset?: number }) => Promise<{ success: boolean; threads?: unknown[]; error?: string }>;
        generateDraft: (data: { threadId: string; threadTitle: string; threadText: string; subreddit: string }) => Promise<{ success: boolean; draft?: string; error?: string }>;
        saveDraft: (data: { threadId: string; replyText: string }) => Promise<{ success: boolean; error?: string }>;
        postReply: (data: { threadId: string; replyText: string }) => Promise<{ success: boolean; commentId?: string; error?: string }>;
        updateThread: (data: { threadId: string; status: string }) => Promise<{ success: boolean; error?: string }>;
      };
      // X Publishing — OAuth 1.0a write operations via x-api CLI
      xPublish?: {
        post: (text: string) => Promise<{ success: boolean; tweetId?: string; error?: string }>;
        thread: (tweets: string[]) => Promise<{ success: boolean; tweetId?: string; threadIds?: string[]; error?: string }>;
        rateLimit: () => Promise<{ remaining: number; used: number; limit: number; resetAt: number | null }>;
      };
      // X API v2 - Direct API access
      x?: {
        search: (query: string, count?: number) => Promise<{ success: boolean; tweets?: unknown[]; error?: string }>;
        like: (tweetId: string) => Promise<{ success: boolean; error?: string }>;
        unlike: (tweetId: string) => Promise<{ success: boolean; error?: string }>;
        retweet: (tweetId: string) => Promise<{ success: boolean; error?: string }>;
        unretweet: (tweetId: string) => Promise<{ success: boolean; error?: string }>;
        follow: (username: string) => Promise<{ success: boolean; error?: string }>;
        unfollow: (username: string) => Promise<{ success: boolean; error?: string }>;
        profile: (username: string) => Promise<{ success: boolean; profile?: unknown; error?: string }>;
        post: (text: string, options?: { replyTo?: string; quote?: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
        delete: (tweetId: string) => Promise<{ success: boolean; error?: string }>;
        dm: (participantId: string, text: string) => Promise<{ success: boolean; error?: string }>;
        home: (limit?: number) => Promise<{ success: boolean; tweets?: unknown[]; error?: string }>;
        followers: (username?: string, count?: number) => Promise<{ success: boolean; followers?: unknown[]; error?: string }>;
        following: (username?: string, count?: number) => Promise<{ success: boolean; following?: unknown[]; error?: string }>;
      };
      // Writing Module
      writing?: {
        project: {
          list: () => Promise<{ success: boolean; projects?: unknown[]; error?: string }>;
          create: (title: string, type: string) => Promise<{ success: boolean; id?: string; error?: string }>;
          get: (id: string) => Promise<{ success: boolean; project?: unknown; error?: string }>;
          update: (id: string, updates: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
          delete: (id: string) => Promise<{ success: boolean; error?: string }>;
        };
        chapter?: {
          list: (projectId: string) => Promise<{ success: boolean; chapters?: unknown[]; error?: string }>;
          create: (projectId: string, data: Record<string, unknown>) => Promise<{ success: boolean; id?: string; error?: string }>;
          get: (id: string) => Promise<{ success: boolean; chapter?: unknown; error?: string }>;
          update: (id: string, updates: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
          delete: (id: string) => Promise<{ success: boolean; error?: string }>;
          reorder: (projectId: string, ids: string[]) => Promise<{ success: boolean; error?: string }>;
        };
      };
    };
  }
}
