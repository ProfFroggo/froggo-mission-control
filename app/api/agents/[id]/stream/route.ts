import { NextRequest } from 'next/server';
import { getDb } from '@/lib/database';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { message, model, history } = await request.json();

  // Build system prompt — prefer SOUL.md from agent workspace, fall back to DB
  let systemPrompt: string | null = null;
  const workspaceDir = join(homedir(), 'mission-control', 'agents', id);
  const soulPath = join(workspaceDir, 'SOUL.md');

  if (existsSync(soulPath)) {
    systemPrompt = readFileSync(soulPath, 'utf-8').trim();
    // Append chat-mode instruction so agent doesn't try to run task workflows
    systemPrompt += '\n\n---\nYou are in chat mode. Respond conversationally and stay in character.\n\nTask management: Use the mission-control-db MCP tools to manage tasks on the Kanban board — NOT the built-in TaskCreate/TaskList/TaskUpdate tools.\n- task_create: create tasks (set assignedTo to give to another agent, parentTaskId to create subtasks)\n- task_update: update status/progress (in-progress, human-review, review, done)\n- task_add_activity: log what you did\nStatus guide: in-progress=working, human-review=need Kevin input, review=send to Clara, done=complete.\n\nArtifacts: When producing code, scripts, files, or structured data, always wrap them in fenced code blocks (```language ... ```). They are automatically extracted to the Artifact Canvas where the user can view, copy, and download them. Use ```mermaid for diagrams and ```json for data.';
    // Append MEMORY.md if it exists
    const memoryPath = join(workspaceDir, 'MEMORY.md');
    if (existsSync(memoryPath)) {
      const memory = readFileSync(memoryPath, 'utf-8').trim();
      if (memory) systemPrompt += `\n\n---\n## Your Memory\n${memory}`;
    }
  } else {
    // Fall back to DB persona
    try {
      const db = getDb();
      const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as {
        personality?: string;
        role?: string;
        name?: string;
      } | undefined;
      if (agent) {
        const parts: string[] = [];
        if (agent.role) parts.push(`You are ${agent.name || id}, a ${agent.role}.`);
        if (agent.personality) parts.push(agent.personality);
        parts.push('\nTask management: Use the mission-control-db MCP tools (task_create, task_list, task_update) to manage tasks on the Kanban board — NOT the built-in TaskCreate/TaskList/TaskUpdate tools.\n\nArtifacts: When producing code, scripts, files, or structured data, always wrap them in fenced code blocks (```language ... ```). They are automatically extracted to the Artifact Canvas where the user can view, copy, and download them.');
        systemPrompt = parts.join('\n');
      }
    } catch { /* DB not available — run without persona */ }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Verify stream is live before spawning
      controller.enqueue(encoder.encode(`data: {"type":"init"}\n\n`));

      try {
        const args = [
          '--print',
          '--verbose',
          '--output-format', 'stream-json',
          '--model', model || 'claude-sonnet-4-6',
          '--dangerously-skip-permissions',
        ];
        if (systemPrompt) {
          // Use --system-prompt to fully replace (not append) — gives agent their own identity
          args.push('--system-prompt', systemPrompt);
        }
        let fullMessage = message;
        if (history && history.length > 0) {
          const historyLines = history.map((m: { role: string; content: string }) =>
            `[${m.role === 'user' ? 'Kevin' : 'Assistant'}]: ${m.content}`
          ).join('\n');
          fullMessage = `## Conversation history\n${historyLines}\n\n## Current message\n${message}`;
        }
        args.push(fullMessage);

        // Unset CLAUDECODE env vars so nested Claude CLI sessions are allowed
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, ...cleanEnv } = process.env;

        // Use agent's workspace as cwd so they can access MEMORY.md, IDENTITY.md etc.
        const agentCwd = existsSync(workspaceDir) ? workspaceDir : (process.env.HOME || '/Users/kevin.macarthur');

        const proc = spawn('/Users/kevin.macarthur/.npm-global/bin/claude', args, {
          cwd: agentCwd,
          env: cleanEnv,
          stdio: 'pipe',
        });

        // Claude doesn't need stdin — close it immediately
        proc.stdin?.end();

        await new Promise<void>((resolve) => {
          proc.stdout.on('data', (data: Buffer) => {
            const lines = data.toString().split('\n').filter(Boolean);
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
              } catch {
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: 'text', text: line })}\n\n`
                ));
              }
            }
          });

          proc.stderr.on('data', (data: Buffer) => {
            const err = data.toString().trim();
            if (err) {
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'debug', text: err })}\n\n`
              ));
            }
          });

          proc.on('close', (code) => {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'done', code })}\n\n`
            ));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            resolve();
          });

          proc.on('error', (err) => {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'error', text: err.message })}\n\n`
            ));
            resolve();
          });

          // Timeout after 5 minutes
          setTimeout(() => {
            proc.kill();
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'timeout', text: 'Stream timeout' })}\n\n`
            ));
            resolve();
          }, 300000);
        });

        // Agent process finished — mark idle so the UI shows correct state
        try {
          getDb().prepare('UPDATE agents SET status = ?, lastActivity = ? WHERE id = ?')
            .run('idle', Date.now(), id);
        } catch { /* non-critical */ }

        controller.close();
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'error', text: msg })}\n\n`
        ));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
