// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import http from 'http';

// ── DB singleton ──────────────────────────────────────────────────────────────
// One connection for the lifetime of the MCP process. WAL mode set once.

const DB_PATH = process.env.DB_PATH ||
  path.join(process.env.HOME || '/tmp', 'mission-control', 'data', 'mission-control.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  return _db;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

/** Build auth headers for requests to the Next.js app. */
function authHeaders(): Record<string, string> {
  const token = process.env.INTERNAL_API_TOKEN;
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/** Fire-and-forget POST to the Next.js app (port 3000). */
function firePost(urlPath: string, body: object): void {
  const encoded = JSON.stringify(body);
  const req = http.request({
    hostname: '127.0.0.1', port: 3000,
    path: urlPath, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(encoded), ...authHeaders() },
  }, (res) => { res.resume(); });
  req.on('error', () => { /* app may not be running */ });
  req.setTimeout(3000, () => req.destroy());
  req.write(encoded);
  req.end();
}

/** Fire-and-forget PATCH to a task (triggers dispatch/review-gate side-effects). */
function firePatch(taskId: string, body: object): void {
  const encoded = JSON.stringify(body);
  const req = http.request({
    hostname: '127.0.0.1', port: 3000,
    path: `/api/tasks/${encodeURIComponent(taskId)}`, method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(encoded), ...authHeaders() },
  }, (res) => { res.resume(); });
  req.on('error', () => {});
  req.setTimeout(5000, () => req.destroy());
  req.write(encoded);
  req.end();
}

/** Awaitable PATCH — returns parsed response body. Used by agent_status_set. */
function awaitPatch(urlPath: string, body: object): Promise<any> {
  const encoded = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1', port: 3000,
      path: urlPath, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(encoded), ...authHeaders() },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.write(encoded);
    req.end();
  });
}

// ── Server ────────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'mission-control-db', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'project_context',
      description: 'Get full context for a project — name, goal, status, milestones, assigned agents, and open task count. Call this at the start of any work session to understand what project you are working in. If no projectId is given, lists all active projects with key metrics.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID (optional — omit to list all active projects)' },
        },
      },
    },
    {
      name: 'agent_status_set',
      description: 'Update your own status and current focus area. Call this when you start a task (status=busy, currentTask="what you are doing") and when you finish (status=idle). Keeps the team dashboard accurate so others know what each agent is working on.',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'Your agent ID' },
          status: { type: 'string', description: 'New status: active | idle | busy' },
          currentTask: { type: 'string', description: 'Brief description of what you are currently working on (optional)' },
        },
        required: ['agentId', 'status'],
      },
    },
    {
      name: 'task_list',
      description: 'List tasks with flexible filtering. Tips: use assignedToMe=true + status="in-progress" to find your active work; use status="todo" to see unstarted tasks; use project filter to scope to one project. Always call task_get(id) for full planningNotes and subtasks before starting work.',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by status: todo | internal-review | in-progress | review | human-review | done' },
          assignedTo: { type: 'string', description: 'Filter by agent ID' },
          assignedToMe: { type: 'boolean', description: 'If true, only return tasks assigned to the agentId specified in the agentId param (shortcut for assignedTo)' },
          agentId: { type: 'string', description: 'Your agent ID — used when assignedToMe=true' },
          project: { type: 'string', description: 'Filter by project name' },
          limit: { type: 'number', description: 'Max tasks to return (default 20, max 50)' },
        },
      },
    },
    {
      name: 'task_get',
      description: 'Get a task by ID with full context. Always call this before starting work — returns planningNotes, acceptanceCriteria, and incompleteSubtasks at the top. Also returns all subtasks with completion status, last 5 activity entries, assigned agent name, and a workContext summary of what has already been done.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Task ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'task_create',
      description: 'Create a new task. MANDATORY RULES — task will be REJECTED if violated: (1) planningNotes is REQUIRED — must contain the full plan, approach, steps, and context (min 20 chars); (2) reviewer is always Clara — do not override; (3) after creating, immediately add at least 2 subtasks via subtask_create before starting work. description must be 1-2 sentences max. Put all detail in planningNotes. Structure planningNotes like this: "## Approach\n{how you will do it}\n\n## Acceptance Criteria\n- {specific checkable criterion 1}\n- {criterion 2}"',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title — clear and actionable' },
          description: { type: 'string', description: '1-2 sentence summary of what this task is. DO NOT put plans, steps, or details here.' },
          assignedTo: { type: 'string', description: 'Agent ID to assign to — task will be auto-dispatched when set' },
          priority: { type: 'string', description: 'Priority: p0, p1, p2, p3, p4 (default p2)' },
          project: { type: 'string', description: 'Project name' },
          parentTaskId: { type: 'string', description: 'Parent task ID (for sub-tasks)' },
          planningNotes: { type: 'string', description: 'Full plan, approach, steps, context, and any relevant file paths or instructions. Structure as: "## Approach\n{steps}\n\n## Acceptance Criteria\n- {criterion 1}\n- {criterion 2}". This is where all detailed planning goes.' },
          reviewerId: { type: 'string', description: 'Agent ID to review this task (default: clara)' },
          status: { type: 'string', description: 'Initial status (default: todo)' },
        },
        required: ['title'],
      },
    },
    {
      name: 'task_update',
      description: 'Update a task status or fields',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Task ID' },
          status: { type: 'string', description: 'New status: todo | in-progress | review | human-review | done. Do NOT set internal-review — the system manages Pre-review automatically.' },
          progress: { type: 'number', description: 'Progress 0-100' },
          lastAgentUpdate: { type: 'string', description: 'One-line update message visible to the team' },
          planningNotes: { type: 'string', description: 'Full plan details (replaces existing planningNotes)' },
          assignedTo: { type: 'string', description: 'Reassign to agent ID' },
          reviewerId: { type: 'string', description: 'Reviewer agent ID' },
          reviewStatus: { type: 'string', description: 'Review decision: pending | approved | rejected | needs-changes' },
          reviewNotes: { type: 'string', description: 'Review feedback for the assignee' },
        },
        required: ['id'],
      },
    },
    {
      name: 'task_add_activity',
      description: 'Log a meaningful activity on a task. Call this at: task start, key decisions, tool usage results, blockers encountered, and completion. This is your audit trail — be specific. Minimum: one entry per subtask completed.',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID' },
          agentId: { type: 'string', description: 'Agent performing the action' },
          action: { type: 'string', description: 'Action type (e.g. update, comment, complete, file_created, started, completed)' },
          message: { type: 'string', description: 'Activity message' },
        },
        required: ['taskId', 'message'],
      },
    },
    {
      name: 'task_add_attachment',
      description: 'Attach a file to a task. Call this every time you create or save a file. ALWAYS save files to the correct library path: research/analysis→docs/research/, strategy→docs/strategies/, presentations→docs/presentations/, platform docs→docs/platform/, code→code/, UI→design/ui/, images→design/images/, media→design/media/. All paths under ~/mission-control/library/. Name files: YYYY-MM-DD_description.ext',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID' },
          filePath: { type: 'string', description: 'Absolute path — must be under ~/mission-control/library/ in the correct subfolder' },
          fileName: { type: 'string', description: 'Display name for the file' },
          category: { type: 'string', description: 'output | report | code | design | research | strategy | presentation' },
          uploadedBy: { type: 'string', description: 'Agent ID that created the file' },
        },
        required: ['taskId', 'filePath'],
      },
    },
    {
      name: 'approval_create',
      description: 'Create an approval request for human review. Use type: "task" for task decisions, "tweet" for X/Twitter posts, "action" for agent actions, "email" for emails.',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Approval type: task | tweet | reply | email | message | action' },
          title: { type: 'string', description: 'Short title describing what needs approval' },
          content: { type: 'string', description: 'The content or action to approve' },
          context: { type: 'string', description: 'Additional context for the reviewer' },
          requester: { type: 'string', description: 'Agent ID requesting approval' },
          tier: { type: 'number', description: 'Trust tier 1-4 (default 3 = human review)' },
          metadata: { type: 'object', description: 'Type-specific data (e.g. { taskId } for tasks, { postId } for tweets)' },
        },
        required: ['type', 'title', 'content'],
      },
    },
    {
      name: 'approval_check',
      description: 'Check status of pending approvals',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Approval ID (optional, omit for all pending)' },
        },
      },
    },
    {
      name: 'inbox_list',
      description: 'List inbox items',
      inputSchema: {
        type: 'object',
        properties: {
          unreadOnly: { type: 'boolean', description: 'Only return unread items' },
          limit: { type: 'number', description: 'Max items (default 20)' },
        },
      },
    },
    {
      name: 'agent_status',
      description: 'Get or update agent status',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'Agent ID' },
          status: { type: 'string', description: 'New status (set to update, omit to read)' },
        },
        required: ['agentId'],
      },
    },
    {
      name: 'chat_post',
      description: 'Post a message to a chat room. Always include your agentId. Tailor your message based on roomId: roomId="mission-control" → messaging the human operator — be clear, concise, and human-friendly; include relevant context. roomId="{agentId}" (e.g. "designer", "coder") → 1-1 with that agent — be precise and technical; include task IDs and file paths. roomId="general" → team room — be collaborative. For images, include the markdown field verbatim from image_generate so the image renders inline.',
      inputSchema: {
        type: 'object',
        properties: {
          roomId: { type: 'string', description: 'Chat room ID. Use "mission-control" to reach the human. Use an agent ID (e.g. "designer") for a 1-1 with that agent. Use "general", "code-review", "planning", or "incidents" for team rooms.' },
          agentId: { type: 'string', description: 'Posting agent ID' },
          content: { type: 'string', description: 'Message content (max 20,000 characters). Split longer content into multiple chat_post calls.' },
        },
        required: ['roomId', 'agentId', 'content'],
      },
    },
    {
      name: 'chat_read',
      description: 'Read recent messages from a chat room',
      inputSchema: {
        type: 'object',
        properties: {
          roomId: { type: 'string', description: 'Chat room ID' },
          limit: { type: 'number', description: 'Max messages (default 20)' },
          since: { type: 'number', description: 'Unix timestamp ms, only messages after this' },
        },
        required: ['roomId'],
      },
    },
    {
      name: 'chat_rooms_list',
      description: 'List all available chat rooms',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'subtask_create',
      description: 'Create a subtask (checklist item) on a parent task. Returns the new subtask ID — save it to mark complete later.',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Parent task ID' },
          title: { type: 'string', description: 'Subtask title' },
          description: { type: 'string', description: 'Optional description' },
          assignedTo: { type: 'string', description: 'Agent ID to assign this subtask to' },
        },
        required: ['taskId', 'title'],
      },
    },
    {
      name: 'subtask_update',
      description: 'Mark a subtask complete or update it',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Subtask ID' },
          completed: { type: 'boolean', description: 'Mark as complete (true) or incomplete (false)' },
          title: { type: 'string', description: 'Update title' },
        },
        required: ['id'],
      },
    },
    {
      name: 'schedule_create',
      description: 'Schedule a future job for an agent. Use kind=once for one-shot tasks, kind=interval for repeating, kind=cron for time-based.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Job name' },
          description: { type: 'string', description: 'What this job does' },
          kind: { type: 'string', description: 'Schedule kind: once | interval | cron' },
          atMs: { type: 'number', description: 'Unix ms timestamp to run (kind=once)' },
          everyMs: { type: 'number', description: 'Repeat every N milliseconds (kind=interval)' },
          expr: { type: 'string', description: '5-field cron expression (kind=cron), e.g. "0 9 * * 1-5"' },
          sessionTarget: { type: 'string', description: 'Agent ID, or "isolated" for anonymous run' },
          message: { type: 'string', description: 'Message/prompt to send to the agent' },
          model: { type: 'string', description: 'Claude model to use (default: claude-haiku-4-5-20251001)' },
        },
        required: ['name', 'kind', 'message'],
      },
    },
    {
      name: 'schedule_list',
      description: 'List scheduled jobs',
      inputSchema: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', description: 'Filter by enabled status (default: all)' },
        },
      },
    },
    {
      name: 'image_generate',
      description: 'Generate an image using Gemini AI and save it to the library. Returns markdown you can embed in chat, plus a removeBackgroundPath field ready for immediate use with image_remove_background. To remove the background after generating: image_remove_background({ inputPath: result.removeBackgroundPath, agentId: yourId })',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Detailed description of the image to generate' },
          agentId: { type: 'string', description: 'Your agent ID' },
          filename: { type: 'string', description: 'Optional short filename (letters/numbers/hyphens, no extension)' },
        },
        required: ['prompt', 'agentId'],
      },
    },
    {
      name: 'image_remove_background',
      description: 'Remove the background from an image and save an optimised transparent PNG back to the library. Uses rembg birefnet-hd with alpha matting for maximum edge quality — handles hair, fur, and complex edges. To remove background from an image you just generated, use the removeBackgroundPath field from the image_generate response directly as inputPath. Returns markdown you can embed in chat.',
      inputSchema: {
        type: 'object',
        properties: {
          inputPath: { type: 'string', description: 'Path to the source image. Use removeBackgroundPath from image_generate response for seamless chaining. Also accepts absolute path or path relative to ~/mission-control/library/.' },
          agentId:   { type: 'string', description: 'Your agent ID' },
          model:     { type: 'string', description: 'rembg model to use. Default: birefnet-hd (best quality). Options: birefnet-hd, birefnet-general (faster), u2net.' },
        },
        required: ['inputPath', 'agentId'],
      },
    },
    {
      name: 'campaign_context',
      description: 'Get active campaigns with their channels, goals, status, and assigned agents. Call this when working on marketing, growth, or campaign-related tasks to understand what campaigns are running. Returns "No campaigns found" if no campaigns table or data exists yet.',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by status (optional, e.g. "active")' },
        },
      },
    },
    {
      name: 'knowledge_search',
      description: 'Search the knowledge base for brand guidelines, company context, writing style, design standards, and other workspace knowledge the human has curated. Call this at the start of any task involving brand, content, design, or company context. Returns matching articles with full content.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query — keywords, topic, or question' },
          category: { type: 'string', description: 'Optional filter: brand, guidelines, reference, onboarding, assets, tone, technical' },
        },
        required: ['query'],
      },
    },
    {
      name: 'knowledge_read',
      description: 'Read a specific knowledge base article by ID. Use after knowledge_search to get the full article content.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Knowledge base article ID from knowledge_search results' },
        },
        required: ['id'],
      },
    },
    {
      name: 'knowledge_write',
      description: 'Save a new insight, learning, or piece of knowledge to the shared knowledge base so all agents and future sessions can benefit from it. Use when you discover something important about the brand, a solved problem, a key decision, or operational context worth preserving.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Clear, descriptive title' },
          content: { type: 'string', description: 'Full markdown content' },
          category: { type: 'string', description: 'brand | guidelines | reference | onboarding | technical | tone' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Keywords for discovery' },
        },
        required: ['title', 'content', 'category'],
      },
    },
  ],
}));

// ── Tool handlers ─────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const db = getDb(); // singleton — never closed here
  const { name, arguments: args } = request.params;

  try {
    switch (name) {

      // ── task_get ────────────────────────────────────────────────────────────
      case 'task_get': {
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(args?.id) as Record<string, any> | undefined;
        if (!task) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found', recovery: 'Use task_list to see your assigned tasks. Verify you have the correct task ID.' }) }] };
        const subtasks = db.prepare('SELECT * FROM subtasks WHERE taskId = ? ORDER BY position ASC').all(args?.id) as any[];
        const attachments = db.prepare('SELECT id, fileName, filePath, category, uploadedBy, createdAt FROM task_attachments WHERE taskId = ? ORDER BY createdAt DESC').all(args?.id);
        const activity = db.prepare('SELECT agentId, action, message, timestamp FROM task_activity WHERE taskId = ? ORDER BY timestamp DESC LIMIT 5').all(args?.id) as any[];

        // Resolve assigned agent name
        let assignedAgentName: string | null = null;
        if (task.assignedTo) {
          const agent = db.prepare('SELECT name FROM agents WHERE id = ?').get(task.assignedTo) as { name?: string } | undefined;
          assignedAgentName = agent?.name ?? null;
        }

        // Extract acceptance criteria from planningNotes if structured
        let acceptanceCriteria: string[] = [];
        const planNotes: string = task.planningNotes || '';
        const acMatch = planNotes.match(/##\s*Acceptance Criteria\s*\n([\s\S]*?)(?:\n##|$)/i);
        if (acMatch) {
          acceptanceCriteria = acMatch[1]
            .split('\n')
            .map((l: string) => l.replace(/^[-*]\s*/, '').trim())
            .filter((l: string) => l.length > 0);
        }

        // Build workContext summary from activity log — gives agent a quick sense of what's been done
        const workContext = activity.length > 0
          ? activity
              .slice()
              .reverse()
              .map((a: any) => `[${new Date(a.timestamp).toISOString()}] ${a.agentId ?? 'system'}: ${a.message}`)
              .join('\n')
          : 'No activity logged yet — this task has not been started.';

        // Surface critical info first so Claude reads it before anything else
        const summary = {
          hint: 'Read planningNotes and incompleteSubtasks carefully before starting. These define what done looks like.',
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          assignedTo: task.assignedTo,
          assignedAgentName,
          // CRITICAL — at top level so Claude sees them immediately
          planningNotes: task.planningNotes,
          acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : (task.acceptanceCriteria || 'See planningNotes'),
          incompleteSubtasks: subtasks.filter((s: any) => !s.completed),
          completedSubtasks: subtasks.filter((s: any) => s.completed).map((s: any) => ({ id: s.id, title: s.title, completedAt: s.completedAt })),
          // Work context — what's already been done
          workContext,
          // Supporting context below
          description: task.description,
          project: task.project,
          progress: task.progress,
          lastAgentUpdate: task.lastAgentUpdate,
          reviewStatus: task.reviewStatus,
          reviewNotes: task.reviewNotes,
          recentActivity: activity,
          attachments,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
        };
        return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
      }

      // ── task_list ───────────────────────────────────────────────────────────
      case 'task_list': {
        const limit = (args?.limit as number) || 50;
        let query = `SELECT id, title, description, status, reviewStatus, priority, assignedTo,
          project, progress, lastAgentUpdate, createdAt, updatedAt
          FROM tasks WHERE 1=1`;
        const params: any[] = [];
        if (args?.status)     { query += ' AND status = ?';     params.push(args.status); }
        if (args?.assignedTo) { query += ' AND assignedTo = ?'; params.push(args.assignedTo); }
        if (args?.project)    { query += ' AND project = ?';    params.push(args.project); }
        query += ' ORDER BY createdAt DESC LIMIT ?';
        params.push(limit);
        const tasks = db.prepare(query).all(...params);
        return { content: [{ type: 'text', text: JSON.stringify({
          tasks,
          hint: 'Use task_get(id) for full details including planningNotes and subtasks before starting work on any task.'
        }, null, 2) }] };
      }

      // ── task_create ─────────────────────────────────────────────────────────
      case 'task_create': {
        // HARD RULES — enforced at creation:
        // 1. planningNotes is REQUIRED — must contain the full plan/approach
        // 2. reviewer defaults to clara and must not be removed
        if (!args?.planningNotes || (args.planningNotes as string).trim().length < 20) {
          return { content: [{ type: 'text', text: JSON.stringify({
            error: 'TASK_CREATION_BLOCKED: planningNotes is required and must contain a meaningful plan (min 20 chars). Describe the approach, steps, and any relevant context before creating the task.'
          }) }] };
        }

        const now = Date.now();
        const id = `task-${now}-${Math.random().toString(36).slice(2, 8)}`;
        // Tasks ALWAYS start in todo — no exceptions. Agents cannot create tasks in any other status.
        const initialStatus = 'todo';
        db.prepare(`
          INSERT INTO tasks (id, title, description, status, priority, project, assignedTo,
            reviewerId, planningNotes, parentTaskId, tags, labels, blockedBy, blocks,
            progress, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', '[]', '[]', 0, ?, ?)
        `).run(
          id,
          args?.title,
          args?.description || null,
          initialStatus,
          args?.priority || 'p2',
          args?.project || null,
          args?.assignedTo || null,
          'clara',
          args?.planningNotes,
          args?.parentTaskId || null,
          now, now
        );

        // Auto-dispatch: PATCH the task so the Next.js dispatch logic fires
        if (args?.assignedTo && initialStatus === 'todo') {
          firePatch(id, { assignedTo: args.assignedTo });
        }

        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, id, task }) }] };
      }

      // ── task_update ─────────────────────────────────────────────────────────
      case 'task_update': {
        const now = Date.now();
        const taskId = args?.id as string;

        // Fetch current state in one query (includes reviewerId to avoid second query)
        const current = db.prepare('SELECT status, reviewStatus, reviewerId FROM tasks WHERE id = ?').get(taskId) as
          { status: string; reviewStatus: string | null; reviewerId: string | null } | undefined;

        if (!current) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found', recovery: 'Use task_list to see your assigned tasks. Verify you have the correct task ID.' }) }] };

        // Agents cannot set internal-review — the system manages Pre-review automatically
        if (args?.status === 'internal-review') {
          return { content: [{ type: 'text', text: JSON.stringify({
            error: 'WORKFLOW_VIOLATION: agents cannot set status to internal-review. The Pre-review column is managed by the system — it is set automatically when a task is assigned to an agent. Clara then reviews and dispatches.',
            hint: 'If you finished work, set status="review". If blocked, set status="human-review".',
            recovery: 'Set status="review" with a summary of completed work in lastAgentUpdate. Clara will verify and approve.',
          })}]};
        }

        // HARD RULE: todo → in-progress is blocked — tasks must pass Clara's Pre-review gate first
        if (args?.status === 'in-progress' && current.status === 'todo') {
          return { content: [{ type: 'text', text: JSON.stringify({
            error: 'WORKFLOW_VIOLATION: cannot move directly from todo to in-progress. Tasks must pass Clara\'s Pre-review gate first. The system sets internal-review automatically when an agent is assigned — Clara will approve and dispatch the agent.',
            recovery: 'Check task status with task_get first. Ensure planningNotes and subtasks are set, then wait for Clara\'s pre-review approval before proceeding.',
          }) }] };
        }

        // HARD RULE: only Clara can mark a task done — agents must move to review first
        if (args?.status === 'done' && !['review'].includes(current.status)) {
          // Allow system/clara to advance (reviewStatus=approved auto-advance is handled below)
          const callerIsClara = args?.reviewStatus === 'approved'; // Clara sets both together
          if (!callerIsClara) {
            return { content: [{ type: 'text', text: JSON.stringify({
              error: 'WORKFLOW_VIOLATION: agents cannot mark tasks done directly. Move to status="review" first — Clara will approve and advance to done.',
              hint: 'Set status="review" with lastAgentUpdate describing what was completed. Clara reviews and moves to done.',
              recovery: 'Set status="review" with lastAgentUpdate summarising what was built and where outputs are. Clara will approve and close the task.',
            }) }] };
          }
        }

        // SOFT GUARD: warn if moving to review with incomplete subtasks
        if (args?.status === 'review') {
          const incomplete = (db.prepare(
            'SELECT COUNT(*) as c FROM subtasks WHERE taskId = ? AND completed = 0'
          ).get(taskId) as { c: number }).c;
          const total = (db.prepare(
            'SELECT COUNT(*) as c FROM subtasks WHERE taskId = ?'
          ).get(taskId) as { c: number }).c;
          if (total > 0 && incomplete > 0) {
            return { content: [{ type: 'text', text: JSON.stringify({
              error: `INCOMPLETE_WORK: ${incomplete} of ${total} subtasks are not yet completed. Complete all subtasks before submitting for review, or mark irrelevant ones complete with a note.`,
              incomplete,
              total,
              recovery: `Use task_get to see the incompleteSubtasks list with their IDs, then call subtask_update({ id: "<subtask-id>", completed: true }) for each one before retrying.`,
            }) }] };
          }
        }

        const sets = ['updatedAt = ?'];
        const vals: any[] = [now];

        let newStatus = args?.status as string | undefined;
        let newReviewStatus = args?.reviewStatus as string | undefined;

        // Auto-advance status based on reviewStatus.
        // Fires when reviewStatus is being set AND the task is (or is moving to) 'review'.
        const effectiveStatus = newStatus ?? current.status;
        if (newReviewStatus !== undefined && effectiveStatus === 'review') {
          if (newReviewStatus === 'approved') newStatus = 'done';
          else if (newReviewStatus === 'rejected' || newReviewStatus === 'needs-changes') newStatus = 'in-progress';
        }

        if (newStatus !== undefined)               { sets.push('status = ?');          vals.push(newStatus); }
        if (args?.progress !== undefined)           { const progress = Math.max(0, Math.min(100, Number(args.progress))); sets.push('progress = ?'); vals.push(progress); }
        if (args?.lastAgentUpdate)                  { sets.push('lastAgentUpdate = ?');  vals.push(args.lastAgentUpdate); }
        if (args?.planningNotes !== undefined)      { sets.push('planningNotes = ?');    vals.push(args.planningNotes); }
        if (args?.assignedTo !== undefined)         { sets.push('assignedTo = ?');       vals.push(args.assignedTo); }
        if (args?.reviewerId !== undefined)         { sets.push('reviewerId = ?');       vals.push(args.reviewerId); }
        if (newReviewStatus !== undefined)          { sets.push('reviewStatus = ?');     vals.push(newReviewStatus); }
        if (args?.reviewNotes !== undefined)        { sets.push('reviewNotes = ?');      vals.push(args.reviewNotes); }

        // Set completedAt when task reaches done
        if (newStatus === 'done')                   { sets.push('completedAt = ?');      vals.push(now); }

        vals.push(taskId);
        db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

        // Ensure Clara is reviewer — use already-fetched current (no second query)
        if (!args?.reviewerId && !current.reviewerId) {
          db.prepare('UPDATE tasks SET reviewerId = ? WHERE id = ?').run('clara', taskId);
        }

        // Clara review is triggered by the 3-minute cron sweep in claraReviewCron.ts.
        // No immediate HTTP dispatch here — the cron is the single trigger.

        // Auto-log activity — only for meaningful changes, not noise
        const statusChanged = newStatus !== undefined && newStatus !== current.status;
        const reviewChanged = newReviewStatus !== undefined;
        const activityMsg = args?.lastAgentUpdate ||
          (statusChanged ? `Status → ${newStatus}` : null) ||
          (reviewChanged ? `Review: ${newReviewStatus}` : null);

        if (activityMsg) {
          db.prepare('INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)').run(
            taskId, null, statusChanged ? 'status_change' : 'update', activityMsg, now
          );
        }

        return { content: [{ type: 'text', text: JSON.stringify({ success: true, status: newStatus ?? current.status }) }] };
      }

      // ── task_add_activity ───────────────────────────────────────────────────
      case 'task_add_activity': {
        db.prepare('INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)').run(
          args?.taskId, args?.agentId || null, args?.action || 'update', args?.message, Date.now()
        );
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      }

      // ── task_add_attachment ─────────────────────────────────────────────────
      case 'task_add_attachment': {
        const now = Date.now();
        const fileName = args?.fileName || (args?.filePath as string)?.split('/').pop() || String(args?.filePath);

        // Dedup: skip if this exact file is already attached to this task
        const existing = db.prepare(
          'SELECT id FROM task_attachments WHERE taskId = ? AND filePath = ?'
        ).get(args?.taskId, args?.filePath);
        if (existing) {
          return { content: [{ type: 'text', text: JSON.stringify({ success: true, note: 'already attached' }) }] };
        }

        db.prepare(
          'INSERT INTO task_attachments (taskId, filePath, fileName, category, uploadedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(args?.taskId, args?.filePath, fileName, args?.category || 'output', args?.uploadedBy || null, now);

        db.prepare('INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)').run(
          args?.taskId, args?.uploadedBy || null, 'file_created', `Created file: ${fileName}`, now
        );
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      }

      // ── approval_create ─────────────────────────────────────────────────────
      case 'approval_create': {
        const id = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const now = Date.now();
        const metadata = args?.metadata ? JSON.stringify(args.metadata) : '{}';
        db.prepare(`
          INSERT INTO approvals (id, type, title, content, context, requester, tier, status, metadata, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        `).run(id, args?.type, args?.title, args?.content, args?.context || null, args?.requester || null, args?.tier || 3, metadata, now);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, id }) }] };
      }

      // ── approval_check ──────────────────────────────────────────────────────
      case 'approval_check': {
        const parseMetadata = (row: any) => {
          if (!row) return row;
          try { row.metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata; } catch { /* keep as string */ }
          return row;
        };
        if (args?.id) {
          const row = db.prepare('SELECT * FROM approvals WHERE id = ?').get(args.id);
          return { content: [{ type: 'text', text: JSON.stringify(parseMetadata(row) || { error: 'not found' }) }] };
        }
        const rows = (db.prepare("SELECT * FROM approvals WHERE status = 'pending' ORDER BY createdAt DESC LIMIT 20").all() as any[])
          .map(parseMetadata);
        return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
      }

      // ── inbox_list ──────────────────────────────────────────────────────────
      case 'inbox_list': {
        const limit = (args?.limit as number) || 20;
        let query = 'SELECT * FROM inbox WHERE 1=1';
        const params: any[] = [];
        if (args?.unreadOnly) { query += ' AND isRead = 0'; }
        query += ' ORDER BY createdAt DESC LIMIT ?';
        params.push(limit);
        const rows = db.prepare(query).all(...params);
        return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
      }

      // ── agent_status ────────────────────────────────────────────────────────
      case 'agent_status': {
        if (args?.status) {
          db.prepare('UPDATE agents SET status = ?, lastActivity = ? WHERE id = ?').run(args.status, Date.now(), args?.agentId);
          return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
        }
        const agent = db.prepare('SELECT id, name, status, model, lastActivity FROM agents WHERE id = ?').get(args?.agentId);
        return { content: [{ type: 'text', text: JSON.stringify(agent || { error: 'not found' }) }] };
      }

      // ── chat_post ───────────────────────────────────────────────────────────
      case 'chat_post': {
        const content = String(args?.content ?? '').trim();
        if (!content) return { content: [{ type: 'text', text: JSON.stringify({ error: 'content is required', recovery: 'Provide a non-empty content string to the chat_post call.' }) }], isError: true };
        if (content.length > 20_000) return { content: [{ type: 'text', text: JSON.stringify({ error: 'content too long (max 20,000 chars)', recovery: 'Split your content into multiple chat_post calls, each under 20,000 characters.' }) }], isError: true };
        db.prepare('INSERT INTO chat_room_messages (roomId, agentId, content, timestamp) VALUES (?, ?, ?, ?)').run(
          args?.roomId, args?.agentId, content, Date.now()
        );

        // If the roomId matches an agent ID, look up the agent name for a helpful confirmation
        const roomId = String(args?.roomId ?? '');
        let deliveryHint: Record<string, string> = { success: 'true' };
        if (roomId && roomId !== 'mission-control' && !roomId.startsWith('room-') && !['general', 'code-review', 'planning', 'incidents'].includes(roomId)) {
          try {
            const targetAgent = db.prepare('SELECT name FROM agents WHERE id = ?').get(roomId) as { name?: string } | undefined;
            if (targetAgent?.name) {
              deliveryHint = { success: 'true', deliveredTo: targetAgent.name, hint: `Message delivered to ${targetAgent.name}'s 1-1 chat.` };
            }
          } catch { /* non-critical */ }
        }
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, ...deliveryHint }) }] };
      }

      // ── chat_read ───────────────────────────────────────────────────────────
      case 'chat_read': {
        const limit = (args?.limit as number) || 20;
        // Use ASC directly instead of DESC + reverse
        let query = 'SELECT * FROM chat_room_messages WHERE roomId = ?';
        const params: any[] = [args?.roomId];
        if (args?.since) { query += ' AND timestamp > ?'; params.push(args.since); }
        // Get last N messages in chronological order using a subquery
        query = `SELECT * FROM (${query} ORDER BY timestamp DESC LIMIT ?) ORDER BY timestamp ASC`;
        params.push(limit);
        const rows = db.prepare(query).all(...params);
        return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
      }

      // ── chat_rooms_list ─────────────────────────────────────────────────────
      case 'chat_rooms_list': {
        const rooms = db.prepare('SELECT * FROM chat_rooms ORDER BY name').all();
        return { content: [{ type: 'text', text: JSON.stringify(rooms) }] };
      }

      // ── subtask_create ──────────────────────────────────────────────────────
      case 'subtask_create': {
        const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const now = Date.now();
        const position = ((db.prepare('SELECT MAX(position) as p FROM subtasks WHERE taskId = ?').get(args?.taskId) as { p: number | null }).p ?? -1) + 1;
        db.prepare('INSERT INTO subtasks (id, taskId, title, description, assignedTo, completed, position, createdAt) VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
          .run(id, args?.taskId, args?.title, args?.description || null, args?.assignedTo || null, position, now);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, id, title: args?.title, taskId: args?.taskId }) }] };
      }

      // ── subtask_update ──────────────────────────────────────────────────────
      case 'subtask_update': {
        const now = Date.now();
        const sets: string[] = [];
        const vals: any[] = [];
        if (args?.completed !== undefined) {
          sets.push('completed = ?');
          vals.push(args.completed ? 1 : 0);
          if (args.completed) { sets.push('completedAt = ?'); vals.push(now); }
        }
        if (args?.title !== undefined) { sets.push('title = ?'); vals.push(args.title); }
        if (sets.length === 0) return { content: [{ type: 'text', text: JSON.stringify({ error: 'nothing to update' }) }] };
        vals.push(args?.id);
        db.prepare(`UPDATE subtasks SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      }

      // ── schedule_create ─────────────────────────────────────────────────────
      case 'schedule_create': {
        const schedulePath = path.join(process.env.HOME || '/tmp', 'mission-control', 'data', 'schedule.json');
        let jobs: any[] = [];
        try {
          if (fs.existsSync(schedulePath)) {
            const raw = fs.readFileSync(schedulePath, 'utf8').trim();
            if (raw) jobs = JSON.parse(raw);
          }
        } catch { /* empty file is fine */ }
        const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const schedule: any = { kind: args?.kind };
        if (args?.kind === 'once')     schedule.atMs    = args?.atMs || Date.now() + 60_000;
        if (args?.kind === 'interval') schedule.everyMs = args?.everyMs || 3_600_000;
        if (args?.kind === 'cron')     schedule.expr    = args?.expr;
        const job = {
          id,
          name: args?.name,
          description: args?.description || null,
          enabled: true,
          deleteAfterRun: args?.kind === 'once',
          schedule,
          sessionTarget: args?.sessionTarget || 'isolated',
          wakeMode: 'now',
          payload: {
            message: args?.message,
            model: args?.model || 'claude-haiku-4-5-20251001',
          },
          state: {},
          createdAt: Date.now(),
        };
        jobs.push(job);
        fs.mkdirSync(path.dirname(schedulePath), { recursive: true });
        fs.writeFileSync(schedulePath, JSON.stringify(jobs, null, 2));
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, id, job }) }] };
      }

      // ── schedule_list ───────────────────────────────────────────────────────
      case 'schedule_list': {
        const schedulePath = path.join(process.env.HOME || '/tmp', 'mission-control', 'data', 'schedule.json');
        let jobs: any[] = [];
        try {
          if (fs.existsSync(schedulePath)) {
            const raw = fs.readFileSync(schedulePath, 'utf8').trim();
            if (raw) jobs = JSON.parse(raw);
          }
        } catch { /* empty file */ }
        if (args?.enabled !== undefined) {
          jobs = jobs.filter((j: any) => !!j.enabled === !!args.enabled);
        }
        return { content: [{ type: 'text', text: JSON.stringify(jobs) }] };
      }

      // ── image_generate ──────────────────────────────────────────────────────
      case 'image_generate': {
        const prompt = String(args?.prompt ?? '').trim();
        if (!prompt) return { content: [{ type: 'text', text: JSON.stringify({ error: 'prompt is required' }) }], isError: true };

        const payload = JSON.stringify({
          prompt,
          agentId: args?.agentId ?? 'unknown',
          filename: args?.filename ?? '',
        });

        const result = await new Promise<string>((resolve) => {
          const req = http.request(
            {
              hostname: '127.0.0.1',
              port: parseInt(process.env.PORT ?? '3000', 10),
              path: '/api/generate-image',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                ...authHeaders(),
              },
            },
            (res) => {
              let body = '';
              res.on('data', (chunk) => { body += chunk; });
              res.on('end', () => resolve(body));
            },
          );
          req.on('error', (e) => resolve(JSON.stringify({ error: e.message })));
          req.setTimeout(60_000, () => { req.destroy(); resolve(JSON.stringify({ error: 'Image generation timed out' })); });
          req.write(payload);
          req.end();
        });

        let parsed: any;
        try { parsed = JSON.parse(result); } catch { parsed = { error: result }; }

        if (parsed.error) {
          return { content: [{ type: 'text', text: JSON.stringify({ ...parsed, recovery: 'Check that the image generation service is running on port 3000. Retry with a shorter, simpler prompt if the error is prompt-related.' }) }], isError: true };
        }

        // Auto-post the image to the agent's chat room so it always appears in chat
        try {
          const agentId = args?.agentId ?? 'unknown';
          const roomId = agentId;
          db.prepare(
            'INSERT INTO chat_room_messages (roomId, agentId, content, timestamp) VALUES (?, ?, ?, ?)'
          ).run(roomId, agentId, parsed.markdown, Date.now());
        } catch { /* non-critical — image generation succeeded regardless */ }

        // Compute library-relative path for image_remove_background chaining
        const HOME_DIR = process.env.HOME || '/tmp';
        const libraryBase = path.join(HOME_DIR, 'mission-control', 'library');
        let removeBackgroundPath: string | undefined;
        if (parsed.filePath) {
          if (parsed.filePath.startsWith(libraryBase)) {
            removeBackgroundPath = path.relative(libraryBase, parsed.filePath);
          } else {
            removeBackgroundPath = parsed.filePath; // fallback: pass as-is
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              markdown: parsed.markdown,
              url: parsed.url,
              filePath: parsed.filePath,
              filename: parsed.filename,
              removeBackgroundPath,
              hint: `Image generated. You MUST include the markdown field verbatim in your next chat_post response so the user sees the image inline. To remove background: image_remove_background({ inputPath: "${removeBackgroundPath ?? parsed.filePath}", agentId: "<your-id>" })`,
            }),
          }],
        };
      }

      // ── image_remove_background ─────────────────────────────────────────────
      case 'image_remove_background': {
        const inputPath = String(args?.inputPath ?? '').trim();
        if (!inputPath) return { content: [{ type: 'text', text: JSON.stringify({ error: 'inputPath is required', recovery: 'Use the removeBackgroundPath field from the image_generate response. Example: image_remove_background({ inputPath: result.removeBackgroundPath, agentId: yourId })' }) }], isError: true };

        const payload = JSON.stringify({
          inputPath,
          agentId: args?.agentId ?? 'unknown',
          model: args?.model ?? 'birefnet-hd',
        });

        const result = await new Promise<string>((resolve) => {
          const req = http.request(
            {
              hostname: '127.0.0.1',
              port: parseInt(process.env.PORT ?? '3000', 10),
              path: '/api/remove-background',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                ...authHeaders(),
              },
            },
            (res) => {
              let body = '';
              res.on('data', (chunk) => { body += chunk; });
              res.on('end', () => resolve(body));
            },
          );
          req.on('error', (e) => resolve(JSON.stringify({ error: e.message })));
          req.setTimeout(130_000, () => { req.destroy(); resolve(JSON.stringify({ error: 'Background removal timed out' })); });
          req.write(payload);
          req.end();
        });

        let parsed: any;
        try { parsed = JSON.parse(result); } catch { parsed = { error: result }; }

        if (parsed.error) {
          return { content: [{ type: 'text', text: JSON.stringify({ ...parsed, recovery: 'Use the removeBackgroundPath field from image_generate response. Pass the path relative to ~/mission-control/library/ (e.g. "design/images/2026-03-14_name.png"). Do not include the full ~/mission-control/library/ prefix.' }) }], isError: true };
        }

        // Auto-post the cutout to the agent's chat room
        try {
          const agentId = args?.agentId ?? 'unknown';
          db.prepare(
            'INSERT INTO chat_room_messages (roomId, agentId, content, timestamp) VALUES (?, ?, ?, ?)'
          ).run(agentId, agentId, parsed.markdown, Date.now());
        } catch { /* non-critical */ }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              markdown: parsed.markdown,
              url: parsed.url,
              filePath: parsed.filePath,
              filename: parsed.filename,
              hint: 'Background removed and saved as optimised transparent PNG. Image auto-posted to your chat room. Include the markdown in your response too.',
            }),
          }],
        };
      }

      // ── project_context ─────────────────────────────────────────────────────
      case 'project_context': {
        const projectId = args?.projectId as string | undefined;
        if (projectId) {
          // Single project — full context
          const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Record<string, any> | undefined;
          if (!project) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Project not found' }) }] };
          const members = db.prepare(`
            SELECT pm.agentId, pm.role, a.name as agentName FROM project_members pm
            LEFT JOIN agents a ON a.id = pm.agentId
            WHERE pm.projectId = ?
          `).all(projectId) as any[];
          const milestones = db.prepare(
            'SELECT id, title, dueDate, completed, completedAt FROM project_milestones WHERE projectId = ? ORDER BY createdAt ASC'
          ).all(projectId) as any[];
          const openTaskCount = (db.prepare(
            "SELECT COUNT(*) as c FROM tasks WHERE project_id = ? AND status NOT IN ('done')"
          ).get(projectId) as { c: number }).c;
          const doneTaskCount = (db.prepare(
            "SELECT COUNT(*) as c FROM tasks WHERE project_id = ? AND status = 'done'"
          ).get(projectId) as { c: number }).c;
          return { content: [{ type: 'text', text: JSON.stringify({
            id: project.id, name: project.name, description: project.description,
            goal: project.goal, status: project.status, color: project.color,
            createdAt: project.createdAt, updatedAt: project.updatedAt,
            members, milestones, openTasks: openTaskCount, doneTasks: doneTaskCount,
          }, null, 2) }] };
        } else {
          // All active projects — summary list
          const projects = db.prepare(
            "SELECT id, name, description, goal, status, color, createdAt FROM projects WHERE status = 'active' ORDER BY createdAt DESC LIMIT 20"
          ).all() as any[];
          const result = projects.map((p) => {
            const openTasks = (db.prepare(
              "SELECT COUNT(*) as c FROM tasks WHERE project_id = ? AND status NOT IN ('done')"
            ).get(p.id) as { c: number }).c;
            const memberCount = (db.prepare(
              'SELECT COUNT(*) as c FROM project_members WHERE projectId = ?'
            ).get(p.id) as { c: number }).c;
            return { ...p, openTasks, memberCount };
          });
          return { content: [{ type: 'text', text: JSON.stringify({ projects: result }, null, 2) }] };
        }
      }

      // ── agent_status_set ─────────────────────────────────────────────────────
      case 'agent_status_set': {
        const agentId = args?.agentId as string;
        const status = args?.status as string;
        const currentTask = args?.currentTask as string | undefined;
        if (!agentId || !status) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'agentId and status are required' }) }], isError: true };
        }
        const now = Date.now();
        // Update the agents table — use PATCH through the API to get full side-effects (SSE, etc.)
        await awaitPatch(`/api/agents/${encodeURIComponent(agentId)}`, {
          status,
          ...(currentTask !== undefined ? { currentTaskId: currentTask } : {}),
          lastActivity: now,
        });
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, agentId, status, currentTask }) }] };
      }

      // ── campaign_context ─────────────────────────────────────────────────────
      case 'campaign_context': {
        const statusFilter = args?.status as string | undefined;
        let query = `SELECT id, name, description, type, goal, status, channels, budget, budgetSpent,
          targetAudience, kpis, startDate, endDate, color, createdAt
          FROM campaigns`;
        const params: any[] = [];
        if (statusFilter) {
          query += ' WHERE status = ?';
          params.push(statusFilter);
        }
        query += ' ORDER BY createdAt DESC LIMIT 20';
        let campaigns: any[] = [];
        try {
          campaigns = db.prepare(query).all(...params) as any[];
        } catch {
          return { content: [{ type: 'text', text: JSON.stringify({ campaigns: [], note: 'No campaigns table found — campaigns have not been set up yet.' }) }] };
        }
        const result = campaigns.map((c) => {
          let channels: string[] = [];
          try { channels = JSON.parse(c.channels); } catch { /* keep empty */ }
          let kpis: Record<string, unknown> = {};
          try { kpis = JSON.parse(c.kpis); } catch { /* keep empty */ }
          const members = db.prepare(`
            SELECT cm.agentId, cm.role, a.name as agentName FROM campaign_members cm
            LEFT JOIN agents a ON a.id = cm.agentId
            WHERE cm.campaignId = ?
          `).all(c.id) as any[];
          const openTasks = (db.prepare(
            "SELECT COUNT(*) as cnt FROM tasks WHERE project_id = ? AND status NOT IN ('done')"
          ).get(c.id) as { cnt: number }).cnt;
          return { ...c, channels, kpis, members, openTasks };
        });
        return { content: [{ type: 'text', text: JSON.stringify({ campaigns: result, hint: result.length === 0 ? 'No campaigns found. Create one via the Campaigns section in the dashboard.' : `Found ${result.length} campaign(s).` }, null, 2) }] };
      }

      // ── knowledge_search ────────────────────────────────────────────────────
      case 'knowledge_search': {
        const query = String(args?.query ?? '').trim();
        if (!query) return { content: [{ type: 'text', text: JSON.stringify({ error: 'query required' }) }], isError: true };

        let articles: Record<string, unknown>[] = [];
        try {
          // Try FTS first
          articles = db.prepare(`
            SELECT kb.id, kb.title, kb.category, kb.tags, kb.content, kb.scope
            FROM knowledge_base kb
            JOIN knowledge_base_fts fts ON fts.rowid = kb.rowid
            WHERE knowledge_base_fts MATCH ?
            ORDER BY rank LIMIT 5
          `).all(query) as Record<string, unknown>[];
        } catch {
          // Fallback to LIKE search
          articles = db.prepare(`
            SELECT id, title, category, tags, content, scope FROM knowledge_base
            WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?
            ORDER BY pinned DESC, updatedAt DESC LIMIT 5
          `).all(`%${query}%`, `%${query}%`, `%${query}%`) as Record<string, unknown>[];
        }

        const category = args?.category as string | undefined;
        if (category) articles = articles.filter((a) => a.category === category);

        const result = articles.map((a) => ({
          id: a.id,
          title: a.title,
          category: a.category,
          tags: (() => { try { return JSON.parse(a.tags as string); } catch { return []; } })(),
          // Include first 800 chars of content inline so agent doesn't need a second call for short articles
          contentPreview: (a.content as string).slice(0, 800),
          fullContentAvailable: (a.content as string).length > 800,
        }));

        return { content: [{ type: 'text', text: JSON.stringify({ articles: result, hint: result.length === 0 ? 'No articles found. The human may not have added guidelines yet — proceed with best judgment.' : 'Use knowledge_read(id) for full content of any article.' }) }] };
      }

      // ── knowledge_read ──────────────────────────────────────────────────────
      case 'knowledge_read': {
        const article = db.prepare('SELECT * FROM knowledge_base WHERE id = ?').get(args?.id) as Record<string, unknown> | undefined;
        if (!article) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Article not found. Use knowledge_search to find available articles.' }) }], isError: true };

        const links = db.prepare('SELECT title, url, description FROM knowledge_base_links WHERE knowledgeId = ? ORDER BY createdAt ASC').all(args?.id);

        return { content: [{ type: 'text', text: JSON.stringify({
          id: article.id,
          title: article.title,
          category: article.category,
          tags: (() => { try { return JSON.parse(article.tags as string); } catch { return []; } })(),
          content: article.content,
          links,
          version: article.version,
          updatedAt: article.updatedAt,
        }) }] };
      }

      // ── knowledge_write ─────────────────────────────────────────────────────
      case 'knowledge_write': {
        const title = String(args?.title ?? '').trim();
        const content = String(args?.content ?? '').trim();
        const category = String(args?.category ?? 'reference').trim();
        const tags = Array.isArray(args?.tags) ? args.tags : [];

        if (!title || !content) return { content: [{ type: 'text', text: JSON.stringify({ error: 'title and content required' }) }], isError: true };

        const now = Date.now();
        const id = `kb-${now}-${Math.random().toString(36).slice(2, 7)}`;
        db.prepare(`
          INSERT INTO knowledge_base (id, title, content, category, tags, scope, pinned, version, createdBy, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, 'all', 0, 1, 'agent', ?, ?)
        `).run(id, title, content, category, JSON.stringify(tags), now, now);

        return { content: [{ type: 'text', text: JSON.stringify({ success: true, id, hint: 'Knowledge saved. Other agents and future sessions can now find this via knowledge_search.' }) }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err: any) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    // Note: no db.close() here — singleton connection stays open for the process lifetime
  }
});

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('mission-control-db MCP server running on stdio');
}

main().catch(console.error);
