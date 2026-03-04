# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** Agents talking end-to-end — messages in, streaming responses out, human-in-the-loop approvals working.
**Current focus:** Phase 7 — Permission & Hook System

## Current Position

Phase: 7 of 14 (Permission & Hook System)
Plan: 0 of 2 in current phase
Status: Starting
Last activity: 2026-03-04 — Completed Phase 6 (all 2 plans): 13 agent definitions + .claude/ directory

Progress: ████████████░░ 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 15
- Average duration: 3 min
- Total execution time: 0.65 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 (complete) | 3/3 | 12 min | 4 min |
| 2 (complete) | 2/2 | 4 min | 2 min |
| 3 (complete) | 4/4 | 12 min | 3 min |
| 4 (complete) | 2/2 | 5 min | 2.5 min |
| 5 (complete) | 2/2 | 6 min | 3 min |
| 6 (complete) | 2/2 | 5 min | 2.5 min |

## Accumulated Context

### Decisions

- Phase 0: Next.js App Router; better-sqlite3 at ~/froggo/data/froggo.db; SSE not WebSocket
- Phase 1: Next.js 16 Turbopack; serverExternalPackages; noImplicitAny: false
- Phase 1-03: IPC_ROUTE_MAP covers all legacy channels
- Phase 2: Single database.ts, 18 tables, camelCase columns
- Phase 3: 36 API routes; SSE stream stub for Phase 12; soul files at .claude/agents/{id}.md
- Phase 4: taskApi.getSubtasks() added; chatApi.saveMessage() added; starred/whisper/fs no web equivalent
- Phase 4: onNotification + onBroadcast listeners removed (no REST equivalent; Phase 12 will add polling)
- Phase 5: froggo-db MCP at tools/froggo-db-mcp/ (11 tools, StdioServerTransport); memory MCP at tools/memory-mcp/ (3 tools, QMD + grep fallback); VAULT_PATH default ~/froggo/memory/
- Phase 6: .claude/settings.json uses froggo_db + memory MCP servers; hooks registered for Pre/Post/Stop; 13 agents defined

### Deferred Issues

- Starred messages API not implemented (ChatPanel TODO)
- Chat suggest replies not implemented (ChatPanel TODO)
- File attachments (fs:writeBase64) not implemented in web — no web equivalent
- Whisper transcription not in web — would need Web Speech API (Phase 12)

### Pending Todos

None.

## Session Continuity

Last session: 2026-03-04
Stopped at: Phase 6 complete — starting Phase 7 (Permission & Hook System, 2 plans)
Resume file: None
