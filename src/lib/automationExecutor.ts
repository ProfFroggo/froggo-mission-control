// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { getDb } from './database';
import { emitSSEEvent } from './sseEmitter';

interface AutomationStep {
  type: 'run-agent-task' | 'create-task' | 'post-to-chat' | 'save-to-library' | 'send-for-approval' | 'delay' | 'webhook' | string;
  config: Record<string, unknown>;
}

export async function executeAutomation(
  automationId: string,
  triggerPayload?: Record<string, unknown>
): Promise<{ success: boolean; message: string; stepsRun: number }> {
  const db = getDb();
  const automation = db.prepare('SELECT * FROM automations WHERE id = ? AND status = ?').get(automationId, 'active') as Record<string, unknown> | undefined;
  if (!automation) return { success: false, message: 'Automation not found or not active', stepsRun: 0 };

  const steps: AutomationStep[] = typeof automation.steps === 'string' ? JSON.parse(automation.steps as string) : (automation.steps as AutomationStep[]) ?? [];
  const log: string[] = [];
  let stepsRun = 0;

  // Record run start
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const startedAt = Date.now();
  try {
    db.prepare('INSERT INTO automation_runs (id, automationId, status, stepsRun, startedAt) VALUES (?, ?, ?, ?, ?)').run(runId, automationId, 'running', 0, startedAt);
  } catch { /* table may not exist yet */ }

  for (const step of steps) {
    try {
      await executeStep(step, triggerPayload ?? {}, log, db);
      stepsRun++;
    } catch (err) {
      log.push(`Step ${stepsRun + 1} (${step.type}) failed: ${err instanceof Error ? err.message : String(err)}`);
      break;
    }
  }

  const success = stepsRun === steps.length;
  const message = log.join('; ') || 'Completed successfully';
  const now = Date.now();
  const durationMs = now - startedAt;
  const automationName = (automation.name as string) || automationId;

  db.prepare('UPDATE automations SET last_run = ?, updated_at = ? WHERE id = ?').run(now, now, automationId);
  try {
    db.prepare('UPDATE automation_runs SET status = ?, message = ?, stepsRun = ?, completedAt = ? WHERE id = ?')
      .run(success ? 'success' : 'failed', message, stepsRun, now, runId);
  } catch { /* ignore */ }

  // Emit SSE event so connected clients are notified immediately
  if (success) {
    emitSSEEvent('automation.completed', { automationId, name: automationName, success: true, stepsRun, durationMs });
  } else {
    emitSSEEvent('automation.failed', { automationId, name: automationName, error: message });
  }

  return { success, message, stepsRun };
}

async function executeStep(
  step: AutomationStep,
  payload: Record<string, unknown>,
  log: string[],
  db: ReturnType<typeof getDb>
): Promise<void> {
  const cfg = step.config as Record<string, string>;
  switch (step.type) {
    case 'run-agent-task': {
      const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const now = Date.now();
      db.prepare(`INSERT INTO tasks (id, title, description, status, priority, assignedTo, tags, labels, blockedBy, blocks, progress, createdAt, updatedAt) VALUES (?, ?, ?, 'todo', ?, ?, '[]', '[]', '[]', '[]', 0, ?, ?)`)
        .run(taskId, cfg.title || 'Automated task', cfg.description || null, cfg.priority || 'p2', cfg.agentId || null, now, now);
      log.push(`Created task "${cfg.title}" (${taskId})`);
      break;
    }
    case 'create-task': {
      // Full task creation with subtasks and multi-agent assignment
      const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const now = Date.now();
      const planningNotes = cfg.planningNotes || cfg.description || '';
      db.prepare(`INSERT INTO tasks (id, title, description, status, priority, assignedTo, planningNotes, tags, labels, blockedBy, blocks, progress, createdAt, updatedAt) VALUES (?, ?, ?, 'todo', ?, ?, ?, '["automation"]', '[]', '[]', '[]', 0, ?, ?)`)
        .run(taskId, cfg.title || 'Automated task', cfg.description || null, cfg.priority || 'p2', cfg.assignTo || null, planningNotes, now, now);

      // Create subtasks if defined
      const subtasks: Array<string | { title: string; assignedTo?: string }> = Array.isArray(cfg.subtasks) ? cfg.subtasks as Array<string | { title: string; assignedTo?: string }> : [];
      for (let i = 0; i < subtasks.length; i++) {
        const st = subtasks[i];
        const stTitle = typeof st === 'string' ? st : st.title;
        const stAssign = typeof st === 'string' ? null : (st.assignedTo || null);
        const stId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        db.prepare(`INSERT INTO subtasks (id, taskId, title, assignedTo, position, completed, createdAt) VALUES (?, ?, ?, ?, ?, 0, ?)`)
          .run(stId, taskId, stTitle, stAssign, i, now);
      }

      log.push(`Created task "${cfg.title}" (${taskId}) with ${subtasks.length} subtask(s)`);
      break;
    }
    case 'post-to-chat': {
      // chat_room_messages uses AUTOINCREMENT id and timestamp (not createdAt)
      try {
        db.prepare(`INSERT INTO chat_room_messages (roomId, agentId, content, timestamp) VALUES (?, ?, ?, ?)`)
          .run(cfg.roomId || 'general', cfg.agentId || 'system', cfg.message || 'Automated message', Date.now());
      } catch { /* room may not exist */ }
      log.push(`Posted to chat room "${cfg.roomId || 'general'}"`);
      break;
    }
    case 'send-for-approval': {
      const approvalId = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      // approvals schema: id, type, title, content, context, metadata, status, requester, tier, createdAt
      db.prepare(`INSERT INTO approvals (id, type, title, content, status, requester, category, createdAt) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`)
        .run(approvalId, cfg.category || 'agent_approval', cfg.title || 'Approval required', JSON.stringify(cfg), 'automation', cfg.category || 'agent_approval', Date.now());
      log.push(`Created approval "${cfg.title}"`);
      // Emit inbox.count SSE so sidebar badge updates immediately
      try {
        const pendingCount = (db.prepare("SELECT COUNT(*) as c FROM approvals WHERE status = 'pending'").get() as { c: number }).c;
        emitSSEEvent('inbox.count', { count: pendingCount });
      } catch { /* non-critical */ }
      break;
    }
    case 'webhook': {
      if (!cfg.url) throw new Error('Webhook URL not configured');
      const res = await fetch(cfg.url, {
        method: cfg.method || 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, config: cfg }),
      });
      if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
      log.push(`Webhook ${cfg.url} → ${res.status}`);
      break;
    }
    case 'delay':
      log.push(`Delay step skipped (handled by scheduler)`);
      break;
    default:
      log.push(`Unknown step type: ${step.type} (skipped)`);
  }
}
