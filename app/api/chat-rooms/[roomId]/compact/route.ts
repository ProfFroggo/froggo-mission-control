// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/chat-rooms/[roomId]/compact — Each agent in the room summarizes
// their own messages. Produces one summary message per agent, archives old
// messages, preserves artifact references. Uses Claude CLI — no API key needed.
import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/lib/env';
import { getDb } from '@/lib/database';
import { spawn } from 'child_process';
import { homedir } from 'os';
import { dirname } from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HOME = homedir();
const CLAUDE_SCRIPT = ENV.CLAUDE_SCRIPT;
const NODE_BIN = process.execPath;
const IS_NATIVE_BIN = !CLAUDE_SCRIPT.endsWith('.js');

function spawnClaude(args: string[], opts: Parameters<typeof spawn>[2]): ReturnType<typeof spawn> {
  return IS_NATIVE_BIN
    ? spawn(CLAUDE_SCRIPT, args, opts!)
    : spawn(NODE_BIN, [CLAUDE_SCRIPT, ...args], opts!);
}

function getCleanEnv() {
  const {
    CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID,
    ANTHROPIC_API_KEY,
    ...cleanEnv
  } = process.env as Record<string, string | undefined>;
  if (!cleanEnv.PATH || cleanEnv.PATH.length < 20) {
    cleanEnv.PATH = [
      '/opt/homebrew/bin', '/opt/homebrew/sbin',
      '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin',
    ].join(':');
  }
  const nodeBinDir = dirname(process.execPath);
  if (!cleanEnv.PATH!.includes(nodeBinDir)) cleanEnv.PATH = nodeBinDir + ':' + cleanEnv.PATH;
  return cleanEnv as NodeJS.ProcessEnv;
}

/** Run Claude CLI --print and collect full text output */
function runCompact(prompt: string, onDelta: (text: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--verbose',
      '--model', 'claude-sonnet-4-6',
      '--allowedTools', 'none',
    ];
    const proc = spawnClaude(args, { cwd: HOME, env: getCleanEnv(), stdio: 'pipe' });
    proc.stdin!.write(prompt);
    proc.stdin!.end();

    let buf = '';
    let fullText = '';
    let lastLen = 0;

    proc.stdout!.on('data', (data: Buffer) => {
      buf += data.toString();
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const p = JSON.parse(line) as {
            type?: string;
            message?: { content?: Array<{ type: string; text?: string }> };
            result?: string;
          };
          if (p.type === 'assistant' && p.message?.content) {
            const full = p.message.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('');
            if (full.length > lastLen) {
              const delta = full.slice(lastLen);
              lastLen = full.length;
              fullText += delta;
              onDelta(delta);
            }
          } else if (p.type === 'result' && p.result && lastLen === 0) {
            fullText = p.result;
            onDelta(p.result);
          }
        } catch { /* skip */ }
      }
    });

    proc.stderr!.on('data', (data: Buffer) => {
      console.warn('[room-compact] stderr:', data.toString().slice(0, 200));
    });

    const timeout = setTimeout(() => {
      try { proc.kill('SIGTERM'); } catch { /* dead */ }
      reject(new Error('Compact timed out'));
    }, 120_000);

    proc.on('close', () => { clearTimeout(timeout); resolve(fullText); });
    proc.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}

interface ArtifactRef {
  title: string;
  type: string;
  content: string;
  messageId: string;
  metadata?: { language?: string; filename?: string; filePath?: string; [k: string]: any };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const db = getDb();

  // Parse optional artifacts from request body
  let clientArtifacts: ArtifactRef[] = [];
  try {
    const body = await request.json();
    if (Array.isArray(body?.artifacts)) clientArtifacts = body.artifacts;
  } catch { /* no body or invalid JSON — fine */ }

  const room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(roomId) as
    | { id: string; name: string; agents: string } | undefined;
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  const allMessages = db.prepare(
    'SELECT * FROM chat_room_messages WHERE roomId = ? ORDER BY timestamp ASC'
  ).all(roomId) as Array<{
    id: number; roomId: string; agentId: string; content: string;
    role: string; timestamp: number; messageId: string | null;
  }>;

  if (allMessages.length < 5) {
    return NextResponse.json({ error: 'Not enough messages to compact' }, { status: 400 });
  }

  // Group messages by agent
  const agentMessages = new Map<string, typeof allMessages>();
  for (const m of allMessages) {
    const agent = m.agentId || 'user';
    if (!agentMessages.has(agent)) agentMessages.set(agent, []);
    agentMessages.get(agent)!.push(m);
  }

  // Skip 'user' (human messages are context, not a separate summary) and agents with < 2 messages
  const agentsToCompact = Array.from(agentMessages.entries())
    .filter(([agentId, msgs]) => agentId !== 'user' && msgs.length >= 2)
    .map(([agentId]) => agentId);

  if (agentsToCompact.length === 0) {
    return NextResponse.json({ error: 'Not enough agent messages to compact' }, { status: 400 });
  }

  // Build a map of messageId -> agentId for linking client artifacts to agents
  const messageToAgent = new Map<string, string>();
  for (const m of allMessages) {
    if (m.messageId) messageToAgent.set(m.messageId, m.agentId);
    messageToAgent.set(String(m.id), m.agentId);
  }

  // Group client artifacts by agent
  const agentArtifactMap = new Map<string, ArtifactRef[]>();
  for (const a of clientArtifacts) {
    const ownerAgent = messageToAgent.get(a.messageId) || 'unknown';
    if (!agentArtifactMap.has(ownerAgent)) agentArtifactMap.set(ownerAgent, []);
    agentArtifactMap.get(ownerAgent)!.push(a);
  }

  // Stream per-agent summaries sequentially
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const enc = (obj: unknown) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)); }
        catch { /* closed */ }
      };

      const summaries: Array<{ agentId: string; text: string; artifacts: ArtifactRef[] }> = [];

      for (const agentId of agentsToCompact) {
        const msgs = agentMessages.get(agentId)!;

        // Build this agent's transcript interleaved with user messages for context
        const userMsgs = agentMessages.get('user') || [];
        const interleaved = [...msgs, ...userMsgs]
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-50);
        const agentTranscript = interleaved
          .map(m => `[${m.agentId === 'user' ? 'Kevin' : m.agentId}] ${m.content.slice(0, 800)}`)
          .join('\n');

        // Collect this agent's artifacts from client + text detection
        const thisAgentArtifacts = agentArtifactMap.get(agentId) || [];
        const artifactLines: string[] = [];
        for (const a of thisAgentArtifacts) {
          const path = a.metadata?.filePath || a.content;
          const lang = a.metadata?.language ? ` (${a.metadata.language})` : '';
          artifactLines.push(`- **${a.title}** — \`${path}\`${lang} [${a.type}]`);
        }

        // Also detect file references from message text
        const filePattern = /(?:wrote|created|saved|generated|updated)\s+(?:to\s+)?[`"]?([^\s`"]+\.\w{2,5})[`"]?/gi;
        for (const m of msgs) {
          let match;
          while ((match = filePattern.exec(m.content)) !== null) {
            const path = match[1];
            if (!artifactLines.some(l => l.includes(path))) {
              artifactLines.push(`- \`${path}\``);
            }
          }
        }

        const artifactSection = artifactLines.length > 0
          ? `\n\n**Artifacts/files created by this agent (MUST include in summary with exact paths):**\n${artifactLines.join('\n')}`
          : '';

        const prompt = `You are summarizing the contributions of agent "${agentId}" in a multi-agent chat room called "${room.name}".
This agent sent ${msgs.length} messages. Summarize:
1. What they worked on / discussed
2. Key decisions made or conclusions reached
3. Artifacts created — list every file with its EXACT path so they remain accessible
4. Current status and any open/pending items

Be concise but complete enough to resume work. Use bullet points and markdown.
IMPORTANT: For every artifact/file, include the exact file path in backticks so it can be re-detected.
${artifactSection}

## ${agentId}'s messages (most recent):

${agentTranscript}`;

        // Signal which agent is being summarized
        enc({ type: 'agent_start', agentId, messageCount: msgs.length });

        try {
          const text = await runCompact(prompt, (delta) => {
            enc({ type: 'text_delta', text: delta, agentId });
          });
          summaries.push({ agentId, text, artifacts: thisAgentArtifacts });
          enc({ type: 'agent_done', agentId });
        } catch (err) {
          enc({ type: 'agent_error', agentId, error: err instanceof Error ? err.message : String(err) });
        }
      }

      // Persist: delete old messages, insert one summary per agent
      if (summaries.length > 0) {
        const now = Date.now();
        db.prepare('DELETE FROM chat_room_messages WHERE roomId = ?').run(roomId);

        const combinedSummary: string[] = [];
        for (let i = 0; i < summaries.length; i++) {
          const { agentId, text } = summaries[i];
          const msgId = `compact-${now}-${agentId}`;
          db.prepare(`
            INSERT INTO chat_room_messages (roomId, agentId, content, timestamp, role, messageId)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(roomId, agentId, text, now + i, 'agent', msgId);

          combinedSummary.push(`## ${agentId}\n${text}`);
        }

        // Store combined summary on room row for context restoration
        const fullSummary = combinedSummary.join('\n\n---\n\n');
        db.prepare(
          'UPDATE chat_rooms SET compact_summary = ?, last_compact_at = ?, updatedAt = ? WHERE id = ?'
        ).run(fullSummary, now, now, roomId);

        enc({ type: 'compact_done', archivedCount: allMessages.length, summaryCount: summaries.length });
      }

      enc({ type: 'done' });
      try {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch { /* closed */ }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
