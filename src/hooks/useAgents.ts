/**
 * useAgents - Hook for dynamically fetching agent data from window.clawdbot APIs.
 *
 * Polls gateway sessions and agent metrics, merging them into AgentInfo[].
 * Aggregates sessions by agent name and includes subagents from all workspaces.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { gateway } from '@/lib/gateway';

// AgentInfo type for legacy useAgents hook (being deprecated)
export interface AgentInfo {
  id: string;
  name: string;
  role?: string;
  status: 'active' | 'idle' | 'busy' | 'offline';
  totalSessions?: number;
  activeTasks?: number;
  currentTask?: {
    id: string;
    title: string;
  };
  stats?: {
    tasksCompleted: number;
    tasksInProgress: number;
    avgCompletionMinutes?: number | null;
  };
  lastSeen?: string;
}

const api = () => window.clawdbot;

/** Threshold in ms — sessions updated within this window are considered active */
const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const IDLE_THRESHOLD_MS = 30 * 60 * 1000;  // 30 minutes

/** Derive agent status from last-updated timestamp */
function statusFromAge(updatedAt?: number): AgentInfo['status'] {
  if (!updatedAt) return 'offline';
  const ageMs = Date.now() - updatedAt;
  if (ageMs < ACTIVE_THRESHOLD_MS) return 'active';
  if (ageMs < IDLE_THRESHOLD_MS) return 'idle';
  return 'offline';
}

/** Map a gateway session status string to AgentInfo status */
function normalizeStatus(raw?: string): AgentInfo['status'] {
  if (!raw) return 'offline';
  const s = raw.toLowerCase();
  if (s === 'active' || s === 'running' || s === 'online') return 'active';
  if (s === 'busy' || s === 'working') return 'busy';
  if (s === 'idle' || s === 'waiting') return 'idle';
  return 'offline';
}

/** Extract a human-friendly agent name from a session key like "agent:coder:subagent:uuid" */
function parseSessionKey(key: string): { agent: string; kind: 'direct' | 'subagent'; parentAgent?: string } {
  // Common patterns:
  //   agent:coder:cron:uuid          → agent=coder, kind=direct
  //   agent:coder:subagent:uuid      → agent=coder (subagent), kind=subagent
  //   agent:froggo:cron:uuid     → agent=froggo, kind=direct
  const parts = key.split(':');
  if (parts[0] === 'agent' && parts.length >= 3) {
    const agentName = parts[1];
    const isSubagent = parts[2] === 'subagent';
    return { agent: agentName, kind: isSubagent ? 'subagent' : 'direct' };
  }
  return { agent: key, kind: 'direct' };
}

/** Format a timestamp as a relative "last seen" string */
function formatLastSeen(ts?: number): string | undefined {
  if (!ts) return undefined;
  const ageMs = Date.now() - ts;
  if (ageMs < 60_000) return 'just now';
  if (ageMs < 3_600_000) return `${Math.round(ageMs / 60_000)}m ago`;
  if (ageMs < 86_400_000) return `${Math.round(ageMs / 3_600_000)}h ago`;
  return `${Math.round(ageMs / 86_400_000)}d ago`;
}

/** Fetch and merge agent data from gateway sessions + agent metrics */
async function fetchAgents(): Promise<AgentInfo[]> {
  const clawdbot = api();
  if (!clawdbot) return [];

  const agentMap = new Map<string, AgentInfo>();

  // 0. Agent list from gateway — baseline list of ALL configured agents
  //    This ensures agents appear even when they have no active sessions.
  //    Uses 'clawdbot agents list' via IPC instead of the old registry JSON.
  try {
    if (clawdbot.agents?.list) {
      const result = await clawdbot.agents.list();
      if (result?.success && Array.isArray(result.agents)) {
        for (const agent of result.agents) {
          agentMap.set(agent.id, {
            id: agent.id,
            name: agent.name || agent.id,
            role: agent.description || 'Agent',
            status: 'offline',
            stats: {
              tasksCompleted: 0,
              tasksInProgress: 0,
            },
          });
        }
      }
    }
  } catch {
    // agents list API may not be available
  }

  // 1. Gateway sessions — live agent sessions from ALL workspaces
  //    sessions.db is global (~/.clawdbot/sessions.db), so all agents are included.
  try {
    const res = await gateway.getSessions();
    const sessions: any[] = res?.sessions ?? [];
    if (Array.isArray(sessions)) {
      // Group sessions by agent name to aggregate stats
      const agentSessions = new Map<string, any[]>();
      const subagentSessions: any[] = [];

      for (const s of sessions) {
        const key = s.key || s.sessionKey || s.id || '';
        if (!key) continue;

        const kind = s.kind || (key.includes(':subagent:') ? 'subagent' : 'direct');
        const agentName = s.agent || parseSessionKey(key).agent || 'unknown';

        if (kind === 'subagent') {
          subagentSessions.push({ ...s, _agentName: agentName, _key: key });
        } else {
          const existing = agentSessions.get(agentName) || [];
          existing.push(s);
          agentSessions.set(agentName, existing);
        }
      }

      // Build agent entries from grouped direct sessions
      for (const [agentName, agentSessionList] of agentSessions) {
        // Use the most recently updated session for status
        const sorted = agentSessionList.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));
        const latest = sorted[0];
        const latestUpdated = latest?.updatedAt;
        const status = latest?.status ? normalizeStatus(latest.status) : statusFromAge(latestUpdated);

        // Aggregate token counts across all sessions for this agent
        // const totalTokens = agentSessionList.reduce((sum: number, s: any) => sum + (s.totalTokens || 0), 0);
        const sessionCount = agentSessionList.length;

        // Count active subagents for this parent
        const activeSubagents = subagentSessions.filter(
          (s) => s._agentName === agentName && statusFromAge(s.updatedAt) !== 'offline'
        ).length;

        // Determine role from channel/label info
        const channel = latest?.channel;
        const label = latest?.label;
        const role = label
          ? label
          : channel
            ? `Agent · ${channel}`
            : `Agent · ${sessionCount} session${sessionCount !== 1 ? 's' : ''}`;

        agentMap.set(agentName, {
          id: agentName,
          name: agentName,
          role,
          status,
          stats: {
            tasksCompleted: 0,
            tasksInProgress: activeSubagents,
          },
          lastSeen: formatLastSeen(latestUpdated),
        });
      }

      // Add subagent entries individually (so spawned agents are visible)
      for (const s of subagentSessions) {
        const subKey = s._key;
        const parentAgent = s._agentName;
        const label = s.label || undefined;
        const updatedAt = s.updatedAt;
        const status = s.status ? normalizeStatus(s.status) : statusFromAge(updatedAt);

        // Use label if available, otherwise derive a short name
        const displayName = label || `${parentAgent}/subagent`;
        const subRole = `Subagent of ${parentAgent}${s.channel ? ` · ${s.channel}` : ''}`;

        agentMap.set(subKey, {
          id: subKey,
          name: displayName,
          role: subRole,
          status,
          currentTask: label ? {
            id: subKey,
            title: label,
          } : undefined,
          stats: {
            tasksCompleted: 0,
            tasksInProgress: status === 'active' || status === 'busy' ? 1 : 0,
          },
          lastSeen: formatLastSeen(updatedAt),
        });
      }
    }
  } catch {
    // gateway may not be available
  }

  // 2. Agent metrics — enrich with performance data
  try {
    if (clawdbot.agents) {
      const metricsRes = await clawdbot.agents.getMetrics();
      // Handle both wrapped { metrics: {...} } and direct metrics object from Electron IPC
      const metrics: Record<string, any> = metricsRes?.metrics ?? metricsRes ?? {};
      // Map metric agent IDs to session agent names (and vice versa)
      const agentIdAliases: Record<string, string[]> = {
        main: ['main', 'froggo'],
        froggo: ['main', 'froggo'],
      };

      for (const [agentId, data] of Object.entries(metrics)) {
        const d = data as any;
        // Try to find existing agent entry by ID or aliases
        const aliases = agentIdAliases[agentId] || [agentId];
        const existing = agentMap.get(agentId) || aliases.reduce<AgentInfo | undefined>((found, alias) => found || agentMap.get(alias), undefined);
        const completedCount = d.completedTasks ?? d.tasksCompleted ?? 0;
        const inProgressCount = d.inProgressTasks ?? d.tasksActive ?? d.tasksInProgress ?? 0;
        const avgMins = d.avgTaskTimeHours ? Math.round(d.avgTaskTimeHours * 60) : d.avgCompletionMinutes;

        if (existing) {
          // Merge metrics into existing entry
          existing.stats = {
            tasksCompleted: completedCount || existing.stats?.tasksCompleted || 0,
            tasksInProgress: inProgressCount || existing.stats?.tasksInProgress || 0,
            avgCompletionMinutes: avgMins ?? existing.stats?.avgCompletionMinutes,
          };
        } else {
          // New agent from metrics only
          agentMap.set(agentId, {
            id: agentId,
            name: d.name ?? agentId,
            role: d.role ?? 'Agent',
            status: normalizeStatus(d.status),
            stats: {
              tasksCompleted: completedCount,
              tasksInProgress: inProgressCount,
              avgCompletionMinutes: avgMins,
            },
            lastSeen: d.lastSeen,
          });
        }
      }
    }
  } catch {
    // agents API optional
  }

  return Array.from(agentMap.values());
}

export interface UseAgentsResult {
  agents: AgentInfo[];
  loading: boolean;
  error: string | null;
  /** Force a refresh */
  refresh: () => void;
}

/**
 * @param pollIntervalMs - How often to re-fetch (0 = no polling). Default 15000.
 */
export function useAgents(pollIntervalMs = 15000): UseAgentsResult {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchAgents();
      if (mountedRef.current) {
        setAgents(data);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch agents');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();

    let timer: ReturnType<typeof setInterval> | undefined;
    if (pollIntervalMs > 0) {
      timer = setInterval(load, pollIntervalMs);
    }

    return () => {
      mountedRef.current = false;
      if (timer) clearInterval(timer);
    };
  }, [load, pollIntervalMs]);

  return { agents, loading, error, refresh: load };
}

export default useAgents;
