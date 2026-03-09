// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

// POST /api/modules/install
// Registers a catalog module as installed in both catalog_modules and module_state tables.
// This is the "dry" install step — actual npm deps and code must already exist.
// Body: { moduleId: string }
export async function POST(request: NextRequest) {
  try {
    const { moduleId } = await request.json();
    if (!moduleId || typeof moduleId !== 'string') {
      return NextResponse.json({ error: 'moduleId is required' }, { status: 400 });
    }

    const db = getDb();

    // Verify the module exists in catalog
    const catalog = db.prepare('SELECT * FROM catalog_modules WHERE id = ?').get(moduleId) as
      | { id: string; name: string; core: number } | undefined;

    if (!catalog) {
      return NextResponse.json({ error: `Module '${moduleId}' not found in catalog` }, { status: 404 });
    }

    const steps: Array<{ step: string; success: boolean; detail: string }> = [];

    // Step 1: Mark installed in catalog_modules
    db.prepare(
      'UPDATE catalog_modules SET installed = 1, enabled = 1, updatedAt = ? WHERE id = ?'
    ).run(Date.now(), moduleId);
    steps.push({ step: 'catalog', success: true, detail: 'catalog_modules.installed = 1' });

    // Step 2: Register in module_state (enables it in the panel system)
    const existing = db.prepare('SELECT module_id FROM module_state WHERE module_id = ?').get(moduleId);
    if (!existing) {
      db.prepare(
        'INSERT INTO module_state (module_id, enabled) VALUES (?, 1)'
      ).run(moduleId);
      steps.push({ step: 'module_state', success: true, detail: 'Registered in module_state' });
    } else {
      db.prepare('UPDATE module_state SET enabled = 1 WHERE module_id = ?').run(moduleId);
      steps.push({ step: 'module_state', success: true, detail: 'module_state.enabled = 1' });
    }

    return NextResponse.json({ moduleId, steps }, { status: 201 });
  } catch (error) {
    console.error('POST /api/modules/install error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
