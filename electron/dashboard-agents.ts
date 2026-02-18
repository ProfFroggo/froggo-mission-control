/**
 * Dashboard Agent Session Manager
 * Spawns and maintains persistent agent sessions for the dashboard
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from './utils/logger';

const execAsync = promisify(exec);
const logger = createLogger('DashboardAgents');

interface DashboardAgent {
  id: string;
  name: string;
  sessionKey: string;
  agentId: string; // The openclaw agent ID from config
  spawned: boolean;
  lastHealthCheck?: number;
}

const DASHBOARD_AGENTS: DashboardAgent[] = [
  { id: 'froggo', name: 'Froggo', sessionKey: 'agent:froggo:dashboard', agentId: 'froggo', spawned: false },
  { id: 'coder', name: 'Coder', sessionKey: 'agent:coder:dashboard', agentId: 'coder', spawned: false },
  { id: 'clara', name: 'Clara', sessionKey: 'agent:clara:dashboard', agentId: 'clara', spawned: false },
  { id: 'chief', name: 'Chief', sessionKey: 'agent:chief:dashboard', agentId: 'chief', spawned: false },
  { id: 'writer', name: 'Writer', sessionKey: 'agent:writer:dashboard', agentId: 'writer', spawned: false },
  { id: 'researcher', name: 'Researcher', sessionKey: 'agent:researcher:dashboard', agentId: 'researcher', spawned: false },
  { id: 'hr', name: 'HR', sessionKey: 'agent:hr:dashboard', agentId: 'hr', spawned: false },
  { id: 'designer', name: 'Designer', sessionKey: 'agent:designer:dashboard', agentId: 'designer', spawned: false },
  { id: 'voice', name: 'Voice', sessionKey: 'agent:voice:dashboard', agentId: 'voice', spawned: false },
  { id: 'social-manager', name: 'Social Manager', sessionKey: 'agent:social-manager:dashboard', agentId: 'social-manager', spawned: false },
  { id: 'growth-director', name: 'Growth Director', sessionKey: 'agent:growth-director:dashboard', agentId: 'growth-director', spawned: false },
  { id: 'lead-engineer', name: 'Lead Engineer', sessionKey: 'agent:lead-engineer:dashboard', agentId: 'lead-engineer', spawned: false },
  { id: 'degen-frog', name: 'Degen Frog', sessionKey: 'agent:degen-frog:dashboard', agentId: 'degen-frog', spawned: false },
];

const HEALTH_CHECK_INTERVAL = 60000; // 1 minute
let healthCheckTimer: NodeJS.Timeout | null = null;

/**
 * Spawn a persistent agent session
 */
async function spawnAgentSession(agent: DashboardAgent): Promise<boolean> {
  try {
    logger.debug(`[DashboardAgents] Spawning ${agent.name} at ${agent.sessionKey}...`);
    
    // Use openclaw CLI to spawn an isolated agent session
    // This creates a persistent session that stays alive
    const cmd = `openclaw agent --agent-id ${agent.agentId} --session-key ${agent.sessionKey} --message "You are now connected to the dashboard chat. Read your SOUL.md and be ready. Do NOT run onboarding or BOOTSTRAP.md — you are already set up. Reply with a single word: ready" --no-deliver`;
    
    const { stderr } = await execAsync(cmd, {
      timeout: 30000,
      env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` }
    });
    
    if (stderr && !stderr.includes('success')) {
      logger.error(`[DashboardAgents] Error spawning ${agent.name}:`, stderr);
      return false;
    }
    
    logger.debug(`[DashboardAgents] ✅ ${agent.name} spawned successfully`);
    agent.spawned = true;
    agent.lastHealthCheck = Date.now();
    return true;
  } catch (error: any) {
    logger.error(`[DashboardAgents] Failed to spawn ${agent.name}:`, error.message);
    return false;
  }
}

/**
 * Check if agent session is still alive
 */
async function checkAgentHealth(agent: DashboardAgent): Promise<boolean> {
  try {
    const cmd = `openclaw sessions list --json`;
    const { stdout } = await execAsync(cmd, {
      timeout: 10000,
      env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` }
    });
    
    const sessions = JSON.parse(stdout);
    const found = sessions.sessions?.some((s: any) => s.key === agent.sessionKey);
    
    if (!found) {
      logger.warn(`[DashboardAgents] ⚠️  ${agent.name} session not found, respawning...`);
      agent.spawned = false;
      return false;
    }
    
    agent.lastHealthCheck = Date.now();
    return true;
  } catch (error) {
    logger.error(`[DashboardAgents] Health check failed for ${agent.name}:`, error);
    return false;
  }
}

/**
 * Health check loop - respawn dead agents
 */
async function healthCheckLoop() {
  for (const agent of DASHBOARD_AGENTS) {
    if (!agent.spawned) {
      await spawnAgentSession(agent);
      continue;
    }
    
    const healthy = await checkAgentHealth(agent);
    if (!healthy) {
      await spawnAgentSession(agent);
    }
  }
}

/**
 * Initialize all dashboard agent sessions
 */
export async function initializeDashboardAgents(): Promise<void> {
  logger.debug('[DashboardAgents] Initializing persistent agent sessions...');
  
  // Spawn all agents in parallel
  const results = await Promise.all(
    DASHBOARD_AGENTS.map(agent => spawnAgentSession(agent))
  );
  
  const successCount = results.filter(r => r).length;
  logger.debug(`[DashboardAgents] Spawned ${successCount}/${DASHBOARD_AGENTS.length} agents`);
  
  // Start health check loop
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
  }
  healthCheckTimer = setInterval(healthCheckLoop, HEALTH_CHECK_INTERVAL);
  
  logger.debug('[DashboardAgents] Health check monitoring started');
}

/**
 * Cleanup on app exit
 */
export function shutdownDashboardAgents(): void {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
  logger.debug('[DashboardAgents] Shutdown complete');
}

/**
 * Get status of all dashboard agents
 */
export function getDashboardAgentsStatus() {
  return DASHBOARD_AGENTS.map(agent => ({
    id: agent.id,
    name: agent.name,
    sessionKey: agent.sessionKey,
    spawned: agent.spawned,
    lastHealthCheck: agent.lastHealthCheck,
  }));
}
