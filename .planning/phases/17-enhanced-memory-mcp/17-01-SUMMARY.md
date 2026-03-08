phase: 17-enhanced-memory-mcp
plan: "01"
subsystem: infra
tags: [mcp, memory, obsidian, qmd, hooks]
requires: [15-env-and-config]
provides:
  - memory MCP with 4 tools (search/recall/write/read)
  - QMD hybrid search with grep fallback
  - session-sync hook writes to Obsidian + refreshes QMD + logs analytics
tech-stack:
  added: []
  patterns: ["memory_write routes by category to vault subfolders", "All memory ops gracefully degrade if vault/QMD unavailable"]
key-files:
  modified: [tools/memory-mcp/src/index.ts, tools/hooks/session-sync.js]
key-decisions:
  - "4 tools: search/recall/write/read — covers all agent memory operations"
  - "QMD first, grep fallback — works offline or when QMD not installed"
  - "All file ops non-fatal — vault may not exist in all environments"
affects: [19, 22]
duration: 5min
completed: 2026-03-05
