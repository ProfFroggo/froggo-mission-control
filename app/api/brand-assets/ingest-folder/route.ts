// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/brand-assets/ingest-folder
// Receives { folderName, category, files: [{filePath, filename}] }
// Reads all files, sends to Gemini, writes ONE .md to knowledge vault,
// creates ONE KB article + ONE brand_asset folder record.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { brandAssetDir, brandAssetKnowledgePath } from '@/lib/brandAssetPaths';
import { geminiPost } from '@/lib/geminiClient';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// ── File classification ───────────────────────────────────────────────────────

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic']);
const TEXT_EXTS = new Set([
  'md', 'mdx', 'txt', 'html', 'htm', 'css', 'scss',
  'js', 'jsx', 'ts', 'tsx', 'json', 'yaml', 'yml',
  'xml', 'svg', 'csv', 'sh', 'py', 'prompt', 'toml',
]);
const IMAGE_MIMES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', heic: 'image/heic',
};

interface FileEntry { filename: string; kind: 'image'|'pdf'|'text'|'binary'; mimeType: string; buffer?: Buffer; content?: string; }

function classifyFile(filename: string, buf: Buffer): FileEntry {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (IMAGE_EXTS.has(ext)) return { filename, kind: 'image', mimeType: IMAGE_MIMES[ext] ?? 'image/png', buffer: buf };
  if (ext === 'pdf') return { filename, kind: 'pdf', mimeType: 'application/pdf', buffer: buf };
  if (TEXT_EXTS.has(ext)) return { filename, kind: 'text', mimeType: 'text/plain', content: buf.toString('utf-8').slice(0, 10_000) };
  return { filename, kind: 'binary', mimeType: 'application/octet-stream' };
}

// ── Gemini ────────────────────────────────────────────────────────────────────

async function getGeminiKey(): Promise<string | null> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet('gemini_api_key');
    if (val) return val;
  } catch { /* ignore */ }
  return process.env.GEMINI_API_KEY ?? null;
}

async function geminiCall(parts: Array<Record<string, unknown>>, apiKey: string, maxTokens: number, temp: number): Promise<string> {
  const res = await geminiPost('gemini-3.1-flash-lite-preview', apiKey, {
    contents: [{ parts }],
    generationConfig: { temperature: temp, maxOutputTokens: maxTokens },
  });
  if (!res.ok) throw new Error(`Gemini error: ${res.status} — ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function toGeminiParts(files: FileEntry[]): Array<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = [];
  for (const f of files) {
    parts.push({ text: `\n--- ${f.filename} (${f.kind}) ---` });
    if ((f.kind === 'image' || f.kind === 'pdf') && f.buffer)
      parts.push({ inlineData: { mimeType: f.mimeType, data: f.buffer.toString('base64') } });
    else if (f.kind === 'text' && f.content)
      parts.push({ text: f.content });
    else
      parts.push({ text: `[Binary — ${f.mimeType}]` });
  }
  return parts;
}

// ── Generate the .md ──────────────────────────────────────────────────────────

async function generateCatalog(
  files: FileEntry[],
  folderName: string,
  category: string,
  libraryPath: string,
  isSingle: boolean,
  apiKey: string
): Promise<string> {
  const geminiParts = toGeminiParts(files);
  const fileList = files.map(f => `${f.filename} (${f.kind})`).join('\n');

  const prompt = isSingle ? `
You are writing a knowledge base entry for a single asset.
File: "${files[0]?.filename}" | Category: ${category}
Library path: \`${libraryPath}\`

Describe:
- What this file is and what it contains
- Visual description if it's an image (colors, style, composition, hex values if apparent)
- Purpose and intended use
- How an AI agent would use this file

Do NOT use markdown image syntax. Text only.
Output ONLY the markdown content (no title).`
  : `
You are writing a knowledge base article for a folder of brand assets.
Folder: "${folderName}" | Category: ${category}
Library: \`${libraryPath}/\`

Files:
${fileList}

Write a comprehensive article covering:
- Purpose: what this collection enables, what an agent does with it
- How to use: step-by-step for an agent
- Agent use cases: specific tasks this enables
- Files: for each file — what it is, visual description if image (colors, style, hex values), content if text/template, how an agent uses it
- Integration notes: how the files work together

Do NOT use markdown image syntax. Text only.
Output ONLY the markdown content (no title, no front matter).`;

  const content = await geminiCall([...geminiParts, { text: prompt }], apiKey, 65536, 0.2);

  const title = isSingle ? (files[0]?.filename.replace(/\.[^.]+$/, '') ?? folderName) : folderName;
  const libraryRef = isSingle ? `\`${libraryPath}\`` : `\`${libraryPath}/\``;

  return [
    `# ${title}`,
    '',
    `**Category:** ${category}  `,
    `**Library:** ${libraryRef}  `,
    isSingle ? '' : `**Files:** ${files.length}`,
    '',
    content.trim(),
    '',
    '---',
    `*Cataloged from \`${folderName}\`*`,
  ].join('\n');
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      folderName?: string;
      category?: string;
      files?: Array<{ filePath: string; filename: string }>;
    };
    const { folderName = 'Uploads', category = 'other', files = [] } = body;

    if (files.length === 0) return NextResponse.json({ success: false, error: 'No files provided' }, { status: 400 });

    const apiKey = await getGeminiKey();
    if (!apiKey) return NextResponse.json({ success: false, error: 'Gemini API key not configured.' }, { status: 400 });

    // Read and classify files from disk
    const entries: FileEntry[] = [];
    for (const { filePath, filename } of files) {
      if (!fs.existsSync(filePath)) continue;
      const buf = fs.readFileSync(filePath);
      if (buf.length > 15 * 1024 * 1024) continue; // skip >15MB
      entries.push(classifyFile(filename, buf));
    }

    if (entries.length === 0) return NextResponse.json({ success: false, error: 'No readable files found' }, { status: 400 });

    // Cap inline files
    const inlineFiles = entries.filter(f => f.kind === 'image' || f.kind === 'pdf').slice(0, 20);
    const textFiles = entries.filter(f => f.kind === 'text');
    const others = entries.filter(f => f.kind === 'binary').map(f => ({ ...f, content: '[Binary]' } as FileEntry));
    const batchFiles = [...inlineFiles, ...textFiles, ...others];

    const isSingle = files.length === 1;
    const libDir = brandAssetDir(category, isSingle ? '' : folderName);
    const libPath = isSingle
      ? path.join(brandAssetDir(category, ''), files[0].filename)
      : libDir.replace(/\/$/, '');

    // Generate catalog .md
    const mdContent = await generateCatalog(batchFiles, folderName, category, libPath, isSingle, apiKey);

    // Write .md to knowledge vault
    const kbName = isSingle ? files[0].filename.replace(/\.[^.]+$/, '') : folderName;
    const catalogPath = brandAssetKnowledgePath(category, kbName);
    fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
    fs.writeFileSync(catalogPath, mdContent, 'utf-8');

    // Save to knowledge_base table
    const now = Date.now();
    const kbId = `kb-${now}-${Math.random().toString(36).slice(2, 7)}`;
    const kbTags = ['brand-assets', category, kbName.toLowerCase().replace(/\s+/g, '-')];

    const db = getDb();
    db.prepare(`
      INSERT INTO knowledge_base (id, title, content, category, tags, scope, pinned, version, createdBy, createdAt, updatedAt)
      VALUES (?, ?, ?, 'brand', ?, 'all', 0, 1, 'folder-ingest', ?, ?)
    `).run(kbId, kbName, mdContent, JSON.stringify(kbTags), now, now);

    // ONE brand_asset record for the folder/file
    const assetId = `ba-${now}-${Math.random().toString(36).slice(2, 7)}`;
    db.prepare(`
      INSERT INTO brand_assets (id, name, description, category, fileType, fileName, filePath, url, tags, scope, folder_name, createdBy, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'all', ?, 'folder-ingest', ?, ?)
    `).run(
      assetId, kbName,
      `${files.length} file${files.length !== 1 ? 's' : ''} · ${category}`,
      category,
      'folder',
      isSingle ? files[0].filename : `${files.length} files`,
      libPath, kbId,
      JSON.stringify(kbTags),
      folderName, now, now
    );

    return NextResponse.json({ success: true, folderName, fileCount: files.length, kbArticleId: kbId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[brand-assets/ingest-folder]', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
