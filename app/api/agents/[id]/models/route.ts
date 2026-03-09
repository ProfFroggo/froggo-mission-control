// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { validateAgentId } from '@/lib/validateId';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;
    const db = getDb();
    const agent = db.prepare('SELECT id, model FROM agents WHERE id = ?').get(id) as { id: string; model: string } | undefined;

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({ id: agent.id, model: agent.model });
  } catch (error) {
    console.error('GET /api/agents/[id]/models error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;
    const db = getDb();
    const body = await request.json();

    const { model } = body;
    if (!model) {
      return NextResponse.json({ error: 'model is required' }, { status: 400 });
    }

    const result = db.prepare('UPDATE agents SET model = ? WHERE id = ?').run(model, id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id, model });
  } catch (error) {
    console.error('PUT /api/agents/[id]/models error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
