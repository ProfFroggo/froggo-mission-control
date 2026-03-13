# Mission Control Platform

## Paths
- App: `~/git/mission-control-nextjs` — `npm run dev` → localhost:3000
- DB: `~/mission-control/data/mission-control.db`
- Vault: `~/mission-control/memory/`
- Library: `~/mission-control/library/` — all agent output files go here
- MCP servers: `tools/mission-control-db-mcp/` and `tools/memory-mcp/`

## Git Workflow ⚠️ MANDATORY
- **All work goes on `dev` branch** — never commit directly to `main`
- `main` is release-only — CI publishes to npm on every push to `main`
- Flow: `dev` → PR → `main` → npm publish
- Always confirm you are on `dev` before starting any work: `git checkout dev`

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

## Task Pipeline

```
todo → internal-review (displayed as "Pre-review") → in-progress → review → done
                                                                        ↕
                                                                   human-review
                                                                   (any stage)
```

- **todo** — task created, needs planningNotes + subtasks before it can proceed
- **internal-review** (UI label: "Pre-review") — Clara's gate. The SYSTEM automatically moves tasks here when an agent is assigned. Clara checks 3 gates: agent assigned, planningNotes non-empty, subtasks exist. Approved → in-progress + agent dispatched. Rejected → back to todo with notes.
- **in-progress** — agent actively working
- **review** — agent finished; Clara verifies all planned work completed. Approved → done. Rejected → in-progress with feedback.
- **human-review** — branches off at ANY stage for: (1) external actions needing human approval (tweets, emails, deploys) via `approval_create`, (2) genuine blockers needing human decision
- **done** — Clara approved, work verified complete

**`blocked` status does not exist — use `human-review` instead.**
**Agents CANNOT set `internal-review` themselves — the SYSTEM manages it automatically when a task is assigned.**
**`todo → in-progress` is blocked by MCP — tasks must pass Clara's Pre-review gate first.**
**Agents must NOT move a task to `done` directly — only Clara can after her review passes.**

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
| Removing image backgrounds / cutouts | `image-cutout` |
| Breaking work into tasks | `task-decomposition` |
| Next.js routes or components | `nextjs-patterns` |
| Git commits, branches, PRs | `git-workflow` |
| Social/X content | `x-twitter-strategy` |
| React components, hooks, performance | `react-best-practices` |
| UI design, accessibility, forms, dark mode | `web-design-guidelines` |
| React 19 composition, compound components | `composition-patterns` |

Skills are self-contained guides. Reading the relevant skill before starting saves rework and ensures platform conventions are followed.

Your soul file has your specific responsibilities, output paths, and memory protocol.
