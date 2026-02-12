# Phase 04: Cleanup & Debloat - Research

**Researched:** 2026-02-12
**Domain:** Dead code removal, CSS standardization, debug cleanup, shortcut deconfliction
**Confidence:** HIGH (all findings verified against actual codebase)

## Summary

This phase is pure deletion and correction -- no new features, no new libraries, no architecture changes. Every target has been verified by reading source files and tracing import chains across the codebase.

The codebase has 7 dead lib files, 5 dead panel exports (with 4+ dead component files behind them), 17 backup/bak files, custom CSS classes that duplicate Tailwind builtins, debug output visible in production UI, and a keyboard shortcut configuration panel whose defaults don't match the actual hardcoded shortcuts (with a collision at Cmd+7).

**Primary recommendation:** Execute requirements CLEAN-01 through CLEAN-05 as pure file deletions first, then CLEAN-06 through CLEAN-08 as surgical edits. Verify with `tsc --noEmit` after each deletion batch.

## Standard Stack

No new libraries needed. This is a deletion/correction phase.

### Core (already in project)
| Library | Version | Purpose | Relevance |
|---------|---------|---------|-----------|
| Tailwind CSS | ^3.4.0 | Utility-first CSS | CLEAN-06: has built-in `shrink-0`, `whitespace-nowrap`, `truncate`, `line-clamp-2` |
| TypeScript | (project version) | Type checking | Use `tsc --noEmit` to verify no broken imports after deletions |

## Architecture Patterns

### Pattern: Verify-Before-Delete
**What:** Before deleting any file, confirm zero live imports.
**When to use:** Every CLEAN-01/02 deletion.

```bash
# Check if a file has any live importers
grep -r "from.*filename" src/ --include="*.ts" --include="*.tsx" | grep -v ".bak" | grep -v ".backup"
```

### Pattern: Tailwind Replacement for Custom CSS
**What:** Replace custom CSS utility classes with Tailwind equivalents.

| Custom Class | CSS Property | Tailwind Equivalent |
|-------------|-------------|-------------------|
| `no-shrink` | `flex-shrink: 0` | `shrink-0` |
| `flex-fill` | `flex: 1; min-width: 0` | `flex-1 min-w-0` |
| `no-wrap` | `white-space: nowrap` | `whitespace-nowrap` |
| `message-preview` | `-webkit-line-clamp: 2` + overflow | `line-clamp-2` |
| `agent-name` | `truncate + min-width: 0` | `truncate min-w-0` |
| `session-name` | `truncate + min-width: 0` | `truncate min-w-0` |
| `text-truncate` | `truncate` | `truncate` |
| `flex-shrink` | (incomplete -- no value) | `shrink` or `shrink-0` depending on intent |

**Note:** Tailwind 3.3+ includes `line-clamp-*` natively (no plugin needed). Project uses ^3.4.0.

### Anti-Patterns to Avoid
- **Deleting CSS classes used by non-.bak files:** `no-shrink`, `flex-fill`, etc. are used across Kanban.tsx, AgentPanel.tsx, AgentMetricsCard.tsx, Dashboard.tsx, and more -- not just QuickStatsWidget. The CLEAN-06 requirement scopes to QuickStatsWidget only. Do NOT remove the CSS class definitions from `text-utilities.css` unless ALL usages are migrated.
- **Assuming SettingsPanel shortcuts control navigation:** They don't. App.tsx has hardcoded shortcuts. The Settings shortcut editor saves to localStorage but nothing reads it.

## Don't Hand-Roll

Not applicable -- this is a deletion/correction phase, not a build phase.

## Common Pitfalls

### Pitfall 1: Breaking Lazy Import Chains
**What goes wrong:** Deleting a component file that ProtectedPanels lazily imports causes a runtime error (chunk load failure).
**Why it happens:** `lazy(() => import('./ThreePaneInbox'))` throws at runtime if ThreePaneInbox.tsx is deleted but the lazy import line remains.
**How to avoid:** Always delete both the ProtectedPanels import/export lines AND the component file together.
**Warning signs:** `tsc --noEmit` won't catch lazy import issues -- you need to also `grep` for the deleted filename.

### Pitfall 2: Orphaned CSS Classes After QuickStatsWidget Fix
**What goes wrong:** Replacing custom classes in QuickStatsWidget only, while 15+ other files still use them, leaves the CSS class definitions needed.
**Why it happens:** CLEAN-06 says "Fix non-standard CSS classes in QuickStatsWidget" but the classes are shared.
**How to avoid:** For CLEAN-06, ONLY fix QuickStatsWidget. Leave `text-utilities.css` class definitions intact. A full codebase migration of these classes is out of scope.

### Pitfall 3: Sessions Field Not Dead
**What goes wrong:** Deleting the `sessions` field from the store breaks QuickStatsWidget, SessionsFilter, Dashboard, and DashboardRedesigned.
**Why it happens:** The requirement lists "sessions field" as dead, but it is actively used by multiple components.
**How to avoid:** Do NOT delete the `sessions` field. See CLEAN-03 detailed findings below.

### Pitfall 4: ContentCalendar Component Is Alive
**What goes wrong:** Deleting ContentCalendar.tsx breaks XPanel.tsx.
**Why it happens:** XPanel.tsx imports ContentCalendar directly (not via ProtectedPanels).
**How to avoid:** Only delete the ProtectedPanels EXPORT line for ContentCalendar, not the component file itself.

## Code Examples

### CLEAN-01: Dead Lib File Verification

All 7 files verified as zero live imports:

| File | Path | Import Check | Status |
|------|------|-------------|--------|
| readState.ts | `src/lib/readState.ts` | No imports from any .ts/.tsx | DEAD |
| queryCache.ts | `src/lib/queryCache.ts` | Only imported by optimizedQueries.ts (also dead) | DEAD |
| optimizedQueries.ts | `src/lib/optimizedQueries.ts` | No imports from any .ts/.tsx | DEAD |
| performanceMonitoring.ts | `src/lib/performanceMonitoring.ts` | No imports from any .ts/.tsx | DEAD |
| smartAccountSelector.ts | `src/lib/smartAccountSelector.ts` | No imports from any .ts/.tsx | DEAD |
| voiceService.ts | `src/lib/voiceService.ts` | Only imported by VoicePanel.tsx.bak (a .bak file) | DEAD |
| api/gateway.ts | `src/api/gateway.ts` | No imports from any .ts/.tsx | DEAD |

**Note:** `performanceMonitor.ts` (no "ing") is ALIVE -- imported by PerformanceProfiler.tsx. Do NOT confuse with `performanceMonitoring.ts`.

### CLEAN-02: Dead ProtectedPanels Exports

5 exports in ProtectedPanels.tsx are not imported by App.tsx or any other consumer:

| Export | Lines in ProtectedPanels.tsx | Component File | File Dead? |
|--------|-----|------|------|
| `ThreePaneInbox` | L21 (lazy import), L45 (export) | `ThreePaneInbox.tsx` | YES - only imported by ProtectedPanels |
| `CommsInbox` | L22 (lazy import), L46 (export) | `CommsInbox.tsx` | YES - only imported by ProtectedPanels + UnifiedCommsInbox (also dead) |
| `UnifiedCommsInbox` | L23 (lazy import), L47 (export) | `UnifiedCommsInbox.tsx` | YES - only imported by ProtectedPanels |
| `CalendarPanel` | L26 (lazy import), L50 (export) | `CalendarPanel.tsx` | YES - only imported by ProtectedPanels |
| `ContentCalendar` | L30 (lazy import), L54 (export) | `ContentCalendar.tsx` | NO - also imported by XPanel.tsx directly |

**Dead dependency chain (also safe to delete):**
- `ThreadedCommsInbox.tsx` -- only imported by `UnifiedCommsInbox.tsx` (dead)

**Summary of component files safe to delete:**
1. `src/components/ThreePaneInbox.tsx`
2. `src/components/CommsInbox.tsx`
3. `src/components/UnifiedCommsInbox.tsx`
4. `src/components/ThreadedCommsInbox.tsx`
5. `src/components/CalendarPanel.tsx`

**NOT safe to delete:** `src/components/ContentCalendar.tsx` (used by XPanel.tsx)

### CLEAN-03: Dead Store Code

| Item | Location | Status | Evidence |
|------|----------|--------|----------|
| `clearCompletedApprovals` | `src/store/store.ts` L218 (interface), L1131 (implementation) | DEAD | grep finds zero callers in any .tsx file |
| `sessions` field | `src/store/store.ts` L172 (field), L341-355 (implementation) | **ALIVE** | Used by QuickStatsWidget.tsx (L6), SessionsFilter.tsx (L59), Dashboard.tsx (L158), DashboardRedesigned.tsx (L35) |
| `getAgentPrompt` | `src/lib/agents.ts` L127-130 (function), L36 (call site) | EFFECTIVELY DEAD | Always returns `''`. Called on L36 but contributes nothing to the prompt string. |

**Recommendation for `sessions`:** Do NOT delete. The requirement appears incorrect. The `sessions` field is actively consumed.

**Recommendation for `getAgentPrompt`:** Remove the function definition (L127-130) and replace the call site on L36. Change L40 from:
```typescript
`${systemPrompt}\n\n## YOUR TASK\n${task}`,
```
to:
```typescript
`## YOUR TASK\n${task}`,
```
And remove the `const systemPrompt = getAgentPrompt(agentId);` line (L36).

### CLEAN-04: Dead Code in Components

#### Underscore-prefixed unused state variables (12 instances):

| File | Line | Variable | Setter Used? |
|------|------|----------|-------------|
| `SettingsPanel.tsx` | 168 | `_notifPrefs` | Yes (`setNotifPrefs` called on L184) but value never read |
| `CodeAgentDashboard.tsx` | 41 | `_totalCost`, `_setTotalCost` | Neither used |
| `DashboardRedesigned.tsx` | 39 | `loadingAction`, `_setLoadingAction` | `loadingAction` would need checking |
| `Dashboard.original.tsx` | 28 | `loadingAction`, `_setLoadingAction` | File is dead (.original) |
| `XAutomationsPanel.tsx` | 78 | `_executions`, `_setExecutions` | Neither used |
| `CalendarPanel.tsx` | 100 | `selectedAccount`, `_setSelectedAccount` | File is dead (CLEAN-02) |
| `AnalyticsDashboard.tsx` | 117 | `dateRange`, `_setDateRange` | `dateRange` may be used -- needs checking |
| `TaskDetailPanel.tsx` | 30 | `_loading`, `_setLoading` | Neither used |
| `TaskDetailPanel.tsx` | 48 | `_showAgentWarning`, `_setShowAgentWarning` | Neither used |
| `TaskDetailPanel.tsx` | 49 | `_activeAgentSession`, `_setActiveAgentSession` | Neither used |
| `SessionsFilter.tsx` | 62 | `_showDropdown`, `_setShowDropdown` | Neither used |
| `VoiceChatPanel.tsx` | 86 | `muted`, `_setMuted` | `muted` may be used -- needs checking |
| `InboxPanel.tsx` | 114 | `_collapsedLanes`, `_setCollapsedLanes` | Neither used |

#### Commented-out functions/variables (verified):

| File | Lines | What |
|------|-------|------|
| `CodeAgentDashboard.tsx` | 141-? | `formatDuration` function (commented out) |
| `ReportsPanel.tsx` | 105 | `__report` assignment (commented out) |
| `QuickStatsWidget.tsx` | 9 | `__activeSessions` filter (commented out) |
| `Kanban.tsx` | 24-27 | `formatRelativeTime` function (commented out) |
| `Kanban.tsx` | 39 | `isDueSoon` check (commented out) |
| `Kanban.tsx` | 260-262 | `assignees` useMemo (commented out) |
| `XAutomationsPanel.tsx` | 68+ | `ACTION_ICONS` object (commented out) |
| `ContextControlBoard.tsx` | 77 | `__escaped` variable (commented out) |
| `EpicCalendar.tsx` | 746 | `__lastDay` variable (commented out) |
| `MarkdownMessage.tsx` | 108 | `parts` array (commented out) |

### CLEAN-05: Backup/Bak Files in src/

**17 files total to delete:**

**.bak files (5):**
1. `src/lib/agentContext.ts.bak`
2. `src/components/EpicCalendar.tsx.bak`
3. `src/components/PerformanceBenchmarks.tsx.bak`
4. `src/components/UsageStatsPanel.tsx.bak`
5. `src/components/VoicePanel.tsx.bak`

**geminiLiveService blobs (3):**
6. `src/lib/geminiLiveService.ts.blob-bak`
7. `src/lib/geminiLiveService.ts.minimal-bak`
8. `src/lib/geminiLiveService.ts.pre-minimal`

**.backup files (6):**
9. `src/components/Dashboard.tsx.backup`
10. `src/components/ContextControlBoard.tsx.backup`
11. `src/components/EnhancedSettingsPanel.tsx.backup`
12. `src/components/Kanban.tsx.backup-before-portal`
13. `src/components/Kanban.tsx.backup-column-controls`
14. `src/components/Sidebar.tsx.backup-20260211`
15. `src/components/TeamVoiceMeeting.tsx.backup-20260211`
16. `src/store/panelConfig.ts.backup-20260211`

**.original files (1):**
17. `src/components/Dashboard.original.tsx`

### CLEAN-06: Non-Standard CSS in QuickStatsWidget

File: `src/components/QuickStatsWidget.tsx`

Non-standard classes used and their Tailwind replacements:

| Line | Current | Replacement |
|------|---------|-------------|
| 96 | `agent-name flex-shrink` | `truncate min-w-0 shrink` |
| 98 | `text-truncate flex-1` | `truncate flex-1` |
| 116 | `no-shrink` | `shrink-0` |
| 117 | `session-name flex-fill` | `truncate min-w-0 flex-1` |
| 165 | `no-shrink` | `shrink-0` |
| 170 | `flex-fill` | `flex-1 min-w-0` |
| 171 | `message-preview` | `line-clamp-2` |
| 172 | `no-wrap` | `whitespace-nowrap` |

**Important:** The custom class definitions in `src/text-utilities.css` (lines 136-205) must NOT be deleted because these classes are still used by:
- `Kanban.tsx` (many instances of `no-shrink`, `no-wrap`)
- `AgentPanel.tsx` (`no-shrink`, `flex-fill`, `session-name`, `agent-name`, `no-wrap`)
- `AgentMetricsCard.tsx` (`no-shrink`, `no-wrap`)
- `Dashboard.tsx` (if it uses them -- check needed)

Only replace within QuickStatsWidget.tsx.

### CLEAN-07: Debug Info in MorningBrief

File: `src/components/MorningBrief.tsx`

**Debug state variable:**
- Line 57: `const [debugInfo, setDebugInfo] = useState<string>('');`

**Debug state writes (remove all):**
- Line 107: `setDebugInfo(\`Attempt ${attempt + 1}: ...\`);`
- Line 115: `setDebugInfo(\`IPC OK: ${pendingApprovals} pending items\`);`
- Line 118: `setDebugInfo(\`IPC returned: ...\`);`
- Line 122: `setDebugInfo(\`Attempt ${attempt + 1}: ...\`);`
- Line 126: `setDebugInfo(\`Error attempt ${attempt + 1}: ...\`);`

**Debug UI render (remove entire block):**
- Lines 683-688: Yellow debug panel shown in "All Clear" section:
```tsx
{debugInfo && (
  <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
    <p className="text-xs text-yellow-400 font-mono">DEBUG: {debugInfo}</p>
    <p className="text-xs text-yellow-400 font-mono mt-1">Pending: {brief.pendingApprovals}</p>
  </div>
)}
```

**Console.log debug statements (remove all 4):**
- Line 106: `console.log('[MorningBrief] Inbox result attempt'...)`
- Line 111: `console.log('[MorningBrief] Inbox returned'...)`
- Line 113: `console.log('[MorningBrief] First item:'...)`
- Line 121: `console.log('[MorningBrief] clawdbot.inbox.list not available...')`

**Keep:** `console.error` calls (lines 125, 139, 159, etc.) -- these are legitimate error reporting.

### CLEAN-08: Keyboard Shortcut Collisions

**The problem has THREE dimensions:**

1. **SettingsPanel.tsx collision:** Lines 65-66 both map to `Cmd+7`:
   ```typescript
   { id: 'twitter', ..., defaultKey: '7', currentKey: '7', modifiers: ['cmd'] },
   { id: 'meetings', ..., defaultKey: '7', currentKey: '7', modifiers: ['cmd'] },
   ```

2. **SettingsPanel defaults don't match App.tsx:** The SettingsPanel `defaultKeyboardShortcuts` array (lines 58-72) has a completely different mapping from the actual App.tsx shortcuts (lines 247-291):

   | Key | App.tsx (actual) | SettingsPanel (displayed) |
   |-----|------------------|--------------------------|
   | Cmd+1 | inbox | Dashboard |
   | Cmd+2 | dashboard | Inbox |
   | Cmd+3 | analytics | Communications |
   | Cmd+4 | kanban | Analytics |
   | Cmd+5 | agents | Tasks |
   | Cmd+6 | twitter | Agents |
   | Cmd+7 | meetings | Twitter AND Meetings |
   | Cmd+8 | voicechat | (not listed) |
   | Cmd+9 | accounts | Chat |
   | Cmd+0 | approvals | (not listed) |

3. **Settings shortcuts aren't wired to App.tsx:** The SettingsPanel saves shortcuts to localStorage but App.tsx never reads them. The shortcut editor is cosmetic-only.

**Fix approach:** Align `defaultKeyboardShortcuts` in SettingsPanel.tsx to match App.tsx actual behavior, and fix the Cmd+7 collision by giving meetings `Cmd+7` and moving twitter elsewhere, or vice versa. The KeyboardShortcuts.tsx help modal (lines 9-21) already has the correct mappings matching App.tsx.

**Recommended new `defaultKeyboardShortcuts` (matching App.tsx):**
```typescript
{ id: 'inbox', name: 'Inbox', defaultKey: '1', currentKey: '1', modifiers: ['cmd'] },
{ id: 'dashboard', name: 'Dashboard', defaultKey: '2', currentKey: '2', modifiers: ['cmd'] },
{ id: 'analytics', name: 'Analytics', defaultKey: '3', currentKey: '3', modifiers: ['cmd'] },
{ id: 'kanban', name: 'Tasks', defaultKey: '4', currentKey: '4', modifiers: ['cmd'] },
{ id: 'agents', name: 'Agents', defaultKey: '5', currentKey: '5', modifiers: ['cmd'] },
{ id: 'twitter', name: 'X / Twitter', defaultKey: '6', currentKey: '6', modifiers: ['cmd'] },
{ id: 'meetings', name: 'Meetings', defaultKey: '7', currentKey: '7', modifiers: ['cmd'] },
{ id: 'voicechat', name: 'Voice Chat', defaultKey: '8', currentKey: '8', modifiers: ['cmd'] },
{ id: 'accounts', name: 'Accounts', defaultKey: '9', currentKey: '9', modifiers: ['cmd'] },
{ id: 'approvals', name: 'Approvals', defaultKey: '0', currentKey: '0', modifiers: ['cmd'] },
{ id: 'settings', name: 'Settings', defaultKey: ',', currentKey: ',', modifiers: ['cmd'] },
{ id: 'commandPalette', name: 'Command Palette', defaultKey: 'k', currentKey: 'k', modifiers: ['cmd'] },
{ id: 'search', name: 'Search', defaultKey: '/', currentKey: '/', modifiers: ['cmd'] },
{ id: 'quickMessage', name: 'Quick Message', defaultKey: 'm', currentKey: 'm', modifiers: ['cmd', 'shift'] },
```

## State of the Art

Not applicable -- this phase uses existing project tooling only.

## Open Questions

1. **`sessions` field in store:** CLEAN-03 lists it as dead, but it's actively used by 4+ components. Is the requirement incorrect, or is there a subtlety I'm missing (e.g., it should be replaced by `gatewaySessions`)? **Recommendation:** Skip deleting `sessions` -- it would break multiple components. Verify with the user if there's a different intent.

2. **Scope of CLEAN-04 (unused imports):** The requirement says "unused imports" but I didn't exhaustively audit every file's imports (that would be hundreds of files). TypeScript compiler warnings or ESLint `no-unused-imports` rule would catch these. **Recommendation:** Run `tsc --noEmit` and check for unused import warnings, or add ESLint rule if not present.

3. **`DashboardRedesigned.tsx` `loadingAction`:** Line 39 has `const [loadingAction, _setLoadingAction] = useState<string | null>(null)` -- the setter is underscored but `loadingAction` might be used in the JSX. Need to verify before removing.

4. **Should dead component files behind dead ProtectedPanels exports also be deleted?** CLEAN-02 says "Delete dead panel exports from ProtectedPanels" but the 5 underlying component files (ThreePaneInbox, CommsInbox, UnifiedCommsInbox, ThreadedCommsInbox, CalendarPanel) are also dead. **Recommendation:** Delete both the exports AND the dead component files -- they contribute to bundle size and maintenance burden.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all files referenced in requirements
- `grep -r` import chain verification for every file listed as dead
- Line-by-line reading of QuickStatsWidget.tsx, MorningBrief.tsx, SettingsPanel.tsx, KeyboardShortcuts.tsx, App.tsx, store.ts, ProtectedPanels.tsx, agents.ts
- `text-utilities.css` CSS class definitions verified

### Secondary (MEDIUM confidence)
- Tailwind 3.4 `line-clamp-*` native support (based on package.json version `^3.4.0`)

## Metadata

**Confidence breakdown:**
- Dead file identification: HIGH - every file verified with grep across entire src/
- CSS replacements: HIGH - Tailwind equivalents verified against class definitions
- Debug removal: HIGH - exact lines identified in MorningBrief.tsx
- Shortcut collision: HIGH - all three sources (App.tsx, SettingsPanel.tsx, KeyboardShortcuts.tsx) compared line by line
- Store dead code: HIGH for clearCompletedApprovals and getAgentPrompt; CONTESTED for sessions field

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (stable codebase, no external dependency concerns)
