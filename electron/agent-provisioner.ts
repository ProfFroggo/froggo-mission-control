/**
 * Agent Provisioner
 *
 * Atomically provisions agent workspaces and registers them in openclaw.json.
 *
 * Key design decisions:
 * - Staging dir is in $HOME (same filesystem as ~/agent-*) to avoid EXDEV on renameSync.
 *   macOS tmpdir (/private/var) is a different filesystem from /Users.
 * - openclaw.json writes use temp-file-then-rename for atomicity.
 * - provisionAgentWorkspace rolls back staging dir on any error.
 * - registerAgentInOpenClaw is idempotent — duplicate entries are silently skipped.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SHARED_CONTEXT_DIR, OPENCLAW_CONFIG, agentWorkspace } from './paths';
import { createLogger } from './utils/logger';

const logger = createLogger('AgentProvisioner');

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentProvisionInput {
  agentId: string;
  templateFiles: Record<string, string>;
}

export interface AgentProvisionResult {
  success: boolean;
  workspacePath?: string;
  error?: string;
}

export interface AgentRegisterResult {
  success: boolean;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Validate agentId: only lowercase letters, digits, and hyphens. No path traversal. */
function isValidAgentId(agentId: string): boolean {
  return /^[a-z0-9-]+$/.test(agentId);
}

// ── provisionAgentWorkspace ───────────────────────────────────────────────────

/**
 * Atomically create a ~/agent-{agentId}/ workspace.
 *
 * Steps:
 *  1. Validate agentId
 *  2. Reject if workspace already exists
 *  3. Create staging dir in $HOME (same filesystem → renameSync won't EXDEV)
 *  4. Write memory/ and skills/ subdirectories
 *  5. Write all templateFiles entries (filename → content)
 *  6. Write default HEARTBEAT.md
 *  7. Create shared-context symlinks (AGENTS.md, TOOLS.md, USER.md)
 *  8. Atomic rename staging → final dir
 *  9. On any error: best-effort cleanup of staging dir
 */
export function provisionAgentWorkspace(input: AgentProvisionInput): AgentProvisionResult {
  const { agentId, templateFiles } = input;

  // Step 1: Validate agentId
  if (!isValidAgentId(agentId)) {
    return { success: false, error: `Invalid agentId "${agentId}": must match [a-z0-9-]+` };
  }

  const finalDir = agentWorkspace(agentId);

  // Step 2: Reject if workspace already exists
  if (fs.existsSync(finalDir)) {
    return { success: false, error: `Agent workspace already exists at ${finalDir}` };
  }

  // Step 3: Create staging dir in $HOME (same filesystem as ~/agent-*)
  // CRITICAL: Do NOT use os.tmpdir() — on macOS it resolves to /private/var which is
  // a different filesystem from /Users. renameSync across filesystems throws EXDEV.
  const stagingDir = path.join(os.homedir(), `.froggo-staging-${agentId}-${Date.now()}`);

  try {
    // Create staging root
    fs.mkdirSync(stagingDir, { recursive: true });

    // Step 4: Create standard subdirectories
    fs.mkdirSync(path.join(stagingDir, 'memory'), { recursive: true });
    fs.mkdirSync(path.join(stagingDir, 'skills'), { recursive: true });

    // Step 5: Write templateFiles (Record<filename, content>)
    for (const [filename, content] of Object.entries(templateFiles)) {
      // Sanitize: only allow plain filenames (no path separators or ..)
      const basename = path.basename(filename);
      if (!basename || basename !== filename) {
        throw new Error(`Invalid template filename "${filename}": must be a plain filename`);
      }
      fs.writeFileSync(path.join(stagingDir, basename), content, { encoding: 'utf-8' });
    }

    // Step 6: Write default HEARTBEAT.md (always, even if templateFiles has one — don't override)
    const heartbeatPath = path.join(stagingDir, 'HEARTBEAT.md');
    if (!fs.existsSync(heartbeatPath)) {
      fs.writeFileSync(
        heartbeatPath,
        `# Heartbeat — ${agentId}\n\n_No heartbeat recorded yet._\n`,
        { encoding: 'utf-8' },
      );
    }

    // Step 7: Create shared-context symlinks
    const sharedContextFiles = ['AGENTS.md', 'TOOLS.md', 'USER.md'];
    for (const filename of sharedContextFiles) {
      const target = path.join(SHARED_CONTEXT_DIR, filename);
      if (fs.existsSync(target)) {
        const linkPath = path.join(stagingDir, filename);
        // Only create symlink if we haven't already written this file from templateFiles
        if (!fs.existsSync(linkPath)) {
          fs.symlinkSync(target, linkPath);
        }
      }
    }

    // Step 8: Atomic rename staging → final dir
    fs.renameSync(stagingDir, finalDir);

    logger.info(`[AgentProvisioner] Provisioned workspace: ${finalDir}`);
    return { success: true, workspacePath: finalDir };

  } catch (err: any) {
    logger.error(`[AgentProvisioner] provisionAgentWorkspace failed:`, err.message);

    // Step 9: Best-effort cleanup of staging dir
    try {
      if (fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      }
    } catch (cleanupErr: any) {
      logger.error(`[AgentProvisioner] Staging dir cleanup failed:`, cleanupErr.message);
    }

    return { success: false, error: err.message ?? String(err) };
  }
}

// ── registerAgentInOpenClaw ───────────────────────────────────────────────────

/**
 * Register an agent in ~/.openclaw/openclaw.json.
 *
 * Idempotent: if the agentId is already in config.agents.list, returns success.
 * Uses temp-file-then-rename for atomic write.
 */
export function registerAgentInOpenClaw(
  agentId: string,
  workspacePath: string,
): AgentRegisterResult {
  const tmpPath = `${OPENCLAW_CONFIG}.agent-${agentId}-${Date.now()}.tmp`;

  try {
    // Read current config
    const raw = fs.readFileSync(OPENCLAW_CONFIG, 'utf-8');
    const config = JSON.parse(raw) as Record<string, any>;

    // Guard: ensure agents and agents.list exist
    if (!config.agents || typeof config.agents !== 'object') {
      config.agents = {};
    }
    if (!Array.isArray(config.agents.list)) {
      config.agents.list = [];
    }

    // Idempotency check
    const alreadyRegistered = config.agents.list.some(
      (a: any) => a && a.id === agentId,
    );
    if (alreadyRegistered) {
      logger.info(`[AgentProvisioner] Agent "${agentId}" already registered in openclaw.json`);
      return { success: true };
    }

    // Push new entry
    config.agents.list.push({ id: agentId, workspace: workspacePath });

    // Write to temp file with restricted permissions
    const serialized = JSON.stringify(config, null, 2);
    fs.writeFileSync(tmpPath, serialized, { encoding: 'utf-8', mode: 0o600 });

    // Atomic rename
    fs.renameSync(tmpPath, OPENCLAW_CONFIG);

    logger.info(`[AgentProvisioner] Registered agent "${agentId}" in openclaw.json`);
    return { success: true };

  } catch (err: any) {
    logger.error(`[AgentProvisioner] registerAgentInOpenClaw failed:`, err.message);

    // Best-effort cleanup of temp file
    try {
      fs.unlinkSync(tmpPath);
    } catch (_e) {
      // Temp file may not exist; ignore
    }

    return { success: false, error: err.message ?? String(err) };
  }
}

// ── unregisterAgentFromOpenClaw ───────────────────────────────────────────────

/**
 * Remove an agent entry from ~/.openclaw/openclaw.json.
 *
 * If the agent is not found, returns success (idempotent).
 * Uses temp-file-then-rename for atomic write.
 */
export function unregisterAgentFromOpenClaw(agentId: string): AgentRegisterResult {
  const tmpPath = `${OPENCLAW_CONFIG}.agent-${agentId}-${Date.now()}.tmp`;

  try {
    // Read current config
    const raw = fs.readFileSync(OPENCLAW_CONFIG, 'utf-8');
    const config = JSON.parse(raw) as Record<string, any>;

    // Guard: if no list, nothing to remove
    if (!config.agents || !Array.isArray(config.agents.list)) {
      logger.info(`[AgentProvisioner] No agents.list in openclaw.json; nothing to remove for "${agentId}"`);
      return { success: true };
    }

    const before = config.agents.list.length;
    config.agents.list = config.agents.list.filter(
      (a: any) => !(a && a.id === agentId),
    );

    if (config.agents.list.length === before) {
      logger.info(`[AgentProvisioner] Agent "${agentId}" not found in openclaw.json; nothing to remove`);
      return { success: true };
    }

    // Write to temp file with restricted permissions
    const serialized = JSON.stringify(config, null, 2);
    fs.writeFileSync(tmpPath, serialized, { encoding: 'utf-8', mode: 0o600 });

    // Atomic rename
    fs.renameSync(tmpPath, OPENCLAW_CONFIG);

    logger.info(`[AgentProvisioner] Unregistered agent "${agentId}" from openclaw.json`);
    return { success: true };

  } catch (err: any) {
    logger.error(`[AgentProvisioner] unregisterAgentFromOpenClaw failed:`, err.message);

    // Best-effort cleanup of temp file
    try {
      fs.unlinkSync(tmpPath);
    } catch (_e) {
      // Temp file may not exist; ignore
    }

    return { success: false, error: err.message ?? String(err) };
  }
}
