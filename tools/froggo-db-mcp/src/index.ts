import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH ||
  path.join(process.env.HOME || '/tmp', 'froggo', 'data', 'froggo.db');

function getDb(): Database.Database {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

const server = new Server(
  { name: 'froggo-db', version: '1.0.0' },
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
          priority: { type: 'string', description: 'Priority: p0, p1, p2, p3' },
          project: { type: 'string', description: 'Project name' },
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
          status: { type: 'string', description: 'New status' },
          progress: { type: 'number', description: 'Progress 0-100' },
          lastAgentUpdate: { type: 'string', description: 'Update message' },
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
          action: { type: 'string', description: 'Action type (e.g. update, comment, complete)' },
          message: { type: 'string', description: 'Activity message' },
        },
        required: ['taskId', 'message'],
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
        db.prepare(`INSERT INTO tasks (id, title, description, status, priority, project, assignedTo, tags, labels, blockedBy, blocks, createdAt, updatedAt) VALUES (?, ?, ?, 'todo', ?, ?, ?, '[]', '[]', '[]', '[]', ?, ?)`).run(
          id, args?.title, args?.description || null, args?.priority || 'p2', args?.project || null, args?.assignedTo || null, now, now
        );
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, id }) }] };
      }

      case 'task_update': {
        const now = Date.now();
        const sets = ['updatedAt = ?'];
        const vals: any[] = [now];
        if (args?.status) { sets.push('status = ?'); vals.push(args.status); }
        if (args?.progress !== undefined) { sets.push('progress = ?'); vals.push(args.progress); }
        if (args?.lastAgentUpdate) { sets.push('lastAgentUpdate = ?'); vals.push(args.lastAgentUpdate); }
        vals.push(args?.id);
        db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      }

      case 'task_add_activity': {
        const now = Date.now();
        db.prepare('INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)').run(
          args?.taskId, args?.agentId || null, args?.action || 'update', args?.message, now
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
  console.error('froggo-db MCP server running on stdio');
}

main().catch(console.error);
