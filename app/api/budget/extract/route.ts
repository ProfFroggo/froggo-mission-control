// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/budget/extract — Gemini Vision: extract invoice data from PDF/image
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { geminiPost } from '@/lib/geminiClient';

export const dynamic = 'force-dynamic';

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_FALLBACK = 'gemini-2.0-flash';

async function getGeminiKey(): Promise<string | null> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet('gemini_api_key');
    if (val) return val;
  } catch { /* ignore */ }
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key') as { value: string } | undefined;
  return row?.value || process.env.GEMINI_API_KEY || null;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = await getGeminiKey();
    if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 400 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimes.includes(file.type)) {
      return NextResponse.json({ error: 'Only PDF and image files supported' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    const prompt = `Extract invoice data from this ${file.type === 'application/pdf' ? 'PDF document' : 'image'}.

Return ONLY a JSON object with these fields (use null for missing fields):
{
  "invoice_number": "invoice or reference number (string)",
  "title": "1-3 word descriptive label like 'KOL Partnership' or 'Event Sponsorship' (string)",
  "vendor": "company or individual name (string)",
  "amount": numeric value only, no currency symbols (number),
  "date": "YYYY-MM-DD format (string)",
  "description": "one short sentence of context (string)",
  "currency": "USD, EUR, MXN etc — infer from document (string)"
}

Return ONLY the JSON object, no other text.`;

    for (const model of [GEMINI_MODEL, GEMINI_FALLBACK]) {
      try {
        const res = await geminiPost(model, apiKey, {
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: file.type, data: base64 } },
            ],
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
        });

        if (!res.ok) {
          if (model === GEMINI_MODEL) continue;
          return NextResponse.json({ error: 'Gemini extraction failed' }, { status: 500 });
        }

        const data = await res.json();
        const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return NextResponse.json({ extracted: null, raw: text });

        try {
          const extracted = JSON.parse(match[0]);
          return NextResponse.json({ ok: true, extracted });
        } catch {
          return NextResponse.json({ extracted: null, raw: text });
        }
      } catch {
        if (model === GEMINI_MODEL) continue;
      }
    }

    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  } catch (err) {
    console.error('[budget/extract]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
