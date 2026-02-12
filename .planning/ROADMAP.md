# Roadmap: Froggo.app Dashboard Hardening

## Overview

Take Froggo.app from "functional but leaking" to production-grade in four waves. Each wave leaves the app in a strictly better state: first lock down credentials and attack surface, then fix every broken data path so indicators reflect reality, then eliminate behavioral bugs under edge conditions, then strip dead weight. 35 requirements, 4 phases, quick depth.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Security Hardening** - No credentials, tokens, or PII in source; no open attack surface
- [x] **Phase 2: Fix Broken Features** - Every feature works, every data source points to live data
- [ ] **Phase 3: Functional Fixes** - App behaves correctly under all conditions including edge cases
- [ ] **Phase 4: Cleanup & Debloat** - Lean codebase with no dead weight

## Phase Details

### Phase 1: Security Hardening
**Goal**: No security vulnerabilities remain in shipped source code
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07
**Success Criteria** (what must be TRUE):
  1. `grep -r` for known API tokens (Twitter Bearer, Gemini key, gateway token) returns zero hits in src/ and electron/
  2. DevTools cannot be opened in the packaged Froggo.app (Cmd+Shift+I, Cmd+Option+I both do nothing)
  3. Passing `'; DROP TABLE tasks; --` as a task title through the UI does not execute SQL injection
  4. The filesystem IPC handlers refuse to read/write paths outside the allowed directories (~/clawd/, ~/.openclaw/)
  5. The encryption key is loaded from environment or keychain, not from a hardcoded default string
**Plans**: 6 plans

Plans:
- [x] 01-01-PLAN.md — Remove credentials and PII from source (SEC-01, SEC-02, SEC-07) [Wave 1]
- [x] 01-02-PLAN.md — Lock down attack surface (SEC-03, SEC-04 partial, SEC-05, SEC-06) [Wave 2]
- [x] 01-03-PLAN.md — Gap closure: Migrate notification-settings + snooze handlers to prepare() [Wave 3, gap_closure]
- [x] 01-04-PLAN.md — Gap closure: Migrate message folder + conversation pin handlers to prepare() [Wave 4, gap_closure]
- [x] 01-05-PLAN.md — Gap closure: Migrate task/attachment/library/inbox handlers to prepare() [Wave 5, gap_closure]
- [x] 01-06-PLAN.md — Gap closure: Migrate calendar/conversation/chat/sessions.db + final sweep [Wave 6, gap_closure]

### Phase 2: Fix Broken Features
**Goal**: Every feature works and every data indicator reflects live reality
**Depends on**: Phase 1
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04, FIX-05, FIX-06, FIX-07, FIX-08, FIX-09, FIX-10
**Success Criteria** (what must be TRUE):
  1. Agent panel, session list, and token analytics all show live data from ~/clawd/data/froggo.db and ~/.openclaw/ (no stale ~/Froggo/ or ~/.clawdbot/ reads)
  2. Spawning an agent from the Kanban board triggers the dispatcher/openclaw CLI (not the deleted spawn-agent-with-retry.py script)
  3. The Dashboard active-work widget renders in its correct grid position (not stacked or missing)
  4. The tasks:list query returns non-archived tasks (not filtering on nonexistent `cancelled` column)
  5. All CLI command references in the UI say `openclaw` (no `clawdbot` strings visible to user)
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Fix mechanical bugs: spawn handler, layout key, Tailwind hover, avatar grouping, JSON.parse guards, CLI strings, API key paths (FIX-02, FIX-05, FIX-06, FIX-07, FIX-08, FIX-09, FIX-10) [Wave 1]
- [x] 02-02-PLAN.md — Restore missing AI IPC handlers with security treatment: fix channel name mismatch, restore generateReply + getAnalysis with prepare() (FIX-03) [Wave 2]

### Phase 3: Functional Fixes
**Goal**: App behaves correctly under all conditions including edge cases and race conditions
**Depends on**: Phase 2
**Requirements**: FUNC-01, FUNC-02, FUNC-03, FUNC-04, FUNC-05, FUNC-06, FUNC-07, FUNC-08, FUNC-09, FUNC-10
**Success Criteria** (what must be TRUE):
  1. Approving a task in the inbox routes it to the correct agent based on task content (designer gets design tasks, writer gets content tasks — not everything to coder)
  2. Opening the dashboard in a browser (web mode) without Electron does not crash on any panel — null guards catch missing IPC
  3. Receiving a task notification and a message notification within 1 second shows both (not one overwriting the other)
  4. Approving an item in the inbox does not create a phantom unsynced task in the local store
  5. The Kanban board re-renders only when task data actually changes (memo comparator catches isDeleting, isSpawning, activeSessions)
**Plans**: 2 plans

Plans:
- [ ] 03-01: Fix routing and guards (FUNC-01, FUNC-02, FUNC-03, FUNC-04, FUNC-05 — agent routing table, error boundaries, null guards, notification debounce)
- [ ] 03-02: Fix state and performance bugs (FUNC-06, FUNC-07, FUNC-08, FUNC-09, FUNC-10 — deduplicate gateway calls, fix phantom tasks, memo comparator, localStorage cap, double listeners)

### Phase 4: Cleanup & Debloat
**Goal**: Lean codebase with no dead files, dead code, or broken styling
**Depends on**: Phase 3
**Requirements**: CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04, CLEAN-05, CLEAN-06, CLEAN-07, CLEAN-08
**Success Criteria** (what must be TRUE):
  1. No .ts/.tsx file in src/ imports from deleted lib files (readState, queryCache, optimizedQueries, performanceMonitoring, smartAccountSelector, voiceService, api/gateway)
  2. No .bak files exist in src/
  3. QuickStatsWidget renders correctly with standard Tailwind classes (no custom CSS class warnings in console)
  4. MorningBrief panel shows no debug info in production mode
  5. Keyboard shortcuts in Settings have no collisions (each shortcut maps to exactly one action)
**Plans**: 2 plans

Plans:
- [ ] 04-01: Delete dead code and files (CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04, CLEAN-05 — remove dead libs, dead panel exports, dead store fields, dead component code, .bak files)
- [ ] 04-02: Fix styling and shortcuts (CLEAN-06, CLEAN-07, CLEAN-08 — replace non-standard CSS classes, remove debug output, fix shortcut collisions)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Hardening | 6/6 | Complete | 2026-02-12 |
| 2. Fix Broken Features | 2/2 | Complete | 2026-02-12 |
| 3. Functional Fixes | 0/2 | Not started | - |
| 4. Cleanup & Debloat | 0/2 | Not started | - |
