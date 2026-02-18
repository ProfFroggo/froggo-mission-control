---
phase: 16
plan: 02
subsystem: x-twitter-calendar
tags: [drag-to-reschedule, draggable, create-tweet, custom-event, tab-switching]
depends_on:
  requires: [16-01]
  provides: [isEventDraggable prop, Create Tweet button wiring, x-tab-change event]
  affects: []
tech-stack:
  added: []
  patterns: [custom-dom-event, draggable-guard-callback]
key-files:
  created: []
  modified:
    - src/components/EpicCalendar.tsx
    - src/components/XCalendarView.tsx
    - src/components/XTwitterPage.tsx
decisions:
  - id: 16-02-D1
    decision: "isEventDraggable callback on EpicCalendar and EventCard"
    reason: "Generic guard lets any consumer decide which events are draggable without forking the calendar"
  - id: 16-02-D2
    decision: "CustomEvent x-tab-change for cross-component tab switching"
    reason: "Calendar is deeply nested inside ThreePaneLayout; DOM events decouple without prop drilling"
metrics:
  duration: ~3min
  completed: 2026-02-18
---

# Phase 16 Plan 02: Drag-to-Reschedule + Create Tweet Button Summary

**One-liner:** isEventDraggable guard restricts drag to scheduled tweets; Create Tweet fires x-tab-change CustomEvent to switch XTwitterPage to drafts tab.

## What Was Done

### Task 1: Non-draggable events + Create Tweet button

**A. EpicCalendar.tsx -- isEventDraggable prop**
- Added `isEventDraggable?: (event: CalendarEvent) => boolean` to `EpicCalendarProps`
- Added matching prop to `EventCard` component
- EventCard computes `canDrag` from the callback (defaults to `true` when absent)
- Both compact and full render paths use `draggable={canDrag}` and conditional `cursor-move` / `cursor-default`
- Passed `isEventDraggable` through MonthView, WeekView, DayView, and AgendaView to all EventCard instances

**B. XCalendarView.tsx -- Create Tweet handler + draggable guard**
- Added `isEventDraggable()` function that returns `true` only for `colorId === 'scheduled'`
- Added `handleCreateTweet` callback that dispatches `CustomEvent('x-tab-change', { detail: 'drafts' })`
- Passed `onCreateClick={handleCreateTweet}` and `isEventDraggable={isEventDraggable}` to EpicCalendar

**C. XTwitterPage.tsx -- x-tab-change listener**
- Added `useEffect` that listens for `x-tab-change` window event
- On event, reads `detail` as `XTab` and calls `setActiveTab(tab)`
- Properly cleans up listener on unmount

## Verification

- `npx tsc --noEmit` produces zero new type errors (5 pre-existing errors in EpicCalendar unchanged)
- All must_haves satisfied:
  - Scheduled tweets are draggable; research/plan/draft events are NOT
  - "Create Tweet" button dispatches x-tab-change to navigate to drafts
  - Calendar view layout unchanged (calendar + chat, no approval panel)

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| Hash | Message |
|------|---------|
| af3c7d1 | feat(16-02): add isEventDraggable prop, Create Tweet handler, x-tab-change listener |
