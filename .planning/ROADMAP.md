# Roadmap: Froggo.app

## Milestones

- ✅ **v1.0 Dashboard Hardening** - Phases 1-4 (shipped 2026-02-12)
- ✅ **v2.0 Writing System** - Phases 5-10 (shipped 2026-02-13)
- ✅ **v2.1 Writing UX Redesign** - Phases 11-12 (shipped 2026-02-13)
- 🚧 **v3.0 App-Wide Polish & X/Twitter Overhaul** - Phases 13-21 (in progress)

## Phases

<details>
<summary>✅ v1.0 Dashboard Hardening (Phases 1-4) - SHIPPED 2026-02-12</summary>

### Phase 1: Security Hardening
**Goal**: All credentials stored securely, no injection vectors
**Plans**: 4 plans complete

### Phase 2: Fix Broken Features
**Goal**: Every listed broken feature works correctly
**Plans**: 3 plans complete

### Phase 3: Functional Fixes
**Goal**: Routing, guards, debounce, memo all correct
**Plans**: 3 plans complete

### Phase 4: Cleanup & Debloat
**Goal**: Dead code eliminated, codebase leaner
**Plans**: 2 plans complete

</details>

<details>
<summary>✅ v2.0 Writing System (Phases 5-10) - SHIPPED 2026-02-13</summary>

### Phase 5: Writing Foundation
**Goal**: Chapter-based editor with autosave exists
**Plans**: 2 plans complete

### Phase 6: Inline Feedback
**Goal**: User can highlight text and get AI alternatives inline
**Plans**: 3 plans complete

### Phase 7: Memory Store
**Goal**: Characters, timeline, facts persist and inject into AI context
**Plans**: 2 plans complete

### Phase 8: Research Library
**Goal**: Per-project SQLite research library with fact-checking works
**Plans**: 2 plans complete

### Phase 9: Outline & Versions
**Goal**: Chapter reordering and version snapshots with diff work
**Plans**: 2 plans complete

### Phase 10: Jess Integration
**Goal**: Jess agent available alongside Writer and Researcher
**Plans**: 1 plan complete

</details>

<details>
<summary>✅ v2.1 Writing UX Redesign (Phases 11-12) - SHIPPED 2026-02-13</summary>

### Phase 11: Chat Pane + 3-Pane Layout
**Goal**: Persistent AI chat in resizable 3-pane layout
**Plans**: 4 plans complete

### Phase 12: Setup Wizard
**Goal**: Conversational wizard creates complete book projects from brain dump
**Plans**: 4 plans complete

</details>

---

### 🚧 v3.0 App-Wide Polish & X/Twitter Overhaul (In Progress)

**Milestone Goal:** Every page functions correctly in dark mode, X/Twitter page fully rebuilt with working calendar and automation builder, Finance page wired end-to-end, Writing panes usable, Library populated with real data.

#### ✅ Phase 13: Global UI Consistency — COMPLETE 2026-02-18
**Goal**: Every page looks and behaves correctly in dark mode with consistent UI components
**Depends on**: Phase 12
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06
**Plans**: 5 plans complete

Plans:
- [x] 13-01-PLAN.md -- Define missing CSS tokens (bg-alt, bg0, card) for dark mode inputs
- [x] 13-02-PLAN.md -- Fix Agents page borders to use per-agent theme colors
- [x] 13-03-PLAN.md -- Standardize user chat bubbles (ChatPanel, ChatRoom, AgentModal, Writing)
- [x] 13-04-PLAN.md -- Standardize user chat bubbles (X/Twitter, Finance, Voice, QuickActions)
- [x] 13-05-PLAN.md -- Fix chat input bar flex layout alignment (pinned to bottom)

#### ✅ Phase 14: X/Twitter Identity, Dark Mode & Tab Structure — COMPLETE 2026-02-18
**Goal**: The X/Twitter page presents correctly (X branding, dark mode, clean tab order) with approval panels stripped from non-content tabs
**Depends on**: Phase 13
**Requirements**: XTW-01, XTW-02, XTW-03, XTW-04, XTW-05, XTW-06, XTW-07, XTW-08
**Plans**: 2 plans complete

Plans:
- [x] 14-01-PLAN.md -- X logo, page label, dark mode styling (XDraftComposer token fixes)
- [x] 14-02-PLAN.md -- Tab order, approval panel removal, automations routing bug fix

#### Phase 15: X/Twitter Content Flow
**Goal**: Content Plan and Drafts tabs show real draft content with image attachment support, and the agent chat is wired and fast
**Depends on**: Phase 14
**Requirements**: XTW-09, XTW-10, XTW-11, XTW-12, XTW-13
**Success Criteria** (what must be TRUE):
  1. Content Plan tab approval queue shows actual final drafts (not placeholders)
  2. Drafts tab shows final drafts ready for review
  3. Posts in Content Plan and Drafts support attaching an image
  4. Chat on Content Plan tab connects to a real agent (not the "researcher" stub) and first token appears without multi-second delay
**Plans**: 2 plans

Plans:
- [ ] 15-01-PLAN.md -- Replace center pane composers with list/viewer + image attachment UI
- [ ] 15-02-PLAN.md -- Verify agent chat wiring to writer + fix send button styling

#### Phase 16: X/Twitter Calendar
**Goal**: The X/Twitter calendar reuses the existing schedule component, shows tweet events colour-coded by status, and supports drag-to-reschedule
**Depends on**: Phase 15
**Requirements**: XTW-14, XTW-15, XTW-16, XTW-17, XTW-18
**Success Criteria** (what must be TRUE):
  1. Calendar uses the same component as schedule.tsx — not a custom re-implementation
  2. Scheduled tweets appear as events on the calendar, colour-coded by status (research / plan / draft / scheduled)
  3. User can drag a tweet event to a different day and the tweet's scheduled date updates
  4. Top-right button on calendar reads "Create Tweet" (not "content mix")
  5. Calendar view is calendar + chat interface only — no approval panel visible
**Plans**: TBD

Plans:
- [ ] 16-01: Wire schedule.tsx component + tweet events + colour coding
- [ ] 16-02: Drag-to-reschedule + Create Tweet button + layout cleanup

#### Phase 17: X/Twitter Mentions & Reply Guy
**Goal**: Mentions tab shows incoming mentions with inline reply capability, Reply Guy shows suggestions inline with approve/edit/send per item — both with agent chat
**Depends on**: Phase 15
**Requirements**: XTW-19, XTW-20, XTW-21, XTW-22, XTW-23, XTW-24
**Success Criteria** (what must be TRUE):
  1. Mentions tab shows incoming mentions and the user can reply directly from the mentions UI without leaving the tab
  2. User can inject a response to a mention from within the mentions UI
  3. Mentions tab has a chat interface connected to an agent
  4. Reply Guy shows reply suggestions in the main UI — not inside an approval side panel
  5. Each Reply Guy suggestion has inline approve / edit / send controls
  6. Reply Guy has a chat interface connected to an agent
**Plans**: TBD

Plans:
- [ ] 17-01: Mentions tab inline reply + agent chat
- [ ] 17-02: Reply Guy inline suggestions + approve/edit/send + agent chat

#### Phase 18: X/Twitter Automations & Analytics
**Goal**: Automations tab has a working visual rule builder and agent chat; Analytics tab delivers a full metrics breakdown with downloadable report
**Depends on**: Phase 15
**Requirements**: XTW-25, XTW-26, XTW-27, XTW-28, XTW-29, XTW-30, XTW-31
**Success Criteria** (what must be TRUE):
  1. Automations tab has a visual rule builder (restored to pre-existing state or rebuilt)
  2. Automations tab has an agent chat interface (existing functionality preserved)
  3. Automations tab has no approval panel
  4. Analytics tab exists at the end of the nav and shows posts, engagement, reach, and top content breakdown
  5. Analytics includes a competitor insights section
  6. User can download a daily insights report as a text file from the Analytics tab
**Plans**: TBD

Plans:
- [ ] 18-01: Automations visual rule builder + layout cleanup
- [ ] 18-02: Analytics tab — metrics, competitor insights, downloadable report

#### Phase 19: Writing Pane Layout Fixes
**Goal**: Writing module 3-pane layout is usable on first load with visible drag handles and workable minimum widths
**Depends on**: Phase 12
**Requirements**: WRT-01, WRT-02, WRT-03, WRT-04
**Success Criteria** (what must be TRUE):
  1. Left double-bar drag handles between panes 1 and 2 are visible and functional on first load without any manual resizing
  2. Pane 1 (chapters list) opens at ≥180px and renders chapter content immediately
  3. Pane 2 (AI chat) opens at ≥280px and renders the chat interface immediately
  4. Dragging any pane handle works smoothly across the full usable width range without snapping or collapsing unexpectedly
**Plans**: TBD

Plans:
- [ ] 19-01: Pane min-widths, default sizes, and double-bar handle visibility

#### Phase 20: Library Population & Tagging
**Goal**: Library shows real agent skills, all files are taggable with project/category/type, and file categories cover the full taxonomy
**Depends on**: Phase 13
**Requirements**: LIB-01, LIB-02, LIB-03
**Success Criteria** (what must be TRUE):
  1. Skills section in Library reads and displays actual agent skills from the system — no empty state on first load
  2. Every file in Library can be tagged with: project name, category, and content type
  3. File category picker includes: Marketing, UI/Design, Dev, Research, Finance, Test Logs, Content, Social, Other
**Plans**: TBD

Plans:
- [ ] 20-01: Agent skills data wiring + file tagging + expanded categories

#### Phase 21: Finance End-to-End Wiring
**Goal**: Finance page fully functional — insights load, document upload works, agent chat connects, budget creation works, and UI matches app style
**Depends on**: Phase 13
**Requirements**: FIN-01, FIN-02, FIN-03, FIN-04, FIN-05, FIN-06
**Success Criteria** (what must be TRUE):
  1. Finance insights panel loads data without error when the page opens
  2. Document upload accepts PDF and CSV files — file picker opens and the file is processed
  3. Chat panel initializes and connects to the finance-manager agent without error
  4. "Create Budget" button opens a budget creation flow (form or modal)
  5. "Upload Statement" button opens the file picker and ingests the selected file
  6. Finance chat UI visually matches the app-wide chat style established in Phase 13
**Plans**: TBD

Plans:
- [ ] 21-01: Finance insights, upload, and IPC wiring
- [ ] 21-02: Budget creation flow + chat UI consistency

---

## Progress

**Execution Order:**
Phases 13-21 execute roughly in order. Phases 19 and 20 can run parallel to 14-18 (independent areas). Phase 21 should follow Phase 13 (UI consistency dependency for chat style).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Security Hardening | v1.0 | 4/4 | Complete | 2026-02-12 |
| 2. Fix Broken Features | v1.0 | 3/3 | Complete | 2026-02-12 |
| 3. Functional Fixes | v1.0 | 3/3 | Complete | 2026-02-12 |
| 4. Cleanup & Debloat | v1.0 | 2/2 | Complete | 2026-02-12 |
| 5. Writing Foundation | v2.0 | 2/2 | Complete | 2026-02-13 |
| 6. Inline Feedback | v2.0 | 3/3 | Complete | 2026-02-13 |
| 7. Memory Store | v2.0 | 2/2 | Complete | 2026-02-13 |
| 8. Research Library | v2.0 | 2/2 | Complete | 2026-02-13 |
| 9. Outline & Versions | v2.0 | 2/2 | Complete | 2026-02-13 |
| 10. Jess Integration | v2.0 | 1/1 | Complete | 2026-02-13 |
| 11. Chat Pane + 3-Pane Layout | v2.1 | 4/4 | Complete | 2026-02-13 |
| 12. Setup Wizard | v2.1 | 4/4 | Complete | 2026-02-13 |
| 13. Global UI Consistency | v3.0 | 5/5 | Complete | 2026-02-18 |
| 14. X/Twitter Identity + Tabs | v3.0 | 2/2 | Complete | 2026-02-18 |
| 15. X/Twitter Content Flow | v3.0 | 0/2 | Not started | - |
| 16. X/Twitter Calendar | v3.0 | 0/2 | Not started | - |
| 17. X/Twitter Mentions + Reply Guy | v3.0 | 0/2 | Not started | - |
| 18. X/Twitter Automations + Analytics | v3.0 | 0/2 | Not started | - |
| 19. Writing Pane Layout | v3.0 | 0/1 | Not started | - |
| 20. Library Population | v3.0 | 0/1 | Not started | - |
| 21. Finance End-to-End | v3.0 | 0/2 | Not started | - |
