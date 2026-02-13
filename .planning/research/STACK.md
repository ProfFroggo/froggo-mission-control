# Stack Research: Writing System

**Project:** Froggo.app v2.0 — AI-Collaborative Long-Form Writing Module
**Researched:** 2026-02-12
**Overall Confidence:** HIGH (verified via official docs, npm, and multiple sources)

---

## Recommended Additions

| Library | Version | Purpose | Why This One |
|---------|---------|---------|-------------|
| `@tiptap/react` | ^3.19.0 | Rich text editor React bindings | Best DX wrapper over ProseMirror; headless, extensible, proven at scale |
| `@tiptap/pm` | ^3.19.0 | ProseMirror peer dependency | Required by TipTap |
| `@tiptap/starter-kit` | ^3.19.0 | Core extensions bundle | Includes bold/italic/headings/lists/code/link/underline/undo-redo |
| `@tiptap/markdown` | ^3.19.0 | Bidirectional markdown parsing | Official TipTap extension, MIT-licensed, CommonMark-compliant |
| `@tiptap/extension-highlight` | ^3.19.0 | Text highlighting marks | Built-in multi-color highlight — foundation for inline feedback anchors |
| `@tiptap/extension-table-of-contents` | ^3.19.0 | Heading navigation/outline | Auto-updating TOC from headings, smooth scroll, sidebar-ready |
| `@tiptap/extension-placeholder` | ^3.19.0 | Empty editor placeholder text | UX polish for empty chapters |
| `@tiptap/extension-character-count` | ^3.19.0 | Word/character counting | Required for word count goals and progress tracking |
| `@tiptap/extension-typography` | ^3.19.0 | Smart typography | Auto-converts quotes, dashes, ellipses — expected in a writing tool |
| `diff` | ^8.0.3 | Text diffing engine | Ships with TypeScript types (v8+), 7800+ dependents, battle-tested |
| `react-diff-viewer-continued` | ^4.1.2 | Side-by-side diff UI component | Actively maintained fork, split/unified views, customizable styling |
| `chokidar` | ^4.0.3 | File system watching | Needed for detecting external edits to chapter .md files |

**Total new dependencies: 12** (10 TipTap packages from same ecosystem + 2 utility libs)

### Installation

```bash
# TipTap editor ecosystem
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/markdown \
  @tiptap/extension-highlight @tiptap/extension-table-of-contents \
  @tiptap/extension-placeholder @tiptap/extension-character-count \
  @tiptap/extension-typography

# Diffing and comparison
npm install diff react-diff-viewer-continued

# File watching (renderer needs none — this is Electron main process only)
npm install chokidar
```

---

## Rich Text Editor Deep Dive

### Decision: TipTap v3 (not raw ProseMirror, not Slate, not Lexical)

**Confidence: HIGH** — verified via official TipTap docs, npm registry, GitHub releases, and multiple comparison analyses.

### Why TipTap Over Raw ProseMirror

TipTap is built on ProseMirror. Every ProseMirror capability is available through TipTap, but TipTap wraps it with a developer-friendly API. The relationship is analogous to React wrapping the DOM — you can always drop down to the lower level when needed.

**What TipTap adds over raw ProseMirror:**
- `useEditor` and `useEditorState` React hooks (native React integration)
- Extension system (modular, composable, configurable)
- `ReactMarkViewRenderer` and `ReactNodeViewRenderer` for rendering React components inline
- Built-in commands API (`editor.commands.setHighlight()`, etc.)
- Event system (`onSelectionUpdate`, `onUpdate`, `onTransaction`)
- Declarative `<Tiptap>` component (new in v3.18.0)

**What you'd have to build yourself with raw ProseMirror:**
- React bindings
- Extension registration system
- Command chaining
- Every built-in extension (bold, italic, heading, lists, etc.)
- Plugin boilerplate for every feature

**Verdict:** Using raw ProseMirror for this project would mean writing 2000+ lines of glue code that TipTap already provides. ProseMirror knowledge is still useful for custom extensions — TipTap doesn't hide it.

### Why TipTap Over Slate

- Slate has a slower release cycle and fewer maintained plugins
- Slate's React integration requires more manual wiring
- Slate lacks a built-in markdown extension
- TipTap's extension ecosystem covers more of what we need out of the box
- Slate's documentation is sparser

### Why TipTap Over Lexical (Meta)

- Lexical has a steeper learning curve (everything is tree nodes)
- Lexical's ecosystem is less mature (needs more time to catch Tiptap)
- Lexical's markdown support is less developed
- Lexical's main advantage (Facebook-scale perf) is irrelevant for single-user desktop app
- TipTap's React integration is more natural for an existing React codebase

### TipTap v3 Key Capabilities (Verified)

**Selection Tracking:**
```typescript
editor.on('selectionUpdate', ({ editor }) => {
  const { from, to } = editor.state.selection;
  const selectedText = editor.state.doc.textBetween(from, to);
  // Use from/to to anchor floating feedback panel
});
```
Confidence: HIGH (verified from official TipTap events documentation)

**Inline Widgets via React Mark Views:**
```typescript
import { Mark } from '@tiptap/core';
import { ReactMarkViewRenderer } from '@tiptap/react';
import FeedbackAnchor from './FeedbackAnchor';

export const InlineFeedback = Mark.create({
  name: 'inlineFeedback',
  addAttributes() {
    return {
      feedbackId: { default: null },
      agentId: { default: null },
    };
  },
  addMarkView() {
    return ReactMarkViewRenderer(FeedbackAnchor);
  },
});
```
Confidence: HIGH (verified from official TipTap React mark views documentation)

**Markdown Round-Trip:**
TipTap's `@tiptap/markdown` extension uses MarkedJS internally. Flow: Markdown string -> MarkedJS Lexer -> tokens -> extension parse handlers -> TipTap JSON. Reverse: TipTap JSON -> extension render handlers -> Markdown string. CommonMark-compliant. MIT-licensed. Currently in beta but functional.

Note: The extension is in **early release/beta** — edge cases may exist. For this project, chapters are straightforward markdown (headings, paragraphs, bold/italic, lists, blockquotes, code blocks). No exotic markdown features needed, so beta status is acceptable.

Confidence: MEDIUM (official docs confirm capability, but beta status means edge cases possible)

**Large Document Performance:**
TipTap's official performance demo handles 200,000+ words without performance drops. Key React optimizations:
1. Isolate editor in its own component (prevent re-renders from sidebar state changes)
2. Use `shouldRerenderOnTransaction: false` to prevent re-rendering on every keystroke
3. Use `useEditorState` with selectors for toolbar state (bold active?, italic active?)
4. Set `immediatelyRender: true` for initial render

Since chapters are loaded individually (not the entire 1000-page document at once), even a 10,000-word chapter is well within TipTap's proven performance range.

Confidence: HIGH (verified from official TipTap performance guide)

### StarterKit Contents (What You Get Free)

The `@tiptap/starter-kit` bundles these extensions:

**Nodes:** Document, Paragraph, Text, Heading, Blockquote, BulletList, OrderedList, ListItem, CodeBlock, HorizontalRule, HardBreak

**Marks:** Bold, Italic, Strike, Code, Link, Underline

**Functionality:** Dropcursor, Gapcursor, Undo/Redo (History), ListKeymap, TrailingNode

Link and Underline are new additions in v3. This covers all the basic formatting needs for a writing editor.

### Additional Extensions Needed (Beyond StarterKit)

| Extension | Why |
|-----------|-----|
| `@tiptap/markdown` | Core requirement: load/save chapters as .md files |
| `@tiptap/extension-highlight` | Foundation for inline feedback anchors (multi-color) |
| `@tiptap/extension-table-of-contents` | Sidebar navigation of headings within a chapter |
| `@tiptap/extension-placeholder` | "Start writing..." UX when chapter is empty |
| `@tiptap/extension-character-count` | Word count display for chapters |
| `@tiptap/extension-typography` | Smart quotes, em-dashes — expected in a writing tool |
| Custom: `InlineFeedback` mark | Custom mark extension for feedback anchors (built by us) |

### Extensions We Do NOT Need

| Extension | Why Not |
|-----------|---------|
| `@tiptap/extension-collaboration` | Single-user. No CRDT/Yjs needed. |
| `@tiptap/extension-table` | Memoirs/novels don't need tables |
| `@tiptap/extension-image` | Images are out of scope for text-focused MVP |
| `@tiptap/extension-mention` | No @mention system needed in writing editor |
| `@tiptap/extension-color` / `@tiptap/extension-text-style` | Not needed for writing — highlight extension covers annotation colors |
| Any TipTap Cloud/Pro extensions | Local-only app, no cloud services |

---

## Text Diffing: `diff` + `react-diff-viewer-continued`

### Why Two Libraries

The diffing need has two parts:
1. **Compute the diff** between original text and AI alternative (logic layer)
2. **Display the diff** side-by-side in the UI (presentation layer)

### `diff` (jsdiff) v8.0.3

**What it does:** Computes text diffs at character, word, line, or sentence level. Returns structured change objects.

**Why this one:**
- 7,800+ npm dependents (most widely used JS diff library)
- Ships with TypeScript types since v8 (no `@types/diff` needed)
- Supports async/abortable mode for large diffs
- `diffWords()` is perfect for showing what changed between original and AI alternative
- Published 1 month ago (actively maintained)
- Zero dependencies

**How we'll use it:**
```typescript
import { diffWords } from 'diff';

const changes = diffWords(originalText, aiAlternative);
// changes = [{ value: "Sarah ", added: false, removed: false },
//            { value: "walked", removed: true },
//            { value: "stormed", added: true }, ...]
```

Confidence: HIGH (verified via npm, GitHub)

### `react-diff-viewer-continued` v4.1.2

**What it does:** React component that renders side-by-side or unified diff views with syntax highlighting support.

**Why this one over alternatives:**
- `react-diff-viewer` (original): Last published 6 years ago, unmaintained
- `react-diff-viewer-continued`: Last published 5 days ago, actively maintained
- `react-diff-view`: More git-oriented (unified diff format input), heavier
- `diff2html`: Not React-native, requires extra integration

**How we'll use it:** Side-by-side comparison when AI generates alternative versions of a highlighted passage. User sees original on left, alternative on right, with changes highlighted.

Confidence: HIGH (verified via npm)

---

## File System Watching: `chokidar` v4.0.3

### Why Chokidar (Not Native fs.watch, Not Chokidar v5)

**The need:** Detect when chapter .md files are edited externally (user opens in VS Code, another agent writes to the file). The editor should reload or prompt.

**Why not native `fs.watch`:**
- Unreliable event types (reports most changes as "rename")
- Does not report filenames on macOS
- Recursive watching not supported on Linux
- No debouncing, no ready event, no error handling
- Would need to build all the reliability features chokidar already has

**Why chokidar v4, not v5:**
- v5 (Nov 2025) is **ESM-only**, requires Node.js v20+
- Electron 28's main process uses **CommonJS** (`tsconfig.electron.json` has `"module": "CommonJS"`)
- v4 supports both ESM and CommonJS
- v4 has minimal dependencies (reduced from 13 to 1)
- v4 requires Node.js v14+ (Electron 28 ships Node.js 18.x, well above this)

**How we'll use it:** In the Electron main process, watch the project's `chapters/` directory. On file change, notify renderer via IPC so the editor can reload or show a "file changed externally" prompt.

```typescript
// electron/writing-service.ts
import { watch } from 'chokidar';

const watcher = watch(chaptersDir, {
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 500 },
});

watcher.on('change', (filePath) => {
  mainWindow.webContents.send('chapter:external-change', { filePath });
});
```

Confidence: HIGH (verified CommonJS requirement from tsconfig, chokidar v4 compatibility from npm/GitHub)

---

## SQLite Schema Patterns (Source/Citation Management)

No new library needed — the project already has `better-sqlite3` v12.6.2.

### Recommended Schema for Sources Database

Each writing project gets its own SQLite database at `{project}/research/sources.db`. This keeps project data isolated and portable.

```sql
-- Sources: books, articles, interviews, websites
CREATE TABLE sources (
  id TEXT PRIMARY KEY,        -- UUID
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,          -- 'book', 'article', 'interview', 'website', 'personal'
  title TEXT NOT NULL,
  author TEXT,
  url TEXT,
  publication_date TEXT,       -- ISO 8601
  accessed_date TEXT,          -- When last accessed
  notes TEXT,                  -- Markdown notes about source
  reliability TEXT DEFAULT 'unverified',  -- 'verified', 'unverified', 'disputed'
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Facts: individual claims extracted from sources
CREATE TABLE facts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  claim TEXT NOT NULL,          -- The factual assertion
  source_id TEXT REFERENCES sources(id),
  chapter_refs TEXT,            -- JSON array of chapter filenames where used
  status TEXT DEFAULT 'unverified',  -- 'verified', 'disputed', 'retracted'
  verified_by TEXT,             -- Agent that verified (researcher, user)
  verified_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Fact-chapter links: many-to-many
CREATE TABLE fact_chapter_links (
  fact_id TEXT REFERENCES facts(id),
  chapter_filename TEXT NOT NULL,
  text_range_start INTEGER,    -- Character offset in chapter
  text_range_end INTEGER,
  PRIMARY KEY (fact_id, chapter_filename)
);

-- Research notes: organized by topic
CREATE TABLE research_notes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,        -- Markdown
  source_ids TEXT,              -- JSON array of related source IDs
  chapter_refs TEXT,            -- JSON array of related chapters
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX idx_facts_status ON facts(status);
CREATE INDEX idx_facts_source ON facts(source_id);
CREATE INDEX idx_fcl_chapter ON fact_chapter_links(chapter_filename);
CREATE INDEX idx_notes_topic ON research_notes(topic);
```

### Why Per-Project SQLite (Not Main froggo.db)

- **Isolation:** Each writing project is self-contained and portable
- **No schema pollution:** Writing tables don't clutter the 173-table froggo.db
- **Backup/export:** Copy project folder = complete backup
- **Parallel access:** No contention with task DB queries

Confidence: HIGH (better-sqlite3 is already in the stack, schema is straightforward)

---

## Integration Notes

### How These Fit With the Existing Stack

**React 18 + TipTap 3:** TipTap v3 supports React 18. The `useEditor` hook and new `<Tiptap>` declarative component work with React's rendering model. No conflicts with existing Zustand stores or component patterns.

**TypeScript:** TipTap v3 ships with full TypeScript types. `diff` v8 ships with built-in types. `react-diff-viewer-continued` has TypeScript support. No `@types/*` packages needed for any of the new dependencies.

**Vite:** TipTap is standard npm package, no special Vite configuration needed. Works with the existing `@vitejs/plugin-react` setup.

**Tailwind CSS:** TipTap is headless — no built-in styles. All editor styling will be done with Tailwind, matching the existing dashboard aesthetic. This is a feature, not a limitation.

**Zustand:** Editor state (current project, current chapter, feedback threads) should live in a dedicated Zustand store (`useWritingStore`). The TipTap editor instance itself manages document state internally — Zustand manages the application-level writing state around it.

**Electron IPC:** New IPC handlers for writing operations should go in a dedicated `electron/writing-service.ts` file (per the project constraint: "new services in separate electron/*.ts files"). File I/O (read/write chapters, manage project folders) happens in the main process. Chokidar watches in the main process. TipTap runs in the renderer.

**Paths:** All new paths (writing projects directory, project subdirectories) should be defined in `electron/paths.ts` following the existing pattern:
```typescript
export const WRITING_PROJECTS_DIR = path.join(PROJECT_ROOT, 'writing-projects');
```

**better-sqlite3:** Per-project `sources.db` files are opened/closed via the main process, same pattern as `froggo.db`. The existing `database.ts` connection manager pattern can be extended.

### Performance Considerations for Electron

1. **TipTap in renderer, file I/O in main process:** Keep the editor responsive by doing all disk operations through IPC. Never block the renderer with synchronous file reads.

2. **Chapter-level loading:** Only one chapter's content is in the TipTap editor at a time. Switching chapters = save current -> load next. This keeps the editor lightweight regardless of total project size.

3. **Debounce saves:** Auto-save on pause (500ms-1s debounce after last keystroke), not on every keystroke. Write to a temp file first, then atomic rename.

4. **Chokidar in main process only:** File watching runs in the Electron main process. Changes are communicated to the renderer via IPC events.

---

## What NOT to Add

| Library | Why Not |
|---------|---------|
| `@tiptap/extension-collaboration` / `yjs` / `y-prosemirror` | Single-user app. No CRDT needed. Adds significant complexity and bundle size for zero benefit. |
| `marked` / `remark` / `markdown-it` | TipTap's `@tiptap/markdown` uses MarkedJS internally. Don't add a second markdown parser. The existing `react-markdown` in the dashboard is for rendering markdown in chat/task views — keep it there, use TipTap's built-in parsing for the editor. |
| `prosemirror-*` (direct) | TipTap wraps ProseMirror. `@tiptap/pm` re-exports the ProseMirror packages. Don't install ProseMirror packages directly — version conflicts will occur. |
| `draft-js` | Deprecated by Meta in favor of Lexical. Not a contender. |
| `quill` | Monolithic, not headless, poor extensibility for custom inline widgets. |
| `monaco-editor` | Code editor, not a prose editor. Wrong tool. |
| `electron-store` | Not needed — writing project settings go in `project.json` files, structured data in SQLite. The app already manages state fine without it. |
| `lowdb` / `nedb` | Already have better-sqlite3. Don't add a second database engine. |
| `pdf-lib` / `epub-gen` | Out of scope for v2.0 (export deferred to v3). |
| Any vector DB (`chromadb`, `hnswlib`) | Semantic search deferred to v3. SQLite FTS5 can handle keyword search for now. |

---

## Version Pinning Notes

All TipTap packages should use the same version constraint (`^3.19.0`) to avoid peer dependency conflicts. TipTap publishes all packages in lockstep — mixing versions causes subtle breakage.

The `diff` and `react-diff-viewer-continued` packages are independent and can be versioned separately.

Chokidar v4 specifically (not v5) due to the CommonJS requirement in the Electron main process.

---

## Sources

- [TipTap Official Documentation](https://tiptap.dev/docs)
- [TipTap React Installation Guide](https://tiptap.dev/docs/editor/getting-started/install/react)
- [TipTap Performance Guide](https://tiptap.dev/docs/guides/performance)
- [TipTap StarterKit Extensions](https://tiptap.dev/docs/editor/extensions/functionality/starterkit)
- [TipTap Markdown Extension](https://tiptap.dev/docs/editor/markdown)
- [TipTap Highlight Extension](https://tiptap.dev/docs/editor/extensions/marks/highlight)
- [TipTap React Mark Views](https://tiptap.dev/docs/editor/extensions/custom-extensions/mark-views/react)
- [TipTap Events API](https://tiptap.dev/docs/editor/api/events)
- [TipTap Table of Contents Extension](https://tiptap.dev/docs/editor/extensions/functionality/table-of-contents)
- [TipTap v3.0 Stable Release](https://tiptap.dev/blog/release-notes/tiptap-3-0-is-stable)
- [TipTap 2026 Roadmap](https://tiptap.dev/blog/release-notes/our-roadmap-for-2026)
- [TipTap GitHub Releases](https://github.com/ueberdosis/tiptap/releases) — v3.19.0, Feb 3 2026
- [@tiptap/markdown on npm](https://www.npmjs.com/package/@tiptap/markdown) — v3.19.0
- [diff (jsdiff) on npm](https://www.npmjs.com/package/diff) — v8.0.3
- [react-diff-viewer-continued on npm](https://www.npmjs.com/package/react-diff-viewer-continued) — v4.1.2
- [chokidar on npm](https://www.npmjs.com/package/chokidar) — v4.0.3 (CJS+ESM), v5.0 (ESM-only)
- [chokidar GitHub](https://github.com/paulmillr/chokidar)
- [Liveblocks Rich Text Editor Comparison 2025](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025)
- [ProseMirror DecorationSet in React](https://medium.com/@faisalmujtaba/prosemirror-decorationset-in-react-everything-i-wish-someone-had-told-me-6262eabae7ca)

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| TipTap as editor choice | HIGH | Verified via official docs, npm, multiple comparison analyses, v3.19.0 confirmed current |
| TipTap selection tracking | HIGH | Verified from official events API documentation |
| TipTap React mark views | HIGH | Verified from official custom extensions documentation |
| TipTap markdown support | MEDIUM | Official extension exists and is MIT-licensed, but labeled "beta/early release" |
| `diff` library | HIGH | v8.0.3 verified on npm, built-in TypeScript types confirmed |
| `react-diff-viewer-continued` | HIGH | v4.1.2 verified on npm, published 5 days ago |
| Chokidar v4 (not v5) | HIGH | CommonJS requirement verified from tsconfig.electron.json, v4 CJS support confirmed |
| SQLite schema design | HIGH | Standard relational patterns, uses existing better-sqlite3 |
| Performance claims | MEDIUM | TipTap claims 200k+ words; our use case (single chapter at a time) is well within this, but not independently benchmarked |
