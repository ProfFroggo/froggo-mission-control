/**
 * Agent Context Loader - Loads full agent context (personality, tasks, sessions, memory)
 * for voice chat brain integration.
 */

import { gateway } from './gateway';

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
  froggo: 'main',
  coder: 'coder',
  researcher: 'researcher',
  writer: 'writer',
  chief: 'chief',
  hr: 'hr',
  clara: 'main', // Clara uses main personality with override
  social_media_manager: 'writer', // fallback
  designer: 'designer',
};

let personalitiesData: Record<string, any> | null = null;

async function loadPersonalities(): Promise<Record<string, any>> {
  if (personalitiesData) return personalitiesData;
  
  console.log('[AgentContext] Loading personalities...');
  
  // In Electron, try exec first (file:// fetch doesn't work)
  const isElectron = !!(window as any).clawdbot?.exec?.run;
  
  if (isElectron) {
    try {
      console.log('[AgentContext] Electron mode - using exec...');
      const r = await (window as any).clawdbot.exec.run(
        'cat ~/clawd/clawd-dashboard/dist/agent-profiles/personalities.json'
      );
      if (r.success && r.stdout) {
        personalitiesData = JSON.parse(r.stdout);
        console.log('[AgentContext] ✅ Loaded from exec');
        return personalitiesData!;
      }
    } catch (err) {
      console.warn('[AgentContext] Exec failed:', err);
    }
  }
  
  // Fallback: fetch (works in dev mode)
  try {
    const resp = await fetch('/agent-profiles/personalities.json');
    if (resp.ok) {
      personalitiesData = await resp.json();
      console.log('[AgentContext] ✅ Loaded from fetch');
      return personalitiesData!;
    }
  } catch (err) {
    console.warn('[AgentContext] Fetch failed:', err);
  }
  
  console.error('[AgentContext] ❌ Failed to load personalities');
  return {};
}

async function loadAgentTasks(agentId: string): Promise<AgentContext['tasks']> {
  try {
    if ((window as any).clawdbot?.exec?.run) {
      const r = await (window as any).clawdbot.exec.run(
        `froggo-db query "SELECT id, title, status, priority, assigned_to, created_at FROM tasks WHERE assigned_to='${agentId}' AND status IN ('todo', 'in-progress') ORDER BY priority DESC, created_at DESC LIMIT 20" --json 2>/dev/null`
      );
      if (r.success && r.stdout?.trim()) {
        try {
          const rows = JSON.parse(r.stdout);
          return Array.isArray(rows) ? rows.map((row: any) => ({
            id: row.id || row.task_id,
            title: row.title || row.description,
            status: row.status,
            priority: row.priority,
            assignedTo: row.assigned_to,
            createdAt: row.created_at,
          })) : [];
        } catch {
          // Try line-by-line parsing for non-JSON output
          return [];
        }
      }
    }
  } catch (e) {
    console.warn('[AgentContext] Failed to load tasks:', e);
  }
  
  // Fallback: try gateway froggo-db
  try {
    if ((window as any).clawdbot?.db?.query) {
      const result = await (window as any).clawdbot.db.query(
        `SELECT id, title, status, priority, assigned_to, created_at FROM tasks WHERE assigned_to=? AND status IN ('todo', 'in-progress') ORDER BY created_at DESC LIMIT 20`,
        [agentId]
      );
      if (result?.rows) {
        return result.rows.map((row: any) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          priority: row.priority,
          assignedTo: row.assigned_to,
          createdAt: row.created_at,
        }));
      }
    }
  } catch {}
  
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
  } catch (e) {
    console.warn('[AgentContext] Failed to load sessions:', e);
  }
  return [];
}

async function loadWorkspaceFiles(agentId: string): Promise<Record<string, string | null>> {
  const exec = (window as any).clawdbot?.exec?.run;
  if (!exec) return {};

  const agentDir = agentId === 'froggo' ? '.' : `clawd-${agentId}`;
  const base = `~/clawd/${agentDir}`;
  const today = new Date().toISOString().split('T')[0];

  const fileSpecs = [
    { key: 'soul', path: `${base}/SOUL.md`, maxChars: 2000 },
    { key: 'user', path: `${base}/USER.md`, maxChars: 1000 },
    { key: 'identity', path: `${base}/IDENTITY.md`, maxChars: 500 },
    { key: 'agents', path: `${base}/AGENTS.md`, maxChars: 2000 },
    { key: 'tools', path: `${base}/TOOLS.md`, maxChars: 1000 },
    { key: 'platform_context', path: `${base}/PLATFORM_CONTEXT.md`, maxChars: 1500 },
    { key: 'memory_longterm', path: `${base}/MEMORY.md`, maxChars: 3000 },
    { key: 'memory_today', path: `${base}/memory/${today}.md`, maxChars: 2000 },
  ];

  const results = await Promise.all(
    fileSpecs.map(async (spec) => {
      try {
        const r = await exec(`head -c ${spec.maxChars} ${spec.path} 2>/dev/null || echo ""`);
        return [spec.key, r.success && r.stdout?.trim() ? r.stdout.trim() : null] as [string, string | null];
      } catch { return [spec.key, null] as [string, string | null]; }
    })
  );

  return Object.fromEntries(results);
}

async function loadAgentMemory(agentId: string): Promise<string | null> {
  try {
    if ((window as any).clawdbot?.exec?.run) {
      // Try reading the agent's daily memory
      const today = new Date().toISOString().split('T')[0];
      const agentDir = agentId === 'froggo' ? '.' : `clawd-${agentId}`;
      const r = await (window as any).clawdbot.exec.run(
        `head -100 ~/clawd/${agentDir}/memory/${today}.md 2>/dev/null || echo ""`
      );
      if (r.success && r.stdout?.trim()) {
        return r.stdout.trim().slice(0, 2000); // Cap at 2000 chars
      }
    }
  } catch {}
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
  
  console.log(`[AgentContext] Loaded for ${agentId}:`, {
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
