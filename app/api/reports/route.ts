// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

// GET /api/reports?type=tasks|agents|approvals|token-usage&format=csv|json&from=ISO&to=ISO
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'tasks';
  const format = searchParams.get('format') || 'json';
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  const fromMs = fromParam ? new Date(fromParam).getTime() : Date.now() - 7 * 24 * 60 * 60 * 1000;
  const toMs = toParam ? new Date(toParam).getTime() : Date.now();
  const dateStr = new Date().toISOString().split('T')[0];

  try {
    const db = getDb();

    if (type === 'tasks') {
      const rows = db.prepare(`
        SELECT
          t.id,
          t.title,
          t.status,
          t.priority,
          t.assignedTo AS agentId,
          t.createdAt,
          t.completedAt,
          CASE
            WHEN t.completedAt IS NOT NULL AND t.createdAt IS NOT NULL
            THEN (t.completedAt - t.createdAt)
            ELSE NULL
          END AS durationMs
        FROM tasks t
        WHERE t.createdAt >= ? AND t.createdAt <= ?
        ORDER BY t.createdAt DESC
      `).all(fromMs, toMs) as Array<{
        id: string; title: string; status: string; priority: string;
        agentId: string | null; createdAt: number; completedAt: number | null; durationMs: number | null;
      }>;

      if (format === 'csv') {
        const header = 'id,title,status,priority,agentId,createdAt,completedAt,duration';
        const lines = rows.map(r =>
          [
            csvEscape(r.id),
            csvEscape(r.title),
            csvEscape(r.status),
            csvEscape(r.priority),
            csvEscape(r.agentId ?? ''),
            r.createdAt ? new Date(r.createdAt).toISOString() : '',
            r.completedAt ? new Date(r.completedAt).toISOString() : '',
            r.durationMs != null ? formatDuration(r.durationMs) : '',
          ].join(',')
        );
        return csvResponse([header, ...lines].join('\n'), `tasks-report-${dateStr}.csv`);
      }
      return NextResponse.json({ type, from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString(), count: rows.length, rows });
    }

    if (type === 'agents') {
      const rows = db.prepare(`
        SELECT
          a.id,
          a.name,
          a.role,
          COUNT(t.id)                                                                          AS tasksCompleted,
          SUM(CASE WHEN t.status IN ('todo','in-progress','review','internal-review') THEN 1 ELSE 0 END) AS tasksRejected,
          ROUND(100.0 * COUNT(CASE WHEN t.status = 'done' THEN 1 END) / NULLIF(COUNT(t.id), 0), 1) AS successRate,
          ROUND(AVG(CASE WHEN t.completedAt IS NOT NULL THEN (t.completedAt - t.createdAt) END), 0) AS avgDurationMs,
          COALESCE(SUM(tu.inputTokens + tu.outputTokens), 0)                                   AS totalTokens
        FROM agents a
        LEFT JOIN tasks t ON t.assignedTo = a.id AND t.createdAt >= ? AND t.createdAt <= ?
        LEFT JOIN token_usage tu ON tu.agentId = a.id AND tu.timestamp >= ? AND tu.timestamp <= ?
        GROUP BY a.id
        ORDER BY tasksCompleted DESC
      `).all(fromMs, toMs, fromMs, toMs) as Array<{
        id: string; name: string; role: string | null;
        tasksCompleted: number; tasksRejected: number; successRate: number | null;
        avgDurationMs: number | null; totalTokens: number;
      }>;

      if (format === 'csv') {
        const header = 'id,name,role,tasksCompleted,tasksRejected,successRate,avgDurationMs,totalTokens';
        const lines = rows.map(r =>
          [
            csvEscape(r.id),
            csvEscape(r.name),
            csvEscape(r.role ?? ''),
            r.tasksCompleted,
            r.tasksRejected,
            r.successRate ?? 0,
            r.avgDurationMs ?? 0,
            r.totalTokens,
          ].join(',')
        );
        return csvResponse([header, ...lines].join('\n'), `agents-report-${dateStr}.csv`);
      }
      return NextResponse.json({ type, from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString(), count: rows.length, rows });
    }

    if (type === 'approvals') {
      const rows = db.prepare(`
        SELECT
          id,
          type,
          status,
          requester,
          createdAt,
          respondedAt,
          notes AS resolvedBy,
          CASE WHEN respondedAt IS NOT NULL THEN (respondedAt - createdAt) ELSE NULL END AS durationMs
        FROM approvals
        WHERE createdAt >= ? AND createdAt <= ?
        ORDER BY createdAt DESC
      `).all(fromMs, toMs) as Array<{
        id: string; type: string; status: string; requester: string | null;
        createdAt: number; respondedAt: number | null; resolvedBy: string | null; durationMs: number | null;
      }>;

      if (format === 'csv') {
        const header = 'id,type,status,createdAt,resolvedAt,resolvedBy,duration';
        const lines = rows.map(r =>
          [
            csvEscape(r.id),
            csvEscape(r.type),
            csvEscape(r.status),
            r.createdAt ? new Date(r.createdAt).toISOString() : '',
            r.respondedAt ? new Date(r.respondedAt).toISOString() : '',
            csvEscape(r.resolvedBy ?? ''),
            r.durationMs != null ? formatDuration(r.durationMs) : '',
          ].join(',')
        );
        return csvResponse([header, ...lines].join('\n'), `approvals-report-${dateStr}.csv`);
      }
      return NextResponse.json({ type, from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString(), count: rows.length, rows });
    }

    if (type === 'token-usage') {
      const rows = db.prepare(`
        SELECT
          strftime('%Y-%m-%d', tu.timestamp / 1000, 'unixepoch') AS date,
          tu.agentId,
          a.name AS agentName,
          SUM(tu.inputTokens)              AS inputTokens,
          SUM(tu.outputTokens)             AS outputTokens,
          ROUND(SUM(tu.costUsd), 6)        AS totalCost
        FROM token_usage tu
        LEFT JOIN agents a ON a.id = tu.agentId
        WHERE tu.timestamp >= ? AND tu.timestamp <= ?
        GROUP BY date, tu.agentId
        ORDER BY date DESC, inputTokens DESC
      `).all(fromMs, toMs) as Array<{
        date: string; agentId: string; agentName: string | null;
        inputTokens: number; outputTokens: number; totalCost: number;
      }>;

      if (format === 'csv') {
        const header = 'date,agentId,agentName,inputTokens,outputTokens,totalCost';
        const lines = rows.map(r =>
          [
            csvEscape(r.date),
            csvEscape(r.agentId),
            csvEscape(r.agentName ?? ''),
            r.inputTokens,
            r.outputTokens,
            r.totalCost,
          ].join(',')
        );
        return csvResponse([header, ...lines].join('\n'), `token-usage-report-${dateStr}.csv`);
      }
      return NextResponse.json({ type, from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString(), count: rows.length, rows });
    }

    return NextResponse.json({ error: `Unknown report type: ${type}` }, { status: 400 });
  } catch (err) {
    console.error('GET /api/reports error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// --- helpers ---

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

function csvResponse(body: string, filename: string): NextResponse {
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
