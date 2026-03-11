// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { ENV } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CLAUDE_SCRIPT = ENV.CLAUDE_SCRIPT;
const NODE_BIN      = process.execPath;

const RESEARCH_SYSTEM = `You are a specialist in AI agent design and role architecture. Given a job role and description, research and return the optimal skill set, tools, and knowledge areas for that agent.

Return ONLY a valid JSON object with this exact structure:
{
  "skills": ["skill1", "skill2", ...],
  "tools": ["tool1", "tool2", ...],
  "specializations": ["area1", "area2", ...],
  "suggestedModel": "opus" | "sonnet" | "haiku",
  "trustTier": "worker" | "apprentice",
  "rationale": "One sentence explanation"
}

Rules:
- skills: 6-10 specific, actionable capabilities (e.g. "Twitter API integration", "sentiment analysis", "community moderation")
- tools: 3-6 Claude Code tools this agent needs (from: Bash, Read, Edit, Write, Glob, Grep, WebSearch, WebFetch, mcp__mission-control_db__*)
- specializations: 3-5 domain areas or knowledge bases
- suggestedModel: opus for complex reasoning, haiku for fast/simple tasks, sonnet for most agents
- trustTier: worker if the role is senior/autonomous, apprentice if junior/supervised
- Return ONLY the JSON object. No markdown, no explanation, no extra text.`;

async function callClaude(prompt: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const env = { ...process.env };
    delete env.CLAUDECODE;

    const proc = spawn(
      NODE_BIN,
      [CLAUDE_SCRIPT, '--print', '--model', 'claude-haiku-4-5-20251001'],
      { stdio: ['pipe', 'pipe', 'pipe'], env }
    );

    let out = '';
    let err = '';
    proc.stdout.on('data', (d: Buffer) => { out += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { err += d.toString(); });
    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(err.slice(0, 300) || `claude exited ${code}`));
    });

    proc.stdin.write(`${RESEARCH_SYSTEM}\n\n${prompt}`, 'utf8');
    proc.stdin.end();
  });
}

// POST /api/agents/hr/research
export async function POST(req: NextRequest) {
  const { name, role, capabilities, personality, style } = await req.json();

  if (!role) {
    return NextResponse.json({ error: 'role is required' }, { status: 400 });
  }

  const prompt = `Research the optimal skill set for this AI agent:
- Name: ${name || 'Unknown'}
- Role: ${role}
- Style: ${style || 'not specified'}
- Self-described capabilities: ${Array.isArray(capabilities) ? capabilities.join(', ') : (capabilities || 'none')}
- Personality: ${personality || 'not specified'}

Return the JSON:`;

  const raw = await callClaude(prompt);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON in response: ${raw.slice(0, 100)}`);

  const result = JSON.parse(jsonMatch[0]);

  return NextResponse.json({
    skills:          Array.isArray(result.skills)          ? result.skills          : capabilities || [],
    tools:           Array.isArray(result.tools)           ? result.tools           : [],
    specializations: Array.isArray(result.specializations) ? result.specializations : [],
    suggestedModel:  ['opus', 'sonnet', 'haiku'].includes(result.suggestedModel) ? result.suggestedModel : 'sonnet',
    trustTier:       ['worker', 'apprentice'].includes(result.trustTier) ? result.trustTier : 'apprentice',
    rationale:       typeof result.rationale === 'string' ? result.rationale : '',
  });
}
