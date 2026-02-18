---
phase: 15
plan: 01
subsystem: x-twitter
tags: [react, list-views, image-attachment, ipc, electron]
dependency_graph:
  requires: [14]
  provides: [XPlanListView, XDraftListView, XImageAttachment, pickImage-IPC]
  affects: [15-02]
tech_stack:
  added: []
  patterns: [list-view-with-composer-toggle, file-picker-ipc]
key_files:
  created:
    - src/components/XPlanListView.tsx
    - src/components/XDraftListView.tsx
    - src/components/XImageAttachment.tsx
  modified:
    - src/components/XContentEditorPane.tsx
    - src/components/XDraftComposer.tsx
    - electron/preload.ts
    - electron/main.ts
    - src/types/global.d.ts
decisions:
  - "List views fetch all items (no status filter) so users see proposed, approved, rejected together"
  - "Composers accessible via toggle inside list views (not replaced, still exist)"
  - "XImageThumbnails uses file:// protocol for local image rendering in Electron"
  - "pickImage IPC returns {success, filePaths} matching existing pattern"
metrics:
  duration: "~4min"
  completed: "2026-02-18"
---

# Phase 15 Plan 01: Content Plan + Draft List Views with Image Attachment Summary

**One-liner:** Replaced creation-form center panes with scrollable list views for content plans and drafts, added native image picker for draft attachments.

## What Was Done

### Task 1: XPlanListView and XDraftListView
- Created `XPlanListView.tsx` that fetches all content plans via `xPlan.list()` and displays them as cards with title, content type badge, thread length badge, and status badge (proposed/approved/rejected)
- Created `XDraftListView.tsx` that fetches all drafts via `xDraft.list()` and displays them with version badges, status badges, and tweet content previews (first 2 tweets truncated to 140 chars)
- Both views have empty state handling with create buttons, loading spinners, and a toggle to show the original composer forms (XPlanThreadComposer / XDraftComposer) via "Back to list" navigation

### Task 2: Image Attachment Support
- Created `XImageAttachment.tsx` with two named exports: `XImageAttachButton` (opens native file picker) and `XImageThumbnails` (renders image thumbnails from local file paths)
- Added `pickImage` method to preload.ts xDraft namespace, invoking `x:draft:pickImage` IPC
- Registered `x:draft:pickImage` IPC handler in main.ts using `dialog.showOpenDialog` with image file filters
- Wired `XImageAttachButton` into `XDraftComposer.tsx` with `mediaPaths` state passed to `xDraft.create()` as `mediaUrls`
- Added `pickImage` to the global type declaration in `global.d.ts`

### Task 3: XContentEditorPane Routing
- Updated `XContentEditorPane.tsx` to route plan tab to `XPlanListView` and drafts tab to `XDraftListView`
- Removed direct imports of `XPlanThreadComposer` and `XDraftComposer` from the editor pane

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] XImageAttachment created in Task 1 instead of Task 2**
- **Found during:** Task 1
- **Issue:** XDraftListView imports XImageThumbnails from XImageAttachment.tsx, which wouldn't exist until Task 2
- **Fix:** Created XImageAttachment.tsx as part of Task 1 to unblock compilation
- **Files:** src/components/XImageAttachment.tsx

**2. [Rule 1 - Bug] Added type declarations for pickImage**
- **Found during:** Task 2
- **Issue:** TypeScript error — `pickImage` not in xDraft type definition in global.d.ts
- **Fix:** Added `pickImage: () => Promise<{ success: boolean; filePaths: string[] }>` to xDraft interface
- **Files:** src/types/global.d.ts

## Verification Results

All 9 checks passed:
1. XPlanListView imported and rendered in XContentEditorPane
2. XDraftListView imported and rendered in XContentEditorPane
3. xPlan.list IPC call in XPlanListView
4. xDraft.list IPC call in XDraftListView
5. pickImage wired in preload.ts and main.ts
6. XImageAttachButton and XImageThumbnails exported from XImageAttachment
7. XImageAttachButton used in XDraftComposer
8. mediaPaths/mediaUrls flowing through XDraftComposer
9. TypeScript error count unchanged at 469 (all pre-existing)

## Commits

| Commit | Description |
|--------|-------------|
| db6931f | feat(15-01): add XPlanListView and XDraftListView list components |
| d935ba0 | feat(15-01): add image attachment support to draft flow |
| dd7e99d | feat(15-01): route plan and drafts tabs to list views |
