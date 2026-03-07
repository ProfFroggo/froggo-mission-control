import { NextRequest, NextResponse } from 'next/server';
import { validateAgentId } from '@/lib/validateId';
import path from 'path';
import fs from 'fs';

const AGENTS_DIR = path.join(process.cwd(), '.claude', 'agents');
const MAX_SOUL_BYTES = 50 * 1024; // 50KB

function getSoulPath(id: string): string {
  return path.join(AGENTS_DIR, `${id}.md`);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;
    const filePath = getSoulPath(id);

    let content = '';
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf-8');
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error('GET /api/agents/[id]/soul error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;
    const body = await request.json();
    const { content } = body;

    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'content must be a string' }, { status: 400 });
    }
    if (content.length > MAX_SOUL_BYTES) {
      return NextResponse.json(
        { error: `Soul content must be ${MAX_SOUL_BYTES / 1024}KB or fewer` },
        { status: 413 }
      );
    }

    // Ensure directory exists
    if (!fs.existsSync(AGENTS_DIR)) {
      fs.mkdirSync(AGENTS_DIR, { recursive: true });
    }

    const filePath = getSoulPath(id);
    fs.writeFileSync(filePath, content, 'utf-8');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/agents/[id]/soul error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
