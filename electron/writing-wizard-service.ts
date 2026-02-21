/**
 * Writing Wizard Service — wizard state persistence.
 *
 * Storage layout:
 *   ~/froggo/writing-projects/_wizard-state/{sessionId}/
 *     wizard-state.json  — serialized wizard state (step, messages, plan, etc.)
 *
 * Wizard state lives outside project directories because the project
 * doesn't exist yet during the wizard flow. State is cleaned up on
 * wizard completion or cancellation.
 */

import { registerHandler } from './ipc-registry';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from './utils/logger';

const logger = createLogger('WritingWizard');
import { WIZARD_STATE_DIR } from './paths';

// ── Helpers ──

async function saveWizardState(sessionId: string, state: Record<string, unknown>) {
  try {
    const dir = path.join(WIZARD_STATE_DIR, sessionId);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(
      path.join(dir, 'wizard-state.json'),
      JSON.stringify(state, null, 2),
      'utf-8',
    );
    return { success: true };
  } catch (e: any) {
    logger.error('[writing-wizard] saveWizardState error:', e instanceof Error ? e.message : String(e));
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function loadWizardState(sessionId: string) {
  try {
    const filepath = path.join(WIZARD_STATE_DIR, sessionId, 'wizard-state.json');
    const raw = await fs.promises.readFile(filepath, 'utf-8');
    return { success: true, state: JSON.parse(raw) };
  } catch (err) {
    const error = err as { code?: string; message?: string };
    if (error.code === 'ENOENT') return { success: true, state: null };
    logger.error('[writing-wizard] loadWizardState error:', error.message);
    return { success: false, error: error.message };
  }
}

async function listPendingWizards() {
  try {
    await fs.promises.mkdir(WIZARD_STATE_DIR, { recursive: true });
    const entries = await fs.promises.readdir(WIZARD_STATE_DIR, { withFileTypes: true });
    const wizards = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const stateFile = path.join(WIZARD_STATE_DIR, entry.name, 'wizard-state.json');
        const raw = await fs.promises.readFile(stateFile, 'utf-8');
        const state = JSON.parse(raw);
        if (state.step !== 'complete') {
          wizards.push({ sessionId: entry.name, ...state });
        }
      } catch {
        // Skip invalid entries
      }
    }

    return { success: true, wizards };
  } catch (e: any) {
    logger.error('[writing-wizard] listPendingWizards error:', e instanceof Error ? e.message : String(e));
    return { success: false, error: e instanceof Error ? e.message : String(e), wizards: [] };
  }
}

async function deleteWizardState(sessionId: string) {
  try {
    await fs.promises.rm(path.join(WIZARD_STATE_DIR, sessionId), {
      recursive: true,
      force: true,
    });
    return { success: true };
  } catch (e: any) {
    logger.error('[writing-wizard] deleteWizardState error:', e.message);
    return { success: false, error: e.message };
  }
}

// ── IPC Registration ──

export function registerWritingWizardHandlers() {
  registerHandler('writing:wizard:save', async (_, sessionId: string, state: any) =>
    saveWizardState(sessionId, state),
  );
  registerHandler('writing:wizard:load', async (_, sessionId: string) =>
    loadWizardState(sessionId),
  );
  registerHandler('writing:wizard:list', async () => listPendingWizards());
  registerHandler('writing:wizard:delete', async (_, sessionId: string) =>
    deleteWizardState(sessionId),
  );

  logger.debug('[writing-wizard] IPC handlers registered');
}
