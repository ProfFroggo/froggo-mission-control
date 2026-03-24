// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/artifacts/open-in-editor — write artifact code to temp file and open in VS Code
import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { code, lang, filename } = await request.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'code required' }, { status: 400 });
    }

    // Write to temp file
    const ext = lang || 'txt';
    const safeName = (filename || 'artifact').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const tmpDir = join(tmpdir(), 'froggo-artifacts');
    mkdirSync(tmpDir, { recursive: true });
    const filePath = join(tmpDir, `${safeName}.${ext}`);
    writeFileSync(filePath, code, 'utf-8');

    // Open in VS Code
    exec(`code "${filePath}"`, (err) => {
      if (err) console.error('[artifacts/open-in-editor] exec error:', err);
    });

    return NextResponse.json({ success: true, path: filePath });
  } catch (error) {
    console.error('POST /api/artifacts/open-in-editor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
