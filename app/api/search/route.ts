// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/search?q=query&types=tasks,agents&limit=5&offset=0
// Returns grouped results: { tasks, agents, knowledge, library, campaigns, automations }
// Each group: { items: [...], total: number }
// Rank tasks: incomplete first, then by updated_at desc
// Rank knowledge: title match first, then content match
// Support ?types=tasks,agents to filter result groups
// Support ?limit=5&offset=0 per group

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

interface GroupedResult {
  items: unknown[];
  total: number;
}

interface SearchResponse {
  tasks: GroupedResult;
  agents: GroupedResult;
  knowledge: GroupedResult;
  library: GroupedResult;
  campaigns: GroupedResult;
  automations: GroupedResult;
}

const INCOMPLETE_STATUSES = ['todo', 'internal-review', 'in-progress', 'review', 'human-review'];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q')?.trim();

  const empty: GroupedResult = { items: [], total: 0 };
  const emptyResponse: SearchResponse = {
    tasks: empty, agents: empty, knowledge: empty,
    library: empty, campaigns: empty, automations: empty,
  };

  if (!q || q.length < 2) {
    return NextResponse.json(emptyResponse);
  }

  const db = getDb();
  const like = `%${q}%`;

  // Parse requested types (default: all)
  const typesParam = searchParams.get('types');
  const requestedTypes = typesParam
    ? new Set(typesParam.split(',').map(t => t.trim().toLowerCase()))
    : null; // null = all types

  const wantType = (type: string) => !requestedTypes || requestedTypes.has(type);

  // Pagination per group
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '5', 10), 1), 50);
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10), 0);

  const result: SearchResponse = { ...emptyResponse };

  try {
    // ── Tasks ────────────────────────────────────────────────────────────────
    // Rank: incomplete first, then by updatedAt desc
    if (wantType('tasks')) {
      try {
        const inPlaceholders = INCOMPLETE_STATUSES.map(() => '?').join(', ');
        const allTasks = db.prepare(`
          SELECT id, title, description, status, assignedTo, updatedAt,
            CASE WHEN status IN (${inPlaceholders}) THEN 0 ELSE 1 END AS rank_group
          FROM tasks
          WHERE title LIKE ? OR description LIKE ?
          ORDER BY rank_group ASC, updatedAt DESC
        `).all(...INCOMPLETE_STATUSES, like, like) as Array<Record<string, unknown>>;
        result.tasks = {
          items: allTasks.slice(offset, offset + limit).map(({ rank_group: _r, ...rest }) => rest),
          total: allTasks.length,
        };
      } catch {
        // tasks table may vary
      }
    }

    // ── Agents ───────────────────────────────────────────────────────────────
    if (wantType('agents')) {
      try {
        const allAgents = db.prepare(`
          SELECT id, name, role, status, description
          FROM agents
          WHERE name LIKE ? OR role LIKE ? OR id LIKE ?
          ORDER BY name ASC
        `).all(like, like, like) as Array<Record<string, unknown>>;
        result.agents = {
          items: allAgents.slice(offset, offset + limit),
          total: allAgents.length,
        };
      } catch {
        // agents table may not exist
      }
    }

    // ── Knowledge base ───────────────────────────────────────────────────────
    // Rank: title match first, then content-only match
    if (wantType('knowledge')) {
      try {
        const allKnowledge = db.prepare(`
          SELECT id, title, category, scope, updatedAt,
            CASE WHEN title LIKE ? THEN 0 ELSE 1 END AS rank_group
          FROM knowledge_base
          WHERE title LIKE ? OR content LIKE ?
          ORDER BY rank_group ASC, updatedAt DESC
        `).all(like, like, like) as Array<Record<string, unknown>>;
        result.knowledge = {
          items: allKnowledge.slice(offset, offset + limit).map(({ rank_group: _r, ...rest }) => rest),
          total: allKnowledge.length,
        };
      } catch {
        // knowledge_base table may not exist
      }
    }

    // ── Library files ────────────────────────────────────────────────────────
    if (wantType('library')) {
      try {
        const allFiles = db.prepare(`
          SELECT id, name, path, category, createdAt
          FROM library_files
          WHERE name LIKE ? OR path LIKE ?
          ORDER BY createdAt DESC
        `).all(like, like) as Array<Record<string, unknown>>;
        result.library = {
          items: allFiles.slice(offset, offset + limit),
          total: allFiles.length,
        };
      } catch {
        // library_files table may not exist
      }
    }

    // ── Campaigns ────────────────────────────────────────────────────────────
    if (wantType('campaigns')) {
      try {
        const allCampaigns = db.prepare(`
          SELECT id, name, description, status, updatedAt
          FROM campaigns
          WHERE name LIKE ? OR description LIKE ?
          ORDER BY updatedAt DESC
        `).all(like, like) as Array<Record<string, unknown>>;
        result.campaigns = {
          items: allCampaigns.slice(offset, offset + limit),
          total: allCampaigns.length,
        };
      } catch {
        // campaigns table may not exist
      }
    }

    // ── Automations ──────────────────────────────────────────────────────────
    if (wantType('automations')) {
      try {
        const allAutomations = db.prepare(`
          SELECT id, name, description, status, trigger_type, updated_at
          FROM automations
          WHERE name LIKE ? OR description LIKE ?
          ORDER BY updated_at DESC
        `).all(like, like) as Array<Record<string, unknown>>;
        result.automations = {
          items: allAutomations.slice(offset, offset + limit),
          total: allAutomations.length,
        };
      } catch {
        // automations table may not exist
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[/api/search] Error:', err);
    return NextResponse.json(emptyResponse, { status: 500 });
  }
}
