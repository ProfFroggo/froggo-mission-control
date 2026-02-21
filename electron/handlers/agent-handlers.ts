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
import { exec, execSync, execFile } from 'child_process';
import { registerHandler } from '../ipc-registry';
import { prepare } from '../database';
import { safeLog } from '../logger';
import {
  PROJECT_ROOT, SCRIPTS_DIR, FROGGO_DB,
  OPENCLAW_CONFIG, OPENCLAW_CONFIG_LEGACY, agentWorkspace,
} from '../paths';

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

function getAgentRegistry(): Record<string, AgentRegistryEntry> {
  const now = Date.now();
  if (!(global as any)._agentRegistryCache || now - ((global as any)._agentRegistryCacheTime || 0) > 60000) {
    (global as any)._agentRegistryCache = loadAgentRegistry();
    (global as any)._agentRegistryCacheTime = now;
  }
  return (global as any)._agentRegistryCache;
}

function getAgentsFromDB(): any[] {
  try {
    const rows = prepare(`SELECT id, name, role, description, color, image_path, status, trust_tier FROM agent_registry WHERE status = 'active' ORDER BY name`).all() as any[];
    return rows.map((r: any) => ({
      id: r.id,
      identityName: r.name || r.id,
      identityEmoji: '\u{1F916}',
      description: r.role || r.description || '',
      workspace: agentWorkspace(r.id),
      model: '',
      isDefault: r.id === 'froggo',
    }));
  } catch (e: any) {
    safeLog.error('[Agents] DB fallback failed:', e.message);
    return [];
  }
}

// Debug file logger for agent issues
const debugLogPath = '/tmp/clawd-dashboard-debug.log';
function debugLog(...args: any[]) {
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
      exec('openclaw agents list --json', { timeout: 10000, env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` } }, (error, stdout) => {
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
        } catch (parseError: any) {
          safeLog.warn('[Agents] Parse failed, falling back to DB:', parseError.message);
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
      exec(`openclaw ${args.join(' ')}`, { timeout: 10000, env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` } }, (error, stdout) => {
        if (error) {
          safeLog.warn('[Sessions] CLI failed:', error.message);
          resolve({ success: false, error: error.message, sessions: [] });
          return;
        }
        try {
          const data = JSON.parse(stdout || '{}');
          safeLog.log(`[Sessions] Loaded ${data.sessions?.length || 0} sessions from gateway`);
          resolve({ success: true, sessions: data.sessions || [], count: data.count || 0, path: data.path });
        } catch (parseError: any) {
          safeLog.warn('[Sessions] Parse failed:', parseError.message);
          resolve({ success: false, error: parseError.message, sessions: [] });
        }
      });
    });
  });

  registerHandler('get-agent-registry', async () => {
    try {
      const agents = prepare(`SELECT id, name, role, description, color, image_path, status, trust_tier FROM agent_registry WHERE status = 'active' ORDER BY name`).all();
      safeLog.log(`[AgentRegistry] Loaded ${agents.length} agents from DB`);
      return agents;
    } catch (error: any) {
      safeLog.error('[AgentRegistry] Error:', error.message);
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
      let manifest: any;
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
    } catch (err: any) {
      safeLog.error('[WidgetManifest] Error reading manifest:', err.message);
      return { error: err.message };
    }
  });

  registerHandler('agents:getActiveSessions', async () => {
    try {
      const result = await new Promise<string>((resolve, reject) => {
        exec('openclaw sessions list --kinds agent --limit 50 --json', { encoding: 'utf-8', timeout: 5000, env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` } }, (error, stdout, stderr) => {
          if (error) reject(new Error(stderr || error.message));
          else resolve(stdout.trim());
        });
      });
      let data: { sessions?: Array<{ key: string; updatedAt?: number }> } = { sessions: [] };
      try { data = JSON.parse(result); } catch (parseError) { safeLog.error('[ActiveSessions] Failed to parse sessions JSON:', parseError); return []; }
      const sessions = data.sessions || [];
      const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
      const activeSessions = sessions
        .filter((s: any) => s.updatedAt && s.updatedAt > twoMinutesAgo)
        .map((s: any) => {
          const parts = s.key.split(':');
          return { agentId: parts[1], sessionKey: s.key, sessionType: parts[2] || 'main', updatedAt: s.updatedAt, totalTokens: s.totalTokens || 0, isActive: true };
        });
      return { success: true, sessions: activeSessions };
    } catch (error: any) {
      safeLog.error('[agents:getActiveSessions] Error:', error.message);
      return { success: false, sessions: [], error: error.message };
    }
  });

  registerHandler('agents:getRegistry', async () => {
    const registry = getAgentRegistry();
    const result: Record<string, any> = {};
    for (const [id, entry] of Object.entries(registry)) {
      if (id === 'froggo') continue;
      result[id] = { role: entry.role || 'Agent', description: (entry as any).description || '', capabilities: entry.capabilities || [], aliases: entry.aliases || [], clawdAgentId: entry.clawdAgentId || id };
    }
    return result;
  });

  registerHandler('agents:getMetrics', async () => {
    let agents: string[] = [];
    try {
      const rows = prepare(`SELECT id FROM agent_registry WHERE status = 'active' ORDER BY id`).all() as any[];
      agents = rows.map(r => r.id).filter(id => id !== 'froggo');
    } catch (e) {
      safeLog.error('[agents:getMetrics] Failed to load agents from DB:', e);
      const registry = getAgentRegistry();
      agents = Object.keys(registry).filter(id => id !== 'froggo');
    }
    const metrics: Record<string, any> = {};
    const metricsScriptPath = path.join(SCRIPTS_DIR, 'agent-metrics.sh');
    for (const agentId of agents) {
      try {
        const result = execSync(`"${metricsScriptPath}" "${agentId}"`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
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
      } catch (e) {
        safeLog.error(`Failed to get metrics for ${agentId}:`, e);
        metrics[agentId] = { totalTasks: 0, completedTasks: 0, completionRate: 0, avgTaskTimeHours: 0, successRate: 0, avgTime: 'N/A' };
      }
    }
    // Clara special handling
    if (agents.includes('clara')) {
      try {
        const reviewMetrics = prepare(`SELECT COUNT(*) as total_reviews, SUM(CASE WHEN reviewStatus = 'approved' THEN 1 ELSE 0 END) as approved, SUM(CASE WHEN reviewStatus = 'rejected' THEN 1 ELSE 0 END) as rejected, SUM(CASE WHEN reviewStatus = 'pending' THEN 1 ELSE 0 END) as pending, ROUND(CAST(SUM(CASE WHEN reviewStatus = 'approved' THEN 1 ELSE 0 END) AS FLOAT) / NULLIF(SUM(CASE WHEN reviewStatus IN ('approved', 'rejected') THEN 1 ELSE 0 END), 0) * 100, 1) as approval_rate FROM tasks WHERE reviewerId = 'clara' AND reviewStatus IS NOT NULL`).get() as any;
        const recentReviews = prepare(`SELECT COUNT(*) as recent_reviews FROM tasks WHERE reviewerId = 'clara' AND reviewStatus IN ('approved', 'rejected') AND updated_at > (strftime('%s','now') - 7*24*60*60) * 1000`).get() as any;
        metrics['clara'] = {
          totalTasks: reviewMetrics.total_reviews || 0, completedTasks: (reviewMetrics.approved || 0) + (reviewMetrics.rejected || 0), inProgressTasks: reviewMetrics.pending || 0, reviewTasks: reviewMetrics.pending || 0, blockedTasks: 0,
          completionRate: reviewMetrics.approval_rate || 0, avgTaskTimeHours: 0, reviewSuccessRate: reviewMetrics.approval_rate || 0, completedLast7Days: recentReviews.recent_reviews || 0,
          p0Tasks: 0, p1Tasks: 0, p2Tasks: 0, p3Tasks: 0, totalSubtasks: 0, completedSubtasks: 0, subtaskCompletionRate: 0,
          totalActivities: reviewMetrics.total_reviews || 0, completionActions: (reviewMetrics.approved || 0) + (reviewMetrics.rejected || 0), blockedActions: 0, progressUpdates: 0, lastActivityTimestamp: null, performanceTrend: [],
          successRate: (reviewMetrics.approval_rate || 0) / 100, avgTime: 'N/A',
          claraMetrics: { totalReviews: reviewMetrics.total_reviews || 0, approved: reviewMetrics.approved || 0, rejected: reviewMetrics.rejected || 0, pending: reviewMetrics.pending || 0, approvalRate: reviewMetrics.approval_rate || 0 },
        };
      } catch (e) { safeLog.error('Failed to get Clara review metrics:', e); }
    }
    return metrics;
  });

  registerHandler('agents:getDetails', async (_event, agentId: string) => {
    safeLog.log(`[agents:getDetails] Called with agentId: ${agentId}`);
    debugLog(`[agents:getDetails] Called with agentId: ${agentId}`);
    const froggoDbPath = FROGGO_DB;
    const agentAliases: Record<string, string[]> = { main: ['main', 'froggo'], froggo: ['main', 'froggo'], coder: ['coder'], researcher: ['researcher'], writer: ['writer'], chief: ['chief'], onchain_worker: ['onchain_worker'] };
    const dbIds = agentAliases[agentId] || [agentId];
    const dbIdsSql = dbIds.map(id => `'${id}'`).join(',');
    let taskStats = { total: 0, completed: 0 };
    let recentTasks: any[] = [];
    let skills: any[] = [];
    let brainNotes: string[] = [];
    let agentRules = 'AGENT.md not found';
    try {
      const taskStatsResult = execSync(`sqlite3 "${froggoDbPath}" "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed FROM tasks WHERE assigned_to IN (${dbIdsSql}) AND (cancelled IS NULL OR cancelled = 0)" -json`, { encoding: 'utf-8' });
      const parsed = JSON.parse(taskStatsResult)[0] || { total: 0, completed: 0 };
      taskStats = { total: parsed.total || 0, completed: parsed.completed || 0 };
    } catch (e: any) { safeLog.error(`[agents:getDetails] taskStats query failed for ${agentId}:`, e.message); }
    try {
      const recentTasksResult = execSync(`sqlite3 "${froggoDbPath}" "SELECT id, title, status, completed_at, metadata FROM tasks WHERE assigned_to IN (${dbIdsSql}) AND (cancelled IS NULL OR cancelled = 0) ORDER BY COALESCE(completed_at, updated_at) DESC LIMIT 10" -json`, { encoding: 'utf-8' });
      recentTasks = JSON.parse(recentTasksResult || '[]').map((task: any) => {
        let outcome = 'unknown';
        try { const metadata = task.metadata ? JSON.parse(task.metadata) : {}; outcome = metadata.outcome || (task.status === 'done' ? 'success' : 'ongoing'); } catch (_e) { outcome = task.status === 'done' ? 'success' : 'ongoing'; }
        return { ...task, outcome, completedAt: task.completed_at };
      });
    } catch (e: any) { safeLog.error(`[agents:getDetails] recentTasks query failed for ${agentId}:`, e.message); }
    try {
      const skillsResult = execSync(`sqlite3 "${froggoDbPath}" "SELECT skill_name as name, proficiency, last_used, success_count, failure_count FROM skill_evolution ORDER BY proficiency DESC" -json`, { encoding: 'utf-8' });
      skills = JSON.parse(skillsResult || '[]').map((s: any) => ({ name: s.name, proficiency: s.proficiency, lastUsed: s.last_used, successCount: s.success_count, failureCount: s.failure_count }));
    } catch (e: any) { safeLog.error(`[agents:getDetails] skills query failed for ${agentId}:`, e.message); }
    try {
      const brainNotesResult = execSync(`sqlite3 "${froggoDbPath}" "SELECT description FROM learning_events WHERE outcome IN ('insight', 'pattern') ORDER BY timestamp DESC LIMIT 20" -json`, { encoding: 'utf-8' });
      brainNotes = JSON.parse(brainNotesResult || '[]').map((row: any) => row.description);
    } catch (e: any) { safeLog.error(`[agents:getDetails] brainNotes query failed for ${agentId}:`, e.message); }
    try {
      const agentMdPath = path.join(PROJECT_ROOT, 'agents', agentId, 'AGENT.md');
      agentRules = fs.readFileSync(agentMdPath, 'utf-8');
    } catch (_e) {
      try {
        const altPaths = [path.join(PROJECT_ROOT, 'agents', agentId.toLowerCase(), 'AGENT.md'), path.join(PROJECT_ROOT, 'agents', agentId === 'chief' ? 'lead-engineer' : agentId, 'AGENT.md'), ...dbIds.filter(id => id !== agentId).map(id => path.join(PROJECT_ROOT, 'agents', id, 'AGENT.md'))];
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
    } catch (error: any) { return { success: false, error: error.message }; }
  });

  registerHandler('agents:updateSkill', async (_event, agentId: string, skillName: string, proficiency: number) => {
    try {
      prepare("UPDATE skill_evolution SET proficiency = ?, updated_at = datetime('now') WHERE skill_name = ?").run(proficiency, skillName);
      return { success: true };
    } catch (error: any) { return { success: false, error: error.message }; }
  });

  registerHandler('agents:search', async (_event, query: string) => {
    const froggoDbPath = FROGGO_DB;
    const registry = getAgentRegistry();
    const agentDefinitions: Record<string, { role: string; description: string; capabilities: string[] }> = {};
    for (const [id, entry] of Object.entries(registry)) {
      agentDefinitions[id] = { role: entry.role, description: entry.description, capabilities: entry.capabilities };
    }
    const q = query.toLowerCase();
    const results: any[] = [];
    for (const [agentIdLoop, def] of Object.entries(agentDefinitions)) {
      const searchable = `${agentIdLoop} ${def.role} ${def.description} ${def.capabilities.join(' ')}`.toLowerCase();
      if (searchable.includes(q)) {
        let taskCount = 0; let recentTask = ''; let status = 'idle';
        try {
          const agentEntry = registry[agentIdLoop];
          const dbIds = (agentEntry?.aliases || [agentIdLoop]).map(id => `'${id}'`).join(',');
          const countResult = execSync(`sqlite3 "${froggoDbPath}" "SELECT COUNT(*) as cnt FROM tasks WHERE assigned_to IN (${dbIds})" -json`, { encoding: 'utf-8', timeout: 3000 });
          taskCount = JSON.parse(countResult)?.[0]?.cnt || 0;
          const activeResult = execSync(`sqlite3 "${froggoDbPath}" "SELECT COUNT(*) as cnt FROM tasks WHERE assigned_to IN (${dbIds}) AND status IN ('in-progress','todo')" -json`, { encoding: 'utf-8', timeout: 3000 });
          status = (JSON.parse(activeResult)?.[0]?.cnt || 0) > 0 ? 'active' : 'idle';
          const recentResult = execSync(`sqlite3 "${froggoDbPath}" "SELECT title FROM tasks WHERE assigned_to IN (${dbIds}) ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 1" -json`, { encoding: 'utf-8', timeout: 3000 });
          recentTask = JSON.parse(recentResult || '[]')[0]?.title || '';
        } catch (_e) { /* DB query failed, continue with defaults */ }
        results.push({ id: agentIdLoop, name: agentIdLoop.charAt(0).toUpperCase() + agentIdLoop.slice(1).replace(/_/g, ' '), role: def.role, description: def.description, capabilities: def.capabilities, taskCount, recentTask, status });
      }
    }
    return { success: true, agents: results };
  });

  registerHandler('agents:spawnForTask', async (_event, taskId: string, agentId: string) => {
    try {
      const result = await new Promise<string>((resolve, reject) => {
        exec(`openclaw agent --agent "${agentId}" --message "Task assigned: ${taskId}" --json`, { encoding: 'utf-8', timeout: 30000, env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` } }, (error, stdout, stderr) => {
          if (error) reject(new Error(stderr || error.message)); else resolve(stdout.trim());
        });
      });
      return { success: true, output: result };
    } catch (error: any) {
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
          exec('openclaw sessions list --json', { timeout: 10000, env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` } }, (error, stdout) => {
            if (error) { reject(error); return; }
            try {
              const sessions = JSON.parse(stdout);
              const sessionExists = sessions.sessions?.some((s: any) => s.key === sessionKey);
              if (!sessionExists) {
                safeLog.log(`[agents:spawnChat] Session ${sessionKey} not found, spawning...`);
                const chatRegistry = getAgentRegistry();
                const systemPrompt = chatRegistry[agentId]?.prompt || `You are the ${agentId} agent. Help the user with tasks related to your role.`;
                const spawnCmd = `openclaw agent --agent ${agentId} --message "${systemPrompt.replace(/"/g, '\\"')}\n\nYou are now connected to the dashboard chat. Reply with: ready" --json`;
                exec(spawnCmd, { timeout: 30000, env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` } }, (spawnError) => {
                  if (spawnError) { safeLog.error(`[agents:spawnChat] Spawn failed:`, spawnError.message); reject(spawnError); }
                  else { safeLog.log(`[agents:spawnChat] Session ${sessionKey} spawned successfully`); resolve(); }
                });
              } else { safeLog.log(`[agents:spawnChat] Session ${sessionKey} already exists`); resolve(); }
            } catch (parseError) { reject(parseError); }
          });
        });
      } catch (checkError: any) { safeLog.warn(`[agents:spawnChat] Session check failed, continuing anyway:`, checkError.message); }
      return { success: true, sessionKey };
    } catch (error: any) {
      safeLog.error(`Failed to spawn chat for ${agentId}:`, error);
      return { success: false, error: error.message || 'Failed to spawn chat session' };
    }
  });

  registerHandler('agents:chat', async (_event, sessionKey: string, message: string) => {
    safeLog.log(`[agents:chat] Called with sessionKey: ${sessionKey}, message length: ${message.length}`);
    try {
      const agentId = sessionKey.split(':')[1];
      if (!agentId) return { success: false, error: `Invalid sessionKey format: ${sessionKey}` };
      const escapedMsg = message.replace(/'/g, "'\\''");
      let response: string;
      try {
        const cliResult = await new Promise<string>((resolve, reject) => {
          exec(`openclaw agent --agent ${agentId} --message '${escapedMsg}' --json`, { encoding: 'utf-8', timeout: 120000, env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` } }, (error, stdout, stderr) => {
            if (error) reject(new Error(stderr || error.message)); else resolve(stdout.trim());
          });
        });
        let extracted = cliResult || '';
        try {
          const parsed = JSON.parse(extracted);
          const payloads = parsed?.result?.payloads;
          if (Array.isArray(payloads) && payloads.length > 0) extracted = payloads.map((p: any) => p.text || '').join('\n').trim();
          if (!extracted && parsed?.result?.text) extracted = parsed.result.text;
        } catch { /* not JSON */ }
        response = extracted || 'No response from agent';
      } catch (cliErr: any) {
        safeLog.error(`[agents:chat] CLI agent failed: ${cliErr.message}`);
        response = `Agent unavailable: ${cliErr.message}. Ensure openclaw gateway is running and the agent session is active.`;
      }
      return { success: true, response };
    } catch (error: any) {
      safeLog.error('Agent chat error:', error);
      return { success: false, error: error.message || 'Unknown error', response: `Error: ${error.message || 'Unknown error'}` };
    }
  });

  registerHandler('agents:create', async (_event, config: { id: string; name: string; role: string; emoji: string; color: string; personality: string; voice?: string }) => {
    const script = path.join(SCRIPTS_DIR, 'agent-onboard-full.sh');
    const esc = (s: string) => s.replace(/'/g, "'\\''");
    const args = [config.id, config.name, config.role, config.emoji, config.color, config.personality, config.voice || 'Puck'].map(a => `'${esc(a)}'`).join(' ');
    safeLog.log(`[agents:create] Creating agent: ${config.id} (${config.name})`);
    return new Promise((resolve) => {
      exec(`bash ${script} ${args}`, { encoding: 'utf-8', timeout: 120000, env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` }, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) { safeLog.error(`[agents:create] Failed: ${error.message}`); resolve({ success: false, error: error.message, output: stdout || '', stderr: stderr || '' }); }
        else { safeLog.log(`[agents:create] Success for ${config.id}`); resolve({ success: true, output: stdout || '' }); }
      });
    });
  });
}
