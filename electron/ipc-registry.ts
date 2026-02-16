/**
 * IPC Handler Registration Module
 * 
 * Central registry for all IPC handlers to ensure consistent registration
 * and avoid duplicate handler errors.
 */
import { ipcMain } from 'electron';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('IPC');
const registeredHandlers = new Set<string>();

/**
 * Safely register an IPC handler, skipping if already registered
 */
export function registerHandler(channel: string, handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any): void {
  if (registeredHandlers.has(channel)) {
    logger.warn(`[IPC] Handler '${channel}' already registered, skipping`);
    return;
  }
  
  registeredHandlers.add(channel);
  ipcMain.handle(channel, handler);
}

/**
 * Check if a handler is already registered
 */
export function isHandlerRegistered(channel: string): boolean {
  return registeredHandlers.has(channel);
}

/**
 * Get list of all registered handlers (for debugging)
 */
export function getRegisteredHandlers(): string[] {
  return Array.from(registeredHandlers);
}

/**
 * Clear all registrations (useful for testing)
 */
export function clearRegistrations(): void {
  registeredHandlers.clear();
}
