// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/knowledge/review — Daily knowledge discovery from completed tasks
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { syncArticleToFilesystem } from '@/lib/knowledgeSync';

export async function POST() {
  try {
    const db = getDb();
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Find tasks completed in last 24h
    const completedTasks = db.prepare(`
      SELECT t.id, t.title, t.description, t.planningNotes, t.assignedTo, t.lastAgentUpdate, t.completedAt
      FROM tasks t
      WHERE t.status = 'done' AND t.completedAt > ?
      ORDER BY t.completedAt DESC
      LIMIT 20
    `).all(oneDayAgo) as Array<{
      id: string; title: string; description: string | null;
      planningNotes: string | null; assignedTo: string | null;
      lastAgentUpdate: string | null; completedAt: number;
    }>;

    if (completedTasks.length === 0) {
      return NextResponse.json({ success: true, articlesCreated: 0, message: 'No new completed tasks' });
    }

    // Check which tasks already have knowledge articles
    const existingArticles = new Set<string>();
    for (const task of completedTasks) {
      const existing = db.prepare(
        `SELECT id FROM knowledge_base WHERE tags LIKE ?`
      ).get(`%${task.id}%`) as { id: string } | undefined;
      if (existing) existingArticles.add(task.id);
    }

    let articlesCreated = 0;

    for (const task of completedTasks) {
      if (existingArticles.has(task.id)) continue;

      // Gather task context
      const activities = db.prepare(
        `SELECT action, message FROM task_activity WHERE taskId = ? AND action NOT IN ('status_change','update','dispatched')
         ORDER BY timestamp DESC LIMIT 10`
      ).all(task.id) as { action: string; message: string }[];

      const subtasks = db.prepare(
        `SELECT title, completed FROM subtasks WHERE taskId = ? ORDER BY position`
      ).all(task.id) as { title: string; completed: number }[];

      const attachments = db.prepare(
        `SELECT fileName, category FROM task_attachments WHERE taskId = ? LIMIT 5`
      ).all(task.id) as { fileName: string; category: string }[];

      // Build knowledge article content
      const activitySummary = activities.slice(0, 5)
        .map(a => `- [${a.action}] ${(a.message || '').slice(0, 100)}`)
        .join('\n');
      const subtaskSummary = subtasks
        .map(s => `- [${s.completed ? 'x' : ' '}] ${s.title}`)
        .join('\n');
      const fileSummary = attachments
        .map(a => `- ${a.fileName} (${a.category})`)
        .join('\n');

      const content = [
        `## Summary`,
        task.lastAgentUpdate || task.description || 'No summary available.',
        '',
        task.planningNotes ? `## Approach\n${task.planningNotes.slice(0, 500)}` : '',
        subtaskSummary ? `## Steps Completed\n${subtaskSummary}` : '',
        activitySummary ? `## Key Activity\n${activitySummary}` : '',
        fileSummary ? `## Files Created\n${fileSummary}` : '',
        '',
        `---`,
        `*Auto-discovered from task ${task.id} completed by ${task.assignedTo || 'unknown'} on ${new Date(task.completedAt).toISOString().slice(0, 10)}*`,
      ].filter(Boolean).join('\n');

      // Determine category from task content
      const taskText = `${task.title} ${task.description || ''} ${task.planningNotes || ''}`.toLowerCase();
      let category = 'general';
      if (taskText.includes('research') || taskText.includes('analysis')) category = 'research';
      else if (taskText.includes('code') || taskText.includes('implement') || taskText.includes('fix')) category = 'engineering';
      else if (taskText.includes('design') || taskText.includes('ui') || taskText.includes('ux')) category = 'design';
      else if (taskText.includes('content') || taskText.includes('post') || taskText.includes('social')) category = 'content';
      else if (taskText.includes('process') || taskText.includes('workflow') || taskText.includes('training')) category = 'process';

      // Create knowledge article
      const now = Date.now();
      const id = `kb-${now}-${Math.random().toString(36).slice(2, 7)}`;
      const tags = JSON.stringify(['auto-discovered', task.id, task.assignedTo || 'unknown'].filter(Boolean));

      db.prepare(`
        INSERT INTO knowledge_base (id, title, content, category, tags, scope, pinned, version, createdBy, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, 'all', 0, 1, 'system', ?, ?)
      `).run(id, `[Learned] ${task.title}`, content, category, tags, now, now);

      // Sync to filesystem
      syncArticleToFilesystem({
        id, title: `[Learned] ${task.title}`, content, category,
        tags: ['auto-discovered', task.id], scope: 'all', createdBy: 'system', updatedAt: now,
      });

      articlesCreated++;
    }

    return NextResponse.json({
      success: true,
      articlesCreated,
      tasksScanned: completedTasks.length,
      alreadyDocumented: existingArticles.size,
    });
  } catch (err) {
    console.error('[knowledge-review]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
