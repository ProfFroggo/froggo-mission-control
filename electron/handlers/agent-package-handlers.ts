/**
 * Agent Package Handlers
 *
 * IPC handlers for the agent package lifecycle:
 *   agent-package:install   — provision workspace + register openclaw.json + track in DB
 *   agent-package:uninstall — confirmation dialog + unregister + purge creds + delete DB row
 *   agent-package:status    — check if a package is installed by ID
 *   agent-package:list      — list all installed agent packages
 *
 * Install sequence:
 *   1. provisionAgentWorkspace — create ~/agent-{id}/ atomically (staging-then-rename)
 *   2. registerAgentInOpenClaw — add to openclaw.json (temp-file-then-rename)
 *   3. INSERT OR REPLACE into installed_agents
 *   Rollback: if step 2 fails, workspace is removed via fs.rmSync.
 *
 * Uninstall: workspace directory is RETAINED (per plan spec).
 * A concurrent install guard prevents race conditions.
 */

import * as fs from 'node:fs';
import { dialog } from 'electron';
import { registerHandler } from '../ipc-registry';
import { getDb } from '../database';
import { deleteModuleBridgeDir } from '../cred-store-bridge';
import {
  provisionAgentWorkspace,
  registerAgentInOpenClaw,
  unregisterAgentFromOpenClaw,
} from '../agent-provisioner';
import type { RegistryEntry } from '../marketplace-schema';
import { createLogger } from '../utils/logger';

const logger = createLogger('AgentPackage');

// ── Concurrent install guard ───────────────────────────────────────────────────

let installInProgress = false;

// ── Handler registration ──────────────────────────────────────────────────────

export function registerAgentPackageHandlers(): void {
  // Handler 1: agent-package:install
  // Provisions workspace, registers in openclaw.json, tracks in installed_agents.
  registerHandler('agent-package:install', async (_event, entry: RegistryEntry) => {
    if (installInProgress) {
      return { success: false, error: 'Another agent installation is in progress' };
    }

    if (!entry.agent) {
      return { success: false, error: 'Not an agent package' };
    }

    installInProgress = true;
    try {
      const { agentId, soulPreview, templateFiles: registryTemplateFiles, credentials } = entry.agent;

      // Build templateFiles: use registry-provided Record<filename, content> if present,
      // otherwise generate a minimal set from the soulPreview.
      const templateFiles: Record<string, string> = registryTemplateFiles
        ? { ...registryTemplateFiles }
        : {
            'SOUL.md': soulPreview,
            'IDENTITY.md': `# ${entry.name}\n`,
            'MEMORY.md': '# Memory\n',
            'STATE.md': '# State\n\nNewly installed.\n',
          };

      // Step 1: Provision workspace atomically
      const provisionResult = provisionAgentWorkspace({ agentId, templateFiles });
      if (!provisionResult.success) {
        logger.error(`[AgentPackage] Provision failed for "${agentId}":`, provisionResult.error);
        return { success: false, error: provisionResult.error };
      }

      const workspacePath = provisionResult.workspacePath!;

      // Step 2: Register in openclaw.json (temp-file-then-rename)
      const registerResult = registerAgentInOpenClaw(agentId, workspacePath);
      if (!registerResult.success) {
        logger.error(`[AgentPackage] openclaw.json registration failed for "${agentId}":`, registerResult.error);
        // Rollback: remove the provisioned workspace
        try {
          fs.rmSync(workspacePath, { recursive: true, force: true });
        } catch (cleanupErr: unknown) {
          logger.error(`[AgentPackage] Workspace rollback failed:`, cleanupErr.message);
        }
        return { success: false, error: registerResult.error };
      }

      // Step 3: Insert into installed_agents
      const now = Date.now();
      getDb().prepare(
        `INSERT OR REPLACE INTO installed_agents
         (id, agent_id, name, installed_version, workspace_path, installed_at, updated_at, source, sha256, registry_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'marketplace', ?, ?)`,
      ).run(
        entry.id,
        agentId,
        entry.name,
        entry.version,
        workspacePath,
        now,
        now,
        entry.sha256 ?? '',
        null,
      );

      logger.info(`[AgentPackage] Installed agent "${agentId}" from package "${entry.id}" v${entry.version}`);
      return {
        success: true,
        agentId,
        workspacePath,
        needsCredentials: (credentials?.length ?? 0) > 0,
        gatewayRestartRequired: true,
      };

    } catch (err: unknown) {
      logger.error('[AgentPackage] install error:', err.message);
      return { success: false, error: err.message ?? String(err) };
    } finally {
      installInProgress = false;
    }
  });

  // Handler 2: agent-package:uninstall
  // Shows confirmation dialog, unregisters from openclaw.json, purges credentials, deletes DB row.
  // Workspace directory is RETAINED per spec.
  registerHandler('agent-package:uninstall', async (_event, packageId: string) => {
    try {
      // Look up the installed agent by package ID
      const row = getDb().prepare('SELECT * FROM installed_agents WHERE id = ?').get(packageId) as Record<string, unknown> | undefined;
      if (!row) {
        return { success: false, error: `Agent package "${packageId}" is not installed` };
      }

      const agentName = row.name as string;
      const agentId = row.agent_id as string;
      const workspacePath = row.workspace_path as string;

      // Show confirmation dialog
      const { response } = await dialog.showMessageBox({
        type: 'warning',
        title: 'Uninstall Agent',
        message: `Uninstall "${agentName}"?`,
        detail: `This will remove the agent from openclaw.json and purge credentials. The workspace directory at ${workspacePath} will be retained.`,
        buttons: ['Cancel', 'Uninstall'],
        defaultId: 0,
        cancelId: 0,
      });

      if (response !== 1) {
        return { success: true, uninstalled: false };
      }

      // Unregister from openclaw.json
      const unregResult = unregisterAgentFromOpenClaw(agentId);
      if (!unregResult.success) {
        logger.error(`[AgentPackage] Unregister failed for "${agentId}":`, unregResult.error);
        return { success: false, error: unregResult.error };
      }

      // Purge credentials from dispatcher bridge dir
      deleteModuleBridgeDir(packageId);

      // Delete DB row
      getDb().prepare('DELETE FROM installed_agents WHERE id = ?').run(packageId);

      logger.info(`[AgentPackage] Uninstalled agent package "${packageId}" (workspace retained at ${workspacePath})`);
      return { success: true, uninstalled: true, gatewayRestartRequired: true };

    } catch (err: unknown) {
      logger.error('[AgentPackage] uninstall error:', err.message);
      return { success: false, error: err.message ?? String(err) };
    }
  });

  // Handler 3: agent-package:status
  // Check if an agent package is installed by its package ID.
  registerHandler('agent-package:status', async (_event, packageId: string) => {
    try {
      const row = getDb().prepare('SELECT * FROM installed_agents WHERE id = ?').get(packageId) as Record<string, unknown> | undefined;
      return {
        success: true,
        installed: !!row,
        agent: row ?? null,
      };
    } catch (err: unknown) {
      logger.error('[AgentPackage] status error:', err.message);
      return { success: false, installed: false, agent: null, error: err.message };
    }
  });

  // Handler 4: agent-package:list
  // List all installed agent packages ordered by install time (newest first).
  registerHandler('agent-package:list', async (_event) => {
    try {
      const rows = getDb().prepare('SELECT * FROM installed_agents ORDER BY installed_at DESC').all() as Array<Record<string, unknown>>;
      return { success: true, agents: rows };
    } catch (err: unknown) {
      logger.error('[AgentPackage] list error:', err.message);
      return { success: false, agents: [], error: err.message };
    }
  });
}
