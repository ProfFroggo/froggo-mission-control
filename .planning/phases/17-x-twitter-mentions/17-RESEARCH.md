# Phase 17: X/Twitter Mentions & Reply Guy - Research

**Researched:** 2026-02-18
**Domain:** Electron dashboard UI (React + TypeScript), IPC handlers, SQLite DB schema
**Confidence:** HIGH (all findings from direct codebase inspection)

## Summary

Both the Mentions and Reply Guy views already exist as fully implemented React components (`XMentionsView.tsx` and `XReplyGuyView.tsx`) with inline reply capability. The IPC backend handlers exist in `electron/main.ts` (lines 8595-9150+) with full implementations for fetch, list, update, reply, and reply-guy operations. However, there is a critical schema mismatch: main.ts references columns (`tweet_id`, `author_id`, `author_name`, `text`, `created_at`, `conversation_id`, `in_reply_to_user_id`, `reply_status`) that do not exist in the actual `x_mentions` DB table. The refactored handler file (`electron/handlers/x-twitter-handlers.ts`) has all mention/reply-guy handlers as stubs returning "Not implemented."

The main gaps for Phase 17 are:
1. Neither view has an agent chat interface -- they are rendered in the center pane only, with no chat integration
2. The DB schema mismatch means all mention handlers will fail at runtime
3. Reply Guy does not show agent-generated suggestions -- it only shows mentions for manual reply

**Primary recommendation:** Fix the DB schema mismatch first, then restructure the layouts to embed agent chat, and add suggestion generation for Reply Guy.

## Standard Stack

### Core (Already In Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | UI framework | Already used across all dashboard components |
| TypeScript | 5.x | Type safety | Already used in all components |
| lucide-react | latest | Icons | Already used in XReplyGuyView (TrendingUp, Zap, Send) |
| better-sqlite3 | latest | DB access | Used via `electron/database.ts` `prepare()` function |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gateway.ts | internal | Agent chat via OpenClaw | For agent chat wiring in mentions/reply-guy |
| MarkdownMessage | internal | Render agent markdown | Already used in XAgentChatPane |
| showToast | internal | User notifications | Already used in XReplyGuyView |
| ConfirmDialog | internal | Confirm actions | Already used in XReplyGuyView |

### Alternatives Considered
None -- all components use the existing stack. No new libraries needed.

## Architecture Patterns

### Current Three-Pane Layout

```
XTwitterPage
  ├── XTabBar (tab selection)
  └── ThreePaneLayout
      ├── Left:   XAgentChatPane (agent chat)
      ├── Center: XContentEditorPane (routes to tab view)
      └── Right:  XApprovalQueuePane (approval queue)
```

**Key layout behavior:**
- `TABS_WITH_APPROVAL` = `['plan', 'drafts']` -- only these tabs show the right pane
- `hideRightPane={!showApprovalPane}` on ThreePaneLayout
- When right pane is hidden: center pane expands to fill remaining width via `effectiveCenterWidth = 100 - leftWidth`

**Current mentions/reply-guy layout:**
- Left pane: XAgentChatPane (already renders with correct agent routing)
- Center pane: XMentionsView or XReplyGuyView (full implementations)
- Right pane: HIDDEN (not in TABS_WITH_APPROVAL -- correct per requirements)

### Pattern 1: Agent Chat Pane (Already Working)

**What:** XAgentChatPane is the standard left-pane chat component for all X tabs.
**How it works:**
- `AGENT_ROUTING` maps each tab to an agent: `mentions` -> `social-manager`, `reply-guy` -> `writer`
- `TAB_CONTEXT` provides system prompts per tab
- Session key format: `agent:{agentId}:xtwitter:{tab}`
- Uses `gateway.sendChatWithCallbacks()` for streaming responses
- Already renders for mentions and reply-guy tabs

**Agent routing (from XAgentChatPane.tsx):**
```typescript
mentions: { agentId: 'social-manager', displayName: 'Social Manager' },
'reply-guy': { agentId: 'writer', displayName: 'Writer' },
```

### Pattern 2: Inline Reply (Mentions - Already Implemented)

**What:** XMentionsView already has inline reply capability.
**Implementation:**
- `selectedMention` state tracks which mention has reply expanded
- Textarea appears inline with 280-char limit
- "Send Reply" button calls `window.clawdbot.xMention.reply()`
- After reply, mention status updates to 'replied'
- Status buttons: Pending / Considering / Ignored / Replied
- Notes field for each mention

### Pattern 3: Reply Guy Quick Draft (Already Implemented)

**What:** XReplyGuyView already has inline approve/edit/send controls.
**Implementation:**
- Shows high-engagement mentions filtered by min likes/retweets
- "Quick Reply" button expands inline textarea
- Fast-track checkbox to skip approval
- "Draft & Approve" or "Create Draft" button
- If fast-tracked: ConfirmDialog offers "Post Now"
- `postNow` calls `window.clawdbot.xReplyGuy.postNow()`

### Anti-Patterns to Avoid
- **Adding mentions/reply-guy to TABS_WITH_APPROVAL:** Per prior decisions, these tabs must NOT show the approval panel. The right pane must remain hidden.
- **Hardcoded colors:** Use `bg-clawd-*`, `text-clawd-*`, `border-clawd-*` tokens
- **Hardcoded blue buttons:** Chat send buttons must use `bg-clawd-accent hover:bg-clawd-accent-dim`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent chat | Custom WebSocket client | XAgentChatPane + gateway.ts | Already handles sessions, streaming, reconnection |
| Toast notifications | Custom notification system | showToast() | Consistent with rest of app |
| Confirm dialogs | Custom modal | ConfirmDialog + useConfirmDialog | Already used in XReplyGuyView |
| Markdown rendering | Custom parser | MarkdownMessage component | Already handles code blocks, links, etc. |

## Common Pitfalls

### Pitfall 1: DB Schema Mismatch (CRITICAL)

**What goes wrong:** All mention IPC handlers in `electron/main.ts` reference columns that do not exist in the `x_mentions` table.

**Columns main.ts expects but DB lacks:**
- `tweet_id` (main.ts uses for dedup and reply)
- `author_id`
- `author_name` (schema has `author_display_name`)
- `text` (schema has `content`)
- `created_at` (schema has `mentioned_at`)
- `conversation_id`
- `in_reply_to_user_id`
- `reply_status` (schema has `replied_to` as INTEGER 0/1)
- `replied_at`
- `replied_with_id`
- `updated_at`

**Actual DB schema columns:** `id, author_username, author_display_name, content, mentioned_at, replied_to (INTEGER), reply_draft_id, fetched_at, metadata`

**How to fix:** Either:
1. ALTER TABLE to add missing columns (preferred -- matches the runtime code), OR
2. Rewrite handlers to use existing schema columns

**Recommendation:** Option 1 -- add columns to match what main.ts expects, since the handler code is already written and the frontend expects the main.ts column names. The table has 0 rows, so migration is trivial.

**Warning signs:** Any mention fetch/list/update/reply call will throw SQLite errors about missing columns.

### Pitfall 2: Duplicate Handler Registration

**What goes wrong:** main.ts registers handlers inline (lines 8595-9150+). The refactored `x-twitter-handlers.ts` also registers the same IPC channel names but as stubs.

**Why it matters:** If `registerXTwitterHandlers()` from x-twitter-handlers.ts is called, it will conflict with or override the main.ts handlers, and all operations will return "Not implemented."

**How to avoid:** Check which registration path is active. Either:
- Use the main.ts handlers (they have full implementations)
- Move the implementations to x-twitter-handlers.ts and remove from main.ts
- Ensure only one registration path is active

### Pitfall 3: XMentionsView Uses Emoji Characters

**What goes wrong:** The view uses raw emoji characters (heart, arrows, speech bubble, etc.) which may not render consistently across platforms and violate the icon pattern used elsewhere.

**How to avoid:** Replace emoji with lucide-react icons for consistency (Heart, RefreshCw, MessageCircle, etc.).

### Pitfall 4: Reply Guy Missing Agent-Generated Suggestions

**What goes wrong:** Phase requirement says "Reply Guy shows reply suggestions" but current XReplyGuyView only shows mentions for manual reply. There is no AI suggestion generation.

**How to fix:** Add a mechanism to generate reply suggestions per mention:
- Option A: Use the agent chat (gateway.sendChatWithCallbacks) to request suggestions for a selected mention
- Option B: Add a dedicated IPC handler that calls an agent to generate suggestions, returning them as structured data

**Recommendation:** Option A is simpler and consistent with the "Reply Guy has a chat interface connected to an agent" requirement. The agent chat can be used to request suggestions, and the user can copy/edit them into the inline reply field.

## Code Examples

### Example 1: Current Agent Chat Wiring Pattern
```typescript
// From XAgentChatPane.tsx - the pattern to follow
const AGENT_ROUTING: Record<XTab, { agentId: string; displayName: string }> = {
  mentions: { agentId: 'social-manager', displayName: 'Social Manager' },
  'reply-guy': { agentId: 'writer', displayName: 'Writer' },
  // ...
};

// Session key format
const sessionKey = `agent:${agentConfig.agentId}:xtwitter:${tab}`;

// Sending messages with streaming
await gateway.sendChatWithCallbacks(contextPrompt, sessionKey, {
  onDelta: (delta) => { /* append to message */ },
  onMessage: (content) => { /* full message */ },
  onEnd: () => { /* done streaming */ },
  onError: (errorMsg) => { /* handle error */ },
});
```

### Example 2: Mention Reply IPC (from preload.ts)
```typescript
// Already exposed in preload.ts
window.clawdbot.xMention = {
  fetch: () => ipcRenderer.invoke('x:mention:fetch'),
  list: (filters?) => ipcRenderer.invoke('x:mention:list', filters),
  update: (data) => ipcRenderer.invoke('x:mention:update', data),
  reply: (data) => ipcRenderer.invoke('x:mention:reply', data),
};

window.clawdbot.xReplyGuy = {
  listHotMentions: (filters?) => ipcRenderer.invoke('x:replyGuy:listHotMentions', filters),
  createQuickDraft: (data) => ipcRenderer.invoke('x:replyGuy:createQuickDraft', data),
  postNow: (data) => ipcRenderer.invoke('x:replyGuy:postNow', data),
};
```

### Example 3: ThreePaneLayout Usage (hideRightPane for mentions/reply-guy)
```typescript
// From XTwitterPage.tsx - mentions and reply-guy already get hideRightPane=true
const TABS_WITH_APPROVAL: XTab[] = ['plan', 'drafts'];
const showApprovalPane = TABS_WITH_APPROVAL.includes(activeTab);

<ThreePaneLayout hideRightPane={!showApprovalPane}>
  <XAgentChatPane tab={activeTab} />       {/* Left: agent chat */}
  <XContentEditorPane tab={activeTab} />   {/* Center: tab content */}
  <XApprovalQueuePane tab={activeTab} />   {/* Right: hidden for mentions/reply-guy */}
</ThreePaneLayout>
```

## Current State Assessment

### What Already Exists

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Mentions tab definition | XTwitterPage.tsx | DONE | `'mentions'` in XTab union type |
| Reply Guy tab definition | XTwitterPage.tsx | DONE | `'reply-guy'` in XTab union type |
| Tab bar entries | XTabBar.tsx | DONE | Mentions (AtSign icon), Reply Guy (Zap icon) |
| XMentionsView | src/components/XMentionsView.tsx | DONE | Full view with inline reply, status management, notes |
| XReplyGuyView | src/components/XReplyGuyView.tsx | DONE | Full view with quick reply, fast-track, post now |
| XContentEditorPane routing | XContentEditorPane.tsx | DONE | Routes `mentions` and `reply-guy` to correct views |
| XAgentChatPane routing | XAgentChatPane.tsx | DONE | Agent routing and system prompts configured |
| Layout (hideRightPane) | XTwitterPage.tsx | DONE | Approval pane hidden for these tabs |
| IPC preload (xMention) | electron/preload.ts | DONE | fetch, list, update, reply exposed |
| IPC preload (xReplyGuy) | electron/preload.ts | DONE | listHotMentions, createQuickDraft, postNow exposed |
| Backend handlers (main.ts) | electron/main.ts:8595-9150 | DONE but BROKEN | Full implementations but reference wrong DB columns |
| Backend handlers (refactored) | electron/handlers/x-twitter-handlers.ts | STUBS | All mention/reply-guy handlers return "Not implemented" |
| DB schema | x-page-schema.sql | MISMATCH | Schema does not match main.ts handler expectations |
| DB data | x_mentions table | EMPTY | 0 rows |

### What Needs To Be Built/Fixed

| Item | Priority | Description |
|------|----------|-------------|
| Fix DB schema mismatch | P0 | ALTER TABLE x_mentions to add missing columns (or rewrite handlers) |
| Decide handler location | P0 | Use main.ts handlers OR migrate to x-twitter-handlers.ts (not both) |
| Agent chat integration for mentions | P1 | Chat is already in left pane but needs UX improvement for context passing |
| Agent chat integration for reply-guy | P1 | Same -- chat works but no "suggest reply for this mention" flow |
| Reply suggestions from agent | P2 | Add way to request agent suggestions per mention and display inline |
| Replace emoji with icons | P3 | Consistency with rest of app |

## Layout Decisions

| Tab | Left Pane (Chat) | Center Pane (Content) | Right Pane (Approval) | hideRightPane |
|-----|---|---|---|---|
| plan | XAgentChatPane (Writer) | XPlanListView | XApprovalQueuePane | false |
| drafts | XAgentChatPane (Writer) | XDraftListView | XApprovalQueuePane | false |
| calendar | XAgentChatPane (Social Mgr) | XCalendarView | HIDDEN | true |
| **mentions** | XAgentChatPane (Social Mgr) | XMentionsView | HIDDEN | true |
| **reply-guy** | XAgentChatPane (Writer) | XReplyGuyView | HIDDEN | true |
| content-mix | XAgentChatPane (Social Mgr) | XContentMixTracker | HIDDEN | true |
| automations | XAgentChatPane (Social Mgr) | XAutomationsTab | HIDDEN | true |
| analytics | XAgentChatPane (Social Mgr) | placeholder | HIDDEN | true |

Both mentions and reply-guy already have `hideRightPane=true` (correct). The agent chat is already rendered in the left pane. The primary UI work is around making the chat contextually useful -- e.g., "suggest a reply to this mention" interaction pattern.

## Open Questions

1. **Handler deduplication:** Should the refactored `x-twitter-handlers.ts` stubs be completed and the main.ts handlers removed? Or keep main.ts as source of truth? This affects whether Phase 17 needs to migrate handlers.
   - What we know: Both files register the same IPC channels. Only one can be active.
   - Recommendation: Keep main.ts as source of truth for now. The refactored stubs were part of a broader refactoring plan that hasn't been completed.

2. **Reply Guy "suggestions" scope:** Does "Reply Guy shows reply suggestions" mean:
   - (a) The agent automatically generates reply drafts for high-engagement mentions, displayed inline? OR
   - (b) The user can ask the agent to suggest replies via chat, then manually copy them?
   - Recommendation: Start with (b) since the chat pane is already there. Add a "Suggest Reply" button on each mention that sends a pre-formatted prompt to the agent chat.

3. **x-api availability:** The mention fetch handler calls `x-api mentions --count 50`. Is x-api functional and configured?
   - What we know: x-api is symlinked at `/opt/homebrew/bin/x-api` -> `~/froggo/tools/x-api/x-api`
   - Unclear: Whether API keys are configured and rate limits allow fetching

## Sources

### Primary (HIGH confidence)
- `/Users/worker/froggo-dashboard/src/components/XTwitterPage.tsx` -- Tab structure, TABS_WITH_APPROVAL, ThreePaneLayout
- `/Users/worker/froggo-dashboard/src/components/XMentionsView.tsx` -- Full mentions view implementation
- `/Users/worker/froggo-dashboard/src/components/XReplyGuyView.tsx` -- Full reply guy view implementation
- `/Users/worker/froggo-dashboard/src/components/XAgentChatPane.tsx` -- Agent chat pattern, routing, session keys
- `/Users/worker/froggo-dashboard/src/components/XThreePaneLayout.tsx` -- Layout mechanics, hideRightPane
- `/Users/worker/froggo-dashboard/src/components/XContentEditorPane.tsx` -- Tab-to-view routing
- `/Users/worker/froggo-dashboard/src/components/XApprovalQueuePane.tsx` -- Approval queue pattern (to avoid)
- `/Users/worker/froggo-dashboard/src/components/XTabBar.tsx` -- Tab definitions and icons
- `/Users/worker/froggo-dashboard/electron/preload.ts` (lines 668-707) -- xMention and xReplyGuy IPC namespaces
- `/Users/worker/froggo-dashboard/electron/main.ts` (lines 8595-9150) -- Full handler implementations
- `/Users/worker/froggo-dashboard/electron/handlers/x-twitter-handlers.ts` -- Refactored stubs
- `/Users/worker/froggo/tools/froggo-db/x-page-schema.sql` -- DB schema definition
- SQLite `.schema x_mentions` query -- Actual running DB schema (confirmed mismatch)
- `/Users/worker/froggo-dashboard/src/lib/gateway.ts` -- sendChatWithCallbacks, setSessionKey

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all from direct codebase inspection
- Architecture: HIGH -- complete component tree traced, all files read
- Pitfalls: HIGH -- DB schema mismatch confirmed via SQLite query, handler duplication confirmed via grep
- Current state: HIGH -- every component, handler, and schema file inspected

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable -- internal codebase, unlikely to change rapidly)
