# Phase 50 Plan 01: Agent ID Validation — Core Routes Summary

**Created validateAgentId() utility and applied it to the three highest-severity routes: spawn (command injection fix), stream (SSE guard), soul (path traversal + hardcoded path removal).**

## Accomplishments

- Created `src/lib/validateId.ts` — exports `AGENT_ID_PATTERN` and `validateAgentId(id: unknown): NextResponse | null`
- `spawn/route.ts`: replaced `execSync(\`bash "${scriptPath}" "${id}"\`)` with `spawnSync('bash', [scriptPath, id])` — eliminates command injection; added validateAgentId guard
- `stream/route.ts`: added inline SSE-format validation guard before any filesystem access or process spawning
- `soul/route.ts`: replaced hardcoded `/Users/kevin.macarthur/git/mission-control-nextjs` with `process.cwd()`; added validateAgentId guard in both GET and PUT
- TypeScript compiles clean (zero errors)

## Files Created/Modified

- `src/lib/validateId.ts` — created (commit 3e2b841)
- `app/api/agents/[id]/spawn/route.ts` — fixed (commit da21305)
- `app/api/agents/[id]/stream/route.ts` — fixed (commit da21305)
- `app/api/agents/[id]/soul/route.ts` — fixed (commit da21305)

## Decisions Made

- `stream/route.ts` uses inline regex check (not shared util) because the route returns `Response` (SSE) not `NextResponse` — the inline check matches the same pattern as `AGENT_ID_PATTERN`
- `validateAgentId` returns `null` for valid (not a boolean) so callers can `if (guard) return guard;` with zero boilerplate

## Issues Encountered

None.

## Next Step

Ready for 50-02-PLAN.md — apply validation to remaining routes (catalog, hire, avatar, kill, config, session, status, models).
