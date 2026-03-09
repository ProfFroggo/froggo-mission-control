// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET() {
  try {
    const accounts = getDb()
      .prepare('SELECT * FROM finance_accounts ORDER BY createdAt DESC')
      .all() as Record<string, unknown>[];
    return NextResponse.json(accounts);
  } catch (error) {
    console.error('GET /api/finance/accounts error:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, type, balance, currency, institution, notes } = await request.json();
    if (!name || typeof name !== 'string' || name.length > 200) {
      return NextResponse.json({ error: 'name is required (max 200 chars)' }, { status: 400 });
    }
    const validTypes = ['checking', 'savings', 'credit', 'investment', 'crypto', 'other'];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }
    const id = crypto.randomUUID();
    const now = Date.now();
    getDb().prepare(
      `INSERT INTO finance_accounts (id, name, type, balance, currency, institution, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name, type, balance ?? 0, currency ?? 'USD', institution ?? null, notes ?? null, now, now);
    const created = getDb().prepare('SELECT * FROM finance_accounts WHERE id = ?').get(id);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('POST /api/finance/accounts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    }
    const db = getDb();
    const existing = db.prepare('SELECT id FROM finance_accounts WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    const body = await request.json();
    const allowedFields = ['name', 'type', 'balance', 'currency', 'institution', 'notes'] as const;
    const setClauses: string[] = [];
    const values: unknown[] = [];
    for (const field of allowedFields) {
      if (field in body) {
        setClauses.push(`${field} = ?`);
        values.push(body[field]);
      }
    }
    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }
    setClauses.push('updatedAt = ?');
    values.push(Date.now());
    values.push(id);
    db.prepare(`UPDATE finance_accounts SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    const updated = db.prepare('SELECT * FROM finance_accounts WHERE id = ?').get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/finance/accounts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    }
    const result = getDb().prepare('DELETE FROM finance_accounts WHERE id = ?').run(id);
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/finance/accounts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
