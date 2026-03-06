---
phase: 39-e2e-verification-v4
plan: 01
tags: [e2e, smoke-test, v4.0]
key-files:
  created: []
  modified: [tools/e2e-smoke-test.sh]
duration: 10min
completed: 2026-03-06
---
# Phase 39 Plan 01: E2E Verification v4.0 Summary
- 22 new smoke checks added to `tools/e2e-smoke-test.sh` covering all v4.0 phases (31-38)
- Checks: catalog_agents/modules tables, catalogSync.ts, ≥10 manifests each, 4 REST API route files, catalogApi export, AgentLibraryPanel/ModuleLibraryPanel/ModuleInstallModal components, hire/install/hr-stream routes, DELETE handlers, core module guard, ROLE_PRESETS, STEP_COUNT=7
- Fixed backslash-escape bug on `[id]` route paths in grep commands
- **107/107 checks pass** (was 85/85 before v4.0 additions)
- Commit: `85a48d6`
