/**
 * Shared better-sqlite3 database connections
 *
 * Provides in-process DB access with prepared statement cache.
 * Eliminates ~150ms child_process overhead per query.
 */

import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { FROGGO_DB, SCHEDULE_DB, SECURITY_DB, SESSIONS_DB, SESSIONS_DB_LEGACY } from './paths';
import { closeAllBookDbs } from './writing-db';
import { createLogger } from './utils/logger';

const logger = createLogger('Database');

const FROGGO_DB_PATH = FROGGO_DB;
const SCHEDULE_DB_PATH = SCHEDULE_DB;

// Main database connection (froggo.db)
export const db = new Database(FROGGO_DB_PATH, { fileMustExist: true });

// Enable WAL mode for concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('wal_autocheckpoint = 1000');
db.pragma('synchronous = normal');   // Reduce fsync frequency. Safe with WAL mode.
db.pragma('cache_size = -32000');    // 32MB page cache (negative = KB). Default is 2MB.
db.pragma('temp_store = memory');    // Temp tables/indices in RAM, not disk.
db.pragma('mmap_size = 134217728'); // 128MB memory-mapped I/O. Reduces syscalls.
db.pragma('busy_timeout = 5000');   // 5s retry on lock instead of immediate SQLITE_BUSY.

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
    scheduleDb.pragma('synchronous = normal');
    scheduleDb.pragma('cache_size = -32000');
    scheduleDb.pragma('temp_store = memory');
    scheduleDb.pragma('mmap_size = 134217728');
    scheduleDb.pragma('busy_timeout = 5000');
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
    securityDb.pragma('synchronous = normal');
    securityDb.pragma('cache_size = -32000');
    securityDb.pragma('temp_store = memory');
    securityDb.pragma('mmap_size = 134217728');
    securityDb.pragma('busy_timeout = 5000');
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
    sessionsDb.pragma('cache_size = -32000');    // 32MB page cache
    sessionsDb.pragma('temp_store = memory');    // Temp tables in RAM
    sessionsDb.pragma('mmap_size = 134217728'); // 128MB memory-mapped I/O
  }
  return sessionsDb;
}

/**
 * Close all database connections
 * Call during app shutdown
 */
export function closeDb(): void {
  // Clear statement cache
  statementCache.forEach((_stmt) => {
    try {
      // better-sqlite3 statements don't have explicit close, just finalize when needed
    } catch (error) {
      logger.error('[Database] Failed to cleanup statement:', error);
    }
  });
  statementCache.clear();

  // Close schedule DB if open
  if (scheduleDb) {
    try {
      scheduleDb.close();
    } catch (error) {
      logger.error('[Database] Failed to close schedule.db:', error);
    }
    scheduleDb = null;
  }

  // Close security DB if open
  if (securityDb) {
    try {
      securityDb.close();
    } catch (error) {
      logger.error('[Database] Failed to close security.db:', error);
    }
    securityDb = null;
  }

  // Close sessions DB if open
  if (sessionsDb) {
    try {
      sessionsDb.close();
    } catch (error) {
      logger.error('[Database] Failed to close sessions.db:', error);
    }
    sessionsDb = null;
  }

  // Close all per-book writing databases
  closeAllBookDbs();

  // Close main DB
  try {
    db.close();
  } catch (error) {
    logger.error('[Database] Failed to close froggo.db:', error);
  }
}
