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
  platform: process.platform,
});
