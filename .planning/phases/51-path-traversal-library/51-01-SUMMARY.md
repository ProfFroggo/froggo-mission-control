# Phase 51 Plan 01: Path Traversal — Library Route Summary

**Fixed two path traversal vulnerabilities: library view action now boundary-checks decoded paths against LIBRARY_PATH, and the files/read route now restricts all access to an allowlisted set of root directories.**

## Accomplishments

- `app/api/library/route.ts`: After base64-decoding the path ID, added `candidate.startsWith(ENV.LIBRARY_PATH + path.sep)` check before `existsSync` — returns 403 for any path outside the library root
- `app/api/files/read/route.ts`: Added `ALLOWED_ROOTS` array (library, vault, agent workspaces, `process.cwd()`) and `isAllowedPath()` guard before any filesystem access — returns 403 for paths like `/etc/passwd`, private keys, env files, or any path outside allowed roots
- TypeScript compiles clean (zero errors)

## Files Created/Modified

- `app/api/library/route.ts` — fixed (commit 8dfa14f)
- `app/api/files/read/route.ts` — fixed (commit 3de63f3)

## Decisions Made

- `files/read` allowlist uses 4 roots: `ENV.LIBRARY_PATH`, `ENV.VAULT_PATH`, `~/mission-control/agents`, `process.cwd()` — covers all legitimate UI use cases (library browser, memory viewer, agent workspace viewer, project file viewer)
- Legacy DB lookup in library route (`file.path`) is NOT checked against LIBRARY_PATH — it comes from the DB (trusted data), not user input
- Used `root + '/'` (not `path.sep`) in `isAllowedPath` since paths are always absolute POSIX on macOS/Linux

## Issues Encountered

None.

## Next Step

Phase 51 complete. Phases 52 (command-injection-spawn) and 53 (path-traversal-soul-route) were already fixed in Phase 50. Ready to verify and close those, then move to Phase 54: gemini-key-server-side.
