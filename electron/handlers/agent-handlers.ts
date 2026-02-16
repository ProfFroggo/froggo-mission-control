/**
 * Agent & Session Handlers Module
 * 
 * Agent management and session listing IPC handlers:
 * - agents:list, get-agent-registry, agents:getRegistry, agents:getMetrics
 * - sessions:list, gateway:getToken
 * - agents:spawnForTask, agents:spawnChat, agents:chat
 * - widget:scan-manifest
 */

import { ipcMain } from 'electron';
import { exec } from 'child_process';
import { prepare } from '../database';
import { safeLog } from '../logger';
import {
  OPENCLAW_CONFIG,
  OPENCLAW_CONFIG_LEGACY,
  agentWorkspace,
} from '../paths';
import * as path from 'path';
import * as fs from 'fs';

interface AgentRegistryEntry {
  role: string;
  description: string;
  capabilities: string[];
  prompt: string;
  aliases: string[];
  clawdAgentId: string;
}

export function registerAgentHandlers(): void {
  // Gateway token
  ipcMain.handle('gateway:getToken', handleGatewayGetToken);

  // Agents list
  ipcMain.handle('agents:list', handleAgentsList);

  // Sessions list
  ipcMain.handle('sessions:list', handleSessionsList);

  // Agent registry
  ipcMain.handle('get-agent-registry', handleGetAgentRegistry);
  ipcMain.handle('agents:getRegistry', handleAgentsGetRegistry);
  ipcMain.handle('agents:getMetrics', handleAgentsGetMetrics);
  ipcMain.handle('agents:getDetails', handleAgentsGetDetails);
  ipcMain.handle('agents:addSkill', handleAgentsAddSkill);
  ipcMain.handle('agents:updateSkill', handleAgentsUpdateSkill);
  ipcMain.handle('agents:search', handleAgentsSearch);
  ipcMain.handle('agents:spawnForTask', handleAgentsSpawnForTask);
  ipcMain.handle('agents:spawnChat', handleAgentsSpawnChat);
  ipcMain.handle('agents:chat', handleAgentsChat);
  ipcMain.handle('agents:create', handleAgentsCreate);

  // Widget manifest
  ipcMain.handle('widget:scan-manifest', handleWidgetScanManifest);
}

// ============== GATEWAY TOKEN ==============

async function handleGatewayGetToken(): Promise<string> {
  const configPaths = [OPENCLAW_CONFIG, OPENCLAW_CONFIG_LEGACY];
  for (const cfgPath of configPaths) {
    try {
      if (fs.existsSync(cfgPath)) {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
        const token = cfg.gateway?.controlUi?.auth?.token || cfg.gateway?.auth?.token;
        if (token) return token;
      }
    } catch { /* ignore */ }
  }
  return '';
}

// ============== AGENTS LIST ==============

async function handleAgentsList(): Promise<{ success: boolean; agents: any[] }> {
  return new Promise((resolve) => {
    exec(
      'openclaw agents list --json',
      {
        timeout: 10000,
        env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` }
      },
      (error, stdout) => {
        if (error) {
          safeLog.warn('[Agents] CLI failed, falling back to DB:', error.message);
          const agents = getAgentsFromDB();
          resolve({ success: agents.length > 0, agents });
          return;
        }

        try {
          const rawAgents = JSON.parse(stdout || '[]');
          if (rawAgents.length === 0) {
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
      }
    );
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

// ============== SESSIONS LIST ==============

async function handleSessionsList(_: Electron.IpcMainInvokeEvent, activeMinutes?: number): Promise<{
  success: boolean;
  sessions: any[];
  count?: number;
  path?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const args = ['sessions', 'list', '--json'];
    if (activeMinutes) {
      args.push('--active', String(activeMinutes));
    }

    exec(
      `openclaw ${args.join(' ')}`,
      {
        timeout: 10000,
        env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` }
      },
      (error, stdout) => {
        if (error) {
          safeLog.warn('[Sessions] CLI failed:', error.message);
          resolve({ success: false, error: error.message, sessions: [] });
          return;
        }

        try {
          const data = JSON.parse(stdout || '{}');
          safeLog.log(`[Sessions] Loaded ${data.sessions?.length || 0} sessions from gateway`);
          resolve({
            success: true,
            sessions: data.sessions || [],
            count: data.count || 0,
            path: data.path
          });
        } catch (parseError: any) {
          safeLog.warn('[Sessions] Parse failed:', parseError.message);
          resolve({ success: false, error: parseError.message, sessions: [] });
        }
      }
    );
  });
}

// ============== AGENT REGISTRY ==============

function loadAgentRegistry(): Record<string, AgentRegistryEntry> {
  const registryPath = path.join(__dirname, '..', 'agent-registry.json');
  try {
    const data = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    return data.agents || {};
  } catch (err) {
    safeLog.error('Failed to load agent registry, using empty:', err);
    return {};
  }
}

function getAgentRegistry(): Record<string, AgentRegistryEntry> {
  const now = Date.now();
  const global_any = global as any;
  if (!global_any._agentRegistryCache || now - (global_any._agentRegistryCacheTime || 0) > 60000) {
    global_any._agentRegistryCache = loadAgentRegistry();
    global_any._agentRegistryCacheTime = now;
  }
  return global_any._agentRegistryCache;
}

async function handleGetAgentRegistry(): Promise<any[]> {
  try {
    const agents = prepare(`
      SELECT id, name, role, description, color, image_path, status, trust_tier 
      FROM agent_registry 
      WHERE status = 'active' 
      ORDER BY name
    `).all();
    safeLog.log(`[AgentRegistry] Loaded ${agents.length} agents from DB`);
    return agents;
  } catch (error: any) {
    safeLog.error('[AgentRegistry] Error:', error.message);
    return [];
  }
}

async function handleAgentsGetRegistry(): Promise<{
  success: boolean;
  registry?: Record<string, AgentRegistryEntry>;
  error?: string;
}> {
  try {
    const registry = getAgentRegistry();
    return { success: true, registry };
  } catch (error: any) {
    safeLog.error('[Agents] Get registry error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============== AGENT METRICS (PLACEHOLDER) ==============

async function handleAgentsGetMetrics(): Promise<{
  success: boolean;
  metrics?: any;
  error?: string;
}> {
  // Implementation would be extracted from main.ts lines 6234-6403
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleAgentsGetDetails(): Promise<{
  success: boolean;
  agent?: any;
  error?: string;
}> {
  // Implementation would be extracted from main.ts lines 6404-6523
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleAgentsAddSkill(): Promise<{
  success: boolean;
  error?: string;
}> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleAgentsUpdateSkill(): Promise<{
  success: boolean;
  error?: string;
}> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleAgentsSearch(): Promise<{
  success: boolean;
  results?: any[];
  error?: string;
}> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleAgentsSpawnForTask(): Promise<{
  success: boolean;
  sessionKey?: string;
  error?: string;
}> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleAgentsSpawnChat(): Promise<{
  success: boolean;
  sessionKey?: string;
  error?: string;
}> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleAgentsChat(): Promise<{
  success: boolean;
  response?: string;
  error?: string;
}> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleAgentsCreate(): Promise<{
  success: boolean;
  agentId?: string;
  error?: string;
}> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

// ============== WIDGET MANIFEST SCANNER (PLACEHOLDER) ==============

async function handleWidgetScanManifest(): Promise<{
  success: boolean;
  widgets?: any[];
  error?: string;
}> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}
