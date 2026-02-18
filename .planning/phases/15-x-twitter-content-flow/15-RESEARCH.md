# Phase 15: X/Twitter Content Flow - Research

**Researched:** 2026-02-18
**Domain:** Electron + React UI (X/Twitter content pipeline) + OpenClaw gateway agent chat
**Confidence:** HIGH

## Summary

This phase connects the X/Twitter Content Plan and Drafts tabs to real data, adds image attachment support, and fixes the agent chat to route correctly with acceptable latency.

The codebase is well-structured for this work. The DB schema, IPC handlers, preload bridge, and React components all exist. The main issues are: (1) the "plan" tab center pane shows a **creation form** (XPlanThreadComposer) instead of displaying actual final drafts for review; (2) the "drafts" tab similarly shows a creation form (XDraftComposer) instead of a list of ready drafts; (3) no image attachment UI exists in either tab; (4) the agent chat (XAgentChatPane) is correctly wired to the gateway but the session key format `agent:writer:xtwitter:plan` may not map to an existing OpenClaw session, causing cold-start latency; (5) the refactored handlers file (`electron/handlers/x-twitter-handlers.ts`) has stub implementations for draft CRUD while `electron/main.ts` has the real implementations -- a duplication risk.

**Primary recommendation:** Replace the creation-form center panes with read-only draft display components; add an image attachment button using the existing `media:upload` IPC pattern; fix agent chat session routing to use `sendChatWithCallbacks` with a pre-warmed session.

## Standard Stack

### Core (already in use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | UI components | Already in codebase |
| TypeScript | 5.x | Type safety | Already in codebase |
| Tailwind CSS | 3.x | Styling (clawd-* tokens) | Already in codebase |
| better-sqlite3 | 11.x | SQLite via Electron main | Already in codebase |
| lucide-react | latest | Icons | Already in codebase |

### Supporting (already in use)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron (IPC) | 33.x | Main/renderer bridge | File dialogs, DB queries |
| gateway.ts | custom | WebSocket to OpenClaw | Agent chat streaming |

### No New Libraries Required
This phase does not require any new npm dependencies. All functionality can be built with existing libraries and patterns.

## Architecture Patterns

### Current Three-Pane Layout
```
XTwitterPage
  XTabBar (top)
  ThreePaneLayout
    [Left]   XAgentChatPane      -- Agent chat (all tabs)
    [Center] XContentEditorPane  -- Tab-specific content
    [Right]  XApprovalQueuePane  -- Approval queue (plan/drafts only)
```

### Pattern 1: Center Pane Split (Creator vs Viewer)
**What:** Currently `XContentEditorPane` renders `XPlanThreadComposer` for the "plan" tab and `XDraftComposer` for the "drafts" tab. Both are **creation forms**. The requirements say these tabs should show **final drafts** (XTW-11, XTW-12), not creation forms.
**When to use:** When the center pane needs to show data from DB rather than a blank form.
**Approach:** Replace the center pane content for plan/drafts tabs with a **draft list/viewer** component that queries `x_drafts` and `x_content_plans` from the DB and renders them read-only with approval actions.

### Pattern 2: IPC Handler Pattern (Existing)
**What:** All X/Twitter data flows through IPC: `preload.ts` exposes `window.clawdbot.xDraft.*` etc., which call `ipcRenderer.invoke('x:draft:*')`, handled in `electron/main.ts`.
**When to use:** Always for DB access. Never query the DB from the renderer.
**Example:**
```typescript
// Renderer calls:
const result = await window.clawdbot.xDraft.list({ status: 'draft', limit: 20 });
// Preload bridges to:
ipcRenderer.invoke('x:draft:list', { status: 'draft', limit: 20 })
// main.ts handles with prepare() for SQL
```

### Pattern 3: Gateway Chat with sendChatWithCallbacks
**What:** `XAgentChatPane` uses `gateway.sendChatWithCallbacks()` which sends `chat.send` over WebSocket with a sessionKey. The gateway routes to the appropriate OpenClaw agent session.
**When to use:** For the agent chat on plan/drafts tabs.
**Key detail:** The session key format is `agent:writer:xtwitter:{tab}`. The gateway's `chat.send` method creates or reuses an OpenClaw session. The first message to a new session will be slow because it needs to create the session and wait for model warm-up. Subsequent messages in the same session should be fast.

### Pattern 4: File Upload via dialog.showOpenDialog
**What:** Electron's native file dialog for image selection, then copy to uploads directory.
**When to use:** For image attachment on drafts.
**Existing patterns:**
- `library:upload` uses `dialog.showOpenDialog` with file type filters
- `media:upload` accepts base64 data and writes to uploads dir
- `x_drafts` table already has `media_paths TEXT` column (JSON array)

### Anti-Patterns to Avoid
- **Don't create new gateway session keys per message** -- reuse the session key for the tab so conversations persist and don't incur cold-start cost each time.
- **Don't use the refactored handlers file** -- `electron/handlers/x-twitter-handlers.ts` has stub implementations for drafts. The real implementations are in `electron/main.ts` lines 8226-8420. The refactored file is incomplete and NOT imported in main.ts.
- **Don't send images as base64 through the gateway** -- store images as files via `media:upload` IPC, then store file paths in `x_drafts.media_paths`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File picker dialog | Custom file input element | `dialog.showOpenDialog` via IPC | Native OS dialog, security sandbox compliance |
| Image thumbnail | Canvas-based resizer | `<img>` with CSS `object-fit: cover` | No need for actual resizing, display-only |
| Chat streaming | Custom WebSocket wrapper | `gateway.sendChatWithCallbacks()` | Already handles runId tracking, timeouts, error cleanup |
| Markdown rendering | Custom parser | `MarkdownMessage` component (already imported) | Already used in XAgentChatPane |
| Toast notifications | Custom notification system | `showToast()` from `./Toast` | Already in use throughout X components |

## Common Pitfalls

### Pitfall 1: Duplicate IPC Handler Registration
**What goes wrong:** Both `electron/main.ts` (lines 7861-8420) and `electron/handlers/x-twitter-handlers.ts` register handlers for the same IPC channels (e.g., `x:research:propose`). If both are imported, Electron throws "Attempted to register a second handler for 'x:research:propose'".
**Why it happens:** The handlers file was created as a refactoring target but `registerXTwitterHandlers()` is never called from main.ts. The handlers file has **stub** implementations for draft/schedule/mention/reply-guy.
**How to avoid:** Either (a) implement new handlers directly in `main.ts` alongside existing ones, or (b) migrate ALL handlers to the refactored file and call `registerXTwitterHandlers()` from main.ts. Do NOT mix.
**Warning signs:** App crash on startup with "second handler" error.

### Pitfall 2: x_content_plans Has No description Column
**What goes wrong:** The `XPlanCreate` handler writes `description` into the markdown file but **does not store it** in the `x_content_plans` database table. The DB schema has no `description` column on this table.
**Why it happens:** Schema was designed with description only on `x_research_ideas`. Plans store structured data (type, thread_length) but the outline/description goes only into the markdown file.
**How to avoid:** When displaying content plan details in the approval queue, either: (a) add a `description` column to `x_content_plans`, or (b) read from the markdown `file_path`, or (c) use the `metadata` JSON column.
**Recommendation:** Add a `description TEXT` column via `ALTER TABLE x_content_plans ADD COLUMN description TEXT;`

### Pitfall 3: Empty DB Tables
**What goes wrong:** All x_ tables are currently empty (0 rows in x_drafts, x_content_plans, x_research_ideas). The UI will show "No items" states.
**Why it happens:** The content pipeline was built but no content has been created yet.
**How to avoid:** Test with seed data. The plan/drafts viewer components should handle empty state gracefully.

### Pitfall 4: Agent Chat Cold Start Latency (XTW-10)
**What goes wrong:** First message to the agent takes multiple seconds because the OpenClaw gateway needs to create a new session and initialize the model.
**Why it happens:** The session key `agent:writer:xtwitter:plan` doesn't exist until the first `chat.send`. Session creation involves model allocation and system prompt injection.
**How to avoid:** Options: (a) pre-warm the session on component mount by sending a silent system message, (b) use an already-active session key (e.g., `agent:writer:dashboard`), (c) accept the first-message latency but ensure streaming starts immediately so the user sees progress.
**Recommendation:** Ensure streaming deltas (`onDelta` callback) are wired so the user sees tokens arriving immediately, even if total time is still a few seconds. This is already implemented in XAgentChatPane. The perceived latency issue may be a missing streaming display -- verify.

### Pitfall 5: Approval Queue Shows Wrong Items
**What goes wrong:** `XApprovalQueuePane` loads different data based on tab: `research` tab loads proposed research ideas, `plan` tab loads proposed plans, `drafts` tab loads drafts with `status='draft'`.
**Why it happens:** The approval queue checks `tab === 'research'` but XTab type doesn't include 'research' (valid values: plan, drafts, calendar, mentions, reply-guy, content-mix, automations, analytics). The research tab was removed from XTab.
**How to avoid:** The approval queue for `plan` tab correctly loads content plans (status='proposed'). For `drafts` tab it loads drafts with status='draft'. These need to show the actual draft text content, not just titles. The current rendering does parse JSON content and show tweet previews -- this is correct.

### Pitfall 6: media_paths Column Semantics
**What goes wrong:** The `xDraft.create` IPC accepts `mediaUrls?: string[]` but the DB column is `media_paths`. These are local file paths, not URLs.
**Why it happens:** Naming inconsistency in the type definition vs DB schema.
**How to avoid:** Always use local file paths stored via `media:upload` handler. The preload type says `mediaUrls` but these should be file paths on disk.

## Code Examples

### Current IPC Bridge for Drafts (from preload.ts)
```typescript
// preload.ts lines 647-655
xDraft: {
  create: (data) => ipcRenderer.invoke('x:draft:create', data),
  list: (filters) => ipcRenderer.invoke('x:draft:list', filters),
  approve: (data) => ipcRenderer.invoke('x:draft:approve', data),
  reject: (data) => ipcRenderer.invoke('x:draft:reject', data),
},
```

### Current Draft Create Handler (from main.ts lines 8228-8298)
```typescript
ipcMain.handle('x:draft:create', async (_, data: {
  planId: string;
  version: string;
  content: string; // JSON for threads
  mediaUrls?: string[];
  proposedBy: string;
}) => {
  // Creates DB entry, markdown file, git commits
  const id = `draft-${Date.now()}-${version}`;
  prepare(`INSERT INTO x_drafts (...) VALUES (...)`).run(...);
  // Also creates ~/froggo/x-content/drafts/YYYY-MM-DD-slug-version.md
});
```

### Current Draft List Handler (from main.ts lines 8301-8345)
```typescript
ipcMain.handle('x:draft:list', async (_, filters?) => {
  let query = 'SELECT * FROM x_drafts WHERE 1=1';
  // Filters: status, planId, limit
  // Returns parsed drafts with media_paths as array
  return { success: true, drafts: parsed };
});
```

### Image Upload Pattern (from main.ts line 4018)
```typescript
ipcMain.handle('library:upload', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
    ],
  });
  if (result.canceled) return { success: false };
  const sourcePath = result.filePaths[0];
  // Copy to uploads dir, return path
});
```

### Agent Chat Streaming (from XAgentChatPane.tsx lines 148-191)
```typescript
await gateway.sendChatWithCallbacks(contextPrompt, sessionKey, {
  onDelta: (delta: string) => {
    agentContent += delta;
    setMessages(prev => prev.map(msg =>
      msg.id === agentMsgId ? { ...msg, content: agentContent } : msg
    ));
  },
  onEnd: () => {
    setMessages(prev => prev.map(msg =>
      msg.id === agentMsgId ? { ...msg, streaming: false } : msg
    ));
    setLoading(false);
  },
  onError: (errorMsg: string) => { /* error handling */ },
});
```

## Key Findings

### Finding 1: Center Pane Shows Forms, Not Content (HIGH confidence)
The `plan` tab center pane renders `XPlanThreadComposer` -- a form to CREATE a new plan. The `drafts` tab renders `XDraftComposer` -- a form to CREATE a new draft. Neither shows existing drafts/plans for review. Requirements XTW-11 and XTW-12 say these should show **final drafts**. The fix is to either replace these components or add a list/viewer mode alongside the creation form.

### Finding 2: Agent Chat Is Already Wired Correctly (HIGH confidence)
`XAgentChatPane` is NOT using a "researcher" stub. It routes `plan` and `drafts` tabs to `writer` agent via `AGENT_ROUTING` map. It uses `gateway.sendChatWithCallbacks()` with streaming. The "researcher" reference in the requirements may be outdated or refer to an earlier version. Current code is correct.

### Finding 3: Image Support is 80% Built (HIGH confidence)
- DB schema: `x_drafts.media_paths` column exists (JSON array of paths)
- IPC handler: `x:draft:create` accepts `mediaUrls` parameter and stores in `media_paths`
- List handler: Parses `media_paths` JSON and returns as array
- Markdown files: Include `## Media` section with image references
- Missing: UI for selecting/attaching images, image preview in approval queue
- Existing pattern: `media:upload` IPC for base64 upload, `library:upload` for native file dialog

### Finding 4: Duplicate Handler Files (HIGH confidence)
`electron/handlers/x-twitter-handlers.ts` has been created as part of a refactoring effort but is NOT imported by `main.ts`. It has full implementations for research and plan handlers but **stub/placeholder** implementations for draft, schedule, mention, and reply-guy handlers (all return `{ success: false, error: 'Not implemented' }`). The real handlers live in `main.ts`. New work should go in `main.ts` unless the refactoring migration is completed.

### Finding 5: Chat Latency Root Cause (MEDIUM confidence)
The `sendChatWithCallbacks` call goes through:
1. Renderer -> gateway WebSocket -> `chat.send` request
2. Gateway creates/reuses OpenClaw session with key `agent:writer:xtwitter:plan`
3. Gateway routes to writer agent, which initializes model
4. Streaming events flow back

First-message latency is expected because session creation + model initialization takes time. The current code already handles streaming via `onDelta`. If multi-second delay persists even for SUBSEQUENT messages, the issue may be:
- Model fallback chain (trying anthropic first, timing out, falling to kimi)
- Session not being reused (key mismatch or session cleanup)
- Gateway reconnection on each tab switch (XAgentChatPane resets messages on tab change)

### Finding 6: x-content Git Repo Structure (HIGH confidence)
```
~/froggo/x-content/
  .git/           # Separate git repo for content versioning
  .gitignore
  README.md
  research/       # Markdown files for research ideas
  plans/          # Markdown files for content plans
  drafts/         # Markdown files for draft content
  media/          # Directory for image attachments
```
All handlers commit to this repo on create/approve/reject. Image files should go in `media/`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate components for create vs view | Single component per tab (create only) | 2026-02-13 (initial build) | Need to add viewer mode |
| No image support | DB column exists, no UI | 2026-02-13 | Need to add UI attachment widget |
| Handler stubs in refactored file | Real handlers in main.ts monolith | 2026-02-13 | Work in main.ts, migrate later |

## Open Questions

1. **Content Plan Description Storage**
   - What we know: `x_content_plans` table has no `description` column. The handler writes description to the markdown file only.
   - What's unclear: Should we add a `description` column or read from the file?
   - Recommendation: Add `ALTER TABLE x_content_plans ADD COLUMN description TEXT;` and store it on creation. Simpler and faster than file reads.

2. **Center Pane UX: Replace or Dual-Mode?**
   - What we know: Requirements say show final drafts. Current UI shows creation form.
   - What's unclear: Should the creation form be removed, moved to a modal, or shown alongside the draft list?
   - Recommendation: Show a draft list/viewer as the primary center pane content. Add a "New Plan"/"New Draft" button that opens the creation form (could be inline collapsible or separate modal).

3. **Chat Latency Diagnosis**
   - What we know: Streaming is implemented. Gateway chat.send creates sessions.
   - What's unclear: Whether the actual latency is from session creation, model cold start, or gateway overhead.
   - Recommendation: Test in dev -- send a message on plan tab, measure time to first delta. If >3s on first message but <1s on subsequent, it's session creation. If always >3s, investigate model routing.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of all files in `/Users/worker/froggo-dashboard/src/components/X*.tsx`
- Direct code inspection of `/Users/worker/froggo-dashboard/electron/main.ts` (lines 7850-8420)
- Direct code inspection of `/Users/worker/froggo-dashboard/electron/handlers/x-twitter-handlers.ts`
- Direct code inspection of `/Users/worker/froggo-dashboard/src/lib/gateway.ts`
- Direct code inspection of `/Users/worker/froggo-dashboard/src/types/global.d.ts`
- DB schema: `/Users/worker/froggo/tools/froggo-db/x-page-schema.sql`
- Live DB inspection: `sqlite3 ~/froggo/data/froggo.db`

### Secondary (MEDIUM confidence)
- OpenClaw gateway behavior inferred from gateway.ts client code and CLAUDE.md documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- direct code inspection of all relevant files
- Pitfalls: HIGH -- verified through code analysis and DB schema inspection
- Chat latency: MEDIUM -- root cause needs runtime testing to confirm

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable codebase, internal project)
