// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/x/automations/execute — Cron-triggered automation execution engine
// Evaluates all enabled automations against current triggers, fires actions via approval queue
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

interface ExecutionResult {
  checked: number;
  fired: number;
  skipped: number;
  errors: string[];
}

export async function POST() {
  const result: ExecutionResult = { checked: 0, fired: 0, skipped: 0, errors: [] };

  try {
    const db = getDb();
    const now = Date.now();
    const currentHour = Math.floor(now / 3600000);
    const currentDay = Math.floor(now / 86400000);

    // Load enabled automations
    const automations = db.prepare('SELECT * FROM x_automations WHERE enabled = 1').all() as any[];
    result.checked = automations.length;

    for (const auto of automations) {
      try {
        // Reset hourly/daily counters if needed
        if (auto.last_reset_hour !== currentHour) {
          db.prepare('UPDATE x_automations SET executions_this_hour = 0, last_reset_hour = ? WHERE id = ?').run(currentHour, auto.id);
          auto.executions_this_hour = 0;
        }
        if (auto.last_reset_day !== currentDay) {
          db.prepare('UPDATE x_automations SET executions_today = 0, last_reset_day = ? WHERE id = ?').run(currentDay, auto.id);
          auto.executions_today = 0;
        }

        // Check rate limits
        if (auto.executions_this_hour >= auto.max_per_hour || auto.executions_today >= auto.max_per_day) {
          result.skipped++;
          continue;
        }

        const triggerConfig = typeof auto.trigger_config === 'string' ? JSON.parse(auto.trigger_config) : (auto.trigger_config || {});
        const actions = typeof auto.actions === 'string' ? JSON.parse(auto.actions) : (auto.actions || []);

        // Evaluate trigger
        const triggerMatches = await evaluateTrigger(db, auto.trigger_type, triggerConfig, auto.last_executed_at);

        if (triggerMatches.length === 0) continue;

        // Fire actions for each match (up to rate limit)
        for (const match of triggerMatches) {
          if (auto.executions_this_hour >= auto.max_per_hour || auto.executions_today >= auto.max_per_day) break;

          const approvalIds: string[] = [];
          const actionResults: any[] = [];

          for (const action of actions) {
            const actionResult = await executeAction(db, action, match, auto);
            actionResults.push(actionResult);
            if (actionResult.approval_id) approvalIds.push(actionResult.approval_id);
          }

          // Log execution
          const logId = `xl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          db.prepare(`
            INSERT INTO x_automation_log (id, automation_id, trigger_type, trigger_data, actions_taken, approval_ids, status, executed_at)
            VALUES (?, ?, ?, ?, ?, ?, 'executed', ?)
          `).run(
            logId, auto.id, auto.trigger_type,
            JSON.stringify(match),
            JSON.stringify(actionResults),
            JSON.stringify(approvalIds),
            now,
          );

          // Update counters
          db.prepare(`
            UPDATE x_automations SET
              total_executions = total_executions + 1,
              executions_this_hour = executions_this_hour + 1,
              executions_today = executions_today + 1,
              last_executed_at = ?,
              updated_at = ?
            WHERE id = ?
          `).run(now, now, auto.id);

          auto.executions_this_hour++;
          auto.executions_today++;
          result.fired++;
        }
      } catch (err) {
        result.errors.push(`Automation ${auto.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[x/automations/execute]', error);
    return NextResponse.json({ ok: false, ...result, error: String(error) }, { status: 500 });
  }
}

// ── Trigger Evaluation ──────────────────────────────────────────────────────

async function evaluateTrigger(
  db: any,
  triggerType: string,
  config: any,
  lastExecutedAt: number | null,
): Promise<any[]> {
  const since = lastExecutedAt || (Date.now() - 15 * 60000); // default: last 15 min

  switch (triggerType) {
    case 'mention': {
      // New mentions since last execution
      const mentions = db.prepare(`
        SELECT * FROM x_mentions
        WHERE fetched_at > ? AND reply_status = 'pending'
        ORDER BY tweet_created_at DESC
      `).all(since) as any[];

      // Apply config filters
      return mentions.filter((m: any) => {
        if (config.min_followers && (m.author_followers || 0) < config.min_followers) return false;
        if (config.mention_type && m.mention_type !== config.mention_type) return false;
        if (config.only_reply_to_us && !m.is_reply_to_us) return false;
        return true;
      });
    }

    case 'keyword': {
      // New mentions containing specific keywords
      const keywords: string[] = config.keywords || [];
      if (keywords.length === 0) return [];

      const mentions = db.prepare(`
        SELECT * FROM x_mentions
        WHERE fetched_at > ? AND reply_status = 'pending'
      `).all(since) as any[];

      return mentions.filter((m: any) => {
        const text = (m.text || '').toLowerCase();
        return keywords.some(kw => text.includes(kw.toLowerCase()));
      });
    }

    case 'time': {
      // Scheduled time trigger — check if current time matches
      const schedule = config.schedule; // e.g. "09:00" or cron-like
      if (!schedule) return [];

      const now = new Date();
      const [hours, minutes] = schedule.split(':').map(Number);
      if (now.getHours() === hours && Math.abs(now.getMinutes() - minutes) <= 1) {
        return [{ trigger: 'time', scheduled: schedule }];
      }
      return [];
    }

    case 'follower': {
      // New follower trigger — would need X API webhook or polling
      // For now, return empty (future: check follower changes)
      return [];
    }

    case 'dm': {
      // DM trigger — would need X API webhook
      // For now, return empty
      return [];
    }

    default:
      return [];
  }
}

// ── Action Execution ────────────────────────────────────────────────────────
// ALL actions create approvals — nothing posts directly

async function executeAction(
  db: any,
  action: { type: string; config: Record<string, any> },
  triggerData: any,
  automation: any,
): Promise<any> {
  const apId = `xa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  switch (action.type) {
    case 'reply': {
      // Auto-reply to a mention — creates approval, never posts directly
      const template = action.config.template || 'Thanks for reaching out! We\'ll get back to you.';
      const replyText = template
        .replace(/\{\{username\}\}/g, `@${triggerData.author_username || 'user'}`)
        .replace(/\{\{topic\}\}/g, (triggerData.text || '').slice(0, 30));

      db.prepare(`
        INSERT INTO approvals (id, type, title, content, tier, status, metadata, requester, createdAt)
        VALUES (?, 'x-reply', ?, ?, 3, 'pending', ?, ?, ?)
      `).run(
        apId,
        `Auto-reply to @${triggerData.author_username || 'user'}`,
        replyText,
        3,
        JSON.stringify({
          auto_generated: true,
          automation_id: automation.id,
          automation_name: automation.name,
          mentionId: triggerData.id,
          tweetId: triggerData.tweet_id,
          replyText,
          mention_author: triggerData.author_username,
        }),
        `automation:${automation.id}`,
        Date.now(),
      );

      return { type: 'reply', approval_id: apId, status: 'queued for approval' };
    }

    case 'like': {
      // Like a tweet — creates approval
      db.prepare(`
        INSERT INTO approvals (id, type, title, content, tier, status, metadata, requester, createdAt)
        VALUES (?, 'x-action', ?, ?, 1, 'pending', ?, ?, ?)
      `).run(
        apId,
        `Auto-like @${triggerData.author_username || 'user'}'s tweet`,
        `Like tweet: ${(triggerData.text || '').slice(0, 100)}`,
        1,
        JSON.stringify({ action: 'like', tweet_id: triggerData.tweet_id, automation_id: automation.id }),
        `automation:${automation.id}`,
        Date.now(),
      );

      return { type: 'like', approval_id: apId, status: 'queued for approval' };
    }

    case 'retweet': {
      // Retweet — creates approval
      db.prepare(`
        INSERT INTO approvals (id, type, title, content, tier, status, metadata, requester, createdAt)
        VALUES (?, 'x-action', ?, ?, 2, 'pending', ?, ?, ?)
      `).run(
        apId,
        `Auto-retweet @${triggerData.author_username || 'user'}`,
        `Retweet: ${(triggerData.text || '').slice(0, 100)}`,
        2,
        JSON.stringify({ action: 'retweet', tweet_id: triggerData.tweet_id, automation_id: automation.id }),
        `automation:${automation.id}`,
        Date.now(),
      );

      return { type: 'retweet', approval_id: apId, status: 'queued for approval' };
    }

    case 'dm': {
      // DM — creates approval
      db.prepare(`
        INSERT INTO approvals (id, type, title, content, tier, status, metadata, requester, createdAt)
        VALUES (?, 'x-action', ?, ?, 3, 'pending', ?, ?, ?)
      `).run(
        apId,
        `Auto-DM to @${triggerData.author_username || 'user'}`,
        action.config.template || 'Thanks for connecting!',
        3,
        JSON.stringify({ action: 'dm', user_id: triggerData.author_id, automation_id: automation.id }),
        `automation:${automation.id}`,
        Date.now(),
      );

      return { type: 'dm', approval_id: apId, status: 'queued for approval' };
    }

    case 'add_to_list': {
      return { type: 'add_to_list', list: action.config.list_id || 'default', status: 'added' };
    }

    case 'process_mentions': {
      // Fetch + process mentions via the mention processor endpoint
      try {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/x/mentions/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        const data = await res.json().catch(() => ({}));
        return { type: 'process_mentions', status: 'executed', fetched: data.fetched, newMentions: data.newMentions, aiReplies: data.aiRepliesGenerated };
      } catch (err: any) {
        return { type: 'process_mentions', status: 'error', error: err.message };
      }
    }

    case 'report': {
      // Generate a report via the reports endpoint
      try {
        const reportType = action.config.report_type || 'competitor-analysis';
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/x/reports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: reportType }),
        });
        const data = await res.json().catch(() => ({}));
        return { type: 'report', report_type: reportType, status: data.ok ? 'generated' : 'failed', title: data.report?.title };
      } catch (err: any) {
        return { type: 'report', status: 'error', error: err.message };
      }
    }

    default:
      return { type: action.type, status: 'unknown action type' };
  }
}
