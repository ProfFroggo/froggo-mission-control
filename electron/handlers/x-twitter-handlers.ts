/**
 * X/Twitter Handlers Module
 * 
 * All X/Twitter content pipeline IPC handlers:
 * - x:research:* - Research tab (propose, list, approve, reject)
 * - x:plan:* - Plan tab (create, list, approve, reject)
 * - x:draft:* - Drafts tab (create, list, approve, reject)
 * - x:schedule:* - Calendar tab (create, list, update, delete)
 * - x:mention:* - Mentions tab (fetch, list, update, reply)
 * - x:replyGuy:* - Reply Guy tab (listHotMentions, createQuickDraft, postNow)
 */

import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execSync } from 'child_process';
import { prepare } from './database';
import { safeLog } from './logger';

export function registerXTwitterHandlers(): void {
  // Research handlers
  ipcMain.handle('x:research:propose', handleXResearchPropose);
  ipcMain.handle('x:research:list', handleXResearchList);
  ipcMain.handle('x:research:approve', handleXResearchApprove);
  ipcMain.handle('x:research:reject', handleXResearchReject);

  // Plan handlers
  ipcMain.handle('x:plan:create', handleXPlanCreate);
  ipcMain.handle('x:plan:list', handleXPlanList);
  ipcMain.handle('x:plan:approve', handleXPlanApprove);
  ipcMain.handle('x:plan:reject', handleXPlanReject);

  // Draft handlers
  ipcMain.handle('x:draft:create', handleXDraftCreate);
  ipcMain.handle('x:draft:list', handleXDraftList);
  ipcMain.handle('x:draft:approve', handleXDraftApprove);
  ipcMain.handle('x:draft:reject', handleXDraftReject);

  // Schedule handlers
  ipcMain.handle('x:schedule:create', handleXScheduleCreate);
  ipcMain.handle('x:schedule:list', handleXScheduleList);
  ipcMain.handle('x:schedule:update', handleXScheduleUpdate);
  ipcMain.handle('x:schedule:delete', handleXScheduleDelete);

  // Mention handlers
  ipcMain.handle('x:mention:fetch', handleXMentionFetch);
  ipcMain.handle('x:mention:list', handleXMentionList);
  ipcMain.handle('x:mention:update', handleXMentionUpdate);
  ipcMain.handle('x:mention:reply', handleXMentionReply);

  // Reply Guy handlers
  ipcMain.handle('x:replyGuy:listHotMentions', handleXReplyGuyListHotMentions);
  ipcMain.handle('x:replyGuy:createQuickDraft', handleXReplyGuyCreateQuickDraft);
  ipcMain.handle('x:replyGuy:postNow', handleXReplyGuyPostNow);
}

// ============== RESEARCH HANDLERS ==============

async function handleXResearchPropose(_: Electron.IpcMainInvokeEvent, data: {
  title: string;
  description: string;
  citations: string[];
  proposedBy: string;
}): Promise<{ success: boolean; id?: string; filePath?: string; error?: string }> {
  try {
    const { title, description, citations, proposedBy } = data;
    const id = `research-${Date.now()}`;
    const now = Date.now();

    const stmt = prepare(`
      INSERT INTO x_research_ideas (id, title, description, citations, proposed_by, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'proposed', ?)
    `);
    stmt.run(id, title, description, JSON.stringify(citations), proposedBy, now);

    const dateStr = new Date(now).toISOString().split('T')[0];
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
    const filename = `${dateStr}-${slug}.md`;
    const filePath = path.join(os.homedir(), 'froggo', 'x-content', 'research', filename);

    const fileContent = `---
id: ${id}
type: research
title: ${title}
proposed_by: ${proposedBy}
status: proposed
created_at: ${new Date(now).toISOString()}
---

# ${title}

${description}

## Citations

${citations.map(url => `- ${url}`).join('\n')}
`;

    fs.writeFileSync(filePath, fileContent, 'utf-8');
    prepare('UPDATE x_research_ideas SET file_path = ? WHERE id = ?').run(filePath, id);

    execSync(`cd ~/froggo/x-content && git add research/${filename} && git commit -m "feat: Add research idea '${title}' (proposed by ${proposedBy})"`, {
      encoding: 'utf-8'
    });

    safeLog.log(`[X/Research] Created research idea: ${id}`);
    return { success: true, id, filePath };
  } catch (error: any) {
    safeLog.error('[X/Research] Propose error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXResearchList(_: Electron.IpcMainInvokeEvent, filters?: {
  status?: string;
  limit?: number;
}): Promise<{ success: boolean; ideas: any[]; error?: string }> {
  try {
    let query = 'SELECT * FROM x_research_ideas';
    const params: any[] = [];

    if (filters?.status) {
      query += ' WHERE status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const stmt = prepare(query);
    const ideas = stmt.all(...params);

    const parsed = ideas.map((idea: any) => ({
      ...idea,
      citations: idea.citations ? JSON.parse(idea.citations) : []
    }));

    return { success: true, ideas: parsed };
  } catch (error: any) {
    safeLog.error('[X/Research] List error:', error.message);
    return { success: false, ideas: [], error: error.message };
  }
}

async function handleXResearchApprove(_: Electron.IpcMainInvokeEvent, data: {
  id: string;
  approvedBy: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { id, approvedBy } = data;
    const now = Date.now();

    const stmt = prepare(`
      UPDATE x_research_ideas 
      SET status = 'approved', approved_by = ?, updated_at = ?
      WHERE id = ?
    `);
    const result = stmt.run(approvedBy, now, id);

    if (result.changes === 0) {
      throw new Error('Research idea not found');
    }

    const idea = prepare('SELECT file_path FROM x_research_ideas WHERE id = ?').get(id) as any;
    if (idea?.filePath && fs.existsSync(idea.file_path)) {
      let content = fs.readFileSync(idea.file_path, 'utf-8');
      content = content.replace(/status: proposed/, 'status: approved');
      content = content.replace(/^---\n/, `---\napproved_by: ${approvedBy}\napproved_at: ${new Date(now).toISOString()}\n---\n`);
      fs.writeFileSync(idea.file_path, content, 'utf-8');

      const filename = path.basename(idea.file_path);
      execSync(`cd ~/froggo/x-content && git add research/${filename} && git commit -m "approve: Research idea ${id} (approved by ${approvedBy})"`, {
        encoding: 'utf-8'
      });
    }

    safeLog.log(`[X/Research] Approved research idea: ${id}`);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[X/Research] Approve error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXResearchReject(_: Electron.IpcMainInvokeEvent, data: {
  id: string;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { id, reason } = data;
    const now = Date.now();

    const stmt = prepare(`
      UPDATE x_research_ideas 
      SET status = 'rejected', updated_at = ?, metadata = json_set(COALESCE(metadata, '{}'), '$.rejectionReason', ?)
      WHERE id = ?
    `);
    const result = stmt.run(now, reason || '', id);

    if (result.changes === 0) {
      throw new Error('Research idea not found');
    }

    const idea = prepare('SELECT file_path FROM x_research_ideas WHERE id = ?').get(id) as any;
    if (idea?.file_path && fs.existsSync(idea.file_path)) {
      let content = fs.readFileSync(idea.file_path, 'utf-8');
      content = content.replace(/status: proposed/, 'status: rejected');
      if (reason) {
        content = content.replace(/^---\n/, `---\nrejection_reason: ${reason}\nrejected_at: ${new Date(now).toISOString()}\n---\n`);
      }
      fs.writeFileSync(idea.file_path, content, 'utf-8');

      const filename = path.basename(idea.file_path);
      execSync(`cd ~/froggo/x-content && git add research/${filename} && git commit -m "reject: Research idea ${id}"`, {
        encoding: 'utf-8'
      });
    }

    safeLog.log(`[X/Research] Rejected research idea: ${id}`);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[X/Research] Reject error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============== PLAN HANDLERS ==============

async function handleXPlanCreate(_: Electron.IpcMainInvokeEvent, data: {
  researchIdeaId: string;
  title: string;
  contentType: string;
  threadLength: number;
  description: string;
  proposedBy: string;
}): Promise<{ success: boolean; id?: string; filePath?: string; error?: string }> {
  try {
    const { researchIdeaId, title, contentType, threadLength, description, proposedBy } = data;
    const id = `plan-${Date.now()}`;
    const now = Date.now();

    const stmt = prepare(`
      INSERT INTO x_content_plans (id, research_idea_id, title, content_type, thread_length, proposed_by, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'proposed', ?)
    `);
    stmt.run(id, researchIdeaId, title, contentType, threadLength, proposedBy, now);

    const dateStr = new Date(now).toISOString().split('T')[0];
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
    const filename = `${dateStr}-${slug}.md`;
    const filePath = path.join(os.homedir(), 'froggo', 'x-content', 'plans', filename);

    const fileContent = `---
id: ${id}
type: plan
research_idea_id: ${researchIdeaId}
title: ${title}
content_type: ${contentType}
thread_length: ${threadLength}
proposed_by: ${proposedBy}
status: proposed
created_at: ${new Date(now).toISOString()}
---

# ${title}

## Content Type
${contentType}

## Thread Length
${threadLength} tweet${threadLength > 1 ? 's' : ''}

## Description
${description}
`;

    fs.writeFileSync(filePath, fileContent, 'utf-8');
    prepare('UPDATE x_content_plans SET file_path = ? WHERE id = ?').run(filePath, id);

    execSync(`cd ~/froggo/x-content && git add plans/${filename} && git commit -m "feat: Add content plan '${title}' (${contentType}, ${threadLength} tweets, proposed by ${proposedBy})"`, {
      encoding: 'utf-8'
    });

    safeLog.log(`[X/Plan] Created content plan: ${id}`);
    return { success: true, id, filePath };
  } catch (error: any) {
    safeLog.error('[X/Plan] Create error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXPlanList(_: Electron.IpcMainInvokeEvent, filters?: {
  status?: string;
  contentType?: string;
  limit?: number;
}): Promise<{ success: boolean; plans: any[]; error?: string }> {
  try {
    let query = 'SELECT * FROM x_content_plans WHERE 1=1';
    const params: any[] = [];

    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters?.contentType) {
      query += ' AND content_type = ?';
      params.push(filters.contentType);
    }

    query += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const stmt = prepare(query);
    const plans = stmt.all(...params);

    return { success: true, plans };
  } catch (error: any) {
    safeLog.error('[X/Plan] List error:', error.message);
    return { success: false, plans: [], error: error.message };
  }
}

async function handleXPlanApprove(_: Electron.IpcMainInvokeEvent, data: {
  id: string;
  approvedBy: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { id, approvedBy } = data;
    const now = Date.now();

    const stmt = prepare(`
      UPDATE x_content_plans 
      SET status = 'approved', approved_by = ?, updated_at = ?
      WHERE id = ?
    `);
    const result = stmt.run(approvedBy, now, id);

    if (result.changes === 0) {
      throw new Error('Content plan not found');
    }

    const plan = prepare('SELECT file_path FROM x_content_plans WHERE id = ?').get(id) as any;
    if (plan?.file_path && fs.existsSync(plan.file_path)) {
      let content = fs.readFileSync(plan.file_path, 'utf-8');
      content = content.replace(/status: proposed/, 'status: approved');
      content = content.replace(/^---\n/, `---\napproved_by: ${approvedBy}\napproved_at: ${new Date(now).toISOString()}\n`);
      fs.writeFileSync(plan.file_path, content, 'utf-8');

      const filename = path.basename(plan.file_path);
      execSync(`cd ~/froggo/x-content && git add plans/${filename} && git commit -m "approve: Content plan ${id} (approved by ${approvedBy})"`, {
        encoding: 'utf-8'
      });
    }

    safeLog.log(`[X/Plan] Approved content plan: ${id}`);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[X/Plan] Approve error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXPlanReject(_: Electron.IpcMainInvokeEvent, data: {
  id: string;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { id, reason } = data;
    const now = Date.now();

    const stmt = prepare(`
      UPDATE x_content_plans 
      SET status = 'rejected', updated_at = ?, metadata = json_set(COALESCE(metadata, '{}'), '$.rejectionReason', ?)
      WHERE id = ?
    `);
    const result = stmt.run(now, reason || '', id);

    if (result.changes === 0) {
      throw new Error('Content plan not found');
    }

    const plan = prepare('SELECT file_path FROM x_content_plans WHERE id = ?').get(id) as any;
    if (plan?.file_path && fs.existsSync(plan.file_path)) {
      let content = fs.readFileSync(plan.file_path, 'utf-8');
      content = content.replace(/status: proposed/, 'status: rejected');
      if (reason) {
        content = content.replace(/^---\n/, `---\nrejection_reason: ${reason}\nrejected_at: ${new Date(now).toISOString()}\n`);
      }
      fs.writeFileSync(plan.file_path, content, 'utf-8');

      const filename = path.basename(plan.file_path);
      execSync(`cd ~/froggo/x-content && git add plans/${filename} && git commit -m "reject: Content plan ${id}"`, {
        encoding: 'utf-8'
      });
    }

    safeLog.log(`[X/Plan] Rejected content plan: ${id}`);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[X/Plan] Reject error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============== DRAFT HANDLERS (PLACEHOLDER - TO BE IMPLEMENTED) ==============

async function handleXDraftCreate(): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleXDraftList(): Promise<{ success: boolean; drafts: any[]; error?: string }> {
  return { success: false, drafts: [], error: 'Not implemented in this refactoring phase' };
}

async function handleXDraftApprove(): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleXDraftReject(): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

// ============== SCHEDULE HANDLERS (PLACEHOLDER) ==============

async function handleXScheduleCreate(): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleXScheduleList(): Promise<{ success: boolean; schedules: any[]; error?: string }> {
  return { success: false, schedules: [], error: 'Not implemented in this refactoring phase' };
}

async function handleXScheduleUpdate(): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleXScheduleDelete(): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

// ============== MENTION HANDLERS (PLACEHOLDER) ==============

async function handleXMentionFetch(): Promise<{ success: boolean; mentions: any[]; error?: string }> {
  return { success: false, mentions: [], error: 'Not implemented in this refactoring phase' };
}

async function handleXMentionList(): Promise<{ success: boolean; mentions: any[]; error?: string }> {
  return { success: false, mentions: [], error: 'Not implemented in this refactoring phase' };
}

async function handleXMentionUpdate(): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleXMentionReply(): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

// ============== REPLY GUY HANDLERS (PLACEHOLDER) ==============

async function handleXReplyGuyListHotMentions(): Promise<{ success: boolean; mentions: any[]; error?: string }> {
  return { success: false, mentions: [], error: 'Not implemented in this refactoring phase' };
}

async function handleXReplyGuyCreateQuickDraft(): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}

async function handleXReplyGuyPostNow(): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Not implemented in this refactoring phase' };
}
