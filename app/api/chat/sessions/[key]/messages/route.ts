// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const db = getDb();
    const messages = db.prepare(
      'SELECT * FROM messages WHERE sessionKey = ? ORDER BY timestamp ASC'
    ).all(key);

    return NextResponse.json({ success: true, messages });
  } catch (error) {
    console.error('GET /api/chat/sessions/[key]/messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key: sessionKey } = await params;
    const db = getDb();
    const body = await request.json();

    const { role, content, channel = 'dashboard', streaming = 0 } = body;

    if (!role || !content) {
      return NextResponse.json({ error: 'role and content are required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    // Auto-create session if it doesn't exist (sessionKey format: chat:{agentId})
    const agentId = sessionKey.startsWith('chat:') ? sessionKey.slice(5) : null;
    db.prepare(`
      INSERT OR IGNORE INTO sessions (key, agentId, createdAt, lastActivity, messageCount)
      VALUES (?, ?, ?, ?, 0)
    `).run(sessionKey, agentId, now, now);

    db.prepare(`
      INSERT INTO messages (id, sessionKey, role, content, timestamp, channel, streaming)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, sessionKey, role, content, now, channel, streaming ? 1 : 0);

    // Update session messageCount and lastActivity
    db.prepare(`
      UPDATE sessions SET messageCount = messageCount + 1, lastActivity = ? WHERE key = ?
    `).run(now, sessionKey);

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);

    // Library assistant stub — generate a contextual mock reply for the smart drive UI
    if (sessionKey === 'library-assistant') {
      const userContent = typeof content === 'string' ? content : '';
      const reply = generateLibraryAssistantReply(userContent);
      const replyId = crypto.randomUUID();
      const replyNow = Date.now();
      db.prepare(`
        INSERT INTO messages (id, sessionKey, role, content, timestamp, channel, streaming)
        VALUES (?, ?, 'assistant', ?, ?, ?, 0)
      `).run(replyId, sessionKey, reply, replyNow, channel);
      db.prepare(`
        UPDATE sessions SET messageCount = messageCount + 1, lastActivity = ? WHERE key = ?
      `).run(replyNow, sessionKey);

      return NextResponse.json({ ...message, reply, role: 'assistant', content: reply, id: replyId }, { status: 201 });
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('POST /api/chat/sessions/[key]/messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Library assistant: generates a contextual stub reply based on the user's message content.
// Replace this function body with a real LLM call when the library-assistant agent is deployed.
function generateLibraryAssistantReply(userContent: string): string {
  const lower = userContent.toLowerCase();

  // Detect file context (mini-chat in detail panel sends "File: <name> ...")
  const fileMatch = userContent.match(/^File:\s*([^\n(]+)/);
  const fileName = fileMatch ? fileMatch[1].trim() : null;

  // Detect query after "User question:" or "Query:"
  const questionMatch = userContent.match(/(?:User question|Query):\s*(.+)$/m);
  const question = questionMatch ? questionMatch[1].trim() : userContent.trim();

  if (fileName) {
    if (lower.includes('tag') || lower.includes('categor')) {
      return `For **${fileName}**, consider tags that reflect its content type, project, and intended audience. Tag consistency helps agents and team members locate related files quickly.`;
    }
    if (lower.includes('summar') || lower.includes('what is') || lower.includes('describe')) {
      return `**${fileName}** is stored in your library. To get a full summary, open the file viewer and review its content directly. I can help you tag it, link it to tasks, or find related files.`;
    }
    if (lower.includes('task') || lower.includes('link')) {
      return `To link **${fileName}** to tasks, use the "Linked Tasks" field in the file detail panel. This helps track which deliverables are associated with which work items.`;
    }
    return `I can see you're asking about **${fileName}**. I can help you manage its tags, link it to tasks, find similar files, or answer questions about how to organise it in the library. What would you like to do?`;
  }

  // Global ask-agent mode
  if (lower.includes('find') || lower.includes('search') || lower.includes('where')) {
    return `Use the search bar at the top of the library to search by name. You can also filter by category using the sidebar, or filter by tags using \`?tags=\` in the query parameters. If you tell me what you're looking for, I can give you a more targeted suggestion.`;
  }
  if (lower.includes('organis') || lower.includes('organize') || lower.includes('folder') || lower.includes('categor')) {
    return `Library files are organised by **category** (set on each file) and can also be grouped into **folders** from the Folders view. Tags provide an additional cross-cutting dimension for discovery. Consider aligning categories with your team's disciplines: design, code, data, docs, video, etc.`;
  }
  if (lower.includes('tag')) {
    return `Tags on library files let you filter and group files across categories. Use the PATCH /api/library endpoint or the tag editor in the file detail panel to add tags. Consistent tagging conventions (e.g., project names, status, platform) make the library much more useful.`;
  }
  if (question) {
    return `Your question: _"${question}"_\n\nI'm the Library Assistant. I can help you find, tag, categorise, and link library files to tasks. For complex queries, make sure the library-assistant agent is running and connected to this session.`;
  }

  return `Hello! I'm the Library Assistant. I can help you search, organise, tag, and link files in your library. Ask me anything about your files or how to manage them.`;
}
