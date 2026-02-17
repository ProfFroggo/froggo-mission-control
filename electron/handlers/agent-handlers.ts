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

interface Session {
  session_key: string;
  agent_id: string;
  channel: string;
  last_message_at: number;
  message_count: number;
  [key: string]: unknown;
}

interface SessionsListResult {
  success: boolean;
  sessions: Session[];
  count?: number;
  path?: string;
  error?: string;
}

interface AgentListResult {
  success: boolean;
  agents: Agent[];
  error?: string;
}

interface RegistryResult {
  success: boolean;
  registry?: Record<string, AgentRegistryEntry>;
  error?: string;
}

interface GenericResult {
  success: boolean;
  error?: string;
}

interface MetricsResult {
  success: boolean;
  metrics?: Record<string, unknown>;
  error?: string;
}

interface AgentDetailsResult {
  success: boolean;
  agent?: Record<string, unknown>;
  error?: string;
}

interface SpawnResult {
  success: boolean;
  sessionKey?: string;
  error?: string;
}

interface ChatResult {
  success: boolean;
  response?: string;
  error?: string;
}

interface CreateAgentResult {
  success: boolean;
  agentId?: string;
  error?: string;
}

interface WidgetResult {
  success: boolean;
  widgets?: Array<Record<string, unknown>>;
  error?: string;
}

interface GlobalWithCache extends Record<string, unknown> {
  _agentRegistryCache?: Record<string, AgentRegistryEntry>;
  _agentRegistryCacheTime?: number;
}

// ============== HANDLER REGISTRATION ==============

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
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as Record<string, unknown>;
        const gateway = cfg.gateway as Record<string, unknown> | undefined;
        const controlUi = gateway?.controlUi as Record<string, unknown> | undefined;
        const auth = (controlUi?.auth as Record<string, unknown>) ?? (gateway?.auth as Record<string, unknown>);
        const token = auth?.token as string | undefined;
        if (token) return token;
      }
    } catch { /* ignore */ }
  }
  return '';
}

// ============== AGENTS LIST ==============

async function handleAgentsList(): Promise<AgentListResult> {
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
          const rawAgents = JSON.parse(stdout || '[]') as Array<Record<string, unknown>>;
          if (rawAgents.length === 0) {
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
      }
    );
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
  } catch (e: any) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    safeLog.error('[Agents] DB fallback failed:', errorMessage);
    return [];
  }
}

// ============== SESSIONS LIST ==============

async function handleSessionsList(_: Electron.IpcMainInvokeEvent, activeMinutes?: number): Promise<SessionsListResult> {
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
          const data = JSON.parse(stdout || '{}') as Record<string, unknown>;
          const sessions = (data.sessions as Session[]) ?? [];
          safeLog.log(`[Sessions] Loaded ${sessions.length} sessions from gateway`);
          resolve({
            success: true,
            sessions,
            count: (data.count as number) ?? 0,
            path: (data.path as string) ?? undefined
          });
        } catch (parseError: unknown) {
          const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
          safeLog.warn('[Sessions] Parse failed:', errorMessage);
          resolve({ success: false, error: errorMessage, sessions: [] });
        }
      }
    );
  });
}

// ============== AGENT REGISTRY ==============

function loadAgentRegistry(): Record<string, AgentRegistryEntry> {
  const registryPath = path.join(__dirname, '..', 'agent-registry.json');
  try {
    const data = JSON.parse(fs.readFileSync(registryPath, 'utf-8')) as Record<string, unknown>;
    return (data.agents as Record<string, AgentRegistryEntry>) ?? {};
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    safeLog.error('Failed to load agent registry, using empty:', errorMessage);
    return {};
  }
}

function getAgentRegistry(): Record<string, AgentRegistryEntry> {
  const now = Date.now();
  const globalAny = global as GlobalWithCache;
  if (!globalAny._agentRegistryCache || now - (globalAny._agentRegistryCacheTime ?? 0) > 60000) {
    globalAny._agentRegistryCache = loadAgentRegistry();
    globalAny._agentRegistryCacheTime = now;
  }
  return globalAny._agentRegistryCache ?? {};
}

async function handleGetAgentRegistry(): Promise<Array<Record<string, unknown>>> {
  try {
    const agents = prepare(`
      SELECT id, name, role, description, color, image_path, status, trust_tier 
      FROM agent_registry 
      WHERE status = 'active' 
      ORDER BY name
    `).all() as Array<Record<string, unknown>>;
    safeLog.log(`[AgentRegistry] Loaded ${agents.length} agents from DB`);
    return agents;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    safeLog.error('[AgentRegistry] Error:', errorMessage);
    return [];
  }
}

async function handleAgentsGetRegistry(): Promise<RegistryResult> {
  try {
    const registry = getAgentRegistry();
    return { success: true, registry };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    safeLog.error('[Agents] Get registry error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ============== AGENT METRICS (PLACEHOLDER) ==============

async function handleAgentsGetMetrics(): Promise<MetricsResult> {
  // Implementation would be extracted from main.ts lines 6234-6403
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleAgentsGetDetails(): Promise<AgentDetailsResult> {
  // Implementation would be extracted from main.ts lines 6404-6523
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleAgentsAddSkill(): Promise<GenericResult> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleAgentsUpdateSkill(): Promise<GenericResult> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleAgentsSearch(): Promise<{ success: boolean; results?: Array<Record<string, unknown>>; error?: string }> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleAgentsSpawnForTask(): Promise<SpawnResult> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleAgentsSpawnChat(): Promise<SpawnResult> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleAgentsChat(): Promise<ChatResult> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleAgentsCreate(): Promise<CreateAgentResult> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

// ============== WIDGET MANIFEST SCANNER (PLACEHOLDER) ==============

async function handleWidgetScanManifest(): Promise<WidgetResult> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}
