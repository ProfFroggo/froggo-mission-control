// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/marketplace/install — receive and install a marketplace package
// Called by the gateway when a user purchases an agent or module.
// Auth: INTERNAL_API_TOKEN required.

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { ENV } from '@/lib/env';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

interface AgentPackage {
  type: 'agent';
  agentId: string;
  name: string;
  description?: string;
  soulMd: string;
  memoryMd?: string;
  claudeMd?: string;
  skills?: Array<{ name: string; content: string }>;
  icon?: string;
  model?: string;
}

interface ModulePackage {
  type: 'module';
  moduleId: string;
  enabled: boolean;
}

type InstallPackage = AgentPackage | ModulePackage;

function validateToken(request: NextRequest): boolean {
  const token = ENV.INTERNAL_API_TOKEN;
  if (!token) return false; // empty token = disabled, reject cloud installs
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${token}`;
}

export async function POST(request: NextRequest) {
  if (!validateToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as InstallPackage;

    if (body.type === 'agent') {
      return installAgent(body);
    } else if (body.type === 'module') {
      return installModule(body);
    }

    return NextResponse.json({ error: 'Unknown package type' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/marketplace/install error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function installAgent(pkg: AgentPackage): NextResponse {
  const { agentId, name, description, soulMd, memoryMd, claudeMd, skills, icon, model } = pkg;

  if (!agentId || !name || !soulMd) {
    return NextResponse.json(
      { error: 'agentId, name, and soulMd are required' },
      { status: 400 }
    );
  }

  // Validate agentId is safe for filesystem use
  if (!/^[a-zA-Z0-9_-]+$/.test(agentId)) {
    return NextResponse.json(
      { error: 'agentId must be alphanumeric (with hyphens/underscores)' },
      { status: 400 }
    );
  }

  // Create agent workspace directory
  const agentDir = path.join(ENV.MC_HOME, 'agents', agentId);
  const subdirs = ['assets', 'deliverables', 'memory', 'reviews', 'scripts', 'tasks'];
  for (const sub of subdirs) {
    mkdirSync(path.join(agentDir, sub), { recursive: true });
  }

  // Write soul file
  writeFileSync(path.join(agentDir, 'SOUL.md'), soulMd);

  // Write memory file
  if (memoryMd) {
    writeFileSync(path.join(agentDir, 'MEMORY.md'), memoryMd);
  } else if (!existsSync(path.join(agentDir, 'MEMORY.md'))) {
    writeFileSync(path.join(agentDir, 'MEMORY.md'), '# Memory\n');
  }

  // Write CLAUDE.md if provided
  if (claudeMd) {
    writeFileSync(path.join(agentDir, 'CLAUDE.md'), claudeMd);
  }

  // Write skills
  if (skills && skills.length > 0) {
    const skillsDir = path.join(agentDir, 'skills');
    mkdirSync(skillsDir, { recursive: true });
    for (const skill of skills) {
      if (skill.name && skill.content) {
        const safeName = skill.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        writeFileSync(path.join(skillsDir, `${safeName}.md`), skill.content);
      }
    }
  }

  // Upsert agent record in SQLite
  const db = getDb();
  const now = Date.now();
  const existing = db.prepare('SELECT id FROM agents WHERE id = ?').get(agentId);

  if (existing) {
    db.prepare(`
      UPDATE agents SET name = ?, description = ?, icon = ?, model = ?, updatedAt = ?
      WHERE id = ?
    `).run(name, description || '', icon || 'Bot', model || null, now, agentId);
  } else {
    db.prepare(`
      INSERT INTO agents (id, name, description, status, icon, model, createdAt, updatedAt)
      VALUES (?, ?, ?, 'idle', ?, ?, ?, ?)
    `).run(agentId, name, description || '', icon || 'Bot', model || null, now, now);
  }

  return NextResponse.json({
    success: true,
    agentId,
    message: `Agent "${name}" installed successfully`,
  }, { status: 201 });
}

function installModule(pkg: ModulePackage): NextResponse {
  const { moduleId, enabled } = pkg;

  if (!moduleId) {
    return NextResponse.json({ error: 'moduleId is required' }, { status: 400 });
  }

  const db = getDb();
  const now = Date.now();

  db.prepare(`
    INSERT INTO module_state (moduleId, enabled, updatedAt)
    VALUES (?, ?, ?)
    ON CONFLICT(moduleId) DO UPDATE SET enabled = ?, updatedAt = ?
  `).run(moduleId, enabled ? 1 : 0, now, enabled ? 1 : 0, now);

  return NextResponse.json({
    success: true,
    moduleId,
    enabled,
    message: `Module "${moduleId}" ${enabled ? 'enabled' : 'disabled'}`,
  }, { status: 201 });
}
