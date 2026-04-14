// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/campaigns/:id/content-items/:itemId/dispatch
// Creates an agent task from a content item with full campaign context
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { dispatchTask } from '@/lib/taskDispatcher';
import { emitSSEEvent } from '@/lib/sseEmitter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: campaignId, itemId } = await params;
    const db = getDb();

    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId) as Record<string, unknown> | undefined;
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    const item = db.prepare('SELECT * FROM campaign_content_items WHERE id = ? AND campaignId = ?').get(itemId, campaignId) as Record<string, unknown> | undefined;
    if (!item) return NextResponse.json({ error: 'Content item not found' }, { status: 404 });

    if (item.ownerType !== 'ai' || !item.ownerId) {
      return NextResponse.json({ error: 'Content item must have ownerType=ai and a valid ownerId' }, { status: 400 });
    }

    // Load phase context if available
    const phase = item.phaseId
      ? db.prepare('SELECT * FROM campaign_phases WHERE id = ?').get(item.phaseId as string) as Record<string, unknown> | undefined
      : undefined;

    // Parse JSON fields
    const channels: string[] = (() => { try { return JSON.parse(campaign.channels as string || '[]'); } catch { return []; } })();
    const kpis: Record<string, { target: number; actual: number }> = (() => { try { return JSON.parse(campaign.kpis as string || '{}'); } catch { return {}; } })();
    const phaseMilestones: string[] = phase ? (() => { try { return JSON.parse(phase.milestones as string || '[]'); } catch { return []; } })() : [];

    const scheduledDateStr = item.scheduledDate
      ? new Date(item.scheduledDate as number).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'No date set';

    // Build KPI targets summary
    const kpiLines = Object.entries(kpis)
      .filter(([, v]) => v.target > 0)
      .map(([k, v]) => `  - ${k}: target ${v.target.toLocaleString()}${v.actual ? `, actual ${v.actual.toLocaleString()}` : ''}`)
      .join('\n');

    // Type-specific field lines
    const typeFields: string[] = [];
    const contentType = item.contentType as string || 'social';
    if (contentType === 'social' && item.weekTheme) typeFields.push(`**Week Theme:** ${item.weekTheme}`);
    if ((contentType === 'email' || contentType === 'trigger') && item.segment) typeFields.push(`**Segment:** ${item.segment}`);
    if (contentType === 'email' && item.notes) typeFields.push(`**Subject Line:** ${item.notes}`);
    if (contentType === 'trigger' && item.cadence) typeFields.push(`**Cadence:** ${item.cadence}`);
    if (contentType === 'paid' && item.audience) typeFields.push(`**Target Audience:** ${item.audience}`);
    if (item.angle) typeFields.push(`**Strategic Angle:** ${item.angle}`);
    if (contentType !== 'email' && item.notes) typeFields.push(`**Notes:** ${item.notes}`);

    const phaseSection = phase ? `
## Phase Context
**Phase:** ${phase.name}
**Phase Dates:** ${phase.startDate ? new Date(phase.startDate as number).toLocaleDateString() : '?'} – ${phase.endDate ? new Date(phase.endDate as number).toLocaleDateString() : '?'}
${phaseMilestones.length ? `**Phase Milestones:**\n${phaseMilestones.map(m => `  - ${m}`).join('\n')}` : ''}
` : '';

    const briefExcerpt = campaign.briefContent
      ? String(campaign.briefContent).slice(0, 600) + (String(campaign.briefContent).length > 600 ? '...' : '')
      : '';

    const description = `## Campaign Context
**Campaign:** ${campaign.name} (${campaign.type})
**Goal:** ${campaign.goal ?? 'See campaign brief'}
**Status:** ${campaign.status}
**Channels:** ${channels.join(', ') || 'Not set'}
**Target Audience:** ${campaign.targetAudience ?? 'Not specified'}
${kpiLines ? `\n**KPI Targets:**\n${kpiLines}` : ''}
${phaseSection}
## Your Assignment
**Content Type:** ${contentType}
**Scheduled Date:** ${scheduledDateStr}
**Content:** ${item.description}
${typeFields.join('\n')}
${briefExcerpt ? `\n## Campaign Brief\n${briefExcerpt}` : ''}

## Instructions
Complete this content item and then update its status using the MCP tool:
  \`campaign_update_content_item("${itemId}", "in-review")\`

If there is an approver set, they will review before it goes live. If no approver, mark it "done" directly.

Content item ID: ${itemId}
Campaign ID: ${campaignId}`;

    // Create the task
    const now = Date.now();
    const taskId = `task-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const taskTitle = `[${contentType.toUpperCase()}] ${String(item.description).slice(0, 80)}`;

    db.prepare(`
      INSERT INTO tasks (id, title, description, status, priority, assignedTo, project, createdAt, updatedAt)
      VALUES (?, ?, ?, 'internal-review', 'p2', ?, ?, ?, ?)
    `).run(taskId, taskTitle, description, item.ownerId, campaignId, now, now);

    // Link task back to content item
    db.prepare('UPDATE campaign_content_items SET taskId = ?, updatedAt = ? WHERE id = ?').run(taskId, now, itemId);

    // Dispatch to agent
    dispatchTask(taskId);

    emitSSEEvent('campaign.content.dispatched', { itemId, taskId, campaignId, agentId: item.ownerId });

    const task = db.prepare('SELECT id, title, status, assignedTo, createdAt FROM tasks WHERE id = ?').get(taskId);
    return NextResponse.json({ taskId, task, itemId }, { status: 201 });
  } catch (e) {
    console.error('[content-items/dispatch] Error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
