// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/meetings/transcript — Upload transcript text, save to library, generate summary + extract action items
import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/lib/env';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = ['.txt', '.md'];

// ── Action item extraction patterns ────────────────────────────────────────
const ACTION_PATTERNS = [
  /\bTODO[:\s]+(.+?)(?:\.|$)/gim,
  /\bACTION(?:\s+ITEM)?[:\s]+(.+?)(?:\.|$)/gim,
  /\bfollow\s+up\s+(?:on|with)\s+(.+?)(?:\.|$)/gim,
  /(?:^|\.\s+)(?:I|we)\s+(?:need to|have to|should|will|must)\s+(.+?)(?:\.|$)/gim,
  /(?:^|\.\s+)(?:you|they)\s+(?:need to|should|will|must)\s+(.+?)(?:\.|$)/gim,
  /\bdon'?t forget\s+(?:to\s+)?(.+?)(?:\.|$)/gim,
  /\bremember to\s+(.+?)(?:\.|$)/gim,
  /\bmake sure\s+(?:to\s+)?(.+?)(?:\.|$)/gim,
  /\blet'?s\s+(?:make sure|ensure|plan|schedule|set up)\s+(.+?)(?:\.|$)/gim,
  /\bassign(?:ed)?\s+(?:to\s+\w+\s+)?[:\s]+(.+?)(?:\.|$)/gim,
  /\bdeadline[:\s]+(.+?)(?:\.|$)/gim,
  /\bnext\s+step[s]?[:\s]+(.+?)(?:\.|$)/gim,
];

/** Extract action items from transcript text using keyword heuristics */
function extractActionItems(text: string): Array<{ text: string; pattern: string }> {
  const items: Array<{ text: string; pattern: string }> = [];
  const seen = new Set<string>();

  for (const pattern of ACTION_PATTERNS) {
    // Reset regex lastIndex for each run
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const extracted = match[1]?.trim();
      if (!extracted || extracted.length < 5 || extracted.length > 300) continue;

      // Deduplicate by normalized text
      const normalized = extracted.toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      items.push({
        text: extracted.charAt(0).toUpperCase() + extracted.slice(1),
        pattern: pattern.source.slice(0, 30),
      });
    }
  }

  return items;
}

/** Generate extractive summary fallback (first 500 words + key sentences) */
function extractiveSummary(text: string): string {
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);

  if (sentences.length === 0) return text.slice(0, 2000);

  // Take first ~500 words as context
  const words = text.split(/\s+/);
  const first500 = words.slice(0, 500).join(' ');

  // Find key sentences (containing important keywords)
  const keyWords = ['decided', 'agreed', 'conclusion', 'important', 'key', 'summary', 'result', 'outcome', 'plan', 'next step'];
  const keySentences = sentences.filter(s =>
    keyWords.some(kw => s.toLowerCase().includes(kw))
  ).slice(0, 5);

  const parts = [first500];
  if (keySentences.length > 0) {
    parts.push('\n\n**Key Points:**');
    parts.push(...keySentences.map(s => `- ${s}`));
  }

  return parts.join('\n');
}

/** Get Gemini API key from keychain or env */
async function getGeminiKey(): Promise<string | null> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet('gemini_api_key');
    if (val) return val;
  } catch { /* ignore */ }
  return process.env.GEMINI_API_KEY ?? null;
}

/** Load context from knowledge base + agent roster for richer task extraction */
async function loadOrgContext(): Promise<string> {
  const sections: string[] = [];

  try {
    const { getDb: getMcDb } = await import('@/lib/database');
    const db = getMcDb();

    // Load agent roster with roles and skills
    const agents = db.prepare(
      `SELECT id, name, role, personality FROM agents ORDER BY id`
    ).all() as Array<{ id: string; name: string; role: string | null; personality: string | null }>;

    if (agents.length > 0) {
      sections.push('## Available AI Agents\nThese are the agents that can be assigned to tasks. Pick the BEST match based on their role and expertise:\n');
      for (const a of agents) {
        const skills = a.personality ? a.personality.slice(0, 150) : '';
        sections.push(`- **${a.id}** (${a.name}): ${a.role || 'General'}${skills ? ` — ${skills}` : ''}`);
      }
    }

    // Load relevant knowledge base articles (pinned + recent)
    const kbArticles = db.prepare(
      `SELECT title, category, substr(content, 1, 200) as excerpt FROM knowledge_base
       WHERE pinned = 1 OR updatedAt > ?
       ORDER BY pinned DESC, updatedAt DESC LIMIT 10`
    ).all(Date.now() - 30 * 24 * 60 * 60 * 1000) as Array<{ title: string; category: string; excerpt: string }>;

    if (kbArticles.length > 0) {
      sections.push('\n## Organizational Knowledge\nKey context from the knowledge base — use this to inform task scope and relevance:\n');
      for (const kb of kbArticles) {
        sections.push(`- [${kb.category}] **${kb.title}**: ${kb.excerpt.replace(/\n/g, ' ')}`);
      }
    }

    // Load recent completed tasks for context on what's already been done
    const recentTasks = db.prepare(
      `SELECT title, assignedTo FROM tasks WHERE status = 'done' ORDER BY completedAt DESC LIMIT 5`
    ).all() as Array<{ title: string; assignedTo: string | null }>;

    if (recentTasks.length > 0) {
      sections.push('\n## Recently Completed Work\nAvoid duplicating work that was already done:\n');
      for (const t of recentTasks) {
        sections.push(`- ${t.title} (done by ${t.assignedTo || 'unknown'})`);
      }
    }
  } catch (e) {
    console.error('[meetings/transcript] Failed to load org context:', e);
  }

  // Load agent memory summaries
  try {
    const agentsDir = path.join(process.env.HOME || '/tmp', 'mission-control', 'agents');
    const agentDirs = fs.readdirSync(agentsDir).filter((d: string) => !d.startsWith('.') && d !== '_archive');
    const memoryNotes: string[] = [];

    for (const agentId of agentDirs) {
      const memDir = path.join(agentsDir, agentId, 'memory');
      if (!fs.existsSync(memDir)) continue;
      const files = fs.readdirSync(memDir).filter((f: string) => f.endsWith('.md')).slice(0, 3);
      for (const f of files) {
        const content = fs.readFileSync(path.join(memDir, f), 'utf-8').slice(0, 150);
        memoryNotes.push(`- ${agentId}: ${f.replace('.md', '')} — ${content.replace(/\n/g, ' ').trim()}`);
      }
    }

    if (memoryNotes.length > 0) {
      sections.push('\n## Agent Memory (recent learnings)\n');
      sections.push(...memoryNotes.slice(0, 15));
    }
  } catch { /* non-critical */ }

  return sections.join('\n');
}

/** Extract structured task proposals via Gemini */
async function extractTaskProposals(text: string, apiKey: string): Promise<Array<{
  title: string; description: string; planningNotes: string;
  priority: string; assignedTo: string; subtasks: string[];
}>> {
  const truncated = text.length > 20000 ? text.slice(0, 20000) : text;
  const orgContext = await loadOrgContext();

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are analyzing a meeting transcript to extract actionable tasks for an AI agent team.

${orgContext}

---

Extract actionable tasks from the transcript below. For each task:
1. Choose the BEST agent based on the agent roster above — match their role/expertise to the task
2. Cross-reference the knowledge base and recent work to avoid duplicates and add relevant context
3. Write planning notes that reference relevant knowledge articles or past work when applicable

Return ONLY a JSON array (no markdown, no explanation) with this exact format:
[
  {
    "title": "Short task title",
    "description": "What needs to be done and why",
    "planningNotes": "Step-by-step approach. Reference relevant knowledge or past work.",
    "priority": "p0|p1|p2|p3",
    "assignedTo": "<agent-id from roster above>",
    "subtasks": ["Subtask 1", "Subtask 2", "Subtask 3"]
  }
]

Priority guide: p0=urgent/blocking, p1=high/this-week, p2=normal, p3=low/nice-to-have

IMPORTANT: Tasks are executed by AI agents autonomously. Each task must be something an agent can do:
- Research, analysis, documentation, planning, code, design mockups, content drafts, data analysis
- Do NOT create tasks requiring physical presence, phone calls, or in-person meetings
- For human-interaction tasks, frame as "Research and prepare brief for [topic]" or "Draft proposal for [topic]"

Extract 3-8 tasks. Each must have 2-4 subtasks. Be specific and actionable.

Transcript:
${truncated}`,
            }],
          }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
        }),
      }
    );

    if (!res.ok) return [];
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!raw) return [];

    // Parse JSON — handle markdown code blocks
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('[meetings/transcript] Task extraction failed:', e);
    return [];
  }
}

/** Generate summary via Gemini 2.0 Flash */
async function generateGeminiSummary(text: string, apiKey: string): Promise<{ summary: string; oneLiner: string; title: string }> {
  const truncated = text.length > 30000 ? text.slice(0, 30000) + '\n[truncated]' : text;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Summarize this meeting transcript. Return your response in this EXACT format:

TITLE: [Topic — Date — Attendees: Name1, Name2, etc. Example: "Product Strategy — Mar 15, 2026 — Kevin, Alberto, Tayler"]
ONE-LINER: [A single sentence describing what was discussed and decided, max 120 chars]

SUMMARY:
[200-400 word summary with markdown formatting including:]
1. **Key Topics** discussed
2. **Decisions** made
3. **Action Items** with owners if mentioned
4. **Next Steps**

For the TITLE: extract the meeting topic from context, use today's date, and list attendee first names mentioned in the transcript.

Transcript:
${truncated}`,
          }],
        }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!raw) throw new Error('Gemini returned empty summary');

  // Parse TITLE, ONE-LINER, and SUMMARY sections
  const titleMatch = raw.match(/TITLE:\s*(.+?)(?:\n|$)/i);
  const oneLineMatch = raw.match(/ONE-LINER:\s*(.+?)(?:\n|$)/i);
  const summaryMatch = raw.match(/SUMMARY:\s*\n([\s\S]+)/i);

  return {
    title: titleMatch?.[1]?.trim() || '',
    oneLiner: oneLineMatch?.[1]?.trim() || raw.split('\n')[0].slice(0, 120),
    summary: summaryMatch?.[1]?.trim() || raw,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, filename } = body as { content?: string; filename?: string };

    // ── Validation ──────────────────────────────────────────────────────────
    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'filename is required' }, { status: 400 });
    }

    // Size check (content as UTF-8 bytes)
    const byteSize = new TextEncoder().encode(content).length;
    if (byteSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (${(byteSize / 1024 / 1024).toFixed(1)}MB). Maximum size is 5MB.` },
        { status: 413 }
      );
    }

    // Extension check
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // ── Save transcript to library ──────────────────────────────────────────
    const meetingsDir = path.join(ENV.LIBRARY_PATH, 'docs', 'meetings');
    fs.mkdirSync(meetingsDir, { recursive: true });

    const date = new Date().toISOString().slice(0, 10);
    const safeName = filename
      .replace(/\.[^/.]+$/, '') // strip extension
      .replace(/[^a-zA-Z0-9_-]/g, '_') // sanitize
      .slice(0, 80);
    const savedFilename = `${date}_${safeName}.md`;
    const savedPath = path.join(meetingsDir, savedFilename);

    // Wrap in markdown with metadata header
    const mdContent = [
      `# Meeting Transcript: ${safeName.replace(/_/g, ' ')}`,
      ``,
      `**Date**: ${date}`,
      `**Source**: Uploaded transcript`,
      ``,
      `---`,
      ``,
      content.trim(),
    ].join('\n');

    fs.writeFileSync(savedPath, mdContent, 'utf-8');

    // ── Generate summary ────────────────────────────────────────────────────
    // Action items are no longer extracted by regex — Gemini task proposals replace them
    let summary: string;
    let oneLiner: string = '';
    let meetingTitle = safeName.replace(/_/g, ' ');
    let summarySource: 'gemini' | 'extractive';

    const apiKey = await getGeminiKey();
    if (apiKey) {
      try {
        const result = await generateGeminiSummary(content, apiKey);
        summary = result.summary;
        oneLiner = result.oneLiner;
        if (result.title) meetingTitle = result.title;
        summarySource = 'gemini';
      } catch (err) {
        console.error('[meetings/transcript] Gemini summary failed, using extractive fallback:', err);
        summary = extractiveSummary(content);
        summarySource = 'extractive';
      }
    } else {
      summary = extractiveSummary(content);
      summarySource = 'extractive';
    }
    // Fallback one-liner from first sentence of summary
    if (!oneLiner) {
      oneLiner = summary.replace(/[#*_]/g, '').split(/[.!?\n]/)[0]?.trim().slice(0, 120) || 'Meeting transcript processed';
    }

    // ── Extract structured task proposals via Gemini ──────────────────────
    let taskProposals: Array<{
      title: string; description: string; planningNotes: string;
      priority: string; assignedTo: string; subtasks: string[];
    }> = [];
    if (apiKey) {
      try {
        taskProposals = await extractTaskProposals(content, apiKey);
      } catch (e) {
        console.error('[meetings/transcript] Task proposal extraction failed:', e);
      }
    }

    // ── Create meeting record in scheduled_items ──────────────────────────
    // So the transcript shows up in Past Meetings tab
    const { getDb: getMcDb } = await import('@/lib/database');
    const meetingId = `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    try {
      const db = getMcDb();
      db.prepare(`
        INSERT INTO scheduled_items (id, title, description, type, content, scheduledFor, scheduledAt, status, metadata, createdAt, updatedAt)
        VALUES (?, ?, ?, 'meeting', ?, ?, ?, 'completed', ?, ?, ?)
      `).run(
        meetingId,
        meetingTitle,
        oneLiner,
        content.slice(0, 5000),
        date,
        now,
        JSON.stringify({
          filePath: savedPath,
          summarySource,
          summary,
          taskProposals: taskProposals.slice(0, 10),
        }),
        now, now
      );
    } catch (e) {
      console.error('[meetings/transcript] Failed to create meeting record:', e);
    }

    return NextResponse.json({
      success: true,
      meetingId,
      savedPath,
      savedFilename,
      summary,
      summarySource,
      taskProposals: taskProposals.map((tp, i) => ({
        id: `proposal-${Date.now()}-${i}`,
        ...tp,
        status: 'pending' as const,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[meetings/transcript] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
