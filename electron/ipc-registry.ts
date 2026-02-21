/**
 * IPC Handler Registration Module
 * 
 * Central registry for all IPC handlers to ensure consistent registration
 * and avoid duplicate handler errors.
 */
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { createLogger } from './utils/logger';

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

/**
 * Validate that a module IPC channel follows the required `module-{moduleId}:` prefix convention.
 *
 * Returns `true` for valid channels, `false` for violations.
 * Violations are logged at ERROR level but do NOT prevent registration (backward compatible).
 *
 * @example
 * validateModuleChannel('finance', 'module-finance:transactions:get') // true
 * validateModuleChannel('finance', 'finance:getTransactions')         // false — logs ERROR
 */
export function validateModuleChannel(moduleId: string, channel: string): boolean {
  const expectedPrefix = `module-${moduleId}:`;
  if (!channel.startsWith(expectedPrefix)) {
    logger.error(
      `[IPC] NAMESPACE VIOLATION: module "${moduleId}" registered channel "${channel}" without required prefix "${expectedPrefix}"`
    );
    return false;
  }
  return true;
}

/**
 * Register an IPC handler for a module, enforcing the `module-{moduleId}:` channel namespace.
 *
 * Modules should use this instead of `registerHandler` for their IPC channels.
 * Channel names should follow the `module-{moduleId}:noun:verb` convention, e.g.:
 *   - `module-finance:transactions:get`
 *   - `module-analytics:events:list`
 *
 * Namespace violations (channels not starting with `module-{moduleId}:`) are logged at ERROR
 * level but are NOT blocked — this ensures backward compatibility during migration of existing
 * channels to the namespaced convention. Full enforcement is deferred to a future phase.
 *
 * Provides the same dedup protection as `registerHandler`.
 */
export function registerModuleHandler<TArgs extends unknown[], TReturn>(
  moduleId: string,
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: TArgs) => TReturn
): void {
  validateModuleChannel(moduleId, channel);
  registerHandler(channel, handler);
}
