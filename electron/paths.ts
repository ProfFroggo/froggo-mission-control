/**
 * Centralized path resolver for Froggo Dashboard
 *
 * All filesystem paths used by the Electron main process live here.
 * Defaults resolve relative to $HOME; override with env vars for
 * portability (CI, other machines, future renames).
 *
 * Precedence: env var > default relative to homedir
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { createLogger } from './utils/logger';

const logger = createLogger('Paths');
const HOME = os.homedir();

// ── Core roots ──
export const PROJECT_ROOT = process.env.FROGGO_ROOT || path.join(HOME, 'froggo');
const AGENT_PREFIX = process.env.FROGGO_AGENT_PREFIX || 'agent-';

// ── Project directories ──
export const DATA_DIR     = path.join(PROJECT_ROOT, 'data');
export const SCRIPTS_DIR  = path.join(PROJECT_ROOT, 'scripts');
export const TOOLS_DIR    = path.join(PROJECT_ROOT, 'tools');
export const LIBRARY_DIR  = path.join(HOME, 'froggo-library');
export const UPLOADS_DIR  = path.join(PROJECT_ROOT, 'uploads');
export const LOGS_DIR     = path.join(PROJECT_ROOT, 'logs');
export const REPORTS_DIR  = path.join(PROJECT_ROOT, 'reports');
export const SHARED_CONTEXT_DIR = path.join(PROJECT_ROOT, 'shared-context');

// ── Writing projects ──
export const WRITING_PROJECTS_DIR = path.join(PROJECT_ROOT, 'writing-projects');

export const writingProjectPath = (projectId: string) =>
  path.join(WRITING_PROJECTS_DIR, projectId);

export const writingChapterPath = (projectId: string, chapterFilename: string) =>
  path.join(WRITING_PROJECTS_DIR, projectId, 'chapters', chapterFilename);

export const writingMemoryPath = (projectId: string, filename: string) =>
  path.join(WRITING_PROJECTS_DIR, projectId, 'memory', filename);

export const writingVersionsPath = (projectId: string, chapterId: string) =>
  path.join(WRITING_PROJECTS_DIR, projectId, 'versions', chapterId);

export const writingResearchDbPath = (projectId: string) =>
  path.join(WRITING_PROJECTS_DIR, projectId, 'research.db');

export const writingBookDbPath = (projectId: string) =>
  path.join(WRITING_PROJECTS_DIR, projectId, 'book.db');

export const WIZARD_STATE_DIR = path.join(WRITING_PROJECTS_DIR, '_wizard-state');

// ── Database files ──
export const FROGGO_DB    = path.join(DATA_DIR, 'froggo.db');
export const SCHEDULE_DB  = path.join(DATA_DIR, 'schedule.db');
export const SECURITY_DB  = path.join(DATA_DIR, 'security.db');

// ── Module state ──
export const MODULE_STATE_PATH = path.join(DATA_DIR, 'module-state.json');

// ── OpenClaw directories ──
export const OPENCLAW_DIR    = path.join(HOME, '.openclaw');
export const OPENCLAW_LEGACY = path.join(HOME, '.clawdbot');
export const SESSIONS_DB     = path.join(OPENCLAW_DIR, 'sessions.db');
export const SESSIONS_DB_LEGACY = path.join(OPENCLAW_LEGACY, 'sessions.db');
export const OPENCLAW_CONFIG = path.join(OPENCLAW_DIR, 'openclaw.json');
export const OPENCLAW_CONFIG_LEGACY = path.join(OPENCLAW_LEGACY, 'openclaw.json');
export const CREDENTIALS_DISPATCHER_DIR = path.join(OPENCLAW_DIR, 'credentials', 'dispatcher');

// ── External binaries ──
export const LOCAL_BIN     = path.join(HOME, '.local', 'bin');
export const FROGGO_DB_CLI = path.join(LOCAL_BIN, 'froggo-db');
export const TGCLI         = path.join(LOCAL_BIN, 'tgcli');
export const DISCORDCLI    = path.join(LOCAL_BIN, 'discordcli');
export const CLAUDE_CLI    = path.join(LOCAL_BIN, 'claude');
export const X_API_CLI     = path.join(TOOLS_DIR, 'x-api', 'x-api');

// ── Shell PATH for child processes ──
export const SHELL_PATH = `/opt/homebrew/bin:${LOCAL_BIN}:/usr/local/bin:/usr/bin:/bin`;

// ── Agent workspaces ──
export const agentWorkspace = (agentId: string) =>
  path.join(HOME, `${AGENT_PREFIX}${agentId}`);

// ── Startup diagnostics ──

export interface PathCheckResult {
  path: string;
  label: string;
  exists: boolean;
  critical: boolean;  // true = app cannot function without this
}

/**
 * Verify all critical and optional filesystem paths on startup.
 * Returns structured results so callers can decide whether to abort.
 *
 * @returns Array of path check results with existence and criticality flags
 */
export function verifyPaths(): PathCheckResult[] {
  const checks: Array<{ p: string; label: string; critical: boolean }> = [
    { p: FROGGO_DB,       label: 'Task database (froggo.db)', critical: true },
    { p: OPENCLAW_CONFIG, label: 'OpenClaw config',           critical: false },
    { p: FROGGO_DB_CLI,   label: 'froggo-db CLI',            critical: false },
    { p: SCRIPTS_DIR,     label: 'Scripts directory',         critical: false },
    { p: X_API_CLI,       label: 'x-api CLI',                critical: false },
  ];

  const results: PathCheckResult[] = [];
  for (const { p, label, critical } of checks) {
    const exists = fs.existsSync(p);
    if (!exists) logger.error(`[STARTUP] MISSING: ${label} at ${p}`);
    else logger.debug(`[STARTUP] OK: ${label}`);
    results.push({ path: p, label, exists, critical });
  }
  return results;
}
