---
phase: 14
plan: "02"
subsystem: x-twitter
tags: [tabs, navigation, layout, routing, agent-chat]

dependency-graph:
  requires: ["14-01"]
  provides: ["8-tab navigation", "conditional approval pane", "automations routing fix"]
  affects: ["14-03"]

tech-stack:
  added: []
  patterns: ["conditional pane rendering via hideRightPane prop", "TABS_WITH_APPROVAL allowlist"]

key-files:
  created: []
  modified:
    - src/components/XTwitterPage.tsx
    - src/components/XTabBar.tsx
    - src/components/XThreePaneLayout.tsx
    - src/components/XContentEditorPane.tsx
    - src/components/XAgentChatPane.tsx

decisions:
  - "TABS_WITH_APPROVAL allowlist ['plan', 'drafts'] is the source of truth for which tabs show the approval queue side panel"
  - "hideRightPane on ThreePaneLayout hides both the right pane and its resize handle; center pane expands to fill via effectiveCenterWidth"
  - "analytics tab gets an inline placeholder (no separate component needed for now)"

metrics:
  duration: "2 min"
  completed: "2026-02-18"
---

# Phase 14 Plan 02: Tab Restructure Summary

**One-liner:** 8-tab navigation with conditional approval pane hiding via hideRightPane prop, plus automations routing bug fix.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update tab type, tab bar, and three-pane layout | 149fbaf | XTwitterPage.tsx, XTabBar.tsx, XThreePaneLayout.tsx |
| 2 | Update content editor routing, agent chat maps | 5d242a7 | XContentEditorPane.tsx, XAgentChatPane.tsx |

## What Was Built

**XTwitterPage.tsx:**
- XTab type updated to 8 values: `plan | drafts | calendar | mentions | reply-guy | content-mix | automations | analytics` (removed `research`)
- Default tab changed from `research` to `plan`
- Removed `showContentMix` state, PieChart/X lucide imports, Content Mix overlay modal, and header toggle button
- Added `TABS_WITH_APPROVAL: XTab[] = ['plan', 'drafts']` constant
- `showApprovalPane` derived from that allowlist; passed as `hideRightPane={!showApprovalPane}` to ThreePaneLayout

**XTabBar.tsx:**
- 8 tabs in correct order: Content Plan, Drafts, Calendar, Mentions, Reply Guy, Content Mix Tracker, Automations, Analytics
- Replaced `Lightbulb` import with `PieChart` and `BarChart2`

**XThreePaneLayout.tsx:**
- Added `hideRightPane?: boolean` prop (default `false`)
- When `hideRightPane=true`: right pane + resize handle hidden; center pane width = `100 - leftWidth` via `effectiveCenterWidth`

**XContentEditorPane.tsx:**
- Removed `XResearchIdeaEditor` import and `research` route
- Fixed bug: `automations` now routes to `XAutomationsTab` (was incorrectly rendering `XContentMixTracker`)
- `content-mix` correctly routes to `XContentMixTracker`
- `analytics` renders inline placeholder

**XAgentChatPane.tsx:**
- Removed `research` from `AGENT_ROUTING` and `TAB_CONTEXT`
- Added `content-mix` (social-manager) and `analytics` (social-manager) to both maps

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Automations routing was rendering XContentMixTracker**

- Found during: Task 2
- Issue: `XContentEditorPane` had a comment "Automations tab has content mix tracker" and returned `<XContentMixTracker />` for `automations` tab
- Fix: `automations` now correctly renders `<XAutomationsTab />` (imported); `content-mix` now renders `<XContentMixTracker />`
- Files modified: `src/components/XContentEditorPane.tsx`
- Commit: 5d242a7

## Success Criteria Met

- [x] XTW-04: Tab order is Content Plan, Drafts, Calendar, Mentions, Reply Guy, Content Mix Tracker, Automations, Analytics
- [x] XTW-05: Calendar tab renders in 2-pane layout (hideRightPane=true, no approval queue)
- [x] XTW-06: Mentions tab renders in 2-pane layout (hideRightPane=true)
- [x] XTW-07: Reply Guy tab renders in 2-pane layout (hideRightPane=true)
- [x] XTW-08: Automations tab renders in 2-pane layout (hideRightPane=true)

## Next Phase Readiness

No blockers. Pre-existing TypeScript errors in other files (AddAccountWizard, AgentChatModal, etc.) remain but are unrelated to this phase's changes.
