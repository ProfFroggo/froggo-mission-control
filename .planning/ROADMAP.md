# Roadmap: Mission Control Agent Autonomy

## Overview

Transform Mission Control from a semi-autonomous platform where tasks constantly get stuck into a fully self-healing agent execution system. Work progresses from critical pipeline fixes (tasks must flow) through memory and planning infrastructure (agents must remember and plan) to automated knowledge management (the system must learn).

## Domain Expertise

None — internal system architecture, no external domain skills needed.

## Phases

- [ ] **Phase 1: Pipeline Critical Fix** — Re-dispatch after Clara rejection, close the autonomous loop
- [ ] **Phase 2: Clara Review Hardening** — Bulletproof pre-work and post-work review subprocess
- [x] **Phase 3: Task Dispatcher Hardening** — Reliable agent spawn, circuit breaker recovery
- [ ] **Phase 4: Auto-advance & Recovery** — Close every gap in the task pipeline
- [ ] **Phase 5: Agent Memory Unification** — Single structured memory dir per agent
- [ ] **Phase 6: Memory Injection & Checkpoints** — Agents receive relevant memory at dispatch, save learnings after completion
- [ ] **Phase 7: GSD Agent Planning Framework** — Structured project/campaign execution with phases and milestones
- [ ] **Phase 8: Cron & Scheduling Overhaul** — Reliable scheduling, execution history, content execution
- [ ] **Phase 9: Knowledge System Automation** — Living, self-updating knowledge base via Gemini cron
- [ ] **Phase 10: Integration Validation** — End-to-end pipeline test, verify all flows work autonomously

## Phase Details

### Phase 1: Pipeline Critical Fix
**Goal**: When Clara rejects a post-work review, the agent is automatically re-dispatched with Clara's feedback. This is THE critical missing piece — without it, rejected tasks sit in in-progress forever.
**Depends on**: Nothing (first phase, most urgent)
**Research**: Unlikely (internal code, patterns established)
**Plans**: 2 plans

Plans:
- [ ] 01-01: Add re-dispatch on Clara post-review rejection (claraReviewCron.ts)
- [ ] 01-02: Add re-dispatch on stuck in-progress detection (task watcher)

### Phase 2: Clara Review Hardening
**Goal**: Clara's review subprocess never fails silently. Every spawn produces a decision (approve/reject) or logs a clear error. No more false escalations.
**Depends on**: Phase 1
**Research**: Unlikely (CLI args, spawn patterns already known)
**Plans**: 3 plans

Plans:
- [ ] 02-01: Audit and fix all spawn args (--dangerously-skip-permissions, empty args, env stripping)
- [ ] 02-02: Add stdout/stderr capture + structured error logging for every Clara subprocess
- [ ] 02-03: Add Clara review timeout recovery (process killed → clear state, retry next cycle)

### Phase 3: Task Dispatcher Hardening
**Goal**: Agent dispatch never silently fails. Every spawn either succeeds or produces actionable error. Failed dispatches self-heal.
**Depends on**: Phase 2 (Clara fixes inform dispatcher fixes)
**Research**: Unlikely (same patterns as Phase 2)
**Plans**: 3 plans

Plans:
- [ ] 03-01: Audit dispatcher spawn args + env (same fixes as Clara)
- [ ] 03-02: Circuit breaker auto-recovery (open circuits close after cooldown period)
- [ ] 03-03: Dispatch failure → todo (not human-review), with exponential backoff on re-attempts

### Phase 4: Auto-advance & Recovery
**Goal**: Every task status has a clear next step. No dead ends. Tasks auto-advance through the pipeline.
**Depends on**: Phases 1-3
**Research**: Unlikely (internal logic)
**Plans**: 3 plans

Plans:
- [ ] 04-01: Auto-advance todo→internal-review when agent assigned (in review cron, not just POST)
- [ ] 04-02: Stuck task detection: in-progress >4h with no activity → re-dispatch or escalate
- [ ] 04-03: human-review recovery: after human takes action, task returns to pipeline automatically

### Phase 5: Agent Memory Unification
**Goal**: Every agent has a single, structured memory directory. Clean up fragmented locations. Establish the memory schema.
**Depends on**: Nothing (independent of pipeline fixes)
**Research**: Unlikely (filesystem organization)
**Plans**: 3 plans

Plans:
- [ ] 05-01: Audit all memory locations, design unified schema (~/mission-control/memory/agents/{id}/)
- [ ] 05-02: Migrate existing memory files, clean up duplicates (memory/memory/, scattered checkpoints)
- [ ] 05-03: Create memory dir structure for all 14 agents with README templates

### Phase 6: Memory Injection & Checkpoints
**Goal**: Agents receive relevant memory when dispatched and save learnings after task completion. Memory accumulates over time.
**Depends on**: Phase 5
**Research**: Likely (need to investigate best patterns for context injection into Claude CLI)
**Research topics**: How much context can be injected via --system-prompt, memory size limits, summarization strategies
**Plans**: 4 plans

Plans:
- [ ] 06-01: Memory injection at dispatch time (load agent memory → inject into system prompt)
- [ ] 06-02: Session checkpoint on task completion (extract key learnings → save to memory)
- [ ] 06-03: Memory summarization (keep memory files under size limits, compress old entries)
- [ ] 06-04: Clara pattern memory (review outcomes feed back into agent-specific improvement notes)

### Phase 7: GSD Agent Planning Framework
**Goal**: Agents use structured GSD-style planning for projects and campaigns. Multi-agent projects have roadmaps with phase assignments.
**Depends on**: Phase 4 (pipeline must be reliable first)
**Research**: Likely (need to design the multi-agent GSD protocol)
**Research topics**: How agents create/update phases, how to assign phases to different agents, progress tracking API
**Plans**: 5 plans

Plans:
- [ ] 07-01: Project planning data model (phases, milestones tables in SQLite)
- [ ] 07-02: MCP tools for agents to create/update project plans
- [ ] 07-03: Agent planning prompt (system instruction for GSD-style thinking)
- [ ] 07-04: Multi-agent phase assignment (route phases to specialist agents)
- [ ] 07-05: Campaign workspace integration (connect GSD plans to campaign UI)

### Phase 8: Cron & Scheduling Overhaul
**Goal**: Reliable scheduling with execution history, all cron jobs create tasks, content scheduling has execution engine.
**Depends on**: Phase 4 (pipeline must be reliable for task creation)
**Research**: Unlikely (existing patterns, just needs completion)
**Plans**: 3 plans

Plans:
- [ ] 08-01: Migrate cron storage from JSON to SQLite (execution history table)
- [ ] 08-02: Convert remaining message-mode cron jobs to taskTemplate
- [ ] 08-03: Content scheduling execution engine (check scheduled_items, fire at time)

### Phase 9: Knowledge System Automation
**Goal**: Knowledge base is living — daily Gemini review discovers new knowledge from tasks, meetings, agent notes. Articles stay current.
**Depends on**: Phase 6 (memory system must exist for knowledge to reference)
**Research**: Likely (Gemini API for knowledge synthesis)
**Research topics**: Gemini batch processing, knowledge graph generation, article freshness scoring
**Plans**: 4 plans

Plans:
- [ ] 09-01: Daily knowledge review cron (Gemini scans tasks, activity, agent notes for new knowledge)
- [ ] 09-02: Auto-create knowledge articles from discovered insights
- [ ] 09-03: Knowledge freshness scoring (flag stale articles for review/update)
- [ ] 09-04: Knowledge graph: auto-link related articles, visualize dependencies

### Phase 10: Integration Validation
**Goal**: End-to-end verification that the full pipeline works autonomously. Create test tasks, watch them flow through every stage.
**Depends on**: All previous phases
**Research**: Unlikely (testing existing system)
**Plans**: 2 plans

Plans:
- [ ] 10-01: Pipeline smoke test (create task → Clara approves → agent executes → Clara verifies → done)
- [ ] 10-02: Failure recovery test (kill agent mid-task, verify self-healing activates)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Pipeline Critical Fix | 0/2 | Not started | - |
| 2. Clara Review Hardening | 0/3 | Not started | - |
| 3. Task Dispatcher Hardening | 1/1 | Complete | 2026-03-15 |
| 4. Auto-advance & Recovery | 0/3 | Not started | - |
| 5. Agent Memory Unification | 0/3 | Not started | - |
| 6. Memory Injection & Checkpoints | 0/4 | Not started | - |
| 7. GSD Agent Planning Framework | 0/5 | Not started | - |
| 8. Cron & Scheduling Overhaul | 0/3 | Not started | - |
| 9. Knowledge System Automation | 0/4 | Not started | - |
| 10. Integration Validation | 0/2 | Not started | - |

**Adjacent phases (separate roadmap — `.planning/phases/21-session-architecture/ROADMAP.md`):**

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 21. Session Architecture | 5/5 | Complete | 2026-03-17 |

---

## Milestones

- ✅ **v1.0 Migration** — Phases 0–14 (shipped 2026-03-04)
- ✅ **v2.0 Froggo Platform** — Phases 15–22 (shipped 2026-03-05)
- ✅ **v3.0 Autonomous Core** — Phases 23–30 (shipped 2026-03-06)
- ✅ **v4.0 Agent & Module Library** — Phases 31–39 (shipped 2026-03-06)
- ✅ **v6.0 Security Hardening** — Phases 50–57 (shipped 2026-03-07)
- ✅ **v7.0 Design Consistency** — Phases 51–76 (shipped 2026-03-24)

---

### ✅ v7.0 Design Consistency (Complete — 2026-03-24)

**Milestone Goal:** One design bible across every panel, component, and state — 329 React components, all surfaces, all modals, all chat interfaces, all form controls brought under a single coherent system. The Library panel is the canonical reference for headers and tabs. Chat surfaces use Radix UI + assistant-ui with the app's own design tokens (no external fonts/colors). Zero hardcoded exceptions.

**Design Law:**
- **Panel header**: icon in `bg-mission-control-accent/20 rounded-lg` box + `text-mission-control-accent` icon + `text-xl font-semibold` title + `text-sm text-mission-control-text-dim` subtitle. Wrapper: `border-b border-mission-control-border bg-mission-control-surface`.
- **Tab nav**: `border-b-2 border-mission-control-accent` when active + `text-mission-control-accent` text/icon; `border-transparent text-mission-control-text-dim` when inactive. Icon + label inline. Flush with header bottom border.
- **Cards**: `border border-mission-control-border bg-mission-control-surface rounded-lg` — no per-item accent colors, no colored borders.
- **Chat surfaces**: `assistant-ui` primitives + Radix UI components + app design tokens only. No assistant-ui default fonts or colors.
- **All toggles/switches**: Radix Switch (pill-shaped). No square toggles.
- **All selectors**: Radix SegmentedControl, Select, or Tabs. No custom sliding divs.
- **Search bars**: Radix TextField.Root with consistent sizing everywhere.
- **No hardcoded colors**: No `bg-white`, `text-black`, `#hex` values. All from CSS variables.

---

#### Phase 51: Design System Primitives (Foundation)

**Goal**: Establish the canonical shared components that all other phases depend on. Rewrite `PanelHeader.tsx` to exactly match the Library pattern. Rewrite `src/components/ui/tabs.tsx` to use the border-b-2 underline pattern (not the current glass pill). Create a `TabNav` component for panels that build their tabs inline. After this phase, any panel importing from `ui/tabs` automatically gets correct styling.

**Root cause**: `ui/tabs.tsx` currently uses a glassmorphic filled-pill style (`bg-glass border border-glass-border`, `data-[state=active]:bg-mission-control-surface shadow-glass-sm`). This is the root cause of filled pills across every panel that imports from it. The existing `PanelHeader.tsx` renders a plain icon (no tinted box), uses `text-sm font-semibold` (wrong size), and `px-4 py-3` (wrong padding).

**Depends on**: Nothing (foundation phase)
**Research**: Unlikely — Library panel is the reference implementation
**Plans**: 3 plans

Plans:
- [ ] 51-01: Rewrite `src/components/ui/tabs.tsx` — replace glass pill with border-b-2 underline (TabsList becomes transparent border-b row, TabsTrigger becomes border-b-2 underline button matching Library pattern)
- [ ] 51-02: Rewrite `src/components/PanelHeader.tsx` — match Library pattern exactly: `p-6 pb-0` padding, icon in `bg-mission-control-accent/20 rounded-lg p-2` box, `text-xl font-semibold` title, `text-sm text-mission-control-text-dim` subtitle, wrapper with `border-b border-mission-control-border bg-mission-control-surface`
- [ ] 51-03: Create `src/components/TabNav.tsx` — shared tab navigation component for panels that build tabs with inline buttons (wraps the border-b-2 pattern into a reusable API: `tabs` array, `activeTab`, `onTabChange`, renders icon+label+border-b-2 buttons)

---

#### Phase 52: Sidebar & Navigation Polish

**Goal**: Sidebar nav items already fixed (color="gray" for inactive). This phase audits and polishes all remaining sidebar elements: search button styling, bottom icon row (SlidersHorizontal, HelpCircle, Keyboard, Settings, Expand/Collapse), AgentActivityBar integration, mobile hamburger + backdrop, and focus ring consistency. Ensure every interactive element in the sidebar is `variant="ghost" color="gray"` when inactive and `variant="soft"` when active.

**Depends on**: Phase 51
**Research**: Unlikely (Sidebar.tsx already read, patterns established)
**Plans**: 2 plans

Plans:
- [ ] 52-01: Audit sidebar search button and bottom icon row — verify ghost/gray treatment, consistent sizing, no accent bleed on inactive items
- [ ] 52-02: Verify AgentActivityBar uses correct token colors (no hardcoded), mobile nav renders correctly, keyboard shortcut badges use `bg-mission-control-border/80` styling

---

#### Phase 53: Dashboard & Widget Grid

**Goal**: Audit and fix the main Dashboard and DashboardRedesigned panels. Fix EditPanelsModal — the square panel toggle switch that's currently non-pill (appears to use a hardcoded or non-Radix Switch). Standardize widget cards (QuickStatsWidget, TokenSummaryWidget, TokenUsageWidget, InboxWidget, TodayCalendarWidget, QuickActionsWidget, WeatherWidget, NewContentWidget) — all use same card border/surface tokens, consistent padding, no hardcoded colors. Fix widget header typography to use design tokens.

**Depends on**: Phase 51 (PanelHeader ready)
**Research**: Unlikely (internal widget patterns)
**Plans**: 3 plans

Plans:
- [ ] 53-01: Audit Dashboard.tsx + DashboardRedesigned.tsx — fix header, fix any filled pill tabs, apply PanelHeader if missing
- [ ] 53-02: Fix EditPanelsModal — replace square toggle with Radix Switch (pill-shaped), verify all panel config controls use correct Radix components
- [ ] 53-03: Standardize all dashboard widgets (8 widgets) — consistent card border/bg tokens, heading size, icon treatment

---

#### Phase 54: Analytics Panel

**Goal**: AnalyticsPanel.tsx has the most visually wrong tab style observed — filled purple pill tabs for Overview, Real-Time, Reports, Benchmarks etc. Full-width header with date range controls on the right (non-standard layout). Fix: apply PanelHeader component, replace filled pills with border-b-2 underline tabs via ui/tabs.tsx. Audit AnalyticsDashboard.tsx, RealTimeAnalytics.tsx, ReportsPanel.tsx, PerformanceBenchmarks.tsx, PerformanceProfiler.tsx for consistent card/surface styling.

**Depends on**: Phase 51 (both PanelHeader and fixed ui/tabs.tsx)
**Research**: Unlikely (mechanical — apply canonical components)
**Plans**: 3 plans

Plans:
- [ ] 54-01: Fix AnalyticsPanel.tsx — apply PanelHeader, replace filled pill tab row with border-b-2 tabs using updated ui/tabs.tsx, fix header layout
- [ ] 54-02: Fix ReportsPanel.tsx (27KB) — header, tab style, card styling
- [ ] 54-03: Audit RealTimeAnalytics, PerformanceBenchmarks, PerformanceProfiler — consistent card/surface/border tokens

---

#### Phase 55: Task Board, Kanban & Task Modals

**Goal**: Fix Kanban.tsx column borders — remove dashed border from Ideas column, remove accent-colored border from Pre-review column, all columns use `border-mission-control-border`. Fix TaskDetailPanel.tsx (100KB) — its internal tabs use filled active style. Fix TaskModal.tsx, TaskQuickEdit.tsx. Ensure task status badges and indicators use semantic color tokens only.

**Depends on**: Phase 51
**Research**: Unlikely (targeted border/tab fixes)
**Plans**: 3 plans

Plans:
- [ ] 55-01: Fix Kanban.tsx — remove dashed/accent-colored column borders, standardize all column headers and card styling
- [ ] 55-02: Fix TaskDetailPanel.tsx — audit its 5 tabs (Details, Chat, Activity, etc.), replace filled active tab with border-b-2 underline via updated ui/tabs.tsx; fix any header inconsistencies
- [ ] 55-03: Fix TaskModal.tsx and TaskQuickEdit.tsx — consistent form control styling, Radix components throughout, no hardcoded colors

---

#### Phase 56: Approval Queue

**Goal**: ApprovalQueuePanel.tsx (61KB) currently has tabs centered full-width (wrong layout). Fix: left-aligned border-b-2 underline tabs via updated ui/tabs.tsx. Apply PanelHeader. Standardize approval card styling — pending/approved/rejected state colors use semantic tokens. Verify all action buttons (approve/reject/request-changes) use correct Radix Button variants.

**Depends on**: Phase 51
**Research**: Unlikely
**Plans**: 2 plans

Plans:
- [ ] 56-01: Fix ApprovalQueuePanel.tsx header and tab layout — apply PanelHeader, fix tab alignment from centered-full-width to left-aligned border-b-2
- [ ] 56-02: Standardize approval card states — pending/approved/rejected use `--color-warning`, `--color-success`, `--color-error` semantic tokens; action buttons use correct Radix variants

---

#### Phase 57: Agent Panel, Library & Leaderboard

**Goal**: AgentPanel.tsx — remove per-agent colored borders (cyan, blue, purple, green per agent) from agent cards, replace with `border-mission-control-border` + subtle hover. AgentLibraryPanel.tsx — same card standardization. AgentLeaderboard.tsx — leaderboard cards consistent border/surface. AgentHealthDashboard.tsx — health metric cards. Fix any filled pill tabs inside these panels.

**Depends on**: Phase 51
**Research**: Unlikely (token substitution)
**Plans**: 3 plans

Plans:
- [ ] 57-01: Fix AgentPanel.tsx — remove per-agent accent-colored card borders (every agent has its own color), standardize to `border-mission-control-border`, apply PanelHeader
- [ ] 57-02: Fix AgentLibraryPanel.tsx and AgentLeaderboard.tsx — same border standardization, consistent card layout
- [ ] 57-03: Fix AgentHealthDashboard.tsx, AgentMetricsCard.tsx, AgentTrendsChart.tsx, AgentUtilizationChart.tsx — consistent card/surface/border, no per-agent hardcoded colors

---

#### Phase 58: Agent Detail, Config & Soul Editor

**Goal**: AgentDetailModal.tsx — its Performance tab and other tabs use filled purple active style. Fix to border-b-2 underline. AgentConfigPanel.tsx (67KB, 5+ tabs) — same fix. AgentSoulEditor.tsx — consistent form styling. AgentSkillsModal.tsx — Skill Library is a dense checkbox grid with inline code-style labels; replace with clean card-based layout. AgentHireWizard.tsx multi-step wizard — consistent step indicator styling.

**Depends on**: Phase 51
**Research**: Unlikely
**Plans**: 3 plans

Plans:
- [ ] 58-01: Fix AgentDetailModal.tsx — replace filled active tabs with border-b-2 underline, apply consistent modal header pattern
- [ ] 58-02: Fix AgentConfigPanel.tsx (67KB) — all 5+ tabs to border-b-2 underline, form controls use Radix throughout, no hardcoded colors
- [ ] 58-03: Fix AgentSkillsModal.tsx / Skill Library — replace dense checkbox grid with card-based layout (one card per skill, icon + name + description + toggle); apply consistent card border/surface tokens

---

#### Phase 59: Chat Surfaces (assistant-ui Standardization)

**Goal**: All chat surfaces must use `assistant-ui` primitives (`ThreadPrimitive`, `MessagePrimitive`, `ComposerPrimitive`, `ActionBarPrimitive`) with Radix UI components, styled exclusively with app design tokens. NO assistant-ui default fonts or colors. Surfaces: ChatPanel.tsx (77KB), AgentChatModal.tsx, FinanceAgentChat.tsx, VoiceChatPanel.tsx (53KB), XAgentChatPane.tsx, ChatRoomView.tsx, TeamVoiceMeeting.tsx, writing/ChatPane.tsx, writing/ChatInput.tsx, writing/ChatMessage.tsx, writing/WizardChat.tsx.

**Depends on**: Phase 51
**Research**: Likely — audit current assistant-ui integration depth before planning changes
**Research topics**: Which surfaces already use ThreadPrimitive vs custom div rendering; assistant-ui styling API (className, CSS vars); how to override default styles with app tokens
**Plans**: 4 plans

Plans:
- [ ] 59-01: Audit all chat surfaces — which use assistant-ui primitives, which are custom; document gaps
- [ ] 59-02: Standardize ChatPanel.tsx and AgentChatModal.tsx to assistant-ui + app tokens
- [ ] 59-03: Standardize FinanceAgentChat.tsx, VoiceChatPanel.tsx, XAgentChatPane.tsx to assistant-ui + app tokens
- [ ] 59-04: Standardize writing/ chat components (ChatPane, ChatInput, ChatMessage, WizardChat) to consistent styling with app tokens

---

#### Phase 60: Communications & Inbox

**Goal**: CommsInbox3Pane.tsx — 3-pane email-style layout; verify pane headers match PanelHeader pattern, tab/filter bar uses border-b-2. InboxPanel.tsx (92KB) — audit its 3+ tabs and filter controls. PriorityInbox.tsx — consistent card styling. MarkdownMessage.tsx and MarkdownWithMentions.tsx — consistent message bubble styling with app tokens.

**Depends on**: Phase 51
**Research**: Unlikely
**Plans**: 2 plans

Plans:
- [ ] 60-01: Fix InboxPanel.tsx (92KB) — apply PanelHeader, fix tab/filter row to border-b-2, standardize message card styling
- [ ] 60-02: Fix CommsInbox3Pane.tsx and PriorityInbox.tsx — consistent pane headers, filter tabs, message item cards

---

#### Phase 61: Notifications

**Goal**: NotificationsPanelV2.tsx (41KB) — the "All (214)" filter pill currently renders as a filled purple pill. Fix to border-b-2 underline filter tabs or Radix SegmentedControl. NotificationCenter.tsx — consistent notification card styling. SnoozeModal.tsx / SnoozeNotifications.tsx — consistent modal/form styling.

**Depends on**: Phase 51
**Research**: Unlikely
**Plans**: 2 plans

Plans:
- [ ] 61-01: Fix NotificationsPanelV2.tsx — replace filled pill filter tabs with border-b-2 underline, apply PanelHeader, standardize notification item cards
- [ ] 61-02: Fix NotificationCenter.tsx, NotificationSettingsModal.tsx — consistent header, card, and form control styling

---

#### Phase 62: Library, Knowledge Base & Files

**Goal**: LibraryPanel.tsx uses the correct border-b-2 tab pattern (it IS the reference) but audit for any regressions. LibraryFilesTab.tsx (66KB), LibraryTemplatesTab.tsx (25KB), LibrarySkillsTab.tsx — verify consistent card styling for file/template/skill items. KnowledgeBase.tsx — card-per-.md-file layout, verify consistent with Library panel.

**Depends on**: Phase 51
**Research**: Unlikely (Library is the reference — verify, don't change)
**Plans**: 2 plans

Plans:
- [ ] 62-01: Audit LibraryPanel.tsx and all Library tabs — confirm border-b-2 tabs + PanelHeader match canonical pattern exactly; fix any minor regressions
- [ ] 62-02: Audit KnowledgeBase.tsx — verify card-per-article layout is consistent with Library tab card layout

---

#### Phase 63: Brand Assets & Writing Module

**Goal**: BrandAssetsPanel.tsx currently renders as a photo grid — fix to KB-style card layout (one card per .md asset/folder, icon + title + description, same card styling as KnowledgeBase). Writing module (writing/ — 28 files): audit WritingWorkspace.tsx, ChapterEditor.tsx, EditorToolbar.tsx, and supporting components for consistent header/tab/card styling.

**Depends on**: Phase 62 (KnowledgeBase card pattern confirmed)
**Research**: Unlikely (copy KB card pattern)
**Plans**: 2 plans

Plans:
- [ ] 63-01: Fix BrandAssetsPanel.tsx — replace photo grid with KB-style .md card layout; consistent card border/surface/icon tokens
- [ ] 63-02: Audit writing/ module (28 files) — fix any non-standard headers, tabs, or card patterns to match design system

---

#### Phase 64: Automations & Workflows

**Goal**: AutomationsPanel.tsx (30KB) — audit search bar (currently rounded with explicit border, different from Settings search bar), fix to standard Radix TextField.Root. XAutomationsPanel.tsx (25KB) and XAutomationsTab.tsx (43KB) — audit tabs and header. AutomationBuilderModal.tsx — consistent modal + form control styling. CronTab.tsx (26KB) — consistent header/card.

**Depends on**: Phase 51
**Research**: Unlikely
**Plans**: 2 plans

Plans:
- [ ] 64-01: Fix AutomationsPanel.tsx — standardize search bar to Radix TextField.Root, apply PanelHeader, fix any tab/filter styling
- [ ] 64-02: Fix XAutomationsPanel.tsx, XAutomationsTab.tsx, AutomationBuilderModal.tsx, CronTab.tsx — consistent header/tab/form pattern throughout

---

#### Phase 65: Schedule & Calendar

**Goal**: SchedulePanel.tsx has 4 tabs (Calendar, Tasks, Content Scheduler, Crons) using custom Button elements with border-b-2 inline classes. Migrate to TabNav component from Phase 51. Apply PanelHeader. ContentCalendar.tsx and ContentScheduler.tsx — consistent card/surface styling. CalendarFilterModal.tsx — consistent modal form.

**Depends on**: Phase 51 (TabNav component)
**Research**: Unlikely
**Plans**: 2 plans

Plans:
- [ ] 65-01: Fix SchedulePanel.tsx — migrate 4-tab navigation to TabNav component, apply PanelHeader
- [ ] 65-02: Audit ContentCalendar.tsx, ContentScheduler.tsx, CalendarFilterModal.tsx — consistent card/form/modal styling

---

#### Phase 66: Meetings Panel

**Goal**: MeetingsPanel.tsx (144KB — largest component) has: (1) green icon NOT in tinted box (missing `bg-mission-control-accent/20 rounded-lg` wrapper); (2) filled purple active tab. Fix: apply PanelHeader, fix all 8+ tabs to border-b-2 underline. Audit MeetingTranscriptionPanel.tsx, MeetingScribe.tsx, MeetingTranscribe.tsx, TeamVoiceMeeting.tsx, RoomSettingsPanel.tsx for consistent styling.

**Depends on**: Phase 51
**Research**: Unlikely (surgical fix to 144KB file)
**Plans**: 3 plans

Plans:
- [ ] 66-01: Fix MeetingsPanel.tsx header — wrap icon in accent-tinted box, apply PanelHeader component
- [ ] 66-02: Fix MeetingsPanel.tsx tab navigation — replace all filled pill tabs with border-b-2 underline; update all 8+ tabs
- [ ] 66-03: Audit MeetingTranscriptionPanel, MeetingScribe, MeetingTranscribe, TeamVoiceMeeting — consistent card/surface/header styling

---

#### Phase 67: Social Module (XTwitterPage + 30 X* Components)

**Goal**: XTwitterPage.tsx — the main social module shell with 5 inline header tabs (Pipeline, Engage, Intelligence, Measure, Configure); tabs currently show filled purple active state. Fix to border-b-2 underline. Apply PanelHeader. Then audit all 30 X* components: XAnalyticsView, XMentionsView, XPipelineView, XEngageView, XIntelligenceView, XCalendarView, XCampaignView, XCompetitorTracker, XComposeModal, XContentCalendar, XDraftComposer, XDraftListView, XEngagementChart, XEnhancedAnalyticsView, XHashtagIntelligence, XImageAttachment, XPlanListView, XPlanThreadComposer, XPublishComposer, XResearchIdeaEditor, XResearchView, XSetupWizard, XTabBar, XAgentContentQueue, XConfigureView. Consistent card/surface/border tokens throughout.

**Depends on**: Phase 51
**Research**: Unlikely (30 components, mostly card/tab/header mechanical fixes)
**Plans**: 4 plans

Plans:
- [ ] 67-01: Fix XTwitterPage.tsx — apply PanelHeader, fix 5 tab headers to border-b-2 underline via TabNav
- [ ] 67-02: Fix XAnalyticsView, XEnhancedAnalyticsView, XEngagementChart, XHashtagIntelligence, XCompetitorTracker — consistent card/chart/header styling
- [ ] 67-03: Fix XPipelineView, XMentionsView, XEngageView, XIntelligenceView, XDraftListView, XAgentContentQueue — consistent card/surface/border, no accent-colored item borders
- [ ] 67-04: Fix XCalendarView, XCampaignView, XContentCalendar, XComposeModal, XDraftComposer, XPlanThreadComposer, XPublishComposer, XResearchIdeaEditor, XResearchView, XSetupWizard, XConfigureView, XTabBar — form controls Radix throughout, consistent modal/panel headers

---

#### Phase 68: Projects & Campaigns

**Goal**: ProjectsPanel.tsx and CampaignsPanel.tsx — apply PanelHeader, fix any tab/filter styles. ProjectWorkspace.tsx and CampaignWorkspace.tsx — consistent workspace header/toolbar. CampaignCreationWizard.tsx and ProjectCreationWizard.tsx — consistent multi-step wizard indicator, Radix form controls. CampaignROIDashboard.tsx, CampaignTimelineView.tsx, CampaignBudgetTracker.tsx — card/surface styling.

**Depends on**: Phase 51
**Research**: Unlikely
**Plans**: 2 plans

Plans:
- [ ] 68-01: Fix ProjectsPanel.tsx, CampaignsPanel.tsx — PanelHeader, tab/filter standardization
- [ ] 68-02: Fix ProjectWorkspace, CampaignWorkspace, creation wizards, ROI dashboard, timeline view — consistent component-level styling

---

#### Phase 69: Modules Panel

**Goal**: ModulesPanel (wherever it lives — ModulesPage.tsx or ModuleLibraryPanel.tsx 50KB) — apply PanelHeader, fix tabs. ModuleBuilderView.tsx (in ModuleBuilder/ subdirectory) — consistent builder UI. MarketplaceBrowse.tsx — consistent marketplace card layout. ModuleInstallModal.tsx — consistent modal/form.

**Depends on**: Phase 51
**Research**: Unlikely
**Plans**: 2 plans

Plans:
- [ ] 69-01: Fix ModuleLibraryPanel.tsx (50KB) and ModulesPage.tsx — PanelHeader, border-b-2 tabs, consistent card styling
- [ ] 69-02: Fix ModuleBuilderView.tsx, ModuleBuilder/ConversationPanel.tsx, MarketplaceBrowse.tsx, ModuleInstallModal.tsx — consistent styling throughout

---

#### Phase 70: Settings & Configuration

**Goal**: SettingsPanel.tsx (46KB) and EnhancedSettingsPanel.tsx (113KB — largest single file) have the most complex tab systems (15+ tabs in Enhanced). Fix: migrate all tab navigation to updated ui/tabs.tsx. Apply PanelHeader. Fix search bar in settings (currently has a purple glow focus ring and wrong background — the most visually wrong search bar in the app). Fix trust tier selector (custom sliding div → Radix SegmentedControl). Fix model selector (custom pill slider → Radix Select or SegmentedControl). Fix all form sections for consistent input/label/button styling.

**Depends on**: Phase 51, Phase 72 (form controls)
**Research**: Unlikely (patterns established by Phase 72)
**Plans**: 4 plans

Plans:
- [ ] 70-01: Fix SettingsPanel.tsx (46KB) — apply PanelHeader, migrate tabs to ui/tabs.tsx, fix search bar focus ring + background
- [ ] 70-02: Fix EnhancedSettingsPanel.tsx (113KB, 15+ tabs) — migrate all tab navigation to ui/tabs.tsx; this is the largest single fix
- [ ] 70-03: Fix trust tier selector — replace custom sliding-div with Radix SegmentedControl
- [ ] 70-04: Fix model selector — replace custom sliding pill with Radix Select or SegmentedControl; fix ConfigTab.tsx, LogsTab.tsx, ExportBackupTab.tsx

---

#### Phase 71: Finance & HR Panels

**Goal**: BudgetPanel.tsx (116KB), FinancePanel.tsx (48KB), FinanceScenarioPanel.tsx (37KB), FinanceInsightsPanel.tsx — apply PanelHeader, fix any filled pill tabs to border-b-2. FinanceAgentChat.tsx — ensure assistant-ui integration matches Phase 59 chat standards. HRSection.tsx, HRAgentCreationModal.tsx, HRReportsModal.tsx — consistent styling. TimeTrackingPanel.tsx — consistent header/card.

**Depends on**: Phase 51, Phase 59 (chat standards)
**Research**: Unlikely
**Plans**: 3 plans

Plans:
- [ ] 71-01: Fix BudgetPanel.tsx (116KB) — PanelHeader, border-b-2 tabs, consistent card/surface tokens
- [ ] 71-02: Fix FinancePanel.tsx, FinanceScenarioPanel.tsx, FinanceInsightsPanel.tsx, FinanceAgentChat.tsx — consistent header/tab/chat styling
- [ ] 71-03: Fix HRSection.tsx, HRAgentCreationModal.tsx, HRReportsModal.tsx, TimeTrackingPanel.tsx — consistent modal/panel/form styling

---

#### Phase 72: Form Controls, Inputs & Toggles

**Goal**: Systematic audit and fix of every form control pattern. (1) Toggles — find every non-Radix Switch (square toggles); force all to `<Switch>` from `@radix-ui/themes` or `Toggle.tsx` wrapper. (2) Search bars — 3 different visual treatments exist (full-width borderless in settings, rounded with border in automations, wide in files); unify all to `<TextField.Root>` with consistent sizing. (3) All `<input>`, `<textarea>`, `<select>` elements must use `forms.css` global styles — no one-off Tailwind color classes. (4) Checkboxes — verify all use Radix Checkbox. (5) Radio buttons — verify all use Radix RadioGroup. (6) Dropdowns — verify all use Radix Select or DropdownMenu.

**Depends on**: Phase 51
**Research**: Unlikely (all Radix primitives already in app)
**Plans**: 3 plans

Plans:
- [ ] 72-01: Audit and fix all toggle/switch instances — grep for `type="checkbox"` used as toggle, any custom div toggles, square-appearing switches; replace with Radix Switch
- [ ] 72-02: Audit and fix all search bar instances — grep for `<input.*search`, `<TextField`, `SearchBar`; unify to same Radix TextField.Root with consistent sizing and focus ring
- [ ] 72-03: Audit all remaining form controls (input, textarea, select, checkbox, radio) — ensure all use Radix components or forms.css global styles; fix any one-off color classes

---

#### Phase 73: Modals, Dialogs & Overlays

**Goal**: All 30+ modal components must use `BaseModal.tsx` as the wrapper (accessibility, focus trap, ESC). Modal headers must be consistent: title in `text-lg font-semibold`, close button top-right, no accent-colored headers. Modal footers: `border-t border-mission-control-border` separator + Radix Button action row. Modal overlays: `bg-black/50` is acceptable but should be CSS variable if one exists. Audit every modal for these patterns.

**Depends on**: Phase 51
**Research**: Unlikely (BaseModal.tsx already established)
**Plans**: 3 plans

Plans:
- [ ] 73-01: Audit all modal components (30+) — verify BaseModal.tsx usage, consistent header/footer pattern; list non-conforming modals
- [ ] 73-02: Fix non-conforming modal headers and footers — consistent title size, close button, footer border separator
- [ ] 73-03: Fix ConfirmDialog, PromptDialog, HealthCheckModal, CalendarFilterModal, ContactModal, CreateRoomModal, FilePreviewModal — ensure all use BaseModal wrapper + standard header/footer

---

#### Phase 74: Empty States, Skeletons & Loading

**Goal**: All loading and empty states must be consistent. LoadingPanel.tsx, PanelSkeleton.tsx, LoadingStates.tsx, Skeleton.tsx — consistent shimmer animation using CSS variables. EmptyState.tsx — icon + title + description + optional action button; all use design tokens. ErrorDisplay.tsx — consistent error card with semantic `--color-error` token. Every major panel must have a proper skeleton that matches its loaded layout (not just a spinner).

**Depends on**: Phase 51
**Research**: Unlikely
**Plans**: 2 plans

Plans:
- [ ] 74-01: Standardize LoadingPanel, PanelSkeleton, Skeleton, LoadingStates — consistent shimmer using `bg-mission-control-border animate-pulse`, correct sizing to match panels
- [ ] 74-02: Standardize EmptyState.tsx and ErrorDisplay.tsx — canonical icon+title+description layout, semantic color tokens, Radix Button for actions

---

#### Phase 75: Light Mode Full QA

**Goal**: Full dark/light mode audit across every surface. Systematically switch to light mode and verify every panel, modal, chat surface, form, and card renders correctly. Fix any: hardcoded `bg-white` (should be `bg-mission-control-surface`), `text-black` (should be `text-mission-control-text`), dark-only color classes (e.g., classes that look right in dark but break in light), hardcoded `#hex` values, Tailwind color classes that don't adapt (e.g., `bg-gray-900`, `text-gray-100`). The Radix Themes design token bridge should handle most cases — this is the catch-all for anything that slipped through.

**Depends on**: Phases 51–74 complete
**Research**: Unlikely (visual audit + grep for anti-patterns)
**Plans**: 3 plans

Plans:
- [ ] 75-01: Grep for all hardcoded color anti-patterns — `bg-white`, `text-black`, `bg-gray-[0-9]`, `text-gray-[0-9]`, `#[0-9a-f]` — catalog all occurrences
- [ ] 75-02: Fix all hardcoded light/dark colors — replace with CSS variable equivalents; verify in light mode
- [ ] 75-03: Full visual pass in light mode — every major panel and modal; fix remaining edge cases

---

#### Phase 76: Final Audit & v7.0 Publish

**Goal**: End-to-end visual consistency pass. TypeScript build clean (`npm run build:verify` — never `npm run build`). Spacing/padding consistency audit — every panel uses `p-6 pb-0` header + `p-6` content, not arbitrary values. Verify all 329 components pass the design law checklist. Write v7.0 release notes. Ship to npm.

**Depends on**: Phase 75
**Research**: Unlikely (verification and publish)
**Plans**: 2 plans

Plans:
- [ ] 76-01: Final design consistency audit — run design law checklist across all major surfaces; fix any remaining edge cases
- [ ] 76-02: Run `npm run build:verify`, fix any TypeScript errors, write release notes, merge dev → main, npm publish v7.0

---

### v7.0 Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 51. Design System Primitives | v7.0 | 3/3 | ✅ Complete | 2026-03-24 |
| 52. Sidebar & Navigation Polish | v7.0 | 2/2 | ✅ Complete | 2026-03-24 |
| 53. Dashboard & Widget Grid | v7.0 | 3/3 | ✅ Complete | 2026-03-24 |
| 54. Analytics Panel | v7.0 | 3/3 | ✅ Complete | 2026-03-24 |
| 55. Task Board, Kanban & Task Modals | v7.0 | 3/3 | ✅ Complete | 2026-03-24 |
| 56. Approval Queue | v7.0 | 2/2 | ✅ Complete | 2026-03-24 |
| 57. Agent Panel, Library & Leaderboard | v7.0 | 3/3 | ✅ Complete | 2026-03-24 |
| 58. Agent Detail, Config & Soul Editor | v7.0 | 3/3 | ✅ Complete | 2026-03-24 |
| 59. Chat Surfaces (assistant-ui) | v7.0 | 4/4 | ✅ Complete | 2026-03-24 |
| 60. Communications & Inbox | v7.0 | 2/2 | ✅ Complete | 2026-03-24 |
| 61. Notifications | v7.0 | 2/2 | ✅ Complete | 2026-03-24 |
| 62. Library, Knowledge Base & Files | v7.0 | 2/2 | ✅ Complete | 2026-03-24 |
| 63. Brand Assets & Writing Module | v7.0 | 2/2 | ✅ Complete | 2026-03-24 |
| 64. Automations & Workflows | v7.0 | 2/2 | ✅ Complete | 2026-03-24 |
| 65. Schedule & Calendar | v7.0 | 2/2 | ✅ Complete | 2026-03-24 |
| 66. Meetings Panel | v7.0 | 3/3 | ✅ Complete | 2026-03-24 |
| 67. Social Module (30 X* Components) | v7.0 | 4/4 | ✅ Complete | 2026-03-24 |
| 68. Projects & Campaigns | v7.0 | 2/2 | ✅ Complete | 2026-03-24 |
| 69. Modules Panel | v7.0 | 2/2 | ✅ Complete | 2026-03-24 |
| 70. Settings & Configuration | v7.0 | 4/4 | ✅ Complete | 2026-03-24 |
| 71. Finance & HR Panels | v7.0 | 3/3 | ✅ Complete | 2026-03-24 |
| 72. Form Controls, Inputs & Toggles | v7.0 | 3/3 | ✅ Complete | 2026-03-24 |
| 73. Modals, Dialogs & Overlays | v7.0 | 3/3 | ✅ Complete | 2026-03-24 |
| 74. Empty States, Skeletons & Loading | v7.0 | 2/2 | ✅ Complete | 2026-03-24 |
| 75. Light Mode Full QA | v7.0 | 3/3 | ✅ Complete | 2026-03-24 |
| 76. Final Audit & v7.0 Publish | v7.0 | 2/2 | ✅ Complete | 2026-03-24 |

---

## Milestones

- ✅ **v1.0 Migration** — Phases 0–14 (shipped 2026-03-04)
- ✅ **v2.0 Froggo Platform** — Phases 15–22 (shipped 2026-03-05)
- ✅ **v3.0 Autonomous Core** — Phases 23–30 (shipped 2026-03-06)
- ✅ **v4.0 Agent & Module Library** — Phases 31–39 (shipped 2026-03-06)
- ✅ **v6.0 Security Hardening** — Phases 50–57 (shipped 2026-03-07)
- ✅ **v7.0 Design Consistency** — Phases 51–76 (shipped 2026-03-24)
- 🚧 **v8.0 Tailwind → Radix UI** — Phases 77–86 (in progress)

---

### 🚧 v8.0 Tailwind → Radix UI Complete Migration (In Progress)

**Milestone Goal:** Eliminate Tailwind entirely. Every layout utility (`flex`, `gap-*`, `p-*`, `grid`, `text-sm`, etc.) replaced with Radix Themes layout primitives (`<Flex>`, `<Box>`, `<Grid>`, `<Text>`, `<Heading>`). One unified system: Radix Themes + design-tokens.css.

#### Phase 77: Audit & Migration Map

**Goal**: Catalog every unique Tailwind utility pattern across all 185+ components. Build a mapping table (Tailwind → Radix equivalent). Create migration conventions and code snippets the batch phases will follow.
**Depends on**: Phase 76 (v7.0 complete)
**Research**: Unlikely (known patterns — Tailwind docs + Radix Themes layout docs already understood)
**Plans**: TBD

Plans:
- [ ] 77-01: TBD

#### Phase 78: Core Layout Infrastructure

**Goal**: Migrate App.tsx, ErrorBoundary, LoadingStates, DependencyGate, and all shared wrappers to Radix layout primitives. Establish the `<Flex>`, `<Box>`, `<Grid>` patterns the rest of the migration will follow.
**Depends on**: Phase 77
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [ ] 78-01: TBD

#### Phase 79: Sidebar & Navigation

**Goal**: Migrate Sidebar, all navigation items, and top-level layout shells to Radix layout primitives.
**Depends on**: Phase 78
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [ ] 79-01: TBD

#### Phase 80: Agent Components

**Goal**: Migrate AgentPanel, AgentDetailModal, AgentHealthDashboard, AgentLeaderboard, AgentCoachingCard, AgentConfigPanel, AgentLibraryPanel, and all remaining agent-related components.
**Depends on**: Phase 79
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [ ] 80-01: TBD

#### Phase 81: Chat & Communications

**Goal**: Migrate ChatPanel, CommsInbox, FolderTabs, ThreadView, InboxPanel, TaskChatTab, and all messaging surfaces.
**Depends on**: Phase 80
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [ ] 81-01: TBD

#### Phase 82: Social Module

**Goal**: Migrate all 30 X*.tsx social components to Radix layout primitives.
**Depends on**: Phase 81
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [ ] 82-01: TBD

#### Phase 83: Projects, Finance & HR

**Goal**: Migrate ProjectsPanel, ProjectWorkspace, ProjectKanban, FinancePanel, HRSection, BudgetPanel, and related components.
**Depends on**: Phase 82
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [ ] 83-01: TBD

#### Phase 84: Settings, Config & Modals

**Goal**: Migrate SettingsPanel, EnhancedSettingsPanel, ConfigTab, and all modal/dialog/overlay components.
**Depends on**: Phase 83
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [ ] 84-01: TBD

#### Phase 85: Remaining Components Sweep

**Goal**: Migrate all remaining components not covered in Phases 78–84. Full grep verification — zero Tailwind layout utilities remain.
**Depends on**: Phase 84
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [ ] 85-01: TBD

#### Phase 86: Tailwind Removal & Build Clean

**Goal**: Uninstall Tailwind. Remove tailwind.config.js and @tailwind directives from index.css. Run `npm run build:verify`. Full visual QA pass. Ship v8.0.
**Depends on**: Phase 85
**Research**: Unlikely (removal + verification)
**Plans**: TBD

Plans:
- [ ] 86-01: TBD

---

### v8.0 Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 77. Audit & Migration Map | v8.0 | 0/? | Not started | - |
| 78. Core Layout Infrastructure | v8.0 | 0/? | Not started | - |
| 79. Sidebar & Navigation | v8.0 | 0/? | Not started | - |
| 80. Agent Components | v8.0 | 0/? | Not started | - |
| 81. Chat & Communications | v8.0 | 0/? | Not started | - |
| 82. Social Module | v8.0 | 0/? | Not started | - |
| 83. Projects, Finance & HR | v8.0 | 0/? | Not started | - |
| 84. Settings, Config & Modals | v8.0 | 0/? | Not started | - |
| 85. Remaining Components Sweep | v8.0 | 0/? | Not started | - |
| 86. Tailwind Removal & Build Clean | v8.0 | 0/? | Not started | - |
