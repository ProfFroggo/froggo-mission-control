# Phase 8: Research Library - Research

**Researched:** 2026-02-13
**Domain:** Per-project SQLite research library with fact-source linking and agent-powered fact-checking
**Confidence:** HIGH

## Summary

Phase 8 adds a research library to the writing workspace. Users can collect research sources (books, articles, interviews, URLs), link them to facts in the existing memory store, and ask the Researcher agent to fact-check highlighted claims in the editor.

The standard approach uses **better-sqlite3** (already installed, v12.6.2) for a per-project SQLite database, a new electron service file (`writing-research-service.ts`) following the established `registerXxxHandlers()` pattern, a new Zustand store (`researchStore.ts`), and a new "Sources" tab in the existing ContextPanel. The fact-check flow reuses the existing `gateway.sendChatWithCallbacks()` + BubbleMenu architecture from Phase 6, with a dedicated prompt template for the researcher agent.

**Primary recommendation:** Create one `research.db` SQLite file per project (at `~/froggo/writing-projects/{projectId}/research.db`) with two tables: `sources` and `fact_sources` (junction table linking sources to existing facts). Extend the existing `VerifiedFact` status enum to include `'needs-source'`. The fact-check feature reuses the existing BubbleMenu/FeedbackPopover flow but with a specialized "Fact Check" action that routes directly to the researcher agent.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 12.6.2 | Per-project SQLite database for research sources | Already installed, used by database.ts for froggo.db, schedule.db, security.db. Synchronous API eliminates callback complexity. |
| zustand | 4.4.7 | Frontend state management for research store | Already used for writingStore, memoryStore, feedbackStore. Consistent pattern. |
| @tiptap/react | 3.19.0 | Editor with BubbleMenu for fact-check trigger | Already installed, BubbleMenu pattern established in Phase 6. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.303.0 | Icons for Sources tab, source type indicators | Already installed, used throughout the writing components. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-project SQLite | JSON files (like memory store) | SQLite required by RES-04. Also better for relational data (fact-source links). JSON would need manual join logic. |
| Per-project DB | Single shared research.db | Per-project keeps data isolated and portable. A shared DB requires project_id foreign keys on every table. Per-project aligns with existing file layout. |
| New BubbleMenu action | Separate UI panel | Reusing BubbleMenu keeps the UX consistent with Phase 6 inline feedback. User expects highlight-then-act. |

**Installation:**
```bash
# No new packages needed - all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure

```
electron/
  writing-research-service.ts    # NEW — SQLite CRUD for sources, fact-source links

src/
  store/
    researchStore.ts             # NEW — Zustand store for research sources
  components/writing/
    SourceList.tsx               # NEW — source list (like FactList.tsx)
    SourceForm.tsx               # NEW — add/edit source form (like FactForm.tsx)
    FactCheckResult.tsx          # NEW — display fact-check result from researcher
    ContextPanel.tsx             # MODIFIED — add 4th "Sources" tab
    FactList.tsx                 # MODIFIED — show linked sources, add "needs-source" status
    FeedbackPopover.tsx          # MODIFIED — add "Fact Check" action (or new component)

electron/
  preload.ts                    # MODIFIED — add writing.research.* bridge methods
  main.ts                       # MODIFIED — import + call registerWritingResearchHandlers()
  paths.ts                      # MODIFIED — add writingResearchDbPath(projectId)
```

### Pattern 1: Per-Project SQLite Database

**What:** Each writing project gets its own `research.db` file at `~/froggo/writing-projects/{projectId}/research.db`
**When to use:** For all research source storage and fact-source link data
**Example:**
```typescript
// electron/writing-research-service.ts
import Database from 'better-sqlite3';
import { writingResearchDbPath } from './paths';

// Lazy-init per-project DB with connection cache
const dbCache = new Map<string, Database.Database>();

function getResearchDb(projectId: string): Database.Database {
  if (dbCache.has(projectId)) return dbCache.get(projectId)!;

  const dbPath = writingResearchDbPath(projectId);
  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables if not exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT DEFAULT '',
      type TEXT NOT NULL DEFAULT 'other',
      url TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fact_sources (
      fact_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      PRIMARY KEY (fact_id, source_id),
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
    );
  `);

  dbCache.set(projectId, db);
  return db;
}
```

### Pattern 2: Extending ContextPanel with 4th Tab

**What:** Add a "Sources" tab alongside Characters/Timeline/Facts
**When to use:** Phase 8 UI integration
**Example:**
```typescript
// ContextPanel.tsx — add BookMarked icon from lucide-react
const tabs = [
  { key: 'characters' as const, label: 'Characters', icon: Users },
  { key: 'timeline' as const, label: 'Timeline', icon: Clock },
  { key: 'facts' as const, label: 'Facts', icon: CheckCircle },
  { key: 'sources' as const, label: 'Sources', icon: BookMarked },
];
```

### Pattern 3: Fact-Source Linking via Junction Table

**What:** Many-to-many relationship between facts (JSON store) and sources (SQLite)
**When to use:** When user links a source to a fact
**Example:**
```typescript
// Link a source to a fact
function linkSourceToFact(projectId: string, factId: string, sourceId: string, notes?: string) {
  const db = getResearchDb(projectId);
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO fact_sources (fact_id, source_id, notes, created_at)
    VALUES (?, ?, ?, ?)
  `).run(factId, sourceId, notes || '', now);
}

// Get sources for a fact
function getSourcesForFact(projectId: string, factId: string) {
  const db = getResearchDb(projectId);
  return db.prepare(`
    SELECT s.*, fs.notes as link_notes
    FROM sources s
    JOIN fact_sources fs ON fs.source_id = s.id
    WHERE fs.fact_id = ?
    ORDER BY s.title
  `).all(factId);
}
```

### Pattern 4: Fact-Check via Researcher Agent

**What:** User highlights text in editor, triggers fact-check, researcher agent returns verdict with source references
**When to use:** RES-05 / AGENT-02 — the core fact-checking flow
**Example:**
```typescript
// Build a fact-check prompt (different from rewrite prompt in FeedbackPopover)
function buildFactCheckPrompt(
  claim: string,
  chapterContext: string,
  existingSources: Source[],
  existingFacts: VerifiedFact[],
): string {
  const sourcesList = existingSources.length > 0
    ? existingSources.map(s => `- "${s.title}" by ${s.author} (${s.type})`).join('\n')
    : '(no sources in library yet)';

  return [
    'You are a meticulous research editor focused on accuracy and fact-checking.',
    '',
    '## Task',
    'The user has highlighted a claim and wants you to fact-check it.',
    '',
    '### Claim to Verify',
    `"${claim}"`,
    '',
    '### Chapter Context',
    chapterContext,
    '',
    '### Research Library (existing sources)',
    sourcesList,
    '',
    '## Response Format',
    'Respond with:',
    '1. **Verdict:** VERIFIED | DISPUTED | NEEDS MORE RESEARCH',
    '2. **Confidence:** HIGH | MEDIUM | LOW',
    '3. **Explanation:** Brief explanation of your finding',
    '4. **Suggested Sources:** If you can identify specific sources that would help verify this claim',
    '5. **Suggested Status:** What status this fact should have (verified/disputed/needs-source)',
  ].join('\n');
}
```

### Anti-Patterns to Avoid

- **Storing sources in JSON alongside facts:** The requirement explicitly calls for SQLite (RES-04). JSON has no relational integrity for the many-to-many links.
- **Creating a single monolithic research.db for all projects:** Per-project DBs match the existing storage layout and make projects portable.
- **Building a new chat UI for fact-checking:** Reuse the existing gateway.sendChatWithCallbacks() and BubbleMenu flow. Don't create a separate chat interface.
- **Putting source data in the main froggo.db:** Research sources are per-writing-project, not per-task. They belong in the writing project directory.
- **Auto-opening DB connections for all projects on startup:** Use lazy init (open DB only when project is opened). Cache connections but close on project close.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite connection management | Custom connection pooling | better-sqlite3 with simple Map cache | better-sqlite3 is synchronous, doesn't need pooling. One connection per project is sufficient. |
| Source type validation | Custom validator | TypeScript union type + select dropdown | Source types are a fixed set (book, article, interview, website, document, other). No need for dynamic validation. |
| Fact-source relationship | Custom JSON cross-referencing | SQLite foreign keys + junction table | SQL handles relational integrity natively. JSON cross-refs require manual consistency checks. |
| Agent communication for fact-check | Custom WebSocket handler | gateway.sendChatWithCallbacks() | Already proven in Phase 6 for inline feedback. Same pattern, different prompt. |
| Inline fact-check UI trigger | New floating panel | BubbleMenu with additional action | BubbleMenu already appears on text selection. Adding a fact-check button is natural. |

**Key insight:** The entire agent communication pipeline (BubbleMenu trigger -> gateway WebSocket -> agent session -> streaming response) already exists from Phase 6. Phase 8's fact-check feature is a specialized application of this pattern, not a new system.

## Common Pitfalls

### Pitfall 1: Cross-Storage Consistency (JSON Facts + SQLite Sources)

**What goes wrong:** Facts are stored in JSON files (Phase 7) but sources are in SQLite (Phase 8). A deleted fact leaves orphaned entries in `fact_sources`. A deleted source has stale references.
**Why it happens:** Two storage systems with no shared transaction boundary.
**How to avoid:**
- When deleting a fact via memoryStore, also call researchStore to clean up `fact_sources` entries for that `fact_id`.
- SQLite foreign keys with `ON DELETE CASCADE` handle source deletion automatically (linked `fact_sources` rows deleted).
- Add a cleanup sweep in `loadMemory()` that removes `fact_sources` entries for facts that no longer exist in JSON.
**Warning signs:** "Ghost" links showing sources for facts that no longer exist, or fact count mismatches.

### Pitfall 2: DB Connection Leaks on Project Switch

**What goes wrong:** User opens Project A (DB opened), switches to Project B (new DB opened), Project A's DB stays open forever.
**Why it happens:** Lazy-init cache without cleanup.
**How to avoid:** Close and remove from cache when project is closed. Add cleanup in `closeProject()` flow. Also close all DBs in the `closeDb()` function called on app shutdown.
**Warning signs:** File handles accumulating, "database is locked" errors if same project reopened.

### Pitfall 3: Status Enum Mismatch After Adding 'needs-source'

**What goes wrong:** Existing facts have status values `'unverified' | 'verified' | 'disputed'`. Adding `'needs-source'` requires updating the TypeScript interfaces in both electron service AND frontend store, plus the FactForm select dropdown and FactList status badges.
**Why it happens:** Type defined in 3+ places (writing-memory-service.ts, memoryStore.ts, FactForm.tsx, FactList.tsx).
**How to avoid:** Update all 4 locations in one task. Add a shared type definition if practical.
**Warning signs:** TypeScript errors on `'needs-source'` assignment, missing badge styling for new status.

### Pitfall 4: BubbleMenu Overcrowding

**What goes wrong:** Adding a "Fact Check" button/action to the existing BubbleMenu FeedbackPopover makes it too busy. The popover already has agent picker, instructions input, and alternatives display.
**Why it happens:** Trying to overload a single UI component.
**How to avoid:** Two approaches (recommend option A):
  - **(A)** Add a small "Fact Check" quick-action button next to the agent picker that sends a pre-built fact-check prompt to the researcher (no custom instructions needed).
  - **(B)** Add a separate BubbleMenu element that appears only for fact-checking, toggled by a button.
**Warning signs:** Users finding the BubbleMenu confusing or hard to use.

### Pitfall 5: Large Research Libraries Slowing Down UI

**What goes wrong:** A project with 100+ sources loads slowly because all sources are fetched on project open.
**Why it happens:** No pagination or lazy loading.
**How to avoid:** For V1, fetch all sources on tab activation (not project open). If needed later, add pagination. SQLite is fast for hundreds of rows.
**Warning signs:** Visible delay when switching to Sources tab.

## Code Examples

### Research DB Path Helper (paths.ts)

```typescript
// Add to electron/paths.ts
export const writingResearchDbPath = (projectId: string) =>
  path.join(WRITING_PROJECTS_DIR, projectId, 'research.db');
```

### Source CRUD Service Pattern (writing-research-service.ts)

```typescript
// Follows same pattern as writing-memory-service.ts
import { ipcMain } from 'electron';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { writingResearchDbPath } from './paths';

interface ResearchSource {
  id: string;
  title: string;
  author: string;
  type: 'book' | 'article' | 'interview' | 'website' | 'document' | 'other';
  url: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

// DB cache — one connection per project
const dbCache = new Map<string, Database.Database>();

function getDb(projectId: string): Database.Database {
  if (dbCache.has(projectId)) return dbCache.get(projectId)!;
  const dbPath = writingResearchDbPath(projectId);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  dbCache.set(projectId, db);
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT DEFAULT '',
      type TEXT NOT NULL DEFAULT 'other',
      url TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS fact_sources (
      fact_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      PRIMARY KEY (fact_id, source_id),
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
    );
  `);
}

export function closeResearchDb(projectId: string) {
  const db = dbCache.get(projectId);
  if (db) {
    db.close();
    dbCache.delete(projectId);
  }
}

export function closeAllResearchDbs() {
  for (const [id, db] of dbCache) {
    db.close();
  }
  dbCache.clear();
}
```

### Preload Bridge Methods

```typescript
// Add to writing.research in preload.ts
research: {
  sources: {
    list: (projectId: string) => ipcRenderer.invoke('writing:research:sources:list', projectId),
    create: (projectId: string, data: any) => ipcRenderer.invoke('writing:research:sources:create', projectId, data),
    update: (projectId: string, id: string, data: any) => ipcRenderer.invoke('writing:research:sources:update', projectId, id, data),
    delete: (projectId: string, id: string) => ipcRenderer.invoke('writing:research:sources:delete', projectId, id),
  },
  links: {
    forFact: (projectId: string, factId: string) => ipcRenderer.invoke('writing:research:links:forFact', projectId, factId),
    forSource: (projectId: string, sourceId: string) => ipcRenderer.invoke('writing:research:links:forSource', projectId, sourceId),
    link: (projectId: string, factId: string, sourceId: string) => ipcRenderer.invoke('writing:research:links:link', projectId, factId, sourceId),
    unlink: (projectId: string, factId: string, sourceId: string) => ipcRenderer.invoke('writing:research:links:unlink', projectId, factId, sourceId),
  },
  factCheck: (projectId: string, claim: string, context: string) =>
    // Note: fact-check uses gateway.sendChatWithCallbacks() in renderer, not IPC
    // This IPC is optional — for getting sources to include in prompt
    ipcRenderer.invoke('writing:research:sources:list', projectId),
},
```

### VerifiedFact Status Extension

```typescript
// Updated type (in both memoryStore.ts AND writing-memory-service.ts)
type FactStatus = 'unverified' | 'verified' | 'disputed' | 'needs-source';

interface VerifiedFact {
  id: string;
  claim: string;
  source: string;    // legacy free-text source field (kept for backward compat)
  status: FactStatus;
}

// FactList.tsx — add badge for needs-source
const statusBadge: Record<string, string> = {
  verified: 'bg-green-500/20 text-green-400',
  unverified: 'bg-yellow-500/20 text-yellow-400',
  disputed: 'bg-red-500/20 text-red-400',
  'needs-source': 'bg-blue-500/20 text-blue-400',
};

const statusLabel: Record<string, string> = {
  verified: 'V',
  unverified: '?',
  disputed: 'D',
  'needs-source': 'S',
};
```

### Fact-Check Action in BubbleMenu

```typescript
// Option A: Quick fact-check button in FeedbackPopover
// Add alongside AgentPicker row
<button
  onClick={handleFactCheck}
  disabled={streaming}
  className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-clawd-text-dim hover:text-clawd-accent hover:bg-clawd-accent/10 transition-colors"
  title="Fact-check this claim"
>
  <ShieldCheck className="w-3 h-3" />
  Fact Check
</button>

// handleFactCheck sends to researcher with fact-check-specific prompt
const handleFactCheck = async () => {
  const claim = getSelectedText(editor);
  if (!claim) return;

  // Force researcher agent, use fact-check prompt template
  setSelectedAgent('researcher');
  setStreaming(true);
  // ... uses same gateway.sendChatWithCallbacks() pattern
  // but with buildFactCheckPrompt() instead of buildPrompt()
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Store research data in JSON files | SQLite for relational research data | Phase 8 requirement (RES-04) | Better relational integrity for source-fact links |
| Single source field on facts | Many-to-many fact-source linking | Phase 8 requirement (RES-02) | Facts can reference multiple sources |
| Manual fact verification | Agent-powered fact-checking | Phase 8 requirement (RES-05, AGENT-02) | Researcher agent assists with verification |
| 3 status values on facts | 4 status values (adds needs-source) | Phase 8 requirement (RES-03) | Users can flag facts needing sourcing |

**Deprecated/outdated:**
- The single `source: string` field on `VerifiedFact` becomes a legacy free-text field. Structured source references will be in the `fact_sources` junction table. Keep the old field for backward compatibility.

## Open Questions

1. **Fact-check result persistence:**
   - What we know: The researcher agent returns a verdict (VERIFIED/DISPUTED/NEEDS MORE RESEARCH). The feedback log (JSONL) already captures agent interactions.
   - What's unclear: Should fact-check results be stored separately from feedback logs? Should the verdict auto-update the fact's status?
   - Recommendation: Log fact-check results in the existing feedback JSONL (add `type: 'fact-check'` field). Show a UI prompt asking user to confirm before auto-updating fact status. Keep user in control.

2. **Source deduplication:**
   - What we know: Users might add the same source twice (same URL or title).
   - What's unclear: Should we enforce uniqueness? On which fields?
   - Recommendation: Don't enforce uniqueness at DB level. Show a soft warning if title+author match an existing source. Users may have legitimate reasons for similar entries.

3. **ContextPanel tab overflow:**
   - What we know: Currently 3 tabs fit comfortably in the 288px-wide panel (w-72). Adding a 4th tab with icons may get tight.
   - What's unclear: Will the layout break or just look cramped?
   - Recommendation: Use icon-only tabs or abbreviated labels when 4th tab is added. Test with actual rendering. The existing tabs use `text-[10px]` font which helps.

4. **Source import from clipboard/URL:**
   - What we know: RES-01 says "add research sources (title, author, type, URL, notes)".
   - What's unclear: Is manual form entry sufficient, or should we auto-populate fields from a pasted URL?
   - Recommendation: V1 uses manual form entry only. URL auto-population (fetch page title, author from meta tags) is a nice-to-have for future.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** — direct reading of all relevant files:
  - `electron/database.ts` — existing better-sqlite3 usage patterns (WAL mode, lazy init, connection management)
  - `electron/writing-memory-service.ts` — existing JSON-based memory CRUD (the pattern to extend)
  - `electron/writing-feedback-service.ts` — existing JSONL feedback logging
  - `electron/writing-project-service.ts` — existing project file layout
  - `electron/paths.ts` — centralized path resolver
  - `electron/preload.ts` — bridge method patterns (line 613-656 for writing.memory.*)
  - `electron/main.ts` — handler registration pattern (lines 376-384)
  - `src/store/memoryStore.ts` — Zustand store pattern with bridge() accessor
  - `src/store/feedbackStore.ts` — feedback state management
  - `src/store/writingStore.ts` — project/chapter state, loadMemory() integration
  - `src/components/writing/ContextPanel.tsx` — 3-tab layout to extend
  - `src/components/writing/FactList.tsx` — fact display with status badges
  - `src/components/writing/FactForm.tsx` — inline form editing pattern
  - `src/components/writing/FeedbackPopover.tsx` — agent feedback flow, buildMemoryContext(), BubbleMenu integration
  - `src/components/writing/ChapterEditor.tsx` — BubbleMenu configuration (updateDelay=0, placement, shouldShow)
  - `src/components/writing/AgentPicker.tsx` — agent selection UI
  - `src/lib/gateway.ts` — sendChatWithCallbacks() for agent communication
  - `package.json` — confirms better-sqlite3 v12.6.2, @tiptap/react v3.19.0

### Secondary (MEDIUM confidence)
- better-sqlite3 documentation — synchronous API, WAL mode, foreign keys pragma, transaction() method

### Tertiary (LOW confidence)
- None required — all findings verified from codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and used in the codebase
- Architecture: HIGH — follows established patterns from Phases 5-7 exactly
- Pitfalls: HIGH — identified from direct analysis of existing code (JSON+SQLite split is the main risk)

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (stable — all dependencies locked, patterns well-established)
