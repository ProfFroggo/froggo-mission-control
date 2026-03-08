---
phase: 37-lifecycle-management
plan: 01
tags: [lifecycle, fire, uninstall, delete]
key-files:
  created: []
  modified: [app/api/catalog/agents/[id]/route.ts, app/api/catalog/modules/[id]/route.ts, src/lib/api.ts, src/components/AgentLibraryPanel.tsx, src/components/ModuleLibraryPanel.tsx]
duration: 12min
completed: 2026-03-06
---
# Phase 37 Plan 01: Agent & Module Lifecycle Management Summary
- `DELETE /api/catalog/agents/[id]`: marks installed=0, archives agent in agents table, renames workspace to {id}-archived-{ts}
- `DELETE /api/catalog/modules/[id]`: marks installed=0, enabled=0 (core modules protected)
- `catalogApi.fireAgent()` + `catalogApi.uninstallModule()` added to api.ts
- Fire button in AgentLibraryPanel for hired agents (with confirm dialog)
- Uninstall button in ModuleLibraryPanel for installed non-core modules (with confirm dialog)
- Commit: `0b06de0`
