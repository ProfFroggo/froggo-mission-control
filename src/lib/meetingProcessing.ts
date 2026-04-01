// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Shared meeting processing utilities — summarization, task extraction,
 * and meeting date detection. Used by the transcript upload API, Drive sync
 * API, and Drive sync cron so all import paths get identical treatment.
 */

import fs from 'fs';
import path from 'path';

// ── Gemini key ────────────────────────────────────────────────────────────────

export async function getGeminiKey(): Promise<string | null> {
  try {
    const { keychainGet } = await import('./keychain');
    const val = await keychainGet('gemini_api_key');
    if (val) return val;
  } catch { /* ignore */ }
  return process.env.GEMINI_API_KEY ?? null;
}

// ── Extractive summary fallback ───────────────────────────────────────────────

export function extractiveSummary(text: string): string {
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);

  if (sentences.length === 0) return text.slice(0, 2000);

  const words = text.split(/\s+/);
  const first500 = words.slice(0, 500).join(' ');

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

// ── Meeting date extraction ───────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

/**
 * Try to extract the actual meeting date from transcript text.
 * Skips the generated file header (before `---`) to avoid matching the
 * upload-date we write into the metadata block. Returns YYYY-MM-DD or null.
 */
export function extractMeetingDate(text: string): string | null {
  // Skip the generated header — look only at content after the --- separator
  const sepIdx = text.indexOf('\n---\n');
  const body = sepIdx >= 0 ? text.slice(sepIdx + 5) : text;
  const head = body.slice(0, 3000);

  // ISO: 2025-11-19
  const iso = head.match(/\b(20\d\d)[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // "Nov 19, 2025" or "November 19, 2025"
  const mdy = head.match(new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2}),?\\s+(20\\d\\d)\\b`, 'i'));
  if (mdy) {
    const m = MONTH_MAP[mdy[1].toLowerCase()];
    if (m) return `${mdy[3]}-${m}-${mdy[2].padStart(2, '0')}`;
  }

  // "19 Nov 2025" or "19 November 2025"
  const dmy = head.match(new RegExp(`\\b(\\d{1,2})\\s+${MONTH_RE}\\s+(20\\d\\d)\\b`, 'i'));
  if (dmy) {
    const m = MONTH_MAP[dmy[2].toLowerCase()];
    if (m) return `${dmy[3]}-${m}-${dmy[1].padStart(2, '0')}`;
  }

  return null;
}

// ── Org context loader ────────────────────────────────────────────────────────

export async function loadOrgContext(): Promise<string> {
  const sections: string[] = [];

  try {
    const { getDb } = await import('./database');
    const db = getDb();

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
    console.error('[meetingProcessing] Failed to load org context:', e);
  }

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

// ── Gemini summary ────────────────────────────────────────────────────────────

export async function generateGeminiSummary(
  text: string,
  apiKey: string,
): Promise<{ summary: string; oneLiner: string; title: string; meetingDate: string | null }> {
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
MEETING-DATE: [YYYY-MM-DD of the actual date the meeting occurred, extracted from the transcript. Write "unknown" if not clear.]

SUMMARY:
[200-400 word summary with markdown formatting including:]
1. **Key Topics** discussed
2. **Decisions** made
3. **Action Items** with owners if mentioned
4. **Next Steps**

For the TITLE: extract the meeting topic from context, use the actual meeting date found in the transcript, and list attendee first names mentioned.

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

  const titleMatch = raw.match(/TITLE:\s*(.+?)(?:\n|$)/i);
  const oneLineMatch = raw.match(/ONE-LINER:\s*(.+?)(?:\n|$)/i);
  const meetingDateMatch = raw.match(/MEETING-DATE:\s*(.+?)(?:\n|$)/i);
  const summaryMatch = raw.match(/SUMMARY:\s*\n([\s\S]+)/i);

  // Parse date returned by Gemini; fall back to regex scan of transcript
  let meetingDate: string | null = null;
  const rawDate = meetingDateMatch?.[1]?.trim();
  if (rawDate && rawDate.toLowerCase() !== 'unknown' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    meetingDate = rawDate;
  }
  if (!meetingDate) meetingDate = extractMeetingDate(text);

  return {
    title: titleMatch?.[1]?.trim() || '',
    oneLiner: oneLineMatch?.[1]?.trim() || raw.split('\n')[0].slice(0, 120),
    summary: summaryMatch?.[1]?.trim() || raw,
    meetingDate,
  };
}

// ── Task proposal extraction ──────────────────────────────────────────────────

export type TaskProposal = {
  title: string;
  description: string;
  planningNotes: string;
  priority: string;
  assignedTo: string;
  subtasks: string[];
};

export async function extractTaskProposals(
  text: string,
  apiKey: string,
): Promise<TaskProposal[]> {
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

    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('[meetingProcessing] Task extraction failed:', e);
    return [];
  }
}
