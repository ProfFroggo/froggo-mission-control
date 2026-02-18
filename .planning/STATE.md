# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** Every page works correctly in dark mode with consistent UI, X/Twitter is fully functional, Finance works, Writing panes are usable, Library has real data.
**Current focus:** v3.0 milestone — Phase 15 (X/Twitter Content Flow), in progress

## Current Position

Phase: 15 of 21 (X/Twitter Content Flow)
Plan: 2 of 2 in current phase
Status: Phase complete
Last activity: 2026-02-18 — Completed 15-02-PLAN.md (verify agent routing + send button fix)

Progress: [███░░░░░░░░░░░░░░░░░] 33% (v3.0, 3/9 phases)

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
- Plans completed: 4
- Average duration: ~1-2min

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Carried forward:
- Keep preload namespace as `clawdbot` (cosmetic rename deferred)
- Keep electron/main.ts as monolith (breakup deferred)
- New IPC handlers go in dedicated service files under electron/
- All paths through electron/paths.ts

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
Stopped at: Completed 15-02-PLAN.md. Phase 15 complete (2 plans). XTW-09 and XTW-10 verified.
Resume file: None
