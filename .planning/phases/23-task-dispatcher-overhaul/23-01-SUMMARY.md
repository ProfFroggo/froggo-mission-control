# Phase 23 Plan 01: Task Dispatcher Overhaul Summary

**Dispatched agents now run with full soul file context, per-agent model, MCP access, session continuity, and exit logging.**

## Accomplishments

- **Soul file injection**: `buildTaskSystemPrompt()` reads `~/mission-control/agents/{id}/SOUL.md` and appends autonomous task mode suffix; falls back to DB personality if no SOUL.md
- **Per-agent model**: `resolveModel()` maps short names (`sonnet/opus/haiku`) to full Claude model IDs; model fetched from `agents` table per dispatch
- **cwd fixed**: Changed from `~/mission-control/agents/{id}` to `process.cwd()` (project root) so `.claude/settings.json` MCP config is loaded by all dispatched agents
- **Stream-JSON output**: Args include `--print --output-format stream-json --verbose` so session_id can be parsed from stdout result events
- **Session continuity**: `loadTaskSession()` checks `agent_sessions` with `{agentId}:task` key; `persistTaskSession()` stores session from stdout; `--resume` used on subsequent dispatches within 2 hours
- **stdin message delivery**: Changed stdio from `'ignore'` to `['pipe', 'pipe', 'ignore']`; message written to `proc.stdin`
- **Exit logging**: `close` event logs exit code and moves task to `blocked` on non-zero exit; `error` event handles ENOENT/spawn failures
- **Dispatch activity**: Message includes model name and whether session was resumed or new

## Files Modified

- `src/lib/taskDispatcher.ts` — complete rewrite: soul prompt, model resolution, session management, stream-json, exit logging

## Also completed in this phase (23.1)

- All 15 `~/mission-control/agents/*/CLAUDE.md` workspace files updated: replaced defunct `derek-db` CLI commands with `mcp__mission-control_db__*` MCP tool calls, fixed DB path and workspace paths

## Decisions Made

- Used `{agentId}:task` suffix key for task sessions to avoid colliding with chat sessions in `agent_sessions` table (agentId is PRIMARY KEY)
- 2-hour session expiry for task sessions (chat sessions use 30-minute in-memory expiry)
- `cwd = process.cwd()` not `homedir()` — Next.js API routes return project root, which contains `.claude/settings.json`
- `--output-format stream-json --verbose` required together for structured JSON parsing
- No `--agents {id}` flag used (that's for interactive tmux sessions); `--system-prompt` with SOUL.md is the correct approach for `--print` mode

## Issues Encountered

None — TypeScript compiles clean, `npm run build` passes.

## Next Step

Phase 24: PreCompact Context Resilience — hook that re-injects task context before compaction
