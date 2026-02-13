---
phase: 11-chat-layout
plan: 03
subsystem: ui
tags: [react, tiptap, gateway, streaming, chat, zustand, markdown, writing]

# Dependency graph
requires:
  - phase: 11-chat-layout/01
    provides: "chatPaneStore, pendingInsert, writingContext, chat IPC service"
  - phase: 11-chat-layout/02
    provides: "3-pane resizable layout with chat placeholder, Selection CSS"
provides:
  - "ChatPane component with streaming AI chat via gateway.sendChatWithCallbacks"
  - "ChatMessage component with markdown rendering, copy, and send-to-editor actions"
  - "ChatInput component with agent picker and auto-resizing textarea"
  - "pendingInsert watcher in ChapterEditor for append/cursor/replace content insertion"
  - "TipTap Selection extension for preserving editor selection on blur"
  - "TipTap Markdown extension for contentType:'markdown' insertion"
affects: [11-chat-layout/04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gateway streaming with sendChatWithCallbacks + accumulatedRef pattern"
    - "Session key namespacing with :chat suffix for isolated chat sessions"
    - "pendingInsert Zustand bridge: ChatMessage -> writingStore -> ChapterEditor useEffect"
    - "contentType:'markdown' for AI-generated prose insertion into TipTap"

key-files:
  created:
    - "src/components/writing/ChatPane.tsx"
    - "src/components/writing/ChatMessage.tsx"
    - "src/components/writing/ChatInput.tsx"
  modified:
    - "src/components/writing/ProjectEditor.tsx"
    - "src/components/writing/ChapterEditor.tsx"

key-decisions:
  - "Agent preambles in ChatPane match FeedbackPopover pattern but are writing-assistant focused (not edit-focused)"
  - "Chat messages persist to disk after streaming completes (both user + assistant in onEnd callback)"
  - "Streaming cursor is a pulsing green bar (clawd-accent) appended after markdown content"

patterns-established:
  - "Gateway streaming: accumulatedRef.current pattern with onDelta/onEnd/onError callbacks"
  - "Cross-component content flow: setPendingInsert -> useEffect watcher -> editor.chain().insertContent"
  - "Session key format: agent:{agentId}:writing:{projectId}:chat"

# Metrics
duration: 4min
completed: 2026-02-13
---

# Phase 11 Plan 03: Chat Pane UI + Editor Integration Summary

**ChatPane with streaming AI responses via gateway, markdown message rendering with send-to-editor actions, and TipTap Selection/Markdown extensions for chat-to-editor content insertion**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-13T03:09:37Z
- **Completed:** 2026-02-13T03:13:56Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- ChatPane with full streaming AI chat, message history loading, agent selection, and clear conversation
- ChatMessage with react-markdown rendering, hover action buttons (send to editor, copy), inserted badge
- ChatInput with AgentPicker reuse, auto-resizing textarea, Enter-to-send / Shift+Enter-newline
- pendingInsert watcher in ChapterEditor handles append/cursor/replace modes with contentType:'markdown'
- TipTap Selection extension preserves editor selection highlight when chat input has focus
- TipTap Markdown extension enables AI-generated markdown insertion into ProseMirror schema

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ChatPane, ChatMessage, and ChatInput components** - `c56ebd3` (feat)
2. **Task 2: Wire ChatPane into layout and add editor pendingInsert watcher + TipTap extensions** - `3b49662` (feat)

## Files Created/Modified
- `src/components/writing/ChatPane.tsx` - Main chat pane with streaming gateway integration, history loading, context building
- `src/components/writing/ChatMessage.tsx` - Individual message with markdown, copy, and send-to-editor actions
- `src/components/writing/ChatInput.tsx` - Auto-resizing textarea with agent picker and send button
- `src/components/writing/ProjectEditor.tsx` - Replaced chat placeholder with real ChatPane component
- `src/components/writing/ChapterEditor.tsx` - Added Selection + Markdown extensions and pendingInsert watcher

## Decisions Made
- Agent preambles in ChatPane are writing-assistant flavored (help develop manuscript) vs FeedbackPopover's edit-focused preambles (rewrite selected text)
- Chat messages are persisted to disk only after streaming completes (both user and assistant messages saved in onEnd callback) to avoid partial persistence
- Streaming cursor uses a pulsing green bar rather than text dots, matching the clawd-accent theme

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Full chat-to-editor flow is operational: type message -> stream response -> click "Send to editor" -> content inserted at end of document
- All 3 insertion modes (append, cursor, replace) are implemented and ready
- Chat sessions are namespaced with :chat suffix, isolated from :feedback sessions
- Plan 04 (wizard flow) can build on this same infrastructure

---
*Phase: 11-chat-layout*
*Completed: 2026-02-13*
