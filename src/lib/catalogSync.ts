// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// src/lib/catalogSync.ts
// Reads catalog/ manifest files and upserts them into the DB catalog tables.
// Called once at DB startup. Safe to re-run — preserves installed status.

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type Database from 'better-sqlite3';

const HOME = homedir();
import type { AgentManifestFile, ModuleManifestFile } from '../types/catalog';

const CATALOG_DIR = join(process.cwd(), 'catalog');

export function syncCatalogAgents(db: Database.Database): void {
  const agentsDir = join(CATALOG_DIR, 'agents');
  if (!existsSync(agentsDir)) return;

  // Support both package dirs ({id}/manifest.json) and legacy flat files ({id}.json)
  const entries = readdirSync(agentsDir);
  const packageDirs = entries.filter(e => {
    const full = join(agentsDir, e);
    return existsSync(join(full, 'manifest.json')) && !e.endsWith('.json');
  });
  const flatFiles = entries.filter(e => e.endsWith('.json'));
  // Prefer package dirs; flat files only if no package exists
  const packageIds = new Set(packageDirs);
  const files = [
    ...packageDirs.map(d => join(agentsDir, d, 'manifest.json')),
    ...flatFiles.filter(f => !packageIds.has(f.replace('.json', ''))).map(f => join(agentsDir, f)),
  ];

  const upsert = db.prepare(`
    INSERT INTO catalog_agents (id, name, emoji, role, description, model, capabilities, requiredApis, requiredSkills, requiredTools, version, category, avatar, core, defaultPersonality, installed, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, (unixepoch() * 1000), (unixepoch() * 1000))
    ON CONFLICT(id) DO UPDATE SET
      name               = excluded.name,
      emoji              = excluded.emoji,
      role               = excluded.role,
      description        = excluded.description,
      model              = excluded.model,
      capabilities       = excluded.capabilities,
      requiredApis       = excluded.requiredApis,
      requiredSkills     = excluded.requiredSkills,
      requiredTools      = excluded.requiredTools,
      version            = excluded.version,
      category           = excluded.category,
      avatar             = COALESCE(excluded.avatar, catalog_agents.avatar),
      core               = excluded.core,
      defaultPersonality = excluded.defaultPersonality,
      updatedAt          = (unixepoch() * 1000)
      -- NOTE: installed is deliberately NOT updated here — preserves hire status across restarts
  `);

  const syncAll = db.transaction(() => {
    for (const file of files) {
      try {
        const manifest: AgentManifestFile = JSON.parse(
          readFileSync(file, 'utf-8')
        );
        // Resolve avatar: workspace first (hired), then catalog package (pre-hire)
        const workspaceAvatar = join(HOME, 'mission-control', 'agents', manifest.id, 'assets', 'avatar.webp');
        const catalogAvatar   = join(CATALOG_DIR, 'agents', manifest.id, 'avatar.webp');
        const avatarPath = existsSync(workspaceAvatar) ? workspaceAvatar
                         : existsSync(catalogAvatar)   ? catalogAvatar
                         : null;

        upsert.run(
          manifest.id,
          manifest.name,
          manifest.emoji ?? '🤖',
          manifest.role ?? null,
          manifest.description ?? null,
          manifest.model ?? 'sonnet',
          JSON.stringify(manifest.capabilities ?? []),
          JSON.stringify(manifest.requiredApis ?? []),
          JSON.stringify(manifest.requiredSkills ?? []),
          JSON.stringify(manifest.requiredTools ?? []),
          manifest.version ?? '1.0.0',
          manifest.category ?? 'general',
          avatarPath,
          manifest.core ? 1 : 0,
          manifest.defaultPersonality ?? null,
        );
      } catch (err) {
        console.warn(`[catalogSync] Failed to sync agent manifest ${file}:`, err);
      }
    }
  });

  syncAll();

  // Auto-provision core agents into the agents table — they are always active,
  // never need manual hire, and cannot be uninstalled.
  try {
    db.prepare(`
      INSERT OR IGNORE INTO agents (id, name, role, emoji, color, capabilities, personality, status, created_at)
      SELECT ca.id, ca.name, COALESCE(ca.role, 'Agent'), COALESCE(ca.emoji, '🤖'),
             '#00BCD4', ca.capabilities, COALESCE(ca.defaultPersonality, ''), 'idle', unixepoch()
      FROM catalog_agents ca
      WHERE ca.core = 1
    `).run();

    // Always mark core agents as installed
    db.prepare(`UPDATE catalog_agents SET installed = 1 WHERE core = 1`).run();
  } catch { /* agents table may not exist in tests */ }

  // Auto-mark non-core agents as installed if they exist in the agents table
  // (agents table is the source of truth for "hired" status)
  try {
    db.prepare(`
      UPDATE catalog_agents
      SET installed = 1
      WHERE core = 0
        AND id IN (SELECT id FROM agents WHERE status != 'archived')
        AND installed = 0
    `).run();
  } catch { /* agents table may not exist in tests */ }
}

export function syncCatalogModules(db: Database.Database): void {
  const modulesDir = join(CATALOG_DIR, 'modules');
  if (!existsSync(modulesDir)) return;

  const files = readdirSync(modulesDir).filter(f => f.endsWith('.json'));

  const upsert = db.prepare(`
    INSERT INTO catalog_modules (id, name, description, version, category, icon, responsibleAgent, requiredAgents, requiredNpm, requiredApis, requiredSkills, requiredCli, core, installed, enabled, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, (unixepoch() * 1000), (unixepoch() * 1000))
    ON CONFLICT(id) DO UPDATE SET
      name             = excluded.name,
      description      = excluded.description,
      version          = excluded.version,
      category         = excluded.category,
      icon             = excluded.icon,
      responsibleAgent = excluded.responsibleAgent,
      requiredAgents   = excluded.requiredAgents,
      requiredNpm      = excluded.requiredNpm,
      requiredApis     = excluded.requiredApis,
      requiredSkills   = excluded.requiredSkills,
      requiredCli      = excluded.requiredCli,
      core             = excluded.core,
      updatedAt        = (unixepoch() * 1000)
      -- NOTE: installed and enabled are deliberately NOT updated — preserves install state across restarts
  `);

  const syncAll = db.transaction(() => {
    for (const file of files) {
      try {
        const manifest: ModuleManifestFile = JSON.parse(
          readFileSync(join(modulesDir, file), 'utf-8')
        );
        upsert.run(
          manifest.id,
          manifest.name,
          manifest.description ?? null,
          manifest.version ?? '1.0.0',
          manifest.category ?? 'general',
          manifest.icon ?? '📦',
          manifest.responsibleAgent ?? null,
          JSON.stringify(manifest.requiredAgents ?? []),
          JSON.stringify(manifest.requiredNpm ?? []),
          JSON.stringify(manifest.requiredApis ?? []),
          JSON.stringify(manifest.requiredSkills ?? []),
          JSON.stringify(manifest.requiredCli ?? []),
          manifest.core ? 1 : 0,
        );
      } catch (err) {
        console.warn(`[catalogSync] Failed to sync module manifest ${file}:`, err);
      }
    }
  });

  syncAll();
}
