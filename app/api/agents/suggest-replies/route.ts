// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * SUGGEST REPLIES ROUTE — /api/agents/suggest-replies
 *
 * Uses Gemini Flash to generate 3 short contextual reply suggestions based on
 * the last assistant message. Fast and cheap — no session, one-shot inference.
 */

import { NextRequest, NextResponse } from 'next/server';
import { geminiPost } from '@/lib/geminiClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getGeminiKey(): Promise<string | null> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet('gemini_api_key');
    if (val) return val;
  } catch { /* keychain unavailable */ }
  return process.env.GEMINI_API_KEY ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const { lastMessage, agentName } = await request.json() as {
      lastMessage?: string;
      agentName?: string;
    };

    if (!lastMessage?.trim()) {
      return NextResponse.json({ suggestions: [] });
    }

    const apiKey = await getGeminiKey();
    if (!apiKey) {
      return NextResponse.json({ suggestions: [] });
    }

    const name = agentName || 'the agent';
    const truncated = lastMessage.slice(0, 800);

    const prompt = `${name} just said this in a chat:\n\n"${truncated}"\n\nGenerate exactly 3 short, natural reply options the user could send back. Rules:\n- Each reply is under 8 words\n- Replies are direct and conversational (not formal)\n- Replies should directly continue or respond to what was said\n- No punctuation at the end\n- Return ONLY a JSON array of strings, nothing else\n\nExample format: ["Yes, let's do that", "Can you explain more", "I need more time"]`;

    const res = await geminiPost('gemini-2.0-flash', apiKey, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 120 },
    });

    if (!res.ok) {
      return NextResponse.json({ suggestions: [] });
    }

    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const suggestions = JSON.parse(match[0]) as string[];
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        return NextResponse.json({ suggestions: suggestions.slice(0, 4) });
      }
    }

    return NextResponse.json({ suggestions: [] });

  } catch (err) {
    console.error('[suggest-replies] error:', err);
    return NextResponse.json({ suggestions: [] });
  }
}
