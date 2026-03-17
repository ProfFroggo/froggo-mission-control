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
}

// ── Token estimation ────────────────────────────────────────────────────────

const BUDGET_HISTORY = 8000;
const BUDGET_SOUL = 3000;
const BUDGET_MEMORY = 2000;
const BUDGET_SHARED_MEMORY = 500;
const BUDGET_KNOWLEDGE = 1500;

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
    'SELECT key, agentId, createdAt, lastActivity, messageCount, lastMemoryExtractAt FROM sessions WHERE key = ?'
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

// ── Context assembly ────────────────────────────────────────────────────────

export function buildSessionContext(config: SessionConfig): SessionContext {
  // Ensure session exists
  createOrGetSession(config);

  // 1. Load agent identity (SOUL.md)
  const identity = loadAgentIdentity(config.agentId);

  // 2. Load conversation history
  const { history, tokenEstimate: historyTokens } = loadConversationHistory(config.sessionKey);

  // 3. Surface context from metadata
  let surfaceContext = '';
  if (config.metadata?.tabContext) {
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

  const result = spawnSync(
    process.execPath,
    [
      ENV.CLAUDE_SCRIPT,
      '--print',
      '--output-format', 'text',
      '--model', ENV.MODEL_TRIVIAL,
      '--system-prompt', context.systemPrompt,
    ],
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
