import { ENV } from '@/lib/env';
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CLAUDE_BIN = ENV.CLAUDE_BIN;

const MC_SYSTEM = `You are Mission Control, helping set up a new project in the Mission Control platform.

Keep responses brief and conversational — 1-2 sentences max. Be warm, direct, and helpful.

You are guiding the user through: project name → goal → picking an icon/colour → choosing team agents → final confirmation.

Do not ask for multiple things at once. Follow the user's lead and respond to what they've said. Never repeat yourself.`;

// POST /api/agents/mission-control/project-chat
// Called by ProjectCreationWizard to power the conversational project setup.
// Body: { message: string } — the full prompt with system + history + user message.
// Returns { response: string }
export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const reply = await new Promise<string>((resolve, reject) => {
      const env = { ...process.env };
      delete env.CLAUDECODE;
      delete env.CLAUDE_CODE_ENTRYPOINT;
      delete env.CLAUDE_CODE_SESSION_ID;

      const proc = spawn(
        CLAUDE_BIN,
        ['--print', '--model', 'claude-haiku-4-5-20251001'],
        { stdio: ['pipe', 'pipe', 'pipe'], env }
      );

      let out = '';
      let err = '';

      proc.stdout.on('data', (d: Buffer) => { out += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { err += d.toString(); });

      proc.on('error', reject);
      proc.on('close', code => {
        if (code === 0) resolve(out.trim());
        else reject(new Error(err.slice(0, 200) || `claude exited with code ${code}`));
      });

      proc.stdin.write(message, 'utf8');
      proc.stdin.end();
    });

    return NextResponse.json({ response: reply });
  } catch (error) {
    console.error('POST /api/agents/mission-control/project-chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
