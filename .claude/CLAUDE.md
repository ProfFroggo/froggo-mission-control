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

## UI Rules
- **No emojis in UI** — always use Lucide icons instead. Emojis are never used as UI elements, icons, or decorations.
- **Dark/light theme** — all form elements (input, textarea, select, button) must use CSS variables via the global `forms.css` stylesheet. Never hardcode colors or use undefined Tailwind tokens like `bg-mission-control-bg1` (use `bg-mission-control-surface` instead).
- **Global styles first** — add new styles to the relevant global CSS file, not as one-off Tailwind classes per component.

## Task Lifecycle
`todo → internal-review → in-progress → review → human-review → done`

- **todo**: set up planning, subtasks (2+), assign agent — then move to internal-review
- **internal-review** ("Ready to Start"): Clara quality gate — verifies plan/subtasks/assignment before work begins
- **in-progress**: agent working, spawning sub-agents per subtask
- **review**: Clara verifies ALL planned work completed — sends back to in-progress with notes if incomplete
- **human-review**: required for external/content/approval tasks, or if truly blocked (needs human to unblock)
- **done**: agent review can go straight here if no human approval needed

**`blocked` status is removed — if something is blocked, move to `human-review` so a human can unblock it.**
**Skipping internal-review (todo → in-progress) is blocked by MCP.**

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
| React components, hooks, performance | `react-best-practices` |
| UI design, accessibility, forms, dark mode | `web-design-guidelines` |
| React 19 composition, compound components | `composition-patterns` |

Skills are self-contained guides. Reading the relevant skill before starting saves rework and ensures platform conventions are followed.

Your soul file has your specific responsibilities, output paths, and memory protocol.
