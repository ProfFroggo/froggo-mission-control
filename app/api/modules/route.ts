import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT module_id, enabled, last_toggled FROM module_state').all() as {
      module_id: string;
      enabled: number;
      last_toggled: number | null;
    }[];
    return NextResponse.json(rows.map(r => ({ id: r.module_id, enabled: r.enabled === 1, lastToggled: r.last_toggled })));
  } catch {
    return NextResponse.json([]);
  }
}
