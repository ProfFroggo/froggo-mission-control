// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

const VALID_TRIGGER_TYPES = ['campaign-started', 'campaign-ended', 'milestone-reached'] as const;
type CampaignTriggerType = typeof VALID_TRIGGER_TYPES[number];

// GET /api/campaigns/:id/automations — list automations linked to this campaign
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    const campaign = db.prepare('SELECT id FROM campaigns WHERE id = ?').get(id);
    if (!campaign) return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });

    const links = db.prepare(`
      SELECT ca.*, a.name, a.description, a.status, a.trigger_type, a.trigger_config, a.steps, a.last_run, a.next_run
      FROM campaign_automations ca
      LEFT JOIN automations a ON a.id = ca.automationId
      WHERE ca.campaignId = ?
      ORDER BY ca.linkedAt DESC
    `).all(id) as Record<string, unknown>[];

    const automations = links.map(row => ({
      linkId: row.linkId,
      automationId: row.automationId,
      campaignTriggerType: row.campaignTriggerType,
      linkedAt: row.linkedAt,
      automation: {
        id: row.automationId,
        name: row.name,
        description: row.description,
        status: row.status,
        trigger_type: row.trigger_type,
        trigger_config: (() => { try { return JSON.parse(row.trigger_config as string); } catch { return {}; } })(),
        steps: (() => { try { return JSON.parse(row.steps as string); } catch { return []; } })(),
        lastRun: row.last_run,
        nextRun: row.next_run,
      },
    }));

    return NextResponse.json({ success: true, automations });
  } catch (error) {
    console.error('GET /api/campaigns/:id/automations error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/campaigns/:id/automations — link an automation to this campaign
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    const campaign = db.prepare('SELECT id FROM campaigns WHERE id = ?').get(id);
    if (!campaign) return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const { automationId, triggerType } = body as { automationId?: string; triggerType?: string };

    if (!automationId?.trim()) {
      return NextResponse.json({ success: false, error: 'automationId required' }, { status: 400 });
    }

    const trigger = triggerType as CampaignTriggerType;
    if (!VALID_TRIGGER_TYPES.includes(trigger)) {
      return NextResponse.json(
        { success: false, error: `triggerType must be one of: ${VALID_TRIGGER_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const automation = db.prepare('SELECT id FROM automations WHERE id = ?').get(automationId);
    if (!automation) {
      return NextResponse.json({ success: false, error: 'Automation not found' }, { status: 404 });
    }

    const now = Date.now();
    const linkId = `cal-${now}-${Math.random().toString(36).slice(2, 7)}`;

    db.prepare(`
      INSERT OR REPLACE INTO campaign_automations (linkId, campaignId, automationId, campaignTriggerType, linkedAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(linkId, id, automationId, trigger, now);

    return NextResponse.json({ success: true, linkId }, { status: 201 });
  } catch (error) {
    console.error('POST /api/campaigns/:id/automations error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/campaigns/:id/automations — unlink an automation from this campaign
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    const { searchParams } = new URL(req.url);
    const automationId = searchParams.get('automationId');

    if (!automationId) {
      return NextResponse.json({ success: false, error: 'automationId query param required' }, { status: 400 });
    }

    db.prepare('DELETE FROM campaign_automations WHERE campaignId = ? AND automationId = ?').run(id, automationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/campaigns/:id/automations error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
