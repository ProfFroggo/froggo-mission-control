# Requirements: Froggo.app Dashboard Hardening

**Defined:** 2026-02-11
**Core Value:** Kevin can trust that Froggo.app is secure, reliable, and honest -- every button works, every indicator reflects reality.

## v1 Requirements

Requirements for this hardening milestone. Each maps to roadmap phases.

### Security

- [x] **SEC-01**: No hardcoded API tokens in source code (Twitter Bearer/Access, Gemini key, Gateway token)
- [x] **SEC-02**: No PII in source code (emails, phone numbers, employer info)
- [x] **SEC-03**: DevTools disabled in production builds
- [x] **SEC-04**: All SQL queries use parameterized inputs (156 prepare() calls, zero shell-exec sqlite3)
- [x] **SEC-05**: Filesystem IPC handlers (fs:writeBase64, fs:readFile, fs:append) restricted to safe paths
- [x] **SEC-06**: db:exec handler cannot execute arbitrary SQL beyond safe SELECT patterns
- [x] **SEC-07**: Encryption key not using hardcoded default (`default-key-change-me-in-production`)

### Broken Features

- [x] **FIX-01**: Fix wrong DB path ~/Froggo/clawd/data/ -> ~/clawd/data/ in 4 files (library, x-automations, connected-accounts, main.ts)
- [x] **FIX-02**: Fix agents:spawnForTask to use dispatcher/openclaw instead of deleted spawn-agent-with-retry.py
- [x] **FIX-03**: Register missing AI IPC handlers (ai:generate-content, ai:generateReply, ai:getAnalysis) or remove from preload
- [x] **FIX-04**: Fix tasks:list WHERE clause bug (cancelled=0 -> archived=0)
- [x] **FIX-05**: Fix Dashboard.tsx DEFAULT_LAYOUT key (id: -> i: for active-work widget)
- [x] **FIX-06**: Fix AgentPanel dynamic Tailwind hover classes (use lookup map)
- [x] **FIX-07**: Fix ChatRoomView filtered message index mismatch for avatar grouping
- [x] **FIX-08**: Guard InboxPanel JSON.parse(metadata) with try/catch
- [x] **FIX-09**: Replace all `clawdbot` CLI refs with `openclaw` in 4 frontend files (VoiceChat x2, InboxPanel, TaskDetail)
- [x] **FIX-10**: Fix stale ~/.clawdbot/ paths in main.ts (ElevenLabs, Anthropic key, OpenAI key, sessions.db x3)

### Functional

- [x] **FUNC-01**: Fix matchTaskToAgent routing to include all 9+ agents (not just coder/researcher/writer/chief)
- [x] **FUNC-02**: Fix InboxPanel approval routing to use routing table instead of hardcoding to coder
- [x] **FUNC-03**: Wrap DMFeed in ProtectedPanels error boundary
- [x] **FUNC-04**: Add null guards to all clawdbot.* IPC calls that currently crash in web mode (TokenUsage, AgentTokenDetail, TaskDetail x6)
- [x] **FUNC-05**: Fix notification debounce collision (task/message/approval share one timer)
- [x] **FUNC-06**: Fix double gateway.getSessions() calls every 30s (merge fetchSessions + loadGatewaySessions)
- [x] **FUNC-07**: Fix phantom task creation in store (approveItem/adjustItem create unsynced tasks)
- [x] **FUNC-08**: Fix Kanban memo comparator to include isDeleting, isSpawning, activeSessions
- [x] **FUNC-09**: Add localStorage size guard to chatRoomStore (cap messages per room)
- [x] **FUNC-10**: Fix dual broadcast listeners causing double task reloads

### Cleanup

- [ ] **CLEAN-01**: Delete dead lib files (readState.ts, queryCache.ts, optimizedQueries.ts, performanceMonitoring.ts, smartAccountSelector.ts, voiceService.ts, api/gateway.ts)
- [ ] **CLEAN-02**: Delete dead panel exports from ProtectedPanels (ThreePaneInbox, CommsInbox, UnifiedCommsInbox, CalendarPanel, ContentCalendar)
- [ ] **CLEAN-03**: Remove dead state/functions from store (clearCompletedApprovals, sessions field, getAgentPrompt always-empty)
- [ ] **CLEAN-04**: Remove dead code from components (commented functions, unused imports, unused state vars with _ prefix)
- [ ] **CLEAN-05**: Delete .bak files from src/ (agentContext.ts.bak, geminiLiveService blobs, panelConfig backup)
- [ ] **CLEAN-06**: Fix non-standard CSS classes in QuickStatsWidget (no-shrink, flex-fill, message-preview, no-wrap)
- [ ] **CLEAN-07**: Remove debug info from MorningBrief production UI
- [ ] **CLEAN-08**: Fix conflicting keyboard shortcuts in Settings (Cmd+6 and Cmd+7 collisions)

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Modularity

- **MOD-01**: Break electron/main.ts into domain-specific modules (tasks, agents, inbox, etc.)
- **MOD-02**: Consolidate competing account services (JSON file vs SQLite) into one
- **MOD-03**: Rename preload namespace from `clawdbot` to `openclaw`
- **MOD-04**: Implement notification channel stubs (email, Discord, Telegram marked "coming soon")

## Out of Scope

| Feature | Reason |
|---------|--------|
| New UI features | This is hardening, not feature development |
| UI redesign | Only fixing broken/inconsistent elements |
| electron/main.ts breakup | Too large for quick depth -- tracked as MOD-01 for v2 |
| preload namespace rename | Cosmetic change touching every component -- tracked as MOD-03 |
| Voice chat LLM token waste | Requires architectural change to calendar/email checks |
| sendChat race condition fix | Known, complex, affects core gateway -- needs careful approach |

## Traceability

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| SEC-01 | Phase 1 | 01-01 | Complete |
| SEC-02 | Phase 1 | 01-01 | Complete |
| SEC-03 | Phase 1 | 01-02 | Complete |
| SEC-04 | Phase 1 | 01-02, 01-03, 01-04, 01-05, 01-06 | Complete |
| SEC-05 | Phase 1 | 01-02 | Complete |
| SEC-06 | Phase 1 | 01-02 | Complete |
| SEC-07 | Phase 1 | 01-01 | Complete |
| FIX-01 | Phase 2 | 02-01 | Complete |
| FIX-02 | Phase 2 | 02-01 | Complete |
| FIX-03 | Phase 2 | 02-02 | Complete |
| FIX-04 | Phase 2 | 02-01 | Complete |
| FIX-05 | Phase 2 | 02-01 | Complete |
| FIX-06 | Phase 2 | 02-01 | Complete |
| FIX-07 | Phase 2 | 02-01 | Complete |
| FIX-08 | Phase 2 | 02-01 | Complete |
| FIX-09 | Phase 2 | 02-01 | Complete |
| FIX-10 | Phase 2 | 02-01 | Complete |
| FUNC-01 | Phase 3 | 03-01 | Complete |
| FUNC-02 | Phase 3 | 03-01 | Complete |
| FUNC-03 | Phase 3 | 03-01 | Complete |
| FUNC-04 | Phase 3 | 03-01 | Complete |
| FUNC-05 | Phase 3 | 03-01 | Complete |
| FUNC-06 | Phase 3 | 03-02 | Complete |
| FUNC-07 | Phase 3 | 03-02 | Complete |
| FUNC-08 | Phase 3 | 03-02 | Complete |
| FUNC-09 | Phase 3 | 03-02 | Complete |
| FUNC-10 | Phase 3 | 03-02 | Complete |
| CLEAN-01 | Phase 4 | 04-01 | Pending |
| CLEAN-02 | Phase 4 | 04-01 | Pending |
| CLEAN-03 | Phase 4 | 04-01 | Pending |
| CLEAN-04 | Phase 4 | 04-01 | Pending |
| CLEAN-05 | Phase 4 | 04-01 | Pending |
| CLEAN-06 | Phase 4 | 04-02 | Pending |
| CLEAN-07 | Phase 4 | 04-02 | Pending |
| CLEAN-08 | Phase 4 | 04-02 | Pending |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 35
- Mapped to plans: 35
- Unmapped: 0

---
*Requirements defined: 2026-02-11*
*Last updated: 2026-02-11 -- roadmap created, plan assignments added*
