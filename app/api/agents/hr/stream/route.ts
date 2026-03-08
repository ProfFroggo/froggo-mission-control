import { ENV } from '@/lib/env';
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CLAUDE_BIN = ENV.CLAUDE_BIN;

// POST /api/agents/hr/stream
// Called by HRAgentCreationModal to run the HR conversational agent.
// The "message" is a self-contained prompt that includes the HR system instructions,
// the full conversation history, and the user's latest message.
// Returns { response: string } (non-streaming — the modal polls for the complete reply).
export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const reply = await new Promise<string>((resolve, reject) => {
      // Unset CLAUDECODE so Claude CLI doesn't refuse to run inside a Claude Code session
      const env = { ...process.env };
      delete env.CLAUDECODE;

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
    console.error('POST /api/agents/hr/stream error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
