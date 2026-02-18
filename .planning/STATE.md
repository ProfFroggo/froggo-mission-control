# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** Every page works correctly in dark mode with consistent UI, X/Twitter is fully functional, Finance works, Writing panes are usable, Library has real data.
**Current focus:** v3.0 milestone — Phase 16 (X/Twitter Calendar)

## Current Position

Phase: 16 of 21 (X/Twitter Calendar)
Plan: 1 of 2 in current phase
Status: In progress
Last activity: 2026-02-18 — Completed 16-01-PLAN.md

Progress: [████░░░░░░░░░░░░░░░░] 38% (v3.0, 4/9 phases partial)

## Performance Metrics

**Velocity (v1):**
- Total plans completed: 12
- Average duration: ~13min
- Total execution time: ~161min

**Velocity (v2):**
- Plans completed: 17
- Average duration: ~4min

**Velocity (v2.1):**
- Plans completed: 8
- Average duration: ~4min
- Total execution time: ~32min

**Velocity (v2.2 / phase 13+):**
- Plans completed: 5
- Average duration: ~2min

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Carried forward:
- Keep preload namespace as `clawdbot` (cosmetic rename deferred)
- Keep electron/main.ts as monolith (breakup deferred)
- New IPC handlers go in dedicated service files under electron/
- All paths through electron/paths.ts

Phase 16 decisions:
- eventColorResolver callback pattern for custom event colors in EpicCalendar
- externalEvents prop bypasses fetchEvents entirely — external consumers manage own data

Phase 15 decisions:
- List views fetch all items (no status filter) so users see proposed, approved, rejected together
- Composers accessible via toggle inside list views (not replaced, still exist as sub-views)
- XImageThumbnails uses file:// protocol for local image rendering in Electron
- pickImage IPC returns {success, filePaths} matching existing pattern

Phase 14 decisions:
- Brand logos missing from lucide: define as local inline SVG components before the default export
- Tweet preview cards: bg-clawd-bg-alt + border-clawd-border (not bg-black + border-gray-800)
- Avatar circles: bg-clawd-accent (not bg-blue-500)
- Sidebar label: "X / Twitter" with spaces around slash (was "X/Twitter")
- TABS_WITH_APPROVAL allowlist ['plan', 'drafts'] is source of truth for approval queue visibility
- hideRightPane on ThreePaneLayout hides right pane + resize handle; center expands via effectiveCenterWidth
- analytics tab gets inline placeholder (no dedicated component needed yet)

Phase 13 decisions:
- CSS token pattern: define in src/index.css (:root + :root.light), expose in tailwind.config.js clawd object with var() + hex fallback
- bg-alt: #1a1a1a (dark) / #f4f4f5 (light) — input field background layer
- bg0: #0a0a0a (dark) / #fafafa (light) — alias for deepest bg layer
- card: #141414 (dark) / #ffffff (light) — alias for surface/card layer
- Agent card borders: always use theme.border from getAgentTheme(), never hard-coded border-clawd-border/50
- User chat bubbles: bg-clawd-accent/50 text-white across ALL chat components (including voice transcript, text chat modals)
- Chat send buttons: bg-clawd-accent hover:bg-clawd-accent-dim (never hardcoded blue)
- Chat input bar pattern: border-t border-clawd-border bg-clawd-surface (sibling of flex-1 messages, NOT nested in scroll area)
- QuickActions chat popup uses h-[320px] fixed height (not flex-1), appropriate for floating toolbar widget

### Pending Todos

- None

### Blockers/Concerns

- Pre-existing TypeScript errors in codebase (unrelated to UI token work) — will be tracked separately

## Session Continuity

Last session: 2026-02-18
Stopped at: Completed 16-01-PLAN.md. EpicCalendar extended, XCalendarView rewritten as adapter.
Resume file: None
