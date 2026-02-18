# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** Every page works correctly in dark mode with consistent UI, X/Twitter is fully functional, Finance works, Writing panes are usable, Library has real data.
**Current focus:** v3.0 milestone — Phase 20 (Library Population & Tagging)

## Current Position

Phase: 20 of 21 (Library Population & Tagging)
Plan: 01 of 2
Status: In progress
Last activity: 2026-02-18 — Completed 20-01 (Library IPC Wiring)

Progress: [█████████░░░░░░░░░░░] 67% (v3.0, 8/9 phases: 13,14,15,16,17,18,19 complete; 20-21 remaining)

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
- Plans completed: 9
- Average duration: ~2min

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Carried forward:
- Keep preload namespace as `clawdbot` (cosmetic rename deferred)
- Keep electron/main.ts as monolith (breakup deferred)
- New IPC handlers go in dedicated service files under electron/
- All paths through electron/paths.ts

Phase 19 decisions:
- String minSize="Npx" for pixel-based panel minimums in react-resizable-panels v4 (180px chapters, 280px chat, 300px editor)
- data-[separator=active] for drag state (not :active, not data-[resize-handle-active]) — v4 sets data-separator="active" throughout drag
- group-data-[separator=active]: on child elements for inner grip indicator styling
- v4 CSS: data-group on Group, data-separator on Separator (replaces v3 data-panel-group-id / data-resize-handle)

Phase 17 decisions:
- Idempotent ALTER TABLE + try/catch per column for x_mentions migration
- Table recreation for x_drafts CHECK constraint (SQLite limitation)
- Comment out duplicate handler stubs rather than delete (preserves reference)
- CustomEvent x-agent-chat-inject for cross-component message injection (XReplyGuyView -> XAgentChatPane)
- autoSend state pattern for deferred send after external input injection

Phase 16 decisions:
- eventColorResolver callback pattern for custom event colors in EpicCalendar
- externalEvents prop bypasses fetchEvents entirely — external consumers manage own data
- isEventDraggable callback on EpicCalendar/EventCard for per-event drag control
- CustomEvent x-tab-change for cross-component tab switching (decouples calendar from XTwitterPage)

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
- analytics tab gets inline placeholder (no dedicated component needed yet) [superseded by 18-02: XAnalyticsView]

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
Stopped at: Completed 20-01-PLAN.md. Added skills:list, library:update, library:uploadBuffer IPC handlers + library project column migration. 20-02 next.
Resume file: None
