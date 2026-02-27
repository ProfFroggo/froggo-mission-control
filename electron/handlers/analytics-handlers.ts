/**
 * Analytics & Token Tracking Handlers Module
 *
 * Channels: analytics:getData/subtaskStats/heatmap/timeTracking,
 * tokens:summary/log/budget, get-performance-report, get-agent-audit,
 * get-dm-history, get-circuit-status
 *
 * 11 registerHandler calls total.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import { registerModuleHandler } from '../ipc-registry';
import { prepare, getSessionsDb } from '../database';
import { safeLog } from '../logger';
import { FROGGO_DB_CLI } from '../paths';

export function registerAnalyticsHandlers(): void {
  registerModuleHandler('froggo-analytics', 'analytics:getData', async (_event, timeRange: string) => {
    try {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const completions = prepare(`SELECT date(updated_at/1000, 'unixepoch') as date, COUNT(*) as tasks_completed FROM tasks WHERE status = 'done' AND (cancelled IS NULL OR cancelled = 0) AND updated_at >= (strftime('%s', 'now', '-${days} days') * 1000) GROUP BY date ORDER BY date`).all();
      const created = prepare(`SELECT date(created_at/1000, 'unixepoch') as date, COUNT(*) as tasks_created FROM tasks WHERE (cancelled IS NULL OR cancelled = 0) AND created_at >= (strftime('%s', 'now', '-${days} days') * 1000) GROUP BY date ORDER BY date`).all();
      const agents = prepare(`SELECT assigned_to as agent, COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed FROM tasks WHERE (cancelled IS NULL OR cancelled = 0) AND assigned_to IS NOT NULL AND assigned_to != '' AND created_at >= (strftime('%s', 'now', '-${days} days') * 1000) GROUP BY assigned_to ORDER BY total DESC`).all();
      const projects = prepare(`SELECT project, COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed, ROUND(CAST(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100, 1) as completion_rate FROM tasks WHERE (cancelled IS NULL OR cancelled = 0) AND project IS NOT NULL AND project != '' AND created_at >= (strftime('%s', 'now', '-${days} days') * 1000) GROUP BY project ORDER BY total DESC LIMIT 10`).all();
      return { success: true, completions, created, agents, projects, days };
    } catch (error: any) {
      safeLog.error('[analytics:getData] Error:', error.message);
      return { success: true, completions: [], created: [], agents: [], projects: [], days: 0 };
    }
  });

  registerModuleHandler('froggo-analytics', 'analytics:subtaskStats', async () => {
    try {
      const data = prepare(`SELECT t.id as taskId, t.title as taskTitle, COUNT(s.id) as totalSubtasks, SUM(CASE WHEN s.completed = 1 THEN 1 ELSE 0 END) as completedSubtasks, ROUND(CASE WHEN COUNT(s.id) > 0 THEN CAST(SUM(CASE WHEN s.completed = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(s.id) * 100 ELSE 0 END, 2) as completionRate FROM tasks t LEFT JOIN subtasks s ON t.id = s.task_id WHERE t.status != 'done' AND (t.cancelled IS NULL OR t.cancelled = 0) GROUP BY t.id, t.title HAVING COUNT(s.id) > 0 ORDER BY completionRate ASC`).all();
      return { success: true, data };
    } catch (error: any) { safeLog.error('[analytics:subtaskStats] Error:', error.message); return { success: true, data: [] }; }
  });

  registerModuleHandler('froggo-analytics', 'analytics:heatmap', async (_event, days: number = 30) => {
    try {
      const data = prepare(`SELECT date(timestamp / 1000, 'unixepoch') as date, CAST(strftime('%w', timestamp / 1000, 'unixepoch') AS INTEGER) as dayOfWeek, CAST(strftime('%H', timestamp / 1000, 'unixepoch') AS INTEGER) as hour, COUNT(*) as activityCount FROM task_activity WHERE timestamp >= (strftime('%s', 'now', '-${days} days') * 1000) GROUP BY date, dayOfWeek, hour ORDER BY date, hour`).all();
      return { success: true, data };
    } catch (error: any) { safeLog.error('[analytics:heatmap] Error:', error.message); return { success: true, data: [] }; }
  });

  registerModuleHandler('froggo-analytics', 'analytics:timeTracking', async (_event, projectFilter?: string) => {
    try {
      let query = `SELECT id as taskId, title as taskTitle, COALESCE(project, 'Uncategorized') as project, COALESCE(assigned_to, 'Unassigned') as agent, started_at as startTime, completed_at as endTime, CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL THEN completed_at - started_at WHEN started_at IS NOT NULL AND status = 'in-progress' THEN (strftime('%s','now') * 1000) - started_at ELSE NULL END as duration, status FROM tasks WHERE (cancelled IS NULL OR cancelled = 0) AND started_at IS NOT NULL`;
      if (projectFilter && projectFilter !== 'all') {
        query += ` AND project = ?`;
        query += ` ORDER BY started_at DESC`;
        return { success: true, data: prepare(query).all(projectFilter) };
      } else {
        query += ` ORDER BY started_at DESC`;
        return { success: true, data: prepare(query).all() };
      }
    } catch (error: any) { safeLog.error('[analytics:timeTracking] Error:', error.message); return { success: true, data: [] }; }
  });

  registerModuleHandler('froggo-analytics', 'tokens:summary', async (_event, args?: { agent?: string; period?: string }) => {
    try {
      const sdb = getSessionsDb();
      if (!sdb) return { error: 'sessions.db not found', by_agent: [] };
      const now = Date.now();
      let minTimestamp = 0;
      if (args?.period === 'day') minTimestamp = now - (24 * 60 * 60 * 1000);
      else if (args?.period === 'week') minTimestamp = now - (7 * 24 * 60 * 60 * 1000);
      else if (args?.period === 'month') minTimestamp = now - (30 * 24 * 60 * 60 * 1000);
      let query = 'SELECT agent_id, model, input_tokens, output_tokens, total_tokens, created_at FROM sessions';
      const params: any[] = [];
      const whereClauses: string[] = [];
      if (minTimestamp > 0) { whereClauses.push('created_at >= ?'); params.push(minTimestamp); }
      if (args?.agent) { whereClauses.push('agent_id = ?'); params.push(args.agent); }
      if (whereClauses.length) query += ' WHERE ' + whereClauses.join(' AND ');
      const rows = sdb.prepare(query).all(...params) as any[];
      const pricing: Record<string, { input: number; output: number }> = {
        'claude-sonnet-4-5': { input: 3.0, output: 15.0 }, 'claude-opus-4': { input: 15.0, output: 75.0 },
        'gemini-2.0-flash-exp': { input: 0.0, output: 0.0 }, 'o1-preview': { input: 15.0, output: 60.0 },
        'o1-mini': { input: 3.0, output: 12.0 }, 'gpt-4o': { input: 2.5, output: 10.0 }, 'gpt-4o-mini': { input: 0.15, output: 0.6 },
      };
      const agentStats = new Map<string, { input: number; output: number; total: number; cost: number; calls: number }>();
      for (const row of rows) {
        const agent = row.agent_id || 'unknown';
        const inputTokens = row.input_tokens || 0;
        const outputTokens = row.output_tokens || 0;
        const totalTokens = row.total_tokens || 0;
        const modelKey = row.model || 'claude-sonnet-4-5';
        const modelPricing = pricing[modelKey] || pricing['claude-sonnet-4-5'];
        const cost = (inputTokens / 1000000) * modelPricing.input + (outputTokens / 1000000) * modelPricing.output;
        const stats = agentStats.get(agent) || { input: 0, output: 0, total: 0, cost: 0, calls: 0 };
        stats.input += inputTokens; stats.output += outputTokens; stats.total += totalTokens; stats.cost += cost; stats.calls += 1;
        agentStats.set(agent, stats);
      }
      const by_agent = Array.from(agentStats.entries()).map(([agent, stats]) => ({
        agent, total_input: stats.input, total_output: stats.output, total_all: stats.total, total_cost: stats.cost, calls: stats.calls,
      })).sort((a, b) => b.total_all - a.total_all);
      return { by_agent, period: args?.period || 'all' };
    } catch (err: any) { return { error: err.message, by_agent: [] }; }
  });

  registerModuleHandler('froggo-analytics', 'tokens:log', async (_event, args?: { agent?: string; limit?: number; since?: number }) => {
    try {
      const sdb = getSessionsDb();
      if (!sdb) return { error: 'sessions.db not found', entries: [] };
      const limit = args?.limit || 100;
      let query = 'SELECT session_id, agent_id, model, input_tokens, output_tokens, total_tokens, created_at, updated_at FROM sessions';
      const params: any[] = [];
      const whereClauses: string[] = [];
      if (args?.agent) { whereClauses.push('agent_id = ?'); params.push(args.agent); }
      if (args?.since && args.since > 0) { whereClauses.push('created_at >= ?'); params.push(args.since); }
      if (whereClauses.length > 0) query += ' WHERE ' + whereClauses.join(' AND ');
      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);
      const rows = sdb.prepare(query).all(...params) as any[];
      return { entries: rows.map(row => ({ id: row.session_id, timestamp: row.created_at, agent: row.agent_id || 'unknown', session_id: row.session_id, model: row.model || 'unknown', input_tokens: row.input_tokens || 0, output_tokens: row.output_tokens || 0, total_tokens: row.total_tokens || 0 })) };
    } catch (err: any) { return { error: err.message, entries: [] }; }
  });

  registerModuleHandler('froggo-analytics', 'tokens:budget', async (_event, agent: string) => {
    try {
      const budgetRow = prepare(`SELECT daily_token_limit, alert_threshold, hard_limit FROM token_budgets WHERE agent_id = ?`).get(agent) as any;
      if (!budgetRow) return { agent, daily_limit: 0, used_today: 0, remaining: 0, percentage_used: 0, percent_used: 0, alert_threshold: 0.9, over_budget: false, hard_limit: false };
      const startOfDay = new Date().setHours(0, 0, 0, 0);
      let usedToday = 0;
      const sdb = getSessionsDb();
      if (sdb) { try { const usageRow = sdb.prepare('SELECT SUM(total_tokens) as total FROM sessions WHERE agent_id = ? AND created_at >= ?').get(agent, startOfDay) as any; usedToday = usageRow?.total || 0; } catch { usedToday = 0; } }
      const dailyLimit = budgetRow.daily_token_limit || 0;
      const remaining = Math.max(0, dailyLimit - usedToday);
      const percentageUsed = dailyLimit > 0 ? usedToday / dailyLimit : 0;
      return { agent, daily_limit: dailyLimit, used_today: usedToday, remaining, percentage_used: percentageUsed, percent_used: percentageUsed, alert_threshold: budgetRow.alert_threshold || 0.9, over_budget: usedToday > dailyLimit && budgetRow.hard_limit === 1, hard_limit: budgetRow.hard_limit === 1 };
    } catch (err: any) { return { error: err.message }; }
  });

  registerModuleHandler('froggo-analytics', 'get-performance-report', async (_event, args?: { days?: number }) => {
    try {
      const days = args?.days || 30;
      const result = execSync(`${FROGGO_DB_CLI} performance-report --days ${days} --json`, { encoding: 'utf-8', timeout: 10000, env: { ...process.env, PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin' } });
      return JSON.parse(result);
    } catch (err: any) { return { error: err.message, agents: [] }; }
  });

  registerModuleHandler('froggo-analytics', 'get-agent-audit', async (_event, args: { agentId: string; days?: number }) => {
    try {
      const days = args.days || 30;
      const result = execSync(`${FROGGO_DB_CLI} agent-audit ${args.agentId} --days ${days} --json`, { encoding: 'utf-8', timeout: 10000, env: { ...process.env, PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin' } });
      return JSON.parse(result);
    } catch (err: any) { return { error: err.message, timeline: [] }; }
  });

  registerModuleHandler('froggo-analytics', 'get-dm-history', async (_event, args?: { limit?: number; agent?: string }) => {
    try {
      const limit = args?.limit || 50;
      return prepare('SELECT id, correlation_id, from_agent, to_agent, message_type, subject, body, status, created_at, read_at FROM agent_messages ORDER BY created_at DESC LIMIT ?').all(limit);
    } catch (e: any) { safeLog.error('get-dm-history error:', e); return []; }
  });

  registerModuleHandler('froggo-analytics', 'get-circuit-status', async () => {
    try {
      const stateFile = path.join(os.homedir(), '.openclaw', 'dispatcher-state.json');
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      return state.circuit_breakers || {};
    } catch (_e) { return {}; }
  });
}
