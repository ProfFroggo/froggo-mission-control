# Changelog

All notable changes to Froggo Dashboard will be documented in this file.

---

## [Unreleased]

### Phase 1: Epic Calendar (2026-01-27 → 2026-01-28)

#### Added
- **Epic Calendar** with 4 views (Month, Week, Day, Agenda) - 634 lines
- **Content Scheduler** for Twitter and Email - 439 lines
- Google Calendar integration via `gog calendar` CLI
- Multi-account support for Google Calendar
- Calendar CRUD operations (create/edit/delete event modals)
- Drag-and-drop event rescheduling with confirmation
- Schedule panel with Calendar + Scheduler tabs
- Keyboard shortcut: **Cmd+Shift+S** for Schedule panel
- Approval queue integration for scheduled posts
- Schedule processor (runs every 30 seconds)
- Event color coding by account (blue/purple)
- Today indicator in all calendar views
- Current time indicator in Week/Day views
- All-day event support
- Event click to view/edit details
- Delete confirmation dialogs
- Visual drag feedback (opacity, border highlights)
- Reschedule confirmation with before/after comparison
- Platform selector (Tweet/Email/Message)
- Character counter (280 for tweets)
- Date/Time validation (no past dates)
- Status filtering (Pending/Sent/All)
- Send now functionality
- Edit/Delete/Cancel scheduled posts
- Auto-refresh every 30 seconds

#### Changed
- **Schedule panel** now has two tabs: Calendar + Content Scheduler
- Deprecated CalendarWidget on Dashboard (replaced by EpicCalendar)
- Email scheduled posts now create **drafts** instead of auto-sending (security fix)
- Approval queue integration added to schedule:add handler

#### Fixed
- **Phase 1.5 Critical Bug #1:** Approval queue integration was completely missing
- **Phase 1.5 Critical Bug #2:** Email auto-send was a security risk (now creates drafts)
- Morning Brief modal dismissal (ESC key, click-outside) - Phase 1.1
- QuickModals ESC key support added
- EPIPE error in task notification watcher
- TypeScript property access errors (Session, InboxPanel, CommsInbox)
- TopBar useEffect cleanup function type
- CommsInbox ReplyDraft type safety
- Activity interface missing 'error' type
- Window.electron type declarations added

#### Technical
- 15 commits for Phase 1
- ~1200 lines of code added/modified
- TypeScript error reduction: 250 → 117 (53%)
- 6 agents spawned (3 Coder agents for phases 1.3, 1.4, 1.5)
- 7 documentation files created (~50KB)

#### Backend Integration Status
**Blocked:** Calendar CRUD operations require gog CLI commands that don't exist yet:
- `gog calendar events create` ❌
- `gog calendar events update` ❌
- `gog calendar events delete` ❌

**Working:**
- `gog calendar events --days N` ✅ (read-only)
- Content Scheduler execution ✅
- Twitter posting via `bird` ✅
- Email drafts via `gog gmail drafts create` ✅

---

## [0.1.0] - 2026-01-25

### Initial Release

#### Added
- Dashboard with stats overview
- Chat panel with Gateway integration
- Kanban board with drag-and-drop
- Agent management (spawn Coder/Researcher/Writer/Chief)
- Sessions view with channel filtering
- Inbox/Approval queue
- X/Twitter integration
- Voice panel with Vosk real-time transcription
- Keyboard shortcuts (⌘1-8, ⌘K, ⌘⇧S)
- Morning Brief modal
- Task notification system
- froggo-db integration
- Multi-channel support (Discord, Telegram, WhatsApp, Web)

#### Tech Stack
- Electron + React + TypeScript
- Tailwind CSS
- Zustand state management
- SQLite (froggo.db)
- Clawdbot Gateway backend

---

## Legend

- **Added:** New features
- **Changed:** Changes in existing functionality
- **Deprecated:** Soon-to-be removed features
- **Removed:** Removed features
- **Fixed:** Bug fixes
- **Security:** Vulnerability fixes
- **Technical:** Internal changes, refactoring, dependencies
