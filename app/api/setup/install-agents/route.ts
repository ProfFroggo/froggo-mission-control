import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { mkdirSync, existsSync, copyFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { ENV } from '@/lib/env';

function scaffoldAgentWorkspace(agentId: string) {
  const agentDir = join(homedir(), 'mission-control', 'agents', agentId);
  for (const sub of ['assets', 'deliverables', 'memory', 'reviews', 'scripts', 'tasks']) {
    mkdirSync(join(agentDir, sub), { recursive: true });
  }
  // Copy SOUL.md from catalog if not already present
  const catalogSoul = join(ENV.PROJECT_DIR, 'catalog', 'agents', agentId, 'soul.md');
  const destSoul = join(agentDir, 'SOUL.md');
  if (existsSync(catalogSoul) && !existsSync(destSoul)) {
    try { copyFileSync(catalogSoul, destSoul); } catch { /* non-critical */ }
  }
  // Copy CLAUDE.md from catalog if not already present
  const catalogClaude = join(ENV.PROJECT_DIR, 'catalog', 'agents', agentId, 'claude.md');
  const destClaude = join(agentDir, 'CLAUDE.md');
  if (existsSync(catalogClaude) && !existsSync(destClaude)) {
    try { copyFileSync(catalogClaude, destClaude); } catch { /* non-critical */ }
  }
}

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
          const agent = db.prepare('SELECT id, name, role, emoji, color, capabilities, defaultPersonality FROM catalog_agents WHERE id = ?').get(item.id) as Record<string, string> | undefined;
          if (!agent) {
            results.push({ kind: 'agent', id: item.id, success: false, error: 'Not found in catalog' });
            continue;
          }
          db.prepare(
            'UPDATE catalog_agents SET installed = 1, enabled = 1, updatedAt = ? WHERE id = ?'
          ).run(Date.now(), item.id);
          // Provision into agents table so the agent is active
          db.prepare(
            `INSERT OR IGNORE INTO agents (id, name, role, emoji, color, capabilities, personality, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'offline', unixepoch())`
          ).run(
            agent.id,
            agent.name,
            agent.role ?? 'Agent',
            agent.emoji ?? '🤖',
            agent.color ?? '#00BCD4',
            agent.capabilities ?? '[]',
            agent.defaultPersonality ?? '',
          );
          // Scaffold workspace directories and copy soul/config files
          try { scaffoldAgentWorkspace(item.id); } catch { /* non-critical */ }
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
