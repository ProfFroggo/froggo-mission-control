import { NextRequest, NextResponse } from 'next/server';
import { homedir } from 'os';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RESEARCH_DIR = path.join(homedir(), 'mission-control', 'library', 'docs', 'research');

function isTrainingLog(name: string): boolean {
  return name.includes('hr_training-log');
}

function isWeeklyReport(name: string): boolean {
  return name.includes('hr_weekly-report');
}

function matchesFilter(name: string): boolean {
  return isTrainingLog(name) || isWeeklyReport(name);
}

function isSafeFilename(name: string): boolean {
  // No path separators, no dotdot, must match hr_*.md pattern
  return (
    !name.includes('/') &&
    !name.includes('\\') &&
    !name.includes('..') &&
    /^[^/\\]+hr_[^/\\]+\.md$/.test(name)
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const file = searchParams.get('file');

  // Ensure the research directory exists
  if (!fs.existsSync(RESEARCH_DIR)) {
    try {
      fs.mkdirSync(RESEARCH_DIR, { recursive: true });
    } catch {
      // If we can't create it, we'll just return empty/error below
    }
  }

  // Single file read mode
  if (file) {
    if (!isSafeFilename(file)) {
      return NextResponse.json(
        { error: 'Invalid filename. Only hr_*.md files are allowed.' },
        { status: 400 }
      );
    }

    const filePath = path.join(RESEARCH_DIR, file);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return NextResponse.json({ name: file, content });
    } catch {
      return NextResponse.json({ error: 'Failed to read file.' }, { status: 500 });
    }
  }

  // Directory listing mode
  if (!fs.existsSync(RESEARCH_DIR)) {
    return NextResponse.json([]);
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(RESEARCH_DIR, { withFileTypes: true });
  } catch {
    return NextResponse.json([]);
  }

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && matchesFilter(entry.name))
    .map((entry) => {
      const filePath = path.join(RESEARCH_DIR, entry.name);
      let size = 0;
      let createdAt = new Date().toISOString();
      let modifiedAt = new Date().toISOString();

      try {
        const stat = fs.statSync(filePath);
        size = stat.size;
        createdAt = stat.birthtime.toISOString();
        modifiedAt = stat.mtime.toISOString();
      } catch {
        // Use defaults if stat fails
      }

      const type: 'training-log' | 'weekly-report' = isWeeklyReport(entry.name)
        ? 'weekly-report'
        : 'training-log';

      return {
        name: entry.name,
        path: filePath,
        size,
        createdAt,
        modifiedAt,
        type,
      };
    })
    .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

  return NextResponse.json(files);
}
