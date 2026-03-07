import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { validateAgentId } from '@/lib/validateId';
import { parseCatalogAgent, type CatalogAgentRow } from '@/types/catalog';
import { existsSync, renameSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const HOME = homedir();

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;
    const db = getDb();
    const row = db.prepare('SELECT * FROM catalog_agents WHERE id = ?').get(id) as CatalogAgentRow | undefined;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(parseCatalogAgent(row));
  } catch (error) {
    console.error('GET /api/catalog/agents/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;
    const body = await req.json();
    const db = getDb();

    const row = db.prepare('SELECT * FROM catalog_agents WHERE id = ?').get(id) as CatalogAgentRow | undefined;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const CORE_AGENTS = ['mission-control', 'hr', 'coder', 'inbox', 'clara'];
    if (CORE_AGENTS.includes(id) && body.installed === false) {
      return NextResponse.json({ error: 'Core agents cannot be uninstalled' }, { status: 403 });
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (typeof body.installed === 'boolean') {
      fields.push('installed = ?');
      values.push(body.installed ? 1 : 0);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    fields.push('updatedAt = ?');
    values.push(Date.now());
    values.push(id);

    db.prepare(`UPDATE catalog_agents SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM catalog_agents WHERE id = ?').get(id) as CatalogAgentRow;
    return NextResponse.json(parseCatalogAgent(updated));
  } catch (error) {
    console.error('PATCH /api/catalog/agents/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/catalog/agents/[id]
// Uninstall an agent: marks installed=0 in catalog, sets agents table status to archived,
// and archives the workspace directory (renames to {id}-archived-{timestamp}).
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;
    const db = getDb();

    const CORE_AGENTS = ['mission-control', 'hr', 'coder', 'inbox', 'clara'];
    if (CORE_AGENTS.includes(id)) {
      return NextResponse.json({ error: 'Core agents cannot be fired' }, { status: 403 });
    }

    const row = db.prepare('SELECT * FROM catalog_agents WHERE id = ?').get(id) as CatalogAgentRow | undefined;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Mark uninstalled in catalog
    db.prepare('UPDATE catalog_agents SET installed = 0, updatedAt = ? WHERE id = ?').run(Date.now(), id);

    // Archive agent in agents table (if it exists)
    const agent = db.prepare("SELECT id FROM agents WHERE id = ?").get(id);
    if (agent) {
      db.prepare("UPDATE agents SET status = 'archived' WHERE id = ?").run(id);
    }

    // Archive workspace directory (non-destructive)
    const workspaceDir = join(HOME, 'mission-control', 'agents', id);
    if (existsSync(workspaceDir)) {
      const archiveDir = join(HOME, 'mission-control', 'agents', '_archive');
      const { mkdirSync } = await import('fs');
      mkdirSync(archiveDir, { recursive: true });
      const archivePath = join(archiveDir, `${id}-${Date.now()}`);
      try { renameSync(workspaceDir, archivePath); } catch { /* workspace may be in use */ }
    }

    return NextResponse.json({ id, uninstalled: true });
  } catch (error) {
    console.error('DELETE /api/catalog/agents/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
