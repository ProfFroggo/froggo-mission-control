import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { homedir } from 'os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

function getProjectLibDir(id: string) {
  return join(homedir(), 'mission-control', 'library', 'projects', id);
}

// GET /api/projects/:id/files — list files in project library folder
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const dir = getProjectLibDir(id);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      return NextResponse.json([]);
    }

    const entries = readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isFile())
      .map(e => {
        const filePath = join(dir, e.name);
        const stat = statSync(filePath);
        return {
          name: e.name,
          path: filePath,
          size: stat.size,
          type: extname(e.name).slice(1) || 'file',
          modifiedAt: stat.mtimeMs,
        };
      })
      .sort((a, b) => b.modifiedAt - a.modifiedAt);

    return NextResponse.json(entries);
  } catch (error) {
    console.error('GET /api/projects/:id/files error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/:id/files — upload a file (base64 encoded body)
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { name, content, encoding = 'utf-8' } = await request.json();

    if (!name || !content) {
      return NextResponse.json({ error: 'name and content required' }, { status: 400 });
    }

    // Sanitize filename
    const safeName = name.replace(/[^a-zA-Z0-9._\- ]/g, '_');
    const dir = getProjectLibDir(id);
    mkdirSync(dir, { recursive: true });

    const filePath = join(dir, safeName);
    if (encoding === 'base64') {
      writeFileSync(filePath, Buffer.from(content, 'base64'));
    } else {
      writeFileSync(filePath, content, 'utf-8');
    }

    const stat = statSync(filePath);
    return NextResponse.json({
      name: safeName,
      path: filePath,
      size: stat.size,
      type: extname(safeName).slice(1) || 'file',
      modifiedAt: stat.mtimeMs,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/:id/files error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
