// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { validateAgentId } from '@/lib/validateId';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

function settingKey(agentId: string, field: string) {
  return `agent.${agentId}.${field}`;
}

function getSettingArray(db: ReturnType<typeof getDb>, key: string): string[] {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

// GET /api/agents/:id/config — returns skills, tools, apiKeys
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;
    const db = getDb();

    const agent = db.prepare('SELECT id, model, capabilities, trust_tier FROM agents WHERE id = ?').get(id) as
      | { id: string; model: string; capabilities: string; trust_tier: string } | undefined;
    if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let capabilities: string[] = [];
    try { capabilities = JSON.parse(agent.capabilities || '[]'); } catch { /* */ }

    const mcpRaw = db.prepare('SELECT value FROM settings WHERE key = ?').get(settingKey(id, 'mcpServers')) as { value: string } | undefined;
    let mcpServers: unknown[] = [];
    try { if (mcpRaw?.value) { const p = JSON.parse(mcpRaw.value); if (Array.isArray(p)) mcpServers = p; } } catch { /* */ }

    return NextResponse.json({
      model: agent.model || 'sonnet',
      trustTier: agent.trust_tier || 'apprentice',
      capabilities,
      skills: getSettingArray(db, settingKey(id, 'skills')),
      tools: getSettingArray(db, settingKey(id, 'tools')),
      apiKeys: getSettingArray(db, settingKey(id, 'apiKeys')),
      mcpServers,
    });
  } catch (error) {
    console.error('GET /api/agents/:id/config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/agents/:id/config — updates one or more fields
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;
    const db = getDb();
    const body = await req.json();

    const agent = db.prepare('SELECT id FROM agents WHERE id = ?').get(id);
    if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // model + capabilities + trustTier → agents table
    if (body.model !== undefined) {
      db.prepare('UPDATE agents SET model = ? WHERE id = ?').run(body.model, id);
    }
    if (Array.isArray(body.capabilities)) {
      db.prepare('UPDATE agents SET capabilities = ? WHERE id = ?').run(
        JSON.stringify(body.capabilities), id
      );
    }
    if (body.trustTier !== undefined) {
      db.prepare('UPDATE agents SET trust_tier = ? WHERE id = ?').run(body.trustTier, id);
    }

    // skills, tools, apiKeys, mcpServers → settings table
    for (const field of ['skills', 'tools', 'apiKeys', 'mcpServers'] as const) {
      if (Array.isArray(body[field])) {
        const key = settingKey(id, field);
        const value = JSON.stringify(body[field]);
        db.prepare(`
          INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT (key) DO UPDATE SET value = excluded.value
        `).run(key, value);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('PATCH /api/agents/:id/config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
