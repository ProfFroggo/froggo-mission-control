/**
 * Module State Handlers
 *
 * Core infrastructure IPC handlers for module enable/disable state persistence.
 * Saves/loads the list of disabled module IDs to ~/froggo/data/module-state.json.
 *
 * Uses registerHandler() (NOT registerModuleHandler()) — these are core infrastructure
 * channels, not module-owned. Same pattern as module:ipc:removeHandlers.
 */

import * as fs from 'fs';
import { ipcMain } from 'electron';
import { BrowserWindow } from 'electron';
import { registerHandler } from '../ipc-registry';
import { MODULE_STATE_PATH } from '../paths';
import { createLogger } from '../utils/logger';

const logger = createLogger('ModuleState');

interface ModuleState {
  version: 1;
  disabled: string[];
  known?: string[];
  updatedAt: number;
}

function readState(): ModuleState {
  try {
    if (fs.existsSync(MODULE_STATE_PATH)) {
      const raw = fs.readFileSync(MODULE_STATE_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    logger.error('[ModuleState] Failed to read state file:', err);
  }
  return { version: 1, disabled: [], updatedAt: Date.now() };
}

function writeState(state: ModuleState): void {
  try {
    fs.writeFileSync(MODULE_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    logger.error('[ModuleState] Failed to write state file:', err);
  }
}

/** In-memory cache for sync access from preload */
let cachedDisabled: string[] = [];

export function getDisabledModules(): string[] {
  return cachedDisabled;
}

export function registerModuleStateHandlers(): void {
  // Load initial state into cache at registration time
  const initial = readState();
  cachedDisabled = initial.disabled;

  // Load disabled module list — called by ModuleLoader.initAll()
  registerHandler('module:state:load', async () => {
    const state = readState();
    cachedDisabled = state.disabled;
    return { disabled: state.disabled, known: state.known || [] };
  });

  // Save module state — called by ModuleLoader.disableModule/enableModule
  registerHandler('module:state:save', async (_event, moduleId: string, enabled: boolean) => {
    const state = readState();
    if (enabled) {
      state.disabled = state.disabled.filter(id => id !== moduleId);
    } else {
      if (!state.disabled.includes(moduleId)) {
        state.disabled.push(moduleId);
      }
    }
    // Also mark as known so defaultDisabled doesn't re-trigger
    if (!state.known) state.known = [];
    if (!state.known.includes(moduleId)) {
      state.known.push(moduleId);
    }
    state.updatedAt = Date.now();
    writeState(state);
    cachedDisabled = state.disabled;

    // Notify renderer of state change (for preload interception updates)
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('module-state-changed', { disabled: state.disabled });
    }

    return { success: true };
  });

  // Mark module as known — called by ModuleLoader.initAll() for defaultDisabled tracking
  registerHandler('module:state:markKnown', async (_event, moduleId: string) => {
    const state = readState();
    if (!state.known) state.known = [];
    if (!state.known.includes(moduleId)) {
      state.known.push(moduleId);
      state.updatedAt = Date.now();
      writeState(state);
    }
    return { success: true };
  });

  // Sync handler for preload to get disabled channels at startup
  // Returns module ID list — preload intercepts their IPC channels
  ipcMain.on('module:state:getDisabledSync', (event) => {
    event.returnValue = { disabled: cachedDisabled };
  });
}
