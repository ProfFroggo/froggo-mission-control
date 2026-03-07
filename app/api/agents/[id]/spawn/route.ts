import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { validateAgentId } from '@/lib/validateId';
import { spawn, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;
    const db = getDb();
    const body = await request.json().catch(() => ({}));

    // Check for existing active session
    const existing = db.prepare(
      'SELECT sessionId FROM agent_sessions WHERE agentId = ? AND status = ?'
    ).get(id, 'active') as { sessionId: string } | undefined;

    let command: string;
    let resumed = false;
    if (existing?.sessionId) {
      command = `claude --resume ${existing.sessionId} --agents ${id}`;
      resumed = true;
    } else {
      command = `claude --agents ${id}`;
    }

    const now = Date.now();

    if (!resumed) {
      const sessionId = crypto.randomUUID();
      const model = body.model ?? null;
      db.prepare(`
        INSERT INTO agent_sessions (agentId, sessionId, model, createdAt, lastActivity, status)
        VALUES (?, ?, ?, ?, ?, 'active')
        ON CONFLICT (agentId) DO UPDATE SET
          sessionId = excluded.sessionId,
          model = excluded.model,
          lastActivity = excluded.lastActivity,
          status = 'active'
      `).run(id, sessionId, model, now, now);
    } else {
      db.prepare('UPDATE agent_sessions SET lastActivity = ? WHERE agentId = ?')
        .run(now, id);
    }

    db.prepare('UPDATE agents SET status = ?, lastActivity = ? WHERE id = ?')
      .run('active', now, id);

    // Actually spawn the agent process (detached, non-blocking)
    try {
      const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, ...cleanEnv } = process.env;
      const agentCwd = join(homedir(), 'mission-control', 'agents', id);
      const spawnArgs = resumed
        ? ['--resume', existing!.sessionId, '--agents', id]
        : ['--agents', id];
      const proc = spawn('/Users/kevin.macarthur/.npm-global/bin/claude', spawnArgs, {
        cwd: existsSync(agentCwd) ? agentCwd : homedir(),
        env: { ...cleanEnv } as NodeJS.ProcessEnv,
        detached: true,
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      proc.unref();
    } catch { /* non-blocking — do not fail the request */ }

    // Attempt tmux spawn if tmux session is running
    try {
      const scriptPath = join(process.cwd(), 'tools', 'agent-start.sh');
      if (existsSync(scriptPath)) {
        spawnSync('bash', [scriptPath, id], { timeout: 5000 });
      }
    } catch {
      // tmux not available or agent already running — not fatal
    }

    return NextResponse.json({ success: true, command, resumed });
  } catch (error) {
    console.error('POST /api/agents/[id]/spawn error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
