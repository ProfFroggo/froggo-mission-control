---
title: Mission Control Platform Architecture
tags: [knowledge, architecture, platform]
updated: 2026-03-08
---

# Mission Control Platform Architecture

## Overview

Mission Control is a self-hosted, local-first AI agent platform built on Next.js and Claude Code CLI. It provides a browser-based dashboard for orchestrating AI agents that collaborate on tasks, communicate through chat rooms, and operate within a permission-gated approval system.

## Stack

- **Frontend**: Next.js 15 App Router + React 18 + TypeScript + TailwindCSS + Zustand
- **Backend**: Next.js API Routes (REST) + Server-Sent Events
- **Database**: better-sqlite3 at `~/mission-control/data/mission-control.db` (WAL mode)
- **Agent Runtime**: Claude Code CLI (`claude --print --model ...`)
- **Memory**: Obsidian vault at `~/mission-control/memory/` indexed by QMD
- **MCP Servers**: `mission-control_db` (11 DB tools), `memory` (4 search/write tools), `cron` (schedule tools)

## Key Principles

- **Local-first**: All data stays on your machine — no third-party services required
- **Claude Code native**: Agents are standard Claude Code CLI subprocesses
- **Permission tiers**: Human-in-the-loop approval hooks enforce external-action gates
- **Module system**: Features install/uninstall via the Modules Library

## Directory Structure

```
~/git/mission-control-nextjs/   ← Platform code (npm package)
├── app/api/                    ← REST API routes (100+ endpoints)
├── src/components/             ← React UI components
├── src/lib/                    ← Server logic (db, dispatch, env)
├── src/modules/                ← Pluggable feature modules
├── catalog/agents/             ← Agent manifests, soul files, avatars
├── tools/
│   ├── mission-control-db-mcp/ ← SQLite MCP server (11 tools)
│   ├── memory-mcp/             ← Obsidian/QMD MCP server (4 tools)
│   ├── cron-mcp/               ← Schedule MCP server
│   └── hooks/                  ← Claude CLI hooks
└── .claude/
    ├── agents/                 ← Agent definition files (trust tiers)
    ├── skills/                 ← Reusable skill files
    ├── settings.json           ← MCP servers, hooks, permissions
    └── CLAUDE.md               ← Shared agent context

~/mission-control/              ← Runtime data (created at install)
├── agents/                     ← Per-agent workspaces (CLAUDE.md, SOUL.md, MEMORY.md)
├── data/mission-control.db     ← SQLite database
├── library/                    ← All agent output files
├── memory/                     ← Obsidian vault (knowledge, daily, sessions, agents)
├── logs/                       ← Runtime logs
└── .claude/settings.json       ← Hooks config
```

## Agent Architecture

15 agents defined in `.claude/agents/` and `catalog/agents/`:

| Agent | Role | Trust Tier |
|-------|------|-----------|
| `mission-control` | Orchestrator — triages inbox, delegates work | Trusted |
| `clara` | QA review gate | Worker |
| `hr` | Agent onboarding, team management | Worker |
| `coder` | Code implementation | Apprentice |
| `senior-coder` | Architecture + complex code | Apprentice |
| `researcher` | Research and investigation | Apprentice |
| `writer` | Documentation and content | Apprentice |
| `chief` | Strategic decisions | Apprentice |
| `designer` | UI/UX design | Apprentice |
| `social-manager` | Social media management | Apprentice |
| `growth-director` | Growth strategy | Apprentice |
| `finance-manager` | Financial analysis | Apprentice |
| `discord-manager` | Discord community | Apprentice |
| `voice` | Voice interface | Apprentice |
| `inbox` | Email triage | Apprentice |

## Trust Tiers

| Tier | `permissionMode` | Who |
|------|-----------------|-----|
| Trusted | `bypassPermissions` + all tools | Mission Control only |
| Worker | `bypassPermissions` + all tools | Clara, HR |
| Apprentice | `default` | All other agents |

## Task Lifecycle

```
todo → internal-review → in-progress → agent-review → done
             ↕                              ↕
        human-review                  human-review
     (needs human input)         (external dependency)
```

- **`blocked` status does not exist** — use `human-review` instead
- **Skipping internal-review** (todo → in-progress) is blocked by MCP
- **Only Clara can move a task to `done`** — agents move to `agent-review`

## Approval Tiers

- **Tier 0**: Read-only (auto-approve)
- **Tier 1**: Internal writes (auto-approve, logged)
- **Tier 2**: External reads (auto-approve, audited)
- **Tier 3**: External writes (requires human approval via dashboard)

## Related
- [[knowledge/system-architecture]]
- [[knowledge/mcp-tools]]
- [[knowledge/task-lifecycle]]
