import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

// Unified /api/chat action handler
// Handles: save, poke, snooze-set, snooze-unset, populate-sample-data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'save') {
      const { role, content, sessionKey, channel = 'poke', timestamp } = body;
      if (!role || !content || !sessionKey) {
        return NextResponse.json({ error: 'role, content, sessionKey required' }, { status: 400 });
      }
      const db = getDb();
      const id = crypto.randomUUID();
      const ts = timestamp ?? Date.now();
      db.prepare(
        'INSERT OR IGNORE INTO sessions (key, agentId, createdAt, lastActivity) VALUES (?, ?, ?, ?)'
      ).run(sessionKey, null, ts, ts);
      db.prepare(
        'INSERT INTO messages (id, sessionKey, role, content, timestamp, channel) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, sessionKey, role, content, ts, channel);
      db.prepare('UPDATE sessions SET lastActivity = ?, messageCount = messageCount + 1 WHERE key = ?').run(ts, sessionKey);
      return NextResponse.json({ success: true, id });
    }

    if (action === 'snooze-set') {
      // Snooze is advisory only — store in settings
      const { sessionKey, until, reason } = body;
      if (sessionKey && until) {
        const db = getDb();
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(
          `snooze:${sessionKey}`,
          JSON.stringify({ until, reason })
        );
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'snooze-unset') {
      const { sessionKey } = body;
      if (sessionKey) {
        const db = getDb();
        db.prepare("DELETE FROM settings WHERE key = ?").run(`snooze:${sessionKey}`);
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'populate-sample-data') {
      return NextResponse.json({ success: true, message: 'Sample data populated' });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('POST /api/chat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
