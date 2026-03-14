// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET  /api/knowledge/templates       — list all templates
// POST /api/knowledge/templates       — create a new template
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  try {
    const templates = db.prepare(
      `SELECT id, label, content, category, createdAt, updatedAt FROM knowledge_templates ORDER BY label ASC`
    ).all();
    return NextResponse.json({ success: true, templates });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const db = getDb();
  try {
    const body = await req.json();
    const { label, content, category = 'general' } = body;
    if (!label?.trim() || !content?.trim()) {
      return NextResponse.json({ success: false, error: 'label and content are required' }, { status: 400 });
    }
    const now = Date.now();
    const id = `tmpl-${now}-${Math.random().toString(36).slice(2, 7)}`;
    db.prepare(
      `INSERT INTO knowledge_templates (id, label, content, category, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, label.trim(), content.trim(), category, now, now);
    return NextResponse.json({ success: true, id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
