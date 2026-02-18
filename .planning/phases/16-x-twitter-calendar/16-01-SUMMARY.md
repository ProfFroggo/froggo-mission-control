---
phase: 16
plan: 01
subsystem: x-twitter-calendar
tags: [calendar, epic-calendar, x-pipeline, colour-coding, adapter]
depends_on:
  requires: [14, 15]
  provides: [EpicCalendar external event props, XCalendarView adapter]
  affects: [16-02]
tech-stack:
  added: []
  patterns: [adapter-pattern, external-events-injection, color-resolver-callback]
key-files:
  created: []
  modified:
    - src/components/EpicCalendar.tsx
    - src/components/XCalendarView.tsx
decisions:
  - id: 16-01-D1
    decision: "eventColorResolver callback pattern for custom event colors"
    reason: "Allows any consumer to inject color logic without modifying EpicCalendar internals"
  - id: 16-01-D2
    decision: "externalEvents prop bypasses fetchEvents entirely"
    reason: "Clean separation — external consumers manage their own data lifecycle"
metrics:
  duration: ~4min
  completed: 2026-02-18
---

# Phase 16 Plan 01: EpicCalendar Extension + XCalendarView Adapter Summary

EpicCalendar extended with 5 optional props (externalEvents, createButtonLabel, onCreateClick, onExternalDrop, eventColorResolver); XCalendarView rewritten from 552-line custom calendar to 140-line adapter fetching all 4 X pipeline stages with colour-coded events.

## Tasks Completed

### Task 1: Extend EpicCalendar with optional props
- Added `EpicCalendarProps` interface with 5 optional props
- `externalEvents` bypasses internal `fetchEvents` when provided
- `onExternalDrop` provides early return in `confirmReschedule` for external event sources
- `eventColorResolver` flows through all 4 view components (MonthView, WeekView, DayView, AgendaView) to EventCard
- EventCard computes `displayColor = resolvedColor || accountColor` for backward compat
- `createButtonLabel` and `onCreateClick` customize the header button
- SchedulePanel (no props) continues working unchanged

### Task 2: Rewrite XCalendarView as EpicCalendar adapter
- Replaced entire 552-line custom calendar with ~140-line thin adapter
- Fetches from all 4 X pipeline IPC endpoints: `xResearch.list`, `xPlan.list`, `xDraft.list`, `xSchedule.list`
- Colour-coded by pipeline stage via `colorId` + `eventColorResolver`:
  - Research: purple (`bg-purple-500`)
  - Plan: blue (`bg-blue-500`)
  - Draft: amber (`bg-amber-500`)
  - Scheduled: green (`bg-emerald-500`)
- Research/plan/draft items: all-day events on creation date
- Scheduled posts: timed events at `scheduled_for` with 1-hour duration
- Drag-drop reschedule for scheduled posts via `onExternalDrop` -> `xSchedule.update`
- Named export preserved (`export function XCalendarView`) — XContentEditorPane unchanged

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| 16-01-D1 | eventColorResolver callback pattern | Any consumer can inject color logic without modifying EpicCalendar internals |
| 16-01-D2 | externalEvents bypasses fetchEvents entirely | Clean separation — external consumers manage their own data lifecycle |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- `externalEvents` prop present in EpicCalendar.tsx (confirmed via grep)
- `EpicCalendar` imported and used in XCalendarView.tsx (confirmed)
- All 4 pipeline fetches present: xResearch, xPlan, xDraft, xSchedule (confirmed)
- Zero new TypeScript errors for EpicCalendar, EventCard, SchedulePanel, XCalendarView, XContentEditorPane
- Pre-existing 469 TS errors unchanged (tracked separately)

## Commits

| Hash | Message |
|------|---------|
| 4d3a42d | feat(16-01): extend EpicCalendar with optional props for external events and customisation |
| 5f89eab | feat(16-01): rewrite XCalendarView as EpicCalendar adapter with colour-coded pipeline events |

## Next Phase Readiness

16-02 can proceed — EpicCalendar now accepts external events and custom colors, which 16-02 may build upon for additional X/Twitter calendar features.
