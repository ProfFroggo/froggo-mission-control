# Phase 7: Memory Store - Research

**Researched:** 2026-02-12
**Domain:** File-based CRUD with Zustand state management, Electron IPC, React panel UI
**Confidence:** HIGH

## Summary

Phase 7 adds a "memory store" to the writing module: character profiles, timeline events, and verified facts that the user can create/edit/delete in a context panel alongside the editor, which are automatically injected into AI feedback prompts and persisted as JSON files per project.

The existing codebase already has all the infrastructure patterns needed. The writing module uses a file-based storage pattern (JSON files under `~/froggo/writing-projects/{projectId}/`), a dedicated Electron IPC service (`writing-project-service.ts`, `writing-feedback-service.ts`), a preload bridge namespace (`window.clawdbot.writing`), and a Zustand store (`writingStore.ts`). The memory store follows the exact same architecture: new JSON files in the existing `memory/` directory, a new IPC service, bridge extensions, a new Zustand store, and new React components for the context panel.

**Primary recommendation:** Follow the existing writing module patterns exactly. No new libraries needed. Use `characters.json`, `timeline.json`, and `facts.json` in the project's `memory/` directory. Add a new `writing-memory-service.ts` for IPC, a new `memoryStore.ts` Zustand store, and a collapsible right-side context panel in `ProjectEditor.tsx`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | 4.5.7 | State management for memory store | Already in use for writingStore and feedbackStore |
| React 18 | ^18.2.0 | UI components for context panel | Already the app framework |
| lucide-react | ^0.303.0 | Icons for UI elements | Already used throughout writing module |
| Node.js fs.promises | built-in | File-based JSON persistence | Already used in writing-project-service.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.3.6 | Schema validation for memory data | Already installed; validate imported/loaded JSON |
| @dnd-kit/sortable | ^8.0.0 | Drag-reorder timeline events | Already installed; use for timeline ordering |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON files | SQLite tables in froggo.db | Would break file-based project paradigm; JSON keeps projects self-contained and portable |
| Separate store per entity type | Single memoryStore | Single store is simpler; entity counts are small (tens, not thousands) |
| Inline editing in editor | Separate context panel | Panel is specified in requirements; keeps memory CRUD separate from writing flow |

**Installation:**
```bash
# No new packages needed — all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure

```
electron/
├── writing-memory-service.ts    # NEW — IPC handlers for memory CRUD

src/
├── store/
│   └── memoryStore.ts           # NEW — Zustand store for memory state
├── components/writing/
│   ├── ContextPanel.tsx          # NEW — right-side collapsible panel
│   ├── CharacterList.tsx         # NEW — character profile list + CRUD
│   ├── CharacterForm.tsx         # NEW — create/edit character form
│   ├── TimelineList.tsx          # NEW — timeline event list + CRUD
│   ├── TimelineForm.tsx          # NEW — create/edit timeline event form
│   ├── FactList.tsx              # NEW — verified facts list + CRUD
│   ├── FactForm.tsx              # NEW — create/edit fact form
│   └── ProjectEditor.tsx         # MODIFIED — add ContextPanel alongside editor
```

### On-Disk Storage Layout

```
~/froggo/writing-projects/{projectId}/
├── project.json
├── chapters.json
├── chapters/
│   └── 01-chapter-title.md
├── memory/
│   ├── feedback-{chapterId}.jsonl   # (existing, from Phase 6)
│   ├── characters.json              # NEW — array of CharacterProfile
│   ├── timeline.json                # NEW — array of TimelineEvent
│   └── facts.json                   # NEW — array of VerifiedFact
└── versions/
```

### Pattern 1: Electron IPC Service (follow existing pattern exactly)

**What:** Dedicated file for IPC handlers that do file I/O, registered in main.ts
**When to use:** Any new domain of file-based CRUD
**Example:**

```typescript
// electron/writing-memory-service.ts
// Source: Follows exact pattern of writing-project-service.ts and writing-feedback-service.ts

import { ipcMain } from 'electron';
import * as fs from 'fs';
import { writingMemoryPath } from './paths';

interface CharacterProfile {
  id: string;
  name: string;
  relationship: string;
  description: string;
  traits: string[];
  createdAt: string;
  updatedAt: string;
}

interface TimelineEvent {
  id: string;
  date: string;          // user-entered date string (e.g. "Summer 1985", "March 2020")
  description: string;
  chapterRefs: string[]; // chapter IDs this event relates to
  position: number;      // for manual ordering
  createdAt: string;
  updatedAt: string;
}

interface VerifiedFact {
  id: string;
  claim: string;
  source: string;
  status: 'unverified' | 'verified' | 'disputed';
  createdAt: string;
  updatedAt: string;
}

// Generic helpers (same as writing-project-service.ts)
async function ensureDir(dir: string): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function readJsonArray<T>(filepath: string): Promise<T[]> {
  try {
    const raw = await fs.promises.readFile(filepath, 'utf-8');
    return JSON.parse(raw) as T[];
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeJson(filepath: string, data: unknown): Promise<void> {
  await fs.promises.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

// Example: list characters
async function listCharacters(projectId: string) {
  try {
    const filePath = writingMemoryPath(projectId, 'characters.json');
    const characters = await readJsonArray<CharacterProfile>(filePath);
    return { success: true, characters };
  } catch (e: any) {
    return { success: false, error: e.message, characters: [] };
  }
}

// ... create, update, delete follow same pattern

export function registerWritingMemoryHandlers() {
  // Characters
  ipcMain.handle('writing:memory:characters:list', async (_, projectId: string) =>
    listCharacters(projectId));
  // ... other handlers
  console.log('[writing-memory] IPC handlers registered');
}
```

### Pattern 2: Zustand Store with Bridge (follow writingStore.ts pattern)

**What:** Renderer-side store that calls preload bridge methods for data access
**When to use:** Any new state domain in the renderer
**Example:**

```typescript
// src/store/memoryStore.ts
import { create } from 'zustand';

export interface CharacterProfile {
  id: string;
  name: string;
  relationship: string;
  description: string;
  traits: string[];
}

// ... TimelineEvent, VerifiedFact interfaces

interface MemoryState {
  characters: CharacterProfile[];
  timeline: TimelineEvent[];
  facts: VerifiedFact[];
  loading: boolean;
  activeTab: 'characters' | 'timeline' | 'facts';

  // Actions
  loadMemory: (projectId: string) => Promise<void>;
  addCharacter: (projectId: string, data: Omit<CharacterProfile, 'id'>) => Promise<void>;
  updateCharacter: (projectId: string, id: string, data: Partial<CharacterProfile>) => Promise<void>;
  deleteCharacter: (projectId: string, id: string) => Promise<void>;
  // ... same for timeline, facts

  setActiveTab: (tab: 'characters' | 'timeline' | 'facts') => void;
  clearMemory: () => void;
}

const bridge = () => (window as any).clawdbot?.writing?.memory;

export const useMemoryStore = create<MemoryState>((set, get) => ({
  characters: [],
  timeline: [],
  facts: [],
  loading: false,
  activeTab: 'characters',

  loadMemory: async (projectId) => {
    set({ loading: true });
    try {
      const [charResult, timeResult, factResult] = await Promise.all([
        bridge()?.characters?.list(projectId),
        bridge()?.timeline?.list(projectId),
        bridge()?.facts?.list(projectId),
      ]);
      set({
        characters: charResult?.characters || [],
        timeline: timeResult?.events || [],
        facts: factResult?.facts || [],
      });
    } finally {
      set({ loading: false });
    }
  },

  // ... CRUD actions follow same pattern as writingStore
}));
```

### Pattern 3: Context Panel Layout (right-side panel in ProjectEditor)

**What:** Collapsible right panel alongside the editor area
**When to use:** The memory store context panel
**Example:**

```tsx
// Modified ProjectEditor.tsx layout
<div className="flex h-full">
  <ChapterSidebar />           {/* existing left sidebar, w-64 */}
  <div className="flex-1 min-w-0">
    {activeChapterId ? <ChapterEditor /> : <EmptyState />}
  </div>
  {contextPanelOpen && <ContextPanel />}  {/* NEW right panel, w-72 */}
</div>
```

### Pattern 4: AI Context Injection (extend FeedbackPopover.buildPrompt)

**What:** Include memory store data in the prompt sent to AI agents
**When to use:** When sending feedback requests
**Example:**

```typescript
// In FeedbackPopover.tsx buildPrompt function, add after Project Outline section:
function buildMemoryContext(
  characters: CharacterProfile[],
  timeline: TimelineEvent[],
  facts: VerifiedFact[],
): string {
  const sections: string[] = [];

  if (characters.length > 0) {
    sections.push('### Characters');
    characters.forEach(c => {
      sections.push(`- **${c.name}** (${c.relationship}): ${c.description}`);
      if (c.traits.length > 0) sections.push(`  Traits: ${c.traits.join(', ')}`);
    });
  }

  if (timeline.length > 0) {
    sections.push('### Timeline');
    timeline.forEach(e => {
      sections.push(`- **${e.date}**: ${e.description}`);
    });
  }

  if (facts.length > 0) {
    sections.push('### Verified Facts');
    facts.forEach(f => {
      const statusEmoji = f.status === 'verified' ? '[V]' : f.status === 'disputed' ? '[D]' : '[?]';
      sections.push(`- ${statusEmoji} ${f.claim} (source: ${f.source})`);
    });
  }

  return sections.length > 0
    ? '### Memory Store (Project Context)\n' + sections.join('\n')
    : '';
}
```

### Anti-Patterns to Avoid

- **Over-engineering the data model:** Characters, timeline, and facts are simple flat arrays. Don't add relational links, graph structures, or tagging systems. Keep it simple: arrays of typed objects in JSON files.
- **Lazy loading individual entities:** The memory store for a project is small (tens of items). Load all three arrays at once when a project opens. Don't add pagination or lazy loading.
- **Separate IPC per-operation:** Don't register dozens of fine-grained IPC handlers. Use a pattern like `writing:memory:characters:list/create/update/delete` but keep the handler functions thin. The existing codebase uses one handler per operation which is fine at this scale.
- **Storing memory data in writingStore:** Keep memoryStore separate. writingStore is already handling project and chapter state. A separate store follows separation of concerns and avoids the store becoming a monolith.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique IDs | Custom UUID or counter | `Date.now() + Math.random().toString(36)` | Same pattern already used in writing-project-service.ts for project/chapter IDs |
| JSON file read/write | Custom serialization | `readJsonArray<T>()` / `writeJson()` helpers | Already proven pattern in existing services |
| Form state | Custom form management | React useState per field | Forms are simple (3-5 fields); no need for Formik/react-hook-form |
| Collapsible panel | Custom animation/transition | CSS `w-0 overflow-hidden` to `w-72` with Tailwind transition | Simple toggle, no library needed |

**Key insight:** The writing module's file-based CRUD pattern is well-established. Every piece of infrastructure already exists. This phase is entirely about adding new data types and UI components following existing conventions.

## Common Pitfalls

### Pitfall 1: Memory Data Stale After External Edit
**What goes wrong:** If the user has two windows or the memory files are edited outside the app, the in-memory Zustand state becomes stale.
**Why it happens:** File-based storage has no change notifications.
**How to avoid:** Reload memory from disk whenever the project panel opens or regains focus. This is the same approach used for chapters (re-read on open). Don't try to add file watchers — it's not worth the complexity for this use case.
**Warning signs:** User adds a character, switches away, comes back, character is gone.

### Pitfall 2: Overwriting Concurrent Edits (Read-Modify-Write Race)
**What goes wrong:** Two rapid CRUD operations both read the same file, modify in memory, and write back — second write overwrites first.
**Why it happens:** JSON file read-modify-write is not atomic.
**How to avoid:** All CRUD operations go through the Electron main process (IPC handlers) which is single-threaded for JavaScript. As long as each handler does `read → modify → write` without awaiting between modify and write, Node's event loop serializes them. The existing writing-project-service.ts already uses this pattern safely.
**Warning signs:** "I added two characters quickly and only the second one saved."

### Pitfall 3: Context Panel Fighting Editor Width
**What goes wrong:** Adding a right panel squeezes the editor uncomfortably on smaller screens.
**Why it happens:** The editor is in a `flex-1` container between two fixed-width sidebars.
**How to avoid:** Make the context panel collapsible (toggle button). Use a reasonable width (w-72 = 288px). The left sidebar is w-64 (256px). On screens under ~1200px, the panel could auto-collapse or use an overlay. Start with the toggle approach and iterate.
**Warning signs:** Editor becomes too narrow to write comfortably.

### Pitfall 4: Bloating AI Prompts with Full Memory Store
**What goes wrong:** A project with 30 characters, 50 timeline events, and 40 facts produces a massive context block that exceeds token limits or dilutes the feedback quality.
**Why it happens:** Naive injection dumps everything into the prompt.
**How to avoid:** Truncate the memory context to a reasonable size (e.g., 2000 characters total). Prioritize characters and facts that are most relevant to the current chapter (if chapter refs exist on timeline events, filter to current chapter). Set a hard cap on the number of items serialized (e.g., 15 characters, 20 timeline events, 20 facts).
**Warning signs:** AI responses become slower or less focused.

### Pitfall 5: Forgetting to Clear Memory on Project Switch
**What goes wrong:** User opens Project A (loads its characters), then opens Project B — still sees Project A's characters.
**Why it happens:** Zustand state persists across project switches unless explicitly cleared.
**How to avoid:** Call `memoryStore.clearMemory()` when switching projects (in `writingStore.openProject` or `closeProject`). Then call `memoryStore.loadMemory(projectId)` when the new project opens. Same pattern as how chapter content is cleared on chapter switch.
**Warning signs:** Characters from one project appear in another.

## Code Examples

### IPC Handler Registration in main.ts

```typescript
// electron/main.ts — add alongside existing registrations
import { registerWritingMemoryHandlers } from './writing-memory-service';

// In createWindow():
registerWritingProjectHandlers();
registerWritingFeedbackHandlers();
registerWritingMemoryHandlers();  // NEW
```

### Preload Bridge Extension

```typescript
// electron/preload.ts — add inside the `writing` namespace
memory: {
  characters: {
    list: (projectId: string) => ipcRenderer.invoke('writing:memory:characters:list', projectId),
    create: (projectId: string, data: any) => ipcRenderer.invoke('writing:memory:characters:create', projectId, data),
    update: (projectId: string, id: string, data: any) => ipcRenderer.invoke('writing:memory:characters:update', projectId, id, data),
    delete: (projectId: string, id: string) => ipcRenderer.invoke('writing:memory:characters:delete', projectId, id),
  },
  timeline: {
    list: (projectId: string) => ipcRenderer.invoke('writing:memory:timeline:list', projectId),
    create: (projectId: string, data: any) => ipcRenderer.invoke('writing:memory:timeline:create', projectId, data),
    update: (projectId: string, id: string, data: any) => ipcRenderer.invoke('writing:memory:timeline:update', projectId, id, data),
    delete: (projectId: string, id: string) => ipcRenderer.invoke('writing:memory:timeline:delete', projectId, id),
  },
  facts: {
    list: (projectId: string) => ipcRenderer.invoke('writing:memory:facts:list', projectId),
    create: (projectId: string, data: any) => ipcRenderer.invoke('writing:memory:facts:create', projectId, data),
    update: (projectId: string, id: string, data: any) => ipcRenderer.invoke('writing:memory:facts:update', projectId, id, data),
    delete: (projectId: string, id: string) => ipcRenderer.invoke('writing:memory:facts:delete', projectId, id),
  },
},
```

### Context Panel Toggle in ProjectEditor

```tsx
// Modified src/components/writing/ProjectEditor.tsx
import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import ChapterSidebar from './ChapterSidebar';
import ChapterEditor from './ChapterEditor';
import ContextPanel from './ContextPanel';

export default function ProjectEditor() {
  const { activeChapterId } = useWritingStore();
  const [contextOpen, setContextOpen] = useState(false);

  return (
    <div className="flex h-full">
      <ChapterSidebar />
      <div className="flex-1 min-w-0 relative">
        {/* Toggle button in top-right corner */}
        <button
          onClick={() => setContextOpen(!contextOpen)}
          className="absolute top-2 right-2 z-10 p-1.5 rounded ..."
          title="Toggle context panel"
        >
          <BookOpen size={16} />
        </button>
        {activeChapterId ? <ChapterEditor /> : <EmptyState />}
      </div>
      {contextOpen && <ContextPanel />}
    </div>
  );
}
```

### Data Type Schemas

```typescript
// Shared types (used in both electron/ and src/)
// Can be defined in both places or extracted to a shared types file

interface CharacterProfile {
  id: string;           // "char-{timestamp}-{random}"
  name: string;         // e.g. "Mom", "Uncle Ray"
  relationship: string; // e.g. "Mother", "Uncle", "Friend"
  description: string;  // Free-form text
  traits: string[];     // e.g. ["stubborn", "generous", "loud laugh"]
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
}

interface TimelineEvent {
  id: string;           // "evt-{timestamp}-{random}"
  date: string;         // User-entered, free-form (e.g. "Summer 1985", "2020-03-15")
  description: string;  // What happened
  chapterRefs: string[];// Chapter IDs this event relates to
  position: number;     // For manual ordering
  createdAt: string;
  updatedAt: string;
}

interface VerifiedFact {
  id: string;           // "fact-{timestamp}-{random}"
  claim: string;        // The factual claim
  source: string;       // Where it was verified
  status: 'unverified' | 'verified' | 'disputed';
  createdAt: string;
  updatedAt: string;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SQLite for everything | JSON files per project | Phase 5-6 (writing module design) | Projects are self-contained and portable |
| Global state store | Domain-specific Zustand stores | Phase 5 (writingStore introduced) | Separation of concerns, no monolith store |

**Deprecated/outdated:**
- N/A. No deprecated approaches apply. The file-based pattern was established in Phase 5-6 and is current.

## Open Questions

1. **Shared types between electron/ and src/**
   - What we know: Both sides need the same interfaces (CharacterProfile, TimelineEvent, VerifiedFact). The existing codebase defines interfaces separately in each layer.
   - What's unclear: Whether to create a shared types file or duplicate. Existing pattern duplicates (interfaces in writing-project-service.ts differ slightly from writingStore.ts).
   - Recommendation: Follow existing pattern — define interfaces in both places. The types are simple enough that duplication is low-risk. A shared types file would require changes to both tsconfig files (electron and renderer have separate configs).

2. **Memory context relevance filtering for AI**
   - What we know: MEM-05 says memory data is "automatically included" in AI context.
   - What's unclear: Whether ALL memory data should always be included, or filtered by relevance (e.g., only characters mentioned in the current chapter).
   - Recommendation: Start with including all memory data (with a size cap). Relevance filtering is an optimization for later. Most projects will have <50 total memory items.

3. **Context panel position and behavior**
   - What we know: MEM-04 says "displays in context panel alongside editor."
   - What's unclear: Whether this means always visible or togglable. Whether it replaces the chapter sidebar on smaller screens.
   - Recommendation: Make it a togglable right-side panel (collapsed by default). Toggle button in the editor toolbar or top-right corner. This avoids taking up screen space by default while being easily accessible.

## Sources

### Primary (HIGH confidence)
- `/Users/worker/froggo-dashboard/electron/writing-project-service.ts` — File-based CRUD pattern, IPC handler registration
- `/Users/worker/froggo-dashboard/electron/writing-feedback-service.ts` — Memory path usage, JSONL pattern
- `/Users/worker/froggo-dashboard/electron/paths.ts` — `writingMemoryPath()` helper, directory structure
- `/Users/worker/froggo-dashboard/electron/preload.ts` — Bridge namespace pattern (`window.clawdbot.writing`)
- `/Users/worker/froggo-dashboard/src/store/writingStore.ts` — Zustand store pattern with bridge accessor
- `/Users/worker/froggo-dashboard/src/store/feedbackStore.ts` — Simple Zustand store pattern
- `/Users/worker/froggo-dashboard/src/components/writing/FeedbackPopover.tsx` — `buildPrompt()` function where memory context will be injected
- `/Users/worker/froggo-dashboard/src/components/writing/ProjectEditor.tsx` — Layout where context panel will be added
- `/Users/worker/froggo-dashboard/src/components/writing/ChapterSidebar.tsx` — UI pattern for sidebar panel
- `/Users/worker/froggo-dashboard/package.json` — Confirmed all needed packages already installed (zustand 4.5.7, lucide-react, @dnd-kit, zod)

### Secondary (MEDIUM confidence)
- N/A. All research is based on primary codebase analysis.

### Tertiary (LOW confidence)
- N/A. No external sources needed — this phase uses only existing patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries already installed and in use. Zero new dependencies.
- Architecture: HIGH — Follows existing patterns exactly (IPC service, preload bridge, Zustand store, React components). Every pattern has a working precedent in the codebase.
- Pitfalls: HIGH — Identified from direct analysis of existing code patterns and their known edge cases.

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (stable — no external dependencies, all patterns from existing codebase)
