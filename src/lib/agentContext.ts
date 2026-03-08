/**
 * Agent Context Loader - Loads full agent context (personality, tasks, sessions, memory)
 * for voice chat brain integration.
 */

import { gateway } from './gateway';
import { createLogger } from '../utils/logger';
import { agentApi, taskApi } from './api';

const logger = createLogger('AgentContext');

export interface AgentContext {
  personality: {
    name: string;
    role: string;
    emoji: string;
    personality: string;
    vibe: string;
    bio: string;
  } | null;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority?: string;
    assignedTo?: string;
    createdAt?: string;
  }>;
  sessions: Array<{
    key: string;
    label?: string;
    state?: string;
    agentId?: string;
  }>;
  memory: string | null;
  workspaceFiles?: Record<string, string | null>;
  loadedAt: number;
}

// Cache context per agent to avoid re-fetching on every utterance
const contextCache = new Map<string, { context: AgentContext; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

// Agent ID mapping (dashboard id → personality key)
const AGENT_PERSONALITY_MAP: Record<string, string> = {
  'mission-control': 'main',
  'senior-coder': 'coder', // Senior Coder uses coder personality (promoted from coder)
  coder: 'coder',
  researcher: 'researcher',
  writer: 'writer',
  chief: 'chief',
  hr: 'hr',
  clara: 'main', // Clara uses main personality with override
  social_media_manager: 'writer', // fallback
  designer: 'designer',
  voice: 'voice',
};

let personalitiesData: Record<string, any> | null = null;

async function loadPersonalities(): Promise<Record<string, any>> {
  if (personalitiesData) return personalitiesData;

  // Fetch from static JSON (works in web mode)
  try {
    const resp = await fetch('/agent-profiles/personalities.json');
    if (resp.ok) {
      personalitiesData = await resp.json();
      return personalitiesData!;
    }
  } catch (_err) {
    // Fetch failed
  }

  console.error('[AgentContext] Failed to load personalities');
  return {};
}

function isCleanAgentId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

async function loadAgentTasks(agentId: string): Promise<AgentContext['tasks']> {
  if (!isCleanAgentId(agentId)) return [];
  try {
    const result = await taskApi.getAll({ assigned_to: agentId, status: 'active' });
    const tasksList = result?.tasks || (Array.isArray(result) ? result : []);
    return tasksList.slice(0, 20).map((row: any) => ({
      id: row.id || row.task_id,
      title: row.title || row.description,
      status: row.status,
      priority: row.priority,
      assignedTo: row.assigned_to || row.assignedTo,
      createdAt: row.created_at || row.createdAt,
    }));
  } catch (_e) {
    // Task load failed
  }
  return [];
}

async function loadAgentSessions(agentId: string): Promise<AgentContext['sessions']> {
  try {
    const result = await gateway.getSessions();
    if (result?.sessions) {
      return result.sessions
        .filter((s: any) => {
          const key = s.key || s.sessionKey || '';
          return key.includes(agentId) || s.agentId === agentId;
        })
        .map((s: any) => ({
          key: s.key || s.sessionKey,
          label: s.label,
          state: s.state,
          agentId: s.agentId,
        }))
        .slice(0, 10);
    }
  } catch (_e) {
    // Session load failed — return empty
  }
  return [];
}

async function loadWorkspaceFiles(agentId: string): Promise<Record<string, string | null>> {
  if (!isCleanAgentId(agentId)) return {};

  // Try reading soul file via REST API
  try {
    const soulResult = await agentApi.readSoul(agentId);
    const soulContent = typeof soulResult === 'string' ? soulResult : soulResult?.content || null;
    return { soul: soulContent };
  } catch {
    // Workspace files not available via REST
  }

  console.warn('Not implemented: workspace file loading for agent', agentId);
  return {};
}

async function loadAgentMemory(_agentId: string): Promise<string | null> {
  // Memory file reading requires filesystem access; not available in web mode
  return null;
}

/**
 * Load full context for an agent (personality + tasks + sessions + memory).
 * Results are cached for 1 minute.
 */
export async function loadAgentContext(agentId: string): Promise<AgentContext> {
  // Check cache
  const cached = contextCache.get(agentId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.context;
  }
  
  // Load all in parallel
  const [personalities, tasks, sessions, memory, workspaceFiles] = await Promise.all([
    loadPersonalities(),
    loadAgentTasks(agentId),
    loadAgentSessions(agentId),
    loadAgentMemory(agentId),
    loadWorkspaceFiles(agentId),
  ]);
  
  const personalityKey = AGENT_PERSONALITY_MAP[agentId] || agentId;
  const personality = personalities[personalityKey] || null;
  
  const context: AgentContext = {
    personality,
    tasks,
    sessions,
    memory,
    workspaceFiles,
    loadedAt: Date.now(),
  };
  
  // Cache it
  contextCache.set(agentId, { context, timestamp: Date.now() });
  
  logger.debug(`Loaded for ${agentId}:`, {
    hasPersonality: !!personality,
    taskCount: tasks.length,
    sessionCount: sessions.length,
    hasMemory: !!memory,
    workspaceFiles: Object.entries(workspaceFiles).filter(([, v]) => v).map(([k]) => k),
  });
  
  return context;
}

/**
 * Build a context-enriched message to send to the agent via gateway.
 * Prepends agent context as a system-style preamble.
 */
export function buildContextualMessage(userText: string, context: AgentContext, _agentName?: string): string {
  const parts: string[] = [];
  
  // Voice chat indicator
  parts.push(`[VOICE CHAT] The user is speaking to you via voice. Respond conversationally and concisely — your response will be spoken aloud. Avoid code blocks, markdown formatting, and long lists. Be natural.`);
  
  // Current tasks context
  if (context.tasks.length > 0) {
    parts.push(`\n[YOUR CURRENT TASKS]\n${context.tasks.map(t => 
      `- ${t.id}: "${t.title}" (${t.status}${t.priority ? `, priority: ${t.priority}` : ''})`
    ).join('\n')}`);
  }
  
  // Active sessions
  if (context.sessions.length > 0) {
    const activeSessions = context.sessions.filter(s => s.state === 'running' || s.state === 'active');
    if (activeSessions.length > 0) {
      parts.push(`\n[YOUR ACTIVE SESSIONS]\n${activeSessions.map(s => 
        `- ${s.key}${s.label ? ` (${s.label})` : ''} — ${s.state}`
      ).join('\n')}`);
    }
  }
  
  // Recent memory
  if (context.memory) {
    parts.push(`\n[TODAY'S MEMORY NOTES]\n${context.memory.slice(0, 1000)}`);
  }
  
  // Tool capabilities reminder
  parts.push(`\n[CAPABILITIES] You have full operational access. If the user asks you to create tasks, spawn agents, send messages, update task status, etc. — DO IT using your tools. Don't just describe what you'd do.`);
  
  // The actual user message
  parts.push(`\n[USER SAYS]: ${userText}`);
  
  return parts.join('\n');
}

/**
 * Invalidate cached context for an agent (call after mutations like task creation).
 */
export function invalidateAgentContext(agentId?: string) {
  if (agentId) {
    contextCache.delete(agentId);
  } else {
    contextCache.clear();
  }
}
