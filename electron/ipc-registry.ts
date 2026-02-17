/**
 * IPC Handler Registration Module
 * 
 * Central registry for all IPC handlers to ensure consistent registration
 * and avoid duplicate handler errors.
 */
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('IPC');
const registeredHandlers = new Set<string>();

/**
 * Generic type for IPC handler arguments
 */
export type IpcHandlerArgs<T extends unknown[]> = T;

/**
 * Generic type for IPC handler return value
 */
export type IpcHandlerReturn<T> = Promise<T> | T;

/**
 * Type-safe IPC handler function
 */
export type IpcHandler<TArgs extends unknown[] = unknown[], TReturn = unknown> = (
  event: IpcMainInvokeEvent,
  ...args: TArgs
) => IpcHandlerReturn<TReturn>;

/**
 * Interface for IPC channel registration
 */
export interface IpcChannelRegistration<TArgs extends unknown[] = unknown[], TReturn = unknown> {
  channel: string;
  handler: IpcHandler<TArgs, TReturn>;
}

/**
 * Safely register an IPC handler, skipping if already registered
 */
export function registerHandler<TArgs extends unknown[], TReturn>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: TArgs) => TReturn
): void {
  if (registeredHandlers.has(channel)) {
    logger.warn(`[IPC] Handler '${channel}' already registered, skipping`);
    return;
  }
  
  registeredHandlers.add(channel);
  ipcMain.handle(channel, handler as IpcHandler);
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
