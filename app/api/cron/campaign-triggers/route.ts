// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/cron/campaign-triggers — check phase dates and fire automations
// Call this via cron (e.g. every hour) or manually from the UI
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { emitSSEEvent } from '@/lib/sseEmitter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PhaseRow {
  id: string; campaignId: string; name: string;
  startDate: number | null; endDate: number | null;
  triggeredStart: number | null; triggeredEnd: number | null;
}

interface AutomationLink {
  automationId: string; campaignTriggerType: string;
}

interface Automation {
  id: string; name: string; status: string; steps: string;
}

export async function POST(_req: NextRequest) {
  const db = getDb();
  const now = Date.now();
  const fired: string[] = [];

  try {
    // Get all active campaigns
    const campaigns = db.prepare(`SELECT id, name FROM campaigns WHERE status IN ('live','planning','active')`).all() as { id: string; name: string }[];

    for (const campaign of campaigns) {
      const phases = db.prepare(
        `SELECT id, campaignId, name, startDate, endDate, triggeredStart, triggeredEnd FROM campaign_phases WHERE campaignId = ?`
      ).all(campaign.id) as PhaseRow[];

      for (const phase of phases) {
        // Fire phase-started
        if (phase.startDate && phase.startDate <= now && !phase.triggeredStart) {
          db.prepare('UPDATE campaign_phases SET triggeredStart = ? WHERE id = ?').run(now, phase.id);
          await fireAutomations(db, campaign.id, 'phase-started', { phase: phase.name, campaignId: campaign.id });
          fired.push(`phase-started: ${campaign.name} / ${phase.name}`);
          emitSSEEvent('campaign.phase.started', { campaignId: campaign.id, phaseId: phase.id, phaseName: phase.name });
        }

        // Fire phase-ended
        if (phase.endDate && phase.endDate <= now && !phase.triggeredEnd) {
          db.prepare('UPDATE campaign_phases SET triggeredEnd = ? WHERE id = ?').run(now, phase.id);
          await fireAutomations(db, campaign.id, 'phase-ended', { phase: phase.name, campaignId: campaign.id });
          fired.push(`phase-ended: ${campaign.name} / ${phase.name}`);
          emitSSEEvent('campaign.phase.ended', { campaignId: campaign.id, phaseId: phase.id, phaseName: phase.name });
          // Auto-generate pulse report on phase end
          try {
            await fetch(`http://localhost:${process.env.PORT || 3000}/api/campaigns/${campaign.id}/pulse`, { method: 'POST' });
          } catch { /* non-critical */ }
        }
      }

      // Check KPI misses (weekly — actual < 70% of target for latest week with data)
      const kpiRows = db.prepare(
        `SELECT metric, target, actual FROM campaign_kpi_weekly WHERE campaignId = ? AND actual IS NOT NULL AND target > 0 ORDER BY weekStart DESC LIMIT 10`
      ).all(campaign.id) as { metric: string; target: number; actual: number }[];

      for (const row of kpiRows) {
        const pct = row.actual / row.target;
        if (pct < 0.7) {
          await fireAutomations(db, campaign.id, 'kpi-miss', { metric: row.metric, actual: row.actual, target: row.target, pct: Math.round(pct * 100) });
          fired.push(`kpi-miss: ${campaign.name} / ${row.metric} at ${Math.round(pct * 100)}%`);
        }
      }
    }

    return NextResponse.json({ ok: true, fired, checkedCampaigns: campaigns.length });
  } catch (e) {
    console.error('[campaign-triggers] Error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

async function fireAutomations(
  db: ReturnType<typeof import('@/lib/database').getDb>,
  campaignId: string,
  triggerType: string,
  context: Record<string, unknown>,
) {
  try {
    const links = db.prepare(
      `SELECT automationId, campaignTriggerType FROM campaign_automations WHERE campaignId = ? AND campaignTriggerType = ?`
    ).all(campaignId, triggerType) as AutomationLink[];

    for (const link of links) {
      const auto = db.prepare('SELECT * FROM automations WHERE id = ? AND status = ?').get(link.automationId, 'active') as Automation | undefined;
      if (!auto) continue;

      let steps: Array<{ type: string; agentId?: string; message?: string; taskTitle?: string; taskDescription?: string }> = [];
      try { steps = JSON.parse(auto.steps || '[]'); } catch { continue; }

      for (const step of steps) {
        if (step.type === 'dispatch-agent' && step.agentId && step.taskTitle) {
          // Create a task for the agent
          const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const desc = `${step.taskDescription || ''}\n\nTrigger context: ${JSON.stringify(context, null, 2)}`;
          db.prepare(`
            INSERT INTO tasks (id, title, description, status, priority, assignedTo, project, createdAt, updatedAt)
            VALUES (?, ?, ?, 'internal-review', 'p2', ?, ?, ?, ?)
          `).run(taskId, step.taskTitle, desc, step.agentId, campaignId, Date.now(), Date.now());
          try {
            const { dispatchTask } = await import('@/lib/taskDispatcher');
            dispatchTask(taskId);
          } catch { /* non-critical */ }
        } else if (step.type === 'chat-message' && step.message) {
          // Post to campaign chat room
          const chatRoomId = `campaign-${campaignId}`;
          try {
            db.prepare(`
              INSERT INTO chat_room_messages (id, roomId, senderId, content, createdAt)
              VALUES (?, ?, 'system', ?, ?)
            `).run(`msg-${Date.now()}-${Math.random().toString(36).slice(2,5)}`, chatRoomId, step.message, Date.now());
          } catch { /* non-critical */ }
        }
      }

      // Update last_run
      db.prepare('UPDATE automations SET last_run = ?, updated_at = ? WHERE id = ?').run(Date.now(), Date.now(), auto.id);
    }
  } catch (err) {
    console.warn('[campaign-triggers] Non-critical fireAutomations error:', err);
  }
}
