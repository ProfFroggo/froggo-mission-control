/**
 * Shell Security Wrapper
 * Enforces safety rules around exec/write/edit tool calls in Electron backend.
 * - Whitelist/blacklist command validation
 * - Blocks dangerous operations (rm -rf, sudo, etc.)
 * - Audit logging of all shell operations
 * - Approval flow for risky commands via IPC dialog
 */

import * as fs from 'fs';
import * as path from 'path';
import { BrowserWindow, dialog } from 'electron';
import { createLogger } from './utils/logger';

const logger = createLogger('ShellSecurity');

// --- Types ---

export type RiskLevel = 'safe' | 'caution' | 'dangerous' | 'blocked';

export interface ShellAuditEntry {
  timestamp: string;
  command: string;
  riskLevel: RiskLevel;
  action: 'allowed' | 'blocked' | 'approved' | 'denied';
  source: 'exec' | 'write' | 'edit';
  user?: string;
  details?: string;
}

export interface ValidationResult {
  allowed: boolean;
  riskLevel: RiskLevel;
  reason?: string;
  requiresApproval?: boolean;
  matchedRule?: string;
}

// --- Configuration ---

/** Commands that are always blocked - no approval can override */
const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?(-[a-zA-Z]*r[a-zA-Z]*|--recursive)\s+\//i, reason: 'Recursive delete from root' },
  { pattern: /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+)?(-[a-zA-Z]*f[a-zA-Z]*|--force)\s+\//i, reason: 'Force delete from root' },
  { pattern: /\brm\s+-rf\s+[/~]/i, reason: 'rm -rf on root or home directory' },
  { pattern: /\brm\s+-fr\s+[/~]/i, reason: 'rm -fr on root or home directory' },
  { pattern: /\bsudo\s+rm\b/i, reason: 'sudo rm is blocked' },
  { pattern: /\bsudo\s+dd\b/i, reason: 'sudo dd is blocked' },
  { pattern: /\bmkfs\b/i, reason: 'Filesystem format command' },
  { pattern: /\b(chmod|chown)\s+(-R\s+)?[0-7]{3,4}\s+\//i, reason: 'Recursive permission change from root' },
  { pattern: />\s*\/dev\/sd[a-z]/i, reason: 'Writing directly to block device' },
  { pattern: /\bdd\s+.*of=\/dev\//i, reason: 'dd to block device' },
  { pattern: /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/i, reason: 'Fork bomb detected' },
  { pattern: /\bkill\s+-9\s+-1\b/i, reason: 'Kill all processes' },
  { pattern: /\bshutdown\b/i, reason: 'System shutdown command' },
  { pattern: /\breboot\b/i, reason: 'System reboot command' },
  { pattern: /\bcurl\b.*\|\s*(sudo\s+)?(ba)?sh/i, reason: 'Piping remote content to shell' },
  { pattern: /\bwget\b.*\|\s*(sudo\s+)?(ba)?sh/i, reason: 'Piping remote content to shell' },
];

/** Commands requiring user approval before execution */
const CAUTION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bsudo\b/i, reason: 'Elevated privileges requested' },
  { pattern: /\brm\s+-r/i, reason: 'Recursive delete' },
  { pattern: /\brm\s+-f/i, reason: 'Force delete' },
  { pattern: /\bchmod\b/i, reason: 'Permission change' },
  { pattern: /\bchown\b/i, reason: 'Ownership change' },
  { pattern: /\bnpm\s+publish\b/i, reason: 'Package publish' },
  { pattern: /\bgit\s+push\s+.*--force/i, reason: 'Force push' },
  { pattern: /\bgit\s+reset\s+--hard/i, reason: 'Hard reset' },
  { pattern: /\bkill\b/i, reason: 'Process kill' },
  { pattern: /\bpkill\b/i, reason: 'Process kill by name' },
  { pattern: /\blaunchctl\b/i, reason: 'System service management' },
  { pattern: /(?<!2)>\s*\/(?!Users\/worker\/froggo|tmp\/)/i, reason: 'Redirect to absolute path outside workspace' },
  { pattern: /\benv\b.*\bPATH=/i, reason: 'PATH modification' },
];

/** Safe commands that skip further checks */
const SAFE_PREFIXES = [
  'ls', 'cat', 'echo', 'pwd', 'whoami', 'date', 'head', 'tail', 'wc',
  'grep', 'find', 'which', 'type', 'file', 'stat', 'du', 'df',
  'git status', 'git log', 'git diff', 'git branch', 'git show',
  'node --version', 'npm --version', 'npm list', 'npm ls',
  'clawdbot', 'openclaw', 'froggo-db',
  'sqlite3', 'mkdir',
  'bash ~/froggo', 'bash /Users/worker/froggo',
  '(cat ~/froggo', '(cat /Users/worker/froggo',
];

/** Paths that should never be written to */
const PROTECTED_WRITE_PATHS = [
  /^\/etc\//,
  /^\/usr\//,
  /^\/System\//,
  /^\/bin\//,
  /^\/sbin\//,
  /^\/var\/root/,
  /^\/Library\/LaunchDaemons/,
  /^\/Library\/LaunchAgents/,
];

// --- Audit Logger ---

const AUDIT_DIR = path.join(process.env.HOME || '/tmp', '.openclaw', 'audit');
const AUDIT_FILE = path.join(AUDIT_DIR, 'shell-operations.jsonl');

function ensureAuditDir(): void {
  if (!fs.existsSync(AUDIT_DIR)) {
    fs.mkdirSync(AUDIT_DIR, { recursive: true });
  }
}

export function logAudit(entry: ShellAuditEntry): void {
  try {
    ensureAuditDir();
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(AUDIT_FILE, line, 'utf-8');
  } catch (err) {
    logger.error('[ShellSecurity] Failed to write audit log:', err);
  }
}

export function getAuditLog(limit = 100): ShellAuditEntry[] {
  try {
    if (!fs.existsSync(AUDIT_FILE)) return [];
    const lines = fs.readFileSync(AUDIT_FILE, 'utf-8').trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map(l => JSON.parse(l));
  } catch {
    return [];
  }
}

// --- Validators ---

export function validateCommand(command: string): ValidationResult {
  const trimmed = command.trim();

  // Check safe prefixes first
  for (const prefix of SAFE_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      return { allowed: true, riskLevel: 'safe', matchedRule: `safe:${prefix}` };
    }
  }

  // Check blocked patterns
  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { allowed: false, riskLevel: 'blocked', reason, matchedRule: pattern.source };
    }
  }

  // Check caution patterns
  for (const { pattern, reason } of CAUTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { allowed: false, riskLevel: 'caution', reason, requiresApproval: true, matchedRule: pattern.source };
    }
  }

  // Default: allow with 'safe' level
  return { allowed: true, riskLevel: 'safe' };
}

export function validateWritePath(filePath: string): ValidationResult {
  const resolved = path.resolve(filePath);

  for (const pattern of PROTECTED_WRITE_PATHS) {
    if (pattern.test(resolved)) {
      return {
        allowed: false,
        riskLevel: 'blocked',
        reason: `Protected system path: ${resolved}`,
        matchedRule: pattern.source,
      };
    }
  }

  return { allowed: true, riskLevel: 'safe' };
}

// --- Approval Dialog ---

export async function requestApproval(
  command: string,
  reason: string,
  source: 'exec' | 'write' | 'edit',
): Promise<boolean> {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (!win) {
    // No window available, deny by default
    return false;
  }

  const result = await dialog.showMessageBox(win, {
    type: 'warning',
    title: 'Shell Security - Approval Required',
    message: `A ${source} operation requires approval`,
    detail: [
      `Command: ${command.length > 200 ? command.slice(0, 200) + '...' : command}`,
      `Reason: ${reason}`,
      '',
      'Do you want to allow this operation?',
    ].join('\n'),
    buttons: ['Deny', 'Allow'],
    defaultId: 0,
    cancelId: 0,
  });

  return result.response === 1;
}

// --- Main Wrapper ---

export interface WrappedExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  blocked?: boolean;
  reason?: string;
}

/**
 * Wraps a shell command with security validation, audit logging, and optional approval.
 * Returns the exec result or a blocked result.
 */
export async function secureExec(
  command: string,
  execFn: (cmd: string) => Promise<{ stdout: string; stderr: string }>,
  source: 'exec' | 'write' | 'edit' = 'exec',
): Promise<WrappedExecResult> {
  const validation = validateCommand(command);

  const auditBase: Omit<ShellAuditEntry, 'action'> = {
    timestamp: new Date().toISOString(),
    command: command.slice(0, 1000),
    riskLevel: validation.riskLevel,
    source,
  };

  // Blocked commands
  if (validation.riskLevel === 'blocked') {
    logAudit({ ...auditBase, action: 'blocked', details: validation.reason });
    return {
      success: false,
      stdout: '',
      stderr: `[BLOCKED] ${validation.reason}`,
      blocked: true,
      reason: validation.reason,
    };
  }

  // Commands needing approval
  if (validation.requiresApproval) {
    const approved = await requestApproval(command, validation.reason || 'Risky operation', source);
    if (!approved) {
      logAudit({ ...auditBase, action: 'denied', details: validation.reason });
      return {
        success: false,
        stdout: '',
        stderr: `[DENIED] User denied approval: ${validation.reason}`,
        blocked: true,
        reason: `User denied: ${validation.reason}`,
      };
    }
    logAudit({ ...auditBase, action: 'approved', details: validation.reason });
  } else {
    logAudit({ ...auditBase, action: 'allowed' });
  }

  // Execute
  try {
    const { stdout, stderr } = await execFn(command);
    return { success: true, stdout: stdout || '', stderr: stderr || '' };
  } catch (error: any) {
    return {
      success: false,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
    };
  }
}

/**
 * Wraps a file write with security validation and audit logging.
 */
export function secureWrite(
  filePath: string,
  content: string,
  writeFn: () => void,
): { success: boolean; reason?: string } {
  const validation = validateWritePath(filePath);

  const auditEntry: ShellAuditEntry = {
    timestamp: new Date().toISOString(),
    command: `write:${filePath} (${content.length} bytes)`,
    riskLevel: validation.riskLevel,
    source: 'write',
    action: validation.allowed ? 'allowed' : 'blocked',
    details: validation.reason,
  };
  logAudit(auditEntry);

  if (!validation.allowed) {
    return { success: false, reason: validation.reason };
  }

  try {
    writeFn();
    return { success: true };
  } catch (err: any) {
    return { success: false, reason: err.message };
  }
}
