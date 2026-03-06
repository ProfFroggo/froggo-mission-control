// src/lib/catalogSync.ts
// Reads .catalog/ manifest files and upserts them into the DB catalog tables.
// Called once at DB startup. Safe to re-run — preserves installed status.

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type Database from 'better-sqlite3';
import type { AgentManifestFile, ModuleManifestFile } from '../types/catalog';

const CATALOG_DIR = join(process.cwd(), '.catalog');

export function syncCatalogAgents(db: Database.Database): void {
  const agentsDir = join(CATALOG_DIR, 'agents');
  if (!existsSync(agentsDir)) return;

  const files = readdirSync(agentsDir).filter(f => f.endsWith('.json'));

  const upsert = db.prepare(`
    INSERT INTO catalog_agents (id, name, emoji, role, description, model, capabilities, requiredApis, requiredSkills, requiredTools, version, category, installed, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, (unixepoch() * 1000), (unixepoch() * 1000))
    ON CONFLICT(id) DO UPDATE SET
      name         = excluded.name,
      emoji        = excluded.emoji,
      role         = excluded.role,
      description  = excluded.description,
      model        = excluded.model,
      capabilities = excluded.capabilities,
      requiredApis = excluded.requiredApis,
      requiredSkills = excluded.requiredSkills,
      requiredTools = excluded.requiredTools,
      version      = excluded.version,
      category     = excluded.category,
      updatedAt    = (unixepoch() * 1000)
      -- NOTE: installed is deliberately NOT updated here — preserves hire status across restarts
  `);

  const syncAll = db.transaction(() => {
    for (const file of files) {
      try {
        const manifest: AgentManifestFile = JSON.parse(
          readFileSync(join(agentsDir, file), 'utf-8')
        );
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
        );
      } catch (err) {
        console.warn(`[catalogSync] Failed to sync agent manifest ${file}:`, err);
      }
    }
  });

  syncAll();
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
