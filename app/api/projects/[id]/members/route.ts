import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/:id/members
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const members = db.prepare(`
      SELECT pm.*, a.name AS agentName, a.avatar AS agentEmoji, a.status AS agentStatus
      FROM project_members pm
      LEFT JOIN agents a ON a.id = pm.agentId
      WHERE pm.projectId = ?
      ORDER BY pm.role DESC, pm.addedAt ASC
    `).all(id);
    return NextResponse.json(members);
  } catch (error) {
    console.error('GET /api/projects/:id/members error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/:id/members — add or remove agents
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const { agentId, role = 'member', action = 'add' } = await request.json();

    if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 });

    if (action === 'remove') {
      db.prepare('DELETE FROM project_members WHERE projectId = ? AND agentId = ?').run(id, agentId);
    } else {
      db.prepare(`
        INSERT OR REPLACE INTO project_members (projectId, agentId, role, addedAt)
        VALUES (?, ?, ?, ?)
      `).run(id, agentId, role, Date.now());
    }

    db.prepare('UPDATE projects SET updatedAt = ? WHERE id = ?').run(Date.now(), id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/projects/:id/members error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
