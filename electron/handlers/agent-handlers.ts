/**
 * Agent & Gateway & Session Handlers Module
 *
 * Channels: gateway:getToken, agents:list, agents:getActiveSessions,
 * agents:getRegistry, agents:getMetrics, agents:getDetails, agents:addSkill,
 * agents:updateSkill, agents:search, agents:spawnForTask, agents:spawnChat,
 * agents:chat, agents:create, sessions:list, get-agent-registry,
 * widget:scan-manifest
 *
 * 16 registerHandler calls total.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { registerHandler } from '../ipc-registry';
import { prepare } from '../database';
import { safeLog } from '../logger';
import { validateAgentName } from '../ipc-validation';
import {
  PROJECT_ROOT, SCRIPTS_DIR, FROGGO_DB,
  OPENCLAW_CONFIG, OPENCLAW_CONFIG_LEGACY, agentWorkspace,
} from '../paths';

const OPENCLAW = '/opt/homebrew/bin/openclaw';

// ── Agent registry helpers ──

interface AgentRegistryEntry {
  role: string;
  description: string;
  capabilities: string[];
  prompt: string;
  aliases: string[];
  clawdAgentId: string;
}

function loadAgentRegistry(): Record<string, AgentRegistryEntry> {
  const registryPath = path.join(path.dirname(__dirname), 'dist-electron', 'agent-registry.json');
  // Fallback: try relative to __dirname
  const altPath = path.join(__dirname, '..', 'agent-registry.json');
  const finalPath = fs.existsSync(registryPath) ? registryPath : altPath;
  try {
    const data = JSON.parse(fs.readFileSync(finalPath, 'utf-8'));
    return data.agents || {};
  } catch (err) {
    safeLog.error('Failed to load agent registry, using empty:', err);
    return {};
  }
}

// Extend global type for agent registry cache
declare global { var _agentRegistryCache: Record<string, AgentRegistryEntry> | undefined; var _agentRegistryCacheTime: number | undefined; }

function getAgentRegistry(): Record<string, AgentRegistryEntry> {
  const now = Date.now();
  if (!globalThis._agentRegistryCache || now - (globalThis._agentRegistryCacheTime || 0) > 60000) {
    globalThis._agentRegistryCache = loadAgentRegistry();
    globalThis._agentRegistryCacheTime = now;
  }
  return globalThis._agentRegistryCache;
}

function getAgentsFromDB(): Record<string, unknown>[] {
  try {
    const rows = prepare(`SELECT id, name, role, description, color, image_path, status, trust_tier FROM agent_registry WHERE status IN ('active', 'disabled', 'training') ORDER BY name`).all() as Record<string, unknown>[];
    return rows.map((r) => ({
      id: r['id'],
      identityName: r['name'] || r['id'],
      identityEmoji: '\u{1F916}',
      description: r['role'] || r['description'] || '',
      workspace: agentWorkspace(r['id'] as string),
      model: '',
      isDefault: r['id'] === 'froggo',
    }));
  } catch (e: unknown) {
    safeLog.error('[Agents] DB fallback failed:', e instanceof Error ? e.message : String(e));
    return [];
  }
}

// Debug file logger for agent issues
const debugLogPath = '/tmp/froggo-dashboard-debug.log';
function debugLog(...args: unknown[]) {
  try {
    const ts = new Date().toISOString();
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    fs.appendFileSync(debugLogPath, `[${ts}] ${msg}\n`);
  } catch (_e) { /* ignore */ }
}

export function registerAgentHandlers(): void {
  registerHandler('gateway:getToken', async () => {
    const configPaths = [OPENCLAW_CONFIG, OPENCLAW_CONFIG_LEGACY];
    for (const cfgPath of configPaths) {
      try {
        if (fs.existsSync(cfgPath)) {
          const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
          const token = cfg.gateway?.controlUi?.auth?.token || cfg.gateway?.auth?.token;
          if (token) return token;
        }
      } catch (err) { safeLog.debug('[GatewayToken] Config read failed:', err); }
    }
    return '';
  });

  registerHandler('agents:list', async () => {
    return new Promise((resolve) => {
      execFile(OPENCLAW, ['agents', 'list', '--json'], { timeout: 10000, env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` } }, (error, stdout) => {
        if (error) {
          safeLog.warn('[Agents] CLI failed, falling back to DB:', error.message);
          const agents = getAgentsFromDB();
          safeLog.log(`[Agents] Loaded ${agents.length} agents from DB fallback`);
          resolve({ success: agents.length > 0, agents });
          return;
        }
        try {
          const rawAgents = JSON.parse(stdout || '[]');
          if (rawAgents.length === 0) {
            safeLog.warn('[Agents] CLI returned empty, falling back to DB');
            const agents = getAgentsFromDB();
            resolve({ success: agents.length > 0, agents });
            return;
          }
          safeLog.log(`[Agents] Loaded ${rawAgents.length} agents from gateway`);
          resolve({ success: true, agents: rawAgents });
        } catch (parseError: unknown) {
          safeLog.warn('[Agents] Parse failed, falling back to DB:', parseError instanceof Error ? parseError.message : String(parseError));
          const agents = getAgentsFromDB();
          resolve({ success: agents.length > 0, agents });
        }
      });
    });
  });

  registerHandler('sessions:list', async (_event, activeMinutes?: number) => {
    return new Promise((resolve) => {
      const args = ['sessions', 'list', '--json'];
      if (activeMinutes) args.push('--active', String(activeMinutes));
      execFile(OPENCLAW, args, { timeout: 10000, env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` } }, (error, stdout) => {
        if (error) {
          safeLog.warn('[Sessions] CLI failed:', error.message);
          resolve({ success: false, error: error.message, sessions: [] });
          return;
        }
        try {
          const data = JSON.parse(stdout || '{}');
          safeLog.log(`[Sessions] Loaded ${data.sessions?.length || 0} sessions from gateway`);
          resolve({ success: true, sessions: data.sessions || [], count: data.count || 0, path: data.path });
        } catch (parseError: unknown) {
          const msg = parseError instanceof Error ? parseError.message : String(parseError);
          safeLog.warn('[Sessions] Parse failed:', msg);
          resolve({ success: false, error: msg, sessions: [] });
        }
      });
    });
  });

  registerHandler('get-agent-registry', async () => {
    try {
      const agents = prepare(`SELECT id, name, role, description, color, image_path, status, trust_tier FROM agent_registry WHERE status IN ('active', 'disabled', 'training') ORDER BY name`).all();
      safeLog.log(`[AgentRegistry] Loaded ${agents.length} agents from DB`);
      return agents;
    } catch (error: unknown) {
      safeLog.error('[AgentRegistry] Error:', error instanceof Error ? error.message : String(error));
      return [];
    }
  });

  registerHandler('widget:scan-manifest', async (_event, agentId: string) => {
    try {
      if (!agentId || agentId.includes('..') || agentId.includes('/') || agentId.includes('\\')) {
        safeLog.warn('[WidgetManifest] Invalid agentId:', agentId);
        return { error: 'Invalid agent ID' };
      }
      const manifestPath = path.join(os.homedir(), '.openclaw', 'agents', agentId, 'widgets', 'widget-manifest.json');
      if (!fs.existsSync(manifestPath)) return { error: 'Manifest not found' };
      const allowedDir = path.join(os.homedir(), '.openclaw', 'agents');
      const resolvedPath = path.resolve(manifestPath);
      if (!resolvedPath.startsWith(allowedDir)) {
        safeLog.error('[WidgetManifest] Path traversal attempt:', manifestPath);
        return { error: 'Invalid manifest path' };
      }
      let manifest: Record<string, unknown>;
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      } catch (parseError) {
        safeLog.error('[WidgetManifest] Failed to parse manifest JSON:', parseError);
        return { error: 'Invalid manifest JSON' };
      }
      const widgetDir = path.dirname(manifestPath);
      if (manifest.widgets && Array.isArray(manifest.widgets)) {
        for (const widget of manifest.widgets) {
          if (widget.component) {
            const componentPath = path.resolve(widgetDir, widget.component);
            if (!componentPath.startsWith(widgetDir)) {
              safeLog.error('[WidgetManifest] Component path escapes directory:', widget.component);
              return { error: 'Invalid component path' };
            }
          }
        }
      }
      safeLog.log(`[WidgetManifest] Loaded manifest for ${agentId}`);
      return manifest;
    } catch (err: unknown) {
      safeLog.error('[WidgetManifest] Error reading manifest:', err.message);
      return { error: err.message };
    }
  });

  registerHandler('agents:getActiveSessions', async () => {
    try {
      const result = await new Promise<string>((resolve, reject) => {
        execFile(OPENCLAW, ['sessions', 'list', '--kinds', 'agent', '--limit', '50', '--json'], { encoding: 'utf-8', timeout: 5000, env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` } }, (error, stdout, stderr) => {
          if (error) reject(new Error(stderr || error.message));
          else resolve(stdout.trim());
        });
      });
      let data: { sessions?: Array<{ key: string; updatedAt?: number }> } = { sessions: [] };
      try { data = JSON.parse(result); } catch (parseError) { safeLog.error('[ActiveSessions] Failed to parse sessions JSON:', parseError); return []; }
      const sessions = data.sessions || [];
      const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
      const activeSessions = sessions
        .filter((s) => s.updatedAt && s.updatedAt > twoMinutesAgo)
        .map((s) => {
          const parts = s.key.split(':');
          return { agentId: parts[1], sessionKey: s.key, sessionType: parts[2] || 'main', updatedAt: s.updatedAt, totalTokens: (s as Record<string, unknown>)['totalTokens'] || 0, isActive: true };
        });
      return { success: true, sessions: activeSessions };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      safeLog.error('[agents:getActiveSessions] Error:', msg);
      return { success: false, sessions: [], error: msg };
    }
  });

  registerHandler('agents:getRegistry', async () => {
    const registry = getAgentRegistry();
    const result: Record<string, unknown> = {};
    for (const [id, entry] of Object.entries(registry)) {
      if (id === 'froggo') continue;
      result[id] = { role: entry.role || 'Agent', description: (entry as Record<string, unknown>)['description'] as string || '', capabilities: entry.capabilities || [], aliases: entry.aliases || [], clawdAgentId: entry.clawdAgentId || id };
    }
    return result;
  });

  registerHandler('agents:getMetrics', async () => {
    let agents: string[] = [];
    try {
      const rows = prepare(`SELECT id FROM agent_registry WHERE status = 'active' ORDER BY id`).all() as Record<string, unknown>[];
      agents = rows.map(r => r['id'] as string).filter(id => id !== 'froggo');
    } catch (e) {
      safeLog.error('[agents:getMetrics] Failed to load agents from DB:', e);
      const registry = getAgentRegistry();
      agents = Object.keys(registry).filter(id => id !== 'froggo');
    }
    const metrics: Record<string, Record<string, unknown>> = {};
    const metricsScriptPath = path.join(SCRIPTS_DIR, 'agent-metrics.sh');
    for (const agentId of agents) {
      try {
        const result = await new Promise<string>((resolve, reject) => {
          execFile(metricsScriptPath, [agentId], {
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
            timeout: 15000,
            env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` },
          }, (error, stdout) => {
            if (error) reject(error);
            else resolve(stdout);
          });
        });
        const data = JSON.parse(result);
        const m = data.metrics || {};
        const sm = data.subtask_metrics || {};
        const am = data.activity_metrics || {};
        const trend = data.performance_trend || [];
        metrics[agentId] = {
          totalTasks: m.total_tasks || 0, completedTasks: m.completed_tasks || 0, inProgressTasks: m.in_progress_tasks || 0, reviewTasks: m.review_tasks || 0, blockedTasks: m.blocked_tasks || 0,
          completionRate: m.completion_rate || 0, avgTaskTimeHours: m.avg_task_time_hours || 0, reviewSuccessRate: m.review_success_rate || 0, completedLast7Days: m.completed_last_7_days || 0,
          p0Tasks: m.p0_tasks || 0, p1Tasks: m.p1_tasks || 0, p2Tasks: m.p2_tasks || 0, p3Tasks: m.p3_tasks || 0,
          totalSubtasks: sm.total_subtasks || 0, completedSubtasks: sm.completed_subtasks || 0, subtaskCompletionRate: sm.subtask_completion_rate || 0,
          totalActivities: am.total_activities || 0, completionActions: am.completion_actions || 0, blockedActions: am.blocked_actions || 0, progressUpdates: am.progress_updates || 0, lastActivityTimestamp: am.last_activity_timestamp || null,
          performanceTrend: trend, successRate: (m.completion_rate || 0) / 100, avgTime: m.avg_task_time_hours ? `${m.avg_task_time_hours}h` : 'N/A',
        };
      } catch (e: unknown) {
        safeLog.error(`[agents:getMetrics] Failed for ${agentId}:`, e instanceof Error ? e.message : String(e));
        metrics[agentId] = { totalTasks: 0, completedTasks: 0, completionRate: 0, avgTaskTimeHours: 0, successRate: 0, avgTime: 'N/A' };
      }
    }
    // Clara special handling
    if (agents.includes('clara')) {
      try {
        const reviewMetrics = prepare(`SELECT COUNT(*) as total_reviews, SUM(CASE WHEN reviewStatus = 'approved' THEN 1 ELSE 0 END) as approved, SUM(CASE WHEN reviewStatus = 'rejected' THEN 1 ELSE 0 END) as rejected, SUM(CASE WHEN reviewStatus = 'pending' THEN 1 ELSE 0 END) as pending, ROUND(CAST(SUM(CASE WHEN reviewStatus = 'approved' THEN 1 ELSE 0 END) AS FLOAT) / NULLIF(SUM(CASE WHEN reviewStatus IN ('approved', 'rejected') THEN 1 ELSE 0 END), 0) * 100, 1) as approval_rate FROM tasks WHERE reviewerId = 'clara' AND reviewStatus IS NOT NULL`).get() as Record<string, unknown>;
        const recentReviews = prepare(`SELECT COUNT(*) as recent_reviews FROM tasks WHERE reviewerId = 'clara' AND reviewStatus IN ('approved', 'rejected') AND updated_at > (strftime('%s','now') - 7*24*60*60) * 1000`).get() as Record<string, unknown>;
        const rm = reviewMetrics || {};
        const rr = recentReviews || {};
        metrics['clara'] = {
          totalTasks: rm['total_reviews'] || 0, completedTasks: ((rm['approved'] as number) || 0) + ((rm['rejected'] as number) || 0), inProgressTasks: rm['pending'] || 0, reviewTasks: rm['pending'] || 0, blockedTasks: 0,
          completionRate: rm['approval_rate'] || 0, avgTaskTimeHours: 0, reviewSuccessRate: rm['approval_rate'] || 0, completedLast7Days: rr['recent_reviews'] || 0,
          p0Tasks: 0, p1Tasks: 0, p2Tasks: 0, p3Tasks: 0, totalSubtasks: 0, completedSubtasks: 0, subtaskCompletionRate: 0,
          totalActivities: rm['total_reviews'] || 0, completionActions: ((rm['approved'] as number) || 0) + ((rm['rejected'] as number) || 0), blockedActions: 0, progressUpdates: 0, lastActivityTimestamp: null, performanceTrend: [],
          successRate: ((rm['approval_rate'] as number) || 0) / 100, avgTime: 'N/A',
          claraMetrics: { totalReviews: rm['total_reviews'] || 0, approved: rm['approved'] || 0, rejected: rm['rejected'] || 0, pending: rm['pending'] || 0, approvalRate: rm['approval_rate'] || 0 },
        };
      } catch (e) { safeLog.error('Failed to get Clara review metrics:', e); }
    }
    return metrics;
  });

  registerHandler('agents:getDetails', async (_event, agentId: string) => {
    safeLog.log(`[agents:getDetails] Called with agentId: ${agentId}`);
    debugLog(`[agents:getDetails] Called with agentId: ${agentId}`);
    const validAgent = validateAgentName(agentId);
    if (!validAgent) return { success: false, error: 'Invalid agent ID' };
    const agentAliases: Record<string, string[]> = { main: ['main', 'froggo'], froggo: ['main', 'froggo'], coder: ['coder'], researcher: ['researcher'], writer: ['writer'], chief: ['chief'], onchain_worker: ['onchain_worker'] };
    const dbIds = agentAliases[validAgent] || [validAgent];
    const placeholders = dbIds.map(() => '?').join(',');
    let taskStats = { total: 0, completed: 0 };
    let recentTasks: Record<string, unknown>[] = [];
    let skills: Record<string, unknown>[] = [];
    let brainNotes: string[] = [];
    let agentRules = 'AGENT.md not found';
    try {
      const taskStatsRow = prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed FROM tasks WHERE assigned_to IN (${placeholders}) AND (cancelled IS NULL OR cancelled = 0)`).get(...dbIds) as Record<string, unknown>;
      taskStats = { total: (taskStatsRow?.['total'] as number) || 0, completed: (taskStatsRow?.['completed'] as number) || 0 };
    } catch (e: unknown) { safeLog.error(`[agents:getDetails] taskStats query failed for ${validAgent}:`, e instanceof Error ? e.message : String(e)); }
    try {
      const recentTasksRows = prepare(`SELECT id, title, status, completed_at, metadata FROM tasks WHERE assigned_to IN (${placeholders}) AND (cancelled IS NULL OR cancelled = 0) ORDER BY COALESCE(completed_at, updated_at) DESC LIMIT 10`).all(...dbIds) as Record<string, unknown>[];
      recentTasks = (recentTasksRows || []).map((task) => {
        let outcome = 'unknown';
        try { const metadata = task['metadata'] ? JSON.parse(task['metadata'] as string) : {}; outcome = metadata.outcome || (task['status'] === 'done' ? 'success' : 'ongoing'); } catch (_e) { outcome = task['status'] === 'done' ? 'success' : 'ongoing'; }
        return { ...task, outcome, completedAt: task['completed_at'] };
      });
    } catch (e: unknown) { safeLog.error(`[agents:getDetails] recentTasks query failed for ${validAgent}:`, e instanceof Error ? e.message : String(e)); }
    try {
      const skillsRows = prepare('SELECT skill_name as name, proficiency, last_used, success_count, failure_count FROM skill_evolution ORDER BY proficiency DESC').all() as Record<string, unknown>[];
      skills = (skillsRows || []).map((s) => ({ name: s['name'], proficiency: s['proficiency'], lastUsed: s['last_used'], successCount: s['success_count'], failureCount: s['failure_count'] }));
    } catch (e: unknown) { safeLog.error(`[agents:getDetails] skills query failed for ${validAgent}:`, e instanceof Error ? e.message : String(e)); }
    try {
      const brainNotesRows = prepare("SELECT description FROM learning_events WHERE outcome IN ('insight', 'pattern') ORDER BY timestamp DESC LIMIT 20").all() as Record<string, unknown>[];
      brainNotes = (brainNotesRows || []).map((row) => row['description'] as string);
    } catch (e: unknown) { safeLog.error(`[agents:getDetails] brainNotes query failed for ${validAgent}:`, e instanceof Error ? e.message : String(e)); }
    try {
      const agentMdPath = path.join(PROJECT_ROOT, 'agents', validAgent, 'AGENT.md');
      agentRules = fs.readFileSync(agentMdPath, 'utf-8');
    } catch (_e) {
      try {
        const altPaths = [path.join(PROJECT_ROOT, 'agents', validAgent.toLowerCase(), 'AGENT.md'), ...dbIds.filter(id => id !== validAgent).map(id => path.join(PROJECT_ROOT, 'agents', id, 'AGENT.md'))];
        for (const altPath of altPaths) { if (fs.existsSync(altPath)) { agentRules = fs.readFileSync(altPath, 'utf-8'); break; } }
      } catch (_e2) { /* keep default */ }
    }
    const successRate = taskStats.total > 0 ? taskStats.completed / taskStats.total : 0;
    return { success: true, successRate, avgTime: '2.5h', totalTasks: taskStats.total, successfulTasks: taskStats.completed || 0, failedTasks: taskStats.total - (taskStats.completed || 0), skills, recentTasks, brainNotes, agentRules };
  });

  registerHandler('agents:addSkill', async (_event, agentId: string, skill: string) => {
    try {
      prepare("INSERT INTO skill_evolution (skill_name, proficiency, success_count, failure_count) VALUES (?, 0.5, 0, 0) ON CONFLICT(skill_name) DO UPDATE SET updated_at = datetime('now')").run(skill);
      return { success: true };
    } catch (error: unknown) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
  });

  registerHandler('agents:updateSkill', async (_event, agentId: string, skillName: string, proficiency: number) => {
    try {
      prepare("UPDATE skill_evolution SET proficiency = ?, updated_at = datetime('now') WHERE skill_name = ?").run(proficiency, skillName);
      return { success: true };
    } catch (error: unknown) { return { success: false, error: error instanceof Error ? error.message : String(error) }; }
  });

  registerHandler('agents:search', async (_event, query: string) => {
    const registry = getAgentRegistry();
    const agentDefinitions: Record<string, { role: string; description: string; capabilities: string[] }> = {};
    for (const [id, entry] of Object.entries(registry)) {
      agentDefinitions[id] = { role: entry.role, description: entry.description, capabilities: entry.capabilities };
    }
    const q = query.toLowerCase();
    const results: Record<string, unknown>[] = [];
    for (const [agentIdLoop, def] of Object.entries(agentDefinitions)) {
      const searchable = `${agentIdLoop} ${def.role} ${def.description} ${def.capabilities.join(' ')}`.toLowerCase();
      if (searchable.includes(q)) {
        let taskCount = 0; let recentTask = ''; let status = 'idle';
        try {
          const agentEntry = registry[agentIdLoop];
          const dbIdsArr = agentEntry?.aliases || [agentIdLoop];
          const ph = dbIdsArr.map(() => '?').join(',');
          const countRow = prepare(`SELECT COUNT(*) as cnt FROM tasks WHERE assigned_to IN (${ph})`).get(...dbIdsArr) as Record<string, unknown>;
          taskCount = (countRow?.['cnt'] as number) || 0;
          const activeRow = prepare(`SELECT COUNT(*) as cnt FROM tasks WHERE assigned_to IN (${ph}) AND status IN ('in-progress','todo')`).get(...dbIdsArr) as Record<string, unknown>;
          status = ((activeRow?.['cnt'] as number) || 0) > 0 ? 'active' : 'idle';
          const recentRow = prepare(`SELECT title FROM tasks WHERE assigned_to IN (${ph}) ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 1`).get(...dbIdsArr) as Record<string, unknown>;
          recentTask = (recentRow?.['title'] as string) || '';
        } catch (_e) { /* DB query failed, continue with defaults */ }
        results.push({ id: agentIdLoop, name: agentIdLoop.charAt(0).toUpperCase() + agentIdLoop.slice(1).replace(/_/g, ' '), role: def.role, description: def.description, capabilities: def.capabilities, taskCount, recentTask, status });
      }
    }
    return { success: true, agents: results };
  });

  registerHandler('agents:spawnForTask', async (_event, taskId: string, agentId: string) => {
    try {
      const result = await new Promise<string>((resolve, reject) => {
        execFile(OPENCLAW, ['agent', '--agent', agentId, '--message', `Task assigned: ${taskId}`, '--json'], { encoding: 'utf-8', timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` } }, (error, stdout, stderr) => {
          if (error) reject(new Error(stderr || error.message)); else resolve(stdout.trim());
        });
      });
      return { success: true, output: result };
    } catch (error: unknown) {
      safeLog.error('[agents:spawnForTask] Error:', error.message);
      return { success: false, error: error.message };
    }
  });

  registerHandler('agents:spawnChat', async (_event, agentId: string) => {
    safeLog.log(`[agents:spawnChat] Called with agentId: ${agentId}`);
    debugLog(`[agents:spawnChat] Called with agentId: ${agentId}`);
    try {
      const sessionKey = `agent:${agentId}:dashboard`;
      try {
        await new Promise<void>((resolve, reject) => {
          execFile(OPENCLAW, ['sessions', 'list', '--json'], { timeout: 10000, env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` } }, (error, stdout) => {
            if (error) { reject(error); return; }
            try {
              const sessions = JSON.parse(stdout);
              const sessionExists = sessions.sessions?.some((s: Record<string, unknown>) => s['key'] === sessionKey);
              if (!sessionExists) {
                safeLog.log(`[agents:spawnChat] Session ${sessionKey} not found, spawning...`);
                const chatRegistry = getAgentRegistry();
                const systemPrompt = chatRegistry[agentId]?.prompt || `You are the ${agentId} agent. Help the user with tasks related to your role.`;
                const spawnMsg = `${systemPrompt}\n\nYou are now connected to the dashboard chat. Reply with: ready`;
                execFile(OPENCLAW, ['agent', '--agent', agentId, '--message', spawnMsg, '--json'], { timeout: 30000, env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` } }, (spawnError) => {
                  if (spawnError) { safeLog.error(`[agents:spawnChat] Spawn failed:`, spawnError.message); reject(spawnError); }
                  else { safeLog.log(`[agents:spawnChat] Session ${sessionKey} spawned successfully`); resolve(); }
                });
              } else { safeLog.log(`[agents:spawnChat] Session ${sessionKey} already exists`); resolve(); }
            } catch (parseError) { reject(parseError); }
          });
        });
      } catch (checkError: unknown) { safeLog.warn(`[agents:spawnChat] Session check failed, continuing anyway:`, checkError instanceof Error ? checkError.message : String(checkError)); }
      return { success: true, sessionKey };
    } catch (error: unknown) {
      safeLog.error(`Failed to spawn chat for ${agentId}:`, error);
      const errMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errMsg || 'Failed to spawn chat session' };
    }
  });

  registerHandler('agents:chat', async (_event, sessionKey: string, message: string) => {
    safeLog.log(`[agents:chat] Called with sessionKey: ${sessionKey}, message length: ${message.length}`);
    try {
      const agentId = sessionKey.split(':')[1];
      if (!agentId) return { success: false, error: `Invalid sessionKey format: ${sessionKey}` };
      let response: string;
      try {
        const cliResult = await new Promise<string>((resolve, reject) => {
          execFile(OPENCLAW, ['agent', '--agent', agentId, '--message', message, '--json'], { encoding: 'utf-8', timeout: 120000, env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` } }, (error, stdout, stderr) => {
            if (error) reject(new Error(stderr || error.message)); else resolve(stdout.trim());
          });
        });
        let extracted = cliResult || '';
        try {
          const parsed = JSON.parse(extracted);
          const payloads = parsed?.result?.payloads;
          if (Array.isArray(payloads) && payloads.length > 0) extracted = (payloads as Record<string, unknown>[]).map((p) => (p['text'] as string) || '').join('\n').trim();
          if (!extracted && parsed?.result?.text) extracted = parsed.result.text;
        } catch { /* not JSON */ }
        response = extracted || 'No response from agent';
      } catch (cliErr: unknown) {
        const cliErrMsg = cliErr instanceof Error ? cliErr.message : String(cliErr);
        safeLog.error(`[agents:chat] CLI agent failed: ${cliErrMsg}`);
        response = `Agent unavailable: ${cliErrMsg}. Ensure openclaw gateway is running and the agent session is active.`;
      }
      return { success: true, response };
    } catch (error: unknown) {
      safeLog.error('Agent chat error:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errMsg || 'Unknown error', response: `Error: ${errMsg || 'Unknown error'}` };
    }
  });

  registerHandler('agents:create', async (_event, config: { id: string; name: string; role: string; emoji: string; color: string; personality: string; voice?: string }) => {
    const script = path.join(SCRIPTS_DIR, 'agent-onboard-full.sh');
    safeLog.log(`[agents:create] Creating agent: ${config.id} (${config.name})`);
    return new Promise((resolve) => {
      execFile('bash', [script, config.id, config.name, config.role, config.emoji, config.color, config.personality, config.voice || 'Puck'], { encoding: 'utf-8', timeout: 120000, env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` }, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) { safeLog.error(`[agents:create] Failed: ${error.message}`); resolve({ success: false, error: error.message, output: stdout || '', stderr: stderr || '' }); }
        else { safeLog.log(`[agents:create] Success for ${config.id}`); resolve({ success: true, output: stdout || '' }); }
      });
    });
  });
}
