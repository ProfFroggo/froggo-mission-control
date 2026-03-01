/**
 * Module Credential + Integration Handlers
 *
 * Channels:
 *   module:cred:store, module:cred:status, module:cred:delete, module:uninstall
 *   module:integration:get, module:integration:upsert, module:integration:complete
 *   module:health:test
 *
 * Cross-module infrastructure — uses registerHandler (not registerModuleHandler)
 * because these channels are not namespaced to a single module.
 *
 * 8 registerHandler calls total.
 */

import { dialog } from 'electron';
import crypto from 'node:crypto';
import { registerHandler } from '../ipc-registry';
import { getDb } from '../database';
import {
  storeModuleSecret,
  hasModuleSecret,
  getModuleCredentialStatus,
  deleteModuleCredentials,
} from '../secret-store';
import { writeBridgeFile, deleteBridgeFile, deleteModuleBridgeDir } from '../cred-store-bridge';
import { createLogger } from '../utils/logger';

const logger = createLogger('ModuleCreds');

export function registerModuleCredentialHandlers(): void {
  registerHandler(
    'module:cred:store',
    async (_event, moduleId: string, credentialId: string, value: string) => {
      try {
        storeModuleSecret(moduleId, credentialId, value);
        writeBridgeFile(moduleId, credentialId, value);
        return { success: true };
      } catch (err: unknown) {
        logger.error('[ModuleCreds] store error:', err.message);
        return { success: false, error: err.message };
      }
    },
  );

  registerHandler(
    'module:cred:status',
    async (_event, moduleId: string, credentialIds: string[]) => {
      try {
        const status = getModuleCredentialStatus(
          moduleId,
          credentialIds.map(id => ({ id })),
        );
        const details = credentialIds.map(id => ({ id, set: hasModuleSecret(moduleId, id) }));
        return { success: true, status, details };
      } catch (err: unknown) {
        logger.error('[ModuleCreds] status error:', err.message);
        return { success: false, status: 'red' as const, details: [] };
      }
    },
  );

  registerHandler(
    'module:cred:delete',
    async (_event, moduleId: string, credentialIds: string[]) => {
      try {
        deleteModuleCredentials(moduleId, credentialIds);
        for (const credentialId of credentialIds) {
          deleteBridgeFile(moduleId, credentialId);
        }
        deleteModuleBridgeDir(moduleId);
        return { success: true };
      } catch (err: unknown) {
        logger.error('[ModuleCreds] delete error:', err.message);
        return { success: false, error: err.message };
      }
    },
  );

  registerHandler(
    'module:uninstall',
    async (_event, moduleId: string, credentialIds: string[]) => {
      try {
        const { response } = await dialog.showMessageBox({
          type: 'warning',
          title: 'Uninstall Module',
          message: `Remove "${moduleId}" and all its credentials?`,
          detail: 'All stored credentials for this module will be permanently deleted. This cannot be undone.',
          buttons: ['Cancel', 'Delete Credentials'],
          defaultId: 0,
          cancelId: 0,
        });

        if (response !== 1) {
          return { success: false, cancelled: true };
        }

        deleteModuleCredentials(moduleId, credentialIds);
        for (const credentialId of credentialIds) {
          deleteBridgeFile(moduleId, credentialId);
        }
        deleteModuleBridgeDir(moduleId);
        logger.info(`Module "${moduleId}" credentials removed`);
        return { success: true };
      } catch (err: unknown) {
        logger.error('[ModuleCreds] uninstall error:', err.message);
        return { success: false, error: err.message };
      }
    },
  );
}

export function registerModuleIntegrationHandlers(): void {
  // Handler 1: module:integration:get
  // Returns or creates integration state for a module
  registerHandler(
    'module:integration:get',
    async (_event, moduleId: string) => {
      try {
        const row = getDb().prepare('SELECT * FROM module_integrations WHERE module_id = ?').get(moduleId) as Record<string, unknown> | undefined;
        if (row) {
          return {
            success: true,
            integration: {
              ...row,
              wizard_data: JSON.parse((row.wizard_data as string) || '{}'),
            },
          };
        }

        // No row — create a new pending integration record
        const id = crypto.randomUUID();
        const now = Date.now();
        getDb().prepare(
          `INSERT INTO module_integrations (id, module_id, status, wizard_step, wizard_data, created_at, updated_at)
           VALUES (?, ?, 'pending', 0, '{}', ?, ?)`,
        ).run(id, moduleId, now, now);

        return {
          success: true,
          integration: {
            id,
            module_id: moduleId,
            status: 'pending',
            wizard_step: 0,
            wizard_data: {},
            completed_at: null,
            created_at: now,
            updated_at: now,
          },
        };
      } catch (err: unknown) {
        logger.error('[ModuleIntegration] get error:', err.message);
        return { success: false, error: err.message };
      }
    },
  );

  // Handler 2: module:integration:upsert
  // Persists wizard step progress
  registerHandler(
    'module:integration:upsert',
    async (_event, moduleId: string, step: number, wizardData: Record<string, unknown>) => {
      try {
        getDb().prepare(
          `UPDATE module_integrations SET wizard_step = ?, wizard_data = ?, updated_at = ? WHERE module_id = ?`,
        ).run(step, JSON.stringify(wizardData), Date.now(), moduleId);
        return { success: true };
      } catch (err: unknown) {
        logger.error('[ModuleIntegration] upsert error:', err.message);
        return { success: false, error: err.message };
      }
    },
  );

  // Handler 3: module:integration:complete
  // Marks integration as active with completion timestamp
  registerHandler(
    'module:integration:complete',
    async (_event, moduleId: string) => {
      try {
        const now = Date.now();
        getDb().prepare(
          `UPDATE module_integrations SET status = 'active', completed_at = ?, updated_at = ? WHERE module_id = ?`,
        ).run(now, now, moduleId);
        return { success: true };
      } catch (err: unknown) {
        logger.error('[ModuleIntegration] complete error:', err.message);
        return { success: false, error: err.message };
      }
    },
  );

  // Handler 4: module:health:test
  // Performs HTTP health check against the resolved URL
  registerHandler(
    'module:health:test',
    async (
      _event,
      _moduleId: string,
      healthCheckConfig: {
        type: string;
        credentialId?: string;
        url?: string;
        method?: string;
        successStatus?: number;
      } | null,
      credentialValues: Record<string, string>,
    ) => {
      try {
        // No health check config = synthetic pass
        if (!healthCheckConfig) {
          return { success: true, synthetic: true };
        }

        // Resolve test URL
        const testUrl = healthCheckConfig.credentialId
          ? credentialValues[healthCheckConfig.credentialId]
          : healthCheckConfig.url;

        if (!testUrl) {
          return { success: false, error: 'No URL to test' };
        }

        const method = healthCheckConfig.method || 'GET';
        const successStatus = healthCheckConfig.successStatus || 200;

        // Fetch with 10-second timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);

        try {
          const response = await fetch(testUrl, {
            method,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (response.ok || response.status === successStatus) {
            return { success: true, status: response.status };
          }

          const rawError = await response.text().catch(() => '');
          return {
            success: false,
            error: `HTTP ${response.status}`,
            rawError,
          };
        } catch (fetchErr: unknown) {
          clearTimeout(timeoutId);
          return {
            success: false,
            error: fetchErr.message,
            rawError: String(fetchErr),
          };
        }
      } catch (err: unknown) {
        logger.error('[ModuleIntegration] health:test error:', err.message);
        return { success: false, error: err.message };
      }
    },
  );
}
