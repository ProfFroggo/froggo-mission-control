import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET() {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'accounts_list'").get() as { value: string } | undefined;
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      return NextResponse.json(Array.isArray(parsed) ? parsed : []);
    }
    return NextResponse.json([]);
  } catch (error) {
    console.error('GET /api/accounts error:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getDb();

    const row = db.prepare("SELECT value FROM settings WHERE key = 'accounts_list'").get() as { value: string } | undefined;
    let accounts: unknown[] = [];
    try { if (row?.value) accounts = JSON.parse(row.value); } catch { /* */ }

    const newAccount = { ...body, id: `acct-${Date.now()}`, createdAt: new Date().toISOString() };
    accounts.push(newAccount);

    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('accounts_list', ?)").run(JSON.stringify(accounts));
    return NextResponse.json(newAccount, { status: 201 });
  } catch (error) {
    console.error('POST /api/accounts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
