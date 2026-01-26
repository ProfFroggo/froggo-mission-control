import { contextBridge, ipcRenderer } from 'electron';

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
  // Vosk real-time streaming API
  vosk: {
    check: () => ipcRenderer.invoke('vosk:check'),
    start: (sampleRate?: number) => ipcRenderer.invoke('vosk:start', sampleRate),
    audio: (audioData: ArrayBuffer) => ipcRenderer.invoke('vosk:audio', audioData),
    final: (reset?: boolean) => ipcRenderer.invoke('vosk:final', reset),
    stop: () => ipcRenderer.invoke('vosk:stop'),
  },
  // Whisper (legacy/fallback)
  whisper: {
    check: () => ipcRenderer.invoke('whisper:check'),
    transcribe: (audioData: ArrayBuffer) => ipcRenderer.invoke('whisper:transcribe', audioData),
  },
  platform: process.platform,
});
