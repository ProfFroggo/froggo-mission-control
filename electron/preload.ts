import { contextBridge, ipcRenderer, desktopCapturer } from 'electron';

// Detect if running in dev or prod mode via env var (set by start script)
const isDev = process.env.ELECTRON_DEV === '1';

contextBridge.exposeInMainWorld('clawdbot', {
  // App lifecycle events
  app: {
    onClosing: (callback: () => void) => {
      ipcRenderer.on('app-closing', () => callback());
      return () => ipcRenderer.removeAllListeners('app-closing');
    },
  },
  gateway: {
    // Listen for broadcast events from main process (for real-time task updates)
    onBroadcast: (callback: (event: { type: string; event: string; payload: any }) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('gateway-broadcast', handler);
      return () => ipcRenderer.removeListener('gateway-broadcast', handler);
    },
    getToken: () => ipcRenderer.invoke('gateway:getToken'),
  },
  sessions: {
    list: (activeMinutes?: number) => ipcRenderer.invoke('sessions:list', activeMinutes),
  },
  // Whisper (legacy/fallback)
  whisper: {
    check: () => ipcRenderer.invoke('whisper:check'),
    transcribe: (audioData: ArrayBuffer) => ipcRenderer.invoke('whisper:transcribe', audioData),
  },
  platform: process.platform,
  // Voice helpers
  voice: {
    getModelUrl: () => ipcRenderer.invoke('voice:getModelUrl'),
    speak: (text: string, voice?: string) => ipcRenderer.invoke('voice:speak', text, voice),
    isDev: () => isDev,
  },
  // API keys (secure access)
  getOpenAIKey: () => ipcRenderer.invoke('get-openai-key'),
  // Notifications
  notifications: {
    getPrefs: () => ipcRenderer.invoke('notifications:get-prefs'),
    updatePrefs: (updates: any) => ipcRenderer.invoke('notifications:update-prefs', updates),
    send: (options: any) => ipcRenderer.invoke('notifications:send', options),
    test: () => ipcRenderer.invoke('notifications:test'),
    onReceived: (callback: (notification: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('notification-received', handler);
      return () => ipcRenderer.removeListener('notification-received', handler);
    },
    onPrefsUpdated: (callback: (prefs: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('notification-prefs-updated', handler);
      return () => ipcRenderer.removeListener('notification-prefs-updated', handler);
    },
    onAction: (callback: (action: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('notification-action', handler);
      return () => ipcRenderer.removeListener('notification-action', handler);
    },
  },
  // Navigation helper (from notification clicks)
  onNavigate: (callback: (view: string, data?: any) => void) => {
    const handler = (_: any, view: string, data?: any) => callback(view, data);
    ipcRenderer.on('navigate-to-view', handler);
    return () => ipcRenderer.removeListener('navigate-to-view', handler);
  },
  // Task sync to froggo-db
  tasks: {
    sync: (task: { id: string; title: string; status: string; project?: string; assignedTo?: string }) => 
      ipcRenderer.invoke('tasks:sync', task),
    update: (taskId: string, updates: { status?: string; assignedTo?: string }) =>
      ipcRenderer.invoke('tasks:update', taskId, updates),
    list: (status?: string) => ipcRenderer.invoke('tasks:list', status),
    start: (taskId: string) => ipcRenderer.invoke('tasks:start', taskId),
    complete: (taskId: string, outcome?: string) => ipcRenderer.invoke('tasks:complete', taskId, outcome),
    // Poke a task to get status update from Brain
    delete: (taskId: string) => ipcRenderer.invoke('tasks:delete', taskId),
    archiveDone: () => ipcRenderer.invoke('tasks:archiveDone'),
    poke: (taskId: string, title: string) => ipcRenderer.invoke('tasks:poke', taskId, title),
    pokeInternal: (taskId: string, title: string) => ipcRenderer.invoke('tasks:pokeInternal', taskId, title),
    // Real-time task notification listener
    onNotification: (callback: (notification: { event: string; task_id: string; title: string; project: string; timestamp: number }) => void) => {
      const handler = (_: any, notification: any) => callback(notification);
      ipcRenderer.on('task-notification', handler);
      return () => ipcRenderer.removeListener('task-notification', handler);
    },
    // Subtask operations
    subtasks: {
      list: (taskId: string) => ipcRenderer.invoke('subtasks:list', taskId),
      add: (taskId: string, subtask: { id: string; title: string; description?: string; assignedTo?: string }) =>
        ipcRenderer.invoke('subtasks:add', taskId, subtask),
      update: (subtaskId: string, updates: { completed?: boolean; completedBy?: string; title?: string; assignedTo?: string }) =>
        ipcRenderer.invoke('subtasks:update', subtaskId, updates),
      delete: (subtaskId: string) => ipcRenderer.invoke('subtasks:delete', subtaskId),
      reorder: (subtaskIds: string[]) => ipcRenderer.invoke('subtasks:reorder', subtaskIds),
    },
    // Activity log operations
    activity: {
      list: (taskId: string, limit?: number) => ipcRenderer.invoke('activity:list', taskId, limit),
      add: (taskId: string, entry: { action: string; message: string; agentId?: string; details?: string }) =>
        ipcRenderer.invoke('activity:add', taskId, entry),
    },
    // Attachments operations
    attachments: {
      list: (taskId: string) => ipcRenderer.invoke('attachments:list', taskId),
      listAll: () => ipcRenderer.invoke('attachments:listAll'),
      add: (taskId: string, filePath: string, category?: string, uploadedBy?: string) =>
        ipcRenderer.invoke('attachments:add', taskId, filePath, category, uploadedBy),
      delete: (attachmentId: number) => ipcRenderer.invoke('attachments:delete', attachmentId),
      open: (filePath: string) => ipcRenderer.invoke('attachments:open', filePath),
      autoDetect: (taskId: string) => ipcRenderer.invoke('attachments:auto-detect', taskId),
    },
  },
  // Folder/Label Management
  folders: {
    list: () => ipcRenderer.invoke('folders:list'),
    create: (folder: { name: string; icon?: string; color?: string; description?: string }) =>
      ipcRenderer.invoke('folders:create', folder),
    update: (folderId: number, updates: { name?: string; icon?: string; color?: string; description?: string; sort_order?: number }) =>
      ipcRenderer.invoke('folders:update', folderId, updates),
    delete: (folderId: number) => ipcRenderer.invoke('folders:delete', folderId),
    assign: (folderId: number, sessionKey: string, notes?: string) =>
      ipcRenderer.invoke('folders:assign', folderId, sessionKey, notes),
    unassign: (folderId: number, sessionKey: string) =>
      ipcRenderer.invoke('folders:unassign', folderId, sessionKey),
    forConversation: (sessionKey: string) =>
      ipcRenderer.invoke('folders:for-conversation', sessionKey),
    conversations: (folderId: number) =>
      ipcRenderer.invoke('folders:conversations', folderId),
    // Smart folder rules
    rules: {
      list: () => ipcRenderer.invoke('folders:rules:list'),
      get: (folderId: number) => ipcRenderer.invoke('folders:rules:get', folderId),
      save: (folderId: number, rule: any) => ipcRenderer.invoke('folders:rules:save', folderId, rule),
      delete: (folderId: number) => ipcRenderer.invoke('folders:rules:delete', folderId),
    },
    autoAssign: (sessionKey: string, conversationData: any) =>
      ipcRenderer.invoke('folders:auto-assign', sessionKey, conversationData),
  },
  // Pinned Conversations
  pins: {
    list: () => ipcRenderer.invoke('pins:list'),
    isPinned: (sessionKey: string) => ipcRenderer.invoke('pins:is-pinned', sessionKey),
    pin: (sessionKey: string, notes?: string) => ipcRenderer.invoke('pins:pin', sessionKey, notes),
    unpin: (sessionKey: string) => ipcRenderer.invoke('pins:unpin', sessionKey),
    toggle: (sessionKey: string) => ipcRenderer.invoke('pins:toggle', sessionKey),
    reorder: (sessionKeys: string[]) => ipcRenderer.invoke('pins:reorder', sessionKeys),
    count: () => ipcRenderer.invoke('pins:count'),
  },
  // Snooze & Reminders
  snooze: {
    list: () => ipcRenderer.invoke('snooze:list'),
    get: (sessionKey: string) => ipcRenderer.invoke('snooze:get', sessionKey),
    set: (sessionKey: string, snoozeUntil: number, reason?: string) => 
      ipcRenderer.invoke('snooze:set', sessionKey, snoozeUntil, reason),
    unset: (sessionKey: string) => ipcRenderer.invoke('snooze:unset', sessionKey),
    markReminderSent: (sessionKey: string) => ipcRenderer.invoke('snooze:markReminderSent', sessionKey),
    expired: () => ipcRenderer.invoke('snooze:expired'),
    history: (sessionKey: string, limit?: number) => ipcRenderer.invoke('snooze:history', sessionKey, limit),
  },
  // Per-conversation notification settings
  notificationSettings: {
    // Get settings for a specific conversation
    get: (sessionKey: string) => ipcRenderer.invoke('notification-settings:get', sessionKey),
    // Set/update settings for a conversation
    set: (sessionKey: string, settings: {
      notification_level?: string;
      sound_enabled?: boolean;
      sound_type?: string;
      desktop_notifications?: boolean;
      quiet_hours_enabled?: boolean;
      quiet_start?: string;
      quiet_end?: string;
      keyword_alerts?: string[];
      priority_level?: string;
      mute_until?: string;
      notification_frequency?: string;
      show_message_preview?: boolean;
      badge_count_enabled?: boolean;
      notes?: string;
    }) => ipcRenderer.invoke('notification-settings:set', sessionKey, settings),
    // Delete conversation-specific settings (fall back to global defaults)
    delete: (sessionKey: string) => ipcRenderer.invoke('notification-settings:delete', sessionKey),
    // Get global notification defaults
    getGlobalDefaults: () => ipcRenderer.invoke('notification-settings:global-defaults'),
    // Update global defaults
    setGlobalDefaults: (defaults: {
      default_notification_level?: string;
      default_sound_enabled?: boolean;
      default_sound_type?: string;
      default_desktop_notifications?: boolean;
      quiet_hours_enabled?: boolean;
      quiet_start?: string;
      quiet_end?: string;
      default_priority_level?: string;
      do_not_disturb_enabled?: boolean;
      dnd_until?: string;
      enable_batching?: boolean;
      batch_interval_minutes?: number;
    }) => ipcRenderer.invoke('notification-settings:set-global-defaults', defaults),
    // Get effective settings (with global fallback applied)
    getEffective: (sessionKey: string) => ipcRenderer.invoke('notification-settings:get-effective', sessionKey),
    // Quick mute actions
    muteConversation: (sessionKey: string, duration?: string) => 
      ipcRenderer.invoke('notification-settings:mute', sessionKey, duration),
    unmuteConversation: (sessionKey: string) => 
      ipcRenderer.invoke('notification-settings:unmute', sessionKey),
  },
  // Analytics (real data from froggo.db)
  analytics: {
    getData: (timeRange: string) => ipcRenderer.invoke('analytics:getData', timeRange),
    subtaskStats: () => ipcRenderer.invoke('analytics:subtaskStats'),
    heatmap: (days: number) => ipcRenderer.invoke('analytics:heatmap', days),
    timeTracking: (projectFilter?: string) => ipcRenderer.invoke('analytics:timeTracking', projectFilter),
  },
  // Token tracking and budgets
  tokens: {
    summary: (args?: { agent?: string; period?: string }) => ipcRenderer.invoke('tokens:summary', args),
    log: (args?: { agent?: string; limit?: number; since?: number }) => ipcRenderer.invoke('tokens:log', args),
    budget: (agent: string) => ipcRenderer.invoke('tokens:budget', agent),
  },
  // Rejection logging
  rejections: {
    log: (rejection: { type: string; title: string; content?: string; reason?: string }) =>
      ipcRenderer.invoke('rejections:log', rejection),
  },
  // Calendar Events (Epic Calendar - Mission Control calendar DB)
  calendarEvents: {
    list: () => ipcRenderer.invoke('calendar:events:list'),
    get: (eventId: string) => ipcRenderer.invoke('calendar:events:get', eventId),
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
    }) => ipcRenderer.invoke('calendar:events:create', event),
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
    }) => ipcRenderer.invoke('calendar:events:update', eventId, updates),
    delete: (eventId: string) => ipcRenderer.invoke('calendar:events:delete', eventId),
  },
  // Inbox (froggo-db backed)
  inbox: {
    list: (status?: string) => ipcRenderer.invoke('inbox:list', status),
    add: (item: { type: string; title: string; content: string; context?: string; channel?: string }) =>
      ipcRenderer.invoke('inbox:add', item),
    // Add with custom metadata (for Stage 2 email items)
    addWithMetadata: (item: { type: string; title: string; content: string; context?: string; channel?: string; metadata?: string }) =>
      ipcRenderer.invoke('inbox:addWithMetadata', item),
    update: (id: number, updates: { status?: string; feedback?: string }) =>
      ipcRenderer.invoke('inbox:update', id, updates),
    approveAll: () => ipcRenderer.invoke('inbox:approveAll'),
    // Revision handlers for 'needs-revision' items
    listRevisions: () => ipcRenderer.invoke('inbox:listRevisions'),
    submitRevision: (originalId: number, revisedContent: string, revisedTitle?: string) =>
      ipcRenderer.invoke('inbox:submitRevision', originalId, revisedContent, revisedTitle),
    getRevisionContext: (itemId: number) => ipcRenderer.invoke('inbox:getRevisionContext', itemId),
    onUpdate: (callback: (data: { newItems?: number; revision?: boolean; originalId?: number }) => void) => {
      ipcRenderer.on('inbox-updated', (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('inbox-updated');
    },
    // Filter and search operations
    toggleStar: (messageId: string) => ipcRenderer.invoke('inbox:toggleStar', messageId),
    markRead: (messageId: string, isRead: boolean = true) => ipcRenderer.invoke('inbox:markRead', messageId, isRead),
    addTag: (messageId: string, tag: string) => ipcRenderer.invoke('inbox:addTag', messageId, tag),
    removeTag: (messageId: string, tag: string) => ipcRenderer.invoke('inbox:removeTag', messageId, tag),
    setProject: (messageId: string, project: string) => ipcRenderer.invoke('inbox:setProject', messageId, project),
    search: (query: string, limit?: number) => ipcRenderer.invoke('inbox:search', query, limit),
    filter: (criteria: any) => ipcRenderer.invoke('inbox:filter', criteria),
    getSuggestions: (type: 'senders' | 'projects' | 'tags' | 'platforms') => 
      ipcRenderer.invoke('inbox:getSuggestions', type),
    checkHistory: () => ipcRenderer.invoke('inbox:check-history'),
    triggerBackfill: (days?: number) => ipcRenderer.invoke('inbox:trigger-backfill', days),
  },
  // VIP Sender Management
  vip: {
    list: (category?: string) => ipcRenderer.invoke('vip:list', category),
    add: (data: {
      identifier: string;
      label: string;
      type?: string;
      category?: string;
      boost?: number;
      notes?: string;
    }) => ipcRenderer.invoke('vip:add', data),
    update: (id: number, updates: {
      label?: string;
      boost?: number;
      category?: string;
      notes?: string;
    }) => ipcRenderer.invoke('vip:update', id, updates),
    remove: (id: number) => ipcRenderer.invoke('vip:remove', id),
    check: (identifier: string) => ipcRenderer.invoke('vip:check', identifier),
  },
  // Filesystem
  fs: {
    writeBase64: (path: string, base64: string) => ipcRenderer.invoke('fs:writeBase64', path, base64),
    readFile: (path: string, encoding?: string) => ipcRenderer.invoke('fs:readFile', path, encoding),
    append: (path: string, content: string) => ipcRenderer.invoke('fs:append', path, content),
  },
  // Database
  db: {
    exec: (query: string, params?: any[]) => ipcRenderer.invoke('db:exec', query, params),
  },
  // Media uploads
  media: {
    upload: (fileName: string, base64Data: string) => ipcRenderer.invoke('media:upload', fileName, base64Data),
    delete: (filePath: string) => ipcRenderer.invoke('media:delete', filePath),
    cleanup: () => ipcRenderer.invoke('media:cleanup'),
  },
  // Library
  library: {
    list: (category?: string) => ipcRenderer.invoke('library:list', category),
    upload: () => ipcRenderer.invoke('library:upload'),
    delete: (fileId: string) => ipcRenderer.invoke('library:delete', fileId),
    link: (fileId: string, taskId: string) => ipcRenderer.invoke('library:link', fileId, taskId),
    view: (fileId: string) => ipcRenderer.invoke('library:view', fileId),
    download: (fileId: string) => ipcRenderer.invoke('library:download', fileId),
  },
  // Shell
  shell: {
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
  },
  // Screenshot
  screenshot: {
    capture: (outputPath: string) => ipcRenderer.invoke('screenshot:capture', outputPath),
    navigate: (view: string) => ipcRenderer.invoke('screenshot:navigate', view),
  },
  // Schedule
  schedule: {
    list: () => ipcRenderer.invoke('schedule:list'),
    add: (item: { type: string; content: string; scheduledFor: string; metadata?: any }) => 
      ipcRenderer.invoke('schedule:add', item),
    update: (id: string, item: { type?: string; content?: string; scheduledFor?: string; metadata?: any }) =>
      ipcRenderer.invoke('schedule:update', id, item),
    cancel: (id: string) => ipcRenderer.invoke('schedule:cancel', id),
    sendNow: (id: string) => ipcRenderer.invoke('schedule:sendNow', id),
  },
  // Search
  search: {
    local: (query: string) => ipcRenderer.invoke('search:local', query),
    discord: (query: string) => ipcRenderer.invoke('search:discord', query),
    telegram: (query: string) => ipcRenderer.invoke('search:telegram', query),
    whatsapp: (query: string) => ipcRenderer.invoke('search:whatsapp', query),
  },
  // Screen capture (for screen sharing in Electron)
  screenCapture: {
    getSources: (opts?: { types?: string[]; thumbnailSize?: { width: number; height: number } }) =>
      ipcRenderer.invoke('screen:getSources', opts),
  },
  // Media permissions (camera, mic, screen)
  mediaPermissions: {
    check: () => ipcRenderer.invoke('media:checkPermissions'),
    request: (mediaType: 'camera' | 'microphone') => ipcRenderer.invoke('media:requestPermission', mediaType),
  },
  // Execution
  execute: {
    tweet: (content: string, taskId?: string) => ipcRenderer.invoke('execute:tweet', content, taskId),
  },
  // AI Content Generation
  ai: {
    generateContent: (prompt: string, type: 'ideas' | 'draft' | 'cleanup' | 'chat') =>
      ipcRenderer.invoke('ai:generate-content', prompt, type),
    generateReply: (context: {
      threadMessages: Array<{role: string, content: string}>,
      platform?: string,
      recipientName?: string,
      subject?: string,
      tone?: 'formal' | 'casual' | 'auto',
      calendarContext?: string,
      taskContext?: string,
    }) => ipcRenderer.invoke('ai:generateReply', context),
    analyzeMessages: (ids: string[]) => ipcRenderer.invoke('ai:analyzeMessages', ids),
    getAnalysis: (id: string, platform: string) => ipcRenderer.invoke('ai:getAnalysis', id, platform),
    createDetectedTask: (task: { title: string; description?: string }) => ipcRenderer.invoke('ai:createDetectedTask', task),
    createDetectedEvent: (event: { title: string; date: string; time?: string; duration?: string; location?: string; description?: string }) => ipcRenderer.invoke('ai:createDetectedEvent', event),
  },
  // Twitter (X API v2)
  twitter: {
    mentions: () => ipcRenderer.invoke('twitter:mentions'),
    home: (limit?: number) => ipcRenderer.invoke('twitter:home', limit),
    queuePost: (text: string, context?: string) => ipcRenderer.invoke('twitter:queue-post', text, context),
  },
  // Messages (wacli)
  messages: {
    recent: (limit?: number, includeArchived?: boolean) => ipcRenderer.invoke('messages:recent', limit, includeArchived),
    context: (messageId: string, platform: string, limit?: number) => ipcRenderer.invoke('messages:context', messageId, platform, limit),
    send: (platform: string, to: string, message: string) => ipcRenderer.invoke('messages:send', { platform, to, message }),
    onUpdate: (cb: (data: any) => void) => {
      const handler = (_: any, data: any) => cb(data);
      ipcRenderer.on('comms-updated', handler);
      return () => ipcRenderer.removeListener('comms-updated', handler);
    },
  },
  // Conversation management (archive/unarchive)
  conversations: {
    archive: (sessionKey: string) => ipcRenderer.invoke('conversations:archive', sessionKey),
    unarchive: (sessionKey: string) => ipcRenderer.invoke('conversations:unarchive', sessionKey),
    archived: () => ipcRenderer.invoke('conversations:archived'),
    isArchived: (sessionKey: string) => ipcRenderer.invoke('conversations:isArchived', sessionKey),
    markRead: (sessionKey: string) => ipcRenderer.invoke('conversations:markRead', sessionKey),
    delete: (sessionKey: string) => ipcRenderer.invoke('conversations:delete', sessionKey),
  },
  // Email (gog CLI)
  email: {
    accounts: () => ipcRenderer.invoke('email:accounts'),
    unread: (account?: string) => ipcRenderer.invoke('email:unread', account),
    search: (query: string, account?: string) => ipcRenderer.invoke('email:search', query, account),
    body: (emailId: string, account?: string) => ipcRenderer.invoke('email:body', emailId, account),
    queueSend: (to: string, subject: string, body: string, account?: string) => 
      ipcRenderer.invoke('email:queue-send', to, subject, body, account),
    // Direct send (Stage 2 email workflow)
    send: (options: { to: string; subject: string; body: string; account?: string }) =>
      ipcRenderer.invoke('email:send', options),
    checkImportant: () => ipcRenderer.invoke('email:checkImportant'),
  },
  // Calendar (gog CLI)
  calendar: {
    events: (account?: string, days?: number) => ipcRenderer.invoke('calendar:events', account, days),
    today: () => ipcRenderer.invoke('calendar:events', undefined, 1), // Convenience for today's events
    createEvent: (params: any) => ipcRenderer.invoke('calendar:createEvent', params),
    updateEvent: (params: any) => ipcRenderer.invoke('calendar:updateEvent', params),
    deleteEvent: (params: any) => ipcRenderer.invoke('calendar:deleteEvent', params),
    // Account management
    listAccounts: () => ipcRenderer.invoke('calendar:listAccounts'),
    listCalendars: (account: string) => ipcRenderer.invoke('calendar:listCalendars', account),
    addAccount: () => ipcRenderer.invoke('calendar:addAccount'),
    removeAccount: (account: string) => ipcRenderer.invoke('calendar:removeAccount', account),
    testConnection: (account: string) => ipcRenderer.invoke('calendar:testConnection', account),
    // Calendar aggregation service
    aggregate: (options?: {
      days?: number;
      includeGoogle?: boolean;
      includeMissionControl?: boolean;
      accounts?: string[];
    }) => ipcRenderer.invoke('calendar:aggregate', options),
    clearCache: (source?: 'google' | 'mission-control' | 'all') => 
      ipcRenderer.invoke('calendar:clearCache', source),
    cacheStats: () => ipcRenderer.invoke('calendar:cacheStats'),
  },
  // Connected Accounts (comprehensive account management)
  accounts: {
    list: () => ipcRenderer.invoke('connectedAccounts:list'),
    add: (accountType: string, options?: any) => ipcRenderer.invoke('connectedAccounts:add', accountType, options),
    remove: (accountId: string) => ipcRenderer.invoke('connectedAccounts:remove', accountId),
    getAvailableTypes: () => ipcRenderer.invoke('connectedAccounts:getAvailableTypes'),
    getPermissions: (accountId: string) => ipcRenderer.invoke('connectedAccounts:getPermissions', accountId),
    refresh: (accountId: string) => ipcRenderer.invoke('connectedAccounts:refresh', accountId),
    importGoogle: () => ipcRenderer.invoke('connectedAccounts:importGoogle'),
    // Legacy methods (old service)
    test: (accountId: string) => ipcRenderer.invoke('accounts:test', accountId),
  },
  // Sessions management - removed, renderer uses gateway.ts WebSocket directly
  // Shell execution (for Code Agent Dashboard, Context Control Board)
  exec: {
    run: (command: string) => ipcRenderer.invoke('exec:run', command),
    audit: (limit?: number) => ipcRenderer.invoke('exec:audit', limit),
    validate: (command: string) => ipcRenderer.invoke('exec:validate', command),
  },
  // Chat message persistence (froggo-db backed)
  agents: {
    list: () => ipcRenderer.invoke('agents:list'), // Fetch agents from gateway via 'clawdbot agents list'
    create: (config: { id: string; name: string; role: string; emoji: string; color: string; personality: string; voice?: string }) =>
      ipcRenderer.invoke('agents:create', config),
    getRegistry: () => ipcRenderer.invoke('agents:getRegistry'),
    getMetrics: () => ipcRenderer.invoke('agents:getMetrics'),
    getDetails: (agentId: string) => ipcRenderer.invoke('agents:getDetails', agentId),
    addSkill: (agentId: string, skill: string) => ipcRenderer.invoke('agents:addSkill', agentId, skill),
    updateSkill: (agentId: string, skillName: string, proficiency: number) =>
      ipcRenderer.invoke('agents:updateSkill', agentId, skillName, proficiency),
    search: (query: string) => ipcRenderer.invoke('agents:search', query),
    spawnChat: (agentId: string) => ipcRenderer.invoke('agents:spawnChat', agentId),
    chat: (sessionKey: string, message: string) => ipcRenderer.invoke('agents:chat', sessionKey, message),
    getActiveSessions: () => ipcRenderer.invoke('agents:getActiveSessions'),
    spawnForTask: (taskId: string, agentId: string) => ipcRenderer.invoke('agents:spawnForTask', taskId, agentId),
  },
  getAgentRegistry: () => ipcRenderer.invoke('get-agent-registry'),
  getPerformanceReport: (days: number) => ipcRenderer.invoke('get-performance-report', { days }),
  getAgentAudit: (agentId: string, days: number) => ipcRenderer.invoke('get-agent-audit', { agentId, days }),
  getDMHistory: (args?: { limit?: number; agent?: string }) => ipcRenderer.invoke('get-dm-history', args),
  getCircuitStatus: () => ipcRenderer.invoke('get-circuit-status'),
  chat: {
    saveMessage: (msg: { role: string; content: string; timestamp: number; sessionKey?: string }) =>
      ipcRenderer.invoke('chat:saveMessage', msg),
    loadMessages: (limit?: number, sessionKey?: string) =>
      ipcRenderer.invoke('chat:loadMessages', limit || 50, sessionKey),
    clearMessages: (sessionKey?: string) =>
      ipcRenderer.invoke('chat:clearMessages', sessionKey),
    suggestReplies: (context: { role: string; content: string }[]) =>
      ipcRenderer.invoke('chat:suggestReplies', context),
  },
  // Settings — API key management (safeStorage backed)
  settings: {
    getApiKey: (keyName: string) => ipcRenderer.invoke('settings:getApiKey', keyName),
    storeApiKey: (keyName: string, value: string) => ipcRenderer.invoke('settings:storeApiKey', keyName, value),
    hasApiKey: (keyName: string) => ipcRenderer.invoke('settings:hasApiKey', keyName),
    deleteApiKey: (keyName: string) => ipcRenderer.invoke('settings:deleteApiKey', keyName),
  },
  // Security management
  security: {
    listKeys: () => ipcRenderer.invoke('security:listKeys'),
    addKey: (key: { name: string; service: string; key: string }) =>
      ipcRenderer.invoke('security:addKey', key),
    deleteKey: (keyId: string) => ipcRenderer.invoke('security:deleteKey', keyId),
    listAuditLogs: () => ipcRenderer.invoke('security:listAuditLogs'),
    updateAuditLog: (logId: string, updates: { status?: string }) =>
      ipcRenderer.invoke('security:updateAuditLog', logId, updates),
    listAlerts: () => ipcRenderer.invoke('security:listAlerts'),
    dismissAlert: (alertId: string) => ipcRenderer.invoke('security:dismissAlert', alertId),
    runAudit: () => ipcRenderer.invoke('security:runAudit'),
  },
  // Export & Backup management
  exportBackup: {
    // Export functions
    exportTasks: (options: { format: 'json' | 'csv'; filters?: any }) =>
      ipcRenderer.invoke('export:tasks', options),
    exportAgentLogs: (options: { format: 'json' | 'csv'; filters?: any }) =>
      ipcRenderer.invoke('export:agentLogs', options),
    exportChatHistory: (options: { format: 'json' | 'csv'; filters?: any }) =>
      ipcRenderer.invoke('export:chatHistory', options),
    // Backup functions
    createBackup: (options?: { includeAttachments?: boolean }) =>
      ipcRenderer.invoke('backup:create', options),
    restoreBackup: (backupPath: string) =>
      ipcRenderer.invoke('backup:restore', backupPath),
    listBackups: () => ipcRenderer.invoke('backup:list'),
    cleanupOldBackups: (keepCount: number) =>
      ipcRenderer.invoke('backup:cleanup', keepCount),
    // Import functions
    importTasks: (filepath: string) =>
      ipcRenderer.invoke('import:tasks', filepath),
    // Statistics
    getStats: () => ipcRenderer.invoke('exportBackup:stats'),
  },
  // Starred Messages
  starred: {
    star: (messageId: number, note?: string, category?: string) =>
      ipcRenderer.invoke('starred:star', messageId, note, category),
    unstar: (identifier: number) =>
      ipcRenderer.invoke('starred:unstar', identifier),
    list: (options?: { category?: string; sessionKey?: string; limit?: number }) =>
      ipcRenderer.invoke('starred:list', options),
    search: (query: string, limit?: number) =>
      ipcRenderer.invoke('starred:search', query, limit),
    stats: () =>
      ipcRenderer.invoke('starred:stats'),
    check: (messageId: number) =>
      ipcRenderer.invoke('starred:check', messageId),
  },
  // HR Reports
  hrReports: {
    list: () => ipcRenderer.invoke('hrReports:list'),
    read: (filename: string) => ipcRenderer.invoke('hrReports:read', filename),
  },
  // X Automations
  xAutomations: {
    list: () => ipcRenderer.invoke('x-automations:list'),
    get: (id: string) => ipcRenderer.invoke('x-automations:get', id),
    create: (automation: {
      name: string;
      description?: string;
      trigger_type: string;
      trigger_config: string;
      conditions?: string;
      actions: string;
      max_executions_per_hour?: number;
      max_executions_per_day?: number;
    }) => ipcRenderer.invoke('x-automations:create', automation),
    update: (id: string, updates: {
      name?: string;
      description?: string;
      trigger_type?: string;
      trigger_config?: string;
      conditions?: string;
      actions?: string;
      max_executions_per_hour?: number;
      max_executions_per_day?: number;
    }) => ipcRenderer.invoke('x-automations:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('x-automations:delete', id),
    toggle: (id: string, enabled: boolean) => ipcRenderer.invoke('x-automations:toggle', id, enabled),
    executions: (automationId?: string, limit?: number) => 
      ipcRenderer.invoke('x-automations:executions', automationId, limit),
    rateLimit: (automationId: string) => ipcRenderer.invoke('x-automations:rate-limit', automationId),
  },
  // Widget API - dynamic agent widget loading
  widgetAPI: {
    scanManifest: (agentId: string) => ipcRenderer.invoke('widget:scan-manifest', agentId),
  },
  // Finance Module
  finance: {
    getTransactions: (limit?: number) => ipcRenderer.invoke('finance:getTransactions', limit),
    getBudgetStatus: (budgetType: 'family' | 'crypto') => ipcRenderer.invoke('finance:getBudgetStatus', budgetType),
    uploadCSV: (csvContent: string, filename: string) => ipcRenderer.invoke('finance:uploadCSV', csvContent, filename),
    getAlerts: () => ipcRenderer.invoke('finance:getAlerts'),
    getInsights: () => ipcRenderer.invoke('finance:getInsights'),
  },
  // Writing Module
  writing: {
    project: {
      list: () => ipcRenderer.invoke('writing:project:list'),
      create: (title: string, type: string) => ipcRenderer.invoke('writing:project:create', title, type),
      get: (projectId: string) => ipcRenderer.invoke('writing:project:get', projectId),
      update: (projectId: string, updates: any) => ipcRenderer.invoke('writing:project:update', projectId, updates),
      delete: (projectId: string) => ipcRenderer.invoke('writing:project:delete', projectId),
    },
    chapter: {
      list: (projectId: string) => ipcRenderer.invoke('writing:chapter:list', projectId),
      create: (projectId: string, title: string) => ipcRenderer.invoke('writing:chapter:create', projectId, title),
      read: (projectId: string, chapterId: string) => ipcRenderer.invoke('writing:chapter:read', projectId, chapterId),
      save: (projectId: string, chapterId: string, content: string) => ipcRenderer.invoke('writing:chapter:save', projectId, chapterId, content),
      rename: (projectId: string, chapterId: string, title: string) => ipcRenderer.invoke('writing:chapter:rename', projectId, chapterId, title),
      reorder: (projectId: string, chapterIds: string[]) => ipcRenderer.invoke('writing:chapter:reorder', projectId, chapterIds),
      delete: (projectId: string, chapterId: string) => ipcRenderer.invoke('writing:chapter:delete', projectId, chapterId),
    },
    feedback: {
      log: (projectId: string, entry: any) =>
        ipcRenderer.invoke('writing:feedback:log', projectId, entry),
      history: (projectId: string, chapterId: string) =>
        ipcRenderer.invoke('writing:feedback:history', projectId, chapterId),
    },
    memory: {
      characters: {
        list: (projectId: string) => ipcRenderer.invoke('writing:memory:characters:list', projectId),
        create: (projectId: string, data: any) => ipcRenderer.invoke('writing:memory:characters:create', projectId, data),
        update: (projectId: string, id: string, data: any) => ipcRenderer.invoke('writing:memory:characters:update', projectId, id, data),
        delete: (projectId: string, id: string) => ipcRenderer.invoke('writing:memory:characters:delete', projectId, id),
      },
      timeline: {
        list: (projectId: string) => ipcRenderer.invoke('writing:memory:timeline:list', projectId),
        create: (projectId: string, data: any) => ipcRenderer.invoke('writing:memory:timeline:create', projectId, data),
        update: (projectId: string, id: string, data: any) => ipcRenderer.invoke('writing:memory:timeline:update', projectId, id, data),
        delete: (projectId: string, id: string) => ipcRenderer.invoke('writing:memory:timeline:delete', projectId, id),
      },
      facts: {
        list: (projectId: string) => ipcRenderer.invoke('writing:memory:facts:list', projectId),
        create: (projectId: string, data: any) => ipcRenderer.invoke('writing:memory:facts:create', projectId, data),
        update: (projectId: string, id: string, data: any) => ipcRenderer.invoke('writing:memory:facts:update', projectId, id, data),
        delete: (projectId: string, id: string) => ipcRenderer.invoke('writing:memory:facts:delete', projectId, id),
      },
    },
  },
});

// Add to clawdbot object - chat message persistence
// Note: This needs to be merged into the existing contextBridge.exposeInMainWorld call
