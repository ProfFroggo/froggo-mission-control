/**
 * Secret Store — Keychain-backed secret storage via Electron safeStorage
 *
 * Stores encrypted secrets on disk at ~/.openclaw/credentials/dashboard/{key}.enc
 * safeStorage uses the OS keychain (macOS Keychain / Windows DPAPI / Linux Secret Service)
 * so secrets are protected by the user's system credentials.
 *
 * IMPORTANT: safeStorage can only be called after app.ready.
 */

import { safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CREDENTIALS_DIR = path.join(os.homedir(), '.openclaw', 'credentials', 'dashboard');

/**
 * Sanitize a key to filesystem-safe characters (alphanumeric, dash, underscore only)
 */
function sanitizeKey(key: string): string {
  const sanitized = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!sanitized) throw new Error('Secret key cannot be empty');
  return sanitized;
}

/**
 * Ensure the credentials directory exists
 */
function ensureDir(): void {
  if (!fs.existsSync(CREDENTIALS_DIR)) {
    fs.mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Get the file path for a secret key
 */
function keyPath(key: string): string {
  return path.join(CREDENTIALS_DIR, `${sanitizeKey(key)}.enc`);
}

/**
 * Check if safeStorage is available (must be after app.ready)
 */
function checkReady(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage not available — ensure app.ready has fired and encryption is supported');
  }
}

/**
 * Store a secret encrypted with Electron safeStorage
 */
export function storeSecret(key: string, value: string): void {
  checkReady();
  ensureDir();
  const encrypted = safeStorage.encryptString(value);
  fs.writeFileSync(keyPath(key), encrypted, { mode: 0o600 });
}

/**
 * Retrieve a secret, decrypting with Electron safeStorage
 * Returns null if the secret does not exist
 */
export function getSecret(key: string): string | null {
  checkReady();
  const fp = keyPath(key);
  if (!fs.existsSync(fp)) return null;
  const encrypted = fs.readFileSync(fp);
  return safeStorage.decryptString(encrypted);
}

/**
 * Check if a secret exists on disk
 */
export function hasSecret(key: string): boolean {
  return fs.existsSync(keyPath(key));
}

/**
 * Delete a stored secret
 */
export function deleteSecret(key: string): void {
  const fp = keyPath(key);
  if (fs.existsSync(fp)) {
    fs.unlinkSync(fp);
  }
}

// ── Module credential namespace wrappers ──

export type CredentialStatus = 'green' | 'yellow' | 'red';

/**
 * Store a module credential using a namespaced key: {moduleId}:{credentialId}
 */
export function storeModuleSecret(moduleId: string, credentialId: string, value: string): void {
  storeSecret(`${moduleId}:${credentialId}`, value);
}

/**
 * Retrieve a module credential using a namespaced key: {moduleId}:{credentialId}
 * Returns null if not found
 */
export function getModuleSecret(moduleId: string, credentialId: string): string | null {
  return getSecret(`${moduleId}:${credentialId}`);
}

/**
 * Check if a module credential exists
 */
export function hasModuleSecret(moduleId: string, credentialId: string): boolean {
  return hasSecret(`${moduleId}:${credentialId}`);
}

/**
 * Delete a single module credential
 */
export function deleteModuleSecret(moduleId: string, credentialId: string): void {
  deleteSecret(`${moduleId}:${credentialId}`);
}

/**
 * Compute credential status for a module:
 *   green  — all credentials set (or no credentials declared)
 *   yellow — some credentials set
 *   red    — no credentials set
 */
export function getModuleCredentialStatus(
  moduleId: string,
  credentials: Array<{ id: string }>,
): CredentialStatus {
  if (credentials.length === 0) return 'green';
  const setCount = credentials.filter(c => hasModuleSecret(moduleId, c.id)).length;
  if (setCount === credentials.length) return 'green';
  if (setCount === 0) return 'red';
  return 'yellow';
}

/**
 * Delete all credentials for a module by iterating credentialIds
 */
export function deleteModuleCredentials(moduleId: string, credentialIds: string[]): void {
  for (const credentialId of credentialIds) {
    deleteModuleSecret(moduleId, credentialId);
  }
}
