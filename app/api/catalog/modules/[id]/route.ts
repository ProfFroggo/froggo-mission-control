// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { parseCatalogModule, type CatalogModuleRow } from '@/types/catalog';
import { validateAgentId } from '@/lib/validateId';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;
    const db = getDb();
    const row = db.prepare('SELECT * FROM catalog_modules WHERE id = ?').get(id) as CatalogModuleRow | undefined;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(parseCatalogModule(row));
  } catch (error) {
    console.error('GET /api/catalog/modules/[id] error:', error);
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

    const row = db.prepare('SELECT * FROM catalog_modules WHERE id = ?').get(id) as CatalogModuleRow | undefined;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Prevent uninstalling core modules
    if (row.core === 1 && body.installed === false) {
      return NextResponse.json({ error: 'Core modules cannot be uninstalled' }, { status: 403 });
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (typeof body.installed === 'boolean') {
      fields.push('installed = ?');
      values.push(body.installed ? 1 : 0);
    }
    if (typeof body.enabled === 'boolean') {
      fields.push('enabled = ?');
      values.push(body.enabled ? 1 : 0);
    }
    if (body.configuration !== undefined) {
      fields.push('configuration = ?');
      values.push(typeof body.configuration === 'string'
        ? body.configuration
        : JSON.stringify(body.configuration));
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    fields.push('updatedAt = ?');
    values.push(Date.now());
    values.push(id);

    db.prepare(`UPDATE catalog_modules SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM catalog_modules WHERE id = ?').get(id) as CatalogModuleRow;
    return NextResponse.json(parseCatalogModule(updated));
  } catch (error) {
    console.error('PATCH /api/catalog/modules/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/catalog/modules/[id]
// Uninstall a module: marks installed=0, enabled=0 in catalog_modules and module_state.
// Core modules cannot be uninstalled (403).
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;
    const db = getDb();

    const row = db.prepare('SELECT * FROM catalog_modules WHERE id = ?').get(id) as CatalogModuleRow | undefined;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (row.core === 1) return NextResponse.json({ error: 'Core modules cannot be uninstalled' }, { status: 403 });

    // Mark uninstalled in catalog
    db.prepare('UPDATE catalog_modules SET installed = 0, enabled = 0, updatedAt = ? WHERE id = ?').run(Date.now(), id);

    // Disable in module_state
    db.prepare('UPDATE module_state SET enabled = 0 WHERE module_id = ?').run(id);

    return NextResponse.json({ id, uninstalled: true });
  } catch (error) {
    console.error('DELETE /api/catalog/modules/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
