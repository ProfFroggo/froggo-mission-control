// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function POST() {
  const db = getDb();
  db.prepare("UPDATE inbox SET isRead = 1 WHERE isRead = 0").run();
  return NextResponse.json({ success: true });
}
