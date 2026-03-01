/**
 * Memory Lifecycle Service
 *
 * IPC handlers for memory health metrics and manual rotation triggers.
 * Reads MEMORY.md file sizes from agent workspaces and archive counts from froggo.db.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { registerHandler } from './ipc-registry';
import { getDb } from './database';
import { createLogger } from './utils/logger';
import { FROGGO_DB_CLI, SHELL_PATH } from './paths';
import { execFile } from 'child_process';

const logger = createLogger('MemoryLifecycle');
const HOME = os.homedir();
const AGENT_ID_REGEX = /^[a-z0-9-]{1,40}$/;

interface AgentMemoryHealth {
  agentId: string;
  memorySizeBytes: number;
  memorySizeKB: number;
  archiveChunks: number;
  lastRotation: string | null;
  health: 'green' | 'yellow' | 'red';
}

interface MemoryStatusResult {
  success: boolean;
  agents?: AgentMemoryHealth[];
  error?: string;
}

async function handleMemoryStatus(): Promise<MemoryStatusResult> {
  try {
    const agents: AgentMemoryHealth[] = [];
    const entries = fs.readdirSync(HOME);

    // Get archive counts from DB in one query
    const archiveCounts: Record<string, number> = {};
    const lastRotations: Record<string, string | null> = {};
    try {
      // Check if memory_archive table exists
      const tableCheck = getDb().prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='memory_archive'"
      ).get();

      if (tableCheck) {
        const rows = getDb().prepare(
          'SELECT agent_id, COUNT(*) as cnt, MAX(archived_at) as last_rotation FROM memory_archive GROUP BY agent_id'
        ).all() as Array<{ agent_id: string; cnt: number; last_rotation: string | null }>;
        for (const row of rows) {
          archiveCounts[row.agent_id] = row.cnt;
          lastRotations[row.agent_id] = row.last_rotation;
        }
      }
    } catch (err: any) {
      logger.warn('[memory:status] DB query failed, continuing with file-only metrics:', err.message);
    }

    for (const dir of entries) {
      if (!dir.startsWith('agent-')) continue;
      const agentId = dir.slice('agent-'.length);
      if (!AGENT_ID_REGEX.test(agentId)) continue;

      const memoryPath = path.join(HOME, dir, 'MEMORY.md');
      let sizeBytes = 0;
      try {
        const stat = fs.statSync(memoryPath);
        sizeBytes = stat.size;
      } catch {
        // MEMORY.md doesn't exist for this agent
        continue;
      }

      const sizeKB = Math.round(sizeBytes / 1024);
      const health: 'green' | 'yellow' | 'red' =
        sizeKB < 10 ? 'green' : sizeKB < 20 ? 'yellow' : 'red';

      agents.push({
        agentId,
        memorySizeBytes: sizeBytes,
        memorySizeKB: sizeKB,
        archiveChunks: archiveCounts[agentId] || 0,
        lastRotation: lastRotations[agentId] || null,
        health,
      });
    }

    return { success: true, agents };
  } catch (err: any) {
    logger.error('[memory:status] Error:', err.message);
    return { success: false, error: err.message };
  }
}

interface RotateResult {
  success: boolean;
  output?: string;
  error?: string;
}

async function handleMemoryRotate(_event: unknown, agentId: string): Promise<RotateResult> {
  if (typeof agentId !== 'string' || !AGENT_ID_REGEX.test(agentId)) {
    return { success: false, error: 'Invalid agentId' };
  }

  return new Promise((resolve) => {
    execFile(FROGGO_DB_CLI, ['memory-rotate', agentId], {
      env: { ...process.env, PATH: SHELL_PATH },
      timeout: 60000,
    }, (err, stdout, stderr) => {
      if (err) {
        logger.error('[memory:rotate] Error:', err.message);
        resolve({ success: false, error: err.message, output: stderr });
      } else {
        logger.info(`[memory:rotate] Rotated memory for agent: ${agentId}`);
        resolve({ success: true, output: stdout });
      }
    });
  });
}

export function registerMemoryLifecycleHandlers(): void {
  registerHandler('memoryLifecycle:status', handleMemoryStatus);
  registerHandler('memoryLifecycle:rotate', handleMemoryRotate);
  logger.info('[MemoryLifecycle] Handlers registered');
}
