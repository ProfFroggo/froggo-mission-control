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

/** Fire-and-forget POST to the Next.js app (port 3000). */
function firePost(urlPath: string, body: object): void {
  const encoded = JSON.stringify(body);
  const req = http.request({
    hostname: '127.0.0.1', port: 3000,
    path: urlPath, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(encoded) },
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
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(encoded) },
  }, (res) => { res.resume(); });
  req.on('error', () => {});
  req.setTimeout(5000, () => req.destroy());
  req.write(encoded);
  req.end();
}

// ── Server ────────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'mission-control-db', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'task_list',
      description: 'List tasks, optionally filtered by status, assignee, or project',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by status (todo, in-progress, internal-review, review, human-review, blocked, done)' },
          assignedTo: { type: 'string', description: 'Filter by agent ID' },
          project: { type: 'string', description: 'Filter by project name' },
          limit: { type: 'number', description: 'Max tasks to return (default 50)' },
        },
      },
    },
    {
      name: 'task_get',
      description: 'Get a task by ID including its subtasks, attachments, and recent activity. Use this to look up subtask IDs so you can mark them complete.',
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
      description: 'Create a new task. MANDATORY RULES — task will be REJECTED if violated: (1) planningNotes is REQUIRED — must contain the full plan, approach, steps, and context (min 20 chars); (2) reviewer is always Clara — do not override; (3) after creating, immediately add at least 2 subtasks via subtask_create before starting work. description must be 1-2 sentences max. Put all detail in planningNotes.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title — clear and actionable' },
          description: { type: 'string', description: '1-2 sentence summary of what this task is. DO NOT put plans, steps, or details here.' },
          assignedTo: { type: 'string', description: 'Agent ID to assign to — task will be auto-dispatched when set' },
          priority: { type: 'string', description: 'Priority: p0, p1, p2, p3, p4 (default p2)' },
          project: { type: 'string', description: 'Project name' },
          parentTaskId: { type: 'string', description: 'Parent task ID (for sub-tasks)' },
          planningNotes: { type: 'string', description: 'Full plan, approach, steps, context, and any relevant file paths or instructions. This is where all detailed planning goes.' },
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
          status: { type: 'string', description: 'New status: todo | in-progress | internal-review | review | human-review | blocked | done' },
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
      description: 'Add an activity log entry to a task',
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
      description: 'Attach a file to a task. Call this every time you create or save a file. ALWAYS save files to the correct library path: research/analysis→docs/research/, strategy→docs/stratagies/, presentations→docs/presentations/, platform docs→docs/platform/, code→code/, UI→design/ui/, images→design/images/, media→design/media/. All paths under ~/mission-control/library/. Name files: YYYY-MM-DD_description.ext',
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
      description: 'Post a message to a chat room',
      inputSchema: {
        type: 'object',
        properties: {
          roomId: { type: 'string', description: 'Chat room ID (general, code-review, planning, incidents)' },
          agentId: { type: 'string', description: 'Posting agent ID' },
          content: { type: 'string', description: 'Message content' },
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
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(args?.id);
        if (!task) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }] };
        const subtasks = db.prepare('SELECT * FROM subtasks WHERE taskId = ? ORDER BY position ASC').all(args?.id);
        const attachments = db.prepare('SELECT id, fileName, filePath, category, uploadedBy, createdAt FROM task_attachments WHERE taskId = ? ORDER BY createdAt DESC').all(args?.id);
        const activity = db.prepare('SELECT agentId, action, message, timestamp FROM task_activity WHERE taskId = ? ORDER BY timestamp DESC LIMIT 10').all(args?.id);
        return { content: [{ type: 'text', text: JSON.stringify({ ...task as object, subtasks, attachments, recentActivity: activity }, null, 2) }] };
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
        return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
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
        const initialStatus = (args?.status as string) || 'todo';
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

        if (!current) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Task not found' }) }] };

        // HARD RULE: todo → internal-review requires planningNotes + 2+ subtasks + agent assigned
        // internal-review is the quality gate — agent sets everything up, then requests review
        if (args?.status === 'internal-review' && current.status === 'todo') {
          const fullTask = db.prepare('SELECT planningNotes, assignedTo FROM tasks WHERE id = ?').get(taskId) as { planningNotes: string | null; assignedTo: string | null } | undefined;
          const subtaskCount = (db.prepare('SELECT COUNT(*) as c FROM subtasks WHERE taskId = ?').get(taskId) as { c: number }).c;
          const errors: string[] = [];
          if (!fullTask?.planningNotes || fullTask.planningNotes.trim().length < 20) errors.push('planningNotes must contain a meaningful plan');
          if (subtaskCount < 2) errors.push(`at least 2 subtasks required (currently ${subtaskCount}) — add with subtask_create`);
          if (!fullTask?.assignedTo) errors.push('task must have an agent assigned (assignedTo)');
          if (errors.length > 0) {
            return { content: [{ type: 'text', text: JSON.stringify({
              error: 'TASK_NOT_READY: cannot move to internal-review until task is fully set up.',
              requirements: errors,
              hint: 'Complete all requirements, then set status=internal-review. Clara will review and move to in-progress.'
            }) }] };
          }
        }

        // HARD RULE: internal-review → in-progress is Clara's gate — no agent should skip internal-review
        if (args?.status === 'in-progress' && current.status === 'todo') {
          return { content: [{ type: 'text', text: JSON.stringify({
            error: 'WORKFLOW_VIOLATION: cannot move directly from todo to in-progress. Required flow: todo → internal-review → in-progress. Set up planning, subtasks, and assignment first, then move to internal-review.',
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
        if (args?.progress !== undefined)           { sets.push('progress = ?');         vals.push(args.progress); }
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

        // Trigger Clara review via HTTP when task enters review
        if (newStatus === 'review') {
          firePost('/api/agents/clara/review', { taskId });
        }

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
        db.prepare('INSERT INTO chat_room_messages (roomId, agentId, content, timestamp) VALUES (?, ?, ?, ?)').run(
          args?.roomId, args?.agentId, args?.content, Date.now()
        );
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
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
