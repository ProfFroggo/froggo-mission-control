// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/library/[id]/ask — stub ask-agent endpoint for a specific file
// Body: { question: string }
// Returns: { answer: string }
// Logs to task_activity for observability
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json() as { question?: string };

    if (!body.question || typeof body.question !== 'string' || !body.question.trim()) {
      return NextResponse.json({ success: false, error: 'question is required' }, { status: 400 });
    }

    const question = body.question.trim();
    const db = getDb();

    // Look up file for context
    const file = db.prepare('SELECT id, name, category, tags FROM library_files WHERE id = ?').get(id) as
      | { id: string; name: string; category: string | null; tags: string | null }
      | undefined;

    // Also check if it's a filesystem-based file (base64url id)
    const fileName = file?.name ?? id;

    // Log the ask to task_activity for observability
    try {
      db.prepare(
        `INSERT INTO task_activity (taskId, agentId, action, message, details, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        'library-ask',
        'library-assistant',
        'ask',
        `Library ask about "${fileName}": ${question.slice(0, 120)}`,
        JSON.stringify({ fileId: id, fileName, question }),
        Date.now()
      );
    } catch {
      // task_activity insert is non-critical — continue even if it fails
    }

    // Stub response — a real implementation would dispatch to an AI agent
    const answer = `Agent response will appear here. This feature connects to your AI agents. You asked about "${fileName}": ${question}`;

    return NextResponse.json({ success: true, answer, fileId: id });
  } catch (error) {
    console.error('POST /api/library/[id]/ask error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
