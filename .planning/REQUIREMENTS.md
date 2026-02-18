# Requirements: Froggo.app v3.0

**Defined:** 2026-02-17
**Core Value:** Every page works correctly in dark mode, X/Twitter page is fully functional, Finance page works, Writing panes are usable, Library has real data.

## v3.0 Requirements

### UI — Global Dark Mode & Consistency

- [ ] **UI-01**: All text inputs use dark background + light text in dark mode (no white-on-white)
- [ ] **UI-02**: Agents page more-dropdown button border uses theme color (not white)
- [ ] **UI-03**: Agents page divider lines above/below dropdown buttons use theme color (not white)
- [ ] **UI-04**: User message chat bubbles use 50% opacity green background (not full bright green)
- [ ] **UI-05**: All chat dialogues across every page use the same component and styling (Chat page style as reference)
- [ ] **UI-06**: Chat input bar bottom alignment consistent across all pages

### X/Twitter — Identity & Dark Mode

- [ ] **XTW-01**: Twitter bird icon replaced with X logo everywhere on X/Twitter page
- [ ] **XTW-02**: All inputs, dropdowns, cards, and backgrounds on X/Twitter page are dark-mode styled
- [ ] **XTW-03**: Page label uses "X / Twitter" not "Twitter"

### X/Twitter — Tab Structure

- [ ] **XTW-04**: Tab nav order is: Content Plan → Drafts → Calendar → Mentions → Reply Guy → Content Mix Tracker → Automations → Analytics
- [ ] **XTW-05**: Approval queue side panel removed from Calendar tab
- [ ] **XTW-06**: Approval queue side panel removed from Mentions tab
- [ ] **XTW-07**: Approval queue side panel removed from Reply Guy tab
- [ ] **XTW-08**: Approval queue side panel removed from Automations tab

### X/Twitter — Chat Wiring

- [x] **XTW-09**: Chat on Content Plan / Multi-agent pipeline tab is wired to a real agent (not "researcher" stub)
- [x] **XTW-10**: Chat responses are fast (no multi-second delay before first token)

### X/Twitter — Content Plan & Drafts

- [x] **XTW-11**: Content Plan tab approval queue shows final drafts
- [x] **XTW-12**: Drafts tab shows final drafts ready for review
- [x] **XTW-13**: Posts in Content Plan and Drafts support image attachment

### X/Twitter — Calendar

- [ ] **XTW-14**: Calendar uses same calendar component as schedule.tsx (not a custom re-implementation)
- [ ] **XTW-15**: Calendar shows scheduled tweets as events, colour-coded by status (research/plan/draft/scheduled)
- [ ] **XTW-16**: Calendar events are draggable to different days to reschedule tweets
- [ ] **XTW-17**: Calendar top-right "content mix" button replaced with "Create Tweet"
- [ ] **XTW-18**: Calendar layout is calendar + chat interface only (no approval panel)

### X/Twitter — Mentions

- [ ] **XTW-19**: Mentions tab shows incoming mentions with reply capability inline (no approval panel)
- [ ] **XTW-20**: User can inject a response to a mention directly from the mentions UI
- [ ] **XTW-21**: Mentions tab has chat interface with agent

### X/Twitter — Reply Guy

- [ ] **XTW-22**: Reply Guy shows reply suggestions directly in main UI (not in approval side panel)
- [ ] **XTW-23**: Reply Guy has inline approve/edit/send per reply
- [ ] **XTW-24**: Reply Guy has chat interface with agent

### X/Twitter — Automations

- [ ] **XTW-25**: Automations has chat interface with agent (existing, keep)
- [ ] **XTW-26**: Automation builder UI rebuilt (visual rule builder that existed before)
- [ ] **XTW-27**: No approval panel on automations tab

### X/Twitter — Analytics

- [ ] **XTW-28**: Analytics tab exists at end of nav
- [ ] **XTW-29**: Analytics shows total breakdown: posts, engagement, reach, top content
- [ ] **XTW-30**: Analytics includes competitor insights section
- [ ] **XTW-31**: Daily insights report downloadable as text file

### Writing Module — Pane Layout

- [ ] **WRT-01**: Left double-bar (pane 1 + pane 2 handles) visible and functional on first load
- [ ] **WRT-02**: Pane 1 (chapters list) has usable min-width (≥180px) and renders content on first open
- [ ] **WRT-03**: Pane 2 (AI chat) has usable min-width (≥280px) and renders content on first open
- [ ] **WRT-04**: Panel width adjustments via drag handle work across the full usable range

### Library

- [ ] **LIB-01**: Skills section reads and displays actual agent skills from the system (not empty state)
- [ ] **LIB-02**: Files have tagging: project name, category, content type
- [ ] **LIB-03**: File categories expanded to include: Marketing, UI/Design, Dev, Research, Finance, Test Logs, Content, Social, Other

### Finance

- [ ] **FIN-01**: Finance insights load without error on page open
- [ ] **FIN-02**: Document upload (PDF/CSV) functional — file picker opens and processes file
- [ ] **FIN-03**: Chat successfully initializes and connects to finance-manager agent
- [ ] **FIN-04**: "Create Budget" button opens budget creation flow
- [ ] **FIN-05**: "Upload Statement" button functional (file picker + ingest)
- [ ] **FIN-06**: Finance chat UI matches app-wide chat style

## v4.0 Requirements (Deferred)

### X/Twitter
- **XTW-F01**: Scheduled tweet publishing via X API (direct post from app)
- **XTW-F02**: Thread composer with multi-tweet chains
- **XTW-F03**: Competitor tracking configuration UI

### Finance
- **FIN-F01**: Multi-account budget tracking
- **FIN-F02**: Recurring transaction detection
- **FIN-F03**: Export to spreadsheet

## Out of Scope

| Feature | Reason |
|---------|--------|
| electron/main.ts monolith breakup | Tracked separately, too large for this milestone |
| preload rename (clawdbot → openclaw) | Cosmetic, deferred |
| Real X/Twitter API posting | Requires API credentials setup, separate milestone |
| Multi-user collaboration | Single-user only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UI-01 | Phase 13 — Global UI Consistency | Complete |
| UI-02 | Phase 13 — Global UI Consistency | Complete |
| UI-03 | Phase 13 — Global UI Consistency | Complete |
| UI-04 | Phase 13 — Global UI Consistency | Complete |
| UI-05 | Phase 13 — Global UI Consistency | Complete |
| UI-06 | Phase 13 — Global UI Consistency | Complete |
| XTW-01 | Phase 14 — X/Twitter Identity + Tabs | Complete |
| XTW-02 | Phase 14 — X/Twitter Identity + Tabs | Complete |
| XTW-03 | Phase 14 — X/Twitter Identity + Tabs | Complete |
| XTW-04 | Phase 14 — X/Twitter Identity + Tabs | Complete |
| XTW-05 | Phase 14 — X/Twitter Identity + Tabs | Complete |
| XTW-06 | Phase 14 — X/Twitter Identity + Tabs | Complete |
| XTW-07 | Phase 14 — X/Twitter Identity + Tabs | Complete |
| XTW-08 | Phase 14 — X/Twitter Identity + Tabs | Complete |
| XTW-09 | Phase 15 — X/Twitter Content Flow | Complete |
| XTW-10 | Phase 15 — X/Twitter Content Flow | Complete |
| XTW-11 | Phase 15 — X/Twitter Content Flow | Complete |
| XTW-12 | Phase 15 — X/Twitter Content Flow | Complete |
| XTW-13 | Phase 15 — X/Twitter Content Flow | Complete |
| XTW-14 | Phase 16 — X/Twitter Calendar | Pending |
| XTW-15 | Phase 16 — X/Twitter Calendar | Pending |
| XTW-16 | Phase 16 — X/Twitter Calendar | Pending |
| XTW-17 | Phase 16 — X/Twitter Calendar | Pending |
| XTW-18 | Phase 16 — X/Twitter Calendar | Pending |
| XTW-19 | Phase 17 — X/Twitter Mentions + Reply Guy | Pending |
| XTW-20 | Phase 17 — X/Twitter Mentions + Reply Guy | Pending |
| XTW-21 | Phase 17 — X/Twitter Mentions + Reply Guy | Pending |
| XTW-22 | Phase 17 — X/Twitter Mentions + Reply Guy | Pending |
| XTW-23 | Phase 17 — X/Twitter Mentions + Reply Guy | Pending |
| XTW-24 | Phase 17 — X/Twitter Mentions + Reply Guy | Pending |
| XTW-25 | Phase 18 — X/Twitter Automations + Analytics | Pending |
| XTW-26 | Phase 18 — X/Twitter Automations + Analytics | Pending |
| XTW-27 | Phase 18 — X/Twitter Automations + Analytics | Pending |
| XTW-28 | Phase 18 — X/Twitter Automations + Analytics | Pending |
| XTW-29 | Phase 18 — X/Twitter Automations + Analytics | Pending |
| XTW-30 | Phase 18 — X/Twitter Automations + Analytics | Pending |
| XTW-31 | Phase 18 — X/Twitter Automations + Analytics | Pending |
| WRT-01 | Phase 19 — Writing Pane Layout | Pending |
| WRT-02 | Phase 19 — Writing Pane Layout | Pending |
| WRT-03 | Phase 19 — Writing Pane Layout | Pending |
| WRT-04 | Phase 19 — Writing Pane Layout | Pending |
| LIB-01 | Phase 20 — Library Population | Pending |
| LIB-02 | Phase 20 — Library Population | Pending |
| LIB-03 | Phase 20 — Library Population | Pending |
| FIN-01 | Phase 21 — Finance End-to-End | Pending |
| FIN-02 | Phase 21 — Finance End-to-End | Pending |
| FIN-03 | Phase 21 — Finance End-to-End | Pending |
| FIN-04 | Phase 21 — Finance End-to-End | Pending |
| FIN-05 | Phase 21 — Finance End-to-End | Pending |
| FIN-06 | Phase 21 — Finance End-to-End | Pending |

**Coverage:**
- v3.0 requirements: 50 total (UI: 6, XTW: 31, WRT: 4, LIB: 3, FIN: 6)
- Mapped to phases: 50/50
- Unmapped: 0

Note: REQUIREMENTS.md header stated "46 total" — actual count is 50. XTW-01 through XTW-31 = 31 requirements. All 50 are mapped.

---
*Requirements defined: 2026-02-17*
*Last updated: 2026-02-17 — traceability populated by roadmapper*
