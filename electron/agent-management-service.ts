/**
 * Agent Management Service
 *
 * Provides secure IPC handlers for reading/writing agent SOUL.md files
 * and reading/writing agent model configuration in openclaw.json.
 *
 * All file operations enforce a path allowlist restricted to ~/agent-*
 * and ~/.openclaw/agents/* directories. SOUL.md writes use atomic
 * tmp-then-rename to prevent partial writes.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { registerHandler } from './ipc-registry';
import { createLogger } from './utils/logger';
import { SHARED_CONTEXT_DIR } from './paths';

const logger = createLogger('AgentMgmt');

// ── Constants ───────────────────────────────────────────────────────────────

const HOME = os.homedir();
const AGENT_ID_REGEX = /^[a-z0-9-]{1,40}$/;
const MAX_SOUL_LENGTH = 50_000;

const ALLOWED_MODELS = [
  'anthropic/claude-opus-4-5',
  'anthropic/claude-sonnet-4-5',
  'anthropic/claude-opus-4-6',
  'anthropic/claude-sonnet-4-6',
  'anthropic/claude-haiku-3-5',
  'anthropic-direct/claude-opus-4-5',
  'anthropic-direct/claude-sonnet-4-5',
  'google/gemini-2.5-flash',
  'kimi-coding/k2p5',
  'minimax/MiniMax-M2.5-highspeed',
];

const MAX_FALLBACKS = 5;

// ── Path helpers ────────────────────────────────────────────────────────────

const ALLOWED_AGENT_WORKSPACE_PATTERN = path.join(HOME, 'agent-');
const ALLOWED_OPENCLAW_AGENTS_PATTERN = path.join(HOME, '.openclaw', 'agents');
const OPENCLAW_CONFIG_RESOLVED = path.resolve(path.join(HOME, '.openclaw', 'openclaw.json'));

function soulMdPath(agentId: string): string {
  return path.join(HOME, 'agent-' + agentId, 'SOUL.md');
}

function modelsJsonPath(agentId: string): string {
  return path.join(HOME, '.openclaw', 'agents', agentId, 'agent', 'models.json');
}

function openclawConfigPath(): string {
  return path.join(HOME, '.openclaw', 'openclaw.json');
}

/**
 * Path allowlist enforcement for agent management operations.
 * Permits paths under ~/agent-*, ~/.openclaw/agents/*, and the openclaw.json config.
 */
function isAllowedAgentPath(p: string): boolean {
  const resolved = path.resolve(p);
  return (
    resolved.startsWith(ALLOWED_AGENT_WORKSPACE_PATTERN) ||
    resolved.startsWith(ALLOWED_OPENCLAW_AGENTS_PATTERN) ||
    resolved === OPENCLAW_CONFIG_RESOLVED
  );
}

// ── Validation helpers ──────────────────────────────────────────────────────

function validateAgentId(agentId: unknown): { valid: boolean; error?: string } {
  if (typeof agentId !== 'string' || !AGENT_ID_REGEX.test(agentId)) {
    return { valid: false, error: 'Invalid agentId: must match /^[a-z0-9-]{1,40}$/' };
  }
  return { valid: true };
}

// ── Result types ────────────────────────────────────────────────────────────

interface SoulReadResult {
  success: boolean;
  content?: string;
  error?: string;
}

interface SoulWriteResult {
  success: boolean;
  error?: string;
}

interface ModelsReadResult {
  success: boolean;
  primary?: string;
  fallbacks?: string[];
  usingDefaults?: boolean;
  error?: string;
}

interface ModelsWriteResult {
  success: boolean;
  error?: string;
}

// ── Handler 1: agentManagement:soul:read ────────────────────────────────────

async function handleSoulRead(_event: Electron.IpcMainInvokeEvent, agentId: string): Promise<SoulReadResult> {
  try {
    const idCheck = validateAgentId(agentId);
    if (!idCheck.valid) return { success: false, error: idCheck.error };

    const soulPath = soulMdPath(agentId);
    if (!isAllowedAgentPath(soulPath)) {
      return { success: false, error: 'Path outside allowed directories' };
    }

    if (!fs.existsSync(soulPath)) {
      return { success: false, error: 'SOUL.md not found for agent: ' + agentId };
    }

    const content = fs.readFileSync(soulPath, 'utf-8');
    return { success: true, content };
  } catch (err: any) {
    logger.error('[soul:read] Error:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Handler 2: agentManagement:soul:write ───────────────────────────────────

async function handleSoulWrite(_event: Electron.IpcMainInvokeEvent, agentId: string, content: string): Promise<SoulWriteResult> {
  try {
    const idCheck = validateAgentId(agentId);
    if (!idCheck.valid) return { success: false, error: idCheck.error };

    if (typeof content !== 'string') {
      return { success: false, error: 'Content must be a string' };
    }
    if (content.length > MAX_SOUL_LENGTH) {
      return { success: false, error: `Content too long (max ${MAX_SOUL_LENGTH} chars)` };
    }

    const soulPath = soulMdPath(agentId);
    if (!isAllowedAgentPath(soulPath)) {
      return { success: false, error: 'Path outside allowed directories' };
    }

    // Atomic write: write to .tmp then rename
    const tmpPath = soulPath + '.tmp';
    fs.writeFileSync(tmpPath, content, 'utf-8');
    fs.renameSync(tmpPath, soulPath);

    logger.info(`[soul:write] Updated SOUL.md for agent: ${agentId}`);
    return { success: true };
  } catch (err: any) {
    logger.error('[soul:write] Error:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Handler 3: agentManagement:models:read ──────────────────────────────────

async function handleModelsRead(_event: Electron.IpcMainInvokeEvent, agentId: string): Promise<ModelsReadResult> {
  try {
    const idCheck = validateAgentId(agentId);
    if (!idCheck.valid) return { success: false, error: idCheck.error };

    const configPath = openclawConfigPath();
    if (!isAllowedAgentPath(configPath)) {
      return { success: false, error: 'Path outside allowed directories' };
    }

    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);

    // Defaults
    const defaultPrimary: string = config?.agents?.defaults?.model?.primary ?? '';
    const defaultFallbacks: string[] = config?.agents?.defaults?.model?.fallbacks ?? [];

    // Find agent entry
    const agentList: any[] = config?.agents?.list ?? [];
    const entry = agentList.find((a: any) => a.id === agentId);

    if (!entry) {
      return {
        success: true,
        primary: defaultPrimary,
        fallbacks: defaultFallbacks,
        usingDefaults: true,
      };
    }

    const primary: string = entry.model?.primary ?? defaultPrimary;
    const fallbacks: string[] = entry.model?.fallbacks ?? defaultFallbacks;

    return { success: true, primary, fallbacks };
  } catch (err: any) {
    logger.error('[models:read] Error:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Handler 4: agentManagement:models:write ─────────────────────────────────

async function handleModelsWrite(
  _event: Electron.IpcMainInvokeEvent,
  agentId: string,
  updates: { primary?: string; fallbacks?: string[] }
): Promise<ModelsWriteResult> {
  try {
    const idCheck = validateAgentId(agentId);
    if (!idCheck.valid) return { success: false, error: idCheck.error };

    if (!updates || typeof updates !== 'object') {
      return { success: false, error: 'Updates must be an object with primary and/or fallbacks' };
    }

    // Validate primary model
    if (updates.primary !== undefined) {
      if (typeof updates.primary !== 'string' || !ALLOWED_MODELS.includes(updates.primary)) {
        return { success: false, error: `Invalid primary model. Allowed: ${ALLOWED_MODELS.join(', ')}` };
      }
    }

    // Validate fallbacks
    if (updates.fallbacks !== undefined) {
      if (!Array.isArray(updates.fallbacks)) {
        return { success: false, error: 'Fallbacks must be an array of strings' };
      }
      if (updates.fallbacks.length > MAX_FALLBACKS) {
        return { success: false, error: `Too many fallbacks (max ${MAX_FALLBACKS})` };
      }
      for (const fb of updates.fallbacks) {
        if (typeof fb !== 'string' || !ALLOWED_MODELS.includes(fb)) {
          return { success: false, error: `Invalid fallback model: ${fb}. Allowed: ${ALLOWED_MODELS.join(', ')}` };
        }
      }
    }

    const configPath = openclawConfigPath();
    if (!isAllowedAgentPath(configPath)) {
      return { success: false, error: 'Path outside allowed directories' };
    }

    // Read existing config (preserve formatting with 2-space indent)
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);

    // Ensure agents.list exists
    if (!config.agents) config.agents = {};
    if (!config.agents.list) config.agents.list = [];

    // Find or create agent entry
    let entry = config.agents.list.find((a: any) => a.id === agentId);
    if (!entry) {
      entry = { id: agentId, workspace: path.join(HOME, 'agent-' + agentId) };
      config.agents.list.push(entry);
    }

    // Merge updates into entry.model
    entry.model = { ...entry.model, ...updates };

    // Atomic write of openclaw.json
    const tmpPath = configPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    fs.renameSync(tmpPath, configPath);

    logger.info(`[models:write] Updated model config for agent: ${agentId}`);
    return { success: true };
  } catch (err: any) {
    logger.error('[models:write] Error:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Handler 5: agentManagement:ctx:check ────────────────────────────────────

interface CtxCheckResult {
  success: boolean;
  health?: Record<string, { AGENTS: boolean; USER: boolean; TOOLS: boolean }>;
  error?: string;
}

/**
 * Checks if a path is a symlink pointing to the expected target.
 * Uses lstatSync (not statSync) so it checks the link itself, not the target.
 */
function isCorrectSymlink(linkPath: string, expectedTarget: string): boolean {
  try {
    const stat = fs.lstatSync(linkPath);
    if (!stat.isSymbolicLink()) return false;
    const actual = fs.readlinkSync(linkPath);
    const resolvedActual = path.resolve(path.dirname(linkPath), actual);
    return resolvedActual === path.resolve(expectedTarget);
  } catch {
    return false;
  }
}

async function handleCtxCheck(): Promise<CtxCheckResult> {
  try {
    const entries = fs.readdirSync(HOME);
    const health: Record<string, { AGENTS: boolean; USER: boolean; TOOLS: boolean }> = {};

    for (const dir of entries) {
      if (!dir.startsWith('agent-')) continue;
      const agentId = dir.slice('agent-'.length);
      if (!AGENT_ID_REGEX.test(agentId)) continue;

      const agentDir = path.join(HOME, dir);
      health[agentId] = {
        AGENTS: isCorrectSymlink(path.join(agentDir, 'AGENTS.md'), path.join(SHARED_CONTEXT_DIR, 'AGENTS.md')),
        USER:   isCorrectSymlink(path.join(agentDir, 'USER.md'),   path.join(SHARED_CONTEXT_DIR, 'USER.md')),
        TOOLS:  isCorrectSymlink(path.join(agentDir, 'TOOLS.md'),  path.join(SHARED_CONTEXT_DIR, 'TOOLS.md')),
      };
    }

    return { success: true, health };
  } catch (err: any) {
    logger.error('[ctx:check] Error:', err.message);
    return { success: false, error: err.message };
  }
}

// ── IPC Registration ────────────────────────────────────────────────────────

export function registerAgentManagementHandlers(): void {
  registerHandler('agentManagement:soul:read', handleSoulRead);
  registerHandler('agentManagement:soul:write', handleSoulWrite);
  registerHandler('agentManagement:models:read', handleModelsRead);
  registerHandler('agentManagement:models:write', handleModelsWrite);
  registerHandler('agentManagement:ctx:check', handleCtxCheck);
  logger.info('[AgentMgmt] Handlers registered');
}
