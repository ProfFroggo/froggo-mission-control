/**
 * IPC Input Validation Utilities
 *
 * Reusable validators for IPC handler parameters. All validators return
 * the validated (and typed) value on success, or null on failure.
 *
 * Usage:
 *   const validId = validateTaskId(rawId);
 *   if (!validId) return { success: false, error: 'Invalid task ID' };
 */

/**
 * Validates task IDs: numeric string or alphanumeric with hyphens/underscores.
 * Blocks shell metacharacters and path traversal sequences.
 */
export function validateTaskId(id: unknown): string | null {
  if (typeof id !== 'string' || !id) return null;
  // Allow numeric IDs (e.g., "12345") or slug IDs (e.g., "task-abc-123")
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
  if (id.length > 200) return null;
  return id;
}

/**
 * Validates agent names: alphanumeric with hyphens/underscores.
 * Blocks shell metacharacters and path traversal sequences.
 */
export function validateAgentName(name: unknown): string | null {
  if (typeof name !== 'string' || !name) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return null;
  if (name.length > 50) return null;
  return name;
}

/**
 * Validates file paths: no traversal (../) sequences, no null bytes,
 * must be absolute. Optionally restricts to allowed directory prefixes.
 */
export function validateFilePath(filePath: unknown, allowedPrefixes?: string[]): string | null {
  if (typeof filePath !== 'string' || !filePath) return null;
  // Block path traversal
  if (filePath.includes('..')) return null;
  // Block null bytes
  if (filePath.includes('\0')) return null;
  // Must be absolute
  if (!filePath.startsWith('/')) return null;
  // Check allowed prefixes if specified
  if (allowedPrefixes && allowedPrefixes.length > 0) {
    if (!allowedPrefixes.some(prefix => filePath.startsWith(prefix))) return null;
  }
  return filePath;
}

/**
 * Validates email message IDs: alphanumeric with hyphens/underscores.
 * Gmail message IDs are hex strings; this is a superset that covers them.
 */
export function validateEmailId(id: unknown): string | null {
  if (typeof id !== 'string' || !id) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
  if (id.length > 200) return null;
  return id;
}

/**
 * Validates email account addresses: basic email format check.
 * Catches obviously invalid values before they reach CLI args.
 */
export function validateAccountEmail(email: unknown): string | null {
  if (typeof email !== 'string' || !email) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
  if (email.length > 254) return null;
  return email;
}

/**
 * Validates a generic string with a configurable length limit.
 * Does NOT restrict characters — use for free-text fields like outcomes,
 * descriptions, messages. Still enforces a maximum length.
 */
export function validateString(val: unknown, maxLength = 1000): string | null {
  if (typeof val !== 'string') return null;
  if (val.length > maxLength) return null;
  return val;
}
