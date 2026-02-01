import express from 'express';
import Database from 'better-sqlite3';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);
const router = express.Router();

const DB_PATH = path.join(process.env.HOME || '/Users/worker', 'clawd/data/froggo.db');
// Pattern A ONLY: Each agent lives at /Users/worker/clawd-{agent}/
// No more /clawd/agents/ directory (deprecated and removed)
const HOME = process.env.HOME || '/Users/worker';
function resolveAgentWorkspace(agentId: string): string {
  if (agentId === 'main' || agentId === 'froggo') {
    return path.join(HOME, 'clawd');
  }
  return path.join(HOME, `clawd-${agentId}`);
}

// Get agent metrics overview
router.get('/metrics', async (req, res) => {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    
    const metrics: Record<string, any> = {};
    const agents = ['main', 'coder', 'researcher', 'writer', 'chief'];

    for (const agentId of agents) {
      // Get task stats
      const taskStats = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as inProgress
        FROM tasks
        WHERE assigned_to = ?
      `).get(agentId) as any;

      // Get average completion time (mock for now)
      const avgTime = taskStats.completed > 0 ? '2.5h' : 'N/A';

      // Get success rate
      const successRate = taskStats.total > 0 
        ? taskStats.completed / taskStats.total 
        : 0;

      metrics[agentId] = {
        successRate,
        avgTime,
        totalTasks: taskStats.total,
        completedTasks: taskStats.completed,
        inProgressTasks: taskStats.inProgress,
      };
    }

    db.close();
    res.json(metrics);
  } catch (error) {
    console.error('Failed to get agent metrics:', error);
    res.status(500).json({ error: 'Failed to load metrics' });
  }
});

// Get detailed agent info
router.get('/:agentId/details', async (req, res) => {
  const { agentId } = req.params;

  try {
    const db = new Database(DB_PATH, { readonly: true });

    // Get task stats
    const taskStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed
      FROM tasks
      WHERE assigned_to = ?
    `).get(agentId) as any;

    // Get recent tasks
    const recentTasks = db.prepare(`
      SELECT id, title, status, completed_at as completedAt, metadata
      FROM tasks
      WHERE assigned_to = ?
      ORDER BY COALESCE(completed_at, updated_at) DESC
      LIMIT 10
    `).all(agentId);

    // Parse outcomes from metadata
    const tasksWithOutcomes = recentTasks.map((task: any) => {
      let outcome = 'unknown';
      try {
        const metadata = task.metadata ? JSON.parse(task.metadata) : {};
        outcome = metadata.outcome || (task.status === 'done' ? 'success' : 'ongoing');
      } catch (e) {
        outcome = task.status === 'done' ? 'success' : 'ongoing';
      }
      return { ...task, outcome };
    });

    // Get skills from skill_evolution table
    const skills = db.prepare(`
      SELECT 
        skill_name as name,
        proficiency,
        last_used as lastUsed,
        success_count as successCount,
        failure_count as failureCount
      FROM skill_evolution
      ORDER BY proficiency DESC
    `).all();

    // Calculate success rate
    const successRate = taskStats.total > 0 
      ? taskStats.completed / taskStats.total 
      : 0;

    // Mock average time (would need time tracking in DB)
    const avgTime = '2.5h';

    // Get brain notes from learning_events
    const brainNotes = db.prepare(`
      SELECT description, outcome
      FROM learning_events
      WHERE outcome IN ('insight', 'pattern')
      ORDER BY timestamp DESC
      LIMIT 20
    `).all().map((row: any) => row.description);

    db.close();

    // Load AGENTS.md rules (Pattern A: /clawd-{agent}/AGENTS.md)
    let agentRules = '';
    try {
      const workspace = resolveAgentWorkspace(agentId);
      const agentMdPath = path.join(workspace, 'AGENTS.md');
      agentRules = await readFile(agentMdPath, 'utf-8');
    } catch (e) {
      agentRules = 'AGENTS.md not found';
    }

    res.json({
      successRate,
      avgTime,
      totalTasks: taskStats.total,
      successfulTasks: taskStats.completed,
      failedTasks: taskStats.total - taskStats.completed,
      skills,
      recentTasks: tasksWithOutcomes,
      brainNotes,
      agentRules,
    });
  } catch (error) {
    console.error('Failed to get agent details:', error);
    res.status(500).json({ error: 'Failed to load agent details' });
  }
});

// Add skill to agent
router.post('/:agentId/skills', async (req, res) => {
  const { agentId } = req.params;
  const { skill } = req.body;

  if (!skill) {
    return res.status(400).json({ error: 'Skill name required' });
  }

  try {
    const db = new Database(DB_PATH);
    
    // Insert or update skill
    db.prepare(`
      INSERT INTO skill_evolution (skill_name, proficiency, last_used, success_count, failure_count)
      VALUES (?, 0.5, datetime('now'), 0, 0)
      ON CONFLICT(skill_name) DO UPDATE SET
        updated_at = datetime('now')
    `).run(skill);

    db.close();

    res.json({ success: true, skill });
  } catch (error) {
    console.error('Failed to add skill:', error);
    res.status(500).json({ error: 'Failed to add skill' });
  }
});

// Update skill proficiency
router.patch('/:agentId/skills/:skillName', async (req, res) => {
  const { agentId, skillName } = req.params;
  const { proficiency } = req.body;

  if (proficiency === undefined || proficiency < 0 || proficiency > 1) {
    return res.status(400).json({ error: 'Proficiency must be between 0 and 1' });
  }

  try {
    const db = new Database(DB_PATH);
    
    db.prepare(`
      UPDATE skill_evolution
      SET proficiency = ?, updated_at = datetime('now')
      WHERE skill_name = ?
    `).run(proficiency, skillName);

    db.close();

    res.json({ success: true, skill: skillName, proficiency });
  } catch (error) {
    console.error('Failed to update skill:', error);
    res.status(500).json({ error: 'Failed to update skill' });
  }
});

// Spawn chat session with agent
router.post('/spawn-chat', async (req, res) => {
  const { agentId } = req.body;

  try {
    const agentPrompts: Record<string, string> = {
      main: 'You are Froggo, the main orchestrator agent. You help with any task, coordinate other agents, and review work.',
      froggo: 'You are Froggo, the main orchestrator agent. You help with any task, coordinate other agents, and review work.',
      coder: 'You are Coder, a software engineering agent. You help with code, debugging, architecture, and technical problems.',
      researcher: 'You are Researcher, a research and analysis agent. You help with research, data gathering, and analysis.',
      writer: 'You are Writer, a content creation agent. You help with writing, editing, and content strategy.',
      chief: 'You are Chief, the executive oversight agent. You help with planning, prioritization, and strategic decisions.',
    };

    // Load AGENTS.md from Pattern A workspace (/clawd-{agent}/AGENTS.md)
    let agentPrompt = agentPrompts[agentId] || `You are the ${agentId} agent. Help the user with tasks related to your role.`;
    try {
      const workspace = resolveAgentWorkspace(agentId);
      const agentMd = await readFile(path.join(workspace, 'AGENTS.md'), 'utf-8');
      agentPrompt = `${agentPrompt}\n\nYour agent rules:\n${agentMd.slice(0, 2000)}`;
    } catch (e) {
      // Use default prompt
    }

    const sessionKey = `chat-${agentId}-${Date.now()}`;

    // Store session for chat handler
    if (!(global as any)._agentChatSessions) {
      (global as any)._agentChatSessions = {};
    }
    (global as any)._agentChatSessions[sessionKey] = {
      agentId,
      systemPrompt: agentPrompt,
      messages: [{ role: 'system', content: agentPrompt }],
      label: `dashboard-chat-${agentId}-${Date.now()}`,
    };

    res.json({ sessionKey });
  } catch (error) {
    console.error('Failed to spawn chat:', error);
    res.status(500).json({ error: 'Failed to spawn chat session' });
  }
});

// Send message in chat
router.post('/chat', async (req, res) => {
  const { sessionKey, message } = req.body;

  try {
    // Route through clawdbot agent CLI for real LLM responses
    const sessions = (global as any)._agentChatSessions || {};
    const session = sessions[sessionKey];
    
    if (!session) {
      res.status(404).json({ error: `Session ${sessionKey} not found. Please reconnect.` });
      return;
    }

    // Add user message to history
    session.messages.push({ role: 'user', content: message });

    // Build context
    const recentHistory = session.messages
      .filter((m: any) => m.role !== 'system')
      .slice(-6)
      .map((m: any) => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const fullMessage = session.messages.length <= 2
      ? `${session.systemPrompt}\n\nRespond to this message from the dashboard user:\n${message}`
      : `${session.systemPrompt}\n\nConversation so far:\n${recentHistory}`;

    const escapedMsg = fullMessage.replace(/'/g, "'\\''");
    const agentIdMap: Record<string, string> = {
      main: 'main', froggo: 'main', coder: 'coder',
      researcher: 'researcher', writer: 'writer', chief: 'chief',
    };
    const clawdAgentId = agentIdMap[session.agentId] || session.agentId;

    const { stdout } = await execAsync(
      `clawdbot agent --message '${escapedMsg}' --session-id '${sessionKey}' --agent ${clawdAgentId}`,
      { encoding: 'utf-8', timeout: 120000, env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` } }
    );

    const response = stdout.trim() || 'No response from agent';
    session.messages.push({ role: 'assistant', content: response });

    // Keep history manageable
    if (session.messages.length > 41) {
      session.messages = [session.messages[0], ...session.messages.slice(-40)];
    }

    res.json({ response });
  } catch (error: any) {
    console.error('Failed to send chat message:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

export default router;
