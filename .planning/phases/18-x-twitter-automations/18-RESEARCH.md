# Phase 18 Research: X/Twitter Automations & Analytics

## Automations Tab — Current State

### What Already Exists (XTW-25, XTW-26, XTW-27)

**FULLY IMPLEMENTED visual rule builder:** `src/components/XAutomationsTab.tsx` (520 lines)
- IFTTT-style trigger/action builder with: mention, keyword, time, follower, dm triggers
- Actions: reply, like, retweet, dm, add_to_list
- Rate limits config (max per hour, max per day)
- Inline builder (not modal) — shows list or builder view
- Already wired in `XContentEditorPane` for `tab === 'automations'`

**Full backend IPC service:** `electron/x-automations-service.ts`
- `x-automations:list/get/create/update/delete/toggle/executions/rate-limit`
- All registered via `registerXAutomationsHandlers()` called at main.ts:419
- Import at main.ts:30: `import { registerXAutomationsHandlers } from './x-automations-service'`

**Full preload wiring:** `electron/preload.ts` lines 573–601
- `window.clawdbot.xAutomations.list/get/create/update/delete/toggle/executions/rateLimit`
- All correctly map to `x-automations:*` IPC channels

**Layout already correct:**
- `XAgentChatPane` renders for ALL tabs unconditionally — XTW-25 satisfied
- `automations` is NOT in `TABS_WITH_APPROVAL = ['plan', 'drafts']` — XTW-27 satisfied

### CRITICAL GAP: DB Tables Don't Exist

The x-automations-service.ts queries:
- `x_automations` — not created anywhere in main.ts or any SQL file
- `x_automation_executions` — not created anywhere
- `x_automation_rate_limits` — not created anywhere

All calls silently fail (try/catch returns `{ success: true, automations: [] }`). The UI shows "No automations yet" instead of an error. This is the same pattern as Phase 17's x_mentions gap.

**Fix:** Add `CREATE TABLE IF NOT EXISTS` blocks in main.ts (same idempotent pattern used for x_mentions).

### showToast Call Signature

`showToast` has two valid overloads (from Toast.tsx:70-72):
1. `showToast(type, title, message?)`
2. `showToast(title, type, message?)`

`XAutomationsTab.tsx` uses: `showToast('success', 'Test Triggered', '...')` — matches overload 1. ✓
`XAutomationsPanel.tsx` (the DUPLICATE, UNUSED component) has a bug: `showToast('error', 'Failed to save:', ...)` with wrong type — but this file is not rendered.

### Duplicate Component: XAutomationsPanel.tsx

`XAutomationsPanel.tsx` (400 lines) is a different automation builder implementation that is NOT used. `XContentEditorPane` imports and uses `XAutomationsTab.tsx`. No action needed.

### x_automations Schema (needed for main.ts)

```sql
CREATE TABLE IF NOT EXISTS x_automations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  enabled INTEGER DEFAULT 1,
  trigger_type TEXT NOT NULL,
  trigger_config TEXT DEFAULT '{}',
  conditions TEXT DEFAULT '[]',
  actions TEXT DEFAULT '[]',
  max_executions_per_hour INTEGER DEFAULT 10,
  max_executions_per_day INTEGER DEFAULT 50,
  total_executions INTEGER DEFAULT 0,
  last_executed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS x_automation_executions (
  id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL,
  trigger_data TEXT DEFAULT '{}',
  actions_executed TEXT DEFAULT '[]',
  status TEXT DEFAULT 'success',
  error_message TEXT,
  executed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS x_automation_rate_limits (
  automation_id TEXT NOT NULL,
  hour_bucket TEXT NOT NULL,
  execution_count INTEGER DEFAULT 0,
  PRIMARY KEY (automation_id, hour_bucket)
);
```

---

## Analytics Tab — Current State

### What Already Exists (XTW-28)

- Analytics tab IS in XTabBar (id: 'analytics', icon: BarChart2) at the end of the nav — XTW-28 partially satisfied (tab exists)
- `XContentEditorPane` has placeholder for analytics:
  ```tsx
  if (tab === 'analytics') {
    return <div>Analytics dashboard coming soon...</div>;
  }
  ```
- The generic `analytics:getData`, `analytics:subtaskStats`, `analytics:heatmap`, `analytics:timeTracking` IPC handlers in main.ts are for AGENT analytics (task metrics), NOT X/Twitter content metrics. Do not reuse.

### What Needs to Be Built (XTW-29, XTW-30, XTW-31)

New component: `src/components/XAnalyticsView.tsx`

**Data sources:**
- `x_drafts` table: query posted content for "top content" and "posts" count
  - Status='posted' drafts are the posted content
  - `engagement_score` or `like_count`/`retweet_count`/`reply_count` columns (need to check schema)
- For engagement rate, reach, impressions: mock sensible values since no real X API
- Competitor insights: static placeholder section (no API connection for competitor data)

**XTW-29 requirements:**
- Total posts count, engagement rate %, reach, impressions
- Top content list (most engaged drafts)

**XTW-30 requirements:**
- Competitor insights section with placeholder competitor accounts and their estimated metrics
- Can be static data with a note that it requires API connection

**XTW-31 requirements:**
- "Download Report" button generates a text file
- Implementation: client-side Blob + createObjectURL (no IPC needed)
- Report content: summary stats + top content list + competitor data

### x_drafts Schema Check

From Phase 17 research and Phase 15: x_drafts has these columns:
- id, plan_id, draft_version, content, status, created_at, updated_at, etc.
- After Phase 17 fix: status CHECK includes 'posted'
- Engagement columns: need to verify (may not exist — likely need mock data for metrics)

### Analytics Implementation Strategy

Since no real X API connection, implementation uses:
1. **Posts count**: `SELECT COUNT(*) FROM x_drafts WHERE status = 'posted'`
2. **Engagement, reach, impressions**: Mock reasonable numbers based on post count (e.g., avg engagement rate 2-4%, reach = posts * 500, etc.)
3. **Top content**: `SELECT content, created_at FROM x_drafts WHERE status IN ('posted', 'approved') ORDER BY created_at DESC LIMIT 10`
4. **Competitor insights**: Hardcoded sample competitors with mock metrics
5. **Download report**: Compose text from displayed data, download as Blob

This approach satisfies the requirements visually without needing real API credentials.

---

## Plan Structure

### 18-01: Fix x_automations DB schema + agent chat routing check

**Files:** `electron/main.ts`

**Tasks:**
1. Add CREATE TABLE IF NOT EXISTS for x_automations, x_automation_executions, x_automation_rate_limits
2. Verify `XAgentChatPane.tsx` routes automations tab to correct agent (social-manager)

**Must-haves:**
- x_automations table accessible without "no such table" error
- Automation CRUD operations work (list returns empty array cleanly, not silent error)
- Automations tab has visual rule builder visible (already in XAutomationsTab.tsx)
- Automations tab has no approval panel
- Automations tab has agent chat pane

### 18-02: Build XAnalyticsView component

**Files:** `src/components/XAnalyticsView.tsx`, `src/components/XContentEditorPane.tsx`

**Tasks:**
1. Create XAnalyticsView.tsx with stats, top content, competitor insights, download button
2. Replace analytics placeholder in XContentEditorPane with `<XAnalyticsView />`

**Must-haves:**
- Analytics tab shows summary stats (posts, engagement, reach, impressions)
- Top content list renders (from DB or mock)
- Competitor insights section renders
- Download report button downloads a .txt file

---

## Key Decisions for Planner

- Schema fix: follow same pattern as Phase 17 x_mentions (CREATE TABLE IF NOT EXISTS, no idempotent ALTER needed since tables are new)
- Analytics data: hybrid approach — real DB queries for post count + mock for engagement metrics
- Download report: client-side Blob, no IPC handler needed
- XAutomationsPanel.tsx: leave as-is (unused, don't delete to avoid breaking imports if any)
- No new preload entries needed for analytics (use existing window.clawdbot.xAutomations for any data queries)
