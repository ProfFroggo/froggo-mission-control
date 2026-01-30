// Agent Management System
// Spawns and manages real sub-agents via Clawdbot gateway

import { gateway } from './gateway';

export interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  description: string;
  systemPromptPath?: string;
  capabilities: string[];
  model?: string;
  workspace?: string;
  workspaceFiles?: {
    memory: string;
    tools: string;
    agents: string;
    soul: string;
    skills: string;
  };
}

// Pre-defined agents
// Helper to build workspace file paths
function workspaceFiles(dir: string) {
  return {
    memory: `${dir}/MEMORY.md`,
    tools: `${dir}/TOOLS.md`,
    agents: `${dir}/AGENTS.md`,
    soul: `${dir}/SOUL.md`,
    skills: `${dir}/skills`,
  };
}

export const AGENTS: Record<string, AgentConfig> = {
  coder: {
    id: 'coder',
    name: 'Coder',
    emoji: '💻',
    workspace: '/Users/worker/clawd-coder',
    workspaceFiles: workspaceFiles('/Users/worker/clawd-coder'),
    description: 'Software engineering tasks',
    systemPromptPath: '/Users/worker/clawd/agents/coder/AGENT.md',
    capabilities: ['code', 'git', 'debug', 'test'],
    model: 'anthropic/claude-sonnet-4',
  },
  researcher: {
    id: 'researcher',
    name: 'Researcher',
    emoji: '🔍',
    description: 'Research and analysis',
    workspace: '/Users/worker/clawd-researcher',
    workspaceFiles: workspaceFiles('/Users/worker/clawd-researcher'),
    systemPromptPath: '/Users/worker/clawd/agents/researcher/AGENT.md',
    capabilities: ['web', 'analyze', 'summarize'],
    model: 'anthropic/claude-sonnet-4',
  },
  writer: {
    id: 'writer',
    name: 'Writer',
    emoji: '✍️',
    description: 'Content creation',
    workspace: '/Users/worker/clawd-writer',
    workspaceFiles: workspaceFiles('/Users/worker/clawd-writer'),
    systemPromptPath: '/Users/worker/clawd/agents/writer/AGENT.md',
    capabilities: ['write', 'edit', 'social'],
    model: 'anthropic/claude-sonnet-4',
  },
  chief: {
    id: 'chief',
    name: 'Chief',
    emoji: '👨‍💻',
    description: 'Lead Engineer (GSD methodology)',
    workspace: '/Users/worker/clawd-chief',
    workspaceFiles: workspaceFiles('/Users/worker/clawd-chief'),
    systemPromptPath: '/Users/worker/clawd/agents/lead-engineer/AGENT.md',
    capabilities: ['code', 'architecture', 'planning'],
    model: 'anthropic/claude-sonnet-4',
  },
  froggo: {
    id: 'froggo',
    name: 'Froggo',
    emoji: '🐸',
    description: 'Main orchestrator and agent reviewer',
    workspace: '/Users/worker/clawd',
    workspaceFiles: workspaceFiles('/Users/worker/clawd'),
    systemPromptPath: '/Users/worker/clawd/AGENTS.md',
    capabilities: ['orchestrate', 'review', 'approve', 'delegate'],
    model: 'anthropic/claude-sonnet-4-5',
  },
};

// Spawn an agent with a specific task
export async function spawnAgent(
  agentId: string,
  task: string,
  options?: {
    label?: string;
    model?: string;
    timeout?: number;
  }
): Promise<{ sessionKey: string; label: string }> {
  const agent = AGENTS[agentId];
  if (!agent) {
    throw new Error(`Unknown agent: ${agentId}`);
  }

  const label = options?.label || `${agent.id}-${Date.now()}`;
  
  // Load agent prompt
  let systemPrompt = '';
  if (agent.systemPromptPath) {
    try {
      // In Electron, we'd read from filesystem
      // For now, embed basic prompts
      systemPrompt = getAgentPrompt(agentId);
    } catch (e) {
      console.error('Failed to load agent prompt:', e);
    }
  }

  // Spawn via gateway
  const result = await gateway.spawnAgent(
    `${systemPrompt}\n\n## YOUR TASK\n${task}`,
    label,
    options?.model || agent.model
  );

  return {
    sessionKey: result.sessionKey || `spawned:${label}`,
    label,
  };
}

// Create a dynamic worker agent for a specific task
export async function spawnWorker(
  task: string,
  options?: {
    name?: string;
    capabilities?: string[];
  }
): Promise<{ sessionKey: string; label: string }> {
  const workerId = `worker-${Date.now().toString(36)}`;
  const name = options?.name || `Worker ${workerId.slice(-4)}`;
  
  const prompt = `# Worker Agent: ${name}

You are a dynamic worker agent spawned for a specific task.

## Identity
- **Name:** ${name}
- **ID:** ${workerId}
- **Spawned by:** Froggo

## Behavior
1. Focus ONLY on the assigned task
2. Work efficiently
3. Report completion when done

## Communication
Report back with:
- **Status:** completed / blocked / needs-input
- **Result:** What was accomplished
- **Next:** Suggested follow-up (if any)

Get it done, report back.`;

  const result = await gateway.request('sessions.spawn', {
    task: `${prompt}\n\n## YOUR TASK\n${task}`,
    label: workerId,
    model: 'anthropic/claude-sonnet-4',
    runTimeoutSeconds: 300,
    cleanup: 'keep',
  });

  return {
    sessionKey: result.sessionKey || `spawned:${workerId}`,
    label: workerId,
  };
}

// Get agent status
export async function getAgentStatus(sessionKey: string): Promise<{
  status: 'running' | 'completed' | 'error';
  lastMessage?: string;
}> {
  try {
    const history = await gateway.request('sessions.history', {
      sessionKey,
      limit: 1,
    });
    
    return {
      status: 'running', // Would check actual status
      lastMessage: history.messages?.[0]?.content,
    };
  } catch (e) {
    return { status: 'error' };
  }
}

// Send message to running agent
export async function messageAgent(sessionKey: string, message: string): Promise<void> {
  await gateway.request('sessions.send', {
    sessionKey,
    message,
  });
}

// Embedded agent prompts (fallback)
function getAgentPrompt(agentId: string): string {
  const prompts: Record<string, string> = {
    coder: `You are Coder, a focused software engineer agent. Execute coding tasks efficiently, write clean code, test your work, and commit with clear messages.`,
    researcher: `You are Researcher, an analysis agent. Gather information from multiple sources, analyze data, and provide concise summaries with actionable insights.`,
    writer: `You are Writer, a content creation agent. Draft engaging content for the target platform and audience. Submit all external content for approval using [NEEDS_APPROVAL] format.`,
    chief: `You are Chief, a Lead Engineer using GSD (Get Shit Done) methodology. Use /gsd: commands for spec-driven development. Plan thoroughly, execute in atomic chunks, verify everything works.`,
  };
  return prompts[agentId] || '';
}

// Match task to best agent
export function matchTaskToAgent(taskTitle: string, taskDescription: string): string {
  const text = `${taskTitle} ${taskDescription}`.toLowerCase();
  
  // Code-related
  if (text.match(/code|bug|fix|implement|build|develop|api|function|test|debug/)) {
    return 'coder';
  }
  
  // Research-related  
  if (text.match(/research|analyze|find|investigate|compare|report|data|metrics/)) {
    return 'researcher';
  }
  
  // Content-related
  if (text.match(/write|draft|tweet|post|email|content|copy|edit|blog/)) {
    return 'writer';
  }
  
  // Complex project
  if (text.match(/project|architecture|design|system|plan|roadmap/)) {
    return 'chief';
  }
  
  // Default to coder for technical tasks
  return 'coder';
}
