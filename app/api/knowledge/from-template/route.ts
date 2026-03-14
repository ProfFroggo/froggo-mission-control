// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/knowledge/from-template — create an article from a template
// body: { templateId: string, overrides?: { title?: string, category?: string } }
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const db = getDb();
  try {
    const body = await req.json();
    const { templateId, overrides = {} } = body as {
      templateId: string;
      overrides?: { title?: string; category?: string };
    };

    if (!templateId?.trim()) {
      return NextResponse.json({ success: false, error: 'templateId is required' }, { status: 400 });
    }

    const template = db.prepare(
      'SELECT id, label, content, category FROM knowledge_templates WHERE id = ?'
    ).get(templateId) as { id: string; label: string; content: string; category: string } | undefined;

    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    const title = overrides.title?.trim() || template.label;
    const category = overrides.category?.trim() || template.category;
    // Replace placeholder heading with actual title
    const content = template.content.replace(/^# .*$/m, `# ${title}`);

    const now = Date.now();
    const id = `kb-${now}-${Math.random().toString(36).slice(2, 7)}`;
    db.prepare(
      `INSERT INTO knowledge_base (id, title, content, category, tags, scope, pinned, version, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, '[]', 'all', 0, 1, 'human', ?, ?)`
    ).run(id, title, content, category, now, now);

    return NextResponse.json({ success: true, id, title, category });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
