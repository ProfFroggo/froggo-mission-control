---
phase: 16-tmux-orchestration
plan: "01"
subsystem: infra
tags: [tmux, orchestration, agents, bash]
requires: [15-env-and-config]
provides:
  - tools/tmux-setup.sh — creates froggo-agents tmux session
  - tools/agent-start.sh — resume/start agents by ID
  - spawn API wired to tmux agent-start.sh
tech-stack:
  added: []
  patterns: ["Agent orchestration via named tmux session", "Resume sessions by ID from agent_sessions table"]
key-files:
  created: [tools/tmux-setup.sh, tools/agent-start.sh]
  modified: [app/api/agents/[id]/spawn/route.ts]
key-decisions:
  - "TMUX_SESSION=mission-control — consistent with ENV wrapper"
  - "tmux integration is non-fatal — gracefully skipped if tmux not running"
  - "pane 0.3 is on-demand for all non-persistent agents"
affects: [22]
duration: 5min
completed: 2026-03-05
---

# Phase 16-01: Tmux Orchestration

## What Was Built

### tools/tmux-setup.sh
Creates the `mission-control` tmux session with a fixed 4-pane agent window plus two utility windows. Non-destructive: exits immediately if the session already exists rather than killing it.

Window layout:
- `agents` — 4 panes: mission-control (0), coder (1), clara (2), on-demand (3)
- `logs` — tails `~/mission-control/logs/*.log`
- `nextjs` — runs `npm run dev`

### tools/agent-start.sh
External dispatcher: sends tmux `send-keys` commands to route agents to their designated panes. Looks up an existing active session ID in `agent_sessions` (camelCase columns: `agentId`, `sessionId`, `createdAt`) and resumes with `claude --resume <id>` if found. Falls back to `claude --agent <soul-file>` (or bare `claude`) for new sessions.

Agent-to-pane mapping (all 13 agents covered):
- `mission-control`, `main` → `agents.0`
- `coder`, `lead_engineer` → `agents.1`
- `clara` → `agents.2`
- All others → `agents.3` (on-demand slot)

### app/api/agents/[id]/spawn/route.ts
Added `execSync` import alongside the existing `spawn`. After the detached process spawn block, the route now calls `tools/agent-start.sh` via `execSync` with a 5-second timeout. The call is wrapped in try/catch — if tmux is not running or the script fails for any reason, the API continues normally and returns success.

## Deviations from Spec

- `agent-start.sh` queries `agentId`/`sessionId`/`createdAt` (camelCase) to match the spawn route's DB schema, rather than `agent_id`/`session_id` (snake_case) as written in the spec. The spawn route already uses camelCase and the DB migrations match it — aligning to camelCase avoids a schema mismatch.
- Both `tmux-setup.sh` and `agent-start.sh` were previously present as untracked files with different architectures (exec-based, kill-on-recreate). They were overwritten with the spec content.
- The spawn route was also previously untracked. It already had the correct DB session logic, so only the `execSync` tmux block was added.

## TypeScript Check
`npx tsc --noEmit` exits 0 — no type errors introduced.

## Commits
- `8712ee6` — feat(16-01): add tmux-setup.sh and agent-start.sh orchestration scripts
- `55392ca` — feat(16-01): wire spawn API to call agent-start.sh via tmux
