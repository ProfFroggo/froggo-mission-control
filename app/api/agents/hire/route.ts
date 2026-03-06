import { NextRequest, NextResponse } from 'next/server';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HOME = homedir();
const AGENTS_DIR = join(HOME, 'mission-control', 'agents');

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
// Creates the ~/mission-control/agents/{id}/ workspace directory with:
//   CLAUDE.md, SOUL.md, MEMORY.md
// Returns { path, files } on success.
export async function POST(request: NextRequest) {
  try {
    const { id, name, emoji, role, personality, capabilities } = await request.json();

    if (!id || !name) {
      return NextResponse.json({ error: 'id and name are required' }, { status: 400 });
    }

    const workspaceDir = join(AGENTS_DIR, id);

    // Create workspace directory (idempotent)
    mkdirSync(workspaceDir, { recursive: true });

    // Create sub-directories
    mkdirSync(join(workspaceDir, 'memory'), { recursive: true });

    const files: Record<string, string> = {
      'CLAUDE.md': buildWorkspaceClaude(id, name, emoji || '🤖', role || 'Agent'),
      'SOUL.md':   buildWorkspaceSoul(name, role || 'Agent', personality || 'Professional and reliable.', capabilities || []),
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

    return NextResponse.json({
      path: workspaceDir,
      files: written,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/agents/hire error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
