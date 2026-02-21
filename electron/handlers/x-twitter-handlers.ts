/**
 * X/Twitter IPC Handlers
 *
 * All X/Twitter-related IPC handlers extracted from main.ts.
 * Covers channels: execute:tweet, twitter:*, x:* (including x:reddit:*, x:replyGuy:*,
 * x:mention:*, x:schedule:*, x:draft:*, x:plan:*, x:research:*, x:analytics:*, x:campaign:*)
 *
 * 61 raw handlers in main.ts → 58 unique registerHandler calls here
 * (3 x:campaign channels deduplicated — second occurrence wins: INSERT OR REPLACE + row-count checking)
 */

import { dialog } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';
import { registerHandler } from '../ipc-registry';
import { prepare } from '../database';
import { safeLog } from '../logger';
import {
  postTweet as xPostTweet,
  getMentions as xGetMentions,
  getHomeTimeline as xGetHomeTimeline,
  searchRecent as xSearchRecent,
  getUserProfile as xGetUserProfile,
  sendDM as xSendDM,
  deleteTweet as xDeleteTweet,
  likeTweet as xLikeTweet,
  unlikeTweet as xUnlikeTweet,
  retweet as xRetweet,
  unretweet as xUnretweet,
  followUser as xFollowUser,
  unfollowUser as xUnfollowUser,
  getFollowers as xGetFollowers,
  getFollowing as xGetFollowing,
} from '../x-api-client';

const execAsync = promisify(exec);

// xApi namespace wrapper
const xApi = {
  postTweet: xPostTweet,
  getMentions: xGetMentions,
  getHomeTimeline: xGetHomeTimeline,
  searchRecent: xSearchRecent,
  getUserProfile: xGetUserProfile,
  sendDM: xSendDM,
  deleteTweet: xDeleteTweet,
  likeTweet: xLikeTweet,
  unlikeTweet: xUnlikeTweet,
  retweet: xRetweet,
  unretweet: xUnretweet,
  followUser: xFollowUser,
  unfollowUser: xUnfollowUser,
  getFollowers: xGetFollowers,
  getFollowing: xGetFollowing,
};

/**
 * Register all X/Twitter IPC handlers.
 */
export function registerXTwitterHandlers(): void {
  // ── Execution ──
  registerHandler('execute:tweet', handleExecuteTweet);

  // ── Twitter namespace ──
  registerHandler('twitter:mentions', handleTwitterMentions);
  registerHandler('twitter:home', handleTwitterHome);
  registerHandler('twitter:queue-post', handleTwitterQueuePost);

  // ── X API v2 namespace ──
  registerHandler('x:search', handleXSearch);
  registerHandler('x:like', handleXLike);
  registerHandler('x:unlike', handleXUnlike);
  registerHandler('x:retweet', handleXRetweet);
  registerHandler('x:unretweet', handleXUnretweet);
  registerHandler('x:follow', handleXFollow);
  registerHandler('x:unfollow', handleXUnfollow);
  registerHandler('x:profile', handleXProfile);
  registerHandler('x:post', handleXPost);
  registerHandler('x:delete', handleXDelete);
  registerHandler('x:dm', handleXDm);
  registerHandler('x:home', handleXHome);
  registerHandler('x:followers', handleXFollowers);
  registerHandler('x:following', handleXFollowing);

  // ── Research ──
  registerHandler('x:research:propose', handleXResearchPropose);
  registerHandler('x:research:list', handleXResearchList);
  registerHandler('x:research:approve', handleXResearchApprove);
  registerHandler('x:research:reject', handleXResearchReject);

  // ── Plan ──
  registerHandler('x:plan:create', handleXPlanCreate);
  registerHandler('x:plan:list', handleXPlanList);
  registerHandler('x:plan:approve', handleXPlanApprove);
  registerHandler('x:plan:reject', handleXPlanReject);

  // ── Drafts ──
  registerHandler('x:draft:create', handleXDraftCreate);
  registerHandler('x:draft:list', handleXDraftList);
  registerHandler('x:draft:approve', handleXDraftApprove);
  registerHandler('x:draft:reject', handleXDraftReject);
  registerHandler('x:draft:pickImage', handleXDraftPickImage);

  // ── Analytics ──
  registerHandler('x:analytics:summary', handleXAnalyticsSummary);
  registerHandler('x:analytics:topContent', handleXAnalyticsTopContent);

  // ── Schedule (complex CRUD) ──
  registerHandler('x:schedule:create', handleXScheduleCreate);
  registerHandler('x:schedule:list', handleXScheduleList);
  registerHandler('x:schedule:update', handleXScheduleUpdate);
  registerHandler('x:schedule:delete', handleXScheduleDelete);

  // ── Schedule (simple) ──
  registerHandler('x:schedule', handleXScheduleSimple);
  registerHandler('x:scheduled', handleXScheduled);
  registerHandler('x:cancel', handleXCancel);

  // ── Campaign (deduplicated — second occurrence: INSERT OR REPLACE + row-count) ──
  registerHandler('x:campaign:list', handleXCampaignList);
  registerHandler('x:campaign:save', handleXCampaignSave);
  registerHandler('x:campaign:delete', handleXCampaignDelete);

  // ── Mentions ──
  registerHandler('x:mention:fetch', handleXMentionFetch);
  registerHandler('x:mention:list', handleXMentionList);
  registerHandler('x:mention:update', handleXMentionUpdate);
  registerHandler('x:mention:reply', handleXMentionReply);

  // ── Reply Guy ──
  registerHandler('x:replyGuy:listHotMentions', handleXReplyGuyListHotMentions);
  registerHandler('x:replyGuy:createQuickDraft', handleXReplyGuyCreateQuickDraft);
  registerHandler('x:replyGuy:postNow', handleXReplyGuyPostNow);

  // ── Reddit ──
  registerHandler('x:reddit:createMonitor', handleXRedditCreateMonitor);
  registerHandler('x:reddit:listMonitors', handleXRedditListMonitors);
  registerHandler('x:reddit:fetch', handleXRedditFetch);
  registerHandler('x:reddit:listThreads', handleXRedditListThreads);
  registerHandler('x:reddit:generateDraft', handleXRedditGenerateDraft);
  registerHandler('x:reddit:saveDraft', handleXRedditSaveDraft);
  registerHandler('x:reddit:postReply', handleXRedditPostReply);
  registerHandler('x:reddit:updateThread', handleXRedditUpdateThread);

  safeLog.log('[X/Twitter] Handlers registered (58 channels)');
}

// ============== EXECUTION HANDLERS ==============

async function handleExecuteTweet(_: Electron.IpcMainInvokeEvent, content: string, taskId?: string): Promise<any> {
  if (taskId) {
    exec(`froggo-db task-progress "${taskId}" "Posting tweet via X API..." --step "Execution"`, () => {});
  }

  try {
    const result = await xApi.postTweet(content);
    if (result.success) {
      safeLog.log('[Execute] Tweet posted:', result.id);
      if (taskId) {
        exec(`froggo-db task-progress "${taskId}" "Tweet posted successfully" --step "Complete"`, () => {});
        exec(`froggo-db task-complete "${taskId}" --outcome success`, () => {});
      }
      return { success: true, id: result.id };
    } else {
      safeLog.error('[Execute] Tweet error:', result.error);
      if (taskId) {
        exec(`froggo-db task-progress "${taskId}" "Failed: ${result.error}" --step "Error"`, () => {});
        exec(`froggo-db task-update "${taskId}" --status failed`, () => {});
      }
      return { success: false, error: result.error };
    }
  } catch (e: any) {
    safeLog.error('[Execute] Tweet exception:', e.message);
    if (taskId) {
      exec(`froggo-db task-update "${taskId}" --status failed`, () => {});
    }
    return { success: false, error: e.message };
  }
}

// ============== TWITTER IPC HANDLERS (X API v2) ==============

async function handleTwitterMentions(): Promise<any> {
  safeLog.log('[Twitter] Mentions handler called');
  try {
    const mentions = await xApi.getMentions(20);
    safeLog.log('[Twitter] Got', mentions.length, 'mentions');
    return { success: true, mentions };
  } catch (e: any) {
    safeLog.error('[Twitter] Mentions error:', e.message);
    return { success: false, mentions: [], error: e.message };
  }
}

async function handleTwitterHome(_: Electron.IpcMainInvokeEvent, limit?: number): Promise<any> {
  safeLog.log('[Twitter] Home handler called, limit:', limit);
  try {
    const tweets = await xApi.getHomeTimeline(limit || 20);
    safeLog.log('[Twitter] Got', tweets.length, 'home tweets');
    return { success: true, tweets };
  } catch (e: any) {
    safeLog.error('[Twitter] Home error:', e.message);
    return { success: false, tweets: [], error: e.message };
  }
}

async function handleTwitterQueuePost(_: Electron.IpcMainInvokeEvent, text: string, _context?: string): Promise<any> {
  // Queue tweet for approval via inbox
  const title = text.length > 50 ? `${text.slice(0, 47)}...` : text;
  const cmd = `froggo-db inbox-add --type tweet --title "${title.replace(/"/g, '\\"')}" --content "${text.replace(/"/g, '\\"')}" --channel dashboard`;

  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (error) => {
      if (error) {
        safeLog.error('[Twitter] Queue error:', error);
        resolve({ success: false, error: error.message });
        return;
      }
      resolve({ success: true, message: 'Tweet queued for approval in Inbox' });
    });
  });
}

// ============== X API v2 IPC HANDLERS (x: namespace) ==============

async function handleXSearch(_: Electron.IpcMainInvokeEvent, query: string, count?: number): Promise<any> {
  safeLog.log('[X:Search] Query:', query, 'count:', count);
  try {
    const tweets = await xApi.searchRecent(query, count || 20);
    return { success: true, tweets };
  } catch (e: any) {
    safeLog.error('[X:Search] Error:', e.message);
    return { success: false, tweets: [], error: e.message };
  }
}

async function handleXLike(_: Electron.IpcMainInvokeEvent, tweetId: string): Promise<any> {
  safeLog.log('[X:Like] Tweet ID:', tweetId);
  try {
    const result = await xApi.likeTweet(tweetId);
    return result;
  } catch (e: any) {
    safeLog.error('[X:Like] Error:', e.message);
    return { success: false, error: e.message };
  }
}

async function handleXUnlike(_: Electron.IpcMainInvokeEvent, tweetId: string): Promise<any> {
  safeLog.log('[X:Unlike] Tweet ID:', tweetId);
  try {
    const result = await xApi.unlikeTweet(tweetId);
    return result;
  } catch (e: any) {
    safeLog.error('[X:Unlike] Error:', e.message);
    return { success: false, error: e.message };
  }
}

async function handleXRetweet(_: Electron.IpcMainInvokeEvent, tweetId: string): Promise<any> {
  safeLog.log('[X:Retweet] Tweet ID:', tweetId);
  try {
    const result = await xApi.retweet(tweetId);
    return result;
  } catch (e: any) {
    safeLog.error('[X:Retweet] Error:', e.message);
    return { success: false, error: e.message };
  }
}

async function handleXUnretweet(_: Electron.IpcMainInvokeEvent, tweetId: string): Promise<any> {
  safeLog.log('[X:Unretweet] Tweet ID:', tweetId);
  try {
    const result = await xApi.unretweet(tweetId);
    return result;
  } catch (e: any) {
    safeLog.error('[X:Unretweet] Error:', e.message);
    return { success: false, error: e.message };
  }
}

async function handleXFollow(_: Electron.IpcMainInvokeEvent, username: string): Promise<any> {
  safeLog.log('[X:Follow] Username:', username);
  try {
    const profile = await xApi.getUserProfile(username);
    if (!profile?.id) {
      return { success: false, error: 'User not found' };
    }
    const result = await xApi.followUser(profile.id);
    return result;
  } catch (e: any) {
    safeLog.error('[X:Follow] Error:', e.message);
    return { success: false, error: e.message };
  }
}

async function handleXUnfollow(_: Electron.IpcMainInvokeEvent, username: string): Promise<any> {
  safeLog.log('[X:Unfollow] Username:', username);
  try {
    const profile = await xApi.getUserProfile(username);
    if (!profile?.id) {
      return { success: false, error: 'User not found' };
    }
    const result = await xApi.unfollowUser(profile.id);
    return result;
  } catch (e: any) {
    safeLog.error('[X:Unfollow] Error:', e.message);
    return { success: false, error: e.message };
  }
}

async function handleXProfile(_: Electron.IpcMainInvokeEvent, username: string): Promise<any> {
  safeLog.log('[X:Profile] Username:', username);
  try {
    const profile = await xApi.getUserProfile(username);
    return { success: true, profile };
  } catch (e: any) {
    safeLog.error('[X:Profile] Error:', e.message);
    return { success: false, error: e.message };
  }
}

async function handleXPost(_: Electron.IpcMainInvokeEvent, text: string, options?: { replyTo?: string; quote?: string }): Promise<any> {
  safeLog.log('[X:Post] Text length:', text.length);
  try {
    const result = await xApi.postTweet(text, {
      reply_to: options?.replyTo,
      quote: options?.quote,
    });
    return result;
  } catch (e: any) {
    safeLog.error('[X:Post] Error:', e.message);
    return { success: false, error: e.message };
  }
}

async function handleXDelete(_: Electron.IpcMainInvokeEvent, tweetId: string): Promise<any> {
  safeLog.log('[X:Delete] Tweet ID:', tweetId);
  try {
    const result = await xApi.deleteTweet(tweetId);
    return result;
  } catch (e: any) {
    safeLog.error('[X:Delete] Error:', e.message);
    return { success: false, error: e.message };
  }
}

async function handleXDm(_: Electron.IpcMainInvokeEvent, participantId: string, text: string): Promise<any> {
  safeLog.log('[X:DM] Participant:', participantId);
  try {
    const result = await xApi.sendDM(participantId, text);
    return result;
  } catch (e: any) {
    safeLog.error('[X:DM] Error:', e.message);
    return { success: false, error: e.message };
  }
}

async function handleXHome(_: Electron.IpcMainInvokeEvent, limit?: number): Promise<any> {
  safeLog.log('[X:Home] Limit:', limit);
  try {
    const tweets = await xApi.getHomeTimeline(limit || 20);
    return { success: true, tweets };
  } catch (e: any) {
    safeLog.error('[X:Home] Error:', e.message);
    return { success: false, tweets: [], error: e.message };
  }
}

async function handleXFollowers(_: Electron.IpcMainInvokeEvent, username?: string, count?: number): Promise<any> {
  safeLog.log('[X:Followers] Username:', username, 'count:', count);
  try {
    let userId: string | undefined;
    if (username) {
      const profile = await xApi.getUserProfile(username);
      userId = profile?.id;
    }
    const followers = await xApi.getFollowers(userId, count || 100);
    return { success: true, followers };
  } catch (e: any) {
    safeLog.error('[X:Followers] Error:', e.message);
    return { success: false, followers: [], error: e.message };
  }
}

async function handleXFollowing(_: Electron.IpcMainInvokeEvent, username?: string, count?: number): Promise<any> {
  safeLog.log('[X:Following] Username:', username, 'count:', count);
  try {
    let userId: string | undefined;
    if (username) {
      const profile = await xApi.getUserProfile(username);
      userId = profile?.id;
    }
    const following = await xApi.getFollowing(userId, count || 100);
    return { success: true, following };
  } catch (e: any) {
    safeLog.error('[X:Following] Error:', e.message);
    return { success: false, following: [], error: e.message };
  }
}

// ── X/Twitter Research Tab ──

async function handleXResearchPropose(_: Electron.IpcMainInvokeEvent, data: { title: string; description: string; citations: string[]; proposedBy: string }): Promise<any> {
  try {
    const { title, description, citations, proposedBy } = data;
    const id = `research-${Date.now()}`;
    const now = Date.now();

    // Create database entry
    const stmt = prepare(`
      INSERT INTO x_research_ideas (id, title, description, citations, proposed_by, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'proposed', ?)
    `);
    stmt.run(id, title, description, JSON.stringify(citations), proposedBy, now);

    // Create markdown file
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

    // Update database with file path
    prepare('UPDATE x_research_ideas SET file_path = ? WHERE id = ?').run(filePath, id);

    // Git commit
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

async function handleXResearchList(_: Electron.IpcMainInvokeEvent, filters?: { status?: string; limit?: number }): Promise<any> {
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

    // Parse JSON fields
    const parsed = ideas.map((idea: any) => {
      let citations: string[] = [];
      try {
        citations = idea.citations ? JSON.parse(idea.citations) : [];
      } catch (e) {
        safeLog.warn('[X/Research] Failed to parse citations for idea', idea.id, ':', e);
        citations = [];
      }
      return {
        ...idea,
        citations
      };
    });

    return { success: true, ideas: parsed };
  } catch (error: any) {
    safeLog.error('[X/Research] List error:', error.message);
    return { success: false, ideas: [], error: error.message };
  }
}

async function handleXResearchApprove(_: Electron.IpcMainInvokeEvent, data: { id: string; approvedBy: string }): Promise<any> {
  try {
    const { id, approvedBy } = data;
    const now = Date.now();

    // Update database
    const stmt = prepare(`
      UPDATE x_research_ideas
      SET status = 'approved', approved_by = ?, updated_at = ?
      WHERE id = ?
    `);
    const result = stmt.run(approvedBy, now, id);

    if (result.changes === 0) {
      throw new Error('Research idea not found');
    }

    // Update file (add approval metadata)
    const idea = prepare('SELECT file_path FROM x_research_ideas WHERE id = ?').get(id) as any;
    if (idea && idea.file_path && fs.existsSync(idea.file_path)) {
      let content = fs.readFileSync(idea.file_path, 'utf-8');
      content = content.replace(/status: proposed/, 'status: approved');
      content = content.replace(/^---\n/, `---\napproved_by: ${approvedBy}\napproved_at: ${new Date(now).toISOString()}\n---\n`);
      fs.writeFileSync(idea.file_path, content, 'utf-8');

      // Git commit
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

async function handleXResearchReject(_: Electron.IpcMainInvokeEvent, data: { id: string; reason?: string }): Promise<any> {
  try {
    const { id, reason } = data;
    const now = Date.now();

    // Update database
    const stmt = prepare(`
      UPDATE x_research_ideas
      SET status = 'rejected', updated_at = ?, metadata = json_set(COALESCE(metadata, '{}'), '$.rejectionReason', ?)
      WHERE id = ?
    `);
    const result = stmt.run(now, reason || '', id);

    if (result.changes === 0) {
      throw new Error('Research idea not found');
    }

    // Update file
    const idea = prepare('SELECT file_path FROM x_research_ideas WHERE id = ?').get(id) as any;
    if (idea && idea.file_path && fs.existsSync(idea.file_path)) {
      let content = fs.readFileSync(idea.file_path, 'utf-8');
      content = content.replace(/status: proposed/, 'status: rejected');
      if (reason) {
        content = content.replace(/^---\n/, `---\nrejection_reason: ${reason}\nrejected_at: ${new Date(now).toISOString()}\n---\n`);
      }
      fs.writeFileSync(idea.file_path, content, 'utf-8');

      // Git commit
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

// ── X/Twitter Plan Tab ──

async function handleXPlanCreate(_: Electron.IpcMainInvokeEvent, data: {
  researchIdeaId: string;
  title: string;
  contentType: string;
  threadLength: number;
  description: string;
  proposedBy: string;
}): Promise<any> {
  try {
    const { researchIdeaId, title, contentType, threadLength, description, proposedBy } = data;
    const id = `plan-${Date.now()}`;
    const now = Date.now();

    // Create database entry
    const stmt = prepare(`
      INSERT INTO x_content_plans (id, research_idea_id, title, content_type, thread_length, proposed_by, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'proposed', ?)
    `);
    stmt.run(id, researchIdeaId, title, contentType, threadLength, proposedBy, now);

    // Create markdown file
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

    // Update database with file path
    prepare('UPDATE x_content_plans SET file_path = ? WHERE id = ?').run(filePath, id);

    // Git commit
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

async function handleXPlanList(_: Electron.IpcMainInvokeEvent, filters?: { status?: string; contentType?: string; limit?: number }): Promise<any> {
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

async function handleXPlanApprove(_: Electron.IpcMainInvokeEvent, data: { id: string; approvedBy: string }): Promise<any> {
  try {
    const { id, approvedBy } = data;
    const now = Date.now();

    // Update database
    const stmt = prepare(`
      UPDATE x_content_plans
      SET status = 'approved', approved_by = ?, updated_at = ?
      WHERE id = ?
    `);
    const result = stmt.run(approvedBy, now, id);

    if (result.changes === 0) {
      throw new Error('Content plan not found');
    }

    // Update file
    const plan = prepare('SELECT file_path FROM x_content_plans WHERE id = ?').get(id) as any;
    if (plan && plan.file_path && fs.existsSync(plan.file_path)) {
      let content = fs.readFileSync(plan.file_path, 'utf-8');
      content = content.replace(/status: proposed/, 'status: approved');
      content = content.replace(/^---\n/, `---\napproved_by: ${approvedBy}\napproved_at: ${new Date(now).toISOString()}\n`);
      fs.writeFileSync(plan.file_path, content, 'utf-8');

      // Git commit
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

async function handleXPlanReject(_: Electron.IpcMainInvokeEvent, data: { id: string; reason?: string }): Promise<any> {
  try {
    const { id, reason } = data;
    const now = Date.now();

    // Update database
    const stmt = prepare(`
      UPDATE x_content_plans
      SET status = 'rejected', updated_at = ?, metadata = json_set(COALESCE(metadata, '{}'), '$.rejectionReason', ?)
      WHERE id = ?
    `);
    const result = stmt.run(now, reason || '', id);

    if (result.changes === 0) {
      throw new Error('Content plan not found');
    }

    // Update file
    const plan = prepare('SELECT file_path FROM x_content_plans WHERE id = ?').get(id) as any;
    if (plan && plan.file_path && fs.existsSync(plan.file_path)) {
      let content = fs.readFileSync(plan.file_path, 'utf-8');
      content = content.replace(/status: proposed/, 'status: rejected');
      if (reason) {
        content = content.replace(/^---\n/, `---\nrejection_reason: ${reason}\nrejected_at: ${new Date(now).toISOString()}\n`);
      }
      fs.writeFileSync(plan.file_path, content, 'utf-8');

      // Git commit
      const filename = path.basename(plan.file_path);
      execSync(`cd ~/froggo/x-content && git add plans/${filename} && git commit -m "reject: Content plan ${id}${reason ? ': ' + reason : ''}"`, {
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

// ── X/Twitter Drafts Tab ──

async function handleXDraftCreate(_: Electron.IpcMainInvokeEvent, data: {
  planId: string;
  version: string;
  content: string; // JSON for threads
  mediaUrls?: string[];
  proposedBy: string;
}): Promise<any> {
  try {
    const { planId, version, content, mediaUrls, proposedBy } = data;
    const id = `draft-${Date.now()}-${version}`;
    const now = Date.now();

    // Create database entry
    const stmt = prepare(`
      INSERT INTO x_drafts (id, plan_id, version, content, media_paths, proposed_by, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)
    `);
    stmt.run(id, planId, version, content, mediaUrls ? JSON.stringify(mediaUrls) : null, proposedBy, now);

    // Create markdown file
    const dateStr = new Date(now).toISOString().split('T')[0];
    const plan = prepare('SELECT title FROM x_content_plans WHERE id = ?').get(planId) as any;
    const slug = (plan?.title || 'draft').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
    const filename = `${dateStr}-${slug}-${version}.md`;
    const filePath = path.join(os.homedir(), 'froggo', 'x-content', 'drafts', filename);

    // Parse content (could be single tweet or thread)
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch {
      parsedContent = { tweets: [content] };
    }

    const tweetsMarkdown = Array.isArray(parsedContent.tweets)
      ? parsedContent.tweets.map((t: string, i: number) => `## Tweet ${i + 1}/${parsedContent.tweets.length}\n\n${t}\n\n_Characters: ${t.length}/280_`).join('\n')
      : `## Single Tweet\n\n${content}\n\n_Characters: ${content.length}/280_`;

    const fileContent = `---
id: ${id}
type: draft
version: ${version}
plan_id: ${planId}
proposed_by: ${proposedBy}
status: draft
created_at: ${new Date(now).toISOString()}
---

# Draft ${version}${plan ? ` - ${plan.title}` : ''}

${tweetsMarkdown}

${mediaUrls && mediaUrls.length > 0 ? `\n## Media\n${mediaUrls.map(url => `- ![](${url})`).join('\n')}` : ''}
`;

    fs.writeFileSync(filePath, fileContent, 'utf-8');

    // Update database with file path
    prepare('UPDATE x_drafts SET file_path = ? WHERE id = ?').run(filePath, id);

    // Git commit
    execSync(`cd ~/froggo/x-content && git add drafts/${filename} && git commit -m "feat: Add draft ${version} for plan ${planId} (proposed by ${proposedBy})"`, {
      encoding: 'utf-8'
    });

    safeLog.log(`[X/Draft] Created draft: ${id}`);
    return { success: true, id, filePath };
  } catch (error: any) {
    safeLog.error('[X/Draft] Create error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXDraftList(_: Electron.IpcMainInvokeEvent, filters?: { status?: string; planId?: string; limit?: number }): Promise<any> {
  try {
    let query = 'SELECT * FROM x_drafts WHERE 1=1';
    const params: any[] = [];

    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters?.planId) {
      query += ' AND plan_id = ?';
      params.push(filters.planId);
    }

    query += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const stmt = prepare(query);
    const drafts = stmt.all(...params);

    // Parse JSON fields
    const parsed = drafts.map((draft: any) => {
      let media_paths: string[] = [];
      try {
        media_paths = draft.media_paths ? JSON.parse(draft.media_paths) : [];
      } catch (e) {
        safeLog.warn('[X/Draft] Failed to parse media_paths for draft', draft.id, ':', e);
        media_paths = [];
      }
      return {
        ...draft,
        media_paths
      };
    });

    return { success: true, drafts: parsed };
  } catch (error: any) {
    safeLog.error('[X/Draft] List error:', error.message);
    return { success: false, drafts: [], error: error.message };
  }
}

async function handleXDraftApprove(_: Electron.IpcMainInvokeEvent, data: { id: string; approvedBy: string }): Promise<any> {
  try {
    const { id, approvedBy } = data;
    const now = Date.now();

    // Update database
    const stmt = prepare(`
      UPDATE x_drafts
      SET status = 'approved', approved_by = ?, updated_at = ?
      WHERE id = ?
    `);
    const result = stmt.run(approvedBy, now, id);

    if (result.changes === 0) {
      throw new Error('Draft not found');
    }

    // Update file
    const draft = prepare('SELECT file_path FROM x_drafts WHERE id = ?').get(id) as any;
    if (draft && draft.file_path && fs.existsSync(draft.file_path)) {
      let content = fs.readFileSync(draft.file_path, 'utf-8');
      content = content.replace(/status: draft/, 'status: approved');
      content = content.replace(/^---\n/, `---\napproved_by: ${approvedBy}\napproved_at: ${new Date(now).toISOString()}\n`);
      fs.writeFileSync(draft.file_path, content, 'utf-8');

      // Git commit
      const filename = path.basename(draft.file_path);
      execSync(`cd ~/froggo/x-content && git add drafts/${filename} && git commit -m "approve: Draft ${id} (approved by ${approvedBy})"`, {
        encoding: 'utf-8'
      });
    }

    safeLog.log(`[X/Draft] Approved draft: ${id}`);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[X/Draft] Approve error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXDraftReject(_: Electron.IpcMainInvokeEvent, data: { id: string; reason?: string }): Promise<any> {
  try {
    const { id, reason } = data;
    const now = Date.now();

    // Update database
    const stmt = prepare(`
      UPDATE x_drafts
      SET status = 'rejected', updated_at = ?, metadata = json_set(COALESCE(metadata, '{}'), '$.rejectionReason', ?)
      WHERE id = ?
    `);
    const result = stmt.run(now, reason || '', id);

    if (result.changes === 0) {
      throw new Error('Draft not found');
    }

    // Update file
    const draft = prepare('SELECT file_path FROM x_drafts WHERE id = ?').get(id) as any;
    if (draft && draft.file_path && fs.existsSync(draft.file_path)) {
      let content = fs.readFileSync(draft.file_path, 'utf-8');
      content = content.replace(/status: draft/, 'status: rejected');
      if (reason) {
        content = content.replace(/^---\n/, `---\nrejection_reason: ${reason}\nrejected_at: ${new Date(now).toISOString()}\n`);
      }
      fs.writeFileSync(draft.file_path, content, 'utf-8');

      // Git commit
      const filename = path.basename(draft.file_path);
      execSync(`cd ~/froggo/x-content && git add drafts/${filename} && git commit -m "reject: Draft ${id}${reason ? ': ' + reason : ''}"`, {
        encoding: 'utf-8'
      });
    }

    safeLog.log(`[X/Draft] Rejected draft: ${id}`);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[X/Draft] Reject error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXDraftPickImage(): Promise<any> {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, filePaths: [] };
  }
  return { success: true, filePaths: result.filePaths };
}

// ============== X/TWITTER ANALYTICS HANDLERS ==============

async function handleXAnalyticsSummary(): Promise<any> {
  try {
    const totalPosts = (prepare("SELECT COUNT(*) as count FROM x_drafts WHERE status = 'posted'").get() as any)?.count || 0;
    const totalApproved = (prepare("SELECT COUNT(*) as count FROM x_drafts WHERE status = 'approved'").get() as any)?.count || 0;
    const totalDrafts = (prepare("SELECT COUNT(*) as count FROM x_drafts").get() as any)?.count || 0;
    return {
      success: true,
      totalPosts,
      totalApproved,
      totalDrafts,
      engagementRate: totalPosts > 0 ? 3.2 : 0,
      reach: totalPosts * 847,
      impressions: totalPosts * 2341,
      estimated: true,
    };
  } catch (e: any) {
    safeLog.error('[Analytics] Summary error:', e.message);
    return { success: false, totalPosts: 0, totalApproved: 0, totalDrafts: 0, engagementRate: 0, reach: 0, impressions: 0 };
  }
}

async function handleXAnalyticsTopContent(): Promise<any> {
  try {
    const posts = prepare(
      "SELECT id, content, status, created_at FROM x_drafts WHERE status IN ('posted', 'approved') ORDER BY created_at DESC LIMIT 5"
    ).all();
    return { success: true, posts };
  } catch (e: any) {
    safeLog.error('[Analytics] TopContent error:', e.message);
    return { success: true, posts: [] };
  }
}

// ============== X/TWITTER SCHEDULE HANDLERS ==============

async function handleXScheduleCreate(_: Electron.IpcMainInvokeEvent, data: {
  draftId: string;
  scheduledFor: number;
  timeSlotReason?: string;
}): Promise<any> {
  try {
    const { draftId, scheduledFor, timeSlotReason } = data;
    const now = Date.now();
    const id = `sched-${now}`;

    // Verify draft exists and is approved
    const draft = prepare('SELECT * FROM x_drafts WHERE id = ? AND status = ?').get(draftId, 'approved') as any;
    if (!draft) {
      throw new Error('Draft not found or not approved');
    }

    // Create scheduled post
    const stmt = prepare(`
      INSERT INTO x_scheduled_posts (id, draft_id, scheduled_for, status, created_at, updated_at, metadata)
      VALUES (?, ?, ?, 'scheduled', ?, ?, json(?))
    `);

    const metadata = {
      timeSlotReason: timeSlotReason || 'Manually selected',
      scheduledBy: 'user'
    };

    stmt.run(id, draftId, scheduledFor, now, now, JSON.stringify(metadata));

    safeLog.log(`[X/Schedule] Created scheduled post: ${id} for ${new Date(scheduledFor).toISOString()}`);
    return { success: true, id };
  } catch (error: any) {
    safeLog.error('[X/Schedule] Create error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXScheduleList(_: Electron.IpcMainInvokeEvent, filters?: {
  status?: string;
  dateFrom?: number;
  dateTo?: number;
  limit?: number;
}): Promise<any> {
  try {
    let query = `
      SELECT
        s.*,
        d.content as draft_content,
        d.version as draft_version,
        d.metadata as draft_metadata
      FROM x_scheduled_posts s
      LEFT JOIN x_drafts d ON s.draft_id = d.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filters?.status) {
      query += ' AND s.status = ?';
      params.push(filters.status);
    }

    if (filters?.dateFrom) {
      query += ' AND s.scheduled_for >= ?';
      params.push(filters.dateFrom);
    }

    if (filters?.dateTo) {
      query += ' AND s.scheduled_for <= ?';
      params.push(filters.dateTo);
    }

    query += ' ORDER BY s.scheduled_for ASC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const stmt = prepare(query);
    const results = stmt.all(...params);

    return { success: true, scheduled: results };
  } catch (error: any) {
    safeLog.error('[X/Schedule] List error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXScheduleUpdate(_: Electron.IpcMainInvokeEvent, data: {
  id: string;
  scheduledFor?: number;
  status?: string;
}): Promise<any> {
  try {
    const { id, scheduledFor, status } = data;
    const now = Date.now();

    let query = 'UPDATE x_scheduled_posts SET updated_at = ?';
    const params: any[] = [now];

    if (scheduledFor !== undefined) {
      query += ', scheduled_for = ?';
      params.push(scheduledFor);
    }

    if (status) {
      query += ', status = ?';
      params.push(status);
    }

    query += ' WHERE id = ?';
    params.push(id);

    const stmt = prepare(query);
    const result = stmt.run(...params);

    if (result.changes === 0) {
      throw new Error('Scheduled post not found');
    }

    safeLog.log(`[X/Schedule] Updated scheduled post: ${id}`);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[X/Schedule] Update error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXScheduleDelete(_: Electron.IpcMainInvokeEvent, data: { id: string }): Promise<any> {
  try {
    const { id } = data;

    const stmt = prepare('DELETE FROM x_scheduled_posts WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      throw new Error('Scheduled post not found');
    }

    safeLog.log(`[X/Schedule] Deleted scheduled post: ${id}`);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[X/Schedule] Delete error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============== SIMPLE SCHEDULED POSTS HANDLERS ==============

async function handleXScheduleSimple(_: Electron.IpcMainInvokeEvent, text: string, scheduledTime: number): Promise<any> {
  try {
    const id = `sched-${Date.now()}`;
    const now = Date.now();

    const stmt = prepare(`
      INSERT INTO scheduled_posts (id, content, scheduled_time, status, created_at)
      VALUES (?, ?, ?, 'pending', ?)
    `);
    stmt.run(id, text, scheduledTime, now);

    safeLog.log(`[X/Schedule] Scheduled post: ${id} for ${new Date(scheduledTime).toISOString()}`);
    return { success: true, id };
  } catch (error: any) {
    safeLog.error('[X/Schedule] Schedule error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXScheduled(): Promise<any> {
  try {
    const stmt = prepare(`
      SELECT * FROM scheduled_posts
      ORDER BY scheduled_time ASC
    `);
    const results = stmt.all();
    return { success: true, scheduled: results };
  } catch (error: any) {
    safeLog.error('[X/Scheduled] List error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXCancel(_: Electron.IpcMainInvokeEvent, id: string): Promise<any> {
  try {
    const stmt = prepare('DELETE FROM scheduled_posts WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      throw new Error('Scheduled post not found');
    }

    safeLog.log(`[X/Cancel] Cancelled scheduled post: ${id}`);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[X/Cancel] Error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============== X/TWITTER CAMPAIGN HANDLERS ==============
// Using SECOND occurrence implementation: INSERT OR REPLACE + row-count checking

async function handleXCampaignList(): Promise<any> {
  try {
    const rows = prepare('SELECT * FROM x_campaigns ORDER BY updated_at DESC').all();
    const campaigns = (rows as any[]).map(r => ({
      ...r,
      stages: JSON.parse(r.stages || '[]'),
    }));
    return { success: true, campaigns };
  } catch (error: any) {
    safeLog.error('[X:Campaign:List] Error:', error.message);
    return { success: false, campaigns: [], error: error.message };
  }
}

async function handleXCampaignSave(_: Electron.IpcMainInvokeEvent, campaign: any): Promise<any> {
  try {
    const now = Date.now();
    const id = campaign.id || `campaign-${now}`;
    const stages = JSON.stringify(campaign.stages || []);
    prepare(`INSERT OR REPLACE INTO x_campaigns (id, title, subject, stages, status, start_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM x_campaigns WHERE id = ?), ?), ?)`)
      .run(id, campaign.title || '', campaign.subject || '', stages, campaign.status || 'draft', campaign.start_date || null, id, now, now);
    safeLog.log(`[X:Campaign:Save] Saved campaign: ${id}`);
    return { success: true, id };
  } catch (error: any) {
    safeLog.error('[X:Campaign:Save] Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXCampaignDelete(_: Electron.IpcMainInvokeEvent, id: string): Promise<any> {
  try {
    const info = prepare('DELETE FROM x_campaigns WHERE id = ?').run(id);
    if (info.changes === 0) {
      return { success: false, error: 'Campaign not found' };
    }
    safeLog.log(`[X:Campaign:Delete] Deleted campaign: ${id}`);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[X:Campaign:Delete] Error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============== X/TWITTER MENTIONS HANDLERS ==============

async function handleXMentionFetch(): Promise<any> {
  try {
    // Fetch mentions from X API
    const result = execSync('x-api mentions --count 50', {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });

    const mentions = JSON.parse(result);
    const now = Date.now();
    let newCount = 0;
    let updatedCount = 0;

    // Store in database
    for (const mention of mentions.data || []) {
      // Check if mention already exists
      const existing = prepare('SELECT id FROM x_mentions WHERE tweet_id = ?').get(mention.id);

      if (!existing) {
        // Insert new mention
        const id = `mention-${now}-${mention.id}`;
        const stmt = prepare(`
          INSERT INTO x_mentions (
            id, tweet_id, author_id, author_username, author_name,
            text, created_at, conversation_id, in_reply_to_user_id,
            reply_status, fetched_at, metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, json(?))
        `);

        const tweetCreatedAt = new Date(mention.created_at).getTime();
        const metadata = {
          public_metrics: mention.public_metrics,
          referenced_tweets: mention.referenced_tweets,
        };

        stmt.run(
          id,
          mention.id,
          mention.author_id,
          mention.author?.username || 'unknown',
          mention.author?.name || 'unknown',
          mention.text,
          tweetCreatedAt,
          mention.conversation_id,
          mention.in_reply_to_user_id,
          now,
          JSON.stringify(metadata)
        );
        newCount++;
      } else {
        // Update metadata (public metrics may have changed)
        const updateStmt = prepare(`
          UPDATE x_mentions
          SET metadata = json_set(
            COALESCE(metadata, '{}'),
            '$.public_metrics',
            json(?)
          ),
          fetched_at = ?
          WHERE tweet_id = ?
        `);

        updateStmt.run(
          JSON.stringify(mention.public_metrics || {}),
          now,
          mention.id
        );
        updatedCount++;
      }
    }

    safeLog.log(`[X/Mentions] Fetched mentions: ${newCount} new, ${updatedCount} updated`);
    return { success: true, new: newCount, updated: updatedCount };
  } catch (error: any) {
    safeLog.error('[X/Mentions] Fetch error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXMentionList(_: Electron.IpcMainInvokeEvent, filters?: {
  replyStatus?: string;
  limit?: number;
  offset?: number;
}): Promise<any> {
  try {
    let query = `
      SELECT * FROM x_mentions
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filters?.replyStatus) {
      query += ' AND reply_status = ?';
      params.push(filters.replyStatus);
    }

    query += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters?.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const stmt = prepare(query);
    const results = stmt.all(...params);

    return { success: true, mentions: results };
  } catch (error: any) {
    safeLog.error('[X/Mentions] List error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXMentionUpdate(_: Electron.IpcMainInvokeEvent, data: {
  id: string;
  replyStatus?: string;
  repliedAt?: number;
  repliedWithId?: string;
  notes?: string;
}): Promise<any> {
  try {
    const { id, replyStatus, repliedAt, repliedWithId, notes } = data;
    const now = Date.now();

    let query = 'UPDATE x_mentions SET updated_at = ?';
    const params: any[] = [now];

    if (replyStatus) {
      query += ', reply_status = ?';
      params.push(replyStatus);
    }

    if (repliedAt !== undefined) {
      query += ', replied_at = ?';
      params.push(repliedAt);
    }

    if (repliedWithId) {
      query += ', replied_with_id = ?';
      params.push(repliedWithId);
    }

    if (notes !== undefined) {
      query += ", metadata = json_set(COALESCE(metadata, '{}'), '$.notes', ?)";
      params.push(notes);
    }

    query += ' WHERE id = ?';
    params.push(id);

    const stmt = prepare(query);
    const result = stmt.run(...params);

    if (result.changes === 0) {
      throw new Error('Mention not found');
    }

    safeLog.log(`[X/Mentions] Updated mention: ${id}`);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[X/Mentions] Update error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXMentionReply(_: Electron.IpcMainInvokeEvent, data: {
  mentionId: string;
  replyText: string;
  tweetId: string;
}): Promise<any> {
  try {
    const { mentionId, replyText, tweetId } = data;
    const now = Date.now();

    // Send reply via x-api
    const result = execSync(`x-api reply ${tweetId} "${replyText.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
    });

    const response = JSON.parse(result);

    if (response.data?.id) {
      // Update mention with reply info
      const stmt = prepare(`
        UPDATE x_mentions
        SET reply_status = 'replied',
            replied_at = ?,
            replied_with_id = ?
        WHERE id = ?
      `);

      stmt.run(now, response.data.id, mentionId);

      safeLog.log(`[X/Mentions] Replied to mention: ${mentionId}`);
      return { success: true, tweetId: response.data.id };
    } else {
      throw new Error('Failed to post reply');
    }
  } catch (error: any) {
    safeLog.error('[X/Mentions] Reply error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============== X/TWITTER REPLY GUY HANDLERS ==============

async function handleXReplyGuyListHotMentions(_: Electron.IpcMainInvokeEvent, filters?: {
  minLikes?: number;
  minRetweets?: number;
  limit?: number;
}): Promise<any> {
  try {
    // Get mentions with engagement metrics
    let query = `
      SELECT
        m.*,
        json_extract(m.metadata, '$.public_metrics.like_count') as like_count,
        json_extract(m.metadata, '$.public_metrics.retweet_count') as retweet_count,
        json_extract(m.metadata, '$.public_metrics.reply_count') as reply_count
      FROM x_mentions m
      WHERE m.reply_status = 'pending'
    `;

    const params: any[] = [];

    if (filters?.minLikes) {
      query += ' AND like_count >= ?';
      params.push(filters.minLikes);
    }

    if (filters?.minRetweets) {
      query += ' AND retweet_count >= ?';
      params.push(filters.minRetweets);
    }

    query += ' ORDER BY (like_count + retweet_count * 2) DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    } else {
      query += ' LIMIT 50';
    }

    const stmt = prepare(query);
    const results = stmt.all(...params);

    return { success: true, mentions: results };
  } catch (error: any) {
    safeLog.error('[X/ReplyGuy] List hot mentions error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXReplyGuyCreateQuickDraft(_: Electron.IpcMainInvokeEvent, data: {
  mentionId: string;
  replyText: string;
  fastTrack?: boolean;
}): Promise<any> {
  try {
    const { mentionId, replyText, fastTrack } = data;
    const now = Date.now();
    const id = `draft-${now}`;

    // Get mention details
    const mention = prepare('SELECT * FROM x_mentions WHERE id = ?').get(mentionId) as any;
    if (!mention) {
      throw new Error('Mention not found');
    }

    // Create draft with fast-track flag
    const draftStmt = prepare(`
      INSERT INTO x_drafts (
        id, plan_id, version, content, status, proposed_by, created_at, updated_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, json(?))
    `);

    const content = JSON.stringify({
      tweets: [{ text: replyText }],
      replyTo: mention.tweet_id,
      inReplyToUser: mention.author_username,
    });

    const metadata = {
      fastTrack: fastTrack || false,
      mentionId,
      createdVia: 'reply-guy',
    };

    // If fast-track, auto-approve
    const status = fastTrack ? 'approved' : 'draft';

    draftStmt.run(
      id,
      null, // No plan_id for reply guy drafts
      'A',
      content,
      status,
      'reply-guy',
      now,
      now,
      JSON.stringify(metadata)
    );

    // Create draft file
    const draftPath = path.join(os.homedir(), 'froggo', 'x-content', 'drafts', `${id}.md`);
    const draftContent = `---
id: ${id}
mention_id: ${mentionId}
reply_to: ${mention.tweet_id}
in_reply_to_user: @${mention.author_username}
status: ${status}
fast_track: ${fastTrack}
created_at: ${new Date(now).toISOString()}
---

# Reply Guy Draft

## Original Tweet
@${mention.author_username}: ${mention.text}

## Reply
${replyText}
`;

    fs.writeFileSync(draftPath, draftContent, 'utf-8');

    // Git commit
    execSync(`cd ~/froggo/x-content && git add drafts/${id}.md && git commit -m "draft: Reply Guy quick draft ${id}"`, {
      encoding: 'utf-8'
    });

    safeLog.log(`[X/ReplyGuy] Created quick draft: ${id} (fast-track: ${fastTrack})`);
    return { success: true, id, draftPath };
  } catch (error: any) {
    safeLog.error('[X/ReplyGuy] Create quick draft error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXReplyGuyPostNow(_: Electron.IpcMainInvokeEvent, data: {
  draftId: string;
}): Promise<any> {
  try {
    const { draftId } = data;
    const now = Date.now();

    // Get draft
    const draft = prepare('SELECT * FROM x_drafts WHERE id = ? AND status = ?').get(draftId, 'approved') as any;
    if (!draft) {
      throw new Error('Draft not found or not approved');
    }

    // Parse content
    const content = JSON.parse(draft.content);
    const replyText = content.tweets[0].text;
    const replyTo = content.replyTo;

    if (!replyTo) {
      throw new Error('No reply_to tweet_id found');
    }

    // Post via x-api
    const result = execSync(`x-api reply ${replyTo} "${replyText.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
    });

    const response = JSON.parse(result);

    if (response.data?.id) {
      // Update draft as posted
      const updateStmt = prepare(`
        UPDATE x_drafts
        SET status = 'posted',
            metadata = json_set(COALESCE(metadata, '{}'), '$.postedAt', ?, '$.postedId', ?)
        WHERE id = ?
      `);

      updateStmt.run(now, response.data.id, draftId);

      // Update mention as replied
      const draftMetadata = draft.metadata ? JSON.parse(draft.metadata) : {};
      if (draftMetadata.mentionId) {
        const mentionStmt = prepare(`
          UPDATE x_mentions
          SET reply_status = 'replied',
              replied_at = ?,
              replied_with_id = ?
          WHERE id = ?
        `);

        mentionStmt.run(now, response.data.id, draftMetadata.mentionId);
      }

      safeLog.log(`[X/ReplyGuy] Posted draft ${draftId}: ${response.data.id}`);
      return { success: true, tweetId: response.data.id };
    } else {
      throw new Error('Failed to post tweet');
    }
  } catch (error: any) {
    safeLog.error('[X/ReplyGuy] Post now error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============== REDDIT MONITOR HANDLERS ==============

async function handleXRedditCreateMonitor(_: Electron.IpcMainInvokeEvent, data: {
  productUrl: string;
  keywords: string;
  subreddits: string;
}): Promise<any> {
  try {
    const { productUrl, keywords, subreddits } = data;
    const now = Date.now();
    const id = `reddit-monitor-${now}`;

    const stmt = prepare(`
      INSERT INTO x_reddit_monitors (id, product_url, keywords, subreddits, status, created_at)
      VALUES (?, ?, ?, ?, 'active', ?)
    `);

    stmt.run(id, productUrl, keywords, subreddits, now);

    safeLog.log(`[Reddit] Created monitor: ${id} for ${productUrl}`);
    return { success: true, monitorId: id };
  } catch (error: any) {
    safeLog.error('[Reddit] Create monitor error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXRedditListMonitors(): Promise<any> {
  try {
    const monitors = prepare(`
      SELECT * FROM x_reddit_monitors WHERE status = 'active' ORDER BY created_at DESC
    `).all();

    return { success: true, monitors };
  } catch (error: any) {
    safeLog.error('[Reddit] List monitors error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXRedditFetch(): Promise<any> {
  try {
    // Get active monitors
    const monitors = prepare(`
      SELECT * FROM x_reddit_monitors WHERE status = 'active'
    `).all() as any[];

    if (monitors.length === 0) {
      return { success: false, error: 'No active monitors' };
    }

    let newCount = 0;
    const now = Date.now();

    for (const monitor of monitors) {
      const keywords = monitor.keywords.split(',').map((k: string) => k.trim());
      const subreddits = monitor.subreddits === 'all'
        ? []
        : monitor.subreddits.split(',').map((s: string) => s.trim());

      // Use web_fetch to search Reddit (basic implementation)
      // In production, you'd use praw or a more robust Reddit API
      for (const keyword of keywords) {
        try {
          // Search each subreddit or use Reddit's search
          const searchSubreddits = subreddits.length > 0 ? subreddits : ['all'];

          for (const sub of searchSubreddits) {
            const searchUrl = sub === 'all'
              ? `https://www.reddit.com/search/?q=${encodeURIComponent(keyword)}&sort=new`
              : `https://www.reddit.com/r/${sub}/search/?q=${encodeURIComponent(keyword)}&sort=new`;

            // Skip actual fetch for now - would need proper Reddit API or scraping
            safeLog.log(`[Reddit] Would search: ${searchUrl} for "${keyword}"`);
          }
        } catch (e) {
          safeLog.error('[Reddit] Search error:', e);
        }
      }
    }

    safeLog.log(`[Reddit] Fetch complete: ${newCount} new threads`);
    return { success: true, count: newCount };
  } catch (error: any) {
    safeLog.error('[Reddit] Fetch error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXRedditListThreads(_: Electron.IpcMainInvokeEvent, filters?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<any> {
  try {
    let query = `SELECT * FROM x_reddit_threads WHERE 1=1`;
    const params: any[] = [];

    if (filters?.status) {
      query += ' AND reply_status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters?.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const threads = prepare(query).all(...params);

    return { success: true, threads };
  } catch (error: any) {
    safeLog.error('[Reddit] List threads error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXRedditGenerateDraft(_: Electron.IpcMainInvokeEvent, data: {
  threadId: string;
  threadTitle: string;
  threadText: string;
  subreddit: string;
}): Promise<any> {
  try {
    const { threadId, threadTitle, threadText, subreddit } = data;

    const prompt = `Generate an authentic Reddit reply for the following thread on r/${subreddit}:\n\nTitle: ${threadTitle}\n\nContent: ${threadText || '(No text content)'}\n\nWrite a helpful, natural reply that adds value to the conversation. Use conversational Reddit tone — no marketing speak, no emojis. Keep it concise (2-4 sentences). Just output the reply text, nothing else.`;

    const escaped = prompt.replace(/'/g, "'\\''");
    const { exec: execCb } = require('child_process');
    const { promisify: prom } = require('util');
    const execAsyncLocal = prom(execCb);

    const { stdout } = await execAsyncLocal(
      `openclaw agent --agent social-manager --message '${escaped}' --json`,
      { encoding: 'utf-8', timeout: 120000 }
    );

    let draft = '';
    try {
      const parsed = JSON.parse(stdout.trim());
      const payloads = parsed?.result?.payloads;
      if (Array.isArray(payloads) && payloads.length > 0) {
        draft = payloads.map((p: any) => p.text || '').join('\n').trim();
      }
    } catch {
      // If JSON parse fails, use raw stdout as the draft
      draft = stdout.trim();
    }

    if (!draft) {
      draft = 'Could not generate a draft. Please try again.';
    }

    return { success: true, draft };
  } catch (error: any) {
    safeLog.error('[Reddit] Generate draft error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXRedditSaveDraft(_: Electron.IpcMainInvokeEvent, data: {
  threadId: string;
  replyText: string;
}): Promise<any> {
  try {
    const { threadId, replyText } = data;

    const stmt = prepare(`
      UPDATE x_reddit_threads
      SET reply_status = 'drafted', drafted_reply = ?
      WHERE id = ?
    `);

    stmt.run(replyText, threadId);

    safeLog.log(`[Reddit] Saved draft for thread: ${threadId}`);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Reddit] Save draft error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXRedditPostReply(_: Electron.IpcMainInvokeEvent, data: {
  threadId: string;
  replyText: string;
}): Promise<any> {
  try {
    const { threadId, replyText } = data;

    // Get thread info
    const thread = prepare('SELECT * FROM x_reddit_threads WHERE id = ?').get(threadId) as any;
    if (!thread) {
      throw new Error('Thread not found');
    }

    // In production, this would use praw to post the reply
    // For now, just mark as posted
    const now = Date.now();

    const stmt = prepare(`
      UPDATE x_reddit_threads
      SET reply_status = 'posted', posted_at = ?
      WHERE id = ?
    `);

    stmt.run(now, threadId);

    safeLog.log(`[Reddit] Posted reply to thread: ${threadId}`);
    return { success: true, commentId: `reddit-${now}` };
  } catch (error: any) {
    safeLog.error('[Reddit] Post reply error:', error.message);
    return { success: false, error: error.message };
  }
}

async function handleXRedditUpdateThread(_: Electron.IpcMainInvokeEvent, data: {
  threadId: string;
  status: string;
}): Promise<any> {
  try {
    const { threadId, status } = data;

    const stmt = prepare(`
      UPDATE x_reddit_threads
      SET reply_status = ?
      WHERE id = ?
    `);

    stmt.run(status, threadId);

    safeLog.log(`[Reddit] Updated thread ${threadId} status to ${status}`);
    return { success: true };
  } catch (error: any) {
    safeLog.error('[Reddit] Update thread error:', error.message);
    return { success: false, error: error.message };
  }
}
