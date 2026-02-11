/**
 * Filesystem path validation for IPC handlers.
 *
 * Restricts all renderer-initiated filesystem operations to a known
 * set of directories so that a compromised renderer cannot read or
 * write arbitrary files on disk.
 */

import * as path from 'path';
import * as os from 'os';

const ALLOWED_ROOTS = [
  path.join(os.homedir(), 'clawd'),
  path.join(os.homedir(), '.openclaw'),
  path.join(os.homedir(), 'Froggo'),
];

/**
 * Check whether a path falls within one of the allowed root directories.
 */
export function isAllowedPath(rawPath: string): boolean {
  const resolved = path.resolve(
    rawPath.startsWith('~') ? path.join(os.homedir(), rawPath.slice(1)) : rawPath
  );
  return ALLOWED_ROOTS.some(
    root => resolved === root || resolved.startsWith(root + path.sep)
  );
}

/**
 * Validate and resolve a raw path from the renderer process.
 * Returns the resolved absolute path and whether it is within the allowlist.
 */
export function validateFsPath(rawPath: string): { valid: boolean; resolved: string; error?: string } {
  const resolved = path.resolve(
    rawPath.startsWith('~') ? path.join(os.homedir(), rawPath.slice(1)) : rawPath
  );
  if (!isAllowedPath(rawPath)) {
    return { valid: false, resolved, error: `Path outside allowed directories: ${resolved}` };
  }
  return { valid: true, resolved };
}
