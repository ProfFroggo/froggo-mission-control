import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

interface InstallItem {
  kind: 'agent' | 'module';
  id: string;
}

interface InstallResult {
  kind: 'agent' | 'module';
  id: string;
  success: boolean;
  error?: string;
}

// POST /api/setup/install-agents
// Bulk-install a list of agents and modules selected in the wizard.
// Body: { items: Array<{ kind: 'agent' | 'module'; id: string }> }
export async function POST(request: NextRequest) {
  try {
    const { items } = await request.json() as { items: InstallItem[] };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    const db = getDb();
    const results: InstallResult[] = [];

    for (const item of items) {
      try {
        if (item.kind === 'agent') {
          const agent = db.prepare('SELECT id FROM catalog_agents WHERE id = ?').get(item.id);
          if (!agent) {
            results.push({ kind: 'agent', id: item.id, success: false, error: 'Not found in catalog' });
            continue;
          }
          db.prepare(
            'UPDATE catalog_agents SET installed = 1, enabled = 1, updatedAt = ? WHERE id = ?'
          ).run(Date.now(), item.id);
          results.push({ kind: 'agent', id: item.id, success: true });

        } else if (item.kind === 'module') {
          const mod = db.prepare('SELECT id FROM catalog_modules WHERE id = ?').get(item.id);
          if (!mod) {
            results.push({ kind: 'module', id: item.id, success: false, error: 'Not found in catalog' });
            continue;
          }
          db.prepare(
            'UPDATE catalog_modules SET installed = 1, enabled = 1, updatedAt = ? WHERE id = ?'
          ).run(Date.now(), item.id);

          // Ensure it exists in module_state as well
          const existing = db.prepare('SELECT module_id FROM module_state WHERE module_id = ?').get(item.id);
          if (!existing) {
            db.prepare('INSERT INTO module_state (module_id, enabled) VALUES (?, 1)').run(item.id);
          } else {
            db.prepare('UPDATE module_state SET enabled = 1 WHERE module_id = ?').run(item.id);
          }
          results.push({ kind: 'module', id: item.id, success: true });
        } else {
          results.push({ kind: item.kind, id: item.id, success: false, error: 'Unknown kind' });
        }
      } catch (itemErr) {
        results.push({
          kind: item.kind,
          id: item.id,
          success: false,
          error: itemErr instanceof Error ? itemErr.message : 'Unknown error',
        });
      }
    }

    const allOk = results.every(r => r.success);
    return NextResponse.json({ results, allOk }, { status: allOk ? 200 : 207 });

  } catch (error) {
    console.error('POST /api/setup/install-agents error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
