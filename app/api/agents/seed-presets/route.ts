// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/agents/seed-presets
// Backfills model, trust_tier, skills, tools, and apiKeys for all installed agents
// that are missing these settings. Safe to call multiple times — uses ON CONFLICT DO NOTHING
// so existing user customizations are never overwritten.
import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CATALOG_DIR = join(process.cwd(), 'catalog');

const TIER_MAP: Record<string, string> = {
  bypassPermissions: 'worker',
  acceptEdits: 'apprentice',
  default: 'apprentice',
};

export async function POST() {
  try {
    const db = getDb();

    const installedAgents = db.prepare(
      `SELECT id FROM agents WHERE status != 'archived'`
    ).all() as { id: string }[];

    const seedSetting = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT (key) DO NOTHING
    `);

    const results: { id: string; seeded: string[] }[] = [];

    for (const { id } of installedAgents) {
      const catalogJsonPath = join(CATALOG_DIR, 'agents', `${id}.json`);
      if (!existsSync(catalogJsonPath)) continue;

      let catalogJson: Record<string, unknown>;
      try {
        catalogJson = JSON.parse(readFileSync(catalogJsonPath, 'utf-8'));
      } catch {
        continue;
      }

      const { requiredSkills, requiredTools, requiredApis, model: catalogModel, permissionMode } = catalogJson as {
        requiredSkills?: string[];
        requiredTools?: string[];
        requiredApis?: string[];
        model?: string;
        permissionMode?: string;
      };

      const seeded: string[] = [];

      if (catalogModel) {
        const updated = db.prepare(
          `UPDATE agents SET model = ? WHERE id = ? AND (model IS NULL OR model = '')`
        ).run(catalogModel, id);
        if (updated.changes > 0) seeded.push('model');
      }

      const trustTier = TIER_MAP[permissionMode ?? ''] ?? 'apprentice';
      const tierUpdated = db.prepare(
        `UPDATE agents SET trust_tier = ? WHERE id = ? AND (trust_tier IS NULL OR trust_tier = '')`
      ).run(trustTier, id);
      if (tierUpdated.changes > 0) seeded.push('trust_tier');

      if (Array.isArray(requiredSkills) && requiredSkills.length > 0) {
        const r = seedSetting.run(`agent.${id}.skills`, JSON.stringify(requiredSkills));
        if (r.changes > 0) seeded.push('skills');
      }
      if (Array.isArray(requiredTools) && requiredTools.length > 0) {
        const r = seedSetting.run(`agent.${id}.tools`, JSON.stringify(requiredTools));
        if (r.changes > 0) seeded.push('tools');
      }
      if (Array.isArray(requiredApis) && requiredApis.length > 0) {
        const r = seedSetting.run(`agent.${id}.apiKeys`, JSON.stringify(requiredApis));
        if (r.changes > 0) seeded.push('apiKeys');
      }

      results.push({ id, seeded });
    }

    return NextResponse.json({
      ok: true,
      agents: results.length,
      results,
    });
  } catch (error) {
    console.error('POST /api/agents/seed-presets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
