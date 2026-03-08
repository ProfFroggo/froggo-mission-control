import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';
import { TIER_TOOLS, loadDisallowedTools } from '@/lib/taskDispatcher';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SCHEDULE_PATH = process.env.MC_SCHEDULE_PATH || join(homedir(), 'mission-control/data/schedule.json');
const CLAUDE_BIN = '/Users/kevin.macarthur/.npm-global/bin/claude';

function readJobs(): Record<string, unknown>[] {
  if (!existsSync(SCHEDULE_PATH)) return [];
  try { return JSON.parse(readFileSync(SCHEDULE_PATH, 'utf-8')); } catch { return []; }
}

function writeJobs(jobs: Record<string, unknown>[]): void {
  writeFileSync(SCHEDULE_PATH, JSON.stringify(jobs, null, 2));
}

export async function GET() {
  const jobs = readJobs();
  return NextResponse.json({ jobs });
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'run') {
    const { id } = await request.json();
    const jobs = readJobs();
    const job = jobs.find((j) => j.id === id) as Record<string, unknown> | undefined;
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const payload = (job.payload ?? {}) as Record<string, string>;
    const message = payload.message || 'Check your tasks and report status.';
    const model = payload.model || 'claude-haiku-4-5-20251001';
    const sessionTarget = (job.sessionTarget as string | undefined) ?? 'isolated';
    const isGeneric = sessionTarget === 'isolated' || sessionTarget === 'main';
    const agentCwd = isGeneric ? homedir() : join(homedir(), 'mission-control', 'agents', sessionTarget);

    try {
      const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, ...cleanEnv } = process.env;
      const agentId = isGeneric ? 'mission-control' : sessionTarget;
      const allowedTools = TIER_TOOLS['worker'];
      const disallowedTools = loadDisallowedTools(agentId);
      const proc = spawn(CLAUDE_BIN, ['--print', '--model', model,
        '--allowedTools', allowedTools.join(','),
        '--disallowedTools', disallowedTools.join(','),
        message], {
        cwd: existsSync(agentCwd) ? agentCwd : homedir(),
        env: { ...cleanEnv } as NodeJS.ProcessEnv,
        detached: true,
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      proc.unref();
    } catch { /* fire-and-forget */ }

    const updated = jobs.map((j) => j.id === id ? { ...j, state: { ...(j.state as object ?? {}), runningAtMs: Date.now() } } : j);
    writeJobs(updated);
    return NextResponse.json({ success: true });
  }

  // Create job
  const body = await request.json();
  const jobs = readJobs();
  const job: Record<string, unknown> = {
    id: crypto.randomUUID(),
    name: body.name,
    description: body.description || undefined,
    enabled: true,
    deleteAfterRun: false,
    schedule: body.schedule,
    sessionTarget: body.sessionTarget || 'isolated',
    wakeMode: 'now',
    payload: body.payload,
    state: {},
    createdAt: Date.now(),
  };
  jobs.push(job);
  writeJobs(jobs);
  return NextResponse.json({ job }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { id, ...updates } = await request.json();
  const jobs = readJobs();
  const updated = jobs.map((j) => j.id === id ? { ...j, ...updates } : j);
  writeJobs(updated);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  writeJobs(readJobs().filter((j) => j.id !== id));
  return NextResponse.json({ success: true });
}
