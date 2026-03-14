// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { validateAgentId } from '@/lib/validateId';
import { emitSSEEvent } from '@/lib/sseEmitter';
import { TIER_PERMISSIONS_MAP } from '@/lib/taskDispatcher';

function parseAgent(row: Record<string, unknown>) {
  if (!row) return row;
  const parsed = { ...row };
  if (typeof parsed.capabilities === 'string') {
    try {
      parsed.capabilities = JSON.parse(parsed.capabilities as string);
    } catch {
      parsed.capabilities = [];
    }
  }
  return parsed;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;
    const db = getDb();
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Record<string, unknown> | undefined;

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const parsed = parseAgent(agent);

    // Enrich with skills + tools from settings table
    const getSetting = (key: string): string[] => {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(`agent.${id}.${key}`) as { value: string } | undefined;
      if (!row?.value) return [];
      try { const p = JSON.parse(row.value); return Array.isArray(p) ? p : []; } catch { return []; }
    };
    const skills = getSetting('skills');
    const tools  = getSetting('tools');

    return NextResponse.json({
      ...parsed,
      skills: skills.map(s => ({ name: s, proficiency: 0.7, lastUsed: 'N/A', successCount: 0, failureCount: 0 })),
      tools,
      trustTier: parsed.trust_tier || 'apprentice',
    });
  } catch (error) {
    console.error('GET /api/agents/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;
    const db = getDb();
    const body = await request.json();

    const setClauses: string[] = [];
    const values: unknown[] = [];
    const now = Date.now();

    if ('trust_tier' in body) {
      const tier = Number(body.trust_tier);
      if (!isNaN(tier)) {
        setClauses.push('trust_tier = ?');
        values.push(body.trust_tier);
        // Apply tier permissions cascade
        const perms = TIER_PERMISSIONS_MAP[tier];
        if (perms) {
          setClauses.push('capabilities = ?');
          values.push(JSON.stringify(perms.allowedTools));
        }
      }
    }

    if ('capabilities' in body && Array.isArray(body.capabilities)) {
      setClauses.push('capabilities = ?');
      values.push(JSON.stringify(body.capabilities));
    }

    if ('description' in body && typeof body.description === 'string') {
      setClauses.push('description = ?');
      values.push(body.description.trim());
    }

    // Manual status override — accepts any valid agent status
    const VALID_STATUSES = ['active', 'busy', 'idle', 'offline', 'suspended', 'archived', 'draft', 'disabled'];
    if ('status' in body && typeof body.status === 'string' && VALID_STATUSES.includes(body.status)) {
      setClauses.push('status = ?');
      values.push(body.status);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    setClauses.push('lastActivity = ?');
    values.push(now);
    values.push(id);

    const result = db.prepare(`UPDATE agents SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const updated = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Record<string, unknown>;
    emitSSEEvent('agent.updated', { id });

    return NextResponse.json(parseAgent(updated));
  } catch (error) {
    console.error('PATCH /api/agents/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
