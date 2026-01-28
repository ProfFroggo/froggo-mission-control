import express from 'express';
import Database from 'better-sqlite3';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);
const router = express.Router();

const DB_PATH = path.join(process.env.HOME || '/Users/worker', 'clawd/data/froggo.db');
const AGENTS_PATH = path.join(process.env.HOME || '/Users/worker', 'clawd/agents');

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
      SELECT content, outcome
      FROM learning_events
      WHERE outcome IN ('insight', 'pattern')
      ORDER BY timestamp DESC
      LIMIT 20
    `).all().map((row: any) => row.content);

    db.close();

    // Load AGENT.md rules
    let agentRules = '';
    try {
      const agentMdPath = path.join(AGENTS_PATH, agentId, 'AGENT.md');
      agentRules = await readFile(agentMdPath, 'utf-8');
    } catch (e) {
      // Try alternative paths
      try {
        const altPath = path.join(AGENTS_PATH, `${agentId}/AGENT.md`);
        agentRules = await readFile(altPath, 'utf-8');
      } catch (e2) {
        agentRules = 'AGENT.md not found';
      }
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
    // Load agent prompt
    let agentPrompt = '';
    try {
      const agentMdPath = path.join(AGENTS_PATH, agentId, 'AGENT.md');
      agentPrompt = await readFile(agentMdPath, 'utf-8');
    } catch (e) {
      agentPrompt = `You are ${agentId}, a specialized agent. You are in a collaborative chat to discuss improvements, skills, and performance.`;
    }

    // For now, return a mock session key
    // In production, this would spawn via gateway
    const sessionKey = `chat-${agentId}-${Date.now()}`;

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
    // Mock response for now
    // In production, this would use gateway.request('sessions.send', ...)
    
    const responses = [
      "That's a great suggestion! I'll focus on improving that area.",
      "I've been working on that skill. Let me know if you see improvements.",
      "Thanks for the feedback. I'll incorporate that into my workflow.",
      "I need more practice with that. Can you assign me some tasks to learn?",
      "Let me analyze my recent performance and get back to you.",
    ];

    const response = responses[Math.floor(Math.random() * responses.length)];

    res.json({ response });
  } catch (error) {
    console.error('Failed to send chat message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
