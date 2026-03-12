// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/generate-image
// Generates an image via Gemini, saves it to the library, returns a URL agents can embed in chat.

import { NextRequest, NextResponse } from 'next/server';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HOME = homedir();
const LIBRARY_PATH = join(HOME, 'mission-control', 'library');

async function getGeminiKey(): Promise<string | null> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet('gemini_api_key');
    if (val) return val.trim();
  } catch { /* keytar unavailable */ }
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  try {
    const db = getDb();
    const row = db.prepare(`SELECT value FROM settings WHERE key = 'gemini_api_key'`).get() as { value: string } | undefined;
    if (row?.value) return row.value.trim();
  } catch { /* ignore */ }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt   = String(body.prompt   ?? '').trim();
    const agentId  = String(body.agentId  ?? 'unknown');
    const filename = String(body.filename ?? '').replace(/[^a-z0-9_-]/gi, '-').slice(0, 80) || 'image';

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const apiKey = await getGeminiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'No Gemini API key configured. Add it in Settings → API Keys.' }, { status: 503 });
    }

    // Call Gemini image generation
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      return NextResponse.json({ error: `Gemini error ${res.status}: ${err.slice(0, 300)}` }, { status: 502 });
    }

    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string }; text?: string }> } }>;
    };

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find(p => p.inlineData?.data);
    const b64 = imgPart?.inlineData?.data;

    if (!b64) {
      // Return any text response as an error hint
      const textPart = parts.find(p => p.text);
      return NextResponse.json({
        error: 'Gemini returned no image data',
        detail: textPart?.text?.slice(0, 300),
      }, { status: 502 });
    }

    // Save PNG to library/design/images/
    const date = new Date().toISOString().slice(0, 10);
    const fname = `${date}_${filename}.png`;
    const relPath = join('design', 'images', fname);
    const absPath = join(LIBRARY_PATH, relPath);
    mkdirSync(join(LIBRARY_PATH, 'design', 'images'), { recursive: true });
    writeFileSync(absPath, Buffer.from(b64, 'base64'));

    // Register in library_files DB
    const fileId = `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      const db = getDb();
      db.prepare(
        `INSERT OR IGNORE INTO library_files (id, name, path, category, createdAt) VALUES (?, ?, ?, ?, ?)`
      ).run(fileId, fname, absPath, 'image', Date.now());
    } catch { /* non-critical — file is saved regardless */ }

    // URL agents can embed: /api/library?action=raw&id=<base64url_relative_path>
    const encodedId = Buffer.from(relPath).toString('base64url');
    const url = `/api/library?action=raw&id=${encodedId}`;
    const markdown = `![${prompt.slice(0, 100)}](${url})`;

    return NextResponse.json({ url, filePath: absPath, markdown, filename: fname });
  } catch (error) {
    console.error('POST /api/generate-image error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
