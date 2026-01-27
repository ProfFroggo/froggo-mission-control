import { contextBridge, ipcRenderer } from 'electron';

// Detect if running in dev or prod mode via env var (set by start script)
const isDev = process.env.ELECTRON_DEV === '1';

contextBridge.exposeInMainWorld('clawdbot', {
  gateway: {
    status: () => ipcRenderer.invoke('gateway:status'),
    sessions: () => ipcRenderer.invoke('gateway:sessions'),
  },
  approvals: {
    read: () => ipcRenderer.invoke('approvals:read'),
    clear: () => ipcRenderer.invoke('approvals:clear'),
    remove: (id: string) => ipcRenderer.invoke('approvals:remove', id),
    onUpdate: (callback: (items: any[]) => void) => {
      ipcRenderer.on('approvals:updated', (_, items) => callback(items));
      return () => ipcRenderer.removeAllListeners('approvals:updated');
    },
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
  // Task sync to froggo-db
  tasks: {
    sync: (task: { id: string; title: string; status: string; project?: string; assignedTo?: string }) => 
      ipcRenderer.invoke('tasks:sync', task),
    update: (taskId: string, updates: { status?: string; assignedTo?: string }) =>
      ipcRenderer.invoke('tasks:update', taskId, updates),
    list: (status?: string) => ipcRenderer.invoke('tasks:list', status),
    start: (taskId: string) => ipcRenderer.invoke('tasks:start', taskId),
    complete: (taskId: string, outcome?: string) => ipcRenderer.invoke('tasks:complete', taskId, outcome),
  },
  // Rejection logging
  rejections: {
    log: (rejection: { type: string; title: string; content?: string; reason?: string }) =>
      ipcRenderer.invoke('rejections:log', rejection),
  },
  // Inbox (froggo-db backed)
  inbox: {
    list: (status?: string) => ipcRenderer.invoke('inbox:list', status),
    add: (item: { type: string; title: string; content: string; context?: string; channel?: string }) =>
      ipcRenderer.invoke('inbox:add', item),
    update: (id: number, updates: { status?: string; feedback?: string }) =>
      ipcRenderer.invoke('inbox:update', id, updates),
    approveAll: () => ipcRenderer.invoke('inbox:approveAll'),
  },
  // Filesystem
  fs: {
    writeBase64: (path: string, base64: string) => ipcRenderer.invoke('fs:writeBase64', path, base64),
    readFile: (path: string, encoding?: string) => ipcRenderer.invoke('fs:readFile', path, encoding),
  },
  // Library
  library: {
    list: (category?: string) => ipcRenderer.invoke('library:list', category),
    upload: () => ipcRenderer.invoke('library:upload'),
    delete: (fileId: string) => ipcRenderer.invoke('library:delete', fileId),
    link: (fileId: string, taskId: string) => ipcRenderer.invoke('library:link', fileId, taskId),
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
  // System status
  system: {
    status: () => ipcRenderer.invoke('system:status'),
  },
  // Settings
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings: any) => ipcRenderer.invoke('settings:save', settings),
  },
  // Execution
  execute: {
    tweet: (content: string, taskId?: string) => ipcRenderer.invoke('execute:tweet', content, taskId),
  },
  // Twitter (bird CLI)
  twitter: {
    mentions: () => ipcRenderer.invoke('twitter:mentions'),
    home: (limit?: number) => ipcRenderer.invoke('twitter:home', limit),
    queuePost: (text: string, context?: string) => ipcRenderer.invoke('twitter:queue-post', text, context),
  },
  // Email (gog CLI)
  email: {
    unread: (account?: string) => ipcRenderer.invoke('email:unread', account),
    search: (query: string, account?: string) => ipcRenderer.invoke('email:search', query, account),
    queueSend: (to: string, subject: string, body: string, account?: string) => 
      ipcRenderer.invoke('email:queue-send', to, subject, body, account),
  },
  // Calendar (gog CLI)
  calendar: {
    events: (account?: string, days?: number) => ipcRenderer.invoke('calendar:events', account, days),
    today: () => ipcRenderer.invoke('calendar:events', undefined, 1), // Convenience for today's events
  },
  // Sessions management
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    history: (sessionKey: string, limit?: number) => ipcRenderer.invoke('sessions:history', sessionKey, limit),
  },
  // Shell execution (for Code Agent Dashboard, Context Control Board)
  exec: {
    run: (command: string) => ipcRenderer.invoke('exec:run', command),
  },
});
