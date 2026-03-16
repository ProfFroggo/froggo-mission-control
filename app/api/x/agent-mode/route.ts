// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET/PATCH /api/x/agent-mode — read/write agent mode settings from the settings table
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const runtime = 'nodejs';

const KEYS = {
  enabled: 'x.agentMode',
  brief: 'x.agentBrief',
  autoApprove: 'x.autoApprove',
} as const;

function readSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

function parseBool(raw: string | null, fallback: boolean): boolean {
  if (raw === null) return fallback;
  try {
    return Boolean(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

function parseStr(raw: string | null, fallback: string): string {
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : fallback;
  } catch {
    return raw;
  }
}

// GET /api/x/agent-mode
export async function GET() {
  try {
    const enabled = parseBool(readSetting(KEYS.enabled), false);
    const brief = parseStr(readSetting(KEYS.brief), '');
    const autoApprove = parseBool(readSetting(KEYS.autoApprove), false);
    return NextResponse.json({ enabled, brief, autoApprove });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/x/agent-mode — accepts { enabled?, brief?, autoApprove? }
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDb();
    const now = Date.now();
    const upsert = db.prepare(
      `INSERT INTO settings (key, value, updatedAt)
       VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`
    );

    const apply = db.transaction(() => {
      if ('enabled' in body) upsert.run(KEYS.enabled, JSON.stringify(Boolean(body.enabled)), now);
      if ('brief' in body) upsert.run(KEYS.brief, JSON.stringify(String(body.brief ?? '')), now);
      if ('autoApprove' in body) upsert.run(KEYS.autoApprove, JSON.stringify(Boolean(body.autoApprove)), now);
    });
    apply();

    const enabled = parseBool(readSetting(KEYS.enabled), false);
    const brief = parseStr(readSetting(KEYS.brief), '');
    const autoApprove = parseBool(readSetting(KEYS.autoApprove), false);
    return NextResponse.json({ enabled, brief, autoApprove });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
