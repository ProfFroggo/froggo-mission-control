# Pitfalls Research: AI Writing System for Froggo Dashboard

**Domain:** AI-collaborative long-form writing module (memoirs/novels) inside existing Electron dashboard
**Researched:** 2026-02-12
**Overall Confidence:** HIGH (verified against existing codebase, TipTap GitHub issues, Electron docs)

---

## Critical Pitfalls (will definitely bite you)

### C1: TipTap Memory Leak on Editor Destroy (React)

**What goes wrong:** TipTap stores `dom.editor = this` on the root DOM element, creating a circular reference that prevents garbage collection when the editor is destroyed. In a dashboard where users navigate between writing and other panels, the editor component mounts/unmounts repeatedly. Each mount leaks the entire editor instance, ProseMirror state, and document content. With 10k+ word chapters, this means tens of megabytes leaked per navigation.

**Warning signs:**
- Memory usage climbs steadily as user switches between Writing panel and other panels (Kanban, Chat, etc.)
- Electron renderer process exceeds 500MB after 30 minutes of use
- `performance.memory.usedJSHeapSize` grows monotonically

**Prevention:**
- Use TipTap v2.5+ which includes the fix (commit: "fix(core): dereference editor from DOM element on destroy")
- Always call `editor.destroy()` in React `useEffect` cleanup
- Verify with a test: mount editor, unmount, force GC, check heap snapshot -- the editor should be collected
- Consider keeping the editor mounted but hidden (CSS `display: none`) rather than unmounting when switching panels, to avoid the mount/unmount cycle entirely

**Which phase:** Phase 1 (Foundation). Get this right from day one or every later phase compounds the leak.

**Confidence:** HIGH -- verified via [TipTap issue #5654](https://github.com/ueberdosis/tiptap/issues/5654) and [issue #538](https://github.com/ueberdosis/tiptap/issues/538)

---

### C2: TipTap + React Re-render Storm Kills Typing Performance

**What goes wrong:** By default, TipTap re-renders the React component tree on EVERY transaction -- every keystroke, every caret movement, every selection change. In the existing dashboard, store.ts (1347 lines) uses Zustand with a flat structure. If the writing module's state (current chapter, cursor position, word count, AI feedback panel state) lands in the same store, a keystroke in the editor triggers re-renders across unrelated dashboard components. On a 10k-word chapter, typing becomes visibly laggy (1s+ per keystroke reported in [issue #4491](https://github.com/ueberdosis/tiptap/issues/4491)).

**Warning signs:**
- Typing lag that gets worse as document grows
- React DevTools showing 50+ component re-renders per keystroke
- CPU spikes on every keypress in the Performance tab

**Prevention:**
- Set `shouldRerenderOnTransaction: false` on the TipTap editor (default in v3.0+, must be explicit in v2.x)
- Use `useEditorState()` hook for components that need editor state, not the editor instance directly
- Create a SEPARATE Zustand store for writing state (`useWritingStore`) -- do NOT merge into existing `store.ts`
- Use Zustand selectors everywhere: `useWritingStore(s => s.wordCount)` not `useWritingStore()`
- Avoid `ReactNodeViewRenderer` for custom nodes if possible -- it creates React-managed DOM nodes inside ProseMirror's DOM, which is expensive at scale

**Which phase:** Phase 1 (Foundation). Architecture decision that cannot be retrofitted.

**Confidence:** HIGH -- verified via [TipTap performance docs](https://tiptap.dev/docs/guides/performance), [React performance demo](https://tiptap.dev/docs/examples/advanced/react-performance), [TipTap 2.5 release notes](https://tiptap.dev/blog/release-notes/say-hello-to-tiptap-2-5-our-most-performant-editor-yet)

---

### C3: Adding More IPC Handlers to the 7451-Line main.ts Monolith

**What goes wrong:** `electron/main.ts` is already 7451 lines with 238 `ipcMain` references. The writing module needs file operations (read/write chapters, version management, project metadata), AI streaming, and autosave -- easily 30-50 more IPC handlers. Adding these to main.ts makes it even harder to maintain, increases the chance of naming collisions (e.g., `fs:readFile` already exists in preload.ts for a different purpose), and makes the file nearly impossible to review in PRs.

**Warning signs:**
- main.ts exceeds 8000 lines
- Multiple developers can't work on Electron handlers without merge conflicts
- Debugging any IPC issue requires reading through thousands of lines
- Handler naming starts getting creative to avoid collisions (`writing:fs:readFile` vs `fs:readFile`)

**Prevention:**
- Create `electron/writing-service.ts` as a separate module with all writing-related IPC handlers
- Register handlers from main.ts with a single import: `import { registerWritingHandlers } from './writing-service'`
- Follow the existing pattern from `x-automations-service.ts` and `calendar-service.ts` which already use this modular approach
- Namespace all writing IPC channels: `writing:*` prefix

**Which phase:** Phase 1 (Foundation). The module boundary must be established before writing any handlers.

**Confidence:** HIGH -- verified by reading the actual codebase. The pattern already exists (see `registerXAutomationsHandlers` imported in main.ts line 15).

---

### C4: Schema-Enforced Content Loss in Markdown Round-Trips

**What goes wrong:** ProseMirror enforces a strict document schema. Content that doesn't conform to the schema is SILENTLY DROPPED. When converting Markdown to TipTap's internal representation and back, certain constructs get lost: nested formatting (bold inside italic inside link), HTML embedded in markdown, custom syntax, footnotes, some table structures. For a memoir/novel project, losing a paragraph because of an unusual markdown construct is catastrophic.

**Warning signs:**
- User pastes content from another editor and some formatting disappears
- Saving and reopening a chapter produces slightly different content
- Markdown files on disk don't match what the editor shows
- Automated tests comparing "save then load" show diffs

**Prevention:**
- Store content as TipTap JSON (ProseMirror document tree), NOT as markdown. Markdown is for export/import only
- Define the schema up front and test all supported constructs before building features on top
- Write automated roundtrip tests: create document in editor -> serialize -> deserialize -> compare
- When importing markdown, show a preview diff to the user before committing
- Use `@tiptap/pm/markdown` or `tiptap-markdown` for conversion, but treat it as lossy and warn users
- Never auto-convert user's existing markdown files without explicit confirmation

**Which phase:** Phase 1 (Foundation). Storage format is the most fundamental decision and cannot be changed later without data migration.

**Confidence:** HIGH -- verified via [TipTap FAQ](https://tiptap.dev/docs/guides/faq), [TipTap Schema docs](https://tiptap.dev/docs/editor/core-concepts/schema), [tiptap-markdown npm](https://www.npmjs.com/package/tiptap-markdown)

---

## High Risk Pitfalls (likely to encounter)

### H1: AI Streaming Responses Cause Cursor Jumps and Edit Conflicts

**What goes wrong:** When AI generates inline suggestions or rewrites, the streaming response inserts tokens into the document while the user may still be typing nearby. ProseMirror tracks positions as integer offsets from the start of the document. Inserting content at position X shifts all positions after X. If the user's cursor is at position X+50, it jumps to X+50+insertedLength. Worse, if the user types during an AI insertion, their keystroke targets the wrong position.

**Warning signs:**
- User's cursor teleports to unexpected location during AI response
- Characters appear in the wrong place while AI is streaming
- Document corruption: AI output interleaved with user keystrokes
- Undo stack becomes nonsensical (undoing one character undoes an AI paragraph)

**Prevention:**
- NEVER stream AI responses directly into the user's editing position. Use a separate "suggestion panel" or "ghost text" that the user explicitly accepts
- If inserting into the document, use ProseMirror's `Mapping` to track position changes across transactions
- Buffer the complete AI response, then insert atomically as a single transaction
- Use TipTap's built-in `streamContent` command with `updateSelection: false` if streaming is required
- Wrap AI insertions in a distinct transaction group so they undo as a single unit
- Consider a read-only "AI suggestion" mark/decoration that renders inline but isn't part of the editable content until accepted

**Which phase:** Phase 2 (AI Feedback Loop). This is the core interaction and must be designed carefully.

**Confidence:** MEDIUM -- based on ProseMirror position tracking model (well-documented) and [TipTap streamContent API](https://tiptap.dev/docs/content-ai/capabilities/text-generation/stream), but specific implementation details depend on exact UI design.

---

### H2: Context Window Mismanagement for Long Documents

**What goes wrong:** A 1000-page novel is ~250k-500k tokens. Even with Claude's 200k context window, you cannot send the whole book for feedback on a single paragraph. Teams typically make one of two mistakes: (1) send too little context (just the paragraph) and get generic, plot-inconsistent feedback, or (2) send too much context (entire book) and get high latency + high cost + degraded quality (LLMs perform worst on information in the middle of long contexts).

**Warning signs:**
- AI feedback contradicts established character traits or plot points
- AI suggestions are generic ("Show, don't tell") rather than specific to the narrative
- API costs spike because entire chapters are sent for single-sentence feedback
- Response latency exceeds 30 seconds, breaking the writing flow

**Prevention:**
- Build a hierarchical context system: book outline -> chapter summary -> nearby paragraphs -> selected text
- Store per-character, per-location, per-plot-thread summaries in a "memory store" (SQLite table)
- Send context in layers: system prompt (book metadata + character sheet) + RAG (relevant memory entries) + local context (surrounding 2-3 paragraphs) + selected text
- Set a token budget per request (e.g., 8k context + 2k response) and let the context builder prioritize
- Track which context was sent so the user can see "AI knows about: [characters A, B], [chapters 1-3 summary]"
- Let users pin context manually ("Always include this when reviewing chapter 5")

**Which phase:** Phase 3 (Memory & Context). But the data model for memory stores should be designed in Phase 1.

**Confidence:** HIGH -- verified via [context window management research](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/), [Datagrid attention analysis](https://datagrid.com/blog/optimize-ai-agent-context-windows-attention), known LLM "lost in the middle" phenomenon.

---

### H3: SQLite Contention Between Dashboard and Writing Module

**What goes wrong:** The existing `database.ts` opens `froggo.db` (26MB, 173 tables) with WAL mode and a prepared statement cache. Adding writing-related tables (projects, chapters, versions, AI feedback, memory stores) to this same database means: (1) autosave writes from the editor compete with task/session reads from other panels, (2) the external `froggo-db` CLI and `agent-dispatcher` also access this file, creating multi-process write contention, (3) large BLOB columns (chapter content as JSON) bloat the main DB file.

**Warning signs:**
- "database is locked" errors during autosave
- Dashboard panels (Kanban, Chat) stutter when writing module autosaves
- froggo.db grows to 100MB+ due to chapter version history
- WAL checkpoint starvation: `-wal` file grows unbounded because the dashboard holds long-read transactions

**Prevention:**
- Create a SEPARATE database file: `writing.db` in the data directory
- Open it as a separate `better-sqlite3` connection in `database.ts` (follow the lazy pattern used for `scheduleDb` and `securityDb`)
- Keep WAL mode on both databases
- Use transactions for autosave (batch chapter content + metadata in one write)
- Set `busy_timeout` to 5000ms on the writing DB to handle contention gracefully
- Store chapter content as JSON text, not BLOBs -- better for inspection and debugging
- Implement periodic vacuuming for the writing DB (version history accumulates)

**Which phase:** Phase 1 (Foundation). Database architecture must be decided before any data is written.

**Confidence:** HIGH -- verified by reading `database.ts` and understanding the multi-process access pattern (dashboard + froggo-db CLI + dispatcher all touch froggo.db).

---

### H4: Tailwind Preflight CSS Strips Editor Formatting

**What goes wrong:** Tailwind's Preflight CSS reset strips default styling from all HTML elements: headings become unstyled, lists lose bullets, blockquotes lose styling. Inside a rich text editor, this means the user types a heading and it looks identical to body text. The fix is `@tailwindcss/typography` with `prose` classes, but this can conflict with the existing dashboard's 2967 lines of custom CSS that already override Tailwind defaults.

**Warning signs:**
- Headings in the editor look like plain text
- Bullet lists show no bullets
- The editor content area looks completely unstyled
- Applying `prose` class to editor breaks styling in nearby dashboard components
- Editor toolbar styling conflicts with existing dashboard button styles

**Prevention:**
- Scope ALL editor styles under a specific class: `.writing-editor .ProseMirror { ... }`
- Use `@tailwindcss/typography` but apply `prose` ONLY to the `.ProseMirror` content div, not the wrapper
- Test with existing dashboard CSS loaded -- the editor must look correct alongside Kanban, Chat, etc.
- Use TipTap's `editorProps.attributes.class` to apply prose classes directly to the editor DOM
- Create `src/writing-editor.css` as a scoped stylesheet imported only by the writing module
- Verify that the existing `--clawd-*` CSS variables don't conflict with prose plugin colors

**Which phase:** Phase 1 (Foundation). CSS architecture affects every visual element built afterward.

**Confidence:** HIGH -- verified via [TipTap + Tailwind discussion](https://github.com/ueberdosis/tiptap/discussions/2960), [TipTap styling docs](https://tiptap.dev/docs/editor/getting-started/style-editor), and the existing dashboard CSS (2967 lines across 6 files).

---

### H5: Electron Main Process Blocking on File I/O

**What goes wrong:** The existing main.ts uses synchronous `fs.readFileSync` in several places and `execSync` for CLI calls. If the writing module follows this pattern for chapter saves (especially large chapters with version snapshots), the Electron main process blocks, freezing the entire UI. A 50k-word chapter serialized to JSON is ~200KB; writing it synchronously takes 5-20ms which seems fine, but combined with version snapshots, project metadata updates, and memory store writes, a save operation could block for 100ms+.

**Warning signs:**
- Brief UI freeze every time autosave triggers
- "Not responding" in Activity Monitor during large file operations
- Clicking buttons during save results in delayed response
- Performance profiler shows main thread blocked on `fs.writeFileSync`

**Prevention:**
- Use async `fs.promises.writeFile` for ALL writing module file operations
- Debounce autosave to at most once per 5 seconds
- For version snapshots, write in background: create temp file, then atomic rename
- Consider using `worker_threads` for heavy serialization (JSON.stringify of large documents)
- Use `ipcMain.handle` (async) not `ipcMain.on` (can tempt synchronous handling)
- For the writing DB, `better-sqlite3` is inherently synchronous -- keep transactions small and use WAL mode

**Which phase:** Phase 1 (Foundation). I/O patterns are established early and hard to change.

**Confidence:** HIGH -- verified by reading main.ts (uses `readFileSync` and `execSync` in multiple places) and [Electron performance docs](https://www.electronjs.org/docs/latest/tutorial/performance).

---

## Medium Risk Pitfalls (watch for these)

### M1: State Management Pollution Between Writing and Dashboard

**What goes wrong:** The existing `store.ts` is a single Zustand store with connection state, tasks, sessions, agents, approvals, activities, drafts, and gateway listeners -- all mixed together. If writing state (open chapters, editor content, AI conversation history, unsaved changes flag) gets added to this store, every writing-related state change triggers selector re-evaluation across ALL dashboard components. The store also uses `persist` middleware, which would serialize chapter content to localStorage on every change.

**Warning signs:**
- localStorage grows to megabytes (chapter content persisted alongside settings)
- Opening the writing panel slows down Kanban board rendering
- "Maximum call stack size exceeded" from deep-cloning large chapter content in Zustand immer middleware
- Dashboard feels slower even when writing panel is closed

**Prevention:**
- Create `src/store/writingStore.ts` as a completely separate Zustand store
- Do NOT use `persist` middleware for document content (use explicit save-to-DB instead)
- Only persist lightweight writing preferences (last opened project, panel layout)
- Use React context or a dedicated WritingProvider for editor-specific state
- Keep the writing store's interface narrow: the dashboard should only know "is there unsaved work?" (for the window close prompt), nothing more

**Which phase:** Phase 1 (Foundation).

**Confidence:** HIGH -- verified by reading store.ts structure and Zustand best practices for [store splitting](https://zustand.docs.pmnd.rs/guides/slices-pattern).

---

### M2: Undo/Redo Breaks When AI Modifies Document

**What goes wrong:** ProseMirror maintains an undo/redo history as a stack of transactions. When AI inserts, replaces, or restructures content, those changes go onto the same undo stack. If the user writes a paragraph, AI rewrites it, user continues writing, then hits Ctrl+Z -- they might undo their own words and keep the AI rewrite, or undo the AI rewrite and lose their own words. The undo history becomes unpredictable.

**Warning signs:**
- Ctrl+Z after AI edit produces unexpected result
- User cannot "go back" to their version after accepting AI suggestion
- Undo requires 15+ presses to reverse a single AI operation
- Users report "I lost my text and can't get it back"

**Prevention:**
- Separate AI changes into their own history group using ProseMirror's `appendTransaction` with history metadata
- Before any AI modification, save a named snapshot ("Before AI rewrite of paragraph 3")
- Implement a chapter-level "versions" panel that shows save points, not just undo stack
- Consider making AI suggestions out-of-band (in a side panel) rather than in-document edits
- If AI edits in-document, batch all AI changes as a single undo step

**Which phase:** Phase 2 (AI Feedback Loop).

**Confidence:** MEDIUM -- based on ProseMirror history plugin behavior (well-documented), but exact UX depends on how AI integration is designed.

---

### M3: File Watching Conflicts Between Editor and External Agents

**What goes wrong:** If chapters are stored as files (markdown or JSON), external agents (writer, researcher) might edit them directly. The editor needs to detect these changes and reload, but: (1) fs.watch / chokidar fires duplicate events, (2) the editor's own saves trigger the watcher, creating a feedback loop, (3) if both the editor and an agent write simultaneously, one overwrites the other.

**Warning signs:**
- Chapter content reverts to a previous version after agent edit
- Editor reloads in a loop (save triggers watch, watch triggers reload, reload triggers save)
- "File has been modified externally" dialog appearing constantly
- Agent's edits silently overwritten by the next autosave

**Prevention:**
- Use SQLite (writing.db) as the canonical store instead of flat files -- eliminates file watching entirely
- If files are needed for agent access, use a "last-write-wins with notification" model:
  - Store a `last_modified_by` field
  - On conflict, show both versions and let user merge
- Debounce file watch events (ignore events within 1s of own writes)
- Set a "write lock" flag when the editor has unsaved changes to warn agents
- Better: have agents write to a "suggestions" table in the DB, not directly to chapter content

**Which phase:** Phase 2-3 (AI Feedback + Multi-Agent). But the storage architecture decision (DB vs files) happens in Phase 1.

**Confidence:** MEDIUM -- depends on whether flat files or DB storage is chosen.

---

### M4: Navigation and Routing Conflicts

**What goes wrong:** The existing App.tsx uses a simple `useState<View>` for navigation with a flat view type union (24 views currently). Adding the writing module introduces nested navigation (project list -> project -> chapter -> editor) that doesn't fit the flat model. Attempting to shoehorn it produces URL-less navigation that breaks back/forward, can't deep-link to a specific chapter, and loses context on panel switch.

**Warning signs:**
- User navigates to Chapter 5, switches to Kanban, switches back -- lands on project list instead of Chapter 5
- No way to "bookmark" or deep-link to a specific chapter
- Writing panel needs its own breadcrumb/back navigation that fights with the dashboard sidebar

**Prevention:**
- Treat the writing module as a single View (`writing`) in App.tsx, but manage sub-navigation internally
- Store writing navigation state in the writing store: `{ projectId, chapterId, view: 'list' | 'editor' | 'outline' }`
- Persist the writing navigation state so switching panels and back restores position
- Don't add 10 new entries to the View type -- add one and let the writing module handle its own routing

**Which phase:** Phase 1 (Foundation).

**Confidence:** HIGH -- verified by reading App.tsx (line 44) and the existing View type pattern.

---

### M5: ProseMirror Large Document Lag with Custom Node Views

**What goes wrong:** If you use `ReactNodeViewRenderer` for custom blocks (AI feedback annotations, inline comments, track changes markers), each custom node creates a React component inside ProseMirror's DOM. With 100+ AI feedback markers across a 10k-word chapter, you have 100+ React component trees being mounted, updated, and reconciled on every transaction. This is the documented cause of [TipTap issue #4492](https://github.com/ueberdosis/tiptap/issues/4492).

**Warning signs:**
- Editor becomes sluggish as more AI annotations are added
- Performance is fine with 5 annotations but terrible with 50
- React DevTools shows NodeView components re-rendering constantly
- Memory usage grows with annotation count

**Prevention:**
- Use ProseMirror Decorations (lightweight DOM manipulations) instead of ReactNodeViewRenderer for annotations
- If React components are needed for annotation UI, render them in a separate overlay positioned absolutely, not inside the ProseMirror DOM
- Limit the number of visible annotations (collapse/hide resolved ones)
- Use `shouldUpdate` in NodeView to prevent unnecessary re-renders
- Benchmark with realistic annotation density early (50+ per chapter)

**Which phase:** Phase 2 (AI Feedback Loop). But the annotation rendering strategy should be decided in Phase 1.

**Confidence:** HIGH -- verified via [TipTap issue #4492](https://github.com/ueberdosis/tiptap/issues/4492) and [ProseMirror performance discussions](https://discuss.prosemirror.net/t/need-help-to-improve-editor-performance/8860).

---

### M6: Preload.ts Bridge Becomes Unmaintainable

**What goes wrong:** The existing `preload.ts` is already 607 lines of IPC bridge definitions. Every new IPC handler in the main process needs a corresponding preload bridge entry AND a TypeScript type. With 30-50 new writing handlers, preload.ts grows past 700 lines, type definitions drift out of sync, and developers forget to add the bridge entry (handler works in dev mode but fails in production builds where contextBridge is enforced).

**Warning signs:**
- "window.clawdbot.writing is undefined" errors in production but not dev
- Type mismatch between what preload exposes and what renderer expects
- Preload.ts exceeds 800 lines
- New developers can't find where to add IPC bridges

**Prevention:**
- Create the writing IPC bridge as a separate object and merge it at the preload level:
  ```typescript
  // preload-writing.ts
  export const writingBridge = { ... };
  // preload.ts
  import { writingBridge } from './preload-writing';
  contextBridge.exposeInMainWorld('clawdbot', { ...existingBridge, writing: writingBridge });
  ```
- Generate TypeScript types from the bridge definition so they can't drift
- Write a test that verifies all `ipcMain.handle('writing:*')` channels have corresponding preload entries

**Which phase:** Phase 1 (Foundation).

**Confidence:** HIGH -- verified by reading preload.ts (607 lines, single monolithic bridge).

---

## Scope Creep Warnings (specific to this project)

### S1: Building Full Version Control Before Having Content

**The trap:** Engineering a git-like version control system for chapters (branches, merges, diffs, conflict resolution) before anyone has written a single chapter. This is tempting because "1000 pages will need versioning" but premature.

**Reality check:** For the first 6 months, the user will have maybe 10-50 chapters. Simple "save snapshot with timestamp" is sufficient. Git-like branching is needed when multiple agents edit simultaneously, which is Phase 4+ territory.

**Guideline:** Phase 1 should implement: save current version, list previous versions, restore a version. That's it. No branching, no merging, no diffs.

---

### S2: Over-Engineering the Memory Store Before Having Real Content

**The trap:** Building a sophisticated RAG system with vector embeddings, semantic search, character relationship graphs, and plot thread tracking before a single chapter exists. You don't know what metadata matters until real content reveals it.

**Reality check:** Start with manual "character notes" and "plot notes" as structured text fields. Add semantic search later when you have 50+ chapters and can measure what the AI actually needs.

**Guideline:** Phase 1-2: structured text notes (key-value pairs). Phase 3: basic full-text search. Phase 4+: consider embeddings if full-text search proves insufficient.

---

### S3: Multi-Agent Collaboration Before Single-User Writing Works

**The trap:** Designing the system for 5 agents (writer, editor, researcher, fact-checker, style coach) collaborating simultaneously before the basic write-and-get-feedback loop works for one human and one AI.

**Reality check:** The feedback loop between one user typing and one AI responding is the core value proposition. If that interaction is clunky, adding more agents makes it 5x clunkier.

**Guideline:** Phase 1-2: one human, one AI agent. Phase 3: memory stores (still one agent uses them). Phase 4+: multi-agent after the single-agent experience is polished.

---

### S4: Building a Custom Markdown Editor Instead of Using TipTap's Built-in Capabilities

**The trap:** Because the project involves markdown files, building a split-pane markdown editor (code on left, preview on right) instead of using TipTap as a WYSIWYG editor with markdown import/export. This is scope creep disguised as a "requirement."

**Reality check:** For memoir/novel writing, WYSIWYG is superior. The user should see formatted text, not markdown syntax. Markdown is a storage/export format, not an authoring interface.

**Guideline:** TipTap as WYSIWYG editor. Markdown import for existing content. Markdown/DOCX export for publishing. Never show raw markdown to the writer.

---

### S5: Premature Performance Optimization for 1000 Pages

**The trap:** Building lazy-loading, virtual scrolling, document sharding, and server-side rendering before the editor has loaded its first 10-page chapter. ProseMirror handles 10k-word documents fine without optimization.

**Reality check:** Performance optimization is needed when: (a) a single chapter exceeds 50k words (unlikely for typical memoir chapters), or (b) the project index exceeds 500 chapters. Neither will happen in the first 3 months.

**Guideline:** Optimize when you measure a problem, not when you imagine one. The exception: the React re-render prevention (C2) should be done from day one because it's nearly free and prevents a certain problem.

---

### S6: Rebuilding the Dashboard Shell to Accommodate Writing

**The trap:** Deciding that the writing module needs a "different layout" (full-screen, distraction-free, custom sidebar) and rebuilding the App.tsx shell, Sidebar, and TopBar to support multiple layout modes. This cascades into refactoring every existing panel.

**Reality check:** The writing module should be ONE panel in the existing shell. It renders full-width in its panel area, just like ChatPanel or KanbanPanel. "Distraction-free mode" can be a simple CSS toggle that hides the sidebar, not a new layout system.

**Guideline:** Phase 1: writing module renders inside existing panel system. Phase 2: add a "focus mode" toggle (hides sidebar + topbar via CSS class). Never rebuild the shell.

---

## Phase-Specific Risk Summary

| Phase | Highest Risks | Must-Address Pitfalls |
|-------|--------------|----------------------|
| Phase 1: Foundation | C1, C2, C3, C4, H3, H4, H5, M1, M4, M6 | Memory leak prevention, separate store, separate DB, separate IPC module, CSS scoping, storage format decision |
| Phase 2: AI Feedback | H1, H2, M2, M5 | Streaming insertion strategy, context window budgeting, undo history grouping, annotation rendering |
| Phase 3: Memory & Context | H2 (deepens), S2 | Avoid over-engineering memory stores, start with structured text not vector DB |
| Phase 4: Multi-Agent | M3, S3 | Agent write coordination, don't build before single-agent works |
| Phase 5+: Scale | S5 | Optimize only when measured |

---

## Sources

### TipTap / ProseMirror
- [TipTap Memory Leak #5654](https://github.com/ueberdosis/tiptap/issues/5654)
- [TipTap Memory Leak #538](https://github.com/ueberdosis/tiptap/issues/538)
- [TipTap Large Document Perf #4491](https://github.com/ueberdosis/tiptap/issues/4491)
- [TipTap ReactNodeView Perf #4492](https://github.com/ueberdosis/tiptap/issues/4492)
- [TipTap Performance Guide](https://tiptap.dev/docs/guides/performance)
- [TipTap React Performance Demo](https://tiptap.dev/docs/examples/advanced/react-performance)
- [TipTap 2.5 Release (Performance)](https://tiptap.dev/blog/release-notes/say-hello-to-tiptap-2-5-our-most-performant-editor-yet)
- [TipTap Schema / FAQ (content loss)](https://tiptap.dev/docs/guides/faq)
- [TipTap Stream Content API](https://tiptap.dev/docs/content-ai/capabilities/text-generation/stream)
- [TipTap + Tailwind Discussion](https://github.com/ueberdosis/tiptap/discussions/2960)
- [TipTap Styling Docs](https://tiptap.dev/docs/editor/getting-started/style-editor)
- [ProseMirror Performance Discussion](https://discuss.prosemirror.net/t/need-help-to-improve-editor-performance/8860)

### Electron
- [Electron Performance Guide](https://www.electronjs.org/docs/latest/tutorial/performance)
- [Blocking Electron Main Process (Medium)](https://medium.com/actualbudget/the-horror-of-blocking-electrons-main-process-351bf11a763c)

### Context / AI
- [Context Window Management Strategies](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/)
- [AI Agent Context Window Optimization (Datagrid)](https://datagrid.com/blog/optimize-ai-agent-context-windows-attention)
- [LLMs with Largest Context Windows](https://codingscape.com/blog/llms-with-largest-context-windows)

### State Management
- [Zustand Slices Pattern](https://zustand.docs.pmnd.rs/guides/slices-pattern)
- [Zustand Multiple Stores Discussion](https://github.com/pmndrs/zustand/discussions/2496)

### SQLite / better-sqlite3
- [SQLite WAL Mode](https://sqlite.org/wal.html)
- [better-sqlite3 Concurrency](https://wchargin.com/better-sqlite3/performance.html)
