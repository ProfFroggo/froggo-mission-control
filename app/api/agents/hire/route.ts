import { NextRequest, NextResponse } from 'next/server';
import { validateAgentId } from '@/lib/validateId';
import { mkdirSync, writeFileSync, existsSync, copyFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HOME = homedir();
const AGENTS_DIR = join(HOME, 'mission-control', 'agents');
const CATALOG_DIR = join(process.cwd(), 'catalog');

function buildWorkspaceClaude(id: string, name: string, emoji: string, role: string): string {
  return `# CLAUDE.md — ${name} (${emoji})

You are **${name}**, the **${role}** in the Mission Control multi-agent system.

## Identity
Read \`SOUL.md\` now. This defines who you are.

## Boot Sequence
1. Read \`SOUL.md\` — personality, role, operating principles
2. Read \`MEMORY.md\` — long-term state and key learnings
3. Check queue: \`mcp__mission-control_db__task_list { "assignedTo": "${id}", "status": "todo" }\`

## Key Paths
- **Database**: \`~/mission-control/data/mission-control.db\` (use MCP tools, never raw SQL)
- **Your workspace**: \`~/mission-control/agents/${id}/\`
- **Library**: \`~/mission-control/library/\` — save all output files here

## MCP Tools
- Database: \`mcp__mission-control_db__*\`
- Memory: \`mcp__memory__*\`

## Task Lifecycle
\`blocked → todo → in-progress → internal-review → review → human-review → done\`

## Core Rules
- Check the task board before starting work
- Post activity on every meaningful decision
- Update task status when done
- Communicate blockers immediately
- External actions (tweets, emails, deploys) → \`approval_create\` MCP tool first
`;
}

function buildWorkspaceSoul(name: string, role: string, personality: string, capabilities: string[]): string {
  return `# SOUL.md — ${name}

## Who You Are

You are **${name}** — ${role}.

## Personality

${personality}

## Capabilities
${capabilities.map(c => `- ${c}`).join('\n')}

## Operating Principles

1. Read the task description fully before starting
2. Follow existing patterns in the codebase/domain
3. Ask upfront if requirements are unclear — don't guess
4. Every output file goes to \`~/mission-control/library/\`
5. Log progress frequently (minimum 3 updates per task)
6. Communicate blockers immediately — never silently stall
`;
}

// POST /api/agents/hire
// Creates the ~/mission-control/agents/{id}/ workspace, registers in agents table,
// and marks catalog_agents.installed = 1.
// Reads soul.md and claude.md from catalog/agents/{id}/ package if available.
export async function POST(request: NextRequest) {
  try {
    const { id, name, emoji, role, personality, capabilities, color } = await request.json();

    if (!id || !name) {
      return NextResponse.json({ error: 'id and name are required' }, { status: 400 });
    }

    const guard = validateAgentId(id);
    if (guard) return guard;

    const workspaceDir = join(AGENTS_DIR, id);
    const packageDir = join(CATALOG_DIR, 'agents', id);

    // Create workspace directory and sub-directories (idempotent)
    mkdirSync(workspaceDir, { recursive: true });
    mkdirSync(join(workspaceDir, 'memory'), { recursive: true });
    mkdirSync(join(workspaceDir, 'assets'), { recursive: true });

    // Prefer bundled soul.md from package, fall back to generated
    let soulContent: string;
    const packageSoul = join(packageDir, 'soul.md');
    if (existsSync(packageSoul)) {
      soulContent = readFileSync(packageSoul, 'utf-8');
      // Append user personalization if provided
      if (personality) {
        soulContent += `\n## User Context\n\n${personality}\n`;
      }
    } else {
      soulContent = buildWorkspaceSoul(name, role || 'Agent', personality || 'Professional and reliable.', capabilities || []);
    }

    // Prefer bundled claude.md from package, fall back to generated
    let claudeContent: string;
    const packageClaude = join(packageDir, 'claude.md');
    if (existsSync(packageClaude)) {
      claudeContent = readFileSync(packageClaude, 'utf-8');
    } else {
      claudeContent = buildWorkspaceClaude(id, name, emoji || '🤖', role || 'Agent');
    }

    const files: Record<string, string> = {
      'CLAUDE.md': claudeContent,
      'SOUL.md':   soulContent,
      'MEMORY.md': `# MEMORY.md — ${name}\n\n*Created: ${new Date().toISOString().split('T')[0]}*\n\n## Key Learnings\n\n(empty — memory builds as you work)\n`,
    };

    const written: string[] = [];
    for (const [filename, content] of Object.entries(files)) {
      const filePath = join(workspaceDir, filename);
      // Don't overwrite MEMORY.md if it already exists (preserve accumulated memory)
      if (filename === 'MEMORY.md' && existsSync(filePath)) continue;
      writeFileSync(filePath, content, 'utf-8');
      written.push(filename);
    }

    // Avatar: prefer package avatar, then public/agent-profiles, then workspace existing
    const avatarDest = join(workspaceDir, 'assets', 'avatar.png');
    const packageAvatar = join(packageDir, 'avatar.png');
    const publicAvatar = join(process.cwd(), 'public', 'agent-profiles', `${id}.png`);
    let avatarPath: string | null = null;
    if (!existsSync(avatarDest)) {
      if (existsSync(packageAvatar)) {
        copyFileSync(packageAvatar, avatarDest);
        avatarPath = avatarDest;
      } else if (existsSync(publicAvatar)) {
        copyFileSync(publicAvatar, avatarDest);
        avatarPath = avatarDest;
      }
    } else {
      avatarPath = avatarDest;
    }

    // Register/update agent in agents table (source of truth for active agents)
    const db = getDb();
    db.prepare(`
      INSERT INTO agents (id, name, role, emoji, color, capabilities, personality, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'idle', unixepoch())
      ON CONFLICT(id) DO UPDATE SET
        name         = excluded.name,
        role         = excluded.role,
        emoji        = excluded.emoji,
        color        = excluded.color,
        capabilities = excluded.capabilities,
        personality  = excluded.personality,
        status       = CASE WHEN agents.status = 'archived' THEN 'idle' ELSE agents.status END
    `).run(
      id, name, role || 'Agent', emoji || '🤖', color || '#00BCD4',
      JSON.stringify(Array.isArray(capabilities) ? capabilities : []),
      personality || ''
    );

    // Mark installed in catalog
    db.prepare(`
      UPDATE catalog_agents SET installed = 1, avatar = COALESCE(?, avatar), updatedAt = ?
      WHERE id = ?
    `).run(avatarPath, Date.now(), id);

    return NextResponse.json({
      path: workspaceDir,
      files: written,
      avatar: avatarPath,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/agents/hire error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
