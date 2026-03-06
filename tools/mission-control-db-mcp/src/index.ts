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

// Fire-and-forget: trigger Clara review when a task moves to 'review' status.
// This bypasses the PostToolUse hook dependency entirely — always fires from the DB layer.
function triggerClaraReview(taskId: string) {
  const body = JSON.stringify({ taskId });
  const req = http.request({
    hostname: '127.0.0.1', port: 3000,
    path: '/api/agents/clara/review', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, (res) => { res.resume(); });
  req.on('error', () => { /* app may not be running — cron is the fallback */ });
  req.setTimeout(3000, () => req.destroy());
  req.write(body);
  req.end();
}

const DB_PATH = process.env.DB_PATH ||
  path.join(process.env.HOME || '/tmp', 'mission-control', 'data', 'mission-control.db');

function getDb(): Database.Database {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

const server = new Server(
  { name: 'mission-control-db', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'task_list',
      description: 'List tasks, optionally filtered by status or assignee',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by status (todo, in-progress, done, review)' },
          assignedTo: { type: 'string', description: 'Filter by agent ID' },
          limit: { type: 'number', description: 'Max tasks to return (default 50)' },
        },
      },
    },
    {
      name: 'task_create',
      description: 'Create a new task',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title' },
          description: { type: 'string', description: 'Task description' },
          assignedTo: { type: 'string', description: 'Agent ID to assign to' },
          priority: { type: 'string', description: 'Priority: p0, p1, p2, p3, p4 (default p2)' },
          project: { type: 'string', description: 'Project name' },
          parentTaskId: { type: 'string', description: 'Parent task ID (for subtasks)' },
          planningNotes: { type: 'string', description: 'Planning notes / approach' },
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
          status: { type: 'string', description: 'New status: todo | in-progress | review | human-review | blocked | done' },
          progress: { type: 'number', description: 'Progress 0-100' },
          lastAgentUpdate: { type: 'string', description: 'Update message' },
          planningNotes: { type: 'string', description: 'Planning notes' },
          assignedTo: { type: 'string', description: 'Reassign to agent ID' },
          reviewerId: { type: 'string', description: 'Reviewer agent ID' },
          reviewStatus: { type: 'string', description: 'Review status: pending | approved | rejected' },
          reviewNotes: { type: 'string', description: 'Review feedback notes' },
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
          action: { type: 'string', description: 'Action type (e.g. update, comment, complete, file_created)' },
          message: { type: 'string', description: 'Activity message' },
        },
        required: ['taskId', 'message'],
      },
    },
    {
      name: 'task_add_attachment',
      description: 'Attach a file to a task. Call this every time you create or save a file as part of task work.',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID' },
          filePath: { type: 'string', description: 'Absolute path to the file' },
          fileName: { type: 'string', description: 'Display name for the file' },
          category: { type: 'string', description: 'File category (e.g. output, report, code, design, data)' },
          uploadedBy: { type: 'string', description: 'Agent ID that created the file' },
        },
        required: ['taskId', 'filePath'],
      },
    },
    {
      name: 'approval_create',
      description: 'Create an approval request for human review',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Approval type' },
          title: { type: 'string', description: 'Approval title' },
          content: { type: 'string', description: 'Content to approve' },
          requester: { type: 'string', description: 'Agent requesting approval' },
          tier: { type: 'number', description: 'Trust tier (1-4)' },
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
      description: 'Create a subtask (checklist item) on a parent task. Use this to break work into trackable steps.',
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
          completed: { type: 'boolean', description: 'Mark as complete or incomplete' },
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

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const db = getDb();
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'task_list': {
        const limit = (args?.limit as number) || 50;
        let query = 'SELECT id, title, status, priority, assignedTo, project, createdAt, updatedAt, progress FROM tasks WHERE 1=1';
        const params: any[] = [];
        if (args?.status) { query += ' AND status = ?'; params.push(args.status); }
        if (args?.assignedTo) { query += ' AND assignedTo = ?'; params.push(args.assignedTo); }
        query += ' ORDER BY createdAt DESC LIMIT ?';
        params.push(limit);
        const tasks = db.prepare(query).all(...params);
        return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
      }

      case 'task_create': {
        const now = Date.now();
        const id = `task-${now}-${Math.random().toString(36).slice(2, 8)}`;
        db.prepare(`
          INSERT INTO tasks (id, title, description, status, priority, project, assignedTo,
            reviewerId, planningNotes, parentTaskId, tags, labels, blockedBy, blocks,
            progress, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', '[]', '[]', 0, ?, ?)
        `).run(
          id,
          args?.title,
          args?.description || null,
          args?.status || 'todo',
          args?.priority || 'p2',
          args?.project || null,
          args?.assignedTo || null,
          args?.reviewerId || 'clara',
          args?.planningNotes || null,
          args?.parentTaskId || null,
          now, now
        );
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, id, task }) }] };
      }

      case 'task_update': {
        const now = Date.now();
        const taskId = args?.id as string;

        // Fetch current task to enable smart auto-advances
        const current = db.prepare('SELECT status, reviewStatus FROM tasks WHERE id = ?').get(taskId) as
          { status: string; reviewStatus: string | null } | undefined;

        const sets = ['updatedAt = ?'];
        const vals: any[] = [now];

        let newStatus = args?.status as string | undefined;
        let newReviewStatus = args?.reviewStatus as string | undefined;

        // Auto-advance: if reviewStatus is being set but status is not explicitly changed,
        // and the task is currently in 'review', auto-advance status based on review decision.
        if (newReviewStatus !== undefined && newStatus === undefined && current?.status === 'review') {
          if (newReviewStatus === 'approved') newStatus = 'done';
          else if (newReviewStatus === 'rejected' || newReviewStatus === 'needs-changes') newStatus = 'in-progress';
        }

        if (newStatus !== undefined) { sets.push('status = ?'); vals.push(newStatus); }
        if (args?.progress !== undefined) { sets.push('progress = ?'); vals.push(args.progress); }
        if (args?.lastAgentUpdate) { sets.push('lastAgentUpdate = ?'); vals.push(args.lastAgentUpdate); }
        if (args?.planningNotes !== undefined) { sets.push('planningNotes = ?'); vals.push(args.planningNotes); }
        if (args?.assignedTo !== undefined) { sets.push('assignedTo = ?'); vals.push(args.assignedTo); }
        if (args?.reviewerId !== undefined) { sets.push('reviewerId = ?'); vals.push(args.reviewerId); }
        if (newReviewStatus !== undefined) { sets.push('reviewStatus = ?'); vals.push(newReviewStatus); }
        if (args?.reviewNotes !== undefined) { sets.push('reviewNotes = ?'); vals.push(args.reviewNotes); }
        vals.push(taskId);
        db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

        // Auto-assign Clara as reviewer when task enters review or internal-review
        if ((newStatus === 'review' || newStatus === 'internal-review') && !args?.reviewerId) {
          const current2 = db.prepare('SELECT reviewerId FROM tasks WHERE id = ?').get(taskId) as Record<string, unknown> | undefined;
          if (!current2?.reviewerId) {
            db.prepare('UPDATE tasks SET reviewerId = ? WHERE id = ?').run('clara', taskId);
          }
        }

        // Auto-trigger Clara when task enters review (direct HTTP — no hook dependency)
        if (newStatus === 'review') {
          triggerClaraReview(taskId);
        }

        // Auto-log activity for every task_update so the timeline is always populated
        const activityMsg = args?.lastAgentUpdate ||
          (newStatus && newStatus !== current?.status ? `Status → ${newStatus}` : null) ||
          (newReviewStatus ? `Review: ${newReviewStatus}` : null) ||
          'Task updated';
        db.prepare('INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)').run(
          taskId, null, newStatus ? 'status_change' : 'update', activityMsg, now
        );

        return { content: [{ type: 'text', text: JSON.stringify({ success: true, status: newStatus ?? current?.status }) }] };
      }

      case 'task_add_activity': {
        const now = Date.now();
        db.prepare('INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)').run(
          args?.taskId, args?.agentId || null, args?.action || 'update', args?.message, now
        );
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      }

      case 'task_add_attachment': {
        const now = Date.now();
        db.prepare(
          'INSERT INTO task_attachments (taskId, filePath, fileName, category, uploadedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(
          args?.taskId,
          args?.filePath,
          args?.fileName || (args?.filePath as string)?.split('/').pop() || args?.filePath,
          args?.category || 'output',
          args?.uploadedBy || null,
          now
        );
        // Also log a file_created activity for the timeline
        db.prepare('INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)').run(
          args?.taskId, args?.uploadedBy || null, 'file_created',
          `Created file: ${args?.fileName || (args?.filePath as string)?.split('/').pop()}`,
          now
        );
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      }

      case 'approval_create': {
        const id = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const now = Date.now();
        db.prepare(`INSERT INTO approvals (id, type, title, content, requester, tier, status, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?, 'pending', '{}', ?)`).run(
          id, args?.type, args?.title, args?.content, args?.requester || null, args?.tier || 3, now
        );
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, id }) }] };
      }

      case 'approval_check': {
        if (args?.id) {
          const row = db.prepare('SELECT * FROM approvals WHERE id = ?').get(args.id);
          return { content: [{ type: 'text', text: JSON.stringify(row || { error: 'not found' }) }] };
        }
        const rows = db.prepare("SELECT * FROM approvals WHERE status = 'pending' ORDER BY createdAt DESC LIMIT 20").all();
        return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
      }

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

      case 'agent_status': {
        if (args?.status) {
          db.prepare('UPDATE agents SET status = ?, lastActivity = ? WHERE id = ?').run(args.status, Date.now(), args?.agentId);
          return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
        }
        const agent = db.prepare('SELECT id, name, status, model, lastActivity FROM agents WHERE id = ?').get(args?.agentId);
        return { content: [{ type: 'text', text: JSON.stringify(agent || { error: 'not found' }) }] };
      }

      case 'chat_post': {
        db.prepare('INSERT INTO chat_room_messages (roomId, agentId, content, timestamp) VALUES (?, ?, ?, ?)').run(
          args?.roomId, args?.agentId, args?.content, Date.now()
        );
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      }

      case 'chat_read': {
        const limit = (args?.limit as number) || 20;
        let query = 'SELECT * FROM chat_room_messages WHERE roomId = ?';
        const params: any[] = [args?.roomId];
        if (args?.since) { query += ' AND timestamp > ?'; params.push(args.since); }
        query += ' ORDER BY timestamp DESC LIMIT ?';
        params.push(limit);
        const rows = db.prepare(query).all(...params).reverse();
        return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
      }

      case 'chat_rooms_list': {
        const rooms = db.prepare('SELECT * FROM chat_rooms ORDER BY name').all();
        return { content: [{ type: 'text', text: JSON.stringify(rooms) }] };
      }

      case 'subtask_create': {
        const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const now = Date.now();
        const position = ((db.prepare('SELECT MAX(position) as p FROM subtasks WHERE taskId = ?').get(args?.taskId) as { p: number | null }).p ?? -1) + 1;
        db.prepare('INSERT INTO subtasks (id, taskId, title, description, assignedTo, completed, position, createdAt) VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
          .run(id, args?.taskId, args?.title, args?.description || null, args?.assignedTo || null, position, now);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, id }) }] };
      }

      case 'subtask_update': {
        const now = Date.now();
        const sets: string[] = [];
        const vals: any[] = [];
        if (args?.completed !== undefined) { sets.push('completed = ?'); vals.push(args.completed ? 1 : 0); if (args.completed) { sets.push('completedAt = ?'); vals.push(now); } }
        if (args?.title !== undefined) { sets.push('title = ?'); vals.push(args.title); }
        if (sets.length === 0) return { content: [{ type: 'text', text: JSON.stringify({ error: 'nothing to update' }) }] };
        vals.push(args?.id);
        db.prepare(`UPDATE subtasks SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      }

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
        if (args?.kind === 'once') schedule.atMs = args?.atMs || Date.now() + 60_000;
        if (args?.kind === 'interval') schedule.everyMs = args?.everyMs || 3_600_000;
        if (args?.kind === 'cron') schedule.expr = args?.expr;
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
  } finally {
    db.close();
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('mission-control-db MCP server running on stdio');
}

main().catch(console.error);
