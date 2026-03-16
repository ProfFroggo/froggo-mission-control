// POST /api/knowledge/ingest — Drop ANY file, Gemini reads it, saves original + .md companion
// Supports: text, PDF, images, DOCX, spreadsheets — anything Gemini can read
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { syncArticleToFilesystem } from '@/lib/knowledgeSync';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['Technical', 'Brand', 'Guidelines', 'Onboarding', 'Platform', 'Reference', 'Strategy', 'Tone', 'Customer Service'] as const;
const LIBRARY_PATH = path.join(os.homedir(), 'mission-control', 'library');

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

/** Extract raw text from DOCX/XLSX/PPTX (zip+XML) or legacy .doc (binary) */
async function extractOfficeText(buffer: Buffer, mimeType: string): Promise<string> {
  // Legacy .doc format — extract readable strings from binary
  if (mimeType === 'application/msword') {
    return extractLegacyDocText(buffer);
  }

  // Modern Office formats (DOCX/XLSX/PPTX) — zip containing XML
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
  } catch {
    // Fallback: try binary string extraction
    return extractLegacyDocText(buffer);
  }
}

/** Extract readable text from legacy .doc binary format */
function extractLegacyDocText(buffer: Buffer): string {
  // Legacy .doc stores text as runs of printable characters in the binary
  // Scan for contiguous ASCII/UTF-8 runs of 4+ chars
  const chunks: string[] = [];
  let current = '';

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    // Printable ASCII range + common extended chars
    if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13 || byte === 9) {
      current += String.fromCharCode(byte);
    } else {
      if (current.trim().length >= 4) {
        chunks.push(current.trim());
      }
      current = '';
    }
  }
  if (current.trim().length >= 4) chunks.push(current.trim());

  // Filter out binary noise (strings that look like metadata/format codes)
  const filtered = chunks.filter(c =>
    c.length > 8 &&
    !/^[A-Z]{2,}$/.test(c) && // skip all-caps format codes
    !/^[\x00-\x1f]+$/.test(c) && // skip control chars
    /[a-zA-Z]{3,}/.test(c) && // must contain actual words
    !/^(MSWordDoc|Word\.Document|Microsoft|Normal\.dot|PBrook|Times New Roman)/i.test(c) // skip known metadata
  );

  return filtered.join('\n') || '(Could not extract text from legacy .doc format)';
}

async function getGeminiKey(): Promise<string | null> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet('gemini_api_key');
    if (val) return val;
  } catch { /* ignore */ }
  return process.env.GEMINI_API_KEY ?? null;
}

interface GeminiAnalysis {
  title: string;
  category: string;
  tags: string[];
  summary: string;
  scope: 'all' | 'agents' | 'human';
  extractedContent: string;
}

async function analyzeWithGemini(
  parts: Array<Record<string, unknown>>,
  filename: string,
  apiKey: string
): Promise<GeminiAnalysis> {
  // Step 1: Get metadata (title, category, tags, summary)
  const metaParts = [...parts, { text: `Analyze this file and return a JSON object with:
- "title": A clear, descriptive title (not the filename)
- "category": One of: ${CATEGORIES.join(', ')}
- "tags": Array of 3-8 relevant tags (lowercase, hyphens)
- "summary": 1-2 sentence summary
- "scope": "all" (everyone), "agents" (agent-only), or "human" (human-only)

Filename: ${filename}
Return ONLY valid JSON, no markdown fences.` }];

  const metaRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: metaParts }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
    }
  );

  if (!metaRes.ok) {
    const err = await metaRes.text();
    throw new Error(`Gemini API error: ${metaRes.status} ${err.slice(0, 200)}`);
  }

  const metaData = await metaRes.json();
  const metaText = metaData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const metaCleaned = metaText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const meta = JSON.parse(metaCleaned) as Omit<GeminiAnalysis, 'extractedContent'>;

  meta.category = meta.category.toLowerCase();
  const validCats = CATEGORIES.map(c => c.toLowerCase());
  if (!validCats.includes(meta.category)) {
    meta.category = 'reference';
  }

  // Step 2: Full document rewrite as markdown (separate call, full token budget)
  const rewriteParts = [...parts, { text: `Rewrite this entire document as a clean, well-structured markdown document.

Rules:
- Convert ALL content — every heading, paragraph, list, table, footnote, caption
- Use proper markdown: # headings, **bold**, *italic*, - lists, | tables |
- Preserve the document's structure and hierarchy
- Do NOT summarize or skip sections — include EVERYTHING
- For tables: use markdown table format with | separators
- For images/figures: describe them in [brackets]
- Output ONLY the markdown document, no JSON, no explanation

This is the COMPLETE rewrite — if the original has 10 pages, your output should cover all 10 pages.` }];

  const rewriteRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: rewriteParts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500000 },
      }),
    }
  );

  let extractedContent = '';
  if (rewriteRes.ok) {
    const rewriteData = await rewriteRes.json();
    extractedContent = rewriteData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  }

  return { ...meta, extractedContent };
}

function saveOriginalFile(buffer: Buffer, filename: string, category: string): string {
  const categoryDir = path.join(LIBRARY_PATH, 'docs', category.toLowerCase().replace(/\s+/g, '-'));
  fs.mkdirSync(categoryDir, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const savedName = `${date}_${safeName}`;
  const savedPath = path.join(categoryDir, savedName);

  fs.writeFileSync(savedPath, new Uint8Array(buffer));
  return savedPath;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    let fileBuffer: Buffer;
    let filename: string;
    let mimeType: string;
    let textContent: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
      }
      const arrayBuf = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuf);
      filename = file.name;
      mimeType = file.type || 'application/octet-stream';

      // For text files, also get raw text
      if (mimeType.startsWith('text/') || mimeType === 'application/json') {
        textContent = new TextDecoder().decode(fileBuffer);
      }
    } else {
      const body = await req.json();
      if (!body.content?.trim()) {
        return NextResponse.json({ success: false, error: 'content is required' }, { status: 400 });
      }
      textContent = body.content;
      filename = body.filename || 'untitled.md';
      mimeType = 'text/markdown';
      fileBuffer = Buffer.from(textContent!);
    }

    // Get Gemini API key
    const apiKey = await getGeminiKey();
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Gemini API key not configured.' }, { status: 400 });
    }

    // Extract text from Office docs before sending to Gemini
    if (!textContent && OFFICE_TYPES.has(mimeType)) {
      textContent = await extractOfficeText(fileBuffer, mimeType);
    }

    // Build Gemini parts — send file as inline data or text
    const parts: Array<Record<string, unknown>> = [];

    if (textContent) {
      // Text-based file — send as text
      parts.push({ text: `File content:\n${textContent.slice(0, 30000)}` });
    } else if (GEMINI_INLINE_TYPES.has(mimeType) && fileBuffer.length < 20 * 1024 * 1024) {
      // Binary file Gemini can read inline (PDF, images)
      parts.push({
        inlineData: {
          mimeType,
          data: fileBuffer.toString('base64'),
        },
      });
    } else {
      // Unsupported binary — try File API upload
      try {
        const uploadRes = await fetch(
          `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': mimeType,
              'X-Goog-Upload-Protocol': 'raw',
              'X-Goog-Upload-Command': 'upload, finalize',
            },
            body: new Uint8Array(fileBuffer),
          }
        );
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          const fileUri = uploadData?.file?.uri;
          if (fileUri) {
            // Wait for processing
            for (let i = 0; i < 10; i++) {
              const check = await fetch(`${fileUri}?key=${apiKey}`);
              if (check.ok && (await check.json()).state === 'ACTIVE') break;
              await new Promise(r => setTimeout(r, 2000));
            }
            parts.push({ fileData: { mimeType, fileUri } });
          }
        }
      } catch { /* fall through to text-only */ }

      if (parts.length === 0) {
        return NextResponse.json({ success: false, error: `Unsupported file type: ${mimeType}` }, { status: 400 });
      }
    }

    // Analyze with Gemini
    const analysis = await analyzeWithGemini(parts, filename, apiKey);

    // Save original file to library
    const originalPath = saveOriginalFile(fileBuffer, filename, analysis.category);
    const relativePath = path.relative(os.homedir(), originalPath);

    // Build companion .md — clean content, no YAML frontmatter (metadata stays in DB)
    const mdContent = [
      `> **Source:** \`${filename}\` — [Open file](file://~/${relativePath})`,
      ``,
      analysis.summary,
      ``,
      `---`,
      ``,
      analysis.extractedContent || textContent?.slice(0, 10000) || '*No content extracted*',
    ].join('\n');

    // Save to database
    const db = getDb();
    const now = Date.now();
    const id = `kb-${now}-${Math.random().toString(36).slice(2, 7)}`;

    db.prepare(`
      INSERT INTO knowledge_base (id, title, content, category, tags, scope, pinned, version, createdBy, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, 0, 1, 'gemini-ingest', ?, ?)
    `).run(id, analysis.title, mdContent, analysis.category, JSON.stringify(analysis.tags), analysis.scope, now, now);

    // Sync .md to filesystem
    syncArticleToFilesystem({
      id,
      title: analysis.title,
      content: mdContent,
      category: analysis.category,
      tags: analysis.tags,
      scope: analysis.scope,
      createdBy: 'gemini-ingest',
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      id,
      originalPath,
      analysis: {
        title: analysis.title,
        category: analysis.category,
        tags: analysis.tags,
        summary: analysis.summary,
        scope: analysis.scope,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[knowledge/ingest] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
