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
  },
  // Execution
  execute: {
    tweet: (content: string, taskId?: string) => ipcRenderer.invoke('execute:tweet', content, taskId),
  },
  // Sessions management
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    history: (sessionKey: string, limit?: number) => ipcRenderer.invoke('sessions:history', sessionKey, limit),
  },
});
