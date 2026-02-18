# Phase 21: Finance End-to-End Wiring - Research

**Researched:** 2026-02-18
**Domain:** Electron IPC wiring, React UI, SQLite finance schema, froggo-db CLI, agent communication
**Confidence:** HIGH (all based on direct codebase inspection)

## Summary

The Finance module has a substantial foundation already built: 3 React components (`FinancePanel.tsx`, `FinanceInsightsPanel.tsx`, `FinanceAgentChat.tsx`), 12 IPC handlers in `electron/main.ts`, a `FinanceAgentBridge` class in `electron/finance-agent-bridge.ts`, 8 database tables, and 7 CLI commands in `froggo-db`. However, **multiple critical bugs prevent anything from working end-to-end**:

1. **CLI JSON output missing** -- `finance-transactions`, `finance-budget-status`, `finance-alerts` have no `--format json` support, but IPC handlers call them with `--format json` and `JSON.parse()` the output. This means every data-fetching IPC call fails silently.
2. **CLI crash** -- `finance-alerts` command (the second definition at line 411) queries a `status` column that doesn't exist in the `finance_alerts` table (schema uses `acknowledged`).
3. **Upload IPC missing `--account` param** -- `finance:uploadCSV` handler calls `froggo-db finance-upload "${tmpPath}" --format json` but the CLI requires `--account <id>` and doesn't support `--format json`.
4. **Empty database** -- 0 transactions, 0 budgets, 0 insights, 0 alerts. No sample data to test against.
5. **"Create Budget" buttons are dead** -- They render text but have no `onClick` handler, no modal, no IPC.
6. **Chat style partially matches** -- `FinanceAgentChat` already uses `bg-clawd-accent/50` for user bubbles and `bg-clawd-accent` for send button, but the input bar uses `focus:ring-2 focus:ring-info` instead of `focus:ring-clawd-accent` or equivalent, and uses `<input>` instead of `<textarea>`.
7. **Upload modal only accepts `.csv`** -- FIN-02 requires PDF support too.

**Primary recommendation:** Fix the CLI/IPC data pipeline first (JSON output support in froggo-db CLI commands), then fix upload flow (account param, PDF acceptance), then wire up budget creation, and finally align chat styling with Phase 13 pattern.

## Standard Stack

This phase uses NO new libraries. Everything is already in the codebase:

### Core (Already Installed)
| Library | Purpose | Status |
|---------|---------|--------|
| React + TypeScript | UI components | Already used |
| Electron IPC | Main<->Renderer bridge | Already used |
| better-sqlite3 | SQLite access in main process | Already used |
| lucide-react | Icons | Already used |
| Tailwind CSS | Styling (clawd-* design tokens) | Already used |
| froggo-db CLI (Python) | Finance DB operations | Already exists, needs JSON fixes |
| openclaw CLI | Agent communication | Already used by bridge |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|-------------|
| child_process (execAsync) | Invoke froggo-db CLI from Electron | Already used in IPC handlers |
| EventEmitter | FinanceAgentBridge real-time events | Already used |

### No New Dependencies Needed
This phase is purely wiring: fix broken pipelines, add missing handlers, align styling. Zero new npm packages.

## Architecture Patterns

### Existing Project Structure (Finance-related files)
```
electron/
  main.ts              # 12 finance IPC handlers (lines 8067-8268)
  finance-agent-bridge.ts  # Agent communication bridge
  preload.ts           # window.clawdbot.finance + financeAgent namespaces
  paths.ts             # No finance-specific paths needed

src/components/
  FinancePanel.tsx          # Main finance page (516 lines)
  FinanceInsightsPanel.tsx  # AI insights sub-panel (227 lines)
  FinanceAgentChat.tsx      # Agent chat sub-panel (286 lines)

src/types/
  global.d.ts              # finance + financeAgent type declarations (lines 823-840)

~/froggo/tools/froggo-db/
  froggo-db                # Main CLI entry (imports finance_commands)
  finance_commands.py      # 7 CLI commands
  finance_parser.py        # CSV parsing (Revolut, N26, Binance, Coinbase, Generic)
  finance_categorization.py # Auto-categorization engine
  finance_alerts.py        # Alert generation
```

### Pattern 1: IPC Data Flow
**What:** All finance data flows through: React component -> `window.clawdbot.finance.*` -> IPC -> `froggo-db CLI` -> SQLite
**Current implementation:** IPC handlers in `main.ts` shell out to `froggo-db` CLI commands, parse stdout as JSON, return to renderer.
**Problem:** Only `finance-insights` has JSON output. All others output human-readable text.

```typescript
// Current broken pattern (main.ts line 8072):
ipcMain.handle('finance:getTransactions', async (_, limit = 50) => {
  const cmd = `froggo-db finance-transactions --limit ${limit} --format json`;
  const result = await execPromise(cmd, { timeout: 10000 });
  const transactions = JSON.parse(result.stdout); // FAILS - stdout is not JSON
  return { success: true, transactions };
});
```

**Fix options:**
- **Option A (recommended):** Add `--format json` support to each CLI command in `finance_commands.py`
- **Option B:** Use direct SQLite queries in IPC handlers (bypass CLI, like `finance:dismissInsight` already does)

Option A is better because it maintains the CLI as single source of truth and lets agents use the same commands.

### Pattern 2: Agent Communication Bridge
**What:** `FinanceAgentBridge` (singleton) communicates with finance-manager agent via `openclaw agent` CLI
**Flow:** `sendMessage()` -> shell exec `openclaw agent --message ... --session-key agent:finance-manager:dashboard` -> parse stdout -> return response
**Chat history:** Stored as JSONL file at `~/agent-finance-manager/memory/chat-history.jsonl`
**Insight storage:** Bridge writes insights to `finance_ai_insights` table via `sqlite3` command

### Pattern 3: Chat UI Pattern (Phase 13 Reference)
**What:** The app-wide chat style from Phase 13 / ChatPanel.tsx:

```
User bubbles:   bg-clawd-accent/50 text-white rounded-tr-sm
Agent bubbles:  bg-clawd-surface text-clawd-text border border-clawd-border rounded-tl-sm
Send button:    bg-clawd-accent text-white rounded-xl hover:opacity-90
Input area:     border-t border-clawd-border bg-clawd-surface (sibling of messages, not nested)
Input field:    bg-clawd-surface border border-clawd-border rounded-xl focus:border-clawd-accent
```

**FinanceAgentChat current state:**
- User bubbles: `bg-clawd-accent/50 text-white` -- MATCHES
- Agent bubbles: `bg-clawd-bg-alt text-clawd-text` -- DOES NOT MATCH (should be `bg-clawd-surface` with border)
- Send button: `bg-clawd-accent hover:bg-clawd-accent-dim` -- CLOSE (ChatPanel uses `hover:opacity-90`)
- Input area: `border-t border-clawd-border bg-clawd-surface` -- MATCHES
- Input field: `focus:ring-2 focus:ring-info` -- DOES NOT MATCH (should be `focus:border-clawd-accent`)
- Input is `<input>` not `<textarea>` -- Minor mismatch but functional

### Anti-Patterns to Avoid
- **Don't bypass the froggo-db CLI for read operations** -- Multiple agents depend on the same CLI; fixes should go there
- **Don't add new IPC namespaces** -- `finance` and `financeAgent` namespaces already exist
- **Don't create a separate finance DB file** -- All finance tables are in `froggo.db`
- **Don't re-implement chat from scratch** -- `FinanceAgentChat` is mostly correct, just needs style alignment

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom parser | `froggo-db finance-upload` (FinanceCSVParser) | Already handles Revolut, N26, Binance, Coinbase, Generic formats |
| Auto-categorization | ML/regex engine | `CategorizationEngine` in finance_categorization.py | Already exists, runs on upload |
| Agent spawning | Direct process management | `FinanceAgentBridge.initialize()` via openclaw CLI | Handles session checking and spawning |
| Insight storage | Custom DB code | `FinanceAgentBridge.storeAnalysisAsInsight()` | Already handles temp file + sqlite3 insertion |

## Common Pitfalls

### Pitfall 1: CLI Commands Without JSON Output
**What goes wrong:** IPC handlers call CLI with `--format json`, parse stdout, get garbage
**Why it happens:** Only `finance-insights` (second definition) has JSON output support
**How to avoid:** Add `--format json` handling to `cmd_finance_transactions`, `cmd_finance_budget_status`, `cmd_finance_alerts` (both definitions), and `cmd_finance_upload`
**Warning signs:** Console errors with "SyntaxError: Unexpected token" in JSON.parse

### Pitfall 2: Duplicate Function Definitions in finance_commands.py
**What goes wrong:** `cmd_finance_alerts` is defined TWICE (line 224 and line 411) and `cmd_finance_insights` is defined TWICE (line 261 and line 474)
**Why it happens:** The file was built incrementally; second definitions override the first
**How to avoid:** The second definitions are the "real" ones (they have richer functionality). Remove or merge the first definitions.
**Warning signs:** The first `cmd_finance_alerts` (line 224) queries `status` column -- but `finance_alerts` schema has `acknowledged` not `status`. The second `cmd_finance_alerts` (line 411) also queries `status = 'active'` but the schema has no `status` column at all -- **this is a bug**.

### Pitfall 3: Upload Missing Required Parameters
**What goes wrong:** `finance:uploadCSV` IPC handler calls `froggo-db finance-upload "${tmpPath}" --format json` but CLI requires `--account <id>` and `--budget-type <type>`
**Why it happens:** IPC handler was written to the proposed API, not the actual CLI API
**How to avoid:** Either pass account/budget-type from UI, or add sensible defaults in the CLI
**Warning signs:** Upload always fails with "Error: --account <id> is required"

### Pitfall 4: finance_alerts Schema Mismatch
**What goes wrong:** The `finance_alerts` table schema has `acknowledged` (integer 0/1) but no `status` column. Both `cmd_finance_alerts` definitions query a `status` column.
**Why it happens:** Schema and commands were written at different times
**How to avoid:** Fix the CLI to use `acknowledged` instead of `status`, or add a `status` column via migration
**Warning signs:** `sqlite3.OperationalError: no such column: status` -- this is a current crash

### Pitfall 5: Empty Database State
**What goes wrong:** UI shows empty states everywhere, hard to validate fixes
**Why it happens:** No transactions have ever been uploaded
**How to avoid:** The empty state UIs already exist and are well-handled. Test with both empty and populated states.
**Warning signs:** N/A -- empty states are correctly implemented

### Pitfall 6: Agent Bridge Blocking on First Message
**What goes wrong:** First `sendMessage()` call initializes the agent session (~30s), UI appears frozen
**Why it happens:** `initialize()` spawns an openclaw agent session synchronously
**How to avoid:** Show "Connecting to Finance Manager..." state while initializing. The bridge already sets `spawned = false` initially.
**Warning signs:** Chat panel hangs for 30+ seconds on first interaction

## Code Examples

### Current IPC Handlers (Working Reference)
```typescript
// finance:dismissInsight -- WORKS because it uses direct SQLite, not CLI
// Source: electron/main.ts line 8155
ipcMain.handle('finance:dismissInsight', async (_, insightId: string) => {
  const stmt = prepare(`
    UPDATE finance_ai_insights
    SET dismissed = 1, dismissed_at = ?
    WHERE id = ?
  `);
  stmt.run(Date.now(), insightId);
  return { success: true };
});
```

### Chat Style Reference (Phase 13 Pattern)
```tsx
// Source: src/components/ChatPanel.tsx lines 1335-1340
// User message bubble:
<div className="relative px-4 py-3 rounded-2xl shadow-sm bg-clawd-accent/50 text-white rounded-tr-sm">
  ...
</div>

// Agent message bubble:
<div className="relative px-4 py-3 rounded-2xl shadow-sm bg-clawd-surface text-clawd-text border border-clawd-border rounded-tl-sm">
  ...
</div>
```

### Finance Agent Chat Current Style (Needs Alignment)
```tsx
// Source: src/components/FinanceAgentChat.tsx lines 204-208
// User bubble (MATCHES):
<div className="max-w-[80%] rounded-lg p-3 bg-clawd-accent/50 text-white">
  ...
</div>

// Agent bubble (NEEDS FIX -- should be bg-clawd-surface with border):
<div className="max-w-[80%] rounded-lg p-3 bg-clawd-bg-alt text-clawd-text">
  ...
</div>
```

### Preload API Structure
```typescript
// Source: electron/preload.ts lines 617-634
finance: {
  getTransactions: (limit?) => ipcRenderer.invoke('finance:getTransactions', limit),
  getBudgetStatus: (budgetType) => ipcRenderer.invoke('finance:getBudgetStatus', budgetType),
  uploadCSV: (csvContent, filename) => ipcRenderer.invoke('finance:uploadCSV', csvContent, filename),
  getAlerts: () => ipcRenderer.invoke('finance:getAlerts'),
  getInsights: () => ipcRenderer.invoke('finance:getInsights'),
  dismissInsight: (insightId) => ipcRenderer.invoke('finance:dismissInsight', insightId),
  triggerAnalysis: (options?) => ipcRenderer.invoke('finance:triggerAnalysis', options),
},
financeAgent: {
  sendMessage: (message, context?) => ipcRenderer.invoke('financeAgent:sendMessage', message, context),
  getChatHistory: () => ipcRenderer.invoke('financeAgent:getChatHistory'),
  clearHistory: () => ipcRenderer.invoke('financeAgent:clearHistory'),
  triggerAnalysis: (analysisType?) => ipcRenderer.invoke('financeAgent:triggerAnalysis', analysisType),
  getStatus: () => ipcRenderer.invoke('financeAgent:getStatus'),
},
```

### DB Schema Summary
```sql
-- 8 finance tables in froggo.db:
-- finance_accounts       -- bank/crypto/credit card accounts
-- finance_transactions   -- individual transactions (amount, category, budget_type)
-- finance_categories     -- category definitions with keywords for auto-categorization
-- finance_budgets        -- monthly budgets (family/crypto, with period dates)
-- finance_budget_categories -- per-category allocations within a budget
-- finance_alerts         -- rule-based alerts (NO status column -- uses acknowledged 0/1)
-- finance_insights       -- trend-based insights (different from AI insights)
-- finance_ai_insights    -- AI-generated insights from agent analysis (has dismissed flag)
```

## Detailed Findings by Requirement

### FIN-01: Finance Insights Load Without Error
**Current state:** `FinanceInsightsPanel` calls `window.clawdbot.finance.getInsights()` which invokes `froggo-db finance-insights --format json`. This is the ONE command that actually supports `--format json`. It queries `finance_ai_insights` (not `finance_insights`).
**Status:** WORKS if insights exist. Currently 0 insights in DB, so shows "No AI insights yet" empty state.
**Fix needed:** None for basic loading. Insights get populated when `triggerAnalysis` runs or CSV upload triggers analysis. The `triggerAnalysis` button already works via `FinanceAgentBridge`.

### FIN-02: Document Upload (PDF/CSV) Functional
**Current state:** Upload modal only accepts `.csv` files (`accept=".csv"`). The `finance:uploadCSV` IPC handler is missing required `--account` parameter and `--format json` (not supported).
**Fixes needed:**
1. Add PDF to accepted file types in upload modal (and add PDF parsing path in IPC handler or agent bridge)
2. Fix `finance:uploadCSV` to pass `--account` (default to a sensible account ID like `acc-default`) and `--budget-type` (default to `family`)
3. Add `--format json` support to `cmd_finance_upload` in CLI, OR parse the human-readable output in the IPC handler
4. For PDF: either use agent bridge to process (send file path to finance-manager agent), or add PDF parsing library

### FIN-03: Chat Initializes and Connects to Finance-Manager Agent
**Current state:** `FinanceAgentChat` calls `window.clawdbot.financeAgent.sendMessage()` which goes through `FinanceAgentBridge`. The bridge uses `openclaw agent --agent-id finance-manager --session-key agent:finance-manager:dashboard --message ...`. Finance-manager agent exists in `openclaw.json` config.
**Status:** Should work if openclaw gateway is running and agent is available. The bridge handles auto-initialization on first message.
**Fix needed:** Minor -- add initialization status indicator in chat UI (currently shows "Loading chat..." but doesn't indicate agent spawning state).

### FIN-04: "Create Budget" Button Opens Budget Creation Flow
**Current state:** Two "Create Budget" buttons exist (family and crypto) but they have NO `onClick` handler.
**Fixes needed:**
1. Create budget creation modal/form component
2. Add IPC handler `finance:createBudget` (or use direct SQLite insert)
3. Wire button to modal
4. Modal needs: budget name, type (family/crypto), total amount, period (month/custom), category allocations

### FIN-05: "Upload Statement" Button Opens File Picker
**Current state:** "Upload Statement" button exists in header, opens upload modal. Modal has `<input type="file" accept=".csv">`.
**Status:** File picker opens. But upload fails because IPC handler doesn't pass required CLI params.
**Fix needed:** Fix the IPC handler (see FIN-02). Also need to accept `.pdf` per FIN-02.

### FIN-06: Finance Chat UI Matches App-Wide Chat Style
**Current state:** Partially matches. User bubbles correct, agent bubbles wrong, input styling slightly off.
**Fixes needed:**
1. Agent bubbles: change `bg-clawd-bg-alt` to `bg-clawd-surface border border-clawd-border`
2. Input field: change `focus:ring-2 focus:ring-info` to `focus:border-clawd-accent focus:outline-none`
3. Consider: add `rounded-tr-sm` to user bubbles, `rounded-tl-sm` to agent bubbles (ChatPanel detail)
4. Consider: use `<textarea>` instead of `<input>` for multi-line support

## Critical Bugs to Fix (Ordered by Impact)

1. **[BLOCKER] `finance-transactions` no JSON output** -- Every IPC call to get transactions fails
2. **[BLOCKER] `finance-budget-status` no JSON output** -- Every IPC call to get budgets fails
3. **[BLOCKER] `finance-alerts` crashes** -- `OperationalError: no such column: status`
4. **[BLOCKER] `finance:uploadCSV` missing `--account` param** -- Every upload fails
5. **[HIGH] `finance-upload` no JSON output** -- Upload success/failure can't be parsed
6. **[HIGH] "Create Budget" buttons dead** -- No budget creation flow exists
7. **[MEDIUM] Upload modal doesn't accept PDF** -- FIN-02 incomplete
8. **[LOW] Chat styling mismatches** -- FIN-06 partially incomplete

## Implementation Order Recommendation

### Step 1: Fix CLI JSON Output (froggo-db)
Add `--format json` support to:
- `cmd_finance_transactions` -- Return `{"transactions": [...]}` with all fields
- `cmd_finance_budget_status` -- Return `{"budgets": [...]}` with categories nested
- `cmd_finance_alerts` (second definition, line 411) -- Fix `status` column bug, add JSON output
- `cmd_finance_upload` -- Return `{"imported": N, "skipped": N, "errors": N}`

Also fix duplicate function definitions (remove first `cmd_finance_alerts` at line 224 and first `cmd_finance_insights` at line 261).

### Step 2: Fix IPC Upload Handler
- Add default `--account acc-default --budget-type family` to upload command
- OR create a default account on first upload
- Accept PDF files: save to temp, send path to finance-manager agent for processing

### Step 3: Add Budget Creation
- Create `BudgetCreationModal` component
- Add IPC handler `finance:createBudget` (INSERT into `finance_budgets` + `finance_budget_categories`)
- Wire "Create Budget" buttons

### Step 4: Align Chat Styling (FIN-06)
- Fix agent bubble styling
- Fix input field focus styling
- Minor alignment tweaks

## Open Questions

1. **PDF Processing Path**
   - What we know: The upload modal currently only accepts CSV. PDF processing would require either a PDF parsing library or delegating to the finance-manager agent.
   - What's unclear: Should PDF parsing happen in Electron (main process) or should the file be sent to the agent?
   - Recommendation: Send PDF file path to finance-manager agent via bridge. The agent can use tools to extract text. This aligns with the "AI-powered" vision.

2. **Default Account for Uploads**
   - What we know: CLI requires `--account <id>` but no accounts exist in DB yet.
   - What's unclear: Should we auto-create a default account, or show an account selector in the upload modal?
   - Recommendation: Auto-create `acc-default` account on first upload. Later phases can add account management.

3. **Budget Period**
   - What we know: `finance_budgets` schema has `period_start` and `period_end` (epoch ms).
   - What's unclear: Should budget creation default to current month, or allow custom periods?
   - Recommendation: Default to current month. Simple approach: first day to last day of current month.

## Sources

### Primary (HIGH confidence)
All findings are from direct codebase inspection:
- `/Users/worker/froggo-dashboard/electron/main.ts` lines 8067-8268 (finance IPC handlers)
- `/Users/worker/froggo-dashboard/electron/finance-agent-bridge.ts` (full file)
- `/Users/worker/froggo-dashboard/electron/preload.ts` lines 617-634 (finance preload)
- `/Users/worker/froggo-dashboard/src/components/FinancePanel.tsx` (full file, 516 lines)
- `/Users/worker/froggo-dashboard/src/components/FinanceInsightsPanel.tsx` (full file, 227 lines)
- `/Users/worker/froggo-dashboard/src/components/FinanceAgentChat.tsx` (full file, 286 lines)
- `/Users/worker/froggo-dashboard/src/components/ChatPanel.tsx` lines 1335-1340 (Phase 13 chat style)
- `/Users/worker/froggo-dashboard/src/types/global.d.ts` lines 823-840 (type declarations)
- `/Users/worker/froggo/tools/froggo-db/finance_commands.py` (full file, 579 lines)
- `/Users/worker/froggo/data/froggo.db` schema inspection (8 finance tables)
- `/Users/worker/froggo-dashboard/.planning/FINANCE_AI_PLAN.md` (vision document)
- `/Users/worker/agent-finance-manager/` (agent workspace exists)
- `/Users/worker/.openclaw/openclaw.json` (finance-manager agent registered)

### Verified by Execution (HIGH confidence)
- `froggo-db finance-transactions --limit 3 --format json` -- Outputs text, not JSON
- `froggo-db finance-budget-status --type family --format json` -- Outputs text, not JSON
- `froggo-db finance-alerts --format json` -- **CRASHES** with `OperationalError: no such column: status`
- `froggo-db finance-insights --format json` -- Works correctly, outputs `{"insights": []}`
- DB row counts: 0 transactions, 0 budgets, 0 insights, 0 alerts

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing code
- Architecture: HIGH -- patterns directly observed in codebase
- Pitfalls: HIGH -- bugs confirmed by execution
- Implementation order: HIGH -- based on dependency analysis

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable -- no external dependencies to go stale)
