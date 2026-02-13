# Phase 9: Outline & Versions - Research

**Researched:** 2026-02-13
**Domain:** Drag-and-drop reordering, version snapshots, text diffing in Electron/React
**Confidence:** HIGH

## Summary

Phase 9 adds two distinct capabilities: (1) an enhanced chapter sidebar with drag-and-drop reordering and collapsible outline view, and (2) a version snapshot system for chapters with diff comparison. The codebase is well-prepared for both features.

For drag-and-drop, `@dnd-kit` is already installed (`@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@8.0.0`, `@dnd-kit/utilities@3.2.2`) and used in three other components (`SessionsFilter`, `EditPanelsModal`, `FolderTabs`) with established patterns. The existing `ChapterSidebar` renders a sorted chapter list but has no DnD wiring. The backend `reorderChapters()` function in `writing-project-service.ts` already handles file renaming with a safe two-pass temp-file strategy. The store's `reorderChapters(chapterIds)` action and preload bridge `writing:chapter:reorder` are both wired up. This is purely a UI task.

For version snapshots, the project structure already reserves a `versions/` directory per project (created in `createProject()`). The approach is file-copy snapshots: copy the `.md` chapter file into `versions/{chapterId}/{timestamp}.md` with a `versions.json` manifest. For diff display, the `diff` (jsdiff) library provides character/word/line-level diffing with a clean change-object API. A custom diff renderer using existing Tailwind classes is simpler and more consistent than adding `react-diff-viewer-continued` (which drags in `emotion` as a styling dependency).

**Primary recommendation:** Use existing `@dnd-kit` patterns verbatim for DnD. Use `diff` (jsdiff) for computing diffs. Build a simple custom `DiffViewer` component styled with Tailwind. Store version snapshots as file copies with JSON manifest.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@dnd-kit/core` | 6.3.1 | Drag-and-drop framework | Already installed, used in 3 components |
| `@dnd-kit/sortable` | 8.0.0 | Sortable list behavior | Already installed, `verticalListSortingStrategy` pattern established |
| `@dnd-kit/utilities` | 3.2.2 | CSS transform helpers | Already installed, `CSS.Transform.toString()` used throughout |
| `diff` | ^8.0 | Text diffing (jsdiff) | Most widely adopted JS diff library, 7800+ dependents, ships with TypeScript types since v8, small bundle, no extra dependencies |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | 0.303.0 | Icons (GripVertical, History, RotateCcw, GitCompare) | Already installed, used in all writing components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `diff` | `diff-match-patch` | Google's library, more complex API, patch/match features not needed here |
| Custom diff renderer | `react-diff-viewer-continued` | Pre-built split/unified views but adds `emotion` dependency, styling conflicts with Tailwind, overkill for prose diff |
| File-copy snapshots | Git-based versioning | Complex, requires git binary, overkill for V1 manual snapshots |

**Installation:**
```bash
npm install diff
```

Only one new dependency needed. Everything else is already installed.

## Architecture Patterns

### Recommended Project Structure
```
electron/
├── writing-project-service.ts    # EXISTING — add reorderChapters (already done), version ops
├── writing-version-service.ts    # NEW — version snapshot CRUD + diff computation
├── paths.ts                      # ADD writingVersionsPath() helper
└── preload.ts                    # ADD writing.version.* bridge methods

src/
├── store/
│   ├── writingStore.ts           # EXISTING — no changes needed for DnD (reorderChapters exists)
│   └── versionStore.ts           # NEW — version list, active comparison, restore
├── components/writing/
│   ├── ChapterSidebar.tsx        # MODIFY — wrap list in DndContext/SortableContext
│   ├── ChapterListItem.tsx       # MODIFY — add useSortable(), GripVertical drag handle
│   ├── VersionPanel.tsx          # NEW — version list + save snapshot button
│   ├── VersionDiff.tsx           # NEW — side-by-side or inline diff display
│   └── ProjectEditor.tsx         # MODIFY — add version panel toggle/display
```

### Pattern 1: DnD Sortable List (Established in Codebase)
**What:** Wrap existing list in DndContext + SortableContext, add useSortable to items
**When to use:** Any reorderable list
**Example:**
```typescript
// Source: Established pattern from EditPanelsModal.tsx (lines 3-18, 80-100)
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// In the sortable item:
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chapter.id });
const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  zIndex: isDragging ? 50 : undefined,
};
// Separate drag handle: spread {...attributes} {...listeners} on a GripVertical button, NOT the whole item
// This allows clicking to select while only dragging from the handle

// In the container:
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);

const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (over && active.id !== over.id) {
    const oldIndex = chapters.findIndex(c => c.id === active.id);
    const newIndex = chapters.findIndex(c => c.id === over.id);
    const newOrder = arrayMove(chapters, oldIndex, newIndex);
    reorderChapters(newOrder.map(c => c.id));
  }
};
```

### Pattern 2: File-Copy Version Snapshots
**What:** Copy chapter .md file to versions dir, maintain JSON manifest
**When to use:** Before major edits, user-triggered save points

Storage layout:
```
{projectDir}/
  versions/
    {chapterId}/
      versions.json          # [{id, label, createdAt, filename, wordCount}]
      v-{timestamp}.md       # Snapshot content copy
```

```typescript
// In writing-version-service.ts:
interface VersionMeta {
  id: string;           // "ver-{timestamp}-{rand}"
  chapterId: string;
  label: string;        // User-provided or auto "Snapshot YYYY-MM-DD HH:mm"
  createdAt: string;    // ISO timestamp
  filename: string;     // "v-{timestamp}.md"
  wordCount: number;
}

async function saveVersionSnapshot(projectId: string, chapterId: string, label?: string) {
  // 1. Read current chapter content from chapters/ dir
  // 2. Generate version ID and filename
  // 3. Copy content to versions/{chapterId}/v-{timestamp}.md
  // 4. Append to versions/{chapterId}/versions.json
  // 5. Return version metadata
}
```

### Pattern 3: IPC Service Registration (Established)
**What:** Dedicated service file with `registerXxxHandlers()` export
**When to use:** All new IPC handler groups
**Example:**
```typescript
// writing-version-service.ts
export function registerWritingVersionHandlers() {
  ipcMain.handle('writing:version:list', async (_, projectId, chapterId) => ...);
  ipcMain.handle('writing:version:save', async (_, projectId, chapterId, label?) => ...);
  ipcMain.handle('writing:version:read', async (_, projectId, chapterId, versionId) => ...);
  ipcMain.handle('writing:version:restore', async (_, projectId, chapterId, versionId) => ...);
  ipcMain.handle('writing:version:delete', async (_, projectId, chapterId, versionId) => ...);
  ipcMain.handle('writing:version:diff', async (_, projectId, chapterId, versionIdA, versionIdB?) => ...);
  console.log('[writing-version] IPC handlers registered');
}

// main.ts — add import and call registerWritingVersionHandlers()
```

### Pattern 4: Diff Computation (Backend)
**What:** Compute diffs in Electron main process, send serializable result to renderer
**When to use:** Version comparison
**Example:**
```typescript
import { diffWords } from 'diff';

// Diff between a saved version and current content (or two versions)
async function computeDiff(projectId: string, chapterId: string, versionIdA: string, versionIdB?: string) {
  const contentA = await readVersionContent(projectId, chapterId, versionIdA);
  const contentB = versionIdB
    ? await readVersionContent(projectId, chapterId, versionIdB)
    : await readCurrentChapterContent(projectId, chapterId);

  const changes = diffWords(contentA, contentB);
  // changes: Array<{ value: string, added?: boolean, removed?: boolean, count?: number }>
  return { success: true, changes, labelA: '...', labelB: '...' };
}
```

### Pattern 5: Custom Diff Renderer (Tailwind)
**What:** Render jsdiff change objects with inline Tailwind styling
**When to use:** Displaying version comparisons in the UI
**Example:**
```typescript
// VersionDiff.tsx — inline unified diff (prose-friendly)
interface DiffChange {
  value: string;
  added?: boolean;
  removed?: boolean;
}

function DiffViewer({ changes }: { changes: DiffChange[] }) {
  return (
    <div className="prose prose-sm max-w-none text-clawd-text">
      {changes.map((part, i) => (
        <span
          key={i}
          className={
            part.added   ? 'bg-green-900/30 text-green-300' :
            part.removed ? 'bg-red-900/30 text-red-300 line-through' :
            ''
          }
        >
          {part.value}
        </span>
      ))}
    </div>
  );
}
```

### Pattern 6: Collapsible Outline (ChapterSidebar Enhancement)
**What:** The "collapsible chapter tree" from OUT-01 in context of flat chapters means: the ChapterSidebar becomes a toggleable outline view. Chapters are flat (no nesting) — "collapsible" means the sidebar section can collapse/expand, and each chapter shows a summary (title + word count) that can expand to show more detail.
**When to use:** OUT-01 requirement

The current `ChapterSidebar` already shows title + word count per chapter. To satisfy OUT-01:
- Make the chapter list section collapsible (chevron toggle)
- Chapters remain flat (no sections/groups needed for V1)
- The sidebar itself IS the outline view — no separate "outline" component needed
- Adding a drag handle (GripVertical) per item completes the outline/reorder UX

### Anti-Patterns to Avoid
- **Nesting chapters prematurely:** The schema is flat (array of chapters). Don't add sections/parts hierarchy for V1. OUT-01 says "collapsible chapter tree" which is satisfied by a collapsible list — not a tree data structure.
- **Computing diffs on renderer:** TipTap HTML content can be large. Run `diffWords()` in the main process and send serialized results to the renderer. Keeps the UI responsive.
- **Storing diffs instead of snapshots:** File copies are simple, debuggable, and allow restoring without replay. Storing only diffs requires computing the full content from a chain of diffs (fragile, slow for many versions).
- **Auto-versioning on every save:** Autosave fires every 1500ms. Versions must be explicit user actions only, not auto-generated.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop sorting | Custom mouse event handlers | `@dnd-kit/sortable` | Accessibility (keyboard), touch support, collision detection, animation — already installed |
| Text diffing algorithm | Custom diff algorithm | `diff` (jsdiff) | Myers algorithm is non-trivial; jsdiff handles edge cases (whitespace, unicode, empty strings) |
| Array reordering | Manual splice/insert | `arrayMove` from `@dnd-kit/sortable` | One-liner, handles edge cases, already used in codebase |
| CSS transforms for drag | Manual style calculation | `CSS.Transform.toString()` from `@dnd-kit/utilities` | Handles browser prefixes, already used in codebase |

**Key insight:** DnD and diffing are both areas where hand-rolling seems tempting ("it's just moving elements" / "it's just string comparison") but the edge cases are numerous and well-solved by existing libraries.

## Common Pitfalls

### Pitfall 1: Drag Handle vs Full-Item Drag
**What goes wrong:** Making the entire ChapterListItem draggable prevents clicking to select the chapter
**Why it happens:** `useSortable` spreads listeners on the whole element by default
**How to avoid:** Put `{...attributes} {...listeners}` only on a dedicated drag handle (GripVertical button), not the outer container. The outer container uses `ref={setNodeRef}` and `style` but NOT the listeners.
**Warning signs:** Can't click to open a chapter after adding DnD

### Pitfall 2: Optimistic UI vs Backend Sync for Reorder
**What goes wrong:** UI reorders instantly but backend fails, leaving inconsistent state
**Why it happens:** `reorderChapters` renames files on disk (two-pass temp file strategy) which can fail
**How to avoid:** The existing pattern calls `await reorderChapters(ids)` then `await openProject(projectId)` to refresh. This is correct — don't add optimistic updates. The operation is fast enough for a chapter list.
**Warning signs:** Chapter list shows different order after page reload

### Pitfall 3: Version Snapshot of Unsaved Content
**What goes wrong:** User clicks "Save Version" but the editor has unsaved changes (1500ms autosave debounce)
**Why it happens:** The chapter content on disk may be stale if autosave hasn't fired yet
**How to avoid:** Before saving a version snapshot, flush the editor's pending save first. Call `flushSave()` or `saveChapter(currentContent)` before creating the version.
**Warning signs:** Restored version doesn't match what user saw when they saved it

### Pitfall 4: TipTap HTML Diff Noise
**What goes wrong:** Diffing raw HTML produces noisy results with tag differences that aren't content changes
**Why it happens:** TipTap stores content as HTML; minor formatting changes produce different HTML
**How to avoid:** Strip HTML tags before diffing (extract text content only) or diff at the TipTap JSON document level. For V1, stripping tags with a simple regex or using `editor.getText()` equivalent is sufficient for prose comparison.
**Warning signs:** Diff shows `<p>` and `</p>` as changes when only text changed

### Pitfall 5: Large Version Accumulation
**What goes wrong:** Users save many versions, disk usage grows unbounded
**Why it happens:** No limit on version count per chapter
**How to avoid:** For V1, add a soft limit in the UI (show warning after ~20 versions per chapter) and a delete button per version. Don't auto-prune — that loses user data.
**Warning signs:** `versions/` directory grows to hundreds of MB

## Code Examples

### Example 1: Sortable ChapterListItem (Verified pattern from EditPanelsModal.tsx)
```typescript
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';

interface SortableChapterItemProps {
  chapter: WritingChapter;
  isActive: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}

export default function SortableChapterItem({ chapter, isActive, onSelect, onRename, onDelete }: SortableChapterItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chapter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center ${isDragging ? 'shadow-lg' : ''}`}>
      {/* Drag handle — only this triggers drag */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-clawd-text-dim hover:text-clawd-text cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
        aria-label={`Drag to reorder ${chapter.title}`}
      >
        <GripVertical size={14} />
      </button>
      {/* Clickable chapter content — triggers selection, NOT drag */}
      <button onClick={onSelect} className={`flex-1 text-left px-2 py-2 ...`}>
        ...
      </button>
    </div>
  );
}
```

### Example 2: DndContext in ChapterSidebar (Verified pattern from FolderTabs.tsx)
```typescript
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

// Inside ChapterSidebar:
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);

const handleDragEnd = async (event: DragEndEvent) => {
  const { active, over } = event;
  if (over && active.id !== over.id) {
    const oldIndex = chapters.findIndex(c => c.id === active.id);
    const newIndex = chapters.findIndex(c => c.id === over.id);
    const newOrder = arrayMove(chapters, oldIndex, newIndex);
    await reorderChapters(newOrder.map(c => c.id));
  }
};

// In JSX:
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={chapters.map(c => c.id)} strategy={verticalListSortingStrategy}>
    {chapters.map((chapter) => (
      <SortableChapterItem key={chapter.id} chapter={chapter} ... />
    ))}
  </SortableContext>
</DndContext>
```

### Example 3: Version Service IPC (Following writing-project-service.ts pattern)
```typescript
// electron/writing-version-service.ts
import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { writingProjectPath, writingChapterPath } from './paths';
import { diffWords } from 'diff';

interface VersionMeta {
  id: string;
  chapterId: string;
  label: string;
  createdAt: string;
  filename: string;
  wordCount: number;
}

function versionsDir(projectId: string, chapterId: string): string {
  return path.join(writingProjectPath(projectId), 'versions', chapterId);
}

function versionsJsonPath(projectId: string, chapterId: string): string {
  return path.join(versionsDir(projectId, chapterId), 'versions.json');
}

async function saveSnapshot(projectId: string, chapterId: string, label?: string) {
  // Read current chapter content
  const chaptersJson = await readJson(path.join(writingProjectPath(projectId), 'chapters.json'));
  const chapter = chaptersJson.find(c => c.id === chapterId);
  if (!chapter) return { success: false, error: 'Chapter not found' };

  const content = await fs.promises.readFile(
    writingChapterPath(projectId, chapter.filename), 'utf-8'
  );

  const now = new Date();
  const id = `ver-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const filename = `v-${Date.now()}.md`;
  const autoLabel = label || `Snapshot ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

  const dir = versionsDir(projectId, chapterId);
  await fs.promises.mkdir(dir, { recursive: true });

  // Write snapshot file
  await fs.promises.writeFile(path.join(dir, filename), content, 'utf-8');

  // Update manifest
  let versions: VersionMeta[] = [];
  try { versions = JSON.parse(await fs.promises.readFile(versionsJsonPath(projectId, chapterId), 'utf-8')); } catch {}

  const meta: VersionMeta = {
    id, chapterId, label: autoLabel, createdAt: now.toISOString(),
    filename, wordCount: content.trim().split(/\s+/).filter(Boolean).length,
  };
  versions.push(meta);
  await fs.promises.writeFile(versionsJsonPath(projectId, chapterId), JSON.stringify(versions, null, 2), 'utf-8');

  return { success: true, version: meta };
}
```

### Example 4: Diff Computation (Using jsdiff)
```typescript
import { diffWords, Change } from 'diff';

// Strip HTML for cleaner prose diffs
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

async function computeDiff(projectId: string, chapterId: string, versionId: string): Promise<{
  success: boolean;
  changes?: Change[];
  versionLabel?: string;
}> {
  // Read version content
  const dir = versionsDir(projectId, chapterId);
  const versions: VersionMeta[] = JSON.parse(await fs.promises.readFile(path.join(dir, 'versions.json'), 'utf-8'));
  const version = versions.find(v => v.id === versionId);
  if (!version) return { success: false };

  const versionContent = await fs.promises.readFile(path.join(dir, version.filename), 'utf-8');

  // Read current chapter content
  const chaptersJson = await readJson(path.join(writingProjectPath(projectId), 'chapters.json'));
  const chapter = chaptersJson.find(c => c.id === chapterId);
  if (!chapter) return { success: false };
  const currentContent = await fs.promises.readFile(
    writingChapterPath(projectId, chapter.filename), 'utf-8'
  );

  // Strip HTML and diff as prose
  const changes = diffWords(stripHtml(versionContent), stripHtml(currentContent));
  return { success: true, changes, versionLabel: version.label };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-beautiful-dnd` | `@dnd-kit` | 2023+ | react-beautiful-dnd deprecated, dnd-kit is the standard |
| `diff-match-patch` (Google) | `diff` (jsdiff) v8+ | 2024 | jsdiff ships TS types natively since v8, simpler API for text-only use cases |
| `react-diff-viewer` | `react-diff-viewer-continued` | 2023 | Original unmaintained; continued fork is active. But for prose (not code) a custom renderer is often better |

**Deprecated/outdated:**
- `react-beautiful-dnd`: Atlassian deprecated it in favor of Pragmatic Drag and Drop, but `@dnd-kit` is the React community standard and already in this codebase
- `@types/diff`: No longer needed as of jsdiff v8 (ships own types)

## Open Questions

1. **HTML vs plain text for version snapshots**
   - What we know: TipTap stores content as HTML. Current `saveChapter()` writes HTML to `.md` files. Version snapshots should copy this same HTML.
   - What's unclear: Should we diff HTML or strip to plain text first? HTML diffs are noisy but preserve formatting info.
   - Recommendation: Store snapshots as HTML (same as chapter files). Strip HTML before diffing for display. If restore is needed, restore the HTML version directly. This gives clean diffs for reading while preserving full fidelity for restore.

2. **Collapsible tree depth**
   - What we know: Chapters are flat (no nesting). OUT-01 says "collapsible chapter tree."
   - What's unclear: Does the user want sections/parts grouping?
   - Recommendation: V1 treats "collapsible" as the sidebar list being collapsible (expand/collapse toggle). The "tree" is a flat chapter list with position numbers. Add sections/parts in a future phase if needed.

3. **Version-to-version diff vs version-to-current**
   - What we know: OUT-05 says "shows differences between versions."
   - What's unclear: Between any two versions, or always compared to current?
   - Recommendation: Default to comparing a selected version against the current content (most common use case). Allow selecting two versions to compare as an advanced option.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@8.0.0`, `@dnd-kit/utilities@3.2.2` already installed and used in `SessionsFilter.tsx`, `EditPanelsModal.tsx`, `FolderTabs.tsx`
- Codebase inspection: `electron/writing-project-service.ts` — `reorderChapters()` already implemented with two-pass temp-file rename strategy
- Codebase inspection: `versions/` directory already created in `createProject()`, reserved for Phase 9
- [jsdiff GitHub repository](https://github.com/kpdecker/jsdiff) — API documentation, Change object structure

### Secondary (MEDIUM confidence)
- [npm: diff-match-patch](https://www.npmjs.com/package/diff-match-patch) — Alternative diffing library comparison
- [npm: react-diff-viewer-continued](https://www.npmjs.com/package/react-diff-viewer-continued) — v4.1.2, uses emotion, actively maintained
- [npm compare: diff libraries](https://npm-compare.com/deep-diff,diff,diff-match-patch,diff2html,react-diff-view) — Ecosystem comparison showing jsdiff as most adopted

### Tertiary (LOW confidence)
- None. All critical findings verified through codebase inspection and official repositories.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - dnd-kit already installed and used in codebase, jsdiff is the dominant text diff library
- Architecture: HIGH - follows established patterns from 4 prior writing phases (service files, preload bridge, Zustand stores, Tailwind components)
- Pitfalls: HIGH - drag handle vs full-item drag is a well-documented dnd-kit concern; unsaved content race condition identified from code inspection of the 1500ms autosave

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (30 days — stable libraries, no breaking changes expected)
