import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/lib/env';
import { spawnSync } from 'child_process';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { message, context, tone = 'professional' } = await request.json();
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const systemPrompt = `You are a helpful assistant generating a ${tone} reply to a message. Be concise and direct. Only output the reply text, nothing else.`;
    const userPrompt = context
      ? `Context: ${context}\n\nMessage to reply to: ${message}`
      : `Message to reply to: ${message}`;

    const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, ...cleanEnv } = process.env;
    void CLAUDECODE; void CLAUDE_CODE_ENTRYPOINT; void CLAUDE_CODE_SESSION_ID;

    const result = spawnSync(
      process.execPath,
      [
        ENV.CLAUDE_SCRIPT,
        '--print',
        '--output-format', 'text',
        '--model', ENV.MODEL_TRIVIAL,
        '--system-prompt', systemPrompt,
      ],
      {
        input: userPrompt,
        encoding: 'utf-8',
        env: cleanEnv as NodeJS.ProcessEnv,
        timeout: 30_000,
      }
    );

    if (result.error || result.status !== 0) {
      console.error('generate-reply claude error:', result.stderr);
      return NextResponse.json({ success: false, error: 'Claude CLI failed' }, { status: 500 });
    }

    const reply = (result.stdout || '').trim();
    return NextResponse.json({ success: true, reply });
  } catch (error) {
    console.error('POST /api/chat/generate-reply error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate reply' }, { status: 500 });
  }
}
