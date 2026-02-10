/**
 * Phase 08 Performance Benchmark
 * Measures better-sqlite3 query times for common IPC handler operations.
 * Run: npx ts-node --project tsconfig.electron.json electron/benchmark.ts
 */
import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

const dbPath = path.join(os.homedir(), 'clawd/data/froggo.db');

// --- Benchmark helpers ---
function timeMs(fn: () => any): { result: any; ms: number } {
  const start = performance.now();
  const result = fn();
  const ms = performance.now() - start;
  return { result, ms };
}

function timeMsAvg(fn: () => any, iterations: number = 100): { avgMs: number; minMs: number; maxMs: number } {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  return {
    avgMs: times.reduce((a, b) => a + b, 0) / times.length,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
  };
}

function timeCli(sql: string): number {
  const start = performance.now();
  try {
    execSync(`sqlite3 "${dbPath}" "${sql}" -json`, { timeout: 10000 });
  } catch {}
  return performance.now() - start;
}

function timeCliAvg(sql: string, iterations: number = 10): { avgMs: number; minMs: number; maxMs: number } {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    times.push(timeCli(sql));
  }
  return {
    avgMs: times.reduce((a, b) => a + b, 0) / times.length,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
  };
}

// --- Run benchmarks ---
console.log('=== Phase 08 Performance Benchmark ===\n');
console.log(`Database: ${dbPath}\n`);

const db = new Database(dbPath, { fileMustExist: true });
db.pragma('journal_mode = WAL');

const queries = [
  {
    name: 'List active tasks',
    sql: "SELECT id, title, status, assigned_to, project, priority FROM tasks WHERE status != 'done' AND (cancelled IS NULL OR cancelled = 0) ORDER BY created_at DESC LIMIT 50",
  },
  {
    name: 'Agent registry',
    sql: "SELECT id, name, role, description, color, image_path, status, trust_tier FROM agent_registry WHERE status = 'active' ORDER BY name",
  },
  {
    name: 'Recent task activity',
    sql: `SELECT ta.id, ta.task_id, ta.action, ta.message, ta.agent_id, ta.timestamp, t.title as task_title, t.status FROM task_activity ta LEFT JOIN tasks t ON t.id = ta.task_id WHERE ta.timestamp > ${Date.now() - 86400000 * 2} ORDER BY ta.timestamp DESC LIMIT 30`,
  },
  {
    name: 'Inbox list',
    sql: "SELECT * FROM inbox WHERE status = 'pending' ORDER BY created DESC LIMIT 50",
  },
  {
    name: 'Subtasks for task',
    sql: "SELECT * FROM subtasks ORDER BY position LIMIT 20",
  },
  {
    name: 'Unread messages',
    sql: "SELECT id, platform, external_id, sender, sender_name, preview, timestamp, is_urgent, is_read FROM comms_cache WHERE is_read = 0 ORDER BY timestamp DESC LIMIT 50",
  },
];

console.log('--- better-sqlite3 (in-process) ---');
const betterResults: Record<string, any> = {};
for (const q of queries) {
  const stmt = db.prepare(q.sql);
  // Warm up
  stmt.all();
  const result = timeMsAvg(() => stmt.all(), 100);
  betterResults[q.name] = result;
  console.log(`  ${q.name}: avg=${result.avgMs.toFixed(3)}ms  min=${result.minMs.toFixed(3)}ms  max=${result.maxMs.toFixed(3)}ms`);
}

console.log('\n--- sqlite3 CLI (child_process spawn) ---');
const cliResults: Record<string, any> = {};
for (const q of queries) {
  const result = timeCliAvg(q.sql, 10); // Fewer iterations (slow)
  cliResults[q.name] = result;
  console.log(`  ${q.name}: avg=${result.avgMs.toFixed(1)}ms  min=${result.minMs.toFixed(1)}ms  max=${result.maxMs.toFixed(1)}ms`);
}

console.log('\n--- Speedup ---');
for (const q of queries) {
  const speedup = cliResults[q.name].avgMs / betterResults[q.name].avgMs;
  console.log(`  ${q.name}: ${speedup.toFixed(0)}x faster`);
}

// Output JSON for report generation
const report = {
  timestamp: new Date().toISOString(),
  database: dbPath,
  queries: queries.map(q => ({
    name: q.name,
    betterSqlite3: betterResults[q.name],
    sqliteCli: cliResults[q.name],
    speedup: cliResults[q.name].avgMs / betterResults[q.name].avgMs,
  })),
};
console.log('\n--- JSON Report ---');
console.log(JSON.stringify(report, null, 2));

db.close();
