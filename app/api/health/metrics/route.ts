// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/health/metrics — detailed platform health metrics with circular history buffer
// GET /api/health/history — last 60 snapshots for sparklines

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { sseEmitter } from '@/lib/sseEmitter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export interface HealthSnapshot {
  database: {
    status: 'ok' | 'error';
    queryTimeMs: number;
    size: string;
  };
  api: {
    uptime: number;
    requestsLastHour: number;
    errorsLastHour: number;
    avgResponseMs: number;
  };
  agents: {
    total: number;
    active: number;
    idle: number;
    error: number;
  };
  tasks: {
    total: number;
    completedToday: number;
    failedToday: number;
    avgDurationMs: number;
  };
  memory: {
    heapUsedMb: number;
    heapTotalMb: number;
    rss: number;
  };
  sse: {
    connected: boolean;
    clientCount: number;
  };
  timestamp: number;
}

// ── Circular buffer — max 60 snapshots ────────────────────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var __healthMetricsHistory: HealthSnapshot[];
}

const MAX_HISTORY = 60;

function getHistory(): HealthSnapshot[] {
  if (!globalThis.__healthMetricsHistory) {
    globalThis.__healthMetricsHistory = [];
  }
  return globalThis.__healthMetricsHistory;
}

function pushSnapshot(snap: HealthSnapshot): void {
  const history = getHistory();
  history.push(snap);
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
}

// ── Simple in-process request counter ─────────────────────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var __healthRequestCounter: { requests: number; errors: number; totalMs: number; windowStart: number };
}

function getCounter() {
  if (!globalThis.__healthRequestCounter) {
    globalThis.__healthRequestCounter = { requests: 0, errors: 0, totalMs: 0, windowStart: Date.now() };
  }
  return globalThis.__healthRequestCounter;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDbSize(): string {
  try {
    const db = getDb();
    const row = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get() as { size: number } | undefined;
    return formatBytes(row?.size ?? 0);
  } catch {
    return 'unknown';
  }
}

function measureDbQuery(): { status: 'ok' | 'error'; queryTimeMs: number; size: string } {
  const start = performance.now();
  try {
    const db = getDb();
    db.prepare('SELECT 1').get();
    const queryTimeMs = Math.round((performance.now() - start) * 10) / 10;
    return { status: 'ok', queryTimeMs, size: getDbSize() };
  } catch {
    return { status: 'error', queryTimeMs: -1, size: 'unknown' };
  }
}

function getAgentStats(): { total: number; active: number; idle: number; error: number } {
  try {
    const db = getDb();
    const total = (db.prepare('SELECT COUNT(*) as cnt FROM agents').get() as { cnt: number })?.cnt ?? 0;
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const active = (db.prepare(
      "SELECT COUNT(*) as cnt FROM agents WHERE lastActivity > ? AND status != 'error'"
    ).get(fiveMinAgo) as { cnt: number })?.cnt ?? 0;
    const errorCount = (db.prepare(
      "SELECT COUNT(*) as cnt FROM agents WHERE status = 'error'"
    ).get() as { cnt: number })?.cnt ?? 0;
    const idle = Math.max(0, total - active - errorCount);
    return { total, active, idle, error: errorCount };
  } catch {
    return { total: 0, active: 0, idle: 0, error: 0 };
  }
}

function getTaskStats(): { total: number; completedToday: number; failedToday: number; avgDurationMs: number } {
  try {
    const db = getDb();
    const total = (db.prepare('SELECT COUNT(*) as cnt FROM tasks').get() as { cnt: number })?.cnt ?? 0;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const dayStartMs = startOfDay.getTime();

    const completedToday = (db.prepare(
      "SELECT COUNT(*) as cnt FROM tasks WHERE status = 'done' AND updatedAt >= ?"
    ).get(dayStartMs) as { cnt: number })?.cnt ?? 0;

    const failedToday = (db.prepare(
      "SELECT COUNT(*) as cnt FROM tasks WHERE status = 'failed' AND updatedAt >= ?"
    ).get(dayStartMs) as { cnt: number })?.cnt ?? 0;

    // Avg duration for tasks completed today with a completedAt timestamp
    const avgRow = db.prepare(
      "SELECT AVG(completedAt - createdAt) as avg FROM tasks WHERE status = 'done' AND completedAt IS NOT NULL AND completedAt >= ?"
    ).get(dayStartMs) as { avg: number | null } | undefined;
    const avgDurationMs = Math.round(avgRow?.avg ?? 0);

    return { total, completedToday, failedToday, avgDurationMs };
  } catch {
    return { total: 0, completedToday: 0, failedToday: 0, avgDurationMs: 0 };
  }
}

function getSseClientCount(): { connected: boolean; clientCount: number } {
  try {
    // sseEmitter is an EventEmitter — count listeners on the 'event' channel
    const clientCount = sseEmitter.listenerCount('event');
    return { connected: clientCount > 0, clientCount };
  } catch {
    return { connected: false, clientCount: 0 };
  }
}

function getApiStats() {
  const counter = getCounter();
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;

  // Reset if window has passed an hour
  if (now - counter.windowStart > hourMs) {
    counter.requests = 0;
    counter.errors = 0;
    counter.totalMs = 0;
    counter.windowStart = now;
  }

  // Count this request
  counter.requests += 1;

  const avgResponseMs = counter.requests > 0
    ? Math.round(counter.totalMs / counter.requests)
    : 0;

  return {
    uptime: process.uptime(),
    requestsLastHour: counter.requests,
    errorsLastHour: counter.errors,
    avgResponseMs,
  };
}

function getMemoryStats() {
  const mem = process.memoryUsage();
  const mb = (bytes: number) => Math.round((bytes / (1024 * 1024)) * 10) / 10;
  return {
    heapUsedMb: mb(mem.heapUsed),
    heapTotalMb: mb(mem.heapTotal),
    rss: mb(mem.rss),
  };
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const reqStart = performance.now();

  const [database, agents, tasks, sse, memory, api] = await Promise.all([
    Promise.resolve(measureDbQuery()),
    Promise.resolve(getAgentStats()),
    Promise.resolve(getTaskStats()),
    Promise.resolve(getSseClientCount()),
    Promise.resolve(getMemoryStats()),
    Promise.resolve(getApiStats()),
  ]);

  // Track response time for this request
  const reqMs = performance.now() - reqStart;
  getCounter().totalMs += reqMs;

  const snapshot: HealthSnapshot = {
    database,
    api,
    agents,
    tasks,
    memory,
    sse,
    timestamp: Date.now(),
  };

  pushSnapshot(snapshot);

  return NextResponse.json(snapshot, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
