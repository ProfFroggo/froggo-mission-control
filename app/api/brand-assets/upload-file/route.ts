// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/brand-assets/upload-file — save one file to disk, return its path.
// Metadata passed as query params to avoid FormData body-size limits.
// No DB record created here. ingest-folder handles the single folder record.
import { NextRequest, NextResponse } from 'next/server';
import { brandAssetDir } from '@/lib/brandAssetPaths';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const folderName = searchParams.get('folderName')?.trim() || 'Uploads';
    const category   = searchParams.get('category')?.trim()   || 'other';
    const filename   = path.basename(searchParams.get('filename') || 'file');

    if (!req.body) return NextResponse.json({ success: false, error: 'No body' }, { status: 400 });

    const saveDir = brandAssetDir(category, folderName);
    fs.mkdirSync(saveDir, { recursive: true });

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(saveDir, safeName);

    // Stream to disk with size limit to prevent disk exhaustion
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    let bytesWritten = 0;
    const writer = fs.createWriteStream(filePath);
    const reader = req.body.getReader();
    await new Promise<void>((resolve, reject) => {
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) { writer.end(); break; }
            bytesWritten += value.byteLength;
            if (bytesWritten > MAX_FILE_SIZE) {
              writer.destroy();
              try { fs.unlinkSync(filePath); } catch { /* cleanup best-effort */ }
              reject(new Error(`File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`));
              return;
            }
            if (!writer.write(value)) await new Promise(r => writer.once('drain', r));
          }
          writer.on('finish', resolve);
          writer.on('error', reject);
        } catch (err) { reject(err); }
      };
      pump();
    });

    return NextResponse.json({ success: true, filePath, filename: safeName });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[brand-assets/upload-file]', msg);
    // Return size-limit errors to client (user-actionable), sanitize everything else
    const isUserError = msg.includes('limit');
    return NextResponse.json({ success: false, error: isUserError ? msg : 'Upload failed' }, { status: isUserError ? 413 : 500 });
  }
}
