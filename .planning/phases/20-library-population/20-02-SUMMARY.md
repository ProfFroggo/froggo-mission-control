---
phase: 20
plan: 02
subsystem: library-ui
tags: [react, library, skills, agent-skills, file-management, inline-editing, typescript]

dependency-graph:
  requires: ["20-01"]
  provides: ["library-skills-ui", "library-files-inline-editing"]
  affects: ["library-page"]

tech-stack:
  added: []
  patterns:
    - "Agent-grouped collapsible sections for skills display"
    - "1-10 proficiency scale with 5-tier labels (Expert/Advanced/Intermediate/Beginner/Learning)"
    - "Inline file metadata editing (category dropdown, tag badges + add/remove, project name)"
    - "stop-propagation pattern for edit controls inside clickable rows"

key-files:
  created: []
  modified:
    - src/components/LibrarySkillsTab.tsx
    - src/components/LibraryFilesTab.tsx
    - src/types/global.d.ts

decisions:
  - id: LibraryFileItem-rename
    choice: Rename local interface LibraryFileItem (was LibraryFile)
    rationale: Name collision with global LibraryFile declared in global.d.ts causes TS2719
    alternatives: Cast at assignment point; extend global type
  - id: skills-collapsible-state
    choice: Simple useState<Set<string>> for collapse tracking (not group-active: CSS)
    rationale: Plan explicitly says "Do NOT use group-active: CSS class"
  - id: categoryCounts-dynamic
    choice: Compute categoryCounts dynamically from Object.keys(categoryConfig)
    rationale: Ensures adding/removing categories automatically updates counts without code changes

metrics:
  duration: "~6 minutes"
  completed: "2026-02-18"
---

# Phase 20 Plan 02: Library Skills Display + File Inline Tagging Summary

**One-liner:** Rewrote LibrarySkillsTab to consume real agent_skills data grouped by agent with 1-10 proficiency bars; expanded LibraryFilesTab to 9 categories with per-file inline category/tag/project editing via IPC.

## What Was Built

### LibrarySkillsTab (full rewrite)

- Updated `Skill` interface to match `skills:list` IPC response: `agent_id`, `skill_name`, `proficiency` (1-10), `success_count`, `failure_count`, `last_used`, `notes`, `agent_name`, `agent_emoji`
- Groups skills by `agent_id` using a `Map` — renders one collapsible section per agent
- Agent section header shows agent emoji (or User icon fallback) + agent name + skill count
- Proficiency bar uses `(proficiency / 10) * 100%` width — correct 1-10 scale
- Labels: >= 8 Expert (green), >= 6 Advanced (blue), >= 4 Intermediate (yellow), >= 2 Beginner (orange), < 2 Learning (dim)
- Shows `success_count / failure_count` and relative `last_used` date per skill
- Search filters across `skill_name` and `agent_name`
- Removed "Add Skill" button — skills are auto-tracked by system
- Simple toggle state for collapsible sections (no group-active: CSS)

### LibraryFilesTab (expanded)

- `categoryConfig` expanded from 6 to all 9 required categories: marketing, design, dev, research, finance, test-logs, content, social, other — each with distinct lucide icon + color
- `FileCategory` type updated to match 9 categories
- `LibraryFileItem` interface (renamed from `LibraryFile` to avoid global type collision) gains `project?: string | null`
- Category filter tabs rendered dynamically from `Object.keys(categoryConfig)` — no hardcoded list
- `categoryCounts` computed dynamically from same keys
- Each file row in list view has an inline editing row below the main row:
  - Category `<select>` dropdown — calls `library.update(id, { category })` on change
  - Tag badges with X to remove — calls `library.update(id, { tags })` on remove
  - Tag text input (pressing Enter adds tag) — calls `library.update(id, { tags })` on add
  - Project name input (blur or Enter saves) — calls `library.update(id, { project })`
  - All edit controls use `e.stopPropagation()` to prevent opening file viewer
- Fallback: unknown DB categories render as `categoryConfig.other`
- Drag-drop `uploadBuffer` uses correct `{ name, type, buffer }` object signature

### global.d.ts (type fixes)

Added missing type declarations for new IPC methods added in Plan 01:
- `window.clawdbot.skills` (optional) — `skills.list()` returning agent_skills rows
- `window.clawdbot.library.view()` — file viewer handler
- `window.clawdbot.library.download()` — file download handler
- `window.clawdbot.library.update()` — category/tags/project update
- `window.clawdbot.library.uploadBuffer()` — drag-drop upload
- `window.clawdbot.shell` (optional) — `shell.openPath()`
- `window.clawdbot.tasks.attachments` (optional) — `listAll()` and others

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] LibraryFile interface name collision with global type**

- **Found during:** Task 2 TypeScript check
- **Issue:** Both `src/types/global.d.ts` and `LibraryFilesTab.tsx` declared `interface LibraryFile`. TypeScript error TS2719: "Two different types with this name exist, but they are unrelated"
- **Fix:** Renamed local interface to `LibraryFileItem` and replaced all usages in the component. Added `as unknown as LibraryFileItem[]` cast at the assignment from library.list() result
- **Files modified:** `src/components/LibraryFilesTab.tsx`
- **Commit:** cd2121a

**2. [Rule 2 - Missing Critical] Missing type declarations for new IPC methods**

- **Found during:** Task 2 TypeScript check
- **Issue:** `window.clawdbot.skills`, `library.update`, `library.view`, `library.download`, `library.uploadBuffer`, `shell.openPath`, `tasks.attachments` all existed in preload.ts but not in `global.d.ts`
- **Fix:** Added all missing declarations to `global.d.ts`
- **Files modified:** `src/types/global.d.ts`
- **Commit:** cd2121a

## Commits

| Hash | Message |
|------|---------|
| 78c695c | feat(20-02): rewrite LibrarySkillsTab for real agent skills data |
| cd2121a | feat(20-02): expand LibraryFilesTab to 9 categories + inline file tagging |

## Verification Results

- `proficiency / 10` scale confirmed in LibrarySkillsTab
- `agent_id`, `agent_name`, `agent_emoji` fields used for grouping
- `window.clawdbot?.skills?.list()` called on mount
- No "Add Skill" button present
- All 9 categories in categoryConfig (marketing, design, dev, research, finance, test-logs, content, social, other)
- `library.update()` called for category, tags, and project changes
- `project` field in interface and UI
- `uploadBuffer` uses correct object signature
- No TypeScript errors in LibrarySkillsTab.tsx or LibraryFilesTab.tsx

## Next Phase Readiness

Phase 20 complete. Phase 21 (if any) can proceed.

Skills tab will show real data when `agent_skills` table has rows (66 rows confirmed in Plan 01 research).
Files tab has full 9-category support matching the schema categories from Plan 01 migration.
