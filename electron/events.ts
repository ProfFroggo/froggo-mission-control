/**
 * Event Emitter Module
 * 
 * For real-time updates to the Dashboard
 */
import { BrowserWindow } from 'electron';

export function emitTaskEvent(event: string, taskId: string): void {
  // Notify all renderer windows of task updates
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('task-event', { event, taskId });
  });
}

export function emitAgentEvent(event: string, agentId: string, data?: any): void {
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('agent-event', { event, agentId, data });
  });
}

export function emitNotificationEvent(event: string, data: any): void {
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('notification-event', { event, data });
  });
}
