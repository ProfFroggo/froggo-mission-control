import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getAuthenticatedClient } from '@/lib/googleAuth';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CLAUDE_BIN = '/Users/kevin.macarthur/.npm-global/bin/claude';

interface AnalysisResult {
  triage: 'urgent' | 'action' | 'fyi' | 'no-reply';
  summary: string;
  tasks: Array<{ title: string; description: string }>;
  events: Array<{ title: string; date: string; time: string; duration?: string; location?: string }>;
  reply_draft: string | null;
  reply_needed: boolean;
}

interface MessageInput {
  id: string;
  subject?: string;
  from?: string;
  preview?: string;
  body?: string;
}

function runClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, ...cleanEnv } = process.env;
    let output = '';
    let errorOutput = '';
    const proc = spawn(
      CLAUDE_BIN,
      ['--print', '--model', 'claude-haiku-4-5-20251001', '--output-format', 'text', prompt],
      {
        cwd: join(homedir(), 'mission-control', 'agents', 'inbox'),
        env: cleanEnv as NodeJS.ProcessEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    proc.stdout.on('data', (d: Buffer) => { output += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { errorOutput += d.toString(); });
    proc.on('close', (code: number | null) => {
      if (code === 0 && output.trim()) {
        resolve(output.trim());
      } else {
        reject(new Error(`Claude exited ${code}: ${errorOutput.slice(0, 200)}`));
      }
    });
    proc.on('error', reject);
    // Timeout after 30 seconds
    setTimeout(() => { proc.kill(); reject(new Error('Analysis timeout')); }, 30000);
  });
}

function extractJson(text: string): Record<string, unknown> | null {
  // Find JSON block in Claude output (may be wrapped in markdown)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]+\})/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text.trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

async function fetchMessageContent(id: string): Promise<MessageInput | null> {
  try {
    const client = await getAuthenticatedClient();
    if (!client) return null;
    const gmail = google.gmail({ version: 'v1', auth: client });
    const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const headers = msg.data.payload?.headers ?? [];
    const headerVal = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name)?.value ?? '';
    const subject = headerVal('subject');
    const from = headerVal('from');

    // Extract text body
    let body = '';
    function traverse(part: any) {
      if (!part) return;
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.parts) part.parts.forEach(traverse);
    }
    traverse(msg.data.payload);

    return { id, subject, from, body: body.slice(0, 1000) };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Accept either { ids: string[] } or { messages: MessageInput[] }
    let messages: MessageInput[] = body.messages ?? [];

    if (messages.length === 0 && Array.isArray(body.ids)) {
      // Fetch content from Gmail for each ID
      const results = await Promise.all(
        (body.ids as string[]).slice(0, 10).map(fetchMessageContent)
      );
      messages = results.filter((m): m is MessageInput => m !== null);
    }

    if (messages.length === 0) {
      return NextResponse.json({ success: false, error: 'No messages to analyze' });
    }

    // Build batch analysis prompt
    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const messageBlocks = messages.map(m => {
      const content = m.body || m.preview || '(no body)';
      return `[ID: ${m.id}]
From: ${m.from || 'Unknown'}
Subject: ${m.subject || '(no subject)'}
Body: ${content.slice(0, 600)}`;
    }).join('\n\n---\n\n');

    const prompt = `Today is ${today}. Analyze these emails and return a JSON object.

For each email ID, provide an analysis object with these exact fields:
- "triage": one of "urgent", "action", "fyi", "no-reply"
  - urgent: requires immediate attention (time-sensitive, critical decision, emergency)
  - action: requires a response or follow-up action
  - fyi: informational, no action needed
  - no-reply: newsletters, notifications, automated messages
- "summary": one sentence summary of what the email is about
- "tasks": array of {title, description} for any action items identified
- "events": array of {title, date, time, location} for any meetings/events mentioned (use ISO dates)
- "reply_draft": a brief draft reply if reply_needed is true, otherwise null
- "reply_needed": true if the sender needs a reply

Return ONLY a valid JSON object, no markdown, no explanation. Format:
{
  "MESSAGEID1": { "triage": "...", "summary": "...", "tasks": [], "events": [], "reply_draft": null, "reply_needed": false },
  "MESSAGEID2": { ... }
}

Emails to analyze:

${messageBlocks}`;

    if (!existsSync(CLAUDE_BIN)) {
      return NextResponse.json({ success: false, error: 'Claude CLI not found' });
    }

    const rawOutput = await runClaude(prompt);
    const parsed = extractJson(rawOutput);

    if (!parsed) {
      console.error('[inbox/analyze] Failed to parse Claude output:', rawOutput.slice(0, 200));
      return NextResponse.json({ success: false, error: 'Failed to parse analysis' });
    }

    // Validate and normalize each result
    const analysis: Record<string, AnalysisResult> = {};
    for (const msg of messages) {
      const raw = parsed[msg.id] as any;
      if (!raw) continue;
      analysis[msg.id] = {
        triage: ['urgent', 'action', 'fyi', 'no-reply'].includes(raw.triage) ? raw.triage : 'fyi',
        summary: typeof raw.summary === 'string' ? raw.summary : '',
        tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
        events: Array.isArray(raw.events) ? raw.events : [],
        reply_draft: raw.reply_draft ?? null,
        reply_needed: Boolean(raw.reply_needed),
      };
    }

    return NextResponse.json({ success: true, analysis });
  } catch (err: any) {
    console.error('[inbox/analyze] Error:', err?.message ?? err);
    return NextResponse.json({ success: false, error: err?.message ?? 'Analysis failed' });
  }
}
