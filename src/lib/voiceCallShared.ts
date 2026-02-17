/**
 * Shared voice call utilities — used by both VoiceChatPanel and QuickActions toolbar.
 * Extracted to avoid duplication.
 */

import { loadAgentContext, invalidateAgentContext, AgentContext } from './agentContext';
import type { GeminiTool } from './geminiLiveService';

export type { AgentContext };

interface AgentLike {
  id: string;
  name: string;
  role?: string;
  sessionKey?: string;
}

interface GatewaySession {
  key?: string;
  sessionKey?: string;
  label?: string;
  agentId?: string;
  state?: string;
  [key: string]: unknown;
}

interface ToolCallArgs {
  title?: string;
  assigned_to?: string;
  priority?: string;
  status?: string;
  description?: string;
  task_id?: string;
  agent_id?: string;
  message?: string;
  command?: string;
  path?: string;
  max_lines?: number;
  count?: number;
  query?: string;
  note?: string;
  content?: string;
  days?: number;
  [key: string]: unknown;
}

interface ToolResult {
  success?: boolean;
  output?: string;
  task_created?: string;
  tasks?: string;
  agent_spawned?: string;
  error?: string;
  content?: string;
  stdout?: string;
  stderr?: string;
  results?: string[];
  files?: string[];
  query?: string;
  raw?: string;
  message?: string;
}

interface ExecResult {
  success?: boolean;
  stdout?: string;
  stderr?: string;
}

interface DuckDuckGoResult {
  Text?: string;
  FirstURL?: string;
  [key: string]: unknown;
}

type VideoMode = 'camera' | 'screen' | 'none';

/** Resolve agent workspace base path. froggo/main share ~/froggo, others get ~/agent-{id} */
function agentBasePath(agentId: string): string {
  if (agentId === 'froggo' || agentId === 'main') return '~/froggo';
  return `~/agent-${agentId}`;
}

/**
 * Load recent chat history for an agent from ALL sources:
 * - Main text chat sessions
 * - Voice chat transcripts
 * - Sub-agent / spawned sessions
 * - Today's memory file
 * - STATE.md (current working state)
 * 
 * Returns a formatted string for system instruction context.
 */
export async function loadRecentChatHistory(agentId: string, limit = 20): Promise<string> {
  const exec = (window as any).clawdbot?.exec?.run;
  if (!exec) return '';

  const sections: string[] = [];

  // 1. Load STATE.md (current working state — most important)
  try {
    const base = agentBasePath(agentId);
    const r = await exec(`cat ${base}/STATE.md 2>/dev/null || echo ""`);
    if (r.stdout?.trim() && r.stdout.trim() !== '') {
      sections.push(`### Current State (STATE.md)\n${r.stdout.trim().slice(0, 2000)}`);
    }
  } catch { /* ignore error */ }

  // 2. Load chat history from ALL matching gateway sessions
  try {
    const sessionRes = await fetch('http://localhost:18789/api/sessions?limit=50');
    if (sessionRes.ok) {
      const sessionData = await sessionRes.json();
      const allSessions = sessionData.sessions || sessionData || [];
      // Find all sessions for this agent
      const agentSessions = allSessions.filter((s: GatewaySession) => {
        const key = s.key || s.sessionKey || '';
        const label = s.label || '';
        // Match by key patterns: agent:{id}:*, chat:{id}, or label containing the agent
        return key.includes(`agent:${agentId}`) || key.includes(`chat:${agentId}`) 
          || key === `agent:${agentId}:main` || key === `agent:${agentId}:dashboard`
          || s.agentId === agentId || label.includes(agentId);
      }).slice(0, 5); // Top 5 sessions

      for (const sess of agentSessions) {
        const key = sess.key || sess.sessionKey;
        try {
          const histRes = await fetch(`http://localhost:18789/api/sessions/${encodeURIComponent(key)}/history?limit=${limit}`);
          if (histRes.ok) {
            const data = await histRes.json();
            const msgs = (data.messages || data || []);
            const lines: string[] = [];
            for (const m of msgs) {
              const role = m.role === 'assistant' ? agentId : (m.role || 'user');
              const text = (m.content || m.text || m.message || '').trim();
              if (text && text.length < 400 && role !== 'system') {
                lines.push(`[${role}]: ${text.slice(0, 300)}`);
              }
            }
            if (lines.length > 0) {
              const label = sess.label || key;
              sections.push(`### Chat: ${label}\n${lines.join('\n')}`);
            }
          }
        } catch { /* ignore error */ }
      }
    }
  } catch { /* ignore error */ }

  // 3. Load today's + yesterday's memory notes
  try {
    const base = agentBasePath(agentId);
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const r = await exec(`(cat ${base}/memory/${today}.md 2>/dev/null; echo ""; cat ${base}/memory/${yesterday}.md 2>/dev/null) | tail -80`);
    if (r.stdout?.trim()) {
      sections.push(`### Recent Memory Notes\n${r.stdout.trim().slice(0, 1500)}`);
    }
  } catch { /* ignore error */ }

  if (sections.length === 0) return '';
  return sections.join('\n\n').slice(0, 6000);
}

// ── Tool definitions ──

export function buildAgentTools(): GeminiTool[] {
  return [
    {
      name: 'create_task',
      description: 'Create a new task in the task board.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short title for the task' },
          description: { type: 'string', description: 'Detailed description' },
          priority: { type: 'string', description: 'Priority', enum: ['low', 'medium', 'high', 'critical'] },
          assigned_to: { type: 'string', description: 'Agent ID to assign to' },
          status: { type: 'string', description: 'Initial status', enum: ['todo', 'in-progress'] },
        },
        required: ['title'],
      },
    },
    {
      name: 'update_task',
      description: 'Update an existing task.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'Task ID' },
          status: { type: 'string', description: 'New status', enum: ['todo', 'in-progress', 'done', 'blocked'] },
          priority: { type: 'string', description: 'New priority', enum: ['low', 'medium', 'high', 'critical'] },
          assigned_to: { type: 'string', description: 'New assignee' },
        },
        required: ['task_id'],
      },
    },
    {
      name: 'list_tasks',
      description: 'List current tasks, optionally filtered.',
      parameters: {
        type: 'object',
        properties: {
          agent_id: { type: 'string', description: 'Filter by agent' },
          status: { type: 'string', description: 'Filter by status', enum: ['todo', 'in-progress', 'done', 'blocked', 'all'] },
        },
      },
    },
    {
      name: 'spawn_agent',
      description: 'Spawn another agent to perform a task.',
      parameters: {
        type: 'object',
        properties: {
          agent_id: { type: 'string', description: 'Agent to spawn' },
          message: { type: 'string', description: 'Instruction to send' },
          task_title: { type: 'string', description: 'Optional task title' },
        },
        required: ['agent_id', 'message'],
      },
    },
    {
      name: 'get_agent_status',
      description: 'Get current status of an agent.',
      parameters: {
        type: 'object',
        properties: {
          agent_id: { type: 'string', description: 'Agent ID to check' },
        },
        required: ['agent_id'],
      },
    },
    {
      name: 'read_file',
      description: 'Read a file from the workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (e.g., ~/froggo/SOUL.md)' },
          max_lines: { type: 'number', description: 'Max lines to read (default 100)' },
        },
        required: ['path'],
      },
    },
    {
      name: 'run_command',
      description: 'Execute a shell command (allowlist: cat, head, tail, ls, find, grep, froggo-db, git, openclaw, date, echo, wc, which, node, npx, python3, curl, df, uptime, ps, who).',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to run' },
        },
        required: ['command'],
      },
    },
    {
      name: 'send_message',
      description: 'Send a message to a Discord channel.',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', description: 'Channel name (e.g., homebase)' },
          message: { type: 'string', description: 'Message text' },
        },
        required: ['channel', 'message'],
      },
    },
    {
      name: 'search_workspace',
      description: 'Search for text in workspace files.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text to search for' },
        },
        required: ['query'],
      },
    },
    {
      name: 'web_search',
      description: 'Search the web for information.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    },
    {
      name: 'check_calendar',
      description: 'Check upcoming calendar events.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Number of days ahead to check (default 1)' },
        },
      },
    },
    {
      name: 'memory_search',
      description: 'Search through agent memory files for context.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to search for in memory' },
          agent_id: { type: 'string', description: 'Agent whose memory to search (default: froggo)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'write_memory',
      description: 'Write a note to today\'s memory file.',
      parameters: {
        type: 'object',
        properties: {
          note: { type: 'string', description: 'Note to save' },
          agent_id: { type: 'string', description: 'Agent whose memory to write to (default: voice)' },
        },
        required: ['note'],
      },
    },
    {
      name: 'send_whatsapp',
      description: 'Send a WhatsApp message via the gateway.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient (phone number or name)' },
          message: { type: 'string', description: 'Message text' },
        },
        required: ['to', 'message'],
      },
    },
    {
      name: 'update_state',
      description: 'Update YOUR STATE.md — the single source of truth for everything YOU are working on across ALL your sessions (text chat, voice calls, spawned tasks). Write the FULL current state each time. Include: active tasks, status, blockers, decisions, next steps. This is how your other sessions and other agents know what you are doing.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Full STATE.md content — all active work, status, blockers, next steps' },
        },
        required: ['content'],
      },
    },
    {
      name: 'read_state',
      description: 'Read an agent\'s STATE.md — their current working state across all their sessions. Use to check what another agent is doing, or read your own state from a fresh session.',
      parameters: {
        type: 'object',
        properties: {
          agent_id: { type: 'string', description: 'Agent ID to read (default: yourself)' },
        },
      },
    },
    {
      name: 'read_team_state',
      description: 'Read TEAM_STATE.md — the master view of what ALL agents are working on. Maintained by Froggo.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'update_team_state',
      description: 'Update TEAM_STATE.md — the master view of all agent states. Froggo aggregates all individual STATE.md files here. Only the orchestrator should call this.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Full TEAM_STATE.md content — all agents and their current work' },
        },
        required: ['content'],
      },
    },
    {
      name: 'update_memory_md',
      description: 'Append or update the agent\'s long-term MEMORY.md file in the workspace. Use for important decisions, lessons learned, and things to remember across sessions.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Content to append to MEMORY.md' },
          agent_id: { type: 'string', description: 'Agent whose MEMORY.md to update (default: current agent)' },
        },
        required: ['content'],
      },
    },
    {
      name: 'read_memory_md',
      description: 'Read the agent\'s long-term MEMORY.md file from the workspace.',
      parameters: {
        type: 'object',
        properties: {
          agent_id: { type: 'string', description: 'Agent whose MEMORY.md to read (default: current agent)' },
        },
      },
    },
    {
      name: 'onboard_agent',
      description: 'Run the full agent onboarding pipeline for a new agent. Creates workspace, registers in DB, patches dashboard code. Requires dashboard rebuild after.',
      parameters: {
        type: 'object',
        properties: {
          agent_id: { type: 'string', description: 'Agent ID (lowercase, hyphenated, e.g. reply-guy)' },
          name: { type: 'string', description: 'Display name (e.g. Reply Guy)' },
          role: { type: 'string', description: 'Role description (e.g. Social Media Responder)' },
          emoji: { type: 'string', description: 'Emoji for the agent' },
          color: { type: 'string', description: 'Hex color (e.g. #F59E0B)' },
          personality: { type: 'string', description: 'Personality description' },
          voice: { type: 'string', description: 'Gemini voice name (Puck, Orus, Fenrir, etc.)' },
        },
        required: ['agent_id', 'name', 'role', 'emoji', 'color', 'personality'],
      },
    },
    {
      name: 'check_email',
      description: 'Check recent emails.',
      parameters: {
        type: 'object',
        properties: {
          count: { type: 'number', description: 'Number of recent emails to check (default 5)' },
        },
      },
    },
  ];
}

// ── Tool call executor ──

export async function executeToolCall(fnName: string, args: ToolCallArgs, currentAgent: AgentLike): Promise<ToolResult> {
  const exec = (window as any).clawdbot?.exec?.run;
  if (!exec) return { error: 'Exec not available' };

  try {
    switch (fnName) {
      case 'create_task': {
        const title = args.title || 'Untitled task';
        const assignee = args.assigned_to || currentAgent.id;
        const priority = args.priority || 'medium';
        const status = args.status || 'todo';
        const desc = args.description || '';
        const r = await exec(`froggo-db task-add "${title.replace(/"/g, '\\"')}" --priority ${priority} --assign ${assignee} --status ${status} ${desc ? `--desc "${desc.replace(/"/g, '\\"')}"` : ''} 2>&1`);
        invalidateAgentContext(assignee);
        return { success: r.success, output: r.stdout?.trim() || r.stderr?.trim(), task_created: title };
      }
      case 'update_task': {
        const parts = [`froggo-db task-update ${args.task_id}`];
        if (args.status) parts.push(`--status ${args.status}`);
        if (args.priority) parts.push(`--priority ${args.priority}`);
        if (args.assigned_to) parts.push(`--assign ${args.assigned_to}`);
        const r = await exec(parts.join(' ') + ' 2>&1');
        invalidateAgentContext();
        return { success: r.success, output: r.stdout?.trim() || r.stderr?.trim() };
      }
      case 'list_tasks': {
        const parts = ['froggo-db task-list'];
        if (args.status && args.status !== 'all') parts.push(`--status ${args.status}`);
        if (args.agent_id) parts.push(`--agent ${args.agent_id}`);
        const r = await exec(parts.join(' ') + ' 2>&1');
        return { tasks: r.stdout?.trim() || 'No tasks found' };
      }
      case 'spawn_agent': {
        // Sanitize: Gemini sometimes swaps arg order
        const agentId = (args.agent_id || '').trim();
        const msg = (args.message || '').replace(/"/g, '\\"').replace(/\n/g, ' ');
        if (!agentId) return { error: 'Missing agent_id' };
        if (args.task_title) {
          await exec(`froggo-db task-add "${args.task_title.replace(/"/g, '\\"')}" --assign ${agentId} --priority high --status todo 2>&1`);
        }
        // Fire-and-forget: send message to agent without waiting for full turn (avoids 30s timeout)
        await exec(`nohup openclaw agent --agent ${agentId} --message "${msg}" >/dev/null 2>&1 &`);
        invalidateAgentContext(agentId);
        return { success: true, output: `Message sent to ${agentId}`, agent_spawned: agentId };
      }
      case 'get_agent_status': {
        const ctx = await loadAgentContext(args.agent_id);
        return {
          agent: args.agent_id,
          personality: ctx.personality ? `${ctx.personality.emoji} ${ctx.personality.name} - ${ctx.personality.role}` : 'Unknown',
          tasks: ctx.tasks.map((t: { id: string; title: string; status: string; priority: string }) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority })),
          active_sessions: ctx.sessions.filter((s: GatewaySession) => s.state === 'running' || s.state === 'active').length,
        };
      }
      case 'read_file': {
        const maxLines = args.max_lines || 100;
        const r = await exec(`head -n ${maxLines} ${args.path} 2>&1`);
        return { content: r.stdout || r.stderr || 'File not found' };
      }
      case 'run_command': {
        const allowed = ['cat', 'head', 'tail', 'ls', 'find', 'grep', 'froggo-db', 'git', 'openclaw', 'date', 'echo', 'wc', 'which', 'node', 'npx', 'python3', 'curl', 'df', 'uptime', 'ps', 'who'];
        const cmd = args.command.trim().split(/\s+/)[0];
        if (!allowed.includes(cmd)) {
          return { error: `Command not allowed. Allowlist: ${allowed.join(', ')}` };
        }
        const r = await exec(args.command + ' 2>&1');
        return { stdout: r.stdout, stderr: r.stderr };
      }
      case 'send_message': {
        const escapedMsg = args.message.replace(/"/g, '\\"');
        const r = await exec(`clawdbot gateway sessions-send --label discord --message "${escapedMsg}" 2>&1`);
        return { success: r.success, output: r.stdout?.trim() };
      }
      case 'search_workspace': {
        const escapedQuery = args.query.replace(/"/g, '\\"');
        const r = await exec(`grep -rl "${escapedQuery}" ~/froggo/ --include="*.md" --include="*.ts" --include="*.json" 2>/dev/null | head -20`);
        return { files: r.stdout?.trim().split('\n').filter(Boolean) || [] };
      }
      case 'web_search': {
        const q = encodeURIComponent(args.query || '');
        const r = await exec(`curl -s "https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&t=froggo" 2>&1`);
        try {
          const data = JSON.parse(r.stdout || '{}');
          const results = (data.RelatedTopics || []).slice(0, 5).map((t: DuckDuckGoResult) => t.Text || t.FirstURL).filter(Boolean);
          return { query: args.query, results: results.length ? results : [data.Abstract || 'No results found'] };
        } catch { return { query: args.query, raw: r.stdout?.trim()?.slice(0, 1500) || 'Search failed' }; }
      }
      case 'check_calendar': {
        const days = args.days || 1;
        const r = await exec(`openclaw agent --agent froggo --local --message "Check my calendar for the next ${days} day(s). List upcoming events with times." --json 2>&1`);
        return { output: r.stdout?.trim()?.slice(0, 2000) || 'Calendar check failed' };
      }
      case 'memory_search': {
        const agent = args.agent_id || 'froggo';
        const memBase = agentBasePath(agent);
        const q = (args.query || '').replace(/"/g, '\\"');
        const r = await exec(`grep -rli "${q}" ${memBase}/memory/ ${memBase}/MEMORY.md 2>/dev/null | head -10 && echo "---" && grep -rhi "${q}" ${memBase}/memory/ ${memBase}/MEMORY.md 2>/dev/null | head -30`);
        return { results: r.stdout?.trim() || 'No matches found' };
      }
      case 'write_memory': {
        const agent = args.agent_id || 'voice';
        const memBase = agentBasePath(agent);
        const today = new Date().toISOString().split('T')[0];
        const note = (args.note || '').replace(/"/g, '\\"');
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        await exec(`mkdir -p ${memBase}/memory && echo "\\n## ${time}\\n${note}" >> ${memBase}/memory/${today}.md`);
        return { success: true, message: `Note saved to ${agent}'s memory` };
      }
      case 'update_state': {
        const base = agentBasePath(currentAgent.id);
        const content = (args.content || '').replace(/'/g, "'\\''");
        const timestamp = new Date().toLocaleString();
        await exec(`cat > ${base}/STATE.md << 'STATEEOF'\n# Agent State — ${currentAgent.id}\n_Last updated: ${timestamp}_\n\n${content}\nSTATEEOF`);
        return { success: true, message: `Updated ${currentAgent.id}'s STATE.md` };
      }
      case 'read_state': {
        const agent = args.agent_id || currentAgent.id;
        const base = agentBasePath(agent);
        const r = await exec(`cat ${base}/STATE.md 2>/dev/null || echo "No STATE.md found for ${agent}"`);
        return { content: (r.stdout || '').slice(0, 3000) };
      }
      case 'read_team_state': {
        const r = await exec(`cat ~/froggo/TEAM_STATE.md 2>/dev/null || echo "No TEAM_STATE.md yet"`);
        return { content: (r.stdout || '').slice(0, 5000) };
      }
      case 'update_team_state': {
        const content = (args.content || '').replace(/'/g, "'\\''");
        const timestamp = new Date().toLocaleString();
        await exec(`cat > ~/froggo/TEAM_STATE.md << 'TEAMEOF'\n# Team State — All Agents\n_Last updated: ${timestamp}_\n\n${content}\nTEAMEOF`);
        return { success: true, message: 'Updated TEAM_STATE.md' };
      }
      case 'update_memory_md': {
        const agent = args.agent_id || currentAgent.id;
        const memBase = agentBasePath(agent);
        const content = (args.content || '').replace(/"/g, '\\"').replace(/`/g, '\\`');
        const timestamp = new Date().toLocaleString();
        await exec(`echo "\n\n## ${timestamp}\n${content}" >> ${memBase}/MEMORY.md`);
        return { success: true, message: `Updated ${agent}'s MEMORY.md` };
      }
      case 'read_memory_md': {
        const agent = args.agent_id || currentAgent.id;
        const memBase = agentBasePath(agent);
        const r = await exec(`cat ${memBase}/MEMORY.md 2>/dev/null || echo "No MEMORY.md found"`);
        return { content: (r.stdout || '').slice(0, 3000) };
      }
      case 'send_whatsapp': {
        const to = (args.to || '').replace(/"/g, '\\"');
        const msg = (args.message || '').replace(/"/g, '\\"');
        const r = await exec(`openclaw message --action send --channel whatsapp --target "${to}" --message "${msg}" 2>&1`);
        return { success: r.success, output: r.stdout?.trim() || r.stderr?.trim() };
      }
      case 'onboard_agent': {
        const { agent_id, name, role, emoji, color, personality, voice } = args;
        const voiceArg = voice || 'Puck';
        const r = await exec(`bash ~/froggo/scripts/agent-onboard-full.sh "${agent_id}" "${name}" "${role}" "${emoji}" "${color}" "${personality}" "${voiceArg}" 2>&1`);
        return { success: r.success, output: (r.stdout || r.stderr || '').slice(0, 2000), note: 'Dashboard rebuild needed: cd ~/froggo-dashboard && npm run build:dev' };
      }
      case 'check_email': {
        const count = args.count || 5;
        const r = await exec(`openclaw agent --agent froggo --local --message "Check my recent ${count} emails. List sender, subject, and brief preview." --json 2>&1`);
        return { output: r.stdout?.trim()?.slice(0, 2000) || 'Email check failed' };
      }
      default:
        return { error: `Unknown tool: ${fnName}` };
    }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ── System instruction builder ──

export function buildSystemInstruction(agent: AgentLike, context?: AgentContext | null, currentVideoMode?: VideoMode, recentHistory?: string): string {
  const parts: string[] = [];

  if (context?.personality) {
    const p = context.personality;
    parts.push(`You are ${p.name} (${p.emoji}), ${p.role}. ${p.personality}. ${p.vibe}`);
    if (p.bio) parts.push(`Bio: ${p.bio}`);
  } else {
    parts.push(`You are ${agent.name}, ${agent.role || 'an AI assistant'}.`);
  }

  parts.push(`\nCurrent date: ${new Date().toLocaleString()}`);

  if (context?.workspaceFiles?.soul) parts.push(`\n## Your Core Identity (SOUL.md)\n${context.workspaceFiles.soul}`);
  if (context?.workspaceFiles?.user) parts.push(`\n## About Your Human (USER.md)\n${context.workspaceFiles.user}`);
  if (context?.workspaceFiles?.identity) parts.push(`\n## Identity Details\n${context.workspaceFiles.identity}`);
  if (context?.workspaceFiles?.agents) parts.push(`\n## Agent Instructions (AGENTS.md)\n${context.workspaceFiles.agents}`);
  if (context?.workspaceFiles?.tools) parts.push(`\n## Tools Reference (TOOLS.md)\n${context.workspaceFiles.tools}`);
  if (context?.workspaceFiles?.platform_context) parts.push(`\n## Platform Context\n${context.workspaceFiles.platform_context}`);
  if (context?.workspaceFiles?.memory_longterm) parts.push(`\n## Long-term Memory\n${context.workspaceFiles.memory_longterm}`);
  if (context?.workspaceFiles?.state) parts.push(`\n## Current Working State (STATE.md)\n${context.workspaceFiles.state}`);
  if (context?.memory) parts.push(`\n## Recent Memory (Today)\n${context.memory.slice(0, 1000)}`);

  // Recent chat history (text + voice sessions)
  if (recentHistory) {
    parts.push(`\n## Recent Conversation History\nThese are your recent chats with the user (from text chat and previous voice calls). Use this for continuity — reference past discussions naturally.\n${recentHistory}`);
  }

  parts.push(`
You are speaking to your human via voice chat. Be conversational, concise, and natural.
Keep responses to 1-3 sentences unless asked for detail.
Don't narrate tool usage — just do it and report the result naturally.`);

  parts.push(`\n## Your Capabilities
You have access to tools for task management, file reading, shell commands, web search, messaging, calendar, email, and memory.
You can read and update your MEMORY.md (long-term memory) — use it to remember important decisions, lessons, and context across sessions.
You have a STATE.md file — YOUR single source of truth for everything YOU are working on across ALL your sessions. When you start work, finish a task, hit a blocker, or make a decision — update STATE.md. Write the full state each time (overwrite, not append). This is how your other sessions pick up where you left off, and how other agents know what you're doing.
There is also a TEAM_STATE.md at ~/froggo/ that Froggo maintains — a master view of what ALL agents are working on. You can read it with read_team_state.
Use tools proactively when the user asks you to do something. Don't ask for confirmation unless the action is destructive.
When you learn something important or the user asks you to remember something, update your MEMORY.md.
Report results naturally in conversation.`);

  if (currentVideoMode === 'camera') {
    parts.push('\n## Visual Context\nYou can see the user via their camera. Comment on what you see when relevant.');
  } else if (currentVideoMode === 'screen') {
    parts.push('\n## Visual Context\nYou can see the user\'s screen. Help with what you see when relevant.');
  }

  return parts.join('\n');
}
