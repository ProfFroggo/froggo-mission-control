// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/context-files/upload — upload a file as context for a project or campaign
// Accepts multipart/form-data: file, entityType (project|campaign), entityId
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// MIME types Gemini can process as inline data
const GEMINI_INLINE_TYPES = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic',
  'text/plain', 'text/markdown', 'text/csv', 'text/html',
  'application/json',
]);

// MIME types that are Office docs — extract text via XML/zip
const OFFICE_TYPES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
]);

async function getGeminiKey(): Promise<string | null> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet('gemini_api_key');
    if (val) return val;
  } catch (err) { console.warn('[context-files/upload] Non-critical:', err); }
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'gemini_api_key'").get() as { value: string } | undefined;
    if (row?.value) return row.value;
  } catch (err) { console.warn('[context-files/upload] Non-critical:', err); }
  return null;
}

/** Extract raw text from DOCX/XLSX/PPTX (zip+XML) or legacy .doc (binary) */
async function extractOfficeText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/msword') {
    return extractLegacyDocText(buffer);
  }
  try {
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    const textParts: string[] = [];
    for (const entry of entries) {
      const name = entry.entryName;
      if (name.endsWith('.xml') && (name.includes('document') || name.includes('sheet') || name.includes('slide'))) {
        const xml = entry.getData().toString('utf-8');
        const text = xml
          .replace(/<w:br[^>]*\/>/g, '\n')
          .replace(/<w:p[^>]*>/g, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        if (text) textParts.push(text);
      }
    }
    return textParts.join('\n\n') || extractLegacyDocText(buffer);
  } catch (err) {
    console.warn('[context-files/upload] Non-critical:', err);
    return extractLegacyDocText(buffer);
  }
}

function extractLegacyDocText(buffer: Buffer): string {
  const chunks: string[] = [];
  let current = '';
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13 || byte === 9) {
      current += String.fromCharCode(byte);
    } else {
      if (current.trim().length >= 4) chunks.push(current.trim());
      current = '';
    }
  }
  if (current.trim().length >= 4) chunks.push(current.trim());
  const filtered = chunks.filter(c =>
    c.length > 8 &&
    !/^[A-Z]{2,}$/.test(c) &&
    !/^[\x00-\x1f]+$/.test(c) &&
    /[a-zA-Z]{3,}/.test(c) &&
    !/^(MSWordDoc|Word\.Document|Microsoft|Normal\.dot|PBrook|Times New Roman)/i.test(c)
  );
  return filtered.join('\n') || '(Could not extract text from legacy .doc format)';
}

async function processWithGemini(
  parts: Array<Record<string, unknown>>,
  fileType: string,
  apiKey: string
): Promise<{ processedContent: string; summary: string }> {
  const systemPrompt = fileType === 'image'
    ? `Analyze this image and produce a detailed reference document for AI design agents.

Structure your response as:

## Visual Overview
A 2-3 sentence description of what this image shows at a glance.

## Composition & Layout
- Layout structure, framing, use of space
- Focal points and visual hierarchy

## Color Palette
- Primary colors (hex or descriptive)
- Secondary/accent colors
- Overall tone (warm/cool/neutral, light/dark)

## Typography
- Any visible text, fonts, styles, sizes
- Text placement and hierarchy

## Style & Mood
- Visual style (e.g. minimalist, bold, editorial, corporate, playful)
- Mood and emotional tone
- Design language or aesthetic references

## Key Elements
- Logos, icons, UI components, photography style, illustration style
- Any recognizable brand elements or design patterns

## Design Agent Notes
Specific guidance for an AI generating assets inspired by this: what to replicate, what colors to use, what style to target.

Return only the markdown. No fences. Be thorough — this will guide all AI asset generation for this project.`
    : `Process this file and create a detailed context document that AI agents can use as a reference.

For documents: Extract all content, structure it clearly as markdown with headers, bullets, and tables.
For HTML: Extract visible text content (ignore HTML/CSS source).
For spreadsheets/CSVs: Format data as clean markdown tables.

This context will be attached to a project or campaign and shared with all AI agents working on it.
Return only the markdown content, no fences.`;

  const rewriteParts = [...parts, { text: systemPrompt }];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: rewriteParts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 16384 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const processedContent = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

  // Generate a short summary (first 2 sentences or 200 chars)
  const summary = processedContent.split('\n').filter((l: string) => l.trim()).slice(0, 2).join(' ').slice(0, 200);

  return { processedContent, summary };
}

export async function POST(req: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (err) {
      console.warn('[context-files/upload] Non-critical:', err);
      return NextResponse.json({ success: false, error: 'Failed to read upload — ensure file is sent as multipart/form-data' }, { status: 400 });
    }
    const file = formData.get('file') as File | null;
    const entityType = formData.get('entityType') as string | null;
    const entityId = formData.get('entityId') as string | null;

    if (!file) return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });

    // Enforce file size limit to prevent disk exhaustion
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` }, { status: 413 });
    }
    if (!entityType || !['project', 'campaign'].includes(entityType)) {
      return NextResponse.json({ success: false, error: 'entityType must be project or campaign' }, { status: 400 });
    }
    if (!entityId) return NextResponse.json({ success: false, error: 'entityId is required' }, { status: 400 });

    const arrayBuf = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuf);
    const originalName = file.name;
    const mimeType = file.type || 'application/octet-stream';
    const fileSize = fileBuffer.length;

    // Determine fileType
    let fileType = 'document';
    if (mimeType.startsWith('image/')) fileType = 'image';
    else if (mimeType.startsWith('video/')) fileType = 'video';

    // Generate ID
    const now = Date.now();
    const id = `ctx-${now}-${Math.random().toString(36).slice(2, 7)}`;

    // Save file to disk
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    const contextDir = path.join(os.homedir(), 'mission-control', 'library', 'context', entityType, entityId);
    fs.mkdirSync(contextDir, { recursive: true });
    const fileName = `${id}-${safeName}`;
    const filePath = path.join(contextDir, fileName);
    fs.writeFileSync(filePath, new Uint8Array(fileBuffer));

    // Process with Gemini (skip for video)
    let processedContent: string | null = null;
    let summary: string | null = null;
    let processedAt: number | null = null;

    if (fileType !== 'video') {
      const apiKey = await getGeminiKey();
      if (apiKey) {
        try {
          // Build Gemini parts
          const parts: Array<Record<string, unknown>> = [];
          let textContent: string | null = null;

          if (mimeType.startsWith('text/') || mimeType === 'application/json') {
            textContent = new TextDecoder().decode(fileBuffer);
          } else if (OFFICE_TYPES.has(mimeType)) {
            textContent = await extractOfficeText(fileBuffer, mimeType);
          }

          if (textContent) {
            parts.push({ text: `File content:\n${textContent}` });
          } else if (GEMINI_INLINE_TYPES.has(mimeType) && fileBuffer.length < 20 * 1024 * 1024) {
            parts.push({
              inlineData: {
                mimeType,
                data: fileBuffer.toString('base64'),
              },
            });
          }

          if (parts.length > 0) {
            const result = await processWithGemini(parts, fileType, apiKey);
            processedContent = result.processedContent;
            summary = result.summary;
            processedAt = Date.now();
          }
        } catch (geminiErr) {
          console.warn('[context-files/upload] Gemini processing failed:', geminiErr);
          // Continue without processing — file is still saved
        }
      }
    } else {
      // Video: store metadata summary
      summary = `Video file: ${originalName} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`;
    }

    // Save to DB
    const db = getDb();
    db.prepare(`
      INSERT INTO context_files (id, entityType, entityId, originalName, filePath, fileType, mimeType, fileSize, processedContent, summary, createdAt, processedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, entityType, entityId, originalName, filePath, fileType, mimeType, fileSize, processedContent, summary, now, processedAt);

    const record = db.prepare('SELECT * FROM context_files WHERE id = ?').get(id);
    return NextResponse.json({ success: true, file: record });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[context-files/upload] Error:', msg);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
