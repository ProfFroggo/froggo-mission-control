/**
 * Shared better-sqlite3 database connections
 *
 * Provides in-process DB access with prepared statement cache.
 * Eliminates ~150ms child_process overhead per query.
 */

import Database from 'better-sqlite3';
import { homedir } from 'os';
import { join } from 'path';

const FROGGO_DB_PATH = join(homedir(), 'clawd', 'data', 'froggo.db');
const SCHEDULE_DB_PATH = join(homedir(), 'clawd', 'data', 'schedule.db');

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
const SECURITY_DB_PATH = join(homedir(), 'clawd', 'data', 'security.db');

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

  // Close main DB
  try {
    db.close();
  } catch (error) {
    console.error('[Database] Failed to close froggo.db:', error);
  }
}
