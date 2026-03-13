// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/remove-background
// Removes the background from an image using rembg (birefnet-hd) and saves an
// optimised transparent PNG back to the library.

import { NextRequest, NextResponse } from 'next/server';
import { mkdirSync, existsSync } from 'fs';
import { join, basename, extname, dirname } from 'path';
import { spawn } from 'child_process';
import { getDb } from '@/lib/database';
import { resolveLibraryPath } from '@/lib/apiAuth';
import { ENV } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Inline Python script — removes background with rembg birefnet-hd + alpha matting, saves optimised PNG. */
const PYTHON_SCRIPT = `
import sys, io
from rembg import remove, new_session
from PIL import Image

input_path  = sys.argv[1]
output_path = sys.argv[2]
model       = sys.argv[3] if len(sys.argv) > 3 else 'birefnet-hd'

session = new_session(model)

with open(input_path, 'rb') as f:
    raw = f.read()

result_bytes = remove(
    raw,
    session=session,
    alpha_matting=True,
    alpha_matting_foreground_threshold=240,
    alpha_matting_background_threshold=10,
    alpha_matting_erode_size=10,
)

img = Image.open(io.BytesIO(result_bytes)).convert("RGBA")
img.save(output_path, "PNG", optimize=True, compress_level=9)
print("ok")
`.trim();

/** Run the Python cutout script, resolve when done, reject on error/timeout. */
function runPythonCutout(inputAbs: string, outputAbs: string, model: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', ['-c', PYTHON_SCRIPT, inputAbs, outputAbs, model]);
    let stderr = '';
    py.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    const timer = setTimeout(() => {
      py.kill();
      reject(new Error('Background removal timed out after 120s'));
    }, 120_000);
    py.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`rembg exited ${code}: ${stderr.slice(0, 400)}`));
    });
    py.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const inputPath = String(body.inputPath ?? '').trim();
    const agentId   = String(body.agentId   ?? 'unknown');
    const model     = String(body.model     ?? 'birefnet-hd');

    if (!inputPath) {
      return NextResponse.json({ error: 'inputPath is required' }, { status: 400 });
    }

    const inputAbs = resolveLibraryPath(inputPath);
    if (!inputAbs) {
      return NextResponse.json({ error: `File not found or path not allowed: ${inputPath}` }, { status: 404 });
    }

    // Build output path: same dir as input, _cutout suffix, .png
    const base     = basename(inputAbs, extname(inputAbs));
    const outDir   = dirname(inputAbs);
    const outName  = `${base}_cutout.png`;
    const outputAbs = join(outDir, outName);
    mkdirSync(outDir, { recursive: true });

    await runPythonCutout(inputAbs, outputAbs, model);

    if (!existsSync(outputAbs)) {
      return NextResponse.json({ error: 'Output file was not created' }, { status: 500 });
    }

    // Register in library_files DB
    const relPath = outputAbs.startsWith(ENV.LIBRARY_PATH)
      ? outputAbs.slice(ENV.LIBRARY_PATH.length + 1)
      : outputAbs;
    const fileId = `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      const db = getDb();
      db.prepare(
        `INSERT OR IGNORE INTO library_files (id, name, path, category, createdAt) VALUES (?, ?, ?, ?, ?)`
      ).run(fileId, outName, outputAbs, 'image', Date.now());
    } catch { /* non-critical */ }

    // Build URL for embedding in chat
    const encodedId = Buffer.from(relPath).toString('base64url');
    const url       = `/api/library?action=raw&id=${encodedId}`;
    const markdown  = `![${outName}](${url})`;

    return NextResponse.json({ url, filePath: outputAbs, markdown, filename: outName });
  } catch (error: any) {
    console.error('POST /api/remove-background error:', error);
    return NextResponse.json({ error: error.message ?? 'Internal server error' }, { status: 500 });
  }
}
