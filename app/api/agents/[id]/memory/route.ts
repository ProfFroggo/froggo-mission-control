// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { validateAgentId } from '@/lib/validateId';
import { ENV } from '@/lib/env';
import path from 'path';
import fs from 'fs';
import { homedir } from 'os';
import { getDb } from '@/lib/database';

export const runtime = 'nodejs';

const HOME = homedir();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;

    const agentDir = path.join(HOME, 'mission-control', 'memory', 'agents', id);

    if (!fs.existsSync(agentDir)) {
      return NextResponse.json({ count: 0, recent: [] });
    }

    const files = fs.readdirSync(agentDir)
      .filter(f => f.endsWith('.md') && !f.startsWith('_'))
      .sort().reverse().slice(0, 5);

    return NextResponse.json({ count: files.length, recent: files });
  } catch (error) {
    console.error('GET /api/agents/[id]/memory error:', error);
    return NextResponse.json({ count: 0, recent: [] });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = validateAgentId(id);
    if (guard) return guard;

    const db = getDb();
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as { name: string } | undefined;
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Agent memory files live at ~/mission-control/agents/{id}/MEMORY.md
    const agentsDir = path.join(ENV.VAULT_PATH, '..', 'agents');
    const agentDir = path.join(agentsDir, id);
    const memoryPath = path.join(agentDir, 'MEMORY.md');

    // Ensure directory exists
    if (!fs.existsSync(agentDir)) {
      return NextResponse.json({ error: 'Agent memory directory not found' }, { status: 404 });
    }

    // Read current MEMORY.md
    let currentContent = '';
    if (fs.existsSync(memoryPath)) {
      currentContent = fs.readFileSync(memoryPath, 'utf-8');
    }

    // Archive with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const archivePath = path.join(agentDir, `MEMORY_archive_${timestamp}.md`);
    if (currentContent) {
      fs.writeFileSync(archivePath, currentContent, 'utf-8');
    }

    // Write fresh MEMORY.md with agent identity header
    const freshContent = `# ${agent.name} Memory\n\n<!-- Memory rotated ${new Date().toISOString()} -->\n\n## Identity\n- Agent ID: ${id}\n- Role: ${agent.name}\n\n## Current Focus\n<!-- Active work and context goes here -->\n`;
    fs.writeFileSync(memoryPath, freshContent, 'utf-8');

    return NextResponse.json({
      success: true,
      archivedTo: archivePath,
      rotatedAt: Date.now(),
    });
  } catch (error) {
    console.error('POST /api/agents/[id]/memory error:', error);
    return NextResponse.json({ error: 'Failed to rotate memory' }, { status: 500 });
  }
}
