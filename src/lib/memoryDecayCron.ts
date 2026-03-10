// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Memory Decay Cron — runs daily (every 24 hours).
 * Archives memory notes older than the configured TTL and tracks vault stats.
 *
 * Notes with category 'daily' or 'session' age out after 30 days.
 * Notes with category 'task' age out after 90 days.
 * Notes in 'knowledge/' never expire (permanent).
 * Agent MEMORY.md and SOUL.md files are never touched.
 */

import { existsSync, readdirSync, statSync, mkdirSync, renameSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { trackEvent } from './telemetry';

const HOME = homedir();
const VAULT_PATH = join(HOME, 'mission-control', 'memory');

const DECAY_RULES: { folder: string; maxAgeDays: number }[] = [
  { folder: 'daily',    maxAgeDays: 30  },
  { folder: 'sessions', maxAgeDays: 30  },
  { folder: 'agents',   maxAgeDays: 90  },
];

const DECAY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface VaultStats {
  totalNotes: number;
  archivedNotes: number;
  vaultPath: string;
  lastDecayRun: number | null;
}

// Track last run timestamp in memory
let lastDecayRun: number | null = null;

function countMdFiles(dir: string): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        count += countMdFiles(fullPath);
      } else if (entry.name.endsWith('.md')) {
        count++;
      }
    }
  } catch { /* non-critical */ }
  return count;
}

export function getVaultStats(): VaultStats {
  const totalNotes = countMdFiles(VAULT_PATH);
  const archivePath = join(VAULT_PATH, '_archive');
  const archivedNotes = countMdFiles(archivePath);

  return {
    totalNotes,
    archivedNotes,
    vaultPath: VAULT_PATH,
    lastDecayRun,
  };
}

export function runDecayCycle(): { archived: number } {
  if (!existsSync(VAULT_PATH)) return { archived: 0 };

  let archived = 0;
  const now = Date.now();

  for (const rule of DECAY_RULES) {
    const folderPath = join(VAULT_PATH, rule.folder);
    if (!existsSync(folderPath)) continue;

    const cutoff = now - rule.maxAgeDays * 24 * 60 * 60 * 1000;

    try {
      // Walk one level deep (agent subdirs for 'agents', direct files for 'daily'/'sessions')
      const entries = readdirSync(folderPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(folderPath, entry.name);

        // For 'agents' folder: go one level deeper (agent subdirs)
        if (rule.folder === 'agents' && entry.isDirectory()) {
          // Never touch MEMORY.md or SOUL.md or MEMORY_archive_* files
          try {
            const agentFiles = readdirSync(fullPath, { withFileTypes: true });
            for (const agentFile of agentFiles) {
              if (!agentFile.isFile()) continue;
              const fname = agentFile.name;
              if (!fname.endsWith('.md')) continue;
              if (fname === 'MEMORY.md' || fname === 'SOUL.md' || fname.startsWith('MEMORY_archive')) continue;

              const agentFilePath = join(fullPath, fname);
              try {
                const stat = statSync(agentFilePath);
                if (stat.mtimeMs < cutoff) {
                  const archiveDir = join(VAULT_PATH, '_archive', rule.folder, entry.name);
                  mkdirSync(archiveDir, { recursive: true });
                  renameSync(agentFilePath, join(archiveDir, fname));
                  archived++;
                }
              } catch { /* skip locked or missing files */ }
            }
          } catch { /* non-critical */ }
          continue;
        }

        // For 'daily' and 'sessions': direct .md files
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

        try {
          const stat = statSync(fullPath);
          if (stat.mtimeMs < cutoff) {
            const archiveDir = join(VAULT_PATH, '_archive', rule.folder);
            mkdirSync(archiveDir, { recursive: true });
            renameSync(fullPath, join(archiveDir, entry.name));
            archived++;
          }
        } catch { /* skip locked or missing files */ }
      }
    } catch { /* non-critical */ }
  }

  lastDecayRun = now;
  if (archived > 0) {
    console.log(`[memory-decay-cron] Archived ${archived} note(s) to _archive/`);
    trackEvent('memory.decayed', { archived });
  }
  return { archived };
}

// ── Cron timer ────────────────────────────────────────────────────────────────
type G = typeof globalThis & { _memoryDecayCron?: ReturnType<typeof setInterval> };

export function startMemoryDecayCron(): void {
  const g = globalThis as G;
  if (g._memoryDecayCron) return;
  g._memoryDecayCron = true as unknown as ReturnType<typeof setInterval>;

  const interval = setInterval(runDecayCycle, DECAY_INTERVAL_MS);
  interval.unref?.();
  g._memoryDecayCron = interval;
  console.log('[memory-decay-cron] Started — runs every 24 hours');
}
