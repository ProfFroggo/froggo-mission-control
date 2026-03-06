# Mission Control Platform

## Paths
- App: `~/git/mission-control-nextjs` — `npm run dev` → localhost:3000
- DB: `~/mission-control/data/mission-control.db`
- Vault: `~/mission-control/memory/`
- Library: `~/mission-control/library/` — all agent output files go here
- MCP servers: `tools/mission-control-db-mcp/` and `tools/memory-mcp/`

## Key Rules
- Check task board before starting work
- Post activity on every meaningful decision
- External actions (tweets, emails, deploys) → `approval_create` MCP tool first
- P0/P1 tasks → Clara review before done
- ENV values → import from `src/lib/env.ts`, never `process.env` directly

## Task Lifecycle
`blocked → todo → in-progress → internal-review → review → human-review → done`

## Agent Communication
- Async messaging: `chat_post` / `chat_read` MCP tools
- Task updates: `task_activity_create` MCP tool
- External approval gate: `approval_create` MCP tool

## Skills Protocol

**Before starting any task**, check if a relevant skill exists and read it first:
```
Read ~/git/mission-control-nextjs/.claude/skills/{skill-name}/SKILL.md
```

| Doing... | Skill |
|----------|-------|
| Writing or reviewing code | `froggo-coding-standards` |
| Writing tests | `froggo-testing-patterns` |
| Reviewing code | `code-review-checklist` |
| Security review | `security-checklist` |
| Routing work to another agent | `agent-routing` |
| Breaking work into tasks | `task-decomposition` |
| Next.js routes or components | `nextjs-patterns` |
| Git commits, branches, PRs | `git-workflow` |
| Social/X content | `x-twitter-strategy` |

Skills are self-contained guides. Reading the relevant skill before starting saves rework and ensures platform conventions are followed.

Your soul file has your specific responsibilities, output paths, and memory protocol.
