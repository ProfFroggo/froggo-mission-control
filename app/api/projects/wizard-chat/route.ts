// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/projects/wizard-chat — conversational AI for project creation wizard
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { ENV } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are helping set up a new project in Mission Control, an AI-powered command center.

Your job is to have a natural conversation to collect this information:
- Project name (required)
- What it is and what you're trying to achieve (goal/description, required)
- Any specific timeline or deadline
- Key collaborators or focus areas

Ask one or two questions at a time. Be conversational and direct. Don't list all questions upfront.

After your response text, if the question maps to one of these topics add a widget tag on its own line at the very end:
[WIDGET:agents] — when asking who should work on the project / team members
Only ONE widget tag per response. Put it as the very last line. Never include a widget tag when outputting [CONTEXT_READY].

When you have enough information (at minimum name and goal), output this EXACT marker on its own line:
[CONTEXT_READY]
Then on the next line, output a JSON object:
{"name":"...","goal":"...","description":"..."}

Don't include [CONTEXT_READY] until you have enough to create a real project.`;

const GSD_SYSTEM_PROMPT = `You are running the GSD (Get Shit Done) new-project discovery flow in Mission Control — a deep questioning session that produces a real, actionable project plan.

Your role is thinking partner, not interviewer. The user has an idea. Help them sharpen it into something buildable.

Approach:
- Start open. Let them describe it their way without interruption.
- Ask ONE focused question at a time. Follow the thread of what they said.
- Challenge vagueness directly: "Simple means what exactly?" / "Which users?" / "What does success look like?"
- Make abstract concrete: "Walk me through someone using this" / "Give me a real example"
- Follow their energy — dig into what excited them, what problem sparked this

You need to uncover (naturally, not as a checklist):
1. What they're actually building (concrete enough to describe to a stranger)
2. Why it needs to exist (the real problem or desire driving it)
3. Who it's for (even if just themselves)
4. What v1 "done" looks like — observable, verifiable outcomes
5. Rough phases of work (what's first, what's second, what's third)
6. Key constraints (tech stack, timeline, integrations, explicit non-goals)

After your response, add ONE widget tag on its own final line to present concrete choices to the user:
[WIDGET:choices|{"q":"short clarifying label","options":["Specific option A","Specific option B","Specific option C","Other"]}] — for most discovery questions. Options must be concrete and specific (2-5 words each, max 5 options, always "Other" as the last option).
[WIDGET:agents] — ONLY when specifically asking who should be on the project team.

Use [WIDGET:choices|...] liberally — concrete options help users recognise what they mean and speed up discovery significantly. Make options short enough that users immediately react with "yes, that" or "no, not quite". Always include "Other" as the last option to allow free-form input.

Examples of good choice widgets:
- Type: ["Web application","Mobile app","API / backend","Internal tool","Other"]
- Users: ["Just myself","Small team","Business / enterprise","General public","Other"]
- Goal: ["Save time / automate","Build a product","Replace existing tool","Explore an idea","Other"]
- Timeline: ["ASAP / already started","1-2 months","3-6 months","No deadline","Other"]
- Stack: ["I'll decide later","Specific stack I have in mind","Match existing codebase","Open to suggestions","Other"]

Only ONE widget tag per response. Never include a widget tag when outputting [GSD_READY].

When you have confident answers on all six areas above (usually 5-8 exchanges), output EXACTLY on its own line:
[GSD_READY]
Then immediately on the next line output ONLY this JSON (escape all newlines as \\n in string values, no extra whitespace):
{"name":"PROJECT NAME","goal":"one-sentence goal","description":"2-3 sentence description","projectMd":"...","requirementsMd":"...","roadmapMd":"..."}

projectMd format (escape newlines as \\n):
# [Project Name]\\n\\n## What This Is\\n[2-3 sentence description — what it does and who it's for]\\n\\n## Core Value\\n[The ONE thing that must work — one sentence]\\n\\n## Active Requirements\\n- [ ] [Requirement 1]\\n- [ ] [Requirement 2]\\n- [ ] [Requirement 3]\\n\\n## Out of Scope\\n- [Exclusion] — [why]\\n\\n## Constraints\\n- [Type]: [What] — [Why]\\n\\n## Context\\n[Background, prior work, key decisions made during discovery]

requirementsMd format:
# Requirements\\n\\n## v1 Scope\\n- [ ] REQ-01: [requirement]\\n- [ ] REQ-02: [requirement]\\n\\n## Out of Scope\\n- [Feature] — [reason it's excluded]

roadmapMd format:
# Roadmap\\n\\n## Overview\\n[One paragraph: the journey from start to shipped v1]\\n\\n## Phases\\n- [ ] Phase 1: [Name] — [one-line description]\\n- [ ] Phase 2: [Name] — [one-line description]\\n- [ ] Phase 3: [Name] — [one-line description]\\n\\n### Phase 1: [Name]\\n**Goal**: [What this phase delivers]\\n**Success Criteria**:\\n1. [Observable outcome]\\n2. [Observable outcome]\\n\\n### Phase 2: [Name]\\n**Goal**: [What this phase delivers]\\n**Success Criteria**:\\n1. [Observable outcome]\\n2. [Observable outcome]

Do NOT emit [GSD_READY] until you have clear answers on all six discovery areas.`;


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages as Array<{ role: 'user' | 'model'; text: string }>;
    const mode: 'quick' | 'gsd' = body.mode === 'gsd' ? 'gsd' : 'quick';

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }

    const model = mode === 'gsd' ? 'claude-opus-4-6' : 'claude-sonnet-4-6';
    const systemPrompt = mode === 'gsd' ? GSD_SYSTEM_PROMPT : SYSTEM_PROMPT;

    // Format conversation history for --print mode
    let userPrompt: string;
    if (messages.length === 1) {
      userPrompt = messages[0].text;
    } else {
      const historyLines = messages.slice(0, -1).map(m => {
        const role = m.role === 'model' ? 'Assistant' : 'User';
        return `${role}: ${m.text}`;
      }).join('\n\n');
      const lastMsg = messages[messages.length - 1];
      userPrompt = `<conversation_history>\n${historyLines}\n</conversation_history>\n\nUser: ${lastMsg.text}`;
    }

    const fullResponse = await new Promise<string>((resolve, reject) => {
      const env = { ...process.env };
      delete env.CLAUDECODE;
      delete env.CLAUDE_CODE_ENTRYPOINT;
      delete env.CLAUDE_CODE_SESSION_ID;

      const proc = spawn(ENV.CLAUDE_BIN, [
        '--print',
        '--output-format', 'text',
        '--model', model,
        '--system-prompt', systemPrompt,
      ], { stdio: ['pipe', 'pipe', 'pipe'], env });

      let out = '';
      let err = '';
      proc.stdout.on('data', (d: Buffer) => { out += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { err += d.toString(); });
      proc.on('error', reject);
      proc.on('close', code => {
        if (code === 0) resolve(out.trim());
        else reject(new Error(err.slice(0, 200) || `claude exited with code ${code}`));
      });
      proc.stdin.write(userPrompt, 'utf8');
      proc.stdin.end();
    });

    // Parse GSD_READY marker
    if (mode === 'gsd' && fullResponse.includes('[GSD_READY]')) {
      const markerIndex = fullResponse.indexOf('[GSD_READY]');
      const textBefore = fullResponse.slice(0, markerIndex).trim();
      const afterMarker = fullResponse.slice(markerIndex + '[GSD_READY]'.length).trim();
      try {
        const jsonStart = afterMarker.indexOf('{');
        const jsonEnd = afterMarker.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const gsdData = JSON.parse(afterMarker.slice(jsonStart, jsonEnd + 1));
          return NextResponse.json({ text: textBefore, gsdData, ready: true, isGsd: true });
        }
      } catch (err) { console.warn('[projects/wizard-chat] Non-critical: fall through:', err); }
    }

    // Parse CONTEXT_READY marker (quick mode)
    if (fullResponse.includes('[CONTEXT_READY]')) {
      const markerIndex = fullResponse.indexOf('[CONTEXT_READY]');
      const textBefore = fullResponse.slice(0, markerIndex).trim();
      const afterMarker = fullResponse.slice(markerIndex + '[CONTEXT_READY]'.length).trim();
      try {
        const jsonStart = afterMarker.indexOf('{');
        const jsonEnd = afterMarker.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const structuredData = JSON.parse(afterMarker.slice(jsonStart, jsonEnd + 1));
          return NextResponse.json({ text: textBefore, structuredData, ready: true });
        }
      } catch (err) { console.warn('[projects/wizard-chat] Non-critical: fall through:', err); }
    }

    // Parse WIDGET marker (last occurrence, may contain |JSON data)
    let widget: string | undefined;
    let widgetData: unknown;
    let displayText = fullResponse;
    const widgetStart = fullResponse.lastIndexOf('[WIDGET:');
    if (widgetStart !== -1) {
      const widgetRaw = fullResponse.slice(widgetStart);
      const widgetClose = widgetRaw.indexOf(']');
      if (widgetClose !== -1) {
        const widgetContent = widgetRaw.slice(8, widgetClose); // after '[WIDGET:'
        const pipeIdx = widgetContent.indexOf('|');
        if (pipeIdx !== -1) {
          widget = widgetContent.slice(0, pipeIdx).trim();
          try { widgetData = JSON.parse(widgetContent.slice(pipeIdx + 1)); } catch (err) { console.warn('[projects/wizard-chat] Non-critical:', err); }
        } else {
          widget = widgetContent.trim();
        }
        displayText = fullResponse.slice(0, widgetStart).trim();
      }
    }

    return NextResponse.json({ text: displayText, widget, widgetData, ready: false });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('POST /api/projects/wizard-chat error:', msg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
