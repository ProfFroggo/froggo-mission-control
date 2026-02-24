/**
 * Database Migrations Module
 *
 * All CREATE TABLE / ALTER TABLE SQL extracted from main.ts app.whenReady().
 * Called once at startup via runMigrations(db).
 */

import type Database from 'better-sqlite3';
import { safeLog } from './logger';

export function runMigrations(db: Database.Database): void {
  // ── X/Twitter schema migrations (idempotent) ──
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS x_mentions (
      id TEXT PRIMARY KEY,
      tweet_id TEXT,
      author_id TEXT,
      author_username TEXT NOT NULL,
      author_name TEXT,
      text TEXT,
      created_at INTEGER,
      conversation_id TEXT,
      in_reply_to_user_id TEXT,
      reply_status TEXT DEFAULT 'pending',
      replied_at INTEGER,
      replied_with_id TEXT,
      fetched_at INTEGER NOT NULL,
      updated_at INTEGER,
      metadata TEXT
    )`);

    const mentionColumns: [string, string][] = [
      ['tweet_id', 'TEXT'], ['author_id', 'TEXT'], ['author_name', 'TEXT'], ['text', 'TEXT'],
      ['created_at', 'INTEGER'], ['conversation_id', 'TEXT'], ['in_reply_to_user_id', 'TEXT'],
      ['reply_status', "TEXT DEFAULT 'pending'"], ['replied_at', 'INTEGER'], ['replied_with_id', 'TEXT'], ['updated_at', 'INTEGER'],
    ];
    for (const [col, type] of mentionColumns) {
      try { db.exec(`ALTER TABLE x_mentions ADD COLUMN ${col} ${type}`); } catch (_e) { /* column exists */ }
    }

    // Fix x_drafts CHECK constraint: add 'posted' to allowed statuses
    const draftsInfo = db.pragma('table_info(x_drafts)') as { name: string }[];
    if (draftsInfo.length > 0) {
      try {
        db.exec(`
          CREATE TABLE IF NOT EXISTS x_drafts_new (
            id TEXT PRIMARY KEY, plan_id TEXT, version TEXT NOT NULL, content TEXT NOT NULL,
            media_paths TEXT, proposed_by TEXT NOT NULL, approved_by TEXT,
            status TEXT NOT NULL DEFAULT 'draft', created_at INTEGER NOT NULL, updated_at INTEGER,
            file_path TEXT, metadata TEXT,
            FOREIGN KEY(plan_id) REFERENCES x_content_plans(id),
            CHECK(status IN ('draft', 'approved', 'rejected', 'scheduled', 'posted'))
          );
          INSERT OR IGNORE INTO x_drafts_new SELECT * FROM x_drafts;
          DROP TABLE x_drafts;
          ALTER TABLE x_drafts_new RENAME TO x_drafts;
          CREATE INDEX IF NOT EXISTS idx_drafts_status ON x_drafts(status);
          CREATE INDEX IF NOT EXISTS idx_drafts_plan ON x_drafts(plan_id);
          CREATE INDEX IF NOT EXISTS idx_drafts_version ON x_drafts(plan_id, version);
          CREATE INDEX IF NOT EXISTS idx_drafts_created ON x_drafts(created_at DESC);
        `);
        safeLog.log('[Migration] x_drafts CHECK constraint updated to include posted');
      } catch (e: any) { safeLog.log('[Migration] x_drafts migration skipped:', e.message); }
    }

    // ── X Automations tables ──
    db.exec(`CREATE TABLE IF NOT EXISTS x_automations (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
      enabled INTEGER DEFAULT 1, trigger_type TEXT NOT NULL, trigger_config TEXT DEFAULT '{}',
      conditions TEXT DEFAULT '[]', actions TEXT DEFAULT '[]',
      max_executions_per_hour INTEGER DEFAULT 10, max_executions_per_day INTEGER DEFAULT 50,
      total_executions INTEGER DEFAULT 0, last_executed_at INTEGER,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, created_by TEXT DEFAULT 'user'
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS x_automation_executions (
      id TEXT PRIMARY KEY, automation_id TEXT NOT NULL, trigger_data TEXT DEFAULT '{}',
      actions_executed TEXT DEFAULT '[]', status TEXT DEFAULT 'success',
      error_message TEXT, executed_at INTEGER NOT NULL
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS x_automation_rate_limits (
      automation_id TEXT NOT NULL, hour_bucket TEXT NOT NULL,
      execution_count INTEGER DEFAULT 0, PRIMARY KEY (automation_id, hour_bucket)
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS scheduled_posts (
      id TEXT PRIMARY KEY, content TEXT NOT NULL, scheduled_time INTEGER NOT NULL,
      status TEXT DEFAULT 'pending', created_at INTEGER NOT NULL, posted_at INTEGER, error TEXT
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS x_campaigns (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, subject TEXT DEFAULT '',
      stages TEXT DEFAULT '[]', status TEXT DEFAULT 'draft',
      start_date TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`);

    safeLog.log('[Migration] X Automations + Campaigns tables ensured');
    safeLog.log('[Migration] X/Twitter schema migrations complete');
  } catch (err) {
    safeLog.error('[Migration] X/Twitter schema migration error:', err);
  }

  // Module Builder specs table
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS module_specs (
      id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'in-progress', spec TEXT NOT NULL DEFAULT '{}',
      conversation TEXT NOT NULL DEFAULT '[]', conversation_state TEXT NOT NULL DEFAULT '{}',
      overall_progress INTEGER DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      CHECK(status IN ('in-progress', 'finished', 'archived'))
    )`);
    safeLog.log('[Migration] module_specs table ensured');
  } catch (err) {
    safeLog.error('[Migration] module_specs migration error:', err);
  }

  // Library schema migration: add project column + migrate old categories
  try { db.exec('ALTER TABLE library ADD COLUMN project TEXT'); } catch (_e) { /* column already exists */ }
  try {
    db.prepare("UPDATE library SET category = 'marketing' WHERE category = 'strategy'").run();
    db.prepare("UPDATE library SET category = 'test-logs' WHERE category = 'test'").run();
    db.prepare("UPDATE library SET category = 'content' WHERE category IN ('draft', 'document')").run();
  } catch (_e) { /* migration already ran or no rows to update */ }

  // Index for faster message queries
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_messages_session_channel ON messages(session_key, channel)'); } catch (_e) { /* table may not exist yet */ }

  // Module integrations table (wizard state for Phase 36)
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS module_integrations (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      wizard_step INTEGER DEFAULT 0,
      wizard_data TEXT DEFAULT '{}',
      completed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK(status IN ('pending', 'active', 'failed'))
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_module_integrations_module_id ON module_integrations(module_id)');
    safeLog.log('[Migration] module_integrations table ensured');
  } catch (err) {
    safeLog.error('[Migration] module_integrations migration error:', err);
  }

  // Installed modules table (marketplace install tracking — Phase 40)
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS installed_modules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      installed_version TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      installed_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'marketplace',
      sha256 TEXT,
      registry_url TEXT
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_installed_modules_enabled ON installed_modules(enabled)');
    safeLog.log('[Migration] installed_modules table ensured');
  } catch (err) {
    safeLog.error('[Migration] installed_modules migration error:', err);
  }
}
