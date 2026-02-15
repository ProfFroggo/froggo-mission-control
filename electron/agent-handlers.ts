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
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
        const token = cfg.gateway?.controlUi?.auth?.token || cfg.gateway?.auth?.token;
        if (token) return token;
      }
    } catch { /* ignore missing config */ }
  }
  return '';
}

async function handleAgentsList(): Promise<{ success: boolean; agents: any[]; error?: string }> {
  return new Promise((resolve) => {
    exec('openclaw agents list --json', { 
      timeout: 10000, 
      env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` } 
    }, (error, stdout, stderr) => {
      if (error) {
        safeLog.warn('[Agents] CLI failed, falling back to DB:', error.message);
        const agents = getAgentsFromDB();
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
}

function getAgentsFromDB(): any[] {
  try {
    const rows = prepare(`
      SELECT id, name, role, description, color, image_path, status, trust_tier 
      FROM agent_registry 
      WHERE status = 'active' 
      ORDER BY name
    `).all() as any[];
    
    return rows.map((r: any) => ({
      id: r.id,
      identityName: r.name || r.id,
      identityEmoji: '🤖',
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

async function handleSessionsList(
  _: Electron.IpcMainInvokeEvent, 
  activeMinutes?: number
): Promise<{ success: boolean; sessions: any[]; error?: string }> {
  try {
    let sql = `
      SELECT s.session_key, s.agent_id, s.channel, s.last_message_at, 
             COUNT(m.id) as message_count
      FROM sessions s
      LEFT JOIN session_messages m ON s.session_key = m.session_key
    `;
    const params: any[] = [];
    
    if (activeMinutes) {
      const cutoff = Date.now() - (activeMinutes * 60 * 1000);
      sql += ' WHERE s.last_message_at > ?';
      params.push(cutoff);
    }
    
    sql += ' GROUP BY s.session_key ORDER BY s.last_message_at DESC LIMIT 500';
    
    const sessions = prepare(sql).all(...params);
    return { success: true, sessions };
  } catch (error: any) {
    safeLog.error('[Sessions] List error:', error.message);
    return { success: false, sessions: [] };
  }
}

async function handleGetAgentRegistry(): Promise<Record<string, any>> {
  const now = Date.now();
  const cache = (global as any)._agentRegistryCache;
  const cacheTime = (global as any)._agentRegistryCacheTime || 0;
  
  // Cache with 60s TTL
  if (cache && now - cacheTime < 60000) {
    return cache;
  }
  
  const registry = loadAgentRegistry();
  (global as any)._agentRegistryCache = registry;
  (global as any)._agentRegistryCacheTime = now;
  return registry;
}

function loadAgentRegistry(): Record<string, any> {
  try {
    const fs = require('fs');
    const path = require('path');
    const registryPath = path.join(__dirname, 'agent-registry.json');
    const data = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    return data.agents || {};
  } catch (err) {
    safeLog.error('Failed to load agent registry, using empty:', err);
    return {};
  }
}

async function handleWidgetScanManifest(
  _: Electron.IpcMainInvokeEvent, 
  agentId: string
): Promise<{ success: boolean; widgets?: any[]; error?: string }> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    const widgetPath = path.join(agentWorkspace(agentId), 'widgets.json');
    if (!fs.existsSync(widgetPath)) {
      return { success: true, widgets: [] };
    }
    
    const manifest = JSON.parse(fs.readFileSync(widgetPath, 'utf-8'));
    return { success: true, widgets: manifest.widgets || [] };
  } catch (error: any) {
    safeLog.error('[Widget] Scan error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleAgentsGetActiveSessions(): Promise<{ success: boolean; sessions: any[]; error?: string }> {
  try {
    const sessions = prepare(`
      SELECT s.*, a.name as agent_name 
      FROM sessions s
      LEFT JOIN agent_registry a ON s.agent_id = a.id
      WHERE s.last_message_at > ?
      ORDER BY s.last_message_at DESC
    `).all(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    
    return { success: true, sessions };
  } catch (error: any) {
    safeLog.error('[Agents] Get active sessions error:', error.message);
    return { success: false, sessions: [] };
  }
}
