// Agent Management System
// Spawns and manages real sub-agents via Clawdbot gateway

import { gateway } from './gateway';
import { useStore } from '../store/store';

export interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  description: string;
  capabilities: string[];
  model?: string;
  workspace?: string;
}

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
  // Get agent from store instead of hardcoded AGENTS constant
  const agent = useStore.getState().agents.find(a => a.id === agentId);
  if (!agent) {
    throw new Error(`Unknown agent: ${agentId}`);
  }

  const label = options?.label || `${agent.id}-${Date.now()}`;

  // Load agent prompt (fallback only - agents load their own from workspace)
  const systemPrompt = getAgentPrompt(agentId);

  // Spawn via gateway
  const result = await gateway.spawnAgent(
    `${systemPrompt}\n\n## YOUR TASK\n${task}`,
    label,
    options?.model // Use provided model or gateway default
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

// Embedded agent prompts (fallback only - agents load their own from workspace)
function getAgentPrompt(agentId: string): string {
  // Return empty string - agents load their own prompts from workspace AGENTS.md files
  return '';
}

// Match task to best agent using ordered regex routing table
// Order matters: more specific multi-word patterns first, generic last
export function matchTaskToAgent(taskTitle: string, taskDescription: string): string {
  const text = `${taskTitle} ${taskDescription}`.toLowerCase();

  const routes: [RegExp, string][] = [
    [/design|mockup|wireframe|ui\/ux|figma|layout|visual|css|style|theme|branding/, 'designer'],
    [/social media|twitter|x\.com|instagram|tiktok|linkedin|engagement|followers|hashtag/, 'social-manager'],
    [/growth|marketing|campaign|audience|conversion|funnel|analytics|seo|outreach/, 'growth-director'],
    [/hiring|onboard|team member|agent config|training|performance review|hr/, 'hr'],
    [/architect|infrastructure|devops|deploy|ci\/cd|scaling|migration|refactor|technical debt/, 'lead-engineer'],
    [/code|bug|fix|implement|build|develop|api|function|test|debug|typescript|react/, 'coder'],
    [/research|analyze|find|investigate|compare|report|data|metrics|study/, 'researcher'],
    [/write|draft|tweet|post|email|content|copy|edit|blog|article|newsletter/, 'writer'],
    [/project|strategy|plan|roadmap|coordinate|prioritize|review/, 'chief'],
  ];

  for (const [pattern, agent] of routes) {
    if (pattern.test(text)) return agent;
  }

  return 'coder'; // safe default
}
