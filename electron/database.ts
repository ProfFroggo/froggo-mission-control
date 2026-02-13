/**
 * Shared better-sqlite3 database connections
 *
 * Provides in-process DB access with prepared statement cache.
 * Eliminates ~150ms child_process overhead per query.
 */

import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { FROGGO_DB, SCHEDULE_DB, SECURITY_DB, SESSIONS_DB, SESSIONS_DB_LEGACY } from './paths';

const FROGGO_DB_PATH = FROGGO_DB;
const SCHEDULE_DB_PATH = SCHEDULE_DB;

// Main database connection (froggo.db)
export const db = new Database(FROGGO_DB_PATH, { fileMustExist: true });

// Enable WAL mode for concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('wal_autocheckpoint = 1000');

// Prepared statement cache
const statementCache = new Map<string, Database.Statement>();

/**
 * Get or create a prepared statement
 * @param sql SQL query string
 * @returns Prepared statement from cache or newly compiled
 */
export function prepare(sql: string): Database.Statement {
  if (!statementCache.has(sql)) {
    statementCache.set(sql, db.prepare(sql));
  }
  return statementCache.get(sql)!;
}

// Lazy schedule.db connection
let scheduleDb: Database.Database | null = null;

/**
 * Get the schedule database connection (lazy initialization)
 * @returns Schedule database instance
 */
export function getScheduleDb(): Database.Database {
  if (!scheduleDb) {
    scheduleDb = new Database(SCHEDULE_DB_PATH, { fileMustExist: true });
    scheduleDb.pragma('journal_mode = WAL');
    scheduleDb.pragma('wal_autocheckpoint = 1000');
  }
  return scheduleDb;
}

// Lazy security.db connection
let securityDb: Database.Database | null = null;
const SECURITY_DB_PATH = SECURITY_DB;

/**
 * Get the security database connection (lazy initialization).
 * Creates the DB file if it does not exist.
 */
export function getSecurityDb(): Database.Database {
  if (!securityDb) {
    securityDb = new Database(SECURITY_DB_PATH);
    securityDb.pragma('journal_mode = WAL');
    securityDb.pragma('wal_autocheckpoint = 1000');
  }
  return securityDb;
}

// Lazy sessions.db connection (gateway session tracking, readonly)
let sessionsDb: Database.Database | null = null;
const SESSIONS_DB_PATH = SESSIONS_DB;
const SESSIONS_DB_PATH_LEGACY = SESSIONS_DB_LEGACY;

/**
 * Get the sessions database connection (lazy initialization).
 * Readonly -- dashboard only reads session data.
 * Returns null if sessions.db does not exist at either path.
 */
export function getSessionsDb(): Database.Database | null {
  if (!sessionsDb) {
    const dbPath = existsSync(SESSIONS_DB_PATH) ? SESSIONS_DB_PATH : SESSIONS_DB_PATH_LEGACY;
    if (!existsSync(dbPath)) return null;
    sessionsDb = new Database(dbPath, { readonly: true, fileMustExist: true });
    sessionsDb.pragma('journal_mode = WAL');
  }
  return sessionsDb;
}

/**
 * Close all database connections
 * Call during app shutdown
 */
export function closeDb(): void {
  // Clear statement cache
  statementCache.forEach((stmt) => {
    try {
      // better-sqlite3 statements don't have explicit close, just finalize when needed
    } catch (error) {
      console.error('[Database] Failed to cleanup statement:', error);
    }
  });
  statementCache.clear();

  // Close schedule DB if open
  if (scheduleDb) {
    try {
      scheduleDb.close();
    } catch (error) {
      console.error('[Database] Failed to close schedule.db:', error);
    }
    scheduleDb = null;
  }

  // Close security DB if open
  if (securityDb) {
    try {
      securityDb.close();
    } catch (error) {
      console.error('[Database] Failed to close security.db:', error);
    }
    securityDb = null;
  }

  // Close sessions DB if open
  if (sessionsDb) {
    try {
      sessionsDb.close();
    } catch (error) {
      console.error('[Database] Failed to close sessions.db:', error);
    }
    sessionsDb = null;
  }

  // Close main DB
  try {
    db.close();
  } catch (error) {
    console.error('[Database] Failed to close froggo.db:', error);
  }
}
