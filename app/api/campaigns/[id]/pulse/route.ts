// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/campaigns/:id/pulse — generate weekly campaign pulse report and post to campaign chat
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id: campaignId } = await params;
    const db = getDb();
    const now = Date.now();
    const weekAgo = now - 7 * 86_400_000;

    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId) as Record<string, unknown> | undefined;
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    const kpis: Record<string, { target: number; actual: number }> = (() => { try { return JSON.parse(campaign.kpis as string || '{}'); } catch { return {}; } })();

    // Content items stats
    const allItems = db.prepare('SELECT * FROM campaign_content_items WHERE campaignId = ?').all(campaignId) as Record<string, unknown>[];
    const doneThisWeek = allItems.filter(i => i.status === 'done' && (i.updatedAt as number) >= weekAgo);
    const inReview = allItems.filter(i => i.status === 'in-review');
    const scheduled = allItems.filter(i => i.status === 'scheduled');
    const overdueItems = allItems.filter(i =>
      i.scheduledDate && (i.scheduledDate as number) < now &&
      !['done', 'active', 'ongoing'].includes(i.status as string)
    );

    // Phases
    const phases = db.prepare('SELECT * FROM campaign_phases WHERE campaignId = ? ORDER BY sortOrder ASC').all(campaignId) as Record<string, unknown>[];
    const activePhases = phases.filter(p => {
      const s = p.startDate as number | null;
      const e = p.endDate as number | null;
      return s && s <= now && (!e || e >= now);
    });

    // KPI weekly — find current week
    const kpiWeekly = db.prepare('SELECT * FROM campaign_kpi_weekly WHERE campaignId = ? ORDER BY weekStart DESC').all(campaignId) as Record<string, unknown>[];
    const currentWeekRows = kpiWeekly.length > 0
      ? kpiWeekly.filter(r => (r.weekStart as number) <= now).slice(0, 6) // last 6 metrics for current week
      : [];

    // Tasks completed this week for this campaign
    const tasksCompleted = db.prepare(
      `SELECT COUNT(*) as cnt FROM tasks WHERE project = ? AND status = 'done' AND updatedAt >= ?`
    ).get(campaignId, weekAgo) as { cnt: number };

    // Build pulse report
    const lines: string[] = [];
    const weekOfStr = new Date(weekAgo).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const todayStr = new Date(now).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    lines.push(`## Campaign Pulse — Week of ${weekOfStr}`);
    lines.push(`**${campaign.name}** · ${campaign.status} · Generated ${todayStr}`);
    lines.push('');

    // Active phase
    if (activePhases.length > 0) {
      lines.push(`### Active Phase: ${activePhases[0].name}`);
      const phaseEnd = activePhases[0].endDate as number | null;
      if (phaseEnd) {
        const daysLeft = Math.ceil((phaseEnd - now) / 86_400_000);
        lines.push(`${daysLeft > 0 ? `${daysLeft} days remaining` : 'Ending today'}`);
      }
      lines.push('');
    }

    // Content performance
    lines.push('### Content Performance');
    lines.push(`- **${doneThisWeek.length}** items completed this week`);
    lines.push(`- **${inReview.length}** in review awaiting approval`);
    lines.push(`- **${scheduled.length}** scheduled and ready`);
    if (overdueItems.length > 0) {
      lines.push(`- **${overdueItems.length}** items are overdue (past scheduled date, not yet done)`);
      overdueItems.slice(0, 3).forEach(i => {
        lines.push(`  - ${i.description as string ? String(i.description).slice(0, 60) : 'Untitled'} — ${i.status}`);
      });
    }
    lines.push('');

    // KPI tracker
    if (currentWeekRows.length > 0) {
      lines.push('### KPI Tracker');
      const uniqueMetrics = [...new Set(currentWeekRows.map(r => r.metric as string))];
      for (const metric of uniqueMetrics) {
        const row = currentWeekRows.find(r => r.metric === metric && r.actual != null);
        const kpi = kpis[metric];
        if (row && kpi) {
          const pct = Math.round((row.actual as number) / kpi.target * 100);
          const icon = pct >= 100 ? '✅' : pct >= 70 ? '⚠️' : '🔴';
          lines.push(`- ${icon} **${metric}**: ${(row.actual as number).toLocaleString()} / ${kpi.target.toLocaleString()} (${pct}%)`);
        } else if (kpi && kpi.target > 0) {
          lines.push(`- ⬜ **${metric}**: — / ${kpi.target.toLocaleString()} (no actuals yet)`);
        }
      }
      lines.push('');
    }

    // Agent tasks
    if (tasksCompleted.cnt > 0) {
      lines.push(`### Agent Work`);
      lines.push(`- **${tasksCompleted.cnt}** tasks completed by agents this week`);
      lines.push('');
    }

    // Upcoming content (next 7 days)
    const nextWeek = now + 7 * 86_400_000;
    const upcoming = allItems
      .filter(i => i.scheduledDate && (i.scheduledDate as number) >= now && (i.scheduledDate as number) <= nextWeek)
      .sort((a, b) => (a.scheduledDate as number) - (b.scheduledDate as number))
      .slice(0, 6);
    if (upcoming.length > 0) {
      lines.push('### Upcoming This Week');
      upcoming.forEach(i => {
        const dateStr = new Date(i.scheduledDate as number).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        lines.push(`- **${dateStr}** — ${String(i.description).slice(0, 70)} _(${i.ownerId || 'unassigned'})_`);
      });
      lines.push('');
    }

    const report = lines.join('\n');

    // Post to campaign chat room
    const chatRoomId = `campaign-${campaignId}`;
    const msgId = `msg-pulse-${now}`;
    try {
      db.prepare(`
        INSERT OR IGNORE INTO chat_rooms (id, name, agents, project_id, createdAt, updatedAt)
        VALUES (?, ?, '[]', ?, ?, ?)
      `).run(chatRoomId, `${campaign.name} — War Room`, campaignId, now, now);

      db.prepare(`
        INSERT INTO chat_room_messages (id, roomId, senderId, content, createdAt)
        VALUES (?, ?, 'system', ?, ?)
      `).run(msgId, chatRoomId, report, now);
    } catch (err) { console.warn('[pulse] Non-critical: failed to post to chat:', err); }

    return NextResponse.json({ report, postedToChat: true, chatRoomId });
  } catch (e) {
    console.error('[pulse] Error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
