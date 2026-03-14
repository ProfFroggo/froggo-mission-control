// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { validateAgentId } from '@/lib/validateId';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CoachingPlanRow {
  agentId: string;
  focus: string | null;
  plan: string;
  updatedAt: string;
}

interface WeeklyPlan {
  week1: string[];
  week2: string[];
  week3: string[];
  week4: string[];
}

// Maps known improvement/skill-gap signals to concrete weekly actions
function generatePlanFromReviewData(improvements: string[], recommendations: string[], skillGaps: string[]): WeeklyPlan {
  const hasRejections       = improvements.some(s => s.includes('rejected') || s.includes('failed'));
  const hasLowSuccess       = improvements.some(s => s.includes('Success rate below'));
  const hasHighDuration     = improvements.some(s => s.includes('duration'));
  const hasHighTokens       = improvements.some(s => s.includes('token'));
  const hasDeclining        = improvements.some(s => s.includes('declining'));
  const hasNoTasks          = improvements.some(s => s.includes('No tasks'));
  const needsPlanningNotes  = skillGaps.includes('No planning notes') || recommendations.some(s => s.includes('planning notes'));
  const needsSmallUnits     = recommendations.some(s => s.includes('smaller'));
  const needsContextSummary = recommendations.some(s => s.includes('context'));

  const week1: string[] = [];
  const week2: string[] = [];
  const week3: string[] = [];
  const week4: string[] = [];

  // Week 1 — Diagnose and baseline
  week1.push('Audit last 10 completed tasks for recurring failure patterns');
  if (hasRejections || hasLowSuccess) {
    week1.push('Review all rejection activity logs and categorize root causes');
  } else {
    week1.push('Document current workflow as a reusable baseline checklist');
  }
  if (needsPlanningNotes) {
    week1.push('Add a planning note template to all new task assignments');
  } else if (hasHighDuration) {
    week1.push('Time-box planning phase to under 15 minutes per task');
  } else {
    week1.push('Identify the single highest-impact efficiency improvement');
  }

  // Week 2 — Targeted improvement
  if (needsSmallUnits) {
    week2.push('Break complex tasks into subtasks of under 2 hours each');
  } else {
    week2.push('Refine task scope definitions before starting each assignment');
  }
  if (needsContextSummary || hasHighTokens) {
    week2.push('Practice writing concise context summaries before long tasks');
    week2.push('Establish token usage checkpoints at the 50% mark of each task');
  } else if (hasHighDuration) {
    week2.push('Set per-task time targets and flag early if going over');
    week2.push('Implement a mid-task progress check after 1 hour');
  } else {
    week2.push('Apply week 1 baseline checklist to every new task');
    week2.push('Track which checklist items prevent the most common errors');
  }

  // Week 3 — Reinforce and measure
  week3.push('Re-measure success rate against week 1 baseline');
  if (hasDeclining) {
    week3.push('Identify if decline is systematic (tool issues) or skill-based');
    week3.push('Schedule a sync with reviewer to align on quality expectations');
  } else if (hasNoTasks) {
    week3.push('Request task assignments aligned to documented skill strengths');
    week3.push('Propose at least two new tasks with full planning notes');
  } else {
    week3.push('Share workflow improvements with the team as a knowledge artifact');
    week3.push('Pick one stretch task outside current comfort zone');
  }

  // Week 4 — Consolidate and sustain
  week4.push('Write a retrospective covering improvements made this month');
  week4.push('Set measurable success rate target for next 30-day period');
  if (hasRejections || hasLowSuccess) {
    week4.push('Confirm rejection rate has decreased before closing coaching cycle');
  } else {
    week4.push('Identify the next skill gap area to tackle in the following cycle');
  }

  return { week1, week2, week3, week4 };
}

function ensureTable(db: ReturnType<typeof getDb>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_coaching_plans (
      agentId   TEXT PRIMARY KEY,
      focus     TEXT,
      plan      TEXT NOT NULL DEFAULT '{}',
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;

    const db = getDb();
    ensureTable(db);

    const agentRow = db.prepare('SELECT id, name FROM agents WHERE id = ?').get(id) as { id: string; name: string } | undefined;
    if (!agentRow) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const stored = db.prepare('SELECT * FROM agent_coaching_plans WHERE agentId = ?').get(id) as CoachingPlanRow | undefined;

    if (stored) {
      let plan: WeeklyPlan;
      try {
        plan = JSON.parse(stored.plan) as WeeklyPlan;
      } catch {
        plan = { week1: [], week2: [], week3: [], week4: [] };
      }
      return NextResponse.json({ plan, focus: stored.focus ?? '', updatedAt: stored.updatedAt });
    }

    // Auto-generate from review data (30d period)
    let improvements: string[] = [];
    let recommendations: string[] = [];
    let skillGaps: string[] = [];

    try {
      const periodMs = 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const periodStart = now - periodMs;

      const tasks = db.prepare(
        `SELECT status FROM tasks WHERE assignedTo = ? AND createdAt >= ?`
      ).all(id, periodStart) as { status: string }[];

      const done     = tasks.filter(t => t.status === 'done').length;
      const total    = tasks.length;
      const rejected = tasks.filter(t => t.status === 'failed').length;
      const successRate = total > 0 ? Math.round((done / total) * 100) : 0;

      if (rejected > 0) improvements.push(`${rejected} tasks rejected or failed`);
      if (successRate < 60 && total > 0) improvements.push('Success rate below 60% — review failure patterns');
      if (total === 0) improvements.push('No tasks assigned in this period');

      if (rejected > 2) recommendations.push('Add more detailed planning notes before starting tasks');
      if (successRate < 70 && total > 0) recommendations.push('Break tasks into smaller, more focused units');

      const activityRows = db.prepare(
        `SELECT message FROM task_activity WHERE agentId = ? AND action = 'rejected' AND timestamp >= ? LIMIT 50`
      ).all(id, periodStart) as { message: string }[];

      const PATTERNS: Array<[RegExp, string]> = [
        [/no planning note/i, 'No planning notes'],
        [/missing subtask/i,  'Missing subtasks'],
        [/too vague/i,        'Task too vague'],
        [/token limit/i,      'Token limit exceeded'],
      ];
      const gapSet = new Set<string>();
      for (const { message } of activityRows) {
        for (const [re, label] of PATTERNS) {
          if (re.test(message)) { gapSet.add(label); break; }
        }
      }
      skillGaps = Array.from(gapSet);
    } catch {
      // If review data unavailable, generate a generic plan
    }

    const plan = generatePlanFromReviewData(improvements, recommendations, skillGaps);
    const updatedAt = new Date().toISOString();

    db.prepare(
      `INSERT OR REPLACE INTO agent_coaching_plans (agentId, focus, plan, updatedAt)
       VALUES (?, ?, ?, ?)`
    ).run(id, null, JSON.stringify(plan), updatedAt);

    return NextResponse.json({ plan, focus: '', updatedAt });
  } catch (error) {
    console.error('GET /api/agents/[id]/coaching-plan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;

    const db = getDb();
    ensureTable(db);

    const agentRow = db.prepare('SELECT id FROM agents WHERE id = ?').get(id) as { id: string } | undefined;
    if (!agentRow) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({})) as { plan?: WeeklyPlan; focus?: string };

    const focus = typeof body.focus === 'string' ? body.focus.trim().slice(0, 500) : null;
    const plan: WeeklyPlan = body.plan && typeof body.plan === 'object'
      ? {
          week1: Array.isArray(body.plan.week1) ? body.plan.week1.map(String).slice(0, 10) : [],
          week2: Array.isArray(body.plan.week2) ? body.plan.week2.map(String).slice(0, 10) : [],
          week3: Array.isArray(body.plan.week3) ? body.plan.week3.map(String).slice(0, 10) : [],
          week4: Array.isArray(body.plan.week4) ? body.plan.week4.map(String).slice(0, 10) : [],
        }
      : { week1: [], week2: [], week3: [], week4: [] };

    const updatedAt = new Date().toISOString();

    db.prepare(
      `INSERT OR REPLACE INTO agent_coaching_plans (agentId, focus, plan, updatedAt)
       VALUES (?, ?, ?, ?)`
    ).run(id, focus, JSON.stringify(plan), updatedAt);

    return NextResponse.json({ plan, focus: focus ?? '', updatedAt });
  } catch (error) {
    console.error('POST /api/agents/[id]/coaching-plan error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
