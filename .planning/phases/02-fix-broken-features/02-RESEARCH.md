# Phase 2: Fix Broken Features - Research

**Researched:** 2026-02-12
**Domain:** Electron IPC handlers, React UI components, SQLite database paths, CLI command references
**Confidence:** HIGH (all findings verified by reading actual source code)

## Summary

This research investigated the current state of each FIX requirement (FIX-01 through FIX-10) by reading the actual source files in the dashboard codebase. The key finding is that **Phase 1 (Security Hardening) already fixed several issues** that were originally catalogued, meaning fewer changes are needed than originally estimated.

Of the 10 FIX requirements:
- **3 are fully resolved** (FIX-01 library/x-automations paths, FIX-04 tasks:list WHERE clause)
- **1 is partially resolved** (FIX-10 sessions.db paths fixed in database.ts but API key paths still stale)
- **6 still need fixes** (FIX-02, FIX-03, FIX-05, FIX-06, FIX-07, FIX-08, FIX-09, plus remaining FIX-10)

**Primary recommendation:** Group remaining fixes into two plans: (1) backend/IPC fixes in electron/main.ts (FIX-02, FIX-03, FIX-10 remnants), and (2) frontend component fixes (FIX-05, FIX-06, FIX-07, FIX-08, FIX-09).

## Standard Stack

This phase is pure bugfix work on the existing codebase. No new libraries are needed.

### Core (already in project)
| Library | Purpose | Relevant To |
|---------|---------|-------------|
| Electron (ipcMain/ipcRenderer) | IPC between main and renderer | FIX-02, FIX-03, FIX-10 |
| better-sqlite3 | In-process SQLite queries | FIX-01 (resolved), FIX-04 (resolved) |
| React + Tailwind CSS | UI rendering | FIX-05, FIX-06, FIX-07, FIX-08 |
| react-grid-layout | Dashboard widget grid | FIX-05 |

### Key Files
| File | Size | Fixes Affected |
|------|------|----------------|
| `electron/main.ts` | ~7,272 lines | FIX-02, FIX-03, FIX-10 |
| `electron/preload.ts` | ~500+ lines | FIX-03 |
| `electron/database.ts` | ~130 lines | FIX-10 (partially resolved) |
| `electron/connected-accounts-service.ts` | ~110+ lines | FIX-01 (resolved but uses sqlite3 not better-sqlite3) |
| `src/components/Dashboard.tsx` | ~500+ lines | FIX-05 |
| `src/components/AgentPanel.tsx` | ~470+ lines | FIX-06 |
| `src/components/ChatRoomView.tsx` | ~750+ lines | FIX-07 |
| `src/components/InboxPanel.tsx` | ~1950+ lines | FIX-08, FIX-09 |
| `src/components/VoiceChatPanel.tsx` | ~1000+ lines | FIX-09 |
| `src/components/TaskDetailPanel.tsx` | ~1450+ lines | FIX-09 |

## Architecture Patterns

### Pattern 1: Shared prepare() for DB Access
Phase 1 established `electron/database.ts` as the single source of truth for DB connections. All IPC handlers in main.ts now use `prepare()` from database.ts instead of spawning `sqlite3` subprocesses.

```typescript
// Source: electron/database.ts (lines 13-36)
const FROGGO_DB_PATH = join(homedir(), 'clawd', 'data', 'froggo.db');
export const db = new Database(FROGGO_DB_PATH, { fileMustExist: true });

export function prepare(sql: string): Database.Statement {
  if (!statementCache.has(sql)) {
    statementCache.set(sql, db.prepare(sql));
  }
  return statementCache.get(sql)!;
}
```

**Impact on FIX-01:** The library:view and library:download handlers were migrated to `prepare()` during Phase 1, which automatically uses the correct `~/froggo/data/froggo.db` path. The x-automations-service was also migrated to use `prepare()`. The only file still using its own DB_PATH is `connected-accounts-service.ts`, but it already has the correct path (`~/froggo/data/froggo.db`).

### Pattern 2: Preload Bridge Namespace
The preload.ts exposes IPC channels as `window.clawdbot.*`. This namespace is **intentional and NOT a CLI reference** -- it's the API surface for the renderer process. Renaming this would require touching 100+ call sites across the entire frontend. FIX-09 only targets literal `clawdbot` **CLI command strings** passed to exec, not the window namespace.

### Anti-Patterns to Avoid
- **Don't rename `window.clawdbot`**: This is the preload API namespace, not a CLI reference. Renaming it is out of scope and would touch nearly every component.
- **Don't change the DB access pattern**: connected-accounts-service uses `sqlite3` (callback-based) instead of `better-sqlite3` (synchronous). Converting it is a separate task, not a bugfix.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent spawning | Custom Python script | `openclaw agent --agent X --message "..."` | The deleted spawn-agent-with-retry.py is gone; openclaw CLI is the supported method |
| Tailwind hover classes | Dynamic string interpolation | Static lookup map keyed by known classes | Tailwind's JIT compiler cannot detect dynamically constructed class names |

## Common Pitfalls

### Pitfall 1: Tailwind JIT Cannot Detect Dynamic Classes
**What goes wrong:** `hover:${theme.bg}` compiles to `hover:bg-green-500/8` at runtime, but Tailwind's JIT compiler never sees the full class string in source code, so the CSS rule is never generated.
**Why it happens:** Tailwind scans source files at build time for complete class names. Dynamic string concatenation produces class names that don't exist in the CSS bundle.
**How to avoid:** Use a lookup map that contains all possible complete class strings:
```typescript
const hoverBgMap: Record<string, string> = {
  'bg-green-500/8': 'hover:bg-green-500/8',
  'bg-blue-500/8': 'hover:bg-blue-500/8',
  // ... all known agent theme bg values
};
```
Or use Tailwind's `safelist` in config, or use inline `style` attributes for hover states.
**Warning signs:** Hover effects work in dev mode (Tailwind scans more aggressively) but fail in production builds.

### Pitfall 2: Filtered Array Index vs Original Array Index
**What goes wrong:** In ChatRoomView.tsx, the `.filter().map()` chain produces a filtered array where `idx` is the filtered index, but `room.messages[idx - 1]` references the *original unfiltered* array.
**Why it happens:** The avatar grouping logic on line 619 uses `room.messages[idx - 1]` to check if the previous message has the same sender, but `idx` is the index in the filtered output, not the original array. A filtered message at position 2 might correspond to original message 5, so `room.messages[1]` would be a completely different (and filtered-out) message.
**How to avoid:** Either: (a) filter first, store result, then map over the filtered array using its own previous element, or (b) track the previous *displayed* message in a variable.

### Pitfall 3: IPC Channel Name Mismatch
**What goes wrong:** Preload sends `ai:generate-content` (kebab-case) but main.ts registers `ai:generateContent` (camelCase). The invoke silently fails.
**Why it happens:** The handler name was changed in main.ts during refactoring but the preload.ts was not updated (or vice versa).
**How to avoid:** Register the handler with the exact channel name used in preload, or update preload to match.

### Pitfall 4: JSON.parse Without Guard in Hot Path
**What goes wrong:** `JSON.parse(item.metadata)` throws on malformed JSON, crashing the component.
**Why it happens:** Metadata comes from the DB where some rows may have invalid JSON, empty strings, or `null` that passed through as a string.
**How to avoid:** Wrap every `JSON.parse` in try/catch or use a safe parser utility function.

## Code Examples

### FIX-02: Replace spawn-agent-with-retry.py with openclaw CLI
```typescript
// CURRENT (broken — script doesn't exist):
// electron/main.ts line 6259
exec(`/opt/homebrew/bin/spawn-agent-with-retry.py notify "${agentId}" "Task assigned: ${taskId}"`, ...)

// FIX: Use openclaw CLI directly
exec(`openclaw agent --agent "${agentId}" --message "Task assigned: ${taskId}" --json`, {
  encoding: 'utf-8',
  timeout: 15000,
  env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` }
}, ...)
```

### FIX-03: Register Missing AI IPC Handlers
```typescript
// Preload sends these channel names (electron/preload.ts lines 377-388):
//   'ai:generate-content'   → main.ts has 'ai:generateContent' (MISMATCH)
//   'ai:generateReply'      → main.ts has NOTHING registered
//   'ai:getAnalysis'        → main.ts has NOTHING registered

// Option A: Register handlers in main.ts matching preload names
ipcMain.handle('ai:generate-content', async (_, prompt, type) => { ... });
ipcMain.handle('ai:generateReply', async (_, context) => { ... });
ipcMain.handle('ai:getAnalysis', async (_, id, platform) => { ... });

// Option B: Fix preload to match existing handler name
// preload.ts line 377: change 'ai:generate-content' to 'ai:generateContent'
// But generateReply and getAnalysis still need handlers either way

// The old main.ts.before-cleanup had all three handlers:
//   line 4965: ai:generate-content
//   line 5070: ai:generateReply
//   line 5386: ai:getAnalysis
// They were lost during Phase 1 cleanup. Recovery is possible from the backup.
```

### FIX-05: Fix DEFAULT_LAYOUT Key
```typescript
// CURRENT (Dashboard.tsx line 71):
{ id: 'active-work', x: 0, y: 9, w: 8, h: 8 },
//  ^^-- wrong key! react-grid-layout uses 'i' not 'id'

// FIX:
{ i: 'active-work', x: 0, y: 9, w: 8, h: 8 },
```

### FIX-06: Fix Dynamic Tailwind Hover Class
```typescript
// CURRENT (AgentPanel.tsx line 346):
className={`p-1.5 rounded-lg transition-colors hover:${theme.bg} ${theme.text} opacity-50 hover:opacity-100`}

// FIX: Use lookup map
const HOVER_BG_MAP: Record<string, string> = {
  'bg-green-500/8': 'hover:bg-green-500/8',
  'bg-blue-500/8': 'hover:bg-blue-500/8',
  'bg-orange-500/8': 'hover:bg-orange-500/8',
  'bg-purple-500/8': 'hover:bg-purple-500/8',
  'bg-red-500/8': 'hover:bg-red-500/8',
  'bg-teal-500/8': 'hover:bg-teal-500/8',
  'bg-pink-500/8': 'hover:bg-pink-500/8',
  'bg-sky-500/8': 'hover:bg-sky-500/8',
  'bg-violet-500/8': 'hover:bg-violet-500/8',
  'bg-amber-600/8': 'hover:bg-amber-600/8',
  'bg-rose-500/8': 'hover:bg-rose-500/8',
  'bg-cyan-500/8': 'hover:bg-cyan-500/8',
  'bg-indigo-500/8': 'hover:bg-indigo-500/8',
  'bg-blue-700/8': 'hover:bg-blue-700/8',
  'bg-yellow-600/8': 'hover:bg-yellow-600/8',
  'bg-clawd-surface': 'hover:bg-clawd-surface',
};

className={`p-1.5 rounded-lg transition-colors ${HOVER_BG_MAP[theme.bg] || ''} ${theme.text} opacity-50 hover:opacity-100`}
```

### FIX-07: Fix Avatar Grouping Index Mismatch
```typescript
// CURRENT (ChatRoomView.tsx lines 612-619):
room.messages.filter(m => {
  const t = m.content?.trim();
  if (t === 'NO_REPLY' || ...) return false;
  return m.streaming || t;
}).map((msg, idx) => {
  // BUG: idx is filtered index, but room.messages[idx-1] is unfiltered
  const showAvatar = idx === 0 || room.messages[idx - 1]?.agentId !== msg.agentId || room.messages[idx - 1]?.role !== msg.role;

// FIX: Pre-filter, then reference filtered array
const displayedMessages = room.messages.filter(m => {
  const t = m.content?.trim();
  if (t === 'NO_REPLY' || ...) return false;
  return m.streaming || t;
});

// In JSX:
displayedMessages.map((msg, idx) => {
  const prev = idx > 0 ? displayedMessages[idx - 1] : null;
  const showAvatar = !prev || prev.agentId !== msg.agentId || prev.role !== msg.role;
```

### FIX-08: Guard JSON.parse(metadata) in InboxPanel
```typescript
// UNGUARDED occurrences in InboxPanel.tsx:
// Line 228: const metadata = item.metadata ? JSON.parse(item.metadata) : {};
// Line 1370: const meta = JSON.parse(item.priority_metadata);
// Line 1941: JSON.parse(pendingApprovalItem.metadata)

// Many other occurrences ARE already guarded with try/catch (lines 43, 199, 510, 551, etc.)

// FIX: Wrap unguarded instances:
// Line 228:
const metadata = (() => {
  if (!item.metadata) return {};
  try {
    return typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
  } catch { return {}; }
})();

// Or create a utility:
function safeParseMeta(raw: string | object | null | undefined): Record<string, any> {
  if (!raw) return {};
  if (typeof raw !== 'string') return raw as Record<string, any>;
  try { return JSON.parse(raw); } catch { return {}; }
}
```

### FIX-09: Replace clawdbot CLI Strings with openclaw
```typescript
// 4 locations with literal `clawdbot` CLI commands:

// VoiceChatPanel.tsx line 962:
`clawdbot gateway sessions-send --target "agent:${args.agent_id}:main" --message "${safeMsg}" 2>&1`
// → `openclaw gateway sessions-send --target "agent:${args.agent_id}:main" --message "${safeMsg}" 2>&1`

// VoiceChatPanel.tsx line 995:
`clawdbot gateway sessions-send --label discord --message "${safeMsg}" 2>&1`
// → `openclaw gateway sessions-send --label discord --message "${safeMsg}" 2>&1`

// InboxPanel.tsx line 1930:
`clawdbot sessions kill ${activeAgentSession.sessionId}`
// → `openclaw sessions kill ${activeAgentSession.sessionId}`

// TaskDetailPanel.tsx line 1431:
`clawdbot sessions abort ${activeAgentInfo.sessionKey}`
// → `openclaw sessions abort ${activeAgentInfo.sessionKey}`
```

### FIX-10: Fix Stale .clawdbot/ Paths in main.ts
```typescript
// 3 remaining .clawdbot/ references in main.ts:

// Line 896: ElevenLabs API key
const envPath = path.join(os.homedir(), '.clawdbot', 'elevenlabs.env');
// → path.join(os.homedir(), '.openclaw', 'elevenlabs.env')

// Line 4134: Anthropic API key
const keyPath = path.join(os.homedir(), '.clawdbot', 'anthropic.key');
// → path.join(os.homedir(), '.openclaw', 'anthropic.key')

// Line 4144: OpenClaw config fallback (this one is actually useful as a legacy fallback)
path.join(os.homedir(), '.clawdbot', 'openclaw.json'),
// Could keep as fallback OR remove if .clawdbot/ symlink to .openclaw/ exists

// Line 4180: OpenAI API key
const keyPath = path.join(os.homedir(), '.clawdbot', 'openai.key');
// → path.join(os.homedir(), '.openclaw', 'openai.key')

// NOTE: database.ts (line 74) already has both paths with proper fallback:
// const SESSIONS_DB_PATH = join(homedir(), '.openclaw', 'sessions.db');
// const SESSIONS_DB_PATH_LEGACY = join(homedir(), '.clawdbot', 'sessions.db');
// This is correctly handled — sessions.db paths are NOT broken.
```

## Detailed Fix Status Per Requirement

### FIX-01: Fix Wrong DB Paths (~/Froggo/ references)
**Status: RESOLVED by Phase 1**
**Confidence: HIGH**

Evidence:
- `electron/main.ts` lines 3966-3967, 4020-4021: library:view and library:download now use `prepare()` from database.ts (correct path `~/froggo/data/froggo.db`)
- `electron/x-automations-service.ts` line 2: imports `prepare` from `./database` — fully migrated
- `electron/connected-accounts-service.ts` line 27: `DB_PATH = path.join(os.homedir(), 'clawd', 'data', 'froggo.db')` — already correct (comment says "fixed")
- No remaining `~/Froggo/` references in executable code (only in comments and planning docs)

**Remaining work: NONE** for FIX-01 specifically. The connected-accounts-service still uses its own sqlite3 connection instead of shared `prepare()`, but the path is correct. Converting it to better-sqlite3 would be a separate optimization task.

### FIX-02: Fix agents:spawnForTask Handler
**Status: STILL BROKEN**
**Confidence: HIGH**

Evidence:
- `electron/main.ts` line 6259: Still references `/opt/homebrew/bin/spawn-agent-with-retry.py`
- This script was deleted on 2026-02-10 (per CLAUDE.md)
- The handler will fail with "file not found" when any user clicks the Start/Play button on an agent's task

**Fix needed:** Replace the exec command with `openclaw agent --agent "${agentId}" --message "Task assigned: ${taskId}" --json`

**Dependencies:** None. Self-contained fix.
**Risk:** LOW. The handler is already broken; any change is an improvement.

### FIX-03: Register Missing AI IPC Handlers
**Status: STILL BROKEN**
**Confidence: HIGH**

Evidence:
- `electron/preload.ts` line 377: sends `ai:generate-content` (kebab-case)
- `electron/main.ts` line 4269: registers `ai:generateContent` (camelCase) — **NAME MISMATCH**
- `electron/preload.ts` line 386: sends `ai:generateReply` — **NO HANDLER in main.ts**
- `electron/preload.ts` line 388: sends `ai:getAnalysis` — **NO HANDLER in main.ts**
- `electron/main.ts.before-cleanup` has all three handlers at lines 4965, 5070, 5386 — they were lost during Phase 1 cleanup

**Fix needed:**
1. Either rename the main.ts handler from `ai:generateContent` to `ai:generate-content`, OR update preload to use `ai:generateContent`
2. Restore `ai:generateReply` handler from backup (or write stub that returns error)
3. Restore `ai:getAnalysis` handler from backup (or write stub that returns error)

**Dependencies:** These handlers use `anthropicApiKey` which is loaded at main.ts line 4132. FIX-10 (fixing .clawdbot path for anthropic.key) should be done first or simultaneously.
**Risk:** MEDIUM. Restoring handlers from backup requires careful review to ensure Phase 1 security patterns (parameterized queries) are maintained.

### FIX-04: Fix tasks:list WHERE Clause
**Status: RESOLVED by Phase 1**
**Confidence: HIGH**

Evidence:
- `electron/main.ts` lines 1348-1350: The tasks:list handler now uses:
  ```sql
  (cancelled IS NULL OR cancelled = 0) AND (archived IS NULL OR archived = 0)
  ```
- The `cancelled` column DOES exist in the schema (confirmed via `sqlite3 .schema tasks`)
- The original bug description said it filtered on a nonexistent `cancelled` column, but the column exists and the query is correct

**Remaining work: NONE.** The WHERE clause correctly excludes both cancelled and archived tasks.

### FIX-05: Fix Dashboard DEFAULT_LAYOUT Key
**Status: STILL BROKEN**
**Confidence: HIGH**

Evidence:
- `src/components/Dashboard.tsx` line 71: `{ id: 'active-work', x: 0, y: 9, w: 8, h: 8 }`
- react-grid-layout requires `i` property (not `id`) for layout items
- All other layout items on lines 64-78 correctly use `i:`
- This single typo causes the active-work widget to be invisible or mispositioned

**Fix needed:** Change `id:` to `i:` on line 71.
**Dependencies:** None.
**Risk:** VERY LOW. One-character fix with clear expected behavior.

### FIX-06: Fix AgentPanel Dynamic Tailwind Hover Classes
**Status: STILL BROKEN**
**Confidence: HIGH**

Evidence:
- `src/components/AgentPanel.tsx` line 346: `hover:${theme.bg}` — dynamically constructed class
- `theme.bg` values are strings like `bg-green-500/8`, `bg-blue-500/8` etc. (from agentThemes.ts)
- The constructed class `hover:bg-green-500/8` is never present as a complete string in source code
- Tailwind's JIT compiler cannot detect it, so the CSS rule is never generated
- The hover effect on the Chat button for each agent card fails silently

**Fix needed:** Create a static lookup map of `bg-*` to `hover:bg-*` values, or add a Tailwind safelist, or use inline styles.
**Dependencies:** Must know all possible `theme.bg` values. Currently 16 known agents + 1 default theme in agentThemes.ts.
**Risk:** LOW. Pure CSS class resolution fix; no logic changes.

### FIX-07: Fix ChatRoomView Avatar Grouping Index
**Status: STILL BROKEN**
**Confidence: HIGH**

Evidence:
- `src/components/ChatRoomView.tsx` lines 612-619:
  ```typescript
  room.messages.filter(m => { ... }).map((msg, idx) => {
    const showAvatar = idx === 0 || room.messages[idx - 1]?.agentId !== msg.agentId ...
  ```
- The `.filter()` removes messages with content like `NO_REPLY`, `HEARTBEAT_OK`, etc.
- After filtering, `idx` is the position in the filtered array
- But `room.messages[idx - 1]` references the UNFILTERED array
- This causes avatars to show/hide incorrectly when filtered messages exist between displayed messages

**Fix needed:** Store filtered messages in a variable first, then reference the filtered array for previous-message checks.
**Dependencies:** None.
**Risk:** LOW. The fix simplifies the logic and makes avatar grouping more predictable.

### FIX-08: Guard InboxPanel JSON.parse(metadata)
**Status: STILL BROKEN (partially)**
**Confidence: HIGH**

Evidence:
- Many JSON.parse calls in InboxPanel.tsx are ALREADY guarded (lines 43, 199, 510, 551, 632, 725, 797, 856, 1651, 1729)
- **UNGUARDED** calls that can crash the component:
  - **Line 228**: `const metadata = item.metadata ? JSON.parse(item.metadata) : {};` — in priority score calculation loop (runs for EVERY item)
  - **Line 1370**: `const meta = JSON.parse(item.priority_metadata);` — in priority analysis display
  - **Line 1941**: `JSON.parse(pendingApprovalItem.metadata)` — in agent abort flow

**Fix needed:** Wrap these 3 unguarded JSON.parse calls with try/catch. Consider creating a shared `safeParseMeta()` utility.
**Dependencies:** None.
**Risk:** LOW. Adding error handling can only improve robustness. Fallback to empty object `{}` on parse failure.

### FIX-09: Replace clawdbot CLI Strings with openclaw
**Status: STILL BROKEN**
**Confidence: HIGH**

Evidence — 4 locations with literal `clawdbot` CLI commands in template strings:

| File | Line | Command | Replace With |
|------|------|---------|-------------|
| VoiceChatPanel.tsx | 962 | `clawdbot gateway sessions-send --target ...` | `openclaw gateway sessions-send --target ...` |
| VoiceChatPanel.tsx | 995 | `clawdbot gateway sessions-send --label ...` | `openclaw gateway sessions-send --label ...` |
| InboxPanel.tsx | 1930 | `clawdbot sessions kill ...` | `openclaw sessions kill ...` |
| TaskDetailPanel.tsx | 1431 | `clawdbot sessions abort ...` | `openclaw sessions abort ...` |

**Important:** The `window.clawdbot` namespace in preload.ts is the API bridge, NOT a CLI reference. It should NOT be renamed — it would require changing 100+ call sites across the frontend with zero user-visible benefit.

**Fix needed:** Simple string replacement of `clawdbot` with `openclaw` in the 4 CLI command strings.
**Dependencies:** None.
**Risk:** LOW. Direct string replacement. Verify `openclaw sessions abort` and `openclaw sessions kill` commands exist (they should, as openclaw is the successor CLI).

### FIX-10: Fix Stale .clawdbot/ Paths in main.ts
**Status: PARTIALLY RESOLVED**
**Confidence: HIGH**

Evidence:
- `database.ts` lines 73-84: sessions.db is correctly handled with both `.openclaw` and `.clawdbot` paths as primary/fallback
- **Still broken — 3 API key file paths in main.ts:**
  - Line 896: `path.join(os.homedir(), '.clawdbot', 'elevenlabs.env')` — ElevenLabs key
  - Line 4134: `path.join(os.homedir(), '.clawdbot', 'anthropic.key')` — Anthropic key
  - Line 4180: `path.join(os.homedir(), '.clawdbot', 'openai.key')` — OpenAI key
- Line 4144: `path.join(os.homedir(), '.clawdbot', 'openclaw.json')` — config fallback (may be intentional)

**Fix needed:**
- Change primary paths from `.clawdbot` to `.openclaw` for the 3 API key files
- Optionally keep `.clawdbot` as fallback (same pattern as database.ts sessions.db)
- Line 4144 can remain as a legacy fallback since it's already the second entry in the config search array

**Dependencies:** Verify that the key files actually exist at `~/.openclaw/` on the target system. Per CLAUDE.md, `.clawdbot` was symlinked from `.openclaw`, so both paths likely work, but the canonical path should be `.openclaw`.
**Risk:** LOW. If the files don't exist at the new path, the code already has fallback logic (environment variables, openclaw.json config).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sqlite3` subprocess calls | `better-sqlite3` via shared `prepare()` | Phase 1 (2026-02) | FIX-01 resolved as side-effect |
| `spawn-agent-with-retry.py` | `openclaw agent --agent X --message "..."` | 2026-02-10 (script deleted) | FIX-02 became critical |
| `clawdbot` CLI | `openclaw` CLI | 2026-02-02 (migration) | FIX-09 became needed |
| `~/.openclaw/` state dir | `~/.openclaw/` (with symlink) | 2026-02-02 (migration) | FIX-10 partially resolved |

## Open Questions

1. **AI handler restoration scope**
   - What we know: `ai:generate-content`, `ai:generateReply`, and `ai:getAnalysis` handlers exist in `main.ts.before-cleanup`
   - What's unclear: Were they intentionally removed during Phase 1, or accidentally lost? Do they use any SQL patterns that need Phase 1 security treatment?
   - Recommendation: Read the backup file, assess security compliance, port if safe. If they used raw SQL, rewrite with `prepare()`.

2. **connected-accounts-service DB pattern**
   - What we know: It uses its own `sqlite3` (async/callback) connection instead of shared `better-sqlite3`
   - What's unclear: Was this intentionally left during Phase 1? Is it causing issues?
   - Recommendation: Flag for future optimization but don't change in this phase (the path is correct, it works)

3. **openclaw CLI session commands**
   - What we know: FIX-09 replaces `clawdbot sessions kill/abort` with `openclaw sessions kill/abort`
   - What's unclear: Do these exact subcommands exist in openclaw? (clawdbot was renamed to openclaw)
   - Recommendation: Verify with `openclaw sessions --help` before deploying

## Sources

### Primary (HIGH confidence)
- Direct source file reads: `electron/main.ts`, `electron/preload.ts`, `electron/database.ts`, `electron/connected-accounts-service.ts`, `electron/x-automations-service.ts`, `src/components/Dashboard.tsx`, `src/components/AgentPanel.tsx`, `src/components/ChatRoomView.tsx`, `src/components/InboxPanel.tsx`, `src/components/VoiceChatPanel.tsx`, `src/components/TaskDetailPanel.tsx`, `src/utils/agentThemes.ts`
- `electron/main.ts.before-cleanup` — backup with original AI handlers
- Live database schema: `sqlite3 ~/froggo/data/froggo.db ".schema tasks"`
- Phase 1 planning docs: `.planning/phases/01-security-hardening/01-05-SUMMARY.md`

## Metadata

**Confidence breakdown:**
- FIX-01 status (resolved): HIGH — verified by reading actual code
- FIX-02 fix approach: HIGH — openclaw CLI documented in CLAUDE.md
- FIX-03 handler mismatch: HIGH — channel names verified in both files
- FIX-04 status (resolved): HIGH — verified by reading actual code and DB schema
- FIX-05 layout key: HIGH — property name verified against react-grid-layout API
- FIX-06 Tailwind issue: HIGH — well-known Tailwind JIT limitation
- FIX-07 index bug: HIGH — verified filter/map chain logic
- FIX-08 unguarded parse: HIGH — line numbers verified
- FIX-09 CLI refs: HIGH — all 4 locations confirmed
- FIX-10 paths: HIGH — all file paths verified

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (stable codebase, all findings from direct source inspection)
