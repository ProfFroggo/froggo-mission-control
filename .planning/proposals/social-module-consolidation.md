# Social Media Module Consolidation Proposal

## The Problem

The social media module has **15 tabs** spread across a rigid 3-pane layout (Agent Chat | Content | Approval Queue). This creates:

1. **Navigation fatigue** — 15 tabs is a horizontal scroll of confusion. Users must memorize where functionality lives.
2. **Redundant views** — Pipeline, Drafts, Plan, and Calendar all render the same `scheduleApi` data with different filters. Mentions and Reply Guy both process the same inbox mentions.
3. **Wasted screen real estate** — The approval queue pane shows on 8 tabs but is empty 90% of the time. The agent chat pane is always visible even when not needed.
4. **Scattered approvals** — Human-in-the-loop actions are split across: the right pane (research/plan/draft approvals), inline mention cards (reply approvals), the composer (tweet approvals), campaign scheduling (stage approvals), and agent mode (draft approvals). Five different approval surfaces for one concept.
5. **No clear workflow** — A user wanting to "create and publish a tweet" touches: Publish (compose) -> Pipeline (track) -> Drafts (review) -> Calendar (verify schedule) -> Analytics (check performance). Five tabs for one flow.

---

## Current Architecture Audit

### Tab Inventory (15 tabs)

| Tab | Component | Lines | Data Source | Real/Stub | Approval Flow | Agent Chat |
|-----|-----------|-------|-------------|-----------|---------------|------------|
| Pipeline | XPipelineView | 527 | scheduleApi | Real | Status changes only | No |
| Research | XResearchView | 469 | /api/x/search | Real | None | Injects query |
| Content Plan | XPlanListView | 137 | scheduleApi | Real (read-only) | None | None |
| Drafts | XDraftListView | 360 | scheduleApi + approvalApi | Real | Approve/reject drafts | Injects draft |
| Publish | XPublishComposer | 906 | approvalApi + scheduleApi | Real | Tweet -> approval queue | None |
| Campaigns | XCampaignView | 606 | scheduleApi + approvalApi | Real | Stage -> approval on schedule | Receives proposals |
| Calendar | XCalendarView | 181 | scheduleApi | Real (read-only) | None | None |
| Mentions | XMentionsView | 402 | inboxApi + /api/x/mentions | Real | Reply -> approval | None |
| Reply Guy | XReplyGuyView | 659 | inboxApi + approvalApi | Real | Reply -> approval (tier 1/3) | Suggest replies |
| Content Mix | XContentMixTracker | 363 | /api/x/analytics | Real | None | None |
| Automations | XAutomationsTab | 720 | localStorage only | Stub (no backend) | None | None |
| Analytics | XEnhancedAnalyticsView | 1325 | /api/x/analytics | Real | None | None |
| Agent Mode | XAgentContentQueue | 704 | /api/x/agent-mode | Real | Draft approve/reject/feedback | Agent-generated |
| Competitors | XCompetitorTracker | 483 | /api/x/search | Real | None | None |
| Hashtags | XHashtagIntelligence | 631 | /api/x/search | Real | None | None |

**Total: ~8,473 lines across 15 content components + 3 structural components (Page, Layout, Chat)**

### Overlap Analysis

| Overlap | Components | Shared Data | Severity |
|---------|-----------|-------------|----------|
| Same scheduleApi data, different filters | Pipeline + Drafts + Plan + Calendar | `scheduleApi.getAll()` filtered by type/status | Critical |
| Same inbox mentions, different UX | Mentions + Reply Guy | `inboxApi.getAll()` filtered by type='x-mention' | High |
| Same analytics endpoint, different charts | Analytics + Content Mix | `GET /api/x/analytics` | Medium |
| Same search endpoint, different purpose | Research + Competitors + Hashtags | `GET /api/x/search` | Medium |
| Five separate approval surfaces | Composer, Drafts, Mentions, Reply Guy, Agent Mode, Campaigns | `approvalApi.create()` / `approvalApi.respond()` | Critical |

### Three-Pane Layout Issues

The current `XThreePaneLayout` (157 lines) enforces a rigid 3-column split:

- **Left (30%)**: Agent chat — always visible, even when user is doing solo work (composing, reviewing analytics)
- **Center (40%)**: Content — compressed to 40% width, charts and tables cramped
- **Right (30%)**: Approval queue — visible on 8 tabs, empty most of the time. Shows research/plan/draft items but NOT tweet approvals, reply approvals, or campaign approvals

The approval pane (`XApprovalQueuePane`, 304 lines) only handles 3 item types:
- Research proposals (type='research', status='proposed')
- Content plans (type='plan', status='proposed')
- Drafts (type='draft', status='draft')

It does NOT handle:
- Tweet posting approvals (handled inline in XPublishComposer)
- Reply approvals (handled inline in XMentionsView and XReplyGuyView)
- Campaign stage approvals (handled inline in XCampaignView)
- Agent draft approvals (handled inline in XAgentContentQueue)

This means the "approval pane" misses most actual approval actions.

---

## Proposed Architecture: 5 Tabs + Floating Compose

### New Tab Structure

```
[+ Compose]   Pipeline | Engage | Intelligence | Measure | Configure
```

### Layout: Adaptive 2-Pane (not rigid 3-pane)

Replace the rigid 3-pane with a flexible layout:

```
+------------------------------------------------------------------+
| [+ Compose]  Pipeline | Engage | Intelligence | Measure | Config |
+------------------------------------------------------------------+
|                                                                    |
|                    MAIN CONTENT AREA                               |
|                    (full width by default)                          |
|                                                                    |
|                                          +---------------------+   |
|                                          | AGENT CHAT (toggle) |   |
|                                          | Slides in from right|   |
|                                          +---------------------+   |
|                                                                    |
+------------------------------------------------------------------+
```

- **Main content** gets full width by default
- **Agent chat** is a slide-in panel (toggle button in header) — available everywhere, forced nowhere
- **No dedicated approval pane** — approvals are inline on the items they belong to

### Why Kill the Approval Pane

The current approval pane (`XApprovalQueuePane`) only shows research/plan/draft proposals. But the REAL approval actions users care about are:

1. "Should I post this tweet?" -> inline on the compose/pipeline card
2. "Should I reply to this mention?" -> inline on the mention card
3. "Should I schedule this campaign?" -> inline on the campaign
4. "Is this agent draft good?" -> inline on the agent draft card

Approvals should live WHERE THE CONTENT IS, not in a separate pane. Every card that needs approval gets approve/reject buttons directly on it. This is already how Mentions, Reply Guy, Agent Mode, and Campaigns work — only Research/Plan/Drafts use the separate pane, and those can easily be moved inline.

---

## Tab Specifications

### Tab 1: Pipeline (merges Pipeline + Drafts + Plan + Calendar + Campaigns)

**Concept**: One unified view of ALL content flowing through the system. Multiple view modes for different mental models.

**View Modes** (toggle in header):
- **Board** (default): Kanban columns — Ideas | Drafting | Review | Approved | Scheduled | Published
- **Calendar**: Month/week view with content items as events (existing XCalendarView logic)
- **List**: Filterable table (replaces Drafts tab filtering)
- **Campaigns**: Multi-stage campaign planner (existing XCampaignView)

**What merges in**:
| Former Tab | How It Merges | Lines Absorbed |
|-----------|--------------|----------------|
| Pipeline (XPipelineView) | Becomes the Board view (default) | 527 |
| Drafts (XDraftListView) | Becomes the List view with status filters | 360 |
| Plan (XPlanListView) | Plans appear as cards in Board view, rows in List view | 137 |
| Calendar (XCalendarView) | Becomes the Calendar view mode | 181 |
| Campaigns (XCampaignView) | Becomes the Campaigns view mode | 606 |

**Approval integration**: Inline on every card.
- Board view: hover a card -> approve/reject/schedule actions appear
- List view: action buttons in each row
- Campaign view: "Schedule Campaign" triggers per-stage approval creation (existing flow)

**Data source**: `scheduleApi.getAll()` (same as all 5 former tabs already use)

**What stays the same**: The Pipeline kanban board is the most mature component (527 lines, fully real). It becomes the default view. Calendar, list, and campaign views are secondary modes accessible via a view toggle.

### Tab 2: Engage (merges Mentions + Reply Guy)

**Concept**: Unified inbox for all incoming engagement. The primary human-in-the-loop surface for community management.

**Layout**:
```
+---------------------------------------------+
| Engage                          [Fetch New]  |
| [All] [Hot] [Pending] [Replied] [Ignored]   |
+---------------------------------------------+
|                                              |
| @user1 mentioned you in...     [Reply] [*]  |
|   sentiment: positive  likes: 42  rt: 5     |
|                                              |
| @user2 asked about...          [Reply] [*]  |
|   sentiment: neutral   likes: 3   rt: 0     |
|                                              |
+---------------------------------------------+
```

**What merges in**:
| Former Tab | Key Features Preserved | Lines |
|-----------|----------------------|-------|
| Mentions (XMentionsView) | Fetch from X API, status management (pending/considering/ignored/replied), notes, reply composer with approval gate | 402 |
| Reply Guy (XReplyGuyView) | Engagement thresholds (min likes/retweets), priority accounts, sentiment detection, reply templates, fast-track approval | 659 |

**Unified feature set**:
- **All mentions** in one stream (from `inboxApi` + `/api/x/mentions`)
- **Smart filters**: All | Hot (engagement threshold, like Reply Guy) | Pending | Replied | Ignored
- **Priority accounts**: Star icon on cards, sorted to top (from Reply Guy)
- **Sentiment badges**: Inline on each mention (from Reply Guy's inference)
- **Reply composer**: Inline on each card with templates, char counter, fast-track toggle
- **Approval gate**: All replies go through `approvalApi.create({ type: 'x-reply', tier: fastTrack ? 1 : 3 })`
- **Notes**: Per-mention notes (from Mentions)
- **Engagement metrics**: Likes, retweets, replies shown on every card

**What's eliminated**: The conceptual split between "managing mentions" and "hunting for engagement opportunities." They're the same data — just filtered differently.

### Tab 3: Intelligence (merges Research + Competitors + Hashtags)

**Concept**: All research and intelligence gathering in one place. This is where the agent chat shines — the user asks questions, the agent searches and analyzes.

**Sub-tabs** (lightweight, within the tab):
- **Search**: Free-form X search with results grid (from XResearchView)
- **Competitors**: Track competitor handles, compare engagement (from XCompetitorTracker)
- **Hashtags**: Search hashtags, build hashtag sets, track performance (from XHashtagIntelligence)

**What merges in**:
| Former Tab | Key Features Preserved | Lines |
|-----------|----------------------|-------|
| Research (XResearchView) | X search API, save to library (localStorage), save as idea, agent delegation | 469 |
| Competitors (XCompetitorTracker) | Handle tracking (localStorage), per-competitor tweet fetch, engagement aggregation | 483 |
| Hashtags (XHashtagIntelligence) | Hashtag search, saved tags, hashtag sets, search history, insert-to-composer event | 631 |

**Agent chat integration**: This tab benefits MOST from the agent chat panel. The agent can:
- Run searches and summarize trends
- Compare competitor strategies
- Suggest hashtag sets for campaigns
- Analyze research findings

**Approval integration**: None needed — intelligence is internal, not external.

### Tab 4: Measure (merges Analytics + Content Mix)

**Concept**: Performance measurement and optimization. Read-only dashboard with actionable insights.

**Layout**: Full-width dashboard (no agent chat needed by default)

**What merges in**:
| Former Tab | Key Features Preserved | Lines |
|-----------|----------------------|-------|
| Analytics (XEnhancedAnalyticsView) | Impressions chart, follower growth, heatmap, post metrics table, CSV export, AI suggestions, auto-refresh | 1325 |
| Content Mix (XContentMixTracker) | Content type classification, current vs target %, deviation alerts, engagement per type | 363 |

**How Content Mix merges**: Becomes a card/section within the analytics dashboard (it already uses the same `/api/x/analytics` endpoint). Renders as a "Content Distribution" card alongside the existing charts.

**Agent chat**: Available via toggle but not shown by default — analytics is a visual review activity.

### Tab 5: Configure (merges Automations + Agent Mode)

**Concept**: Configuration and automation settings. Not a daily-use tab.

**Sub-tabs**:
- **Agent Mode**: Enable/disable autonomous agent, content brief, auto-approve toggle, draft queue (from XAgentContentQueue)
- **Automations**: Rule builder for IFTTT-style triggers and actions (from XAutomationsTab)
- **Credentials**: Link to setup wizard / API key management

**What merges in**:
| Former Tab | Key Features Preserved | Lines |
|-----------|----------------------|-------|
| Agent Mode (XAgentContentQueue) | Agent toggle, content brief, draft queue with approve/reject/feedback, activity log | 704 |
| Automations (XAutomationsTab) | IFTTT builder UI, trigger types, action chaining, rate limits (localStorage) | 720 |

**Note on Agent Mode drafts**: The draft approval queue in Agent Mode is the purest human-in-the-loop surface. Agent generates content, human reviews and approves/rejects with feedback. This stays exactly as-is within the Configure tab.

### Floating Compose Button

**Concept**: The publish composer (906 lines) is the primary creation entry point. It should be accessible from ANY tab, not locked to one.

**Implementation**: A `[+ Compose]` button in the header opens the `XPublishComposer` as a modal/drawer overlay. This means:
- User can compose while viewing analytics (see what performs, write similar)
- User can compose while in engagement tab (reply to mentions, then compose a standalone tweet)
- User can compose while reviewing pipeline (see gaps, create content to fill them)

**What stays the same**: The entire `XPublishComposer` component (906 lines) stays intact. Single/thread modes, media attachment, scheduling, draft persistence, approval gate — all preserved. It just renders as an overlay instead of a tab.

---

## Agent Chat Redesign

### Current: Always-On Left Pane (30% width)

The agent chat currently consumes 30% of screen width at all times. For tabs like Analytics, Calendar, and Pipeline where the user is doing visual review, this is wasted space.

### Proposed: Slide-In Panel (Toggle)

```
+------------------------------------------------------------------+
| [Pipeline v]  Board | Calendar | List | Campaigns   [Agent] [+]  |
+------------------------------------------------------------------+
|                                                    |              |
|  MAIN CONTENT (full width)                         | Agent Chat   |
|  Kanban board, mention inbox, charts, etc.         | (slides in)  |
|                                                    |              |
|                                                    | [prompts]    |
|                                                    | [input]      |
+------------------------------------------------------------------+
```

- **Toggle button** in header (keyboard shortcut: `Cmd+.` or similar)
- **Remembers state** per tab (if you opened it on Engage, it stays open on Engage)
- **Width**: 350px fixed when open (not percentage-based — prevents layout shift)
- **Quick prompts**: Still tab-contextual, still 4 per tab
- **Message history**: Still per-tab, still persisted via chatApi
- **External injection**: `x-agent-chat-inject` event still works, auto-opens the panel

This gives the main content area 100% width by default, and ~70% when chat is open. Much better than the current forced 40%.

---

## Approval System Unification

### Current: 5 Separate Approval Surfaces

1. **XApprovalQueuePane** (right pane): Research, plans, drafts
2. **XPublishComposer** (inline): Tweet posting
3. **XMentionsView** (inline): Reply to mentions
4. **XReplyGuyView** (inline): Reply to hot mentions (+ direct post bypass!)
5. **XAgentContentQueue** (inline): Agent-generated drafts

### Proposed: Inline Everywhere + Unified Badge

**Principle**: Approvals live on the content they belong to. No separate approval pane.

**Every approvable item gets**:
```
+------------------------------------------+
| Content preview...                       |
|                                          |
| [Approve]  [Request Changes]  [Reject]  |
+------------------------------------------+
```

**Unified approval badge** in header shows total pending count across ALL types:
```
Pipeline | Engage | Intelligence | Measure | Configure    [3 pending] [Agent] [+ Compose]
```

Clicking the badge opens a dropdown/popover listing ALL pending approvals with quick-action buttons — a lightweight "approval inbox" that doesn't consume a pane.

**Fix the direct-post bypass**: XReplyGuyView currently has a "Post Now" path (line 196) that calls `/api/x/tweet` directly, bypassing approval. This should be removed — ALL external posts go through approval.

---

## Migration Plan

### Phase 1: Layout Overhaul
- Replace `XThreePaneLayout` with new adaptive layout (main content + slide-in chat)
- Move `XPublishComposer` to floating modal/drawer
- Add unified approval badge to header
- Estimated: ~300 lines new layout code, ~150 lines removed

### Phase 2: Pipeline Consolidation
- Add view mode toggle (Board | Calendar | List | Campaigns) to Pipeline tab
- Move `XCalendarView` logic into Pipeline as a view mode
- Move `XDraftListView` filtering into Pipeline as List view
- Remove `XPlanListView` (plans are just pipeline cards)
- Move `XCampaignView` into Pipeline as Campaigns view
- Remove 4 tabs from tab bar
- Estimated: ~200 lines new routing, ~500 lines removed (duplicated data loading)

### Phase 3: Engage Consolidation
- Merge `XMentionsView` and `XReplyGuyView` into unified `XEngageView`
- Combine: mention loading, status management, engagement filtering, sentiment, priority accounts, templates, reply composer
- Unified approval flow (all replies -> approvalApi, remove direct-post bypass)
- Remove 2 tabs from tab bar
- Estimated: ~700 lines new component (vs 1,061 current combined), ~350 lines saved

### Phase 4: Intelligence Consolidation
- Create `XIntelligenceView` with sub-tabs (Search | Competitors | Hashtags)
- Move `XResearchView`, `XCompetitorTracker`, `XHashtagIntelligence` as sub-views
- Shared search bar at top, sub-tab content below
- Remove 3 tabs from tab bar
- Estimated: ~100 lines new wrapper, components largely unchanged internally

### Phase 5: Measure Consolidation
- Absorb `XContentMixTracker` as a card within `XEnhancedAnalyticsView`
- Remove Content Mix tab
- Estimated: ~50 lines changed, 1 tab removed

### Phase 6: Configure Consolidation
- Create `XConfigureView` with sub-tabs (Agent Mode | Automations | Credentials)
- Move `XAgentContentQueue` and `XAutomationsTab` as sub-views
- Add credentials section linking to setup wizard
- Remove 2 tabs from tab bar
- Estimated: ~80 lines new wrapper, components largely unchanged internally

---

## Impact Summary

### Before
```
15 tabs | 3 rigid panes | 5 approval surfaces | ~8,500 lines across 18 components
```

### After
```
5 tabs + floating compose | adaptive 2-pane | inline approvals + badge | ~7,200 lines across 12 components
```

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Visible tabs | 15 | 5 | -67% |
| Tab switches to publish a tweet | 3-5 | 0-1 | -80% |
| Approval surfaces | 5 separate | 1 unified (inline) | -80% |
| Screen width for content | 40% (forced 3-pane) | 100% (default) or 70% (chat open) | +75% |
| Components | 18 | 12 | -33% |
| Estimated lines removed | — | ~1,300 | -15% |
| Functionality lost | — | 0 | None |

### User Mental Model

**Before**: "Where do I go to do X?" -> check 15 tabs

**After**:
- "I want to create content" -> Compose button (available everywhere)
- "I want to manage my content pipeline" -> Pipeline tab
- "I want to respond to people" -> Engage tab
- "I want to research trends/competitors" -> Intelligence tab
- "I want to see how I'm doing" -> Measure tab
- "I want to configure automation" -> Configure tab

---

## Files Affected

### New Components
- `XSocialLayout.tsx` — adaptive layout with slide-in chat
- `XEngageView.tsx` — merged mentions + reply guy
- `XIntelligenceView.tsx` — wrapper for research sub-tabs
- `XConfigureView.tsx` — wrapper for settings sub-tabs
- `XApprovalBadge.tsx` — unified approval count + dropdown

### Modified Components
- `XTwitterPage.tsx` — new tab type, floating compose, layout swap
- `XPipelineView.tsx` — add view mode toggle (board/calendar/list/campaigns)
- `XEnhancedAnalyticsView.tsx` — absorb content mix card
- `XAgentChatPane.tsx` — adapt to slide-in panel, update tab contexts

### Removed Components (functionality preserved in merged views)
- `XThreePaneLayout.tsx` — replaced by XSocialLayout
- `XApprovalQueuePane.tsx` — replaced by inline approvals
- `XTabBar.tsx` — simplified to 5 tabs, rebuilt into layout
- `XDraftListView.tsx` — merged into Pipeline list view
- `XPlanListView.tsx` — merged into Pipeline board view
- `XCalendarView.tsx` — merged into Pipeline calendar view
- `XMentionsView.tsx` — merged into Engage
- `XReplyGuyView.tsx` — merged into Engage
- `XContentMixTracker.tsx` — merged into Measure
- `XContentEditorPane.tsx` — replaced by direct routing in layout
- `XRedditView.tsx` — already removed

### Unchanged Components (moved into sub-views)
- `XPublishComposer.tsx` — becomes floating modal (same component)
- `XResearchView.tsx` — sub-view of Intelligence
- `XCompetitorTracker.tsx` — sub-view of Intelligence
- `XHashtagIntelligence.tsx` — sub-view of Intelligence
- `XCampaignView.tsx` — view mode of Pipeline
- `XAutomationsTab.tsx` — sub-view of Configure
- `XAgentContentQueue.tsx` — sub-view of Configure
