import Database from 'better-sqlite3'
import fs from 'fs'
import os from 'os'
import path from 'path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkflowRow {
  id: string
  name: string
  description: string
  color: string
  state: string // JSON string — parse with JSON.parse()
  is_deployed: number // 0 | 1
  run_count: number
  variables: string // JSON string
  created_at: string
  updated_at: string
}

export interface ExecutionRow {
  id: string
  workflow_id: string
  trigger: string
  status: string
  result: string // JSON string
  error: string | null
  duration_ms: number
  started_at: string
  completed_at: string | null
}

export interface CredentialRow {
  id: string
  name: string
  provider: string
  value: string
  created_at: string
  updated_at: string
}

export interface EnvironmentRow {
  id: string
  key: string
  value: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Lazy-initialised singleton — avoids SQLITE_BUSY during Next.js build
// ---------------------------------------------------------------------------

let _db: InstanceType<typeof Database> | null = null
let _stmts: ReturnType<typeof prepareStatements> | null = null

function isBuildTime(): boolean {
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.argv.some((a) => a.includes('next') && process.argv.includes('build'))
  )
}

function getDb(): InstanceType<typeof Database> {
  if (_db) return _db

  const dbPath =
    process.env.WS_DATABASE_PATH ||
    path.join(os.homedir(), 'mission-control/data/workflow-studio.db')

  const dir = path.dirname(dbPath)
  fs.mkdirSync(dir, { recursive: true })

  _db = new Database(dbPath)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')

  // Create tables
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

    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS environment (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)

  return _db
}

function prepareStatements(db: InstanceType<typeof Database>) {
  return {
    upsertWorkflow: db.prepare(`
      INSERT INTO workflows (id, name, description, color, state, is_deployed, variables, updated_at)
      VALUES (@id, @name, @description, @color, @state, @is_deployed, @variables, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name        = COALESCE(@name, workflows.name),
        description = COALESCE(@description, workflows.description),
        color       = COALESCE(@color, workflows.color),
        state       = COALESCE(@state, workflows.state),
        is_deployed = COALESCE(@is_deployed, workflows.is_deployed),
        variables   = COALESCE(@variables, workflows.variables),
        updated_at  = datetime('now')
    `),
    getWorkflow: db.prepare('SELECT * FROM workflows WHERE id = ?'),
    listWorkflows: db.prepare('SELECT * FROM workflows ORDER BY updated_at DESC LIMIT ? OFFSET ?'),
    listWorkflowsDeployed: db.prepare(
      'SELECT * FROM workflows WHERE is_deployed = 1 ORDER BY updated_at DESC LIMIT ? OFFSET ?'
    ),
    deleteWorkflow: db.prepare('DELETE FROM workflows WHERE id = ?'),
    incrementRunCount: db.prepare('UPDATE workflows SET run_count = run_count + 1 WHERE id = ?'),

    insertExecution: db.prepare(`
      INSERT INTO execution_logs (id, workflow_id, trigger)
      VALUES (@id, @workflowId, @trigger)
    `),
    updateExecution: db.prepare(`
      UPDATE execution_logs SET
        status       = COALESCE(@status, status),
        result       = COALESCE(@result, result),
        error        = COALESCE(@error, error),
        duration_ms  = COALESCE(@durationMs, duration_ms),
        completed_at = COALESCE(@completedAt, completed_at)
      WHERE id = @id
    `),
    getExecution: db.prepare('SELECT * FROM execution_logs WHERE id = ?'),
    listExecutions: db.prepare(
      'SELECT * FROM execution_logs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?'
    ),

    upsertCredential: db.prepare(`
      INSERT INTO credentials (id, name, provider, value, updated_at)
      VALUES (@id, @name, @provider, @value, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name       = @name,
        provider   = @provider,
        value      = @value,
        updated_at = datetime('now')
    `),
    getCredential: db.prepare('SELECT * FROM credentials WHERE id = ?'),
    listCredentials: db.prepare('SELECT * FROM credentials ORDER BY created_at DESC'),
    deleteCredential: db.prepare('DELETE FROM credentials WHERE id = ?'),

    upsertEnv: db.prepare(`
      INSERT INTO environment (id, key, value)
      VALUES (@id, @key, @value)
      ON CONFLICT(key) DO UPDATE SET value = @value
    `),
    getEnv: db.prepare('SELECT value FROM environment WHERE key = ?'),
    listEnv: db.prepare('SELECT key, value FROM environment ORDER BY key'),
    deleteEnv: db.prepare('DELETE FROM environment WHERE key = ?'),
  }
}

function stmts() {
  if (_stmts) return _stmts
  const db = getDb()
  _stmts = prepareStatements(db)
  return _stmts
}

// ---------------------------------------------------------------------------
// Build-time no-op guard — every method returns harmless defaults
// ---------------------------------------------------------------------------

const noop = {
  saveWorkflow() {},
  getWorkflow() { return undefined },
  listWorkflows() { return [] },
  deleteWorkflow() {},
  createExecution() {},
  updateExecution() {},
  getExecution() { return undefined },
  listExecutions() { return [] },
  saveCredential() {},
  getCredential() { return undefined },
  listCredentials() { return [] },
  deleteCredential() {},
  setEnv() {},
  getEnv() { return undefined },
  listEnv() { return [] },
  deleteEnv() {},
  get raw(): any { return null },
} as unknown as typeof _sqliteDb

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const _sqliteDb = {
  // -- Workflows ------------------------------------------------------------

  saveWorkflow(
    id: string,
    data: {
      name?: string
      description?: string
      color?: string
      state?: any
      variables?: any
      is_deployed?: boolean
    }
  ): void {
    stmts().upsertWorkflow.run({
      id,
      name: data.name ?? 'Untitled Workflow',
      description: data.description ?? '',
      color: data.color ?? '#7c3aed',
      state: data.state != null ? JSON.stringify(data.state) : '{}',
      is_deployed: data.is_deployed ? 1 : 0,
      variables: data.variables != null ? JSON.stringify(data.variables) : '{}',
    })
  },

  getWorkflow(id: string): WorkflowRow | undefined {
    return stmts().getWorkflow.get(id) as WorkflowRow | undefined
  },

  listWorkflows(opts?: { deployedOnly?: boolean; limit?: number; offset?: number }): WorkflowRow[] {
    const limit = opts?.limit ?? 50
    const offset = opts?.offset ?? 0
    if (opts?.deployedOnly) {
      return stmts().listWorkflowsDeployed.all(limit, offset) as WorkflowRow[]
    }
    return stmts().listWorkflows.all(limit, offset) as WorkflowRow[]
  },

  deleteWorkflow(id: string): void {
    stmts().deleteWorkflow.run(id)
  },

  // -- Execution logs -------------------------------------------------------

  createExecution(data: { id: string; workflowId: string; trigger?: string }): void {
    stmts().insertExecution.run({
      id: data.id,
      workflowId: data.workflowId,
      trigger: data.trigger ?? 'manual',
    })
    stmts().incrementRunCount.run(data.workflowId)
  },

  updateExecution(
    id: string,
    data: {
      status?: string
      result?: any
      error?: string
      durationMs?: number
      completedAt?: string
    }
  ): void {
    stmts().updateExecution.run({
      id,
      status: data.status ?? null,
      result: data.result != null ? JSON.stringify(data.result) : null,
      error: data.error ?? null,
      durationMs: data.durationMs ?? null,
      completedAt: data.completedAt ?? null,
    })
  },

  getExecution(id: string): ExecutionRow | undefined {
    return stmts().getExecution.get(id) as ExecutionRow | undefined
  },

  listExecutions(
    workflowId: string,
    opts?: { limit?: number; offset?: number }
  ): ExecutionRow[] {
    const limit = opts?.limit ?? 50
    const offset = opts?.offset ?? 0
    return stmts().listExecutions.all(workflowId, limit, offset) as ExecutionRow[]
  },

  // -- Credentials ----------------------------------------------------------

  saveCredential(id: string, data: { name: string; provider: string; value: string }): void {
    stmts().upsertCredential.run({ id, name: data.name, provider: data.provider, value: data.value })
  },

  getCredential(id: string): CredentialRow | undefined {
    return stmts().getCredential.get(id) as CredentialRow | undefined
  },

  listCredentials(): CredentialRow[] {
    return stmts().listCredentials.all() as CredentialRow[]
  },

  deleteCredential(id: string): void {
    stmts().deleteCredential.run(id)
  },

  // -- Environment ----------------------------------------------------------

  setEnv(key: string, value: string): void {
    stmts().upsertEnv.run({ id: key, key, value })
  },

  getEnv(key: string): string | undefined {
    const row = stmts().getEnv.get(key) as { value: string } | undefined
    return row?.value
  },

  listEnv(): { key: string; value: string }[] {
    return stmts().listEnv.all() as { key: string; value: string }[]
  },

  deleteEnv(key: string): void {
    stmts().deleteEnv.run(key)
  },

  // -- Raw access -----------------------------------------------------------

  get raw(): InstanceType<typeof Database> {
    return getDb()
  },
}

export const sqliteDb: typeof _sqliteDb = isBuildTime() ? noop : _sqliteDb
