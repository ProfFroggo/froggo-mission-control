import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function POST() {
  const db = getDb();
  db.prepare("UPDATE inbox SET isRead = 1 WHERE isRead = 0").run();
  return NextResponse.json({ success: true });
}
