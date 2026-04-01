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

/** Resolve a library URL or absolute path to { base64, mimeType } */
async function resolveReferenceImage(ref: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    let absPath: string | null = null;

    if (ref.startsWith('/') && !ref.startsWith('/api/') && !ref.startsWith('/library')) {
      // Already an absolute filesystem path
      absPath = ref;
    } else {
      // Library URL: /api/library?action=raw&id=<base64url> or /library?action=raw&id=<base64url>
      const idMatch = ref.match(/[?&]id=([A-Za-z0-9_=-]+)/);
      if (idMatch) {
        const relPath = Buffer.from(idMatch[1], 'base64url').toString('utf8');
        absPath = join(LIBRARY_PATH, relPath);
      }
    }

    if (!absPath) return null;

    const { readFileSync, existsSync } = await import('fs');
    if (!existsSync(absPath)) return null;

    const buf = readFileSync(absPath);
    const ext = absPath.split('.').pop()?.toLowerCase() ?? '';
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      webp: 'image/webp', gif: 'image/gif',
    };
    const mimeType = mimeMap[ext] ?? 'image/png';
    return { data: buf.toString('base64'), mimeType };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt   = String(body.prompt   ?? '').trim();
    const agentId  = String(body.agentId  ?? 'unknown');
    const filename = String(body.filename ?? '').replace(/[^a-z0-9_-]/gi, '-').slice(0, 80) || 'image';
    // Optional reference image: absolute path or library URL (/api/library?action=raw&id=...)
    const referenceImage = body.referenceImagePath ?? body.referenceImageUrl ?? null;

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const apiKey = await getGeminiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'No Gemini API key configured. Add it in Settings → API Keys.' }, { status: 503 });
    }

    // Build parts: optional reference image first, then text prompt
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
    if (referenceImage) {
      const imgData = await resolveReferenceImage(String(referenceImage));
      if (imgData) {
        parts.push({ inlineData: { mimeType: imgData.mimeType, data: imgData.data } });
      }
    }
    parts.push({ text: prompt });

    // Call Gemini image generation
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
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

    const responseParts = data.candidates?.[0]?.content?.parts ?? [];
    const imgPart = responseParts.find(p => p.inlineData?.data);
    const b64 = imgPart?.inlineData?.data;

    if (!b64) {
      // Return any text response as an error hint
      const textPart = responseParts.find(p => p.text);
      return NextResponse.json({
        error: 'Gemini returned no image data',
        detail: textPart?.text?.slice(0, 300),
      }, { status: 502 });
    }

    // Save PNG — to project folder if projectId provided, otherwise design/images/
    const date = new Date().toISOString().slice(0, 10);
    const fname = `${date}_${filename}.png`;
    const projectId = body.projectId as string | undefined;
    const relPath = projectId
      ? join('projects', projectId, 'images', fname)
      : join('design', 'images', fname);
    const absPath = join(LIBRARY_PATH, relPath);
    mkdirSync(join(LIBRARY_PATH, projectId ? join('projects', projectId, 'images') : join('design', 'images')), { recursive: true });
    writeFileSync(absPath, new Uint8Array(Buffer.from(b64, 'base64')));

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

    // embed_in_response: agents MUST paste this markdown verbatim into their reply.
    // Use the relative `url` only — never prepend a hostname/port.
    return NextResponse.json({
      url,
      filePath: absPath,
      markdown,
      filename: fname,
      embed_in_response: `PASTE THIS VERBATIM IN YOUR REPLY TO DISPLAY THE IMAGE:\n${markdown}`,
    });
  } catch (error) {
    console.error('POST /api/generate-image error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
