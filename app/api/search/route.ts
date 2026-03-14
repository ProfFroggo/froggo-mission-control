// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/search?q=query
// Returns { tasks: [...], agents: [...], files: [...], knowledge: [...], automations: [...] }
// Max 5 results per category. Searches title/name/description fields via LIKE.

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ tasks: [], agents: [], files: [], knowledge: [] });
  }

  const db = getDb();
  const like = `%${q}%`;

  try {
    // Tasks — search title and description
    const tasks = db.prepare(`
      SELECT id, title, description, status, assignedTo, updatedAt
      FROM tasks
      WHERE title LIKE ? OR description LIKE ?
      ORDER BY updatedAt DESC
      LIMIT 5
    `).all(like, like);

    // Agents — search name, role, id
    let agents: unknown[] = [];
    try {
      agents = db.prepare(`
        SELECT id, name, role, status, description
        FROM agents
        WHERE name LIKE ? OR role LIKE ? OR id LIKE ?
        ORDER BY name ASC
        LIMIT 5
      `).all(like, like, like);
    } catch {
      // agents table may not exist in all deployments
    }

    // Library files — search name and path
    let files: unknown[] = [];
    try {
      files = db.prepare(`
        SELECT id, name, path, category, createdAt
        FROM library_files
        WHERE name LIKE ? OR path LIKE ?
        ORDER BY createdAt DESC
        LIMIT 5
      `).all(like, like);
    } catch {
      // library_files table may not exist in all deployments
    }

    // Knowledge base articles — search title and content
    let knowledge: unknown[] = [];
    try {
      knowledge = db.prepare(`
        SELECT id, title, category, scope, updatedAt
        FROM knowledge_base
        WHERE title LIKE ? OR content LIKE ?
        ORDER BY updatedAt DESC
        LIMIT 5
      `).all(like, like);
    } catch {
      // knowledge_base table may not exist in all deployments
    }

    // Automations — search name and description
    let automations: unknown[] = [];
    try {
      automations = db.prepare(`
        SELECT id, name, description, status, trigger_type, updated_at
        FROM automations
        WHERE name LIKE ? OR description LIKE ?
        ORDER BY updated_at DESC
        LIMIT 5
      `).all(like, like);
    } catch {
      // automations table may not exist in all deployments
    }

    return NextResponse.json({ tasks, agents, files, knowledge, automations });
  } catch (err) {
    console.error('[/api/search] Error:', err);
    return NextResponse.json({ tasks: [], agents: [], files: [], knowledge: [] }, { status: 500 });
  }
}
