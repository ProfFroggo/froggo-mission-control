// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

const DEFAULT_ITEMS: { label: string; category: string }[] = [
  { label: 'Brief approved',          category: 'planning'  },
  { label: 'Budget confirmed',        category: 'planning'  },
  { label: 'Assets ready',            category: 'creative'  },
  { label: 'Copy reviewed',           category: 'creative'  },
  { label: 'Legal approved',          category: 'compliance'},
  { label: 'Tracking set up',         category: 'technical' },
  { label: 'Launch window confirmed', category: 'planning'  },
  { label: 'Rollback plan ready',     category: 'technical' },
];

// POST /api/campaigns/:id/checklist/reset — regenerate default checklist
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    db.prepare('DELETE FROM campaign_checklist WHERE campaignId = ?').run(id);

    const insert = db.prepare(
      'INSERT INTO campaign_checklist (id, campaignId, label, checked, category, position) VALUES (?, ?, ?, 0, ?, ?)'
    );
    DEFAULT_ITEMS.forEach((item, idx) => {
      insert.run(randomUUID(), id, item.label, item.category, idx);
    });

    const items = db.prepare(
      'SELECT * FROM campaign_checklist WHERE campaignId = ? ORDER BY position ASC'
    ).all(id) as Array<{ checked: number; [key: string]: unknown }>;

    return NextResponse.json({
      success: true,
      items: items.map(i => ({ ...i, checked: i.checked === 1 })),
    });
  } catch (error) {
    console.error('POST /api/campaigns/:id/checklist/reset error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
