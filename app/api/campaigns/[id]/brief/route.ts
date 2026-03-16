// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

function generateBrief(c: Record<string, unknown>): string {
  const name = (c.name as string) ?? 'Untitled Campaign';
  const type = (c.type as string) ?? 'general';
  const goal = (c.goal as string) ?? 'Not specified';
  const description = (c.description as string) ?? '';
  const targetAudience = (c.targetAudience as string) ?? 'Not specified';
  const currency = (c.currency as string) ?? 'USD';
  const budget = c.budget != null ? `${currency} ${(c.budget as number).toLocaleString()}` : 'Not set';
  const startDate = c.startDate ? new Date(c.startDate as number).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD';
  const endDate = c.endDate ? new Date(c.endDate as number).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD';
  const channels: string[] = (() => { try { return JSON.parse(c.channels as string); } catch { return []; } })();
  const kpis: Record<string, { target: number; actual: number }> = (() => { try { return JSON.parse(c.kpis as string); } catch { return {}; } })();

  const channelList = channels.length > 0 ? channels.join(', ') : 'Not specified';

  const kpiLines = Object.entries(kpis)
    .map(([key, val]) => `- **${key}**: Target ${val.target} / Actual ${val.actual}`)
    .join('\n');

  return `# Campaign Brief: ${name}

## Overview
${description || '_No description provided._'}

**Type**: ${type}
**Status**: ${(c.status as string) ?? 'draft'}

## Goal
${goal}

## Timeline
| | |
|---|---|
| **Start date** | ${startDate} |
| **End date** | ${endDate} |

## Budget
**Total budget**: ${budget}
**Spent to date**: ${currency} ${((c.budgetSpent as number) ?? 0).toLocaleString()}

## Target Audience
${targetAudience}

## Channels
${channelList}

## Key Messages
_Add key messages and talking points here._

## Success Metrics
${kpiLines || '_No KPIs defined yet._'}

## Approval
_Pending review._

---
*Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}*
`;
}

// GET /api/campaigns/:id/brief
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!campaign) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    // Return saved brief if present, otherwise generate one
    const brief = (campaign.brief as string | null) ?? generateBrief(campaign);
    return NextResponse.json({ success: true, brief, isGenerated: !campaign.brief });
  } catch (error) {
    console.error('GET /api/campaigns/:id/brief error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/campaigns/:id/brief — save custom brief text
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    const campaign = db.prepare('SELECT id FROM campaigns WHERE id = ?').get(id);
    if (!campaign) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const { brief } = body as { brief?: string };
    if (typeof brief !== 'string') {
      return NextResponse.json({ success: false, error: 'brief must be a string' }, { status: 400 });
    }

    // Add brief column if it doesn't exist (safe migration)
    try { db.exec('ALTER TABLE campaigns ADD COLUMN brief TEXT'); } catch { /* already exists */ }

    db.prepare('UPDATE campaigns SET brief = ?, updatedAt = ? WHERE id = ?').run(brief, Date.now(), id);
    return NextResponse.json({ success: true, brief });
  } catch (error) {
    console.error('POST /api/campaigns/:id/brief error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
