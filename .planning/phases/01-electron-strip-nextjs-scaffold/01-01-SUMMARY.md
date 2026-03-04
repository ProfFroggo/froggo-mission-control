---
phase: 01-electron-strip-nextjs-scaffold
plan: "01"
subsystem: infra
tags: [next.js, electron, typescript, vite, migration]

requires: []
provides:
  - Next.js installed and configured as build system
  - tsconfig.json updated for App Router (jsx preserve, next plugin, electron excluded)
  - package.json scripts replaced with next dev/build/start/lint
  - Electron and Vite deps fully removed
affects: [02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14]

tech-stack:
  added: [next@15, "@types/node"]
  patterns: ["Next.js App Router as bundler/server", "better-sqlite3 as serverComponentsExternalPackages"]

key-files:
  created: [next.config.js]
  modified: [package.json, tsconfig.json]

key-decisions:
  - "Removed Vite as bundler — Next.js replaces it entirely"
  - "Kept vitest and playwright for testing (independent of bundler)"
  - "Removed noUnusedLocals/Params — too strict for incremental migration of Electron codebase"
  - "Set moduleResolution: bundler — required for Next.js, compatible with existing import style"

issues-created: []

duration: 2min
completed: 2026-03-04
---

# Phase 1 Plan 01: Electron Strip + Next.js Config Summary

**Next.js installed, Electron and Vite fully removed, tsconfig and package.json reconfigured for App Router**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T10:41:14Z
- **Completed:** 2026-03-04T10:43:03Z
- **Tasks:** 5
- **Files modified:** 3

## Accomplishments

- Installed `next@latest` and `@types/node`
- Removed `electron`, `electron-builder`, `electron-is-dev`, `electron-store`, `electron-updater`, `@electron/fuses`, `electron-rebuild`
- Removed `vite`, `@vitejs/plugin-react`, `rollup-plugin-visualizer`, `terser`, `concurrently`, `wait-on`
- Created `next.config.js` with `serverComponentsExternalPackages: ['better-sqlite3']` and `@` path alias
- Updated `tsconfig.json`: `jsx: preserve`, `plugins: [next]`, `exclude: electron/`, removed `allowImportingTsExtensions` and strict unused var checks
- Replaced all Electron/Vite scripts with `next dev/build/start/lint`; removed `postinstall` hook and `main` field

## Task Commits

1. **Task 1: Install Next.js, remove Electron/Vite** - `8cc7239` (chore)
2. **Task 2: Create next.config.js** - `3b7e676` (feat)
3. **Task 3: Update tsconfig.json** - `9519207` (feat)
4. **Task 4: Update package.json scripts** - `370818f` (feat)
5. **Task 5: Verify tsconfig excludes electron/** - included in Task 3 commit

## Files Created/Modified

- `next.config.js` — Next.js config with better-sqlite3 external pkg and @ alias
- `package.json` — scripts replaced, Electron/Vite deps removed, postinstall removed
- `tsconfig.json` — Next.js App Router config, electron/ excluded from compilation

## Decisions Made

- Removed `noUnusedLocals` and `noUnusedParameters` — the existing Electron codebase has many unused imports in components; keeping them would create hundreds of errors before migration is done
- Removed `allowImportingTsExtensions` — not compatible with Next.js bundler mode and causes issues with explicit `.tsx` imports
- Removed `references` array — no longer using `tsconfig.node.json`; Next.js handles all TS compilation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed `"main"` field from package.json**
- **Found during:** Task 4 (updating scripts)
- **Issue:** `"main": "dist-electron/main.js"` is an Electron entry point that has no meaning in a Next.js app
- **Fix:** Removed the field
- **Verification:** package.json valid JSON, no Electron reference
- **Committed in:** `370818f`

---

**Total deviations:** 1 auto-fixed (1 cleanup)
**Impact on plan:** Minor cleanup. No scope creep.

## Issues Encountered

None.

## Next Phase Readiness

- Next.js installed and configured — ready for App Router structure (01-02)
- TypeScript compilation will be verified in 01-02 when `next-env.d.ts` and `app/` are created
- `better-sqlite3` correctly marked as server-only external package for API routes

---
*Phase: 01-electron-strip-nextjs-scaffold*
*Completed: 2026-03-04*
