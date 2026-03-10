// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Accepts a file upload and saves it to a temp directory.
// Returns the server-side file path so the agent can read it via the Read tool.

import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdirSync, existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export const runtime = 'nodejs';

const UPLOAD_DIR = join(tmpdir(), 'froggo-chat-uploads');
const MAX_FILE_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Prune files older than MAX_FILE_AGE_MS to avoid disk accumulation
function pruneOldUploads() {
  try {
    const now = Date.now();
    for (const f of readdirSync(UPLOAD_DIR)) {
      const p = join(UPLOAD_DIR, f);
      try {
        if (now - statSync(p).mtimeMs > MAX_FILE_AGE_MS) unlinkSync(p);
      } catch { /* skip */ }
    }
  } catch { /* non-critical */ }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` }, { status: 413 });
    }

    ensureUploadDir();
    pruneOldUploads();

    // Sanitise filename — strip path separators, keep extension
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    const filename = `${Date.now()}-${safeName}`;
    const filePath = join(UPLOAD_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    writeFileSync(filePath, buffer);

    return NextResponse.json({ path: filePath, name: file.name, size: file.size, type: file.type });
  } catch (err) {
    console.error('[upload]', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
