// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { homedir } from 'os';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HR_DIR = path.join(homedir(), 'mission-control', 'library', 'docs', 'hr');
const TRAINING_DIR = path.join(HR_DIR, 'training');
const REPORTS_DIR = path.join(HR_DIR, 'reports');
// Legacy fallback
const RESEARCH_DIR = path.join(homedir(), 'mission-control', 'library', 'docs', 'research');

function isSafeFilename(name: string): boolean {
  // No path separators, no dotdot, must be .md
  return (
    !name.includes('/') &&
    !name.includes('\\') &&
    !name.includes('..') &&
    name.endsWith('.md')
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const file = searchParams.get('file');
  const typeFilter = searchParams.get('type'); // 'training', 'reports', or null (all)

  // Ensure directories exist
  for (const dir of [TRAINING_DIR, REPORTS_DIR]) {
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch { /* */ }
    }
  }

  // Single file read mode
  if (file) {
    if (!isSafeFilename(file)) {
      return NextResponse.json({ error: 'Invalid filename.' }, { status: 400 });
    }
    // Search in training, reports, and legacy research dirs
    for (const dir of [TRAINING_DIR, REPORTS_DIR, RESEARCH_DIR]) {
      const filePath = path.join(dir, file);
      if (fs.existsSync(filePath)) {
        try {
          return NextResponse.json({ name: file, content: fs.readFileSync(filePath, 'utf-8') });
        } catch { /* try next */ }
      }
    }
    return NextResponse.json({ error: 'File not found.' }, { status: 404 });
  }

  // Directory listing — scan training + reports + legacy research
  const allFiles: Array<{ name: string; path: string; size: number; createdAt: string; modifiedAt: string; type: string }> = [];

  const scanDir = (dir: string, fileType: string) => {
    if (!fs.existsSync(dir)) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
        const filePath = path.join(dir, entry.name);
        try {
          const stat = fs.statSync(filePath);
          allFiles.push({
            name: entry.name,
            path: filePath,
            size: stat.size,
            createdAt: stat.birthtime.toISOString(),
            modifiedAt: stat.mtime.toISOString(),
            type: fileType,
          });
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  };

  if (!typeFilter || typeFilter === 'training') scanDir(TRAINING_DIR, 'training-log');
  if (!typeFilter || typeFilter === 'reports') scanDir(REPORTS_DIR, 'weekly-report');

  allFiles.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
  return NextResponse.json(allFiles);
}
