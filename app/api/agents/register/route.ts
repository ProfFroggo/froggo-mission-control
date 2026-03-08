import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CATALOG_DIR = join(process.cwd(), 'catalog', 'agents');

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    // Validate catalog entry exists
    const manifestPath = join(CATALOG_DIR, `${id}.json`);
    if (!existsSync(manifestPath)) {
      return NextResponse.json(
        { error: `No catalog manifest found at catalog/agents/${id}.json` },
        { status: 404 }
      );
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    const db = getDb();

    // Upsert into catalog_agents
    db.prepare(`
      INSERT INTO catalog_agents (id, name, role, emoji, description, model, capabilities, version, category, core, installed, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
      ON CONFLICT(id) DO UPDATE SET
        name         = excluded.name,
        role         = excluded.role,
        emoji        = excluded.emoji,
        description  = excluded.description,
        model        = excluded.model,
        capabilities = excluded.capabilities,
        version      = excluded.version,
        category     = excluded.category,
        updatedAt    = excluded.updatedAt
    `).run(
      id,
      manifest.name || id,
      manifest.role || '',
      manifest.emoji || '🤖',
      manifest.description || '',
      manifest.model || 'sonnet',
      JSON.stringify(manifest.capabilities || []),
      manifest.version || '1.0.0',
      manifest.category || 'custom',
      Date.now()
    );

    return NextResponse.json({
      ok: true,
      message: `Agent ${id} registered in catalog. Call POST /api/agents/hire to install workspace.`,
      nextStep: `POST /api/agents/hire with body { "agentId": "${id}" }`,
    });
  } catch (error) {
    console.error('POST /api/agents/register error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
