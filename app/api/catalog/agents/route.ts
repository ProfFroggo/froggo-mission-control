import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { parseCatalogAgent, type CatalogAgentRow } from '@/types/catalog';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const CATALOG_AGENTS_DIR = join(
  process.env.MC_PROJECT_ROOT || process.cwd(),
  'catalog',
  'agents'
);

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM catalog_agents ORDER BY category, name'
    ).all() as CatalogAgentRow[];
    return NextResponse.json(rows.map(parseCatalogAgent));
  } catch (error) {
    console.error('GET /api/catalog/agents error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/catalog/agents
// Register a custom-created agent in the catalog.
// Writes catalog/agents/{id}.json manifest and upserts into catalog_agents with installed=1.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, emoji, role, capabilities, category } = body;

    if (!id || !name) {
      return NextResponse.json({ error: 'id and name are required' }, { status: 400 });
    }

    const manifest = {
      id,
      name,
      emoji:         emoji         || '🤖',
      role:          role          || '',
      description:   body.description || role || '',
      model:         body.model    || 'sonnet',
      capabilities:  capabilities  || [],
      requiredApis:  [],
      requiredSkills:[],
      requiredTools: [],
      version:       '1.0.0',
      category:      category      || 'custom',
    };

    // Write manifest file
    mkdirSync(CATALOG_AGENTS_DIR, { recursive: true });
    writeFileSync(
      join(CATALOG_AGENTS_DIR, `${id}.json`),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    // Upsert into catalog_agents with installed=1
    const now = Date.now();
    const db = getDb();
    db.prepare(`
      INSERT INTO catalog_agents (id, name, emoji, role, description, model, capabilities, requiredApis, requiredSkills, requiredTools, version, category, installed, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name         = excluded.name,
        emoji        = excluded.emoji,
        role         = excluded.role,
        description  = excluded.description,
        model        = excluded.model,
        capabilities = excluded.capabilities,
        requiredApis = excluded.requiredApis,
        requiredSkills = excluded.requiredSkills,
        requiredTools  = excluded.requiredTools,
        version      = excluded.version,
        category     = excluded.category,
        installed    = 1,
        updated_at   = excluded.updated_at
    `).run(
      id, name, manifest.emoji, manifest.role, manifest.description, manifest.model,
      JSON.stringify(manifest.capabilities),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      manifest.version, manifest.category,
      now, now
    );

    const row = db.prepare('SELECT * FROM catalog_agents WHERE id = ?').get(id) as CatalogAgentRow;
    return NextResponse.json(parseCatalogAgent(row), { status: 201 });
  } catch (error) {
    console.error('POST /api/catalog/agents error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
