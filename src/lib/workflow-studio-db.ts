// Workflow Studio SQLite database — MC-native, no proxy needed
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';

// ---------- Types ----------

export interface WorkflowRow {
  id: string;
  name: string;
  description: string;
  color: string;
  state: string;
  is_deployed: number;
  run_count: number;
  variables: string;
  created_at: string;
  updated_at: string;
}

export interface ExecutionRow {
  id: string;
  workflow_id: string;
  trigger: string;
  status: string;
  result: string;
  error: string | null;
  duration_ms: number;
  started_at: string;
  completed_at: string | null;
}

// ---------- Lazy singleton ----------

let _db: InstanceType<typeof Database> | null = null;
let _stmts: ReturnType<typeof prepareStatements> | null = null;

function getDb(): InstanceType<typeof Database> {
  if (_db) return _db;

  const dbPath =
    process.env.WS_DATABASE_PATH ||
    path.join(os.homedir(), 'mission-control/data/workflow-studio.db');

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Untitled Workflow',
      description TEXT DEFAULT '',
      color TEXT DEFAULT '#7c3aed',
      state TEXT NOT NULL DEFAULT '{}',
      is_deployed INTEGER DEFAULT 0,
      run_count INTEGER DEFAULT 0,
      variables TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS execution_logs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      trigger TEXT DEFAULT 'manual',
      status TEXT DEFAULT 'running',
      result TEXT DEFAULT '{}',
      error TEXT,
      duration_ms INTEGER DEFAULT 0,
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );
  `);

  return _db;
}

function prepareStatements(db: InstanceType<typeof Database>) {
  return {
    upsertWorkflow: db.prepare(`
      INSERT INTO workflows (id, name, description, color, state, is_deployed, variables, updated_at)
      VALUES (@id, COALESCE(@name, 'Untitled Workflow'), COALESCE(@description, ''), COALESCE(@color, '#7c3aed'), COALESCE(@state, '{}'), COALESCE(@is_deployed, 0), COALESCE(@variables, '{}'), datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name = COALESCE(@name, workflows.name),
        description = COALESCE(@description, workflows.description),
        color = COALESCE(@color, workflows.color),
        state = COALESCE(@state, workflows.state),
        is_deployed = COALESCE(@is_deployed, workflows.is_deployed),
        variables = COALESCE(@variables, workflows.variables),
        updated_at = datetime('now')
    `),
    getWorkflow: db.prepare('SELECT * FROM workflows WHERE id = ?'),
    listWorkflows: db.prepare('SELECT * FROM workflows ORDER BY updated_at DESC LIMIT ? OFFSET ?'),
    deleteWorkflow: db.prepare('DELETE FROM workflows WHERE id = ?'),
    incrementRunCount: db.prepare('UPDATE workflows SET run_count = run_count + 1 WHERE id = ?'),
    insertExecution: db.prepare('INSERT INTO execution_logs (id, workflow_id, trigger) VALUES (@id, @workflowId, @trigger)'),
    updateExecution: db.prepare(`
      UPDATE execution_logs SET
        status = COALESCE(@status, status),
        result = COALESCE(@result, result),
        error = COALESCE(@error, error),
        duration_ms = COALESCE(@durationMs, duration_ms),
        completed_at = COALESCE(@completedAt, completed_at)
      WHERE id = @id
    `),
    getExecution: db.prepare('SELECT * FROM execution_logs WHERE id = ?'),
    listExecutions: db.prepare('SELECT * FROM execution_logs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?'),
  };
}

function stmts() {
  if (_stmts) return _stmts;
  _stmts = prepareStatements(getDb());
  return _stmts;
}

// ---------- Public API ----------

export const wsDb = {
  saveWorkflow(id: string, data: { name?: string; description?: string; color?: string; state?: any; variables?: any; is_deployed?: boolean }) {
    stmts().upsertWorkflow.run({
      id,
      name: data.name ?? null,
      description: data.description ?? null,
      color: data.color ?? null,
      state: data.state != null ? (typeof data.state === 'string' ? data.state : JSON.stringify(data.state)) : null,
      is_deployed: data.is_deployed != null ? (data.is_deployed ? 1 : 0) : null,
      variables: data.variables != null ? JSON.stringify(data.variables) : null,
    });
  },

  getWorkflow(id: string): WorkflowRow | undefined {
    return stmts().getWorkflow.get(id) as WorkflowRow | undefined;
  },

  listWorkflows(limit = 50, offset = 0): WorkflowRow[] {
    return stmts().listWorkflows.all(limit, offset) as WorkflowRow[];
  },

  deleteWorkflow(id: string) {
    stmts().deleteWorkflow.run(id);
  },

  createExecution(id: string, workflowId: string, trigger = 'manual') {
    stmts().insertExecution.run({ id, workflowId, trigger });
    stmts().incrementRunCount.run(workflowId);
  },

  updateExecution(id: string, data: { status?: string; result?: any; error?: string; durationMs?: number; completedAt?: string }) {
    stmts().updateExecution.run({
      id,
      status: data.status ?? null,
      result: data.result != null ? JSON.stringify(data.result) : null,
      error: data.error ?? null,
      durationMs: data.durationMs ?? null,
      completedAt: data.completedAt ?? null,
    });
  },

  getExecution(id: string): ExecutionRow | undefined {
    return stmts().getExecution.get(id) as ExecutionRow | undefined;
  },

  listExecutions(workflowId: string, limit = 50, offset = 0): ExecutionRow[] {
    return stmts().listExecutions.all(workflowId, limit, offset) as ExecutionRow[];
  },
};
