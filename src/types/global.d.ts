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

  type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done' | 'internal-review' | 'blocked' | 'human-review' | 'failed' | 'cancelled';
  type TaskPriority = 'p0' | 'p1' | 'p2' | 'p3';

  interface Task {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
    project?: string;
    assignedTo?: string;
    priority?: TaskPriority | string;
    createdAt?: number;
    updatedAt?: number;
    completedAt?: number;
    dueDate?: string;
    subtasks?: SubtaskData[];
    tags?: string[];
    planningNotes?: string;
  }

  // Subtask type used by task detail components
  interface Subtask {
    id: string;
    title: string;
    description?: string;
    completed: boolean;
    completedAt?: number;
    completedBy?: string;
    assignedTo?: string;
    position?: number;
  }

  // ============================================
  // Task Attachment Types
  // ============================================

  interface TaskAttachment {
    id: number;
    taskId: string;
    filePath: string;
    fileName?: string;
    category?: string;
    uploadedBy?: string;
    createdAt?: number;
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
    starred?: boolean;
    isRead?: boolean;
    tags?: string[];
    project?: string;
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
    channel?: string;     // 'dashboard' | 'xtwitter' | 'voice' | 'toolbar' | 'poke'
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

  interface ScheduledItem extends ScheduleItem {
    status?: string;
    platform?: string;
  }

  // ============================================
  // Search Types
  // ============================================

  interface SearchResult {
    id: string;
    title: string;
    snippet?: string;
    type?: string;
    source?: string;
    status?: string;
    timestamp?: string;
    relevance_score?: number;
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
    likes?: number;
    retweets?: number;
    replyStatus?: string;
  }

  type XTab = 'publish' | 'research' | 'plan' | 'drafts' | 'schedule' | 'analytics' | 'mentions' | 'replyGuy' | 'automations' | 'reddit' | 'campaigns';

  // X Content Pipeline Types
  interface ResearchIdea {
    id: string;
    title: string;
    description: string;
    citations: string[];
    status: string;
    proposedBy: string;
    createdAt?: number;
  }

  interface ContentPlan {
    id: string;
    researchIdeaId: string;
    title: string;
    contentType: string;
    threadLength: number;
    description: string;
    status: string;
    proposedBy: string;
    createdAt?: number;
  }

  // X Automation Types
  interface XAutomation {
    id: string;
    name: string;
    description?: string;
    trigger_type: string;
    trigger_config: string;
    conditions?: string;
    actions: string;
    enabled: boolean;
    max_executions_per_hour?: number;
    max_executions_per_day?: number;
    created_at?: number;
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
    unread?: number;
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
    threads?: Email[];
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

  interface SnoozeData {
    sessionKey: string;
    until: string;
    reason?: string;
    snooze_reason?: string;
    createdAt?: number;
  }

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
  // Knowledge Types
  // ============================================

  interface KnowledgeItem {
    id: number;
    publisher_agent: string;
    knowledge_type: 'finding' | 'lesson' | 'warning' | 'pattern';
    topic: string;
    body: string;
    task_id: string | null;
    tags: string | null;  // JSON array string
    confidence: number;
    created_at: number;
  }

  interface KnowledgeStats {
    total: number;
    byType: Array<{ knowledge_type: string; count: number }>;
    byAgent: Array<{ publisher_agent: string; count: number }>;
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
  // Finance Account type (used by Window.clawdbot.finance.account.*)
  interface FinanceAccount {
    id: string;
    name: string;
    type: 'bank' | 'crypto_wallet' | 'credit_card' | 'cash';
    currency: string;
    balance?: number;
    archived?: number;
    created_at: number;
    updated_at: number;
  }

  // Finance Recurring type (used by Window.clawdbot.finance.recurring.*)
  interface FinanceRecurring {
    id: string;
    account_id: string | null;
    description: string;
    normalized_merchant: string;
    amount: number;
    currency: string;
    frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual';
    confidence: number;
    next_expected_date: number | null;
    status: 'pending' | 'confirmed' | 'dismissed';
    detected_at: number;
    updated_at: number;
    dismissed_at?: number | null;
    dismissed_count?: number;
  }

  interface FinanceCategoryBreakdownRow {
    category: string;
    total: number;
    count: number;
  }

  interface FinanceCategoryCorrection {
    id: string;
    transaction_id: string;
    old_category: string | null;
    new_category: string;
    merchant_normalized: string | null;
    corrected_at: number;
  }

  interface FinanceScenario {
    id: string;
    name: string;
    description: string | null;
    base_account_id: string | null;
    income_adjustments: string; // JSON array
    expense_adjustments: string; // JSON array
    one_time_events: string; // JSON array
    projection_months: number;
    created_at: number;
    updated_at: number;
  }

  interface FinanceProjectionMonth {
    month: number;
    income: number;
    expenses: number;
    oneTime: number;
    net: number;
    runningBalance: number;
  }

  // Finance Insight type
  interface Insight {
    id: string;
    type: string;
    title: string;
    description: string;
    severity?: string;
    dismissed?: boolean;
    created_at?: number;
  }

  // ============================================
  // System Status Types
  // ============================================

  interface SystemStatus {
    gateway?: string;
    database?: string;
    agents?: string;
    [key: string]: unknown;
  }

  // ============================================
  // Agent Skill Types
  // ============================================

  interface AgentSkill {
    agent_id: string;
    skill_name: string;
    proficiency: number;
    success_count: number;
    failure_count: number;
    last_used: string | null;
    notes: string | null;
    agent_name: string | null;
    agent_emoji: string | null;
  }

  // ============================================
  // Training Log Types
  // ============================================

  interface TrainingEntry {
    id: number;
    agent_id: string;
    skill_name: string;
    date: string;
    notes?: string;
  }

  // ============================================
  // DB Result row type (for db.exec / db.query results)
  // ============================================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface DbRow {
    [key: string]: any;
  }

  // ============================================
  // Conversation Item (unified for inbox)
  // ============================================

  interface ConversationItem {
    id: string;
    name?: string;
    platform: string;
    lastMessage?: string;
    timestamp?: number;
    unread?: number;
    [key: string]: unknown;
  }

  // ============================================
  // Exec result type (from shell-security.ts WrappedExecResult)
  // ============================================

  interface ExecResult {
    success: boolean;
    stdout: string;
    stderr: string;
    blocked?: boolean;
    reason?: string;
    error?: string;
    message?: string;
    output?: string;
    content?: string;
  }

  // Window API
  // ============================================

  interface Window {
    electron?: {
      execute: (command: string) => Promise<{ stdout?: string; stderr?: string; error?: string }>;
    };
    clawdbot: {
      // App lifecycle events
      app: {
        onClosing: (callback: () => void) => () => void;
        restart?: () => void;
      };
      gateway: {
        status: () => Promise<{ success: boolean; status?: any; error?: string }>;
        sessions: () => Promise<{ success: boolean; sessions?: any[]; error?: string }>;
        onBroadcast: (callback: (event: { type: string; event: string; payload: any }) => void) => () => void;
        getToken: () => Promise<string>;
        request?: (method: string, params?: Record<string, unknown>) => Promise<any>;
        getSessionKey?: () => Promise<string>;
        sessionsList?: (activeMinutes?: number) => Promise<{ success: boolean; sessions?: any[]; error?: string }>;
      };
      sessions: {
        list: (activeMinutes?: number) => Promise<{ success: boolean; sessions?: any[]; error?: string }>;
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
      // API keys (legacy)
      getOpenAIKey: () => Promise<string | null>;
      // Task sync to froggo-db
      tasks: {
        sync: (task: { id: string; title: string; status: string; project?: string; assignedTo?: string; description?: string }) => Promise<{ success: boolean; error?: string }>;
        update: (taskId: string, updates: { status?: string; assignedTo?: string; reviewStatus?: string; priority?: string; title?: string; description?: string; planningNotes?: string }) => Promise<{ success: boolean; error?: string }>;
        list: (status?: string) => Promise<{ success: boolean; tasks: Task[]; totalDone?: number; totalArchived?: number }>;
        start: (taskId: string) => Promise<{ success: boolean; error?: string }>;
        complete: (taskId: string, outcome?: string) => Promise<{ success: boolean; error?: string }>;
        delete: (taskId: string) => Promise<{ success: boolean; error?: string }>;
        archiveDone: () => Promise<{ success: boolean; count?: number; error?: string }>;
        // Poke Brain for status update
        poke: (taskId: string, title: string) => Promise<{ success: boolean; message?: string; error?: string }>;
        pokeInternal: (taskId: string, title: string) => Promise<{ success: boolean; sessionKey?: string; response?: string; error?: string }>;
        // Multi-stage / Fork operations
        fork: (parentTaskId: string, data: { title: string; description?: string; assignedTo?: string; priority?: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
        children: (taskId: string) => Promise<{ success: boolean; children: Array<{ id: string; title: string; status: string; stage_number?: number; stage_name?: string }> }>;
        parent: (taskId: string) => Promise<{ success: boolean; parent?: { id: string; title: string; status: string } }>;
        // Real-time task notification listener
        onNotification: (callback: (notification: { event: string; task_id: string; title: string; project: string; timestamp: number }) => void) => () => void;
        // Subtask operations
        subtasks: {
          list: (taskId: string) => Promise<{ success: boolean; subtasks: SubtaskData[] }>;
          add: (taskId: string, subtask: { id: string; title: string; description?: string; assignedTo?: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
          update: (subtaskId: string, updates: { completed?: boolean; completedBy?: string; title?: string; assignedTo?: string }) => Promise<{ success: boolean; error?: string }>;
          delete: (subtaskId: string) => Promise<{ success: boolean; error?: string }>;
          reorder: (subtaskIds: string[]) => Promise<{ success: boolean; error?: string }>;
        };
        // Activity log operations
        activity: {
          list: (taskId: string, limit?: number) => Promise<{ success: boolean; activities: ActivityData[] }>;
          add: (taskId: string, entry: { action: string; message: string; agentId?: string; details?: string }) => Promise<{ success: boolean; error?: string }>;
        };
        // Task attachments
        attachments?: {
          list: (taskId: string) => Promise<{ success: boolean; attachments: TaskAttachment[] }>;
          listAll: () => Promise<{ success: boolean; attachments: TaskAttachment[] }>;
          add: (taskId: string, filePath: string, category?: string, uploadedBy?: string) => Promise<{ success: boolean; attachment?: TaskAttachment; error?: string }>;
          delete: (attachmentId: number) => Promise<{ success: boolean; error?: string }>;
          open: (filePath: string) => Promise<{ success: boolean; error?: string }>;
          autoDetect: (taskId: string) => Promise<{ success: boolean; error?: string }>;
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
        getThread: (threadId: string) => Promise<{ success: boolean; items: InboxItem[]; error?: string }>;
        onUpdate: (callback: (data: { newItems?: number; revision?: boolean; originalId?: number }) => void) => () => void;
        // Filter and search operations
        toggleStar: (messageId: string) => Promise<{ success: boolean; is_starred?: boolean; error?: string }>;
        markRead: (messageId: string, isRead?: boolean) => Promise<{ success: boolean; error?: string }>;
        addTag: (messageId: string, tag: string) => Promise<{ success: boolean; error?: string }>;
        removeTag: (messageId: string, tag: string) => Promise<{ success: boolean; error?: string }>;
        setProject: (messageId: string, project: string) => Promise<{ success: boolean; error?: string }>;
        search: (query: string, limit?: number) => Promise<{ success: boolean; items: InboxItem[]; error?: string }>;
        filter: (criteria: any) => Promise<{ success: boolean; items: InboxItem[]; error?: string }>;
        getSuggestions: (type: 'senders' | 'projects' | 'tags' | 'platforms') => Promise<{ success: boolean; suggestions: string[]; error?: string }>;
        checkHistory: () => Promise<{ success: boolean; error?: string }>;
        triggerBackfill: (days?: number) => Promise<{ success: boolean; error?: string }>;
      };
      // Execution
      execute: {
        tweet: (content: string, taskId?: string) => Promise<{ success: boolean; output?: string; error?: string }>;
      };
      // AI Content Generation
      ai: {
        generateContent: (prompt: string, type: 'ideas' | 'draft' | 'cleanup' | 'chat') => Promise<{ success: boolean; content?: string; error?: string }>;
        generateReply: (context: {
          threadMessages: Array<{ role: string; content: string }>;
          platform?: string;
          recipientName?: string;
          subject?: string;
          tone?: 'formal' | 'casual' | 'auto';
          calendarContext?: string;
          taskContext?: string;
        }) => Promise<{ success: boolean; reply?: string; draft?: any; error?: string }>;
        analyzeMessages: (ids: string[]) => Promise<{ success: boolean; analysis?: any; error?: string }>;
        getAnalysis: (id: string, platform: string) => Promise<{ success: boolean; analysis?: any; error?: string }>;
        createDetectedTask: (task: { title: string; description?: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
        createDetectedEvent: (event: { title: string; date: string; time?: string; duration?: string; location?: string; description?: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
      };
      // Chat message persistence
      chat: {
        saveMessage: (msg: ChatMessage) => Promise<{ success: boolean }>;
        loadMessages: (limit?: number, sessionKey?: string, channel?: string) => Promise<{ success: boolean; messages: ChatMessage[] }>;
        clearMessages: (sessionKey?: string, channel?: string) => Promise<{ success: boolean }>;
        suggestReplies: (context: { role: string; content: string }[]) => Promise<{ success: boolean; suggestions: string[]; error?: string }>;
        recent: (limit?: number) => Promise<{ success: boolean; messages: ChatMessage[] }>;
      };
      // Filesystem
      fs: {
        writeBase64: (path: string, base64: string) => Promise<{ success: boolean; path?: string }>;
        readFile: (path: string, encoding?: string) => Promise<{ success: boolean; content?: string; error?: string }>;
        append: (path: string, content: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      };
      // Database
      db: {
        exec: (query: string, params?: unknown[]) => Promise<{ success: boolean; result?: DbRow[]; error?: string }>;
        query: (query: string, params?: unknown[]) => Promise<{ success: boolean; rows?: DbRow[]; error?: string }>;
      };
      // Media uploads
      media: {
        upload: (fileName: string, base64Data: string) => Promise<{ success: boolean; path?: string; fileName?: string; size?: number; error?: string }>;
        delete: (filePath: string) => Promise<{ success: boolean; error?: string }>;
        cleanup: () => Promise<{ success: boolean; deletedCount?: number; error?: string }>;
        request?: (type: string) => Promise<{ success: boolean; error?: string }>;
      };
      // Screen capture (for screen sharing in Electron)
      screenCapture: {
        getSources: (opts?: { types?: string[]; thumbnailSize?: { width: number; height: number } }) => Promise<{ success: boolean; sources?: unknown[]; error?: string }>;
      };
      // Media permissions (camera, mic, screen)
      mediaPermissions: {
        check: () => Promise<{ camera: string | boolean; microphone: string | boolean; screen: string | boolean }>;
        request: (mediaType: 'camera' | 'microphone') => Promise<{ success: boolean; error?: string }>;
      };
      // Skills (agent_skills table)
      skills?: {
        list: () => Promise<{ success: boolean; skills: AgentSkill[] }>;
      };
      // Library
      library: {
        list: (category?: string) => Promise<{ success: boolean; files: LibraryFile[] }>;
        upload: () => Promise<{ success: boolean; file?: LibraryFile; error?: string }>;
        delete: (fileId: string) => Promise<{ success: boolean; error?: string }>;
        link: (fileId: string, taskId: string) => Promise<{ success: boolean; error?: string }>;
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
        add: (item: { type: string; content: string; scheduledFor: string; metadata?: Record<string, unknown> }) => Promise<{ success: boolean; id?: string; error?: string }>;
        update: (id: string, item: { type?: string; content?: string; scheduledFor?: string; metadata?: Record<string, unknown> }) => Promise<{ success: boolean; error?: string }>;
        cancel: (id: string) => Promise<{ success: boolean; error?: string }>;
        sendNow: (id: string) => Promise<{ success: boolean; error?: string }>;
      };
      // Search
      search: {
        local: (query: string) => Promise<{ success: boolean; results: SearchResult[] }>;
        unified: (query: string) => Promise<{ success: boolean; results: SearchResult[] }>;
        discord: (query: string) => Promise<{ success: boolean; messages: unknown[] }>;
        telegram: (query: string) => Promise<{ success: boolean; messages: unknown[] }>;
        whatsapp: (query: string) => Promise<{ success: boolean; messages: unknown[] }>;
      };
      // System status
      system: {
        status: () => Promise<{ success: boolean; status: Record<string, unknown>; error?: string }>;
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
      // Token tracking and budgets
      tokens: {
        summary: (args?: { agent?: string; period?: string }) => Promise<{ success: boolean; data?: any; by_agent?: any[]; total?: any; error?: string }>;
        log: (args?: { agent?: string; limit?: number; since?: number }) => Promise<{ success: boolean; entries?: any[]; error?: string }>;
        budget: (agent: string) => Promise<any>;
      };
      // Analytics (real data from froggo.db)
      analytics: {
        getData: (timeRange: string) => Promise<any>;
        subtaskStats: () => Promise<any>;
        heatmap: (days: number) => Promise<any>;
        timeTracking: (projectFilter?: string) => Promise<any>;
      };
      // Connected Accounts
      accounts: {
        list: () => Promise<{ success: boolean; accounts?: unknown[]; error?: string }>;
        add: (accountType: string, options?: any) => Promise<{ success: boolean; error?: string }>;
        remove: (accountId: string) => Promise<{ success: boolean; error?: string }>;
        getAvailableTypes: () => Promise<{ success: boolean; types?: unknown[]; error?: string }>;
        getPermissions: (accountId: string) => Promise<{ success: boolean; permissions?: unknown; error?: string }>;
        refresh: (accountId: string) => Promise<{ success: boolean; error?: string }>;
        importGoogle: () => Promise<{ success: boolean; imported?: number; errors?: string[]; error?: string }>;
        test: (accountId: string) => Promise<{ success: boolean; error?: string }>;
      };
      // Security management
      security: {
        listKeys: () => Promise<{ success: boolean; keys?: unknown[]; error?: string }>;
        addKey: (key: { name: string; service: string; key: string }) => Promise<{ success: boolean; error?: string }>;
        deleteKey: (keyId: string) => Promise<{ success: boolean; error?: string }>;
        listAuditLogs: () => Promise<{ success: boolean; logs?: unknown[]; error?: string }>;
        updateAuditLog: (logId: string, updates: { status?: string }) => Promise<{ success: boolean; error?: string }>;
        listAlerts: () => Promise<{ success: boolean; alerts?: unknown[]; error?: string }>;
        dismissAlert: (alertId: string) => Promise<{ success: boolean; error?: string }>;
        runAudit: () => Promise<{ success: boolean; results?: unknown; findings?: unknown[]; alerts?: unknown[]; error?: string }>;
      };
      // Export & Backup management
      exportBackup: {
        exportTasks: (options: { format: 'json' | 'csv'; filters?: any }) => Promise<{ success: boolean; path?: string; filepath?: string; error?: string }>;
        exportAgentLogs: (options: { format: 'json' | 'csv'; filters?: any }) => Promise<{ success: boolean; path?: string; filepath?: string; error?: string }>;
        exportChatHistory: (options: { format: 'json' | 'csv'; filters?: any }) => Promise<{ success: boolean; path?: string; filepath?: string; error?: string }>;
        createBackup: (options?: { includeAttachments?: boolean }) => Promise<{ success: boolean; path?: string; filepath?: string; error?: string }>;
        restoreBackup: (backupPath: string) => Promise<{ success: boolean; error?: string }>;
        listBackups: () => Promise<{ success: boolean; backups?: unknown[]; error?: string }>;
        cleanupOldBackups: (keepCount: number) => Promise<{ success: boolean; deletedCount?: number; error?: string }>;
        importTasks: (filepath: string) => Promise<{ success: boolean; error?: string }>;
        getStats: () => Promise<{ success: boolean; stats?: any; error?: string }>;
      };
      // Priority inbox
      priority: {
        getScore: (itemId: string) => Promise<{ success: boolean; score?: number; error?: string }>;
        getScores: (itemIds: string[]) => Promise<{ success: boolean; scores?: Record<string, number>; error?: string }>;
        recalculate: (limit?: number) => Promise<{ success: boolean; error?: string }>;
        getSettings: () => Promise<{ success: boolean; settings?: unknown; error?: string }>;
        stats: () => Promise<{ success: boolean; stats?: unknown; error?: string }>;
        config: () => Promise<{ success: boolean; config?: unknown; error?: string }>;
        updateConfig: (keyOrConfig: string | Record<string, unknown>, value?: unknown) => Promise<{ success: boolean; error?: string }>;
      };
      // Approvals
      approvals: {
        list: () => Promise<{ success: boolean; approvals?: unknown[]; error?: string }>;
        approve: (id: string) => Promise<{ success: boolean; error?: string }>;
        reject: (id: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
        remove: (id: string) => Promise<{ success: boolean; error?: string }>;
      };
      // Agents management
      agents: {
        list: () => Promise<{ success: boolean; agents?: any[]; error?: string }>;
        create: (config: { id: string; name: string; role: string; emoji: string; color: string; personality: string; voice?: string }) => Promise<{ success: boolean; error?: string }>;
        getRegistry: () => Promise<{ success: boolean; agents?: any[]; error?: string }>;
        getMetrics: () => Promise<{ success: boolean; metrics?: any; error?: string }>;
        getDetails: (agentId: string) => Promise<any>;
        addSkill: (agentId: string, skill: string) => Promise<{ success: boolean; error?: string }>;
        updateSkill: (agentId: string, skillName: string, proficiency: number) => Promise<{ success: boolean; error?: string }>;
        search: (query: string) => Promise<{ success: boolean; agents?: any[]; error?: string }>;
        spawnChat: (agentId: string) => Promise<{ success: boolean; sessionKey?: string; error?: string }>;
        chat: (sessionKey: string, message: string) => Promise<{ success: boolean; response?: string; message?: string; error?: string }>;
        getActiveSessions: () => Promise<{ success: boolean; sessions?: any[]; error?: string }>;
        spawnForTask: (taskId: string, agentId: string) => Promise<{ success: boolean; error?: string }>;
      };
      // X (bird CLI)
      twitter: {
        mentions: () => Promise<{ success: boolean; mentions?: XMention[]; raw?: string; error?: string }>;
        home: (limit?: number) => Promise<{ success: boolean; tweets?: XTweet[]; raw?: string; error?: string }>;
        queuePost: (text: string, context?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
      };
      // Messages (wacli)
      messages: {
        recent: (limit?: number, includeArchived?: boolean) => Promise<{ success: boolean; chats: MessageChat[]; error?: string }>;
        context: (messageId: string, platform: string, limit?: number) => Promise<{ success: boolean; messages?: unknown[]; error?: string }>;
        send: (platform: string, to: string, message: string) => Promise<{ success: boolean; error?: string }>;
        unread: () => Promise<{ success: boolean; count: number; byPlatform?: { [platform: string]: number } }>;
        onUpdate: (cb: (data: any) => void) => () => void;
      };
      // Email (gog CLI)
      email: {
        accounts: () => Promise<{ success: boolean; accounts?: string[]; error?: string }>;
        unread: (account?: string) => Promise<{ success: boolean; emails: Email[] & { threads?: Email[] }; account?: string }>;
        search: (query: string, account?: string) => Promise<{ success: boolean; emails: Email[] & { threads?: Email[] }; account?: string }>;
        body: (emailId: string, account?: string) => Promise<{ success: boolean; body?: string; error?: string }>;
        queueSend: (to: string, subject: string, body: string, account?: string) => Promise<{ success: boolean; message?: string }>;
        // Direct send (Stage 2 email workflow)
        send: (options: { to: string; subject: string; body: string; account?: string }) => Promise<{ success: boolean; output?: string; error?: string }>;
        checkImportant: () => Promise<{ success: boolean; emails?: Email[]; error?: string }>;
        starred: (account?: string) => Promise<{ success: boolean; emails?: Email[]; count?: number; error?: string }>;
        action: (emailId: string, action?: string) => Promise<{ success: boolean; count?: number; error?: string }>;
      };
      // Calendar (gog CLI + aggregation service)
      calendar: {
        events: (account?: string, days?: number) => Promise<{ success: boolean; events: CalendarEvent[] & { events?: CalendarEvent[] }; account?: string }>;
        today: () => Promise<{ success: boolean; events: CalendarEvent[] & { events?: CalendarEvent[] }; account?: string }>;
        createEvent: (params: any) => Promise<{ success: boolean; id?: string; error?: string }>;
        updateEvent: (params: any) => Promise<{ success: boolean; error?: string }>;
        deleteEvent: (params: any) => Promise<{ success: boolean; error?: string }>;
        listAccounts: () => Promise<{ success: boolean; accounts?: string[]; error?: string }>;
        listCalendars: (account: string) => Promise<{ success: boolean; calendars?: unknown[]; error?: string }>;
        addAccount: () => Promise<{ success: boolean; error?: string }>;
        removeAccount: (account: string) => Promise<{ success: boolean; error?: string }>;
        testConnection: (account: string) => Promise<{ success: boolean; error?: string }>;
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
      // Calendar Events (Epic Calendar - Mission Control calendar DB)
      calendarEvents: {
        list: () => Promise<{ success: boolean; events?: unknown[]; error?: string }>;
        get: (eventId: string) => Promise<{ success: boolean; event?: unknown; error?: string }>;
        create: (event: {
          title: string;
          description?: string;
          start_time: string;
          end_time: string;
          all_day?: boolean;
          location?: string;
          recurrence_rule?: string;
          categories?: string;
          created_by?: string;
          metadata?: any;
        }) => Promise<{ success: boolean; id?: string; error?: string }>;
        update: (eventId: string, updates: {
          title?: string;
          description?: string;
          start_time?: string;
          end_time?: string;
          all_day?: boolean;
          location?: string;
          recurrence_rule?: string;
          categories?: string;
          metadata?: any;
        }) => Promise<{ success: boolean; error?: string }>;
        delete: (eventId: string) => Promise<{ success: boolean; error?: string }>;
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
        count: () => Promise<{ success: boolean; count: number }>;
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
          list: () => Promise<{ success: boolean; rules?: FolderRule[]; error?: string }>;
          get: (folderId: number) => Promise<{ success: boolean; rule?: FolderRule; error?: string }>;
          save: (folderId: number, rule: FolderRule) => Promise<{ success: boolean; error?: string }>;
          delete: (folderId: number) => Promise<{ success: boolean; error?: string }>;
        };
        autoAssign: (sessionKey: string, conversationData: any) => Promise<{ success: boolean; error?: string }>;
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
        run: (command: string) => Promise<ExecResult>;
        audit: (limit?: number) => Promise<unknown>;
        validate: (command: string) => Promise<{ valid: boolean; reason?: string }>;
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
        check: (identifier: string) => Promise<{ success: boolean; isVip?: boolean; error?: string }>;
      };
      // Snooze conversations
      snooze: {
        list: () => Promise<{ success: boolean; snoozes?: SnoozeEntry[]; error?: string }>;
        get: (sessionKey: string) => Promise<{ success: boolean; snooze?: SnoozeEntry; error?: string }>;
        set: (sessionKey: string, until: string | number, reason?: string) => Promise<{ success: boolean; error?: string }>;
        unset: (sessionKey: string) => Promise<{ success: boolean; error?: string }>;
        markReminderSent: (sessionKey: string) => Promise<{ success: boolean; error?: string }>;
        expired: () => Promise<{ success: boolean; snoozes?: SnoozeEntry[]; error?: string }>;
        history: (sessionKey: string, limit?: number) => Promise<{ success: boolean; history?: SnoozeEntry[]; error?: string }>;
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
        onPrefsUpdated: (callback: (prefs: any) => void) => () => void;
        onAction: (callback: (action: { action: string; notificationId: string } | string) => void) => () => void;
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
      // Calendar Events (Epic Calendar)
      // (defined above as calendarEvents)
      // Agent registry (dynamic agent loading)
      getAgentRegistry: () => Promise<AgentRegistryEntry[]>;
      // DM Feed & Circuit Breakers
      getDMHistory: (args?: { limit?: number; agent?: string }) => Promise<DMMessage[]>;
      getKnowledgeFeed: (args?: { limit?: number; type?: string; agent?: string }) => Promise<KnowledgeItem[]>;
      getKnowledgeStats: () => Promise<KnowledgeStats>;
      getCircuitStatus: () => Promise<Record<string, CircuitBreakerStatus>>;
      // Agent performance & governance
      getPerformanceReport: (days: number) => Promise<PerformanceReport>;
      getAgentAudit: (agentId: string, days: number) => Promise<AgentAudit>;
      // Widget API - dynamic agent widget loading
      widgetAPI?: {
        scanManifest: (agentId: string) => Promise<WidgetManifest>;
      };
      // Toolbar pop-out API
      toolbar: {
        popOut: (data?: { x?: number; y?: number; width?: number; height?: number }) => Promise<{ success: boolean; error?: string }>;
        popIn: () => Promise<{ success: boolean; error?: string }>;
        getState: () => Promise<{ poppedOut: boolean; windowId?: number }>;
        onClosed: (callback: () => void) => () => void;
        onPoppedIn: (callback: () => void) => () => void;
        action: (action: string) => Promise<{ success: boolean; error?: string }>;
        resize: (height: number) => Promise<{ success: boolean; error?: string }>;
        setIgnoreMouseEvents: (ignore: boolean) => void;
        startDragging: () => void;
        onAction: (callback: (action: string) => void) => () => void;
      };
      // Rejection logging
      rejections: {
        log: (rejection: { type: string; title: string; content?: string; reason?: string }) => Promise<{ success: boolean }>;
      };
      // Finance API
      finance?: {
        selectFile: () => Promise<{ success: boolean; fileName?: string; isPdf?: boolean; content?: string | number[]; error?: string }>;
        triggerAnalysis: (options?: { daysBack?: number; focus?: string }) => Promise<{ success: boolean; analysis?: string; error?: string }>;
        dismissInsight: (insightId: string) => Promise<{ success: boolean; error?: string }>;
        getTransactions: (opts?: { limit?: number; accountId?: string } | number) => Promise<{ success: boolean; transactions?: unknown[]; error?: string }>;
        getBudgetStatus: (optsOrType?: { budgetType?: string; accountId?: string } | string) => Promise<{ success: boolean; status?: unknown; error?: string }>;
        uploadCSV: (csvContent: string, filename: string, accountId?: string) => Promise<{ success: boolean; imported?: number; skipped?: number; analysisStarted?: boolean; error?: string }>;
        uploadPDF: (pdfBuffer: ArrayBuffer, filename: string, accountId?: string) => Promise<{ success: boolean; message?: string; imported?: number; skipped?: number; error?: string }>;
        onAnalysisStatus: (callback: (data: { status: string; type: string; message?: string; error?: string }) => void) => () => void;
        createBudget: (data: { name: string; budgetType: string; totalBudget: number; currency?: string; accountId?: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
        getAlerts: () => Promise<{ success: boolean; alerts?: unknown[]; error?: string }>;
        getInsights: () => Promise<{ success: boolean; insights?: unknown[]; error?: string }>;
        account?: {
          list: () => Promise<{ success: boolean; accounts?: FinanceAccount[]; error?: string }>;
          create: (data: { name: string; type: string; currency?: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
          update: (id: string, updates: { name?: string }) => Promise<{ success: boolean; error?: string }>;
          archive: (id: string) => Promise<{ success: boolean; error?: string }>;
          balances: () => Promise<{ success: boolean; balances?: Array<FinanceAccount & { computed_balance: number; transaction_count: number }>; error?: string }>;
        };
        recurring?: {
          detect: (accountId?: string) => Promise<{ success: boolean; error?: string }>;
          list: (accountId?: string) => Promise<{ success: boolean; recurring?: FinanceRecurring[]; error?: string }>;
          confirm: (id: string) => Promise<{ success: boolean; error?: string }>;
          dismiss: (id: string) => Promise<{ success: boolean; error?: string }>;
          status: (accountId?: string) => Promise<{ success: boolean; stats?: { total: number; confirmed: number; pending: number }; error?: string }>;
        };
        export?: {
          xlsx: (opts: { accountId?: string; dateFrom?: number; dateTo?: number }) => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
        };
        category?: {
          list: () => Promise<{ success: boolean; categories?: unknown[]; error?: string }>;
          getBreakdown: (opts?: { accountId?: string; days?: number }) => Promise<{ success: boolean; breakdown?: FinanceCategoryBreakdownRow[]; error?: string }>;
          corrections: () => Promise<{ success: boolean; corrections?: FinanceCategoryCorrection[]; error?: string }>;
          updateTransaction: (id: string, category: string) => Promise<{ success: boolean; error?: string }>;
        };
        generateInsights?: (opts?: { days?: number }) => Promise<{ success: boolean; generated?: number; error?: string }>;
        scenario?: {
          list: () => Promise<{ success: boolean; scenarios?: FinanceScenario[]; error?: string }>;
          create: (data: { name: string; description?: string; baseAccountId?: string; projectionMonths?: number }) => Promise<{ success: boolean; id?: string; error?: string }>;
          update: (id: string, updates: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
          delete: (id: string) => Promise<{ success: boolean; error?: string }>;
          project: (id: string) => Promise<{ success: boolean; months?: FinanceProjectionMonth[]; baseMonthlyCost?: number; error?: string }>;
          projectSimple: (adjustments: Array<{ recurringId: string; action: string; newAmount?: number }>) => Promise<{ success: boolean; before?: { monthly: number; yearly: number }; after?: { monthly: number; yearly: number }; savings?: { monthly: number; yearly: number }; error?: string }>;
        };
      };
      // Finance Agent
      financeAgent?: {
        sendMessage: (message: string, context?: unknown) => Promise<{ success: boolean; message?: string; error?: string }>;
        getChatHistory: () => Promise<{ success: boolean; messages?: unknown[]; error?: string }>;
        clearHistory: () => Promise<{ success: boolean; error?: string }>;
        triggerAnalysis: (analysisType?: 'csv_upload' | 'manual') => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<{ success: boolean; status?: unknown; error?: string }>;
      };
      // HR Reports
      hrReports?: {
        list: () => Promise<{ success: boolean; files?: string[]; reports?: unknown[]; error?: string }>;
        read: (filename: string) => Promise<{ success: boolean; content?: string; error?: string }>;
      };
      // X Automations
      xAutomations?: {
        list: () => Promise<{ success: boolean; automations?: any[]; error?: string }>;
        get: (id: string) => Promise<{ success: boolean; automation?: any; error?: string }>;
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
        executions: (automationId?: string, limit?: number) => Promise<{ success: boolean; executions?: any[]; error?: string }>;
        rateLimit: (automationId: string) => Promise<{ success: boolean; rateLimit?: any; error?: string }>;
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
      // X Campaign
      xCampaign?: {
        list: () => Promise<{ success: boolean; campaigns?: unknown[]; error?: string }>;
        save: (campaign: any) => Promise<{ success: boolean; error?: string }>;
        delete: (id: string) => Promise<{ success: boolean; error?: string }>;
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
        mediaUpload: (filePath: string) => Promise<{ success: boolean; mediaId?: string; error?: string }>;
        schedule: (text: string, scheduledAt: number, mediaId?: string) => Promise<{ success: boolean; id?: string; error?: string }>;
        scheduleThread: (tweets: string[], scheduledAt: number) => Promise<{ success: boolean; id?: string; error?: string }>;
        scheduledList: () => Promise<{ success: boolean; scheduled: unknown[]; error?: string }>;
        scheduledCancel: (id: string) => Promise<{ success: boolean; error?: string }>;
        failedList: () => Promise<{ success: boolean; failed: Array<{ id: string; content: string; error?: string }>; error?: string }>;
      };
      // X Analytics — real follower/tweet metrics from X API
      xAnalytics?: {
        summary: () => Promise<unknown>;
        topContent: () => Promise<unknown>;
        profile: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
        tweets: (count?: number) => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        summaryReal: () => Promise<{ success: boolean; followers?: number; following?: number; tweetCount?: number; totalLikes?: number; totalRetweets?: number; totalReplies?: number; totalImpressions?: number; engagementRate?: number; recentTweetCount?: number; error?: string }>;
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
        schedule: (text: string, scheduledTime: number) => Promise<{ success: boolean; id?: string; error?: string }>;
      };
      // Agent Management — SOUL.md editing + model config
      agentManagement?: {
        soul: {
          read: (agentId: string) => Promise<{ success: boolean; content?: string; error?: string }>;
          write: (agentId: string, content: string) => Promise<{ success: boolean; error?: string }>;
        };
        models: {
          read: (agentId: string) => Promise<{ success: boolean; primary?: string; fallbacks?: string[]; usingDefaults?: boolean; error?: string }>;
          write: (agentId: string, updates: { primary?: string; fallbacks?: string[] }) => Promise<{ success: boolean; error?: string }>;
        };
        ctx?: {
          check: () => Promise<{
            success: boolean;
            health?: Record<string, { AGENTS: boolean; USER: boolean; TOOLS: boolean }>;
            error?: string;
          }>;
        };
        agent?: {
          status: (agentId: string) => Promise<{ success: boolean; status?: string; isProtected?: boolean; error?: string }>;
          start: (agentId: string) => Promise<{ success: boolean; error?: string }>;
          stop: (agentId: string) => Promise<{ success: boolean; error?: string }>;
        };
      };
      // Memory Lifecycle
      memoryLifecycle?: {
        status: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
        rotate: (agentId: string) => Promise<{ success: boolean; error?: string }>;
      };
      // Module Builder persistence
      moduleBuilder?: {
        list: () => Promise<{ success: boolean; modules?: Array<{ id: string; name: string; description: string; status: string; overall_progress: number; created_at: number; updated_at: number }>; error?: string }>;
        get: (id: string) => Promise<{ success: boolean; module?: { id: string; name: string; description: string; status: string; spec: any; conversation: any[]; conversation_state: any; overall_progress: number; created_at: number; updated_at: number }; error?: string }>;
        save: (data: { id: string; name?: string; description?: string; status?: string; spec?: any; conversation?: any[]; conversation_state?: any; overall_progress?: number }) => Promise<{ success: boolean; error?: string }>;
        delete: (id: string) => Promise<{ success: boolean; error?: string }>;
      };
      // Generic module IPC passthrough
      modules?: {
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      };
      // Writing Module
      writing?: {
        project: {
          list: () => Promise<{ success: boolean; projects?: any[]; error?: string }>;
          create: (title: string, type: string) => Promise<{ success: boolean; id?: string; project?: any; error?: string }>;
          get: (id: string) => Promise<{ success: boolean; project?: any; error?: string; chapters?: any[] }>;
          update: (id: string, updates: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
          delete: (id: string) => Promise<{ success: boolean; error?: string }>;
          createFromWizard: (wizardData: any) => Promise<{ success: boolean; id?: string; project?: any; error?: string }>;
        };
        chapter: {
          list: (projectId: string) => Promise<{ success: boolean; chapters?: any[]; error?: string }>;
          create: (projectId: string, title: string) => Promise<{ success: boolean; id?: string; chapter?: any; error?: string }>;
          read: (projectId: string, chapterId: string) => Promise<{ success: boolean; content?: string; error?: string }>;
          get: (id: string) => Promise<{ success: boolean; chapter?: any; error?: string }>;
          save: (projectId: string, chapterId: string, content: string) => Promise<{ success: boolean; error?: string }>;
          rename: (projectId: string, chapterId: string, title: string) => Promise<{ success: boolean; error?: string }>;
          update: (id: string, updates: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
          delete: (projectId: string, chapterId?: string) => Promise<{ success: boolean; error?: string }>;
          reorder: (projectId: string, ids: string[]) => Promise<{ success: boolean; error?: string }>;
        };
        chat: {
          loadHistory: (projectId: string) => Promise<{ success: boolean; messages?: any[]; error?: string }>;
          appendMessage: (projectId: string, message: any) => Promise<{ success: boolean; error?: string }>;
          clearHistory: (projectId: string) => Promise<{ success: boolean; error?: string }>;
        };
        wizard: {
          save: (sessionId: string, state: any) => Promise<{ success: boolean; error?: string }>;
          load: (sessionId: string) => Promise<{ success: boolean; state?: any; error?: string }>;
          list: () => Promise<{ success: boolean; sessions?: any[]; wizards?: any[]; error?: string }>;
          delete: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
        };
        feedback: {
          log: (projectId: string, entry: any) => Promise<{ success: boolean; error?: string }>;
          history: (projectId: string, chapterId: string) => Promise<{ success: boolean; entries?: any[]; error?: string }>;
        };
        memory: {
          characters: {
            list: (projectId: string) => Promise<{ success: boolean; characters?: any[]; error?: string }>;
            create: (projectId: string, data: any) => Promise<{ success: boolean; id?: string; error?: string }>;
            update: (projectId: string, id: string, data: any) => Promise<{ success: boolean; error?: string }>;
            delete: (projectId: string, id: string) => Promise<{ success: boolean; error?: string }>;
          };
          timeline: {
            list: (projectId: string) => Promise<{ success: boolean; timeline?: any[]; events?: any[]; error?: string }>;
            create: (projectId: string, data: any) => Promise<{ success: boolean; id?: string; error?: string }>;
            update: (projectId: string, id: string, data: any) => Promise<{ success: boolean; error?: string }>;
            delete: (projectId: string, id: string) => Promise<{ success: boolean; error?: string }>;
          };
          facts: {
            list: (projectId: string) => Promise<{ success: boolean; facts?: any[]; error?: string }>;
            create: (projectId: string, data: any) => Promise<{ success: boolean; id?: string; error?: string }>;
            update: (projectId: string, id: string, data: any) => Promise<{ success: boolean; error?: string }>;
            delete: (projectId: string, id: string) => Promise<{ success: boolean; error?: string }>;
          };
        };
        research: {
          sources: {
            list: (projectId: string) => Promise<{ success: boolean; sources?: any[]; error?: string }>;
            create: (projectId: string, data: any) => Promise<{ success: boolean; id?: string; error?: string }>;
            update: (projectId: string, id: string, data: any) => Promise<{ success: boolean; error?: string }>;
            delete: (projectId: string, id: string) => Promise<{ success: boolean; error?: string }>;
          };
          links: {
            forFact: (projectId: string, factId: string) => Promise<{ success: boolean; links?: any[]; sources?: any[]; error?: string }>;
            forSource: (projectId: string, sourceId: string) => Promise<{ success: boolean; links?: any[]; sources?: any[]; error?: string }>;
            link: (projectId: string, factId: string, sourceId: string, notes?: string) => Promise<{ success: boolean; error?: string }>;
            unlink: (projectId: string, factId: string, sourceId: string) => Promise<{ success: boolean; error?: string }>;
            cleanup: (projectId: string, validFactIds: string[]) => Promise<{ success: boolean; error?: string }>;
          };
        };
        version: {
          list: (projectId: string, chapterId: string) => Promise<{ success: boolean; versions?: any[]; error?: string }>;
          save: (projectId: string, chapterId: string, label?: string) => Promise<{ success: boolean; id?: string; error?: string }>;
          read: (projectId: string, chapterId: string, versionId: string) => Promise<{ success: boolean; content?: string; error?: string }>;
          restore: (projectId: string, chapterId: string, versionId: string) => Promise<{ success: boolean; error?: string }>;
          diff: (projectId: string, chapterId: string, versionId: string) => Promise<{ success: boolean; diff?: string; changes?: any; versionLabel?: string; error?: string }>;
          delete: (projectId: string, chapterId: string, versionId: string) => Promise<{ success: boolean; error?: string }>;
        };
      };
    };
  }
}
