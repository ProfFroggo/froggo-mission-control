// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { getDb } from './database';
import { executeAutomation } from './automationExecutor';

const FREQUENCY_MS: Record<string, number> = {
  hourly: 3_600_000,
  daily: 86_400_000,
  weekly: 604_800_000,
};

export async function runScheduledAutomations(): Promise<void> {
  const db = getDb();
  const now = Date.now();

  let scheduled: Record<string, unknown>[] = [];
  try {
    scheduled = db.prepare(
      `SELECT * FROM automations WHERE trigger_type = 'schedule' AND status = 'active' AND (next_run IS NULL OR next_run <= ?)`
    ).all(now) as Record<string, unknown>[];
  } catch { return; }

  for (const automation of scheduled) {
    try {
      await executeAutomation(automation.id as string);
      const cfg = typeof automation.trigger_config === 'string'
        ? JSON.parse(automation.trigger_config as string)
        : (automation.trigger_config ?? {}) as Record<string, string>;
      const freq = FREQUENCY_MS[cfg.frequency as string] ?? FREQUENCY_MS.daily;
      db.prepare('UPDATE automations SET next_run = ? WHERE id = ?').run(now + freq, automation.id);
    } catch (err) {
      console.error(`[AutomationCron] Failed to run automation ${automation.id}:`, err);
    }
  }
}
