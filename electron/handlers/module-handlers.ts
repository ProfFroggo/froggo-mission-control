/**
 * Module Credential Handlers
 *
 * Channels: module:cred:store, module:cred:status, module:cred:delete, module:uninstall
 *
 * Cross-module infrastructure — uses registerHandler (not registerModuleHandler)
 * because these channels are not namespaced to a single module.
 *
 * 4 registerHandler calls total.
 */

import { dialog } from 'electron';
import { registerHandler } from '../ipc-registry';
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
      } catch (err: any) {
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
      } catch (err: any) {
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
      } catch (err: any) {
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
      } catch (err: any) {
        logger.error('[ModuleCreds] uninstall error:', err.message);
        return { success: false, error: err.message };
      }
    },
  );
}
