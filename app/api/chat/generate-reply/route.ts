import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { message, context, tone = 'professional' } = await request.json();
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'ANTHROPIC_API_KEY not configured' }, { status: 424 });
    }

    const client = new Anthropic({ apiKey });
    const systemPrompt = `You are a helpful assistant generating a ${tone} reply to a message. Be concise and direct. Only output the reply text, nothing else.`;
    const userPrompt = context
      ? `Context: ${context}\n\nMessage to reply to: ${message}`
      : `Message to reply to: ${message}`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const reply = response.content[0]?.type === 'text' ? response.content[0].text : '';
    return NextResponse.json({ success: true, reply });
  } catch (error) {
    console.error('POST /api/chat/generate-reply error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate reply' }, { status: 500 });
  }
}
