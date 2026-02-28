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

const isDev = process.env.ELECTRON_DEV === '1';

/** Allowed origins for IPC sender validation */
const ALLOWED_ORIGINS: string[] = isDev
  ? ['http://localhost:5173']
  : ['file://'];

/**
 * Validate that an IPC event comes from an allowed origin.
 * Returns true if the sender's URL origin matches the allowed list.
 * In production, Electron file:// URLs have origin "null" (string) — we normalize this to "file://".
 */
function validateSender(event: IpcMainInvokeEvent): boolean {
  try {
    const senderUrl = event.senderFrame?.url;
    if (!senderUrl) return false;

    // file:// URLs return origin "null" — normalize
    let origin: string;
    try {
      const parsed = new URL(senderUrl);
      origin = parsed.origin === 'null' ? 'file://' : parsed.origin;
    } catch {
      return false;
    }

    return ALLOWED_ORIGINS.includes(origin);
  } catch {
    return false;
  }
}

/** Tracks which IPC channels belong to each module (moduleId -> Set of channels) */
const moduleHandlers = new Map<string, Set<string>>();

/** Persistent handler factories — survives unregisterModuleHandlers() so re-registration works */
const moduleFactories = new Map<string, Map<string, IpcHandler>>();

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
  ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    if (!validateSender(event)) {
      logger.error(`[IPC] BLOCKED: unauthorized sender for '${channel}' from ${event.senderFrame?.url || 'unknown'}`);
      throw new Error('IPC access denied: unauthorized origin');
    }
    return (handler as IpcHandler)(event, ...args);
  });
}

/**
 * Unregister an IPC handler and remove it from the dedup guard.
 * After calling this, the channel can be re-registered with registerHandler().
 */
export function unregisterHandler(channel: string): void {
  if (!registeredHandlers.has(channel)) {
    logger.warn(`[IPC] unregisterHandler: '${channel}' not registered, skipping`);
    return;
  }
  ipcMain.removeHandler(channel);
  registeredHandlers.delete(channel);
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

  // Track channel ownership for module lifecycle
  if (!moduleHandlers.has(moduleId)) {
    moduleHandlers.set(moduleId, new Set());
  }
  moduleHandlers.get(moduleId)!.add(channel);

  // Store factory for re-registration (persistent — not cleared on unregister)
  if (!moduleFactories.has(moduleId)) moduleFactories.set(moduleId, new Map());
  moduleFactories.get(moduleId)!.set(channel, handler as IpcHandler);
}

/**
 * Unregister all IPC handlers belonging to a module.
 * Clears from both ipcMain and the dedup guard so handlers can be re-registered on enable.
 */
export function unregisterModuleHandlers(moduleId: string): number {
  const channels = moduleHandlers.get(moduleId);
  if (!channels || channels.size === 0) {
    logger.info(`[IPC] unregisterModuleHandlers: no handlers tracked for module "${moduleId}"`);
    return 0;
  }
  let count = 0;
  for (const channel of channels) {
    unregisterHandler(channel);
    count++;
  }
  moduleHandlers.delete(moduleId);
  logger.info(`[IPC] Removed ${count} handler(s) for module "${moduleId}"`);
  return count;
}

/**
 * Re-register all previously registered IPC handlers for a module using stored factories.
 *
 * Used during module re-enable: after unregisterModuleHandlers() clears the dedup guard,
 * this replays the factories to restore handlers without requiring a full app restart.
 *
 * Returns the count of re-registered handlers. Returns 0 if no factories stored.
 */
export function reregisterModuleHandlers(moduleId: string): number {
  const factories = moduleFactories.get(moduleId);
  if (!factories || factories.size === 0) {
    logger.info(`[IPC] reregisterModuleHandlers: no factories stored for module "${moduleId}"`);
    return 0;
  }

  // Ensure moduleHandlers tracking is fresh for this module
  if (!moduleHandlers.has(moduleId)) {
    moduleHandlers.set(moduleId, new Set());
  }

  let count = 0;
  for (const [channel, handler] of factories) {
    // registerHandler has a dedup guard — unregisterModuleHandlers() cleared it, so this re-registers cleanly
    registerHandler(channel, handler);
    moduleHandlers.get(moduleId)!.add(channel);
    count++;
  }

  logger.info(`[IPC] Re-registered ${count} handler(s) for module "${moduleId}"`);
  return count;
}

/**
 * IPC bridge: renderer calls this to trigger handler removal for a disabled module.
 * Registered eagerly so it's always available (it's a core lifecycle channel, not module-owned).
 */
ipcMain.handle('module:ipc:removeHandlers', (event, moduleId: string) => {
  if (!validateSender(event)) {
    logger.error('[IPC] BLOCKED: unauthorized sender for module:ipc:removeHandlers');
    throw new Error('IPC access denied: unauthorized origin');
  }
  const count = unregisterModuleHandlers(moduleId);
  return { success: true, removed: count };
});
registeredHandlers.add('module:ipc:removeHandlers');

/**
 * IPC bridge: renderer calls this to trigger handler re-registration for a re-enabled module.
 * Registered eagerly alongside module:ipc:removeHandlers — it's a core lifecycle channel.
 */
ipcMain.handle('module:ipc:registerHandlers', (event, moduleId: string) => {
  if (!validateSender(event)) {
    logger.error('[IPC] BLOCKED: unauthorized sender for module:ipc:registerHandlers');
    throw new Error('IPC access denied: unauthorized origin');
  }
  const count = reregisterModuleHandlers(moduleId);
  return { success: true, registered: count };
});
registeredHandlers.add('module:ipc:registerHandlers');
