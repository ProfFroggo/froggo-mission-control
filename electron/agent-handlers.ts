/**
 * Agent Handlers Module
 * 
 * All agent-related IPC handlers:
 * - agents:list, agents:getActiveSessions
 * - sessions:list
 * - get-agent-registry, widget:scan-manifest
 * - gateway:getToken
 */
import { ipcMain } from 'electron';
import { exec } from 'child_process';
import { prepare } from './database';
import { safeLog } from './logger';
import { agentWorkspace } from './paths';

// ============== INTERFACES ==============

interface AgentRegistryEntry {
  role: string;
  description: string;
  capabilities: string[];
  prompt: string;
  aliases: string[];
  clawdAgentId: string;
}

interface Agent {
  id: string;
  identityName: string;
  identityEmoji: string;
  description: string;
  workspace: string;
  model: string;
  isDefault: boolean;
  [key: string]: unknown;
}

interface AgentDBRow {
  id: string;
  name: string | null;
  role: string | null;
  description: string | null;
  color: string | null;
  image_path: string | null;
  status: string;
  trust_tier: string | null;
}

interface SessionDBRow {
  session_key: string;
  agent_id: string;
  channel: string;
  last_message_at: number;
  message_count: number;
  [key: string]: unknown;
}

interface ActiveSessionRow extends SessionDBRow {
  agent_name: string | null;
}

interface WidgetManifest {
  widgets?: Array<Record<string, unknown>>;
}

interface GlobalWithCache extends NodeJS.Global {
  _agentRegistryCache?: Record<string, AgentRegistryEntry>;
  _agentRegistryCacheTime?: number;
}

interface AgentListResult {
  success: boolean;
  agents: Agent[];
  error?: string;
}

interface SessionsListResult {
  success: boolean;
  sessions: SessionDBRow[];
  error?: string;
}

interface ActiveSessionsResult {
  success: boolean;
  sessions: Array<Record<string, unknown>>;
  error?: string;
}

interface WidgetScanResult {
  success: boolean;
  widgets?: Array<Record<string, unknown>>;
  error?: string;
}

// ============== HANDLER REGISTRATION ==============

export function registerAgentHandlers(): void {
  ipcMain.handle('gateway:getToken', handleGatewayGetToken);
  ipcMain.handle('agents:list', handleAgentsList);
  ipcMain.handle('sessions:list', handleSessionsList);
  ipcMain.handle('get-agent-registry', handleGetAgentRegistry);
  ipcMain.handle('widget:scan-manifest', handleWidgetScanManifest);
  ipcMain.handle('agents:getActiveSessions', handleAgentsGetActiveSessions);
}

// ============ AGENT HANDLERS ============

async function handleGatewayGetToken(): Promise<string> {
  const configPaths = [
    `${process.env.HOME}/.openclaw/config.json`,
    `${process.env.HOME}/.clawd/config.json`,
  ];
  
  for (const cfgPath of configPaths) {
    try {
      const fs = await import('fs');
      if (fs.existsSync(cfgPath)) {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as Record<string, unknown>;
        const gateway = cfg.gateway as Record<string, unknown> | undefined;
        const controlUi = gateway?.controlUi as Record<string, unknown> | undefined;
        const auth = (controlUi?.auth as Record<string, unknown>) ?? (gateway?.auth as Record<string, unknown>);
        const token = auth?.token as string | undefined;
        if (token) return token;
      }
    } catch { /* ignore missing config */ }
  }
  return '';
}

async function handleAgentsList(): Promise<AgentListResult> {
  return new Promise((resolve) => {
    exec('openclaw agents list --json', { 
      timeout: 10000, 
      env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` } 
    }, (error, stdout) => {
      if (error) {
        safeLog.warn('[Agents] CLI failed, falling back to DB:', error.message);
        const agents = getAgentsFromDB();
        resolve({ success: agents.length > 0, agents });
        return;
      }

      try {
        const rawAgents = JSON.parse(stdout || '[]') as Array<Record<string, unknown>>;
        if (rawAgents.length === 0) {
          safeLog.warn('[Agents] CLI returned empty, falling back to DB');
          const agents = getAgentsFromDB();
          resolve({ success: agents.length > 0, agents });
          return;
        }

        safeLog.log(`[Agents] Loaded ${rawAgents.length} agents from gateway`);
        resolve({ success: true, agents: rawAgents as unknown as Agent[] });
      } catch (parseError: unknown) {
        const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
        safeLog.warn('[Agents] Parse failed, falling back to DB:', errorMessage);
        const agents = getAgentsFromDB();
        resolve({ success: agents.length > 0, agents });
      }
    });
  });
}

function getAgentsFromDB(): Agent[] {
  try {
    const rows = prepare(`
      SELECT id, name, role, description, color, image_path, status, trust_tier 
      FROM agent_registry 
      WHERE status = 'active' 
      ORDER BY name
    `).all() as AgentDBRow[];
    
    return rows.map((r): Agent => ({
      id: r.id,
      identityName: r.name ?? r.id,
      identityEmoji: '🤖',
      description: r.role ?? r.description ?? '',
      workspace: agentWorkspace(r.id),
      model: '',
      isDefault: r.id === 'froggo',
    }));
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    safeLog.error('[Agents] DB fallback failed:', errorMessage);
    return [];
  }
}

async function handleSessionsList(
  _: Electron.IpcMainInvokeEvent, 
  activeMinutes?: number
): Promise<SessionsListResult> {
  try {
    let sql = `
      SELECT s.session_key, s.agent_id, s.channel, s.last_message_at, 
             COUNT(m.id) as message_count
      FROM sessions s
      LEFT JOIN session_messages m ON s.session_key = m.session_key
    `;
    const params: (string | number)[] = [];
    
    if (activeMinutes) {
      const cutoff = Date.now() - (activeMinutes * 60 * 1000);
      sql += ' WHERE s.last_message_at > ?';
      params.push(cutoff);
    }
    
    sql += ' GROUP BY s.session_key ORDER BY s.last_message_at DESC LIMIT 500';
    
    const sessions = prepare(sql).all(...params) as SessionDBRow[];
    return { success: true, sessions };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    safeLog.error('[Sessions] List error:', errorMessage);
    return { success: false, sessions: [] };
  }
}

async function handleGetAgentRegistry(): Promise<Record<string, AgentRegistryEntry>> {
  const now = Date.now();
  const globalAny = global as GlobalWithCache;
  const cache = globalAny._agentRegistryCache;
  const cacheTime = globalAny._agentRegistryCacheTime ?? 0;
  
  // Cache with 60s TTL
  if (cache && now - cacheTime < 60000) {
    return cache;
  }
  
  const registry = loadAgentRegistry();
  globalAny._agentRegistryCache = registry;
  globalAny._agentRegistryCacheTime = now;
  return registry;
}

function loadAgentRegistry(): Record<string, AgentRegistryEntry> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const registryPath = path.join(__dirname, 'agent-registry.json');
    const data = JSON.parse(fs.readFileSync(registryPath, 'utf-8')) as Record<string, unknown>;
    return (data.agents as Record<string, AgentRegistryEntry>) ?? {};
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    safeLog.error('Failed to load agent registry, using empty:', errorMessage);
    return {};
  }
}

async function handleWidgetScanManifest(
  _: Electron.IpcMainInvokeEvent, 
  agentId: string
): Promise<WidgetScanResult> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    const widgetPath = path.join(agentWorkspace(agentId), 'widgets.json');
    if (!fs.existsSync(widgetPath)) {
      return { success: true, widgets: [] };
    }
    
    const manifest = JSON.parse(fs.readFileSync(widgetPath, 'utf-8')) as WidgetManifest;
    return { success: true, widgets: manifest.widgets ?? [] };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    safeLog.error('[Widget] Scan error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

async function handleAgentsGetActiveSessions(): Promise<ActiveSessionsResult> {
  try {
    const sessions = prepare(`
      SELECT s.*, a.name as agent_name 
      FROM sessions s
      LEFT JOIN agent_registry a ON s.agent_id = a.id
      WHERE s.last_message_at > ?
      ORDER BY s.last_message_at DESC
    `).all(Date.now() - 24 * 60 * 60 * 1000) as ActiveSessionRow[]; // Last 24 hours
    
    return { success: true, sessions: sessions as Array<Record<string, unknown>> };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    safeLog.error('[Agents] Get active sessions error:', errorMessage);
    return { success: false, sessions: [] };
  }
}
