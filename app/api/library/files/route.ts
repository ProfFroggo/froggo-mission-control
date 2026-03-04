import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET() {
  const db = getDb();
  try {
    const files = db.prepare('SELECT * FROM library_files ORDER BY createdAt DESC').all();
    return NextResponse.json(files);
  } catch {
    return NextResponse.json([]);
  }
}
