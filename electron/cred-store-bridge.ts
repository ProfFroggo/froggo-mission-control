/**
 * Credential Store Bridge
 *
 * Writes plaintext credential bridge files for the Python dispatcher at:
 *   ~/.openclaw/credentials/dispatcher/{moduleId}/{credentialId}.json
 *
 * Files are created with mode 0600 (owner read/write only).
 * The dispatcher reads these files to inject credentials into agent environments.
 *
 * NOTE: These files contain plaintext values. The directory is created with
 * mode 0700 and files with mode 0600 to restrict access to the current user.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CREDENTIALS_DISPATCHER_DIR } from './paths';

/**
 * Write a bridge file for a module credential.
 * Creates the module directory (0700) and writes a JSON file (0600).
 * Always overwrites an existing file.
 */
export function writeBridgeFile(moduleId: string, credentialId: string, value: string): void {
  const moduleDir = path.join(CREDENTIALS_DISPATCHER_DIR, moduleId);
  fs.mkdirSync(moduleDir, { recursive: true, mode: 0o700 });
  const filePath = path.join(moduleDir, `${credentialId}.json`);
  const content = JSON.stringify({ moduleId, credentialId, value, updatedAt: Date.now() });
  fs.writeFileSync(filePath, content, { mode: 0o600 });
}

/**
 * Delete a single bridge file for a module credential.
 * Silently ignores ENOENT (file not found).
 */
export function deleteBridgeFile(moduleId: string, credentialId: string): void {
  const filePath = path.join(CREDENTIALS_DISPATCHER_DIR, moduleId, `${credentialId}.json`);
  try {
    fs.unlinkSync(filePath);
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err;
  }
}

/**
 * Delete the entire bridge directory for a module.
 * Silently ignores errors (directory may not exist).
 */
export function deleteModuleBridgeDir(moduleId: string): void {
  const moduleDir = path.join(CREDENTIALS_DISPATCHER_DIR, moduleId);
  try {
    fs.rmSync(moduleDir, { recursive: true, force: true });
  } catch {
    // ignore — directory may not exist
  }
}
