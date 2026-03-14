// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

interface ChecklistItem {
  id: string;
  campaignId: string;
  label: string;
  checked: number;
  category: string;
  position: number;
  createdAt: string;
}

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

function ensureTable(db: ReturnType<typeof getDb>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_checklist (
      id TEXT PRIMARY KEY,
      campaignId TEXT NOT NULL,
      label TEXT NOT NULL,
      checked INTEGER DEFAULT 0,
      category TEXT DEFAULT 'general',
      position INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_campaign_checklist_campaignId ON campaign_checklist(campaignId, position);
  `);
}

function seedDefaults(db: ReturnType<typeof getDb>, campaignId: string) {
  const insert = db.prepare(
    'INSERT INTO campaign_checklist (id, campaignId, label, checked, category, position) VALUES (?, ?, ?, 0, ?, ?)'
  );
  DEFAULT_ITEMS.forEach((item, idx) => {
    insert.run(randomUUID(), campaignId, item.label, item.category, idx);
  });
}

// GET /api/campaigns/:id/checklist
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    ensureTable(db);

    let items = db.prepare(
      'SELECT * FROM campaign_checklist WHERE campaignId = ? ORDER BY position ASC'
    ).all(id) as ChecklistItem[];

    // Auto-seed defaults on first access
    if (items.length === 0) {
      seedDefaults(db, id);
      items = db.prepare(
        'SELECT * FROM campaign_checklist WHERE campaignId = ? ORDER BY position ASC'
      ).all(id) as ChecklistItem[];
    }

    return NextResponse.json({
      success: true,
      items: items.map(i => ({ ...i, checked: i.checked === 1 })),
    });
  } catch (error) {
    console.error('GET /api/campaigns/:id/checklist error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/campaigns/:id/checklist — toggle an item
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    ensureTable(db);

    const body = await req.json().catch(() => ({}));
    const { id: itemId, checked } = body as { id?: string; checked?: boolean };

    if (!itemId || typeof checked !== 'boolean') {
      return NextResponse.json({ success: false, error: 'id and checked are required' }, { status: 400 });
    }

    const item = db.prepare(
      'SELECT * FROM campaign_checklist WHERE id = ? AND campaignId = ?'
    ).get(itemId, id);
    if (!item) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    db.prepare('UPDATE campaign_checklist SET checked = ? WHERE id = ?').run(checked ? 1 : 0, itemId);

    const updated = db.prepare('SELECT * FROM campaign_checklist WHERE id = ?').get(itemId) as ChecklistItem;
    return NextResponse.json({ success: true, item: { ...updated, checked: updated.checked === 1 } });
  } catch (error) {
    console.error('PATCH /api/campaigns/:id/checklist error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
