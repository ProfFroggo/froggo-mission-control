# Architecture Research: Writing System Integration

**Domain:** AI-collaborative long-form writing system inside existing Electron + React dashboard
**Researched:** 2026-02-12
**Confidence:** HIGH (based on direct source code analysis of existing codebase)

---

## 1. New Electron Services

The existing codebase follows a clear pattern: domain-specific services in `electron/*.ts` files, imported by `main.ts`, with IPC handlers registered via `ipcMain.handle()`. The writing system needs three new service files.

### 1.1 writing-project-service.ts

**Responsibility:** Project CRUD, chapter file management, versioning.

**New file:** `electron/writing-project-service.ts`

**Pattern to follow:** `export-backup-service.ts` — exports functions, imported and registered by `main.ts`. NOT a class (consistent with most existing services). Uses `prepare()` from `./database` for any DB queries, and paths from `./paths`.

**IPC channels (register in main.ts):**

```typescript
// Project CRUD
'writing:project:list'          // → { success, projects: WritingProject[] }
'writing:project:create'        // (name, type) → { success, project }
'writing:project:get'           // (projectId) → { success, project }
'writing:project:update'        // (projectId, updates) → { success }
'writing:project:delete'        // (projectId) → { success }

// Chapter management
'writing:chapter:list'          // (projectId) → { success, chapters: Chapter[] }
'writing:chapter:create'        // (projectId, title, position) → { success, chapter }
'writing:chapter:read'          // (projectId, chapterId) → { success, content: string }
'writing:chapter:save'          // (projectId, chapterId, content) → { success }
'writing:chapter:rename'        // (projectId, chapterId, newTitle) → { success }
'writing:chapter:reorder'       // (projectId, chapterIds[]) → { success }
'writing:chapter:delete'        // (projectId, chapterId) → { success }

// Versioning
'writing:version:list'          // (projectId, chapterId) → { success, versions[] }
'writing:version:save'          // (projectId, chapterId, label?) → { success, versionId }
'writing:version:restore'       // (projectId, chapterId, versionId) → { success }
'writing:version:diff'          // (projectId, chapterId, v1, v2) → { success, diff }

// Outline
'writing:outline:get'           // (projectId) → { success, outline: string }
'writing:outline:save'          // (projectId, content) → { success }
```

**Implementation details:**
- File I/O via `fs.readFileSync`/`fs.writeFileSync` (consistent with existing service patterns -- synchronous is fine for single-user local files)
- Chapter files are markdown: `{projectDir}/chapters/{nn}-{slug}.md`
- Versions are timestamped copies: `{projectDir}/versions/{chapterId}/v{timestamp}.md`
- Project metadata in `project.json` at project root
- All filesystem paths validated via `validateFsPath()` from `./fs-validation` -- **IMPORTANT**: `fs-validation.ts` allowed roots currently only include `~/clawd`, `~/.openclaw`, `~/Froggo`. Must add writing projects path (see Section 3.2)

### 1.2 writing-memory-service.ts

**Responsibility:** Character profiles, timeline events, verified facts.

**New file:** `electron/writing-memory-service.ts`

**IPC channels:**

```typescript
// Characters
'writing:memory:characters:list'    // (projectId) → { success, characters[] }
'writing:memory:characters:get'     // (projectId, characterId) → { success, character }
'writing:memory:characters:save'    // (projectId, character) → { success }
'writing:memory:characters:delete'  // (projectId, characterId) → { success }

// Timeline
'writing:memory:timeline:list'      // (projectId) → { success, events[] }
'writing:memory:timeline:save'      // (projectId, event) → { success }
'writing:memory:timeline:delete'    // (projectId, eventId) → { success }
'writing:memory:timeline:reorder'   // (projectId, eventIds[]) → { success }

// Facts
'writing:memory:facts:list'         // (projectId, filters?) → { success, facts[] }
'writing:memory:facts:save'         // (projectId, fact) → { success }
'writing:memory:facts:delete'       // (projectId, factId) → { success }
'writing:memory:facts:verify'       // (projectId, factId, status, sourceId?) → { success }
```

**Implementation details:**
- Characters stored in `{projectDir}/memory/characters.json` -- JSON array, loaded fully into memory on project open
- Timeline in `{projectDir}/memory/timeline.json` -- JSON array, sorted chronologically
- Facts initially in `{projectDir}/memory/facts.json` -- JSON array. Later in Phase 2, migrate to SQLite in `{projectDir}/research/sources.db` for relational queries (fact -> source linkage)
- All memory files small enough for full read/write (no streaming needed -- 100 characters * 1KB each = 100KB)

### 1.3 writing-feedback-service.ts

**Responsibility:** Feedback storage, agent communication bridge.

**New file:** `electron/writing-feedback-service.ts`

**IPC channels:**

```typescript
// Feedback CRUD
'writing:feedback:list'         // (projectId, chapterId) → { success, interactions[] }
'writing:feedback:save'         // (projectId, chapterId, interaction) → { success }
'writing:feedback:delete'       // (projectId, chapterId, interactionId) → { success }

// Agent context building (main process assembles context for agent calls)
'writing:context:build'         // (projectId, chapterId, tier) → { success, context: string }

// Sources (Phase 2 -- SQLite-backed)
'writing:sources:list'          // (projectId, filters?) → { success, sources[] }
'writing:sources:add'           // (projectId, source) → { success, sourceId }
'writing:sources:update'        // (projectId, sourceId, updates) → { success }
'writing:sources:delete'        // (projectId, sourceId) → { success }
'writing:sources:link'          // (projectId, sourceId, factId) → { success }
```

**Implementation details:**
- Feedback stored as JSONL (append-only): `{projectDir}/feedback/{chapterId}.jsonl`
- JSONL format means each interaction is one JSON line -- append with `fs.appendFileSync`, read with line-by-line parse
- Context building reads multiple files and assembles the multi-tier context payload that gets sent to agents
- Sources go into `{projectDir}/research/sources.db` (project-local SQLite, separate from `froggo.db`)

### 1.4 Registration Pattern in main.ts

Following the existing pattern (see lines 8-27 of main.ts), add imports and register handlers. The minimal touch to main.ts:

```typescript
// At top of main.ts, alongside existing imports:
import { registerWritingProjectHandlers } from './writing-project-service';
import { registerWritingMemoryHandlers } from './writing-memory-service';
import { registerWritingFeedbackHandlers } from './writing-feedback-service';

// Near the end, alongside existing handler registration:
registerWritingProjectHandlers();
registerWritingMemoryHandlers();
registerWritingFeedbackHandlers();
```

Each service exports a `registerXxxHandlers()` function that calls `ipcMain.handle()` internally. This follows the pattern of `registerXAutomationsHandlers` in `x-automations-service.ts` and keeps main.ts changes minimal.

**Total new IPC channels: ~30** (added to existing ~135, bringing total to ~165)

---

## 2. Database Strategy

### 2.1 Recommendation: Per-Project SQLite + JSON Files (NOT froggo.db)

**Decision: Separate storage per project. Do NOT put writing data in froggo.db.**

**Rationale:**
- `froggo.db` is the task/agent/governance database (795 tasks, 173 tables, 26MB). It has a clear domain: operational orchestration. Writing data is a completely different domain.
- Writing projects are self-contained units. A user might want to archive, share, or back up a single project -- impossible if data is scattered across a global DB.
- The Chief's design doc correctly prescribes project-level isolation: each project = a clean folder.
- JSON files for small, frequently-loaded data (characters, timeline, facts) -- no need for SQL query overhead when the entire dataset fits in memory.
- SQLite for relational data (sources, facts-source linkage) -- but project-local, not global.
- This matches the existing codebase pattern: `froggo.db` (tasks), `schedule.db` (schedules), `security.db` (security) are separate databases for separate domains.

### 2.2 Storage Layout

```
{projectDir}/
  project.json                    # Project metadata (JSON)
  outline.md                      # High-level outline (Markdown)
  chapters/
    01-childhood.md               # Chapter content (Markdown)
    02-first-job.md
  memory/
    characters.json               # Character profiles (JSON array)
    timeline.json                 # Timeline events (JSON array)
    facts.json                    # Verified facts (JSON array)
  research/
    sources.db                    # Per-project SQLite (Phase 2)
    notes/
      topic-1.md                  # Research notes (Markdown)
  feedback/
    01-childhood.jsonl            # Feedback log per chapter (JSONL)
  versions/
    01-childhood/
      v1707000000.md              # Timestamped version snapshots
```

### 2.3 Schema: project.json

```json
{
  "id": "memoir-2026",
  "title": "Kevin's Memoir",
  "type": "memoir",
  "createdAt": 1707000000,
  "updatedAt": 1707100000,
  "settings": {
    "defaultAgent": "writer",
    "assignedAgents": ["writer", "researcher", "jess"],
    "styleGuide": null
  },
  "stats": {
    "wordCount": 0,
    "chapterCount": 0,
    "lastEditedChapter": null
  }
}
```

### 2.4 Schema: sources.db (Phase 2, per-project)

```sql
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'book', 'article', 'website', 'interview', 'personal'
  author TEXT,
  url TEXT,
  publication_date TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE facts (
  id TEXT PRIMARY KEY,
  claim TEXT NOT NULL,           -- The factual claim
  chapter_id TEXT,               -- Which chapter references this
  status TEXT NOT NULL DEFAULT 'unverified',  -- 'verified', 'unverified', 'disputed'
  verified_by TEXT,              -- Agent ID that verified
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE fact_sources (
  fact_id TEXT NOT NULL REFERENCES facts(id),
  source_id TEXT NOT NULL REFERENCES sources(id),
  page_ref TEXT,                 -- Page number or section reference
  quote TEXT,                    -- Direct quote from source
  PRIMARY KEY (fact_id, source_id)
);

CREATE TABLE chapter_sources (
  chapter_id TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources(id),
  context TEXT,                  -- How source is used in chapter
  PRIMARY KEY (chapter_id, source_id)
);
```

### 2.5 Schema: Feedback Interaction (JSONL line)

```json
{
  "id": "fb-1707000001-abc",
  "chapterId": "01-childhood",
  "textRange": { "from": 1420, "to": 1580 },
  "originalText": "Sarah walked into the room...",
  "userPrompt": "Make this more emotional",
  "agentId": "writer",
  "alternatives": [
    { "id": "alt-1", "text": "Sarah's hand trembled on the doorknob...", "reasoning": "Added physical sensation to convey emotion" },
    { "id": "alt-2", "text": "The room smelled like his cologne...", "reasoning": "Used sensory detail to ground the emotional moment" }
  ],
  "selectedAlternative": "alt-1",
  "timestamp": 1707000001
}
```

### 2.6 Migration Strategy

No migration of existing data needed -- this is a brand-new feature. The "migration" is:
1. Create the `writing-projects/` directory on first project creation (lazy)
2. Create project directories via the service when user creates a project
3. Create `sources.db` on first research operation per project (lazy initialization)
4. If schema changes later, include a `schema_version` in `project.json` and run migrations on project open

### 2.7 Database Connection Management

For `sources.db`, follow the existing `database.ts` pattern:
- Lazy initialization (create connection on first access per project)
- WAL mode for read performance
- Close on project switch or app shutdown
- **Important:** Only one project's `sources.db` open at a time (single user, no need for connection pooling)

Add to `database.ts`:

```typescript
let writingDb: Database.Database | null = null;
let writingDbPath: string | null = null;

export function getWritingDb(projectPath: string): Database.Database {
  const dbPath = path.join(projectPath, 'research', 'sources.db');
  if (writingDb && writingDbPath === dbPath) return writingDb;
  if (writingDb) { writingDb.close(); writingDb = null; }
  writingDb = new Database(dbPath);
  writingDb.pragma('journal_mode = WAL');
  writingDbPath = dbPath;
  return writingDb;
}
```

---

## 3. File Structure

### 3.1 Writing Projects Root

**Recommendation:** `~/froggo/writing-projects/`

**Rationale:**
- Inside `PROJECT_ROOT` (`~/froggo/`), keeping it under the Froggo umbrella
- Parallels `~/froggo/data/`, `~/froggo/scripts/`, `~/froggo/library/`
- Backed up naturally when `~/froggo/` is backed up
- Accessible to agents (Writer, Researcher, Jess have access to `~/froggo/`)

**Alternative considered:** `~/Documents/writing-projects/` -- rejected because it's outside the Froggo ecosystem path structure and would need separate backup handling.

### 3.2 paths.ts Additions

Add to `electron/paths.ts`:

```typescript
// ── Writing projects ──
export const WRITING_PROJECTS_DIR = path.join(PROJECT_ROOT, 'writing-projects');

// Helper for project-specific paths
export const writingProjectPath = (projectId: string) =>
  path.join(WRITING_PROJECTS_DIR, projectId);

export const writingChapterPath = (projectId: string, chapterId: string) =>
  path.join(WRITING_PROJECTS_DIR, projectId, 'chapters', `${chapterId}.md`);

export const writingMemoryPath = (projectId: string, filename: string) =>
  path.join(WRITING_PROJECTS_DIR, projectId, 'memory', filename);
```

### 3.3 fs-validation.ts Update Required

**Critical:** The existing `ALLOWED_ROOTS` in `fs-validation.ts` restricts filesystem access to:
```typescript
const ALLOWED_ROOTS = [
  path.join(os.homedir(), 'clawd'),     // ~/clawd (legacy symlink)
  path.join(os.homedir(), '.openclaw'),  // ~/.openclaw
  path.join(os.homedir(), 'Froggo'),     // ~/Froggo (old path)
];
```

**Problem:** Missing `~/froggo` entirely. The writing projects at `~/froggo/writing-projects/` would be blocked.

**Fix needed:** Add `~/froggo` to `ALLOWED_ROOTS`:
```typescript
const ALLOWED_ROOTS = [
  path.join(os.homedir(), 'froggo'),     // ~/froggo (current canonical)
  path.join(os.homedir(), 'clawd'),      // ~/clawd (legacy symlink)
  path.join(os.homedir(), '.openclaw'),
  path.join(os.homedir(), 'Froggo'),     // ~/Froggo (old path)
];
```

This is an existing bug (fs-validation wasn't updated during the 2026-02-12 rename) that should be fixed in Phase 1 regardless of the writing system.

### 3.4 Chapter File Naming Convention

Format: `{nn}-{slug}.md` where:
- `{nn}` is zero-padded chapter number (01, 02, ... 99)
- `{slug}` is kebab-case title derived from chapter title
- Example: `01-childhood.md`, `15-the-turning-point.md`

**Why this format:**
- Natural sort order in file explorers and `fs.readdirSync()`
- Human-readable without needing a manifest
- Git-friendly (meaningful filenames)
- Slug generated from title, but stored position tracked in `project.json` for reordering

### 3.5 Full Path Example

```
~/froggo/writing-projects/
  memoir-2026/
    project.json
    outline.md
    chapters/
      01-childhood.md
      02-first-job.md
      03-meeting-sarah.md
    memory/
      characters.json
      timeline.json
      facts.json
    research/
      sources.db
      notes/
        family-history.md
    feedback/
      01-childhood.jsonl
      03-meeting-sarah.jsonl
    versions/
      01-childhood/
        v1707000000.md
        v1707100000.md
```

---

## 4. Agent Integration

### 4.1 Gateway Communication Pattern

The writing system communicates with agents via the OpenClaw Gateway WebSocket, using the existing `gateway.ts` client. Two patterns are already established in the codebase:

**Pattern A: `gateway.sendChat(message)` -- Promise-based, waits for full response.**
Used by `AIAssistancePanel.tsx` for generating suggestions/sentiment. Suitable for feedback requests that need the complete response before displaying alternatives.

**Pattern B: `gateway.sendChatWithCallbacks(message, sessionKey, callbacks)` -- Streaming with per-runId callbacks.**
Used by `ChatRoomView.tsx` for multi-agent rooms. Suitable for streaming feedback where the user sees the response build up in real time.

**Recommendation for writing feedback:** Use Pattern B (`sendChatWithCallbacks`). Reasons:
- Feedback responses can be long (multiple alternatives with reasoning)
- User wants to see the response streaming in, not wait for a blank screen
- Per-runId isolation means multiple feedback requests don't interfere
- The `RunCallback` interface already supports `onDelta`, `onMessage`, `onEnd`, `onError`

### 4.2 Session Keys for Writing

Each writing project should have dedicated agent session keys:

```
agent:writer:writing:{projectId}       // Writer agent session for this project
agent:researcher:writing:{projectId}   // Researcher agent session
agent:jess:writing:{projectId}         // Jess agent session
```

**Why project-scoped sessions:**
- Agent context persists between feedback requests within a project
- The agent "remembers" previous interactions about this project
- Switching projects = different session = clean context
- Matches existing pattern: `agent:{agentId}:dashboard` for dashboard sessions

**Session lifecycle:**
- Created lazily on first feedback request to that agent for that project
- Kept alive as long as the project is open
- Cleaned up when the project is closed or dashboard restarts
- The OpenClaw Gateway handles session persistence -- no custom code needed

### 4.3 Feedback Request Message Format

When the user highlights text and requests feedback, the renderer assembles a message and sends it to the appropriate agent:

```typescript
// In the renderer (WritingFeedbackPanel component):
async function requestFeedback(
  agentId: string,
  projectId: string,
  chapterId: string,
  selectedText: string,
  userPrompt: string,
  context: WritingContext
): Promise<void> {
  const sessionKey = `agent:${agentId}:writing:${projectId}`;

  // Build context message (assembled via IPC call to main process)
  const contextPayload = await window.clawdbot.writing.context.build(
    projectId, chapterId, 'hot'
  );

  const message = [
    `[WRITING FEEDBACK REQUEST]`,
    `Project: ${context.projectTitle}`,
    `Chapter: ${context.chapterTitle} (${chapterId})`,
    ``,
    `--- CONTEXT ---`,
    contextPayload,
    `--- SELECTED TEXT ---`,
    selectedText,
    `--- USER REQUEST ---`,
    userPrompt,
    ``,
    `Provide 2-3 alternative versions of the selected text.`,
    `For each alternative, explain your reasoning briefly.`,
    `Format as JSON: { "alternatives": [{ "text": "...", "reasoning": "..." }] }`,
  ].join('\n');

  const runId = await gateway.sendChatWithCallbacks(message, sessionKey, {
    onDelta: (delta) => updateStreamingResponse(delta),
    onMessage: (content) => parseAndDisplayAlternatives(content),
    onEnd: () => markFeedbackComplete(),
    onError: (err) => showFeedbackError(err),
  });
}
```

### 4.4 Context Building (Main Process)

The `writing:context:build` IPC handler assembles the multi-tier context in the main process (where filesystem access lives):

```typescript
// In writing-feedback-service.ts:
async function buildContext(
  projectId: string,
  chapterId: string,
  tier: 'hot' | 'warm' | 'cold'
): Promise<string> {
  const projectDir = writingProjectPath(projectId);
  const parts: string[] = [];

  // TIER 1: Hot (always included)
  if (tier === 'hot' || tier === 'warm' || tier === 'cold') {
    // Current chapter
    const chapterContent = fs.readFileSync(
      writingChapterPath(projectId, chapterId), 'utf-8'
    );
    parts.push(`## Current Chapter\n${chapterContent}`);

    // Outline
    const outlinePath = path.join(projectDir, 'outline.md');
    if (fs.existsSync(outlinePath)) {
      parts.push(`## Outline\n${fs.readFileSync(outlinePath, 'utf-8')}`);
    }

    // Memory store
    const characters = readJsonFile(writingMemoryPath(projectId, 'characters.json'));
    const timeline = readJsonFile(writingMemoryPath(projectId, 'timeline.json'));
    const facts = readJsonFile(writingMemoryPath(projectId, 'facts.json'));

    if (characters.length) parts.push(`## Characters\n${JSON.stringify(characters, null, 2)}`);
    if (timeline.length) parts.push(`## Timeline\n${JSON.stringify(timeline, null, 2)}`);
    if (facts.length) parts.push(`## Facts\n${JSON.stringify(facts, null, 2)}`);
  }

  // TIER 2: Warm (adjacent chapters)
  if (tier === 'warm' || tier === 'cold') {
    const chapters = listChapters(projectId);
    const idx = chapters.findIndex(c => c.id === chapterId);
    if (idx > 0) {
      const prev = fs.readFileSync(writingChapterPath(projectId, chapters[idx - 1].id), 'utf-8');
      parts.push(`## Previous Chapter (${chapters[idx - 1].title})\n${prev}`);
    }
    if (idx < chapters.length - 1) {
      const next = fs.readFileSync(writingChapterPath(projectId, chapters[idx + 1].id), 'utf-8');
      parts.push(`## Next Chapter (${chapters[idx + 1].title})\n${next}`);
    }
  }

  return parts.join('\n\n---\n\n');
}
```

### 4.5 Agent Selection per Feedback Type

The renderer decides which agent to route feedback to based on the user's request type:

| Feedback Type | Agent | Session Key Pattern |
|--------------|-------|-------------------|
| Style, pacing, narrative | Writer | `agent:writer:writing:{pid}` |
| Fact-check, source | Researcher | `agent:researcher:writing:{pid}` |
| Emotional tone, boundaries | Jess | `agent:jess:writing:{pid}` |
| General rewrite | Writer (default) | `agent:writer:writing:{pid}` |

The UI provides agent selection in the feedback panel (similar to `AgentSelector` component used in ChatPanel).

---

## 5. React Component Structure

### 5.1 New View: 'writing'

Add to the `View` type union in both `App.tsx` and `Sidebar.tsx`:

```typescript
type View = 'dashboard' | 'kanban' | ... | 'writing';
```

Add to `App.tsx` rendering:

```typescript
{currentView === 'writing' && <WritingWorkspace />}
```

Add to `ProtectedPanels.tsx`:

```typescript
const WritingWorkspaceRaw = lazy(() => import('./writing/WritingWorkspace'));
export const WritingWorkspace = withErrorBoundary(WritingWorkspaceRaw, 'Writing');
```

### 5.2 Component Tree

```
src/components/writing/
  WritingWorkspace.tsx          # Top-level container (handles project selection vs editor)
  ProjectSelector.tsx           # Project list, create new project
  ProjectEditor.tsx             # Main 3-panel layout when project is open

  # Left panel
  ChapterSidebar.tsx            # Chapter list, outline navigation
  ChapterListItem.tsx           # Individual chapter entry

  # Center panel
  ChapterEditor.tsx             # TipTap/ProseMirror editor wrapper
  EditorToolbar.tsx             # Formatting toolbar
  InlineFeedbackPopover.tsx     # Floating feedback UI on text selection
  AlternativesDisplay.tsx       # Shows AI alternatives with accept/reject

  # Right panel
  ContextPanel.tsx              # Characters, timeline, recent feedback
  CharacterCard.tsx             # Character profile display
  TimelineView.tsx              # Timeline event list

  # Memory management (sub-views)
  MemoryManager.tsx             # Tab container for characters/timeline/facts
  CharacterEditor.tsx           # Create/edit character profile
  TimelineEditor.tsx            # Create/edit timeline events
  FactEditor.tsx                # Create/edit facts

  # Research (Phase 2)
  ResearchLibrary.tsx           # Source management
  SourceEditor.tsx              # Add/edit sources
  FactChecker.tsx               # Fact verification queue
```

### 5.3 State Management

**Recommendation: Separate Zustand store for writing.**

The existing `store.ts` handles tasks, agents, sessions, approvals -- all operational dashboard state. The writing system is a different domain with different state lifecycle.

**New file:** `src/store/writingStore.ts`

```typescript
import { create } from 'zustand';

interface WritingProject {
  id: string;
  title: string;
  type: string;
  stats: { wordCount: number; chapterCount: number };
  lastEditedChapter: string | null;
}

interface Chapter {
  id: string;
  title: string;
  position: number;
  wordCount: number;
}

interface WritingStore {
  // Project state
  projects: WritingProject[];
  activeProjectId: string | null;
  loadProjects: () => Promise<void>;
  openProject: (id: string) => Promise<void>;
  closeProject: () => void;

  // Chapter state
  chapters: Chapter[];
  activeChapterId: string | null;
  chapterContent: string;
  chapterDirty: boolean;
  loadChapters: () => Promise<void>;
  openChapter: (id: string) => Promise<void>;
  updateChapterContent: (content: string) => void;
  saveChapter: () => Promise<void>;

  // Memory state
  characters: any[];
  timeline: any[];
  facts: any[];
  loadMemory: () => Promise<void>;

  // Feedback state
  activeFeedback: FeedbackInteraction | null;
  feedbackHistory: FeedbackInteraction[];
  isRequestingFeedback: boolean;
  requestFeedback: (selection: TextSelection, prompt: string, agentId: string) => Promise<void>;
  acceptAlternative: (alternativeId: string) => void;
  dismissFeedback: () => void;
}
```

**Why separate store:**
- Different persistence needs (writing state is project-scoped, not global)
- No `persist` middleware needed (project state lives in files, not localStorage)
- Clean separation -- writing components only import `writingStore`, not the 600-line main store
- Follows the precedent of `chatRoomStore` being separate from main store (referenced in ChatPanel.tsx)

### 5.4 Editor Library Decision

**Recommendation: TipTap** (built on ProseMirror)

**Why TipTap over raw ProseMirror:**
- Higher-level API -- less boilerplate for common operations
- Built-in extension system (bold, italic, headings, etc.)
- Selection tracking via `editor.state.selection` -- needed for inline feedback
- Markdown import/export via `@tiptap/extension-markdown` (or `tiptap-markdown` community extension)
- Active ecosystem with React integration (`@tiptap/react`)
- Custom node types for embedding feedback markers in the document

**Why not CodeMirror:**
- CodeMirror is a code editor, not a prose editor. No semantic block support (headings, lists, blockquotes).

**Why not Slate:**
- Slate has a history of breaking API changes between versions. TipTap is more stable.
- TipTap's ProseMirror foundation is battle-tested.

**Key TipTap extensions needed:**
- `@tiptap/starter-kit` -- basic formatting
- `@tiptap/extension-placeholder`
- `@tiptap/extension-character-count` -- word count
- `@tiptap/extension-highlight` -- for marking feedback selections
- Custom extension for feedback markers (inline decorations showing where feedback was applied)

**Selection tracking for inline feedback:**

```typescript
// In ChapterEditor.tsx:
editor.on('selectionUpdate', ({ editor }) => {
  const { from, to } = editor.state.selection;
  if (from !== to) {
    // User has selected text
    const selectedText = editor.state.doc.textBetween(from, to);
    showFeedbackPopover(from, to, selectedText);
  }
});
```

### 5.5 Preload Bridge Additions

Add to `preload.ts` inside the `contextBridge.exposeInMainWorld('clawdbot', { ... })` block:

```typescript
// Writing system
writing: {
  project: {
    list: () => ipcRenderer.invoke('writing:project:list'),
    create: (name: string, type: string) => ipcRenderer.invoke('writing:project:create', name, type),
    get: (projectId: string) => ipcRenderer.invoke('writing:project:get', projectId),
    update: (projectId: string, updates: any) => ipcRenderer.invoke('writing:project:update', projectId, updates),
    delete: (projectId: string) => ipcRenderer.invoke('writing:project:delete', projectId),
  },
  chapter: {
    list: (projectId: string) => ipcRenderer.invoke('writing:chapter:list', projectId),
    create: (projectId: string, title: string, position: number) => ipcRenderer.invoke('writing:chapter:create', projectId, title, position),
    read: (projectId: string, chapterId: string) => ipcRenderer.invoke('writing:chapter:read', projectId, chapterId),
    save: (projectId: string, chapterId: string, content: string) => ipcRenderer.invoke('writing:chapter:save', projectId, chapterId, content),
    rename: (projectId: string, chapterId: string, newTitle: string) => ipcRenderer.invoke('writing:chapter:rename', projectId, chapterId, newTitle),
    reorder: (projectId: string, chapterIds: string[]) => ipcRenderer.invoke('writing:chapter:reorder', projectId, chapterIds),
    delete: (projectId: string, chapterId: string) => ipcRenderer.invoke('writing:chapter:delete', projectId, chapterId),
  },
  memory: {
    characters: {
      list: (projectId: string) => ipcRenderer.invoke('writing:memory:characters:list', projectId),
      save: (projectId: string, character: any) => ipcRenderer.invoke('writing:memory:characters:save', projectId, character),
      delete: (projectId: string, characterId: string) => ipcRenderer.invoke('writing:memory:characters:delete', projectId, characterId),
    },
    timeline: {
      list: (projectId: string) => ipcRenderer.invoke('writing:memory:timeline:list', projectId),
      save: (projectId: string, event: any) => ipcRenderer.invoke('writing:memory:timeline:save', projectId, event),
      delete: (projectId: string, eventId: string) => ipcRenderer.invoke('writing:memory:timeline:delete', projectId, eventId),
    },
    facts: {
      list: (projectId: string) => ipcRenderer.invoke('writing:memory:facts:list', projectId),
      save: (projectId: string, fact: any) => ipcRenderer.invoke('writing:memory:facts:save', projectId, fact),
      delete: (projectId: string, factId: string) => ipcRenderer.invoke('writing:memory:facts:delete', projectId, factId),
    },
  },
  feedback: {
    list: (projectId: string, chapterId: string) => ipcRenderer.invoke('writing:feedback:list', projectId, chapterId),
    save: (projectId: string, chapterId: string, interaction: any) => ipcRenderer.invoke('writing:feedback:save', projectId, chapterId, interaction),
  },
  context: {
    build: (projectId: string, chapterId: string, tier: string) => ipcRenderer.invoke('writing:context:build', projectId, chapterId, tier),
  },
  version: {
    list: (projectId: string, chapterId: string) => ipcRenderer.invoke('writing:version:list', projectId, chapterId),
    save: (projectId: string, chapterId: string, label?: string) => ipcRenderer.invoke('writing:version:save', projectId, chapterId, label),
    restore: (projectId: string, chapterId: string, versionId: string) => ipcRenderer.invoke('writing:version:restore', projectId, chapterId, versionId),
  },
},
```

Also update `src/types/global.d.ts` with the TypeScript declarations for `window.clawdbot.writing.*`.

### 5.6 Layout Integration

The writing workspace is a full-panel view (like Kanban or ChatPanel), not a sub-panel. When active, it replaces the main content area. But it has its own internal 3-panel layout:

```
+-------------------+-------------------------------------------+------------------+
| Chapter Sidebar   |            Chapter Editor                 | Context Panel    |
| (200px)           |            (flex-1)                       | (300px)          |
|                   |                                           |                  |
| Outline           | [Editor Toolbar]                          | Characters       |
| Ch 1: Childhood   | --------------------------------          | - Sarah          |
| Ch 2: First Job   | | The room was quiet as Sarah             | - Dad            |
| Ch 3: Meeting S*  | | walked through the door. She            |                  |
|                   | | hadn't seen her father in ten          | Timeline         |
| [+ New Chapter]   | | years, and the weight of that          | - 2016: Left     |
|                   | | absence pressed against her            | - 2026: Return   |
|                   | | chest like a stone.                    |                  |
|                   | | ^^^^^^^^^^^^^^^^^^^^^^^^ [selected]    | Recent Feedback  |
|                   | |                                        | - Pacing fix     |
|                   | | [Feedback Popover]                     | - Tone adjust    |
|                   | | > Make this more emotional             |                  |
|                   | | [Writer] [Researcher] [Jess]           | Agent Status     |
|                   | | [Send Feedback]                        | Writer: ready    |
|                   | --------------------------------          | Jess: ready      |
+-------------------+-------------------------------------------+------------------+
```

---

## 6. Suggested Build Order

Dependencies flow downward. Each phase builds on the previous.

### Phase 1: Foundation (Project + Chapter CRUD)

**What:** File structure, project service, chapter service, basic UI shell.

**Deliverables:**
- `electron/paths.ts` -- add `WRITING_PROJECTS_DIR` and helpers
- `electron/fs-validation.ts` -- add `~/froggo` to ALLOWED_ROOTS
- `electron/writing-project-service.ts` -- project CRUD + chapter CRUD + version save
- `preload.ts` -- add `writing.project.*`, `writing.chapter.*`, `writing.version.*`
- `src/store/writingStore.ts` -- project/chapter state
- `src/components/writing/WritingWorkspace.tsx` -- top-level container
- `src/components/writing/ProjectSelector.tsx` -- project list + create
- `src/components/writing/ProjectEditor.tsx` -- 3-panel layout shell
- `src/components/writing/ChapterSidebar.tsx` -- chapter list
- `src/components/writing/ChapterEditor.tsx` -- TipTap editor (basic markdown)
- `src/components/ProtectedPanels.tsx` -- add WritingWorkspace
- `App.tsx` -- add `'writing'` view
- `Sidebar.tsx` -- add Writing nav item

**Dependencies:** None. This is the foundation.

**Why first:** Everything else depends on being able to create projects and edit chapters. This is the skeleton the rest hangs on.

**Modified existing files:**
- `electron/paths.ts` (add 3 exports)
- `electron/fs-validation.ts` (add 1 path to ALLOWED_ROOTS)
- `electron/main.ts` (add import + register call, ~5 lines)
- `electron/preload.ts` (add writing section to contextBridge)
- `src/types/global.d.ts` (add writing type declarations)
- `src/components/ProtectedPanels.tsx` (add WritingWorkspace)
- `src/App.tsx` (add view type + render line)
- `src/components/Sidebar.tsx` (add nav item)

**New files:** 7 in `electron/`, 6 in `src/components/writing/`, 1 in `src/store/`

### Phase 2: Inline Feedback System

**What:** Text selection tracking, feedback popover, agent communication, response display.

**Deliverables:**
- `electron/writing-feedback-service.ts` -- feedback storage + context building
- `src/components/writing/InlineFeedbackPopover.tsx` -- floating UI
- `src/components/writing/AlternativesDisplay.tsx` -- show alternatives
- `src/components/writing/AgentFeedbackSelector.tsx` -- pick Writer/Researcher/Jess
- TipTap custom extension for selection tracking and feedback markers
- Preload additions for `writing.feedback.*` and `writing.context.*`
- writingStore additions for feedback state

**Dependencies:** Phase 1 (needs editor + project structure).

**Why second:** This is the core innovation -- the reason this system exists. Get it working early so Kevin can validate the UX pattern.

**Modified existing files:**
- `electron/main.ts` (register feedback handlers)
- `electron/preload.ts` (add feedback/context channels)

**New files:** 4 components, 1 electron service, 1 TipTap extension

### Phase 3: Memory Store

**What:** Character profiles, timeline events, facts -- CRUD + display in context panel.

**Deliverables:**
- `electron/writing-memory-service.ts` -- memory CRUD
- `src/components/writing/ContextPanel.tsx` -- right sidebar
- `src/components/writing/CharacterCard.tsx`
- `src/components/writing/CharacterEditor.tsx`
- `src/components/writing/TimelineView.tsx`
- `src/components/writing/TimelineEditor.tsx`
- `src/components/writing/MemoryManager.tsx` -- tab container
- Preload additions for `writing.memory.*`
- Context building enhanced to include memory data in agent messages

**Dependencies:** Phase 1 (file structure), Phase 2 (context building feeds memory into agent prompts).

**Why third:** Memory store makes the AI feedback context-aware. Without it, feedback is generic. With it, the AI knows about characters, timeline, and facts.

### Phase 4: Research & Sources (SQLite)

**What:** Per-project SQLite database, source management, fact-checking.

**Deliverables:**
- `database.ts` additions -- `getWritingDb()` for per-project SQLite
- Research library UI components
- Source editor, fact checker
- Schema creation (sources.db)
- Researcher agent integration for fact-checking workflow

**Dependencies:** Phase 1 + 3 (needs facts from memory store to link to sources).

**Why fourth:** This is Phase 2-tier complexity but has the richest dependency chain. SQLite schema design + relational linking between facts and sources is the most architecturally complex piece.

### Phase 5: Outline Mode & Version History

**What:** Chapter reordering, outline view, version comparison.

**Deliverables:**
- Outline mode component (drag-drop chapter cards)
- Version history sidebar in editor
- Diff view component (version comparison)
- Word count goals and progress tracking

**Dependencies:** Phase 1 (chapter structure + versioning already built).

**Why fifth:** This is polish on top of the core experience. The writing flow (edit + feedback) works without outline mode.

### Phase 6: Jess Integration + Polish

**What:** Emotional feedback agent, style guide enforcement, keyboard shortcuts.

**Deliverables:**
- Jess agent prompts for memoir-specific feedback
- Emotional tone indicators in context panel
- Style guide system
- Writing-specific keyboard shortcuts
- Auto-save with debounce
- Word count and reading time in toolbar

**Dependencies:** Phase 2 (feedback system) + Phase 3 (memory for emotional context).

**Why last:** Jess integration is an agent prompt engineering task more than a code task. The infrastructure from Phase 2 already supports any agent. This is configuring the right prompts and UX for emotional/memoir-specific feedback.

---

## 7. Integration Risk Assessment

### Low Risk
- **paths.ts additions** -- Simple constant additions, well-established pattern
- **Sidebar + App.tsx** -- Adding one more view, done many times before
- **writingStore.ts** -- Clean separate store, no interaction with existing store
- **Preload additions** -- Mechanical IPC channel registration

### Medium Risk
- **TipTap integration** -- New dependency, needs careful evaluation of markdown round-tripping. TipTap stores content as ProseMirror nodes, not markdown -- the import/export fidelity needs testing.
- **fs-validation.ts** -- The missing `~/froggo` path is an existing bug. Fixing it is straightforward but must be done carefully (security boundary).
- **Per-project SQLite** -- Connection lifecycle management (open/close on project switch) needs clean handling to avoid file locks.

### High Risk
- **Gateway session management** -- Creating project-scoped agent sessions is straightforward via `sendChatWithCallbacks`, but session cleanup on project close is not automatic. Need explicit cleanup to avoid zombie sessions.
- **Context window budget** -- The 200k token budget is theoretical. Real-world testing with a 50-chapter project will be needed to validate that the multi-tier context system stays within bounds. If the memory store + outline + current chapter exceeds 60k tokens, the tier system needs tuning.

---

## 8. Existing Code to Reuse (Not Reinvent)

| Need | Existing Code | Where |
|------|--------------|-------|
| Agent list/selection | `AgentSelector` component | `src/components/AgentSelector.tsx` |
| Gateway communication | `gateway.sendChatWithCallbacks()` | `src/lib/gateway.ts` |
| Streaming response display | `ChatPanel` streaming pattern | `src/components/ChatPanel.tsx` |
| Error boundaries | `withErrorBoundary` HOC | `src/components/ErrorBoundary.tsx` |
| Toast notifications | `showToast()` | `src/components/Toast.tsx` |
| DB connection management | `database.ts` lazy init pattern | `electron/database.ts` |
| Path management | `paths.ts` pattern | `electron/paths.ts` |
| FS validation | `validateFsPath()` | `electron/fs-validation.ts` |
| IPC registration | `registerXxxHandlers()` pattern | `electron/x-automations-service.ts` |
| Lazy loading | `ProtectedPanels.tsx` pattern | `src/components/ProtectedPanels.tsx` |

---

## Sources

- Direct source code analysis of `/Users/worker/froggo-dashboard/electron/` (paths.ts, database.ts, main.ts, preload.ts, fs-validation.ts, connected-accounts-service.ts, export-backup-service.ts, dashboard-agents.ts, notification-service.ts, x-automations-service.ts)
- Direct source code analysis of `/Users/worker/froggo-dashboard/src/` (App.tsx, Sidebar.tsx, store/store.ts, lib/gateway.ts, components/ChatPanel.tsx, components/AIAssistancePanel.tsx, components/ProtectedPanels.tsx)
- Chief's writing system design document: `/Users/worker/agent-chief/writing-system-design.md`
- Project requirements: `/Users/worker/froggo-dashboard/.planning/PROJECT.md`
- All confidence levels HIGH -- based on actual source code reading, not web research or training data assumptions
