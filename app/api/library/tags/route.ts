// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

// GET /api/library/tags — return all unique tags across library items
// Supports ?category=X to filter tags by file category
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const db = getDb();

    const conditions: string[] = ["tags IS NOT NULL", "tags != '[]'", "tags != ''"];
    const bindings: unknown[] = [];
    if (category) {
      conditions.push('category = ?');
      bindings.push(category);
    }

    const rows = db.prepare(
      `SELECT tags FROM library_files WHERE ${conditions.join(' AND ')}`
    ).all(...bindings) as { tags: string }[];

    const tagSet = new Set<string>();
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.tags) as unknown;
        if (Array.isArray(parsed)) {
          for (const t of parsed) {
            if (typeof t === 'string' && t.trim()) tagSet.add(t.trim().toLowerCase());
          }
        }
      } catch {
        // Malformed tags JSON — skip
      }
    }

    const tags = [...tagSet].sort();
    return NextResponse.json({ success: true, tags });
  } catch (error) {
    console.error('GET /api/library/tags error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
