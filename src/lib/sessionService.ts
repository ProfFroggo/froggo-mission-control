// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// src/lib/sessionService.ts
// Unified session service — single source of truth for agent chat sessions
// across all surfaces (chat, task, social, room, library).

import { spawnSync } from 'child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { getDb } from './database';
import { ENV } from './env';
import { randomUUID } from 'crypto';
import { TIER_TOOLS, loadDisallowedTools } from './taskDispatcher';

// ── Types ───────────────────────────────────────────────────────────────────

export interface SessionConfig {
  sessionKey: string;          // e.g. "social:social-manager:pipeline"
  agentId: string;             // e.g. "social-manager"
  surface: 'chat' | 'task' | 'social' | 'room' | 'library';
  contextId?: string;          // tab name, task ID, room ID
  metadata?: Record<string, any>; // surface-specific data
}

export interface SessionContext {
  systemPrompt: string;        // SOUL.md + identity + constraints
  conversationHistory: string; // recent messages (compacted if needed)
  memoryContext: string;       // agent memory files (placeholder for now)
  knowledgeContext: string;    // relevant KB articles (placeholder for now)
  surfaceContext: string;      // surface-specific data (tab data, task context)
  totalTokenEstimate: number;
}

interface SessionRecord {
  key: string;
  agentId: string;
  createdAt: number;
  lastActivity: number;
  messageCount: number;
  lastMemoryExtractAt?: number | null;
  compact_summary?: string | null;
  last_compact_at?: number | null;
}

// ── Token estimation ────────────────────────────────────────────────────────

const BUDGET_HISTORY = 8000;
const BUDGET_SOUL = 3000;
const BUDGET_MEMORY = 2000;
const BUDGET_SHARED_MEMORY = 500;
const BUDGET_KNOWLEDGE = 1500;
const BUDGET_SURFACE = 2000;
const COMPACTION_THRESHOLD = 25;     // compact when > 25 messages
const COMPACTION_RECENT_KEEP = 8;    // keep last 8 messages verbatim
const COMPACTION_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes between compactions
const STALE_SESSION_AGE_DAYS = 30;
const STALE_SESSION_INACTIVE_DAYS = 7;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function truncateToTokenBudget(text: string, budget: number): string {
  const charBudget = budget * 4;
  if (text.length <= charBudget) return text;
  return text.slice(0, charBudget) + '\n...[truncated]';
}

// ── Session management ──────────────────────────────────────────────────────

export function createOrGetSession(config: SessionConfig): SessionRecord {
  const db = getDb();
  const now = Date.now();

  const existing = db.prepare(
    'SELECT key, agentId, createdAt, lastActivity, messageCount, lastMemoryExtractAt, compact_summary, last_compact_at FROM sessions WHERE key = ?'
  ).get(config.sessionKey) as SessionRecord | undefined;

  if (existing) {
    db.prepare('UPDATE sessions SET lastActivity = ? WHERE key = ?').run(now, config.sessionKey);
    return { ...existing, lastActivity: now };
  }

  // Insert new session
  db.prepare(
    'INSERT INTO sessions (key, agentId, createdAt, lastActivity, messageCount) VALUES (?, ?, ?, ?, 0)'
  ).run(config.sessionKey, config.agentId, now, now);

  return {
    key: config.sessionKey,
    agentId: config.agentId,
    createdAt: now,
    lastActivity: now,
    messageCount: 0,
  };
}

// ── Agent identity ──────────────────────────────────────────────────────────

export function loadAgentIdentity(agentId: string): string {
  const projectDir = process.cwd();

  // Try catalog/agents/{id}/soul.md first
  const catalogPath = join(projectDir, 'catalog', 'agents', agentId, 'soul.md');
  if (existsSync(catalogPath)) {
    const content = readFileSync(catalogPath, 'utf-8').trim();
    return truncateToTokenBudget(content, BUDGET_SOUL);
  }

  // Then try .claude/agents/{id}.md
  const claudePath = join(projectDir, '.claude', 'agents', `${agentId}.md`);
  if (existsSync(claudePath)) {
    const content = readFileSync(claudePath, 'utf-8').trim();
    return truncateToTokenBudget(content, BUDGET_SOUL);
  }

  // Fallback: DB agents table description field
  try {
    const db = getDb();
    const row = db.prepare('SELECT name, role, description FROM agents WHERE id = ?').get(agentId) as {
      name?: string; role?: string; description?: string;
    } | undefined;
    if (row) {
      const parts: string[] = [];
      if (row.name) parts.push(`You are ${row.name}.`);
      if (row.role) parts.push(`Role: ${row.role}`);
      if (row.description) parts.push(row.description);
      return parts.join('\n');
    }
  } catch { /* DB not available */ }

  return `You are ${agentId}.`;
}

// ── Agent memory ───────────────────────────────────────────────────────────

interface MemoryFile {
  name: string;
  content: string;
  mtimeMs: number;
}

function formatTimeAgo(ms: number): string {
  const diffMs = Date.now() - ms;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function loadMemoryDir(dirPath: string, budget: number): string {
  try {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
      return '';
    }

    const entries = readdirSync(dirPath).filter(f => f.endsWith('.md'));
    if (entries.length === 0) return '';

    // Read files with mtime, sort newest first
    const files: MemoryFile[] = entries.map(name => {
      const filePath = join(dirPath, name);
      const stat = statSync(filePath);
      return {
        name,
        content: readFileSync(filePath, 'utf-8').trim(),
        mtimeMs: stat.mtimeMs,
      };
    }).sort((a, b) => b.mtimeMs - a.mtimeMs);

    // Build formatted output, respecting token budget (oldest dropped first)
    const charBudget = budget * 4;
    const parts: string[] = [];
    let totalChars = 0;

    for (const file of files) {
      const header = `## ${file.name} (modified ${formatTimeAgo(file.mtimeMs)})`;
      const entry = `${header}\n${file.content}`;
      if (totalChars + entry.length > charBudget) {
        // Try truncating this file's content to fit remaining budget
        const remaining = charBudget - totalChars - header.length - 1;
        if (remaining > 100) {
          parts.push(`${header}\n${file.content.slice(0, remaining)}\n...[truncated]`);
        }
        break;
      }
      parts.push(entry);
      totalChars += entry.length;
    }

    return parts.join('\n\n');
  } catch (err) {
    console.error('[sessionService] loadMemoryDir error:', err);
    return '';
  }
}

export function loadAgentMemory(agentId: string): string {
  const memoryRoot = join(homedir(), 'mission-control', 'memory');
  const agentDir = join(memoryRoot, 'agents', agentId);
  const sharedDir = join(memoryRoot, 'shared');

  const agentMemory = loadMemoryDir(agentDir, BUDGET_MEMORY);
  const sharedMemory = loadMemoryDir(sharedDir, BUDGET_SHARED_MEMORY);

  const sections: string[] = [];

  if (agentMemory) {
    sections.push(
      '--- YOUR MEMORY FILES ---\n' +
      'These are your accumulated learnings. Reference them when relevant.\n\n' +
      agentMemory
    );
  }

  if (sharedMemory) {
    sections.push('## SHARED MEMORY\n' + sharedMemory);
  }

  return sections.join('\n\n');
}

// ── Knowledge base ─────────────────────────────────────────────────────────

const SOCIAL_MANAGER_PRIORITY_TAGS = ['brand', 'voice', 'strategy', 'x-twitter'];

export function loadKnowledgeBase(
  agentId: string,
  surface: string,
  metadata?: Record<string, any>
): string {
  try {
    const db = getDb();

    // Fetch articles visible to agents (scope = 'agents' or 'all')
    const rows = db.prepare(
      `SELECT id, title, content, tags, scope, updatedAt
       FROM knowledge_base
       WHERE scope IN ('agents', 'all')
       ORDER BY pinned DESC, updatedAt DESC
       LIMIT 50`
    ).all() as Array<{
      id: string;
      title: string;
      content: string;
      tags: string;
      scope: string;
      updatedAt: number;
    }>;

    if (rows.length === 0) return '';

    // Parse tags and score relevance
    const scored = rows.map(row => {
      let parsedTags: string[] = [];
      try { parsedTags = JSON.parse(row.tags || '[]'); } catch { /* */ }

      let score = 0;

      // Social-manager priority tags
      if (agentId === 'social-manager') {
        for (const tag of parsedTags) {
          if (SOCIAL_MANAGER_PRIORITY_TAGS.includes(tag.toLowerCase())) {
            score += 10;
          }
        }
      }

      // Project tag matching from task metadata
      if (metadata?.project) {
        for (const tag of parsedTags) {
          if (tag.toLowerCase() === metadata.project.toLowerCase()) {
            score += 5;
          }
        }
      }

      return { ...row, parsedTags, score };
    });

    // For social-manager: ensure Voice and Style Guide is always included
    let voiceGuide: typeof scored[number] | undefined;
    if (agentId === 'social-manager') {
      voiceGuide = scored.find(r =>
        r.title.toLowerCase().includes('voice') &&
        r.title.toLowerCase().includes('style')
      );
      if (voiceGuide) {
        voiceGuide.score = 1000; // Ensure it sorts to top
      }
    }

    // Sort by score desc, then recency
    scored.sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);

    // Take top 5, respecting token budget
    const charBudget = BUDGET_KNOWLEDGE * 4;
    const articles: string[] = [];
    let totalChars = 0;
    let count = 0;

    for (const row of scored) {
      if (count >= 5) break;

      // Use content summary: first 300 chars
      const summary = row.content.length > 300
        ? row.content.slice(0, 300) + '...'
        : row.content;

      const entry = `### ${row.title}\n${summary}`;
      if (totalChars + entry.length > charBudget) {
        const remaining = charBudget - totalChars;
        if (remaining > 100) {
          articles.push(entry.slice(0, remaining) + '\n...[truncated]');
          count++;
        }
        break;
      }

      articles.push(entry);
      totalChars += entry.length;
      count++;
    }

    if (articles.length === 0) return '';

    return (
      '--- KNOWLEDGE BASE ---\n' +
      'Reference these when answering questions or making decisions.\n\n' +
      articles.join('\n\n')
    );
  } catch (err) {
    console.error('[sessionService] loadKnowledgeBase error:', err);
    return '';
  }
}

// ── Conversation history ────────────────────────────────────────────────────

export function loadConversationHistory(
  sessionKey: string,
  maxMessages = 20
): { history: string; tokenEstimate: number } {
  try {
    const db = getDb();

    // Check for compact summary — if present, use summary + recent messages
    const session = db.prepare(
      'SELECT compact_summary FROM sessions WHERE key = ?'
    ).get(sessionKey) as { compact_summary?: string | null } | undefined;

    if (session?.compact_summary) {
      // Load only the last COMPACTION_RECENT_KEEP messages
      const recentRows = db.prepare(
        `SELECT role, content FROM messages WHERE sessionKey = ? ORDER BY timestamp DESC LIMIT ?`
      ).all(sessionKey, COMPACTION_RECENT_KEEP) as Array<{ role: string; content: string }>;

      const recentFormatted = recentRows.reverse().map(r => {
        const speaker = r.role === 'user' ? 'User' : 'Agent';
        return `${speaker}: ${(r.content || '').slice(0, 600)}`;
      }).join('\n');

      const combined =
        `[Conversation summary from earlier]\n${session.compact_summary}\n\n[Recent messages]\n${recentFormatted}`;

      const truncated = truncateToTokenBudget(combined, BUDGET_HISTORY);
      return {
        history: truncated,
        tokenEstimate: estimateTokens(truncated),
      };
    }

    // No compaction — load last N messages as before
    const rows = db.prepare(
      `SELECT role, content FROM messages WHERE sessionKey = ? ORDER BY timestamp DESC LIMIT ?`
    ).all(sessionKey, maxMessages) as Array<{ role: string; content: string }>;

    if (rows.length === 0) {
      return { history: '', tokenEstimate: 0 };
    }

    // Reverse to chronological order
    const reversed = rows.reverse();
    const formatted = reversed.map(r => {
      const speaker = r.role === 'user' ? 'User' : 'Agent';
      // Limit each message to 600 chars to control context size
      const content = (r.content || '').slice(0, 600);
      return `${speaker}: ${content}`;
    }).join('\n');

    const truncated = truncateToTokenBudget(formatted, BUDGET_HISTORY);
    return {
      history: truncated,
      tokenEstimate: estimateTokens(truncated),
    };
  } catch {
    return { history: '', tokenEstimate: 0 };
  }
}

// ── Message persistence ─────────────────────────────────────────────────────

export function saveMessage(
  sessionKey: string,
  role: 'user' | 'assistant',
  content: string
): void {
  try {
    const db = getDb();
    const id = `msg-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const now = Date.now();

    db.prepare(
      'INSERT INTO messages (id, sessionKey, role, content, timestamp, channel) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, sessionKey, role, content, now, 'session');

    // Update session message count and activity
    db.prepare(
      'UPDATE sessions SET messageCount = messageCount + 1, lastActivity = ? WHERE key = ?'
    ).run(now, sessionKey);
  } catch (err) {
    console.error('[sessionService] saveMessage error:', err);
  }
}

// ── Memory extraction ──────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
const GEMINI_FALLBACK = 'gemini-2.5-flash-preview-05-20';
const MEMORY_EXTRACT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const MEMORY_EXTRACT_EVERY_N = 5; // every 5th message
const LEARNINGS_MAX_CHARS = 5000;

async function getGeminiKey(): Promise<string | null> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet('gemini_api_key');
    if (val) return val;
  } catch { /* ignore */ }
  return process.env.GEMINI_API_KEY ?? null;
}

async function geminiGenerate(prompt: string, apiKey: string): Promise<string | null> {
  for (const model of [GEMINI_MODEL, GEMINI_FALLBACK]) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1000, temperature: 0.3 },
          }),
        }
      );
      if (!res.ok) {
        if (model === GEMINI_MODEL) continue; // try fallback
        return null;
      }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch {
      if (model === GEMINI_MODEL) continue;
      return null;
    }
  }
  return null;
}

/**
 * Extract learnings from the last N messages and save to agent memory.
 * Fire-and-forget — does not throw, logs errors.
 */
export async function extractAndSaveMemory(sessionKey: string, agentId: string): Promise<void> {
  try {
    const db = getDb();

    // Check cooldown: skip if extracted less than 5 minutes ago
    const session = db.prepare(
      'SELECT lastMemoryExtractAt FROM sessions WHERE key = ?'
    ).get(sessionKey) as { lastMemoryExtractAt?: number | null } | undefined;

    if (session?.lastMemoryExtractAt) {
      const elapsed = Date.now() - session.lastMemoryExtractAt;
      if (elapsed < MEMORY_EXTRACT_COOLDOWN_MS) {
        return; // too soon
      }
    }

    // Load last 10 messages
    const rows = db.prepare(
      'SELECT role, content FROM messages WHERE sessionKey = ? ORDER BY timestamp DESC LIMIT 10'
    ).all(sessionKey) as Array<{ role: string; content: string }>;

    if (rows.length < 3) return; // not enough conversation to extract from

    const conversation = rows.reverse().map(r => {
      const speaker = r.role === 'user' ? 'User' : 'Agent';
      return `${speaker}: ${(r.content || '').slice(0, 500)}`;
    }).join('\n');

    const geminiKey = await getGeminiKey();
    if (!geminiKey) {
      console.warn('[sessionService] No Gemini API key — skipping memory extraction');
      return;
    }

    const extractPrompt = `Extract key learnings, decisions, user preferences, and patterns from this conversation.
Return as bullet points. Only include NEW information worth remembering.
Skip greetings, small talk, and already-known facts.
Format: one bullet per learning, concise. Each line starts with "- ".
If there is nothing worth remembering, return "NONE".

Conversation:
${conversation}`;

    const result = await geminiGenerate(extractPrompt, geminiKey);
    if (!result || result.trim() === 'NONE' || result.trim().length < 10) {
      // Nothing worth saving — still update timestamp to avoid re-processing
      db.prepare(
        'UPDATE sessions SET lastMemoryExtractAt = ? WHERE key = ?'
      ).run(Date.now(), sessionKey);
      return;
    }

    // Parse bullet points
    const bullets = result
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('- ') || l.startsWith('* '))
      .map(l => l.startsWith('* ') ? `- ${l.slice(2)}` : l);

    if (bullets.length === 0) {
      db.prepare(
        'UPDATE sessions SET lastMemoryExtractAt = ? WHERE key = ?'
      ).run(Date.now(), sessionKey);
      return;
    }

    // Write to learnings.md
    const memoryRoot = join(homedir(), 'mission-control', 'memory');
    const agentDir = join(memoryRoot, 'agents', agentId);
    mkdirSync(agentDir, { recursive: true });

    const learningsPath = join(agentDir, 'learnings.md');
    const dateHeader = `\n### ${new Date().toISOString().split('T')[0]} — session ${sessionKey.split(':').slice(-1)[0] || sessionKey}\n`;
    const newContent = dateHeader + bullets.join('\n') + '\n';

    appendFileSync(learningsPath, newContent, 'utf-8');

    // Check if file exceeds limit — summarize older entries
    const fullContent = readFileSync(learningsPath, 'utf-8');
    if (fullContent.length > LEARNINGS_MAX_CHARS) {
      await summarizeOlderLearnings(learningsPath, fullContent, geminiKey);
    }

    // Update extraction timestamp
    db.prepare(
      'UPDATE sessions SET lastMemoryExtractAt = ? WHERE key = ?'
    ).run(Date.now(), sessionKey);

    console.log(`[sessionService] Extracted ${bullets.length} learnings for agent ${agentId}`);
  } catch (err) {
    console.error('[sessionService] extractAndSaveMemory error:', err);
  }
}

/**
 * When learnings.md exceeds max chars, keep last 20 entries verbatim
 * and summarize everything before them.
 */
async function summarizeOlderLearnings(
  filePath: string,
  content: string,
  geminiKey: string
): Promise<void> {
  try {
    // Split by date headers (### YYYY-MM-DD)
    const sections = content.split(/(?=\n### \d{4}-\d{2}-\d{2})/).filter(s => s.trim());

    if (sections.length <= 20) return; // not enough to summarize

    const keepVerbatim = sections.slice(-20);
    const toSummarize = sections.slice(0, -20).join('\n');

    if (toSummarize.trim().length < 100) return; // too little to summarize

    const summaryPrompt = `Summarize these agent learnings into a compact bullet list.
Merge duplicates, remove outdated info, keep the most important patterns and facts.
Format: one bullet per learning, starting with "- ". Keep it under 1000 characters.

Learnings to summarize:
${toSummarize.slice(0, 3000)}`;

    const summary = await geminiGenerate(summaryPrompt, geminiKey);
    if (!summary) return; // keep file as-is if summarization fails

    const summarized = `### Summarized learnings (auto-condensed)\n${summary.trim()}\n`;
    const newContent = summarized + '\n' + keepVerbatim.join('\n');

    writeFileSync(filePath, newContent, 'utf-8');
    console.log(`[sessionService] Summarized older learnings in ${filePath}`);
  } catch (err) {
    console.error('[sessionService] summarizeOlderLearnings error:', err);
  }
}

// ── Context compaction ─────────────────────────────────────────────────────

/**
 * Compact a long conversation by summarizing older messages via Gemini.
 * Keeps the last COMPACTION_RECENT_KEEP messages verbatim, summarizes the rest.
 * Fire-and-forget — does not throw.
 */
export async function compactConversation(sessionKey: string): Promise<string | null> {
  try {
    const db = getDb();

    // Load ALL messages for this session
    const allRows = db.prepare(
      'SELECT role, content FROM messages WHERE sessionKey = ? ORDER BY timestamp ASC'
    ).all(sessionKey) as Array<{ role: string; content: string }>;

    if (allRows.length < 20) return null; // not enough to compact

    // Split: older messages to summarize, recent to keep
    const olderMessages = allRows.slice(0, -COMPACTION_RECENT_KEEP);
    const olderFormatted = olderMessages.map(r => {
      const speaker = r.role === 'user' ? 'User' : 'Agent';
      return `${speaker}: ${(r.content || '').slice(0, 400)}`;
    }).join('\n');

    const geminiKey = await getGeminiKey();
    if (!geminiKey) {
      console.warn('[sessionService] No Gemini API key — skipping compaction');
      return null;
    }

    const compactPrompt = `Summarize this conversation, preserving:
- Key decisions made
- User preferences expressed
- Files or resources mentioned
- Action items agreed upon
- Important context that would be lost
Keep under 500 words. Use bullet points.

Conversation:
${olderFormatted.slice(0, 12000)}`;

    const summary = await geminiGenerate(compactPrompt, geminiKey);
    if (!summary || summary.trim().length < 20) return null;

    // Save to sessions table
    const now = Date.now();
    db.prepare(
      'UPDATE sessions SET compact_summary = ?, last_compact_at = ? WHERE key = ?'
    ).run(summary.trim(), now, sessionKey);

    console.log(`[sessionService] Compacted conversation for ${sessionKey} (${olderMessages.length} older messages summarized)`);
    return summary.trim();
  } catch (err) {
    console.error('[sessionService] compactConversation error:', err);
    return null;
  }
}

// ── Session stats ─────────────────────────────────────────────────────────

export interface SessionStats {
  messageCount: number;
  age: number;            // ms since creation
  compacted: boolean;
  lastActivity: number;   // timestamp
  tokenEstimate: number;
  memoryFileCount: number;
  kbArticleCount: number;
}

export function getSessionStats(sessionKey: string): SessionStats | null {
  try {
    const db = getDb();
    const session = db.prepare(
      'SELECT key, agentId, createdAt, lastActivity, messageCount, compact_summary, last_compact_at FROM sessions WHERE key = ?'
    ).get(sessionKey) as SessionRecord | undefined;

    if (!session) return null;

    // Count memory files
    const memoryRoot = join(homedir(), 'mission-control', 'memory');
    const agentDir = join(memoryRoot, 'agents', session.agentId);
    let memoryFileCount = 0;
    try {
      if (existsSync(agentDir)) {
        memoryFileCount = readdirSync(agentDir).filter(f => f.endsWith('.md')).length;
      }
    } catch { /* ignore */ }

    // Count KB articles visible to agent
    let kbArticleCount = 0;
    try {
      const row = db.prepare(
        `SELECT COUNT(*) as c FROM knowledge_base WHERE scope IN ('agents', 'all')`
      ).get() as { c: number };
      kbArticleCount = row.c;
    } catch { /* ignore */ }

    // Estimate token usage
    const { tokenEstimate: historyTokens } = loadConversationHistory(sessionKey);
    const memoryContext = loadAgentMemory(session.agentId);
    const identity = loadAgentIdentity(session.agentId);
    const tokenEstimate = historyTokens + estimateTokens(memoryContext) + estimateTokens(identity);

    return {
      messageCount: session.messageCount,
      age: Date.now() - session.createdAt,
      compacted: !!session.compact_summary,
      lastActivity: session.lastActivity,
      tokenEstimate,
      memoryFileCount,
      kbArticleCount,
    };
  } catch (err) {
    console.error('[sessionService] getSessionStats error:', err);
    return null;
  }
}

// ── Session cleanup ───────────────────────────────────────────────────────

/**
 * Delete sessions older than 30 days with no messages in last 7 days.
 * Also cleans up orphaned messages.
 */
export function cleanupStaleSessions(): { deleted: number; orphanedMessages: number } {
  try {
    const db = getDb();
    const now = Date.now();
    const ageThreshold = now - STALE_SESSION_AGE_DAYS * 24 * 60 * 60 * 1000;
    const inactiveThreshold = now - STALE_SESSION_INACTIVE_DAYS * 24 * 60 * 60 * 1000;

    // Find stale sessions: older than 30 days AND inactive for 7+ days
    const stale = db.prepare(
      `SELECT key FROM sessions WHERE createdAt < ? AND lastActivity < ?`
    ).all(ageThreshold, inactiveThreshold) as Array<{ key: string }>;

    if (stale.length === 0) {
      // Still clean orphaned messages
      const orphanResult = db.prepare(
        `DELETE FROM messages WHERE sessionKey NOT IN (SELECT key FROM sessions)`
      ).run();
      return { deleted: 0, orphanedMessages: orphanResult.changes };
    }

    // Delete messages for stale sessions
    const deleteMessages = db.prepare('DELETE FROM messages WHERE sessionKey = ?');
    const deleteSessions = db.prepare('DELETE FROM sessions WHERE key = ?');

    const deleteAll = db.transaction((keys: string[]) => {
      for (const key of keys) {
        deleteMessages.run(key);
        deleteSessions.run(key);
      }
    });

    const keys = stale.map(s => s.key);
    deleteAll(keys);

    // Clean up orphaned messages
    const orphanResult = db.prepare(
      `DELETE FROM messages WHERE sessionKey NOT IN (SELECT key FROM sessions)`
    ).run();

    console.log(`[sessionService] Cleaned up ${stale.length} stale sessions, ${orphanResult.changes} orphaned messages`);
    return { deleted: stale.length, orphanedMessages: orphanResult.changes };
  } catch (err) {
    console.error('[sessionService] cleanupStaleSessions error:', err);
    return { deleted: 0, orphanedMessages: 0 };
  }
}

/**
 * Reset a session: clear messages and compact_summary.
 */
export function resetSession(sessionKey: string): boolean {
  try {
    const db = getDb();
    db.prepare('DELETE FROM messages WHERE sessionKey = ?').run(sessionKey);
    db.prepare(
      'UPDATE sessions SET messageCount = 0, compact_summary = NULL, last_compact_at = NULL WHERE key = ?'
    ).run(sessionKey);
    return true;
  } catch (err) {
    console.error('[sessionService] resetSession error:', err);
    return false;
  }
}

/**
 * Delete a session and all its messages.
 */
export function deleteSession(sessionKey: string): boolean {
  try {
    const db = getDb();
    db.prepare('DELETE FROM messages WHERE sessionKey = ?').run(sessionKey);
    db.prepare('DELETE FROM sessions WHERE key = ?').run(sessionKey);
    return true;
  } catch (err) {
    console.error('[sessionService] deleteSession error:', err);
    return false;
  }
}

/**
 * Export all messages for a session as markdown.
 */
export function exportSessionAsMarkdown(sessionKey: string): string | null {
  try {
    const db = getDb();
    const session = db.prepare(
      'SELECT key, agentId, createdAt, lastActivity, messageCount FROM sessions WHERE key = ?'
    ).get(sessionKey) as SessionRecord | undefined;

    if (!session) return null;

    const messages = db.prepare(
      'SELECT role, content, timestamp FROM messages WHERE sessionKey = ? ORDER BY timestamp ASC'
    ).all(sessionKey) as Array<{ role: string; content: string; timestamp: number }>;

    const lines: string[] = [
      `# Session: ${sessionKey}`,
      `Agent: ${session.agentId}`,
      `Created: ${new Date(session.createdAt).toISOString()}`,
      `Messages: ${messages.length}`,
      '',
      '---',
      '',
    ];

    for (const msg of messages) {
      const speaker = msg.role === 'user' ? 'User' : 'Agent';
      const time = new Date(msg.timestamp).toLocaleString();
      lines.push(`**${speaker}** (${time}):`);
      lines.push(msg.content || '');
      lines.push('');
    }

    return lines.join('\n');
  } catch (err) {
    console.error('[sessionService] exportSessionAsMarkdown error:', err);
    return null;
  }
}

/**
 * List all sessions with summary stats.
 */
export function listAllSessions(): Array<{
  key: string;
  agentId: string;
  agentName: string;
  surface: string;
  messageCount: number;
  lastActivity: number;
  createdAt: number;
  compacted: boolean;
}> {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT s.key, s.agentId, s.createdAt, s.lastActivity, s.messageCount,
             s.compact_summary, COALESCE(a.name, s.agentId) as agentName
      FROM sessions s
      LEFT JOIN agents a ON s.agentId = a.id
      ORDER BY s.lastActivity DESC
    `).all() as Array<{
      key: string;
      agentId: string;
      createdAt: number;
      lastActivity: number;
      messageCount: number;
      compact_summary: string | null;
      agentName: string;
    }>;

    return rows.map(row => {
      // Parse surface from session key (e.g. "agent:social-manager:xtwitter:pipeline" -> "social")
      const parts = row.key.split(':');
      let surface = 'chat';
      if (parts[0] === 'agent' && parts[2]) {
        surface = parts[2] === 'xtwitter' ? 'social' : parts[2];
      } else if (parts[0] === 'task') {
        surface = 'task';
      } else if (parts[0] === 'room') {
        surface = 'room';
      } else if (parts[0] === 'cron') {
        surface = 'cron';
      }

      return {
        key: row.key,
        agentId: row.agentId,
        agentName: row.agentName,
        surface,
        messageCount: row.messageCount,
        lastActivity: row.lastActivity,
        createdAt: row.createdAt,
        compacted: !!row.compact_summary,
      };
    });
  } catch (err) {
    console.error('[sessionService] listAllSessions error:', err);
    return [];
  }
}

// ── Memory protocol ────────────────────────────────────────────────────────

interface MemoryMetadata {
  fileCount: number;
  totalChars: number;
  lastUpdated: Date | null;
}

function getMemoryMetadata(agentId: string): MemoryMetadata {
  const memoryRoot = join(homedir(), 'mission-control', 'memory');
  const agentDir = join(memoryRoot, 'agents', agentId);

  try {
    if (!existsSync(agentDir)) {
      return { fileCount: 0, totalChars: 0, lastUpdated: null };
    }

    const entries = readdirSync(agentDir).filter(f => f.endsWith('.md'));
    if (entries.length === 0) {
      return { fileCount: 0, totalChars: 0, lastUpdated: null };
    }

    let totalChars = 0;
    let latestMtime = 0;

    for (const name of entries) {
      const filePath = join(agentDir, name);
      const stat = statSync(filePath);
      totalChars += stat.size;
      if (stat.mtimeMs > latestMtime) latestMtime = stat.mtimeMs;
    }

    return {
      fileCount: entries.length,
      totalChars,
      lastUpdated: latestMtime > 0 ? new Date(latestMtime) : null,
    };
  } catch {
    return { fileCount: 0, totalChars: 0, lastUpdated: null };
  }
}

function buildMemoryProtocol(meta: MemoryMetadata): string {
  const parts: string[] = [];
  parts.push('\n--- MEMORY PROTOCOL ---');
  parts.push('You have persistent memory. Your memory files are loaded above.');
  parts.push('');
  parts.push('When you learn something important during this conversation:');
  parts.push('- User preferences (formatting, tone, priorities)');
  parts.push('- Project decisions (architecture choices, tool selections)');
  parts.push('- Patterns (what works well, what to avoid)');
  parts.push('- Context (team dynamics, deadlines, constraints)');
  parts.push('');
  parts.push('Remember: your memory is automatically extracted every 5 messages.');
  parts.push('Reference your memory files when relevant — don\'t re-ask questions you already know the answer to.');
  parts.push('If your memory contains outdated information, note it in your response.');

  if (meta.fileCount === 0) {
    parts.push('');
    parts.push('You have no memory files yet. Your learnings from this conversation will be saved automatically.');
  } else {
    parts.push('');
    const dateStr = meta.lastUpdated
      ? meta.lastUpdated.toISOString().split('T')[0]
      : 'unknown';
    parts.push(`Your memory files were last updated: ${dateStr}`);
    parts.push(`You have ${meta.fileCount} memory file${meta.fileCount === 1 ? '' : 's'} totaling ${meta.totalChars} characters.`);
  }

  return parts.join('\n');
}

// ── Surface-specific context loaders ──────────────────────────────────────

/**
 * Load rich context for a task surface: task details, subtasks, activity, attachments.
 */
export function loadTaskContext(taskId: string, agentId: string): string {
  try {
    const db = getDb();

    // Load task
    const task = db.prepare(
      `SELECT title, description, status, priority, planningNotes, assignedTo,
              project, project_id, tags, dueDate
       FROM tasks WHERE id = ?`
    ).get(taskId) as {
      title: string; description: string | null; status: string; priority: string;
      planningNotes: string | null; assignedTo: string | null;
      project: string | null; project_id: string | null;
      tags: string | null; dueDate: number | null;
    } | undefined;

    if (!task) return '';

    const parts: string[] = [
      '--- TASK CONTEXT ---',
      'You are working on this task. Use this context to inform your responses.',
      '',
    ];

    parts.push(`**Task**: ${task.title}`);
    parts.push(`**Status**: ${task.status} | **Priority**: ${task.priority} | **Assigned to**: ${task.assignedTo || 'unassigned'}`);

    // Project info
    if (task.project_id) {
      const proj = db.prepare(
        'SELECT name, goal FROM projects WHERE id = ?'
      ).get(task.project_id) as { name: string; goal: string | null } | undefined;
      if (proj) {
        parts.push(`**Project**: ${proj.name}${proj.goal ? ` — ${proj.goal}` : ''}`);
      }
    } else if (task.project) {
      parts.push(`**Project**: ${task.project}`);
    }

    parts.push(`**Due**: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No deadline'}`);

    if (task.description) {
      parts.push('', '**Description**:', task.description.slice(0, 800));
    }

    if (task.planningNotes) {
      parts.push('', '**Planning Notes / Acceptance Criteria**:', task.planningNotes.slice(0, 800));
    }

    // Subtasks
    const subtasks = db.prepare(
      'SELECT title, completed FROM subtasks WHERE taskId = ? ORDER BY position ASC, createdAt ASC'
    ).all(taskId) as Array<{ title: string; completed: number }>;

    if (subtasks.length > 0) {
      parts.push('', '**Subtasks**:');
      for (const st of subtasks) {
        parts.push(`- [${st.completed ? 'x' : ' '}] ${st.title}`);
      }
    }

    // Recent activity (last 10)
    const activity = db.prepare(
      `SELECT agentId, action, message, timestamp FROM task_activity
       WHERE taskId = ? ORDER BY timestamp DESC LIMIT 10`
    ).all(taskId) as Array<{ agentId: string; action: string; message: string; timestamp: number }>;

    if (activity.length > 0) {
      parts.push('', '**Recent Activity**:');
      for (const a of activity.reverse()) {
        const ago = formatTimeAgo(a.timestamp);
        parts.push(`- ${a.agentId} ${a.action}: ${(a.message || '').slice(0, 120)} (${ago})`);
      }
    }

    // Attachments
    const attachments = db.prepare(
      'SELECT fileName, filePath FROM task_attachments WHERE taskId = ?'
    ).all(taskId) as Array<{ fileName: string; filePath: string }>;

    if (attachments.length > 0) {
      parts.push('', `**Attachments**: ${attachments.map(a => a.fileName || a.filePath).join(', ')}`);
    }

    return truncateToTokenBudget(parts.join('\n'), BUDGET_SURFACE);
  } catch (err) {
    console.error('[sessionService] loadTaskContext error:', err);
    return '';
  }
}

/**
 * Load social surface context: live data from X pipeline, mentions, analytics.
 * Moved from generate-reply/route.ts fetchTabData.
 */
export function loadSocialContext(tab: string): string {
  try {
    const db = getDb();
    const sections: string[] = [];

    if (tab === 'pipeline' || tab === 'configure') {
      // Pipeline stats
      const posts = db.prepare(`SELECT status, COUNT(*) as c FROM x_posts GROUP BY status`).all() as Array<{ status: string; c: number }>;
      if (posts.length > 0) {
        sections.push(`PIPELINE STATUS:\n${posts.map(p => `- ${p.status}: ${p.c} posts`).join('\n')}`);
      }

      // Recent posts
      const recent = db.prepare(`SELECT content, status, type FROM x_posts ORDER BY created_at DESC LIMIT 5`).all() as Array<{ content: string; status: string; type: string }>;
      if (recent.length > 0) {
        sections.push(`RECENT POSTS:\n${recent.map(p => `- [${p.status}] ${(p.content || '').slice(0, 80)}`).join('\n')}`);
      }
    }

    if (tab === 'engage') {
      // Mention stats
      const stats = db.prepare(`SELECT reply_status, COUNT(*) as c FROM x_mentions GROUP BY reply_status`).all() as Array<{ reply_status: string; c: number }>;
      if (stats.length > 0) {
        sections.push(`MENTION STATUS:\n${stats.map(s => `- ${s.reply_status}: ${s.c}`).join('\n')}`);
      }

      // Recent unhandled mentions
      const pending = db.prepare(`SELECT author_username, text, mention_type, like_count FROM x_mentions WHERE reply_status = 'pending' ORDER BY tweet_created_at DESC LIMIT 5`).all() as Array<{ author_username: string; text: string; mention_type: string; like_count: number }>;
      if (pending.length > 0) {
        sections.push(`PENDING MENTIONS:\n${pending.map(m => `- @${m.author_username} (${m.mention_type}, ${m.like_count} likes): "${(m.text || '').slice(0, 80)}"`).join('\n')}`);
      }
    }

    if (tab === 'intelligence') {
      // Competitor handles
      const handleRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('x-competitor-handles') as { value: string } | undefined;
      const handles: string[] = handleRow?.value ? JSON.parse(handleRow.value) : [];
      if (handles.length > 0) {
        sections.push(`TRACKED COMPETITORS: ${handles.map(h => `@${h}`).join(', ')}`);
      }

      // Latest competitor report summary
      const report = db.prepare(`SELECT title, summary FROM x_reports WHERE type = 'competitor-analysis' ORDER BY created_at DESC LIMIT 1`).get() as { title: string; summary: string } | undefined;
      if (report) {
        sections.push(`LATEST COMPETITOR REPORT: ${report.title}\n${report.summary}`);
      }
    }

    if (tab === 'measure') {
      // Mention engagement
      const mentionStats = db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN reply_status = 'replied' THEN 1 ELSE 0 END) as replied FROM x_mentions`).get() as { total: number; replied: number } | undefined;
      if (mentionStats) {
        sections.push(`ENGAGEMENT: ${mentionStats.total} total mentions, ${mentionStats.replied} replied`);
      }
    }

    if (tab === 'configure') {
      // Automations
      const autos = db.prepare(`SELECT name, enabled, trigger_type, total_executions FROM x_automations ORDER BY created_at DESC LIMIT 5`).all() as Array<{ name: string; enabled: number; trigger_type: string; total_executions: number }>;
      if (autos.length > 0) {
        sections.push(`ACTIVE AUTOMATIONS:\n${autos.map(a => `- ${a.name} [${a.enabled ? 'ON' : 'OFF'}] trigger:${a.trigger_type} runs:${a.total_executions}`).join('\n')}`);
      }
    }

    // Always include knowledge base context
    try {
      const kb = db.prepare(`SELECT title, substr(summary, 1, 100) as s FROM knowledge_base WHERE scope IN ('agents','all') ORDER BY updated_at DESC LIMIT 3`).all() as Array<{ title: string; s: string }>;
      if (kb.length > 0) {
        sections.push(`BRAND KNOWLEDGE:\n${kb.map(a => `- ${a.title}: ${a.s}`).join('\n')}`);
      }
    } catch { /* non-critical — summary column may not exist */ }

    if (sections.length === 0) return '';
    const result = `--- LIVE DATA (from Mission Control) ---\n${sections.join('\n\n')}`;
    return truncateToTokenBudget(result, BUDGET_SURFACE);
  } catch (err) {
    console.error('[sessionService] loadSocialContext error:', err);
    return '';
  }
}

/**
 * Load room context: room metadata, participating agents, recent messages.
 */
export function loadRoomContext(roomId: string): string {
  try {
    const db = getDb();

    const room = db.prepare(
      'SELECT name, topic, agents, description FROM chat_rooms WHERE id = ?'
    ).get(roomId) as { name: string; topic: string | null; agents: string | null; description: string | null } | undefined;

    if (!room) return '';

    const parts: string[] = [
      '--- ROOM CONTEXT ---',
      `**Room**: ${room.name}`,
    ];

    if (room.topic) parts.push(`**Topic**: ${room.topic}`);
    if (room.description) parts.push(`**Description**: ${room.description}`);

    // Parse agents list
    let agentList: string[] = [];
    try { agentList = JSON.parse(room.agents || '[]'); } catch { /* */ }
    if (agentList.length > 0) {
      parts.push(`**Agents**: ${agentList.join(', ')}`);
    }

    // Last 5 messages for shared context
    const messages = db.prepare(
      `SELECT agentId, content, role, timestamp FROM chat_room_messages
       WHERE roomId = ? ORDER BY timestamp DESC LIMIT 5`
    ).all(roomId) as Array<{ agentId: string; content: string; role: string; timestamp: number }>;

    if (messages.length > 0) {
      parts.push('', '**Recent messages**:');
      for (const m of messages.reverse()) {
        const ago = formatTimeAgo(m.timestamp);
        parts.push(`- ${m.agentId}: ${(m.content || '').slice(0, 150)} (${ago})`);
      }
    }

    return truncateToTokenBudget(parts.join('\n'), BUDGET_SURFACE);
  } catch (err) {
    console.error('[sessionService] loadRoomContext error:', err);
    return '';
  }
}

/**
 * Load main chat context: agent's current task, recent activity, status.
 */
export function loadMainChatContext(agentId: string): string {
  try {
    const db = getDb();

    const agent = db.prepare(
      'SELECT status, currentTaskId FROM agents WHERE id = ?'
    ).get(agentId) as { status: string; currentTaskId: string | null } | undefined;

    if (!agent) return '';

    const parts: string[] = [
      '--- AGENT STATUS ---',
      `**Status**: ${agent.status || 'unknown'}`,
    ];

    // Current task
    if (agent.currentTaskId) {
      const task = db.prepare(
        'SELECT title, status, priority FROM tasks WHERE id = ?'
      ).get(agent.currentTaskId) as { title: string; status: string; priority: string } | undefined;
      if (task) {
        parts.push(`**Current task**: ${task.title} (${task.status}, ${task.priority})`);
      }
    } else {
      parts.push('**Current task**: None');
    }

    // Recent activity (last 5)
    const activity = db.prepare(
      `SELECT action, message, timestamp FROM task_activity
       WHERE agentId = ? ORDER BY timestamp DESC LIMIT 5`
    ).all(agentId) as Array<{ action: string; message: string; timestamp: number }>;

    if (activity.length > 0) {
      parts.push('', '**Recent activity**:');
      for (const a of activity.reverse()) {
        const ago = formatTimeAgo(a.timestamp);
        parts.push(`- ${a.action}: ${(a.message || '').slice(0, 120)} (${ago})`);
      }
    }

    return truncateToTokenBudget(parts.join('\n'), BUDGET_SURFACE);
  } catch (err) {
    console.error('[sessionService] loadMainChatContext error:', err);
    return '';
  }
}

// ── Context assembly ────────────────────────────────────────────────────────

export function buildSessionContext(config: SessionConfig): SessionContext {
  // Ensure session exists
  const session = createOrGetSession(config);

  // 0. Trigger compaction if conversation is long (non-blocking, async)
  if (session.messageCount > COMPACTION_THRESHOLD) {
    const lastCompact = session.last_compact_at || 0;
    const elapsed = Date.now() - lastCompact;
    if (elapsed > COMPACTION_COOLDOWN_MS) {
      // Fire-and-forget — uses stale summary until new one is ready
      compactConversation(config.sessionKey).catch(err =>
        console.error('[sessionService] background compaction error:', err)
      );
    }
  }

  // 1. Load agent identity (SOUL.md)
  const identity = loadAgentIdentity(config.agentId);

  // 2. Load conversation history (uses compact_summary if available)
  const { history, tokenEstimate: historyTokens } = loadConversationHistory(config.sessionKey);

  // 3. Surface context — will be enriched by surface-specific loaders (Phase 21.4)
  let surfaceContext = '';
  if (config.surface === 'task' && config.contextId) {
    surfaceContext = loadTaskContext(config.contextId, config.agentId);
  } else if (config.surface === 'social' && config.metadata?.tab) {
    surfaceContext = loadSocialContext(config.metadata.tab);
  } else if (config.surface === 'room' && config.contextId) {
    surfaceContext = loadRoomContext(config.contextId);
  } else if (config.surface === 'chat') {
    surfaceContext = loadMainChatContext(config.agentId);
  } else if (config.metadata?.tabContext) {
    surfaceContext = config.metadata.tabContext;
  } else if (config.metadata?.tab) {
    surfaceContext = `Current surface: ${config.surface}, context: ${config.metadata.tab}`;
  }

  // 4. Agent memory (from ~/mission-control/memory/agents/{agentId}/ + shared)
  const memoryContext = loadAgentMemory(config.agentId);

  // 5. Knowledge base articles (from knowledge_base table)
  const knowledgeContext = loadKnowledgeBase(config.agentId, config.surface, config.metadata);

  // Build system prompt
  const agentName = config.agentId === 'social-manager'
    ? 'Social Manager for Bitso Onchain (@BitsoOnchain)'
    : config.agentId;

  const systemParts: string[] = [];
  systemParts.push(`You are ${agentName}. Be concise, data-driven, and actionable. Use markdown for formatting.`);
  systemParts.push(`IMPORTANT: You are ${agentName}, NOT mission-control. Stay in character. Never say you are a different agent.`);

  if (identity) {
    systemParts.push(`\n--- AGENT IDENTITY (from SOUL.md) ---\n${identity}`);
  }

  if (surfaceContext) {
    systemParts.push(`\n--- SURFACE CONTEXT ---\n${surfaceContext}`);
  }

  if (memoryContext) {
    systemParts.push(`\n--- MEMORY ---\n${memoryContext}`);
  }

  // 6. Memory protocol + metadata
  const memoryMeta = getMemoryMetadata(config.agentId);
  systemParts.push(buildMemoryProtocol(memoryMeta));

  if (knowledgeContext) {
    systemParts.push(`\n--- KNOWLEDGE ---\n${knowledgeContext}`);
  }

  const systemPrompt = systemParts.join('\n');

  const totalTokenEstimate =
    estimateTokens(systemPrompt) +
    historyTokens +
    estimateTokens(memoryContext) +
    estimateTokens(knowledgeContext) +
    estimateTokens(surfaceContext);

  return {
    systemPrompt,
    conversationHistory: history,
    memoryContext,
    knowledgeContext,
    surfaceContext,
    totalTokenEstimate,
  };
}

// ── Agent invocation ────────────────────────────────────────────────────────

export function invokeAgent(
  config: SessionConfig,
  message: string
): { reply: string; tokenEstimate: number } {
  const context = buildSessionContext(config);

  // Build user prompt with history + message
  const userParts: string[] = [];
  if (context.conversationHistory) {
    userParts.push(`--- RECENT CONVERSATION (for continuity) ---\n${context.conversationHistory}`);
  }
  userParts.push(`\nUser message: ${message}`);
  const userPrompt = userParts.join('\n\n');

  // Clean env vars that interfere with Claude CLI
  const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, ...cleanEnv } = process.env;
  void CLAUDECODE; void CLAUDE_CODE_ENTRYPOINT; void CLAUDE_CODE_SESSION_ID;

  // Load agent's tool permissions based on trust tier
  const db = getDb();
  let trustTier = 'worker'; // default
  try {
    const agentRow = db.prepare('SELECT trust_tier FROM agents WHERE id = ?').get(config.agentId) as { trust_tier: string } | undefined;
    if (agentRow?.trust_tier) trustTier = agentRow.trust_tier;
  } catch { /* use default */ }

  const allowedTools = TIER_TOOLS[trustTier] ?? TIER_TOOLS['worker'];
  const disallowed = loadDisallowedTools(config.agentId);
  const disallowedStr = disallowed.length > 0 ? disallowed.join(',') : '';

  const cliArgs = [
    ENV.CLAUDE_SCRIPT,
    '--print',
    '--output-format', 'text',
    '--model', ENV.MODEL_TRIVIAL,
    '--system-prompt', context.systemPrompt,
    '--allowedTools', allowedTools.join(','),
  ];
  // Only add --disallowedTools if there are entries (empty string crashes CLI)
  if (disallowedStr) {
    cliArgs.push('--disallowedTools', disallowedStr);
  }

  const result = spawnSync(
    process.execPath,
    cliArgs,
    {
      input: userPrompt,
      encoding: 'utf-8',
      env: cleanEnv as NodeJS.ProcessEnv,
      timeout: 45_000,
    }
  );

  if (result.error || result.status !== 0) {
    const errMsg = result.stderr?.slice(0, 500) || result.error?.message || 'Unknown error';
    console.error('[sessionService] Claude CLI error:', errMsg);
    throw new Error(`Claude CLI failed: ${errMsg}`);
  }

  const reply = (result.stdout || '').trim();
  if (!reply) {
    throw new Error('Claude CLI returned empty response');
  }

  return {
    reply,
    tokenEstimate: context.totalTokenEstimate + estimateTokens(message) + estimateTokens(reply),
  };
}
