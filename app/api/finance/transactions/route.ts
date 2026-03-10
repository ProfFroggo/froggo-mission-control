// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const type      = searchParams.get('type');
    const category  = searchParams.get('category');
    const limit     = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
    const offset    = parseInt(searchParams.get('offset') ?? '0', 10);

    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (accountId) { conditions.push('accountId = ?'); params.push(accountId); }
    if (type)      { conditions.push('type = ?');      params.push(type); }
    if (category)  { conditions.push('category = ?');  params.push(category); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(
      `SELECT id, accountId, amount, type, category, description, date, recurring, tags, createdAt
       FROM finance_transactions ${where}
       ORDER BY date DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as Record<string, unknown>[];

    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET /api/finance/transactions error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { accountId, amount, type, category, description, date, recurring, tags } = await request.json();
    if (!accountId || typeof accountId !== 'string') {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }
    if (typeof amount !== 'number') {
      return NextResponse.json({ error: 'amount must be a number' }, { status: 400 });
    }
    const validTypes = ['income', 'expense', 'transfer'];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }
    const db = getDb();
    const accountExists = db.prepare('SELECT id FROM finance_accounts WHERE id = ?').get(accountId);
    if (!accountExists) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    const id = crypto.randomUUID();
    const now = Date.now();
    const resolvedDate = typeof date === 'number' ? date : now;
    const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);
    db.prepare(
      `INSERT INTO finance_transactions (id, accountId, amount, type, category, description, date, recurring, tags, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, accountId, amount, type, category ?? null, description ?? null, resolvedDate, recurring ? 1 : 0, tagsJson, now);
    const created = db.prepare('SELECT * FROM finance_transactions WHERE id = ?').get(id);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('POST /api/finance/transactions error:', error);
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
    const result = getDb().prepare('DELETE FROM finance_transactions WHERE id = ?').run(id);
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/finance/transactions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
