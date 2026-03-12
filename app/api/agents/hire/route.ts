// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { validateAgentId } from '@/lib/validateId';
import { mkdirSync, writeFileSync, existsSync, copyFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getDb } from '@/lib/database';
import { emitSSEEvent } from '@/lib/sseEmitter';

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

## Task Pipeline
\`todo → in-progress → internal-review → review → done\`
\`human-review\` = blocked, needs Kevin's input

**You must NEVER mark a task done yourself. Only Clara can approve done.**

### Working a Task — required steps in order:
1. **Claim** the task immediately:
   \`mcp__mission-control_db__task_update { "id": "<task-id>", "status": "in-progress", "progress": 0 }\`
   \`mcp__mission-control_db__task_add_activity { "taskId": "<task-id>", "agentId": "${id}", "action": "started", "message": "Started: <one sentence plan>" }\`

2. **Plan** — write full plan in planningNotes, break into subtasks:
   \`mcp__mission-control_db__task_update { "id": "<task-id>", "planningNotes": "<your plan>" }\`
   \`mcp__mission-control_db__subtask_create { "taskId": "<task-id>", "title": "<step>", "assignedTo": "${id}" }\`
   → Note the returned subtask ID — you need it to mark complete

3. **Do the work** — after each subtask completes:
   \`mcp__mission-control_db__subtask_update { "id": "<sub-id>", "completed": true }\`
   \`mcp__mission-control_db__task_add_activity { "taskId": "<task-id>", "agentId": "${id}", "message": "Completed: <what you did>" }\`
   \`mcp__mission-control_db__task_update { "id": "<task-id>", "progress": <0-100> }\`

4. **Self-review** — verify all subtasks are done:
   \`mcp__mission-control_db__task_get { "id": "<task-id>" }\`
   \`mcp__mission-control_db__task_update { "id": "<task-id>", "status": "internal-review", "progress": 95 }\`

5. **Hand off to Clara** — immediately after self-review in the SAME session:
   \`mcp__mission-control_db__task_add_activity { "taskId": "<task-id>", "agentId": "${id}", "action": "completed", "message": "Done: <summary>" }\`
   \`mcp__mission-control_db__task_update { "id": "<task-id>", "status": "review", "progress": 100, "lastAgentUpdate": "Done: <label>" }\`

## Core Rules
- Post activity on every meaningful decision — minimum 3 updates per task
- If blocked: \`mcp__mission-control_db__task_update { "status": "human-review", "lastAgentUpdate": "Blocked: <reason>" }\`
- Save all output files to \`~/mission-control/library/\` with date-prefix naming
- External actions (tweets, emails, deploys) → request approval first
- Work autonomously — do not ask for clarification, interpret and execute
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

    if (typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: 'name must be 100 characters or fewer' }, { status: 400 });
    }

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

    // Avatar: prefer package avatar (webp then png), then public/agent-profiles (webp then png), then workspace existing
    const avatarDestWebp = join(workspaceDir, 'assets', 'avatar.webp');
    const avatarDestPng  = join(workspaceDir, 'assets', 'avatar.png');
    const avatarDest = existsSync(avatarDestWebp) ? avatarDestWebp : avatarDestPng;
    const packageAvatarWebp = join(packageDir, 'avatar.webp');
    const packageAvatarPng  = join(packageDir, 'avatar.png');
    const publicAvatarWebp  = join(process.cwd(), 'public', 'agent-profiles', `${id}.webp`);
    const publicAvatarPng   = join(process.cwd(), 'public', 'agent-profiles', `${id}.png`);
    let avatarPath: string | null = null;
    if (!existsSync(avatarDestWebp) && !existsSync(avatarDestPng)) {
      if (existsSync(packageAvatarWebp)) {
        copyFileSync(packageAvatarWebp, avatarDestWebp);
        avatarPath = avatarDestWebp;
      } else if (existsSync(packageAvatarPng)) {
        copyFileSync(packageAvatarPng, avatarDestPng);
        avatarPath = avatarDestPng;
      } else if (existsSync(publicAvatarWebp)) {
        copyFileSync(publicAvatarWebp, avatarDestWebp);
        avatarPath = avatarDestWebp;
      } else if (existsSync(publicAvatarPng)) {
        copyFileSync(publicAvatarPng, avatarDestPng);
        avatarPath = avatarDestPng;
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

    // Mark installed in catalog (try both column name variants for migration safety)
    try {
      db.prepare(`UPDATE catalog_agents SET installed = 1, avatar = COALESCE(?, avatar), updatedAt = ? WHERE id = ?`)
        .run(avatarPath, Date.now(), id);
    } catch {
      try {
        db.prepare(`UPDATE catalog_agents SET installed = 1, avatar = COALESCE(?, avatar), updated_at = ? WHERE id = ?`)
          .run(avatarPath, Date.now(), id);
      } catch { /* non-critical — catalog will sync on next restart */ }
    }

    // Seed presets from catalog JSON (model, trust_tier, skills, tools, apiKeys)
    // Uses ON CONFLICT DO NOTHING so re-hires never overwrite user customizations
    try {
      const catalogJsonPath = join(CATALOG_DIR, 'agents', `${id}.json`);
      if (existsSync(catalogJsonPath)) {
        const catalogJson = JSON.parse(readFileSync(catalogJsonPath, 'utf-8'));
        const { requiredSkills, requiredTools, requiredApis, model: catalogModel, permissionMode } = catalogJson;

        // Set model from catalog if not already set
        if (catalogModel) {
          db.prepare(`UPDATE agents SET model = ? WHERE id = ? AND (model IS NULL OR model = '')`)
            .run(catalogModel, id);
        }

        // Map permissionMode → trust_tier
        const tierMap: Record<string, string> = {
          bypassPermissions: 'worker',
          acceptEdits: 'apprentice',
          default: 'apprentice',
        };
        const trustTier = tierMap[permissionMode as string] ?? 'apprentice';
        db.prepare(`UPDATE agents SET trust_tier = ? WHERE id = ? AND (trust_tier IS NULL OR trust_tier = '')`)
          .run(trustTier, id);

        // Seed skills, tools, apiKeys into settings — never overwrite existing
        const seedSetting = db.prepare(`
          INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT (key) DO NOTHING
        `);
        if (Array.isArray(requiredSkills) && requiredSkills.length > 0) {
          seedSetting.run(`agent.${id}.skills`, JSON.stringify(requiredSkills));
        }
        if (Array.isArray(requiredTools) && requiredTools.length > 0) {
          seedSetting.run(`agent.${id}.tools`, JSON.stringify(requiredTools));
        }
        if (Array.isArray(requiredApis) && requiredApis.length > 0) {
          seedSetting.run(`agent.${id}.apiKeys`, JSON.stringify(requiredApis));
        }
      }
    } catch { /* non-critical — presets can always be set manually in manage modal */ }

    // Post-hire onboarding: create welcome inbox message
    try {
      const now = Date.now();
      const welcomeBody = `You've been hired as ${role || 'Agent'}. Your workspace is at ~/mission-control/agents/${id}/. Read your SOUL.md to understand your purpose and CLAUDE.md for platform instructions. Start by reviewing the task board.`;
      db.prepare(`
        INSERT INTO inbox (type, title, content, context, status, createdAt, metadata)
        VALUES ('system', ?, ?, ?, 'unread', ?, '{}')
      `).run('Welcome to the team', welcomeBody, null, now);
    } catch { /* non-critical */ }

    // Emit SSE events
    emitSSEEvent('agent.hired', { agentId: id, name, role: role || 'Agent' });
    emitSSEEvent('agent.updated', { id });

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
