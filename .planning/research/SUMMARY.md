# Project Research Summary

**Project:** Froggo.app v2.0 — AI-Collaborative Long-Form Writing Module
**Domain:** AI-assisted memoir/novel writing (1000+ pages) with multi-agent collaboration
**Researched:** 2026-02-12
**Confidence:** HIGH

## Executive Summary

This writing system integrates into the existing Froggo Electron dashboard as a new module enabling long-form memoir/novel writing with AI collaboration from three specialized agents (Writer, Researcher, Jess). The core innovation is inline feedback: users highlight text, request AI assistance, and review multiple alternatives in context. The architecture follows the existing codebase patterns (separate electron services, dedicated Zustand store, project-scoped data) while introducing TipTap as the rich text editor foundation.

The recommended approach is chapter-based editing with per-project SQLite databases for research sources and JSON files for lightweight memory (characters, timeline, facts). TipTap v3.19.0 provides the editing layer with proven performance at scale. Context-aware AI responses are achieved through a multi-tier context system: agents receive the current chapter, project outline, character profiles, and timeline with hot/warm/cold tiers for token budget management. The architecture deliberately avoids three pitfalls that kill writing tools: unsolicited AI suggestions that break flow, storing chapter content in the main froggo.db causing contention, and TipTap React re-render storms.

Critical risks center on Phase 1 foundation decisions that cannot be changed later: separate writingStore to avoid dashboard state pollution (C2, M1), TipTap memory leak prevention via proper cleanup (C1), and per-project database isolation (H3). The inline feedback system (Phase 2) must prevent cursor jumps during AI streaming (H1) and manage the 200k context window budget with the multi-tier system (H2). Getting these architectural foundations right in Phase 1-2 is non-negotiable.

## Key Findings

### Recommended Stack

TipTap v3.19.0 emerges as the clear choice for the rich text editor: it wraps ProseMirror with React-friendly APIs, ships with 10 built-in extensions covering all basic formatting, and handles 200k+ word documents without performance issues. The markdown extension enables round-trip conversion (though beta status means edge cases exist). Using raw ProseMirror would require 2000+ lines of glue code that TipTap provides.

**Core technologies:**
- **TipTap v3.19.0**: Rich text editing — ProseMirror-based, proven at scale, React integration, selection tracking for inline feedback
- **diff v8.0.3**: Text comparison engine — 7800+ dependents, built-in TypeScript types, zero dependencies
- **chokidar v4.0.3**: File watching (main process) — detects external edits, CommonJS compatible (v5 is ESM-only)
- **better-sqlite3**: Per-project databases — already in stack, add per-project sources.db alongside froggo.db
- **react-diff-viewer-continued v4.1.2**: Diff UI component — actively maintained fork, side-by-side view for AI alternatives

**Version constraints:** All TipTap packages must use identical versions (`^3.19.0`) to avoid peer dependency conflicts. Chokidar v4 specifically (not v5) required due to Electron main process CommonJS requirement.

### Expected Features

**Must have (table stakes):**
- Chapter-based project structure with tree navigation (Scrivener standard)
- TipTap WYSIWYG editor with markdown storage, autosave, deep undo/redo
- On-demand AI feedback only (no ghost text, no unsolicited suggestions)
- Highlight-to-chat inline feedback with streaming responses
- Multiple AI alternatives per request with reasoning
- Context-aware agent responses (characters, timeline, outline, facts)
- Word count per chapter and project-wide
- Version snapshots before AI edits
- Full-text search across project

**Should have (competitive differentiators):**
- Multi-agent collaboration (Writer/Researcher/Jess) in one editor
- Memory store with character profiles, timeline, verified facts
- Memory auto-injected into AI context (NovelCrafter's Codex pattern)
- Jess agent for emotional/therapeutic guidance (memoir-specific)
- Research library with source-to-passage linking
- Dual chronology support (narrative vs actual timeline)
- Emotional arc tracking per chapter

**Defer (v2+):**
- Auto-detection of characters/events from text (complex NLP)
- Timeline visualization (medium complexity)
- PDF/ePub export (already scoped out)
- Feedback history learning signal
- Story arc visualization
- Writing session statistics

**Anti-features (deliberately avoid):**
- AI autocomplete/ghost text while typing (kills creative flow)
- Auto-generate entire chapters (produces bland voice-less prose)
- Proactive AI suggestions (breaks flow state)
- Grammar correction as primary feature (OS already provides this)
- Gamification (badges/streaks)

### Architecture Approach

The writing module integrates as a single new View in the existing App.tsx but manages its own internal navigation (project list → editor → memory manager). Three new electron services handle the domain: writing-project-service.ts (project/chapter CRUD, versioning), writing-memory-service.ts (characters/timeline/facts), and writing-feedback-service.ts (feedback storage, context building, sources). All writing IPC channels use `writing:*` namespace. The module gets its own Zustand store (`writingStore`) — never polluting the existing store with document state. Per-project data lives in `~/froggo/writing-projects/{projectId}/` with chapters as markdown files, memory as JSON, feedback as JSONL, and research sources in per-project SQLite.

**Major components:**
1. **3 Electron Services** — `writing-project-service.ts`, `writing-memory-service.ts`, `writing-feedback-service.ts` register ~30 IPC handlers, follow existing service pattern
2. **Separate Zustand Store** — `writingStore.ts` manages writing state in isolation from dashboard state (no persist middleware for document content)
3. **Per-Project SQLite** — `{projectDir}/research/sources.db` for relational data (facts, sources, linkage); characters/timeline stay in JSON for simplicity
4. **TipTap Editor with Custom Extensions** — InlineFeedback mark extension for feedback anchors, selection tracking via `editor.on('selectionUpdate')`
5. **Context Builder** — Multi-tier context system (hot: current chapter + outline + memory, warm: adjacent chapters, cold: full project) assembled in main process
6. **Gateway Integration** — Project-scoped agent sessions (`agent:writer:writing:{projectId}`), streaming via `sendChatWithCallbacks`

**Storage layout:**
```
~/froggo/writing-projects/{projectId}/
  project.json                  # Project metadata
  outline.md                    # High-level outline
  chapters/01-childhood.md      # Chapter content (markdown)
  memory/characters.json        # Character profiles
  memory/timeline.json          # Timeline events
  memory/facts.json             # Verified facts
  research/sources.db           # Per-project SQLite
  feedback/01-childhood.jsonl   # Feedback log (append-only)
  versions/01-childhood/v*.md   # Version snapshots
```

**Critical path modification needed:** `electron/fs-validation.ts` missing `~/froggo` in ALLOWED_ROOTS (existing bug from 2026-02-12 rename) — must be fixed before Phase 1.

### Critical Pitfalls

1. **TipTap memory leak on destroy (C1)** — Editor instance leaks due to circular DOM reference. Always call `editor.destroy()` in React useEffect cleanup. Affects Phase 1 foundation.

2. **React re-render storm (C2)** — Default behavior re-renders entire tree on every keystroke. Set `shouldRerenderOnTransaction: false`, create separate writingStore (not merged into store.ts), use Zustand selectors everywhere. Architecture decision in Phase 1 that cannot be retrofitted.

3. **SQLite contention if using froggo.db (H3)** — Main dashboard, froggo-db CLI, and agent-dispatcher all access froggo.db. Writing module autosaves would create lock contention. Create separate `writing.db` or per-project SQLite files. Phase 1 decision.

4. **AI streaming causes cursor jumps (H1)** — Inserting AI tokens shifts ProseMirror positions. Never stream into the editing position; use suggestion panel or buffer complete response then insert atomically. Phase 2 design.

5. **Context window mismanagement (H2)** — 1000-page novel is 250k-500k tokens. Cannot send entire book for paragraph feedback. Build multi-tier context system with token budget per tier. Design in Phase 1, implement in Phase 3.

6. **Markdown round-trip content loss (C4)** — ProseMirror schema drops non-conforming content. Store as TipTap JSON, not markdown. Markdown for import/export only. Phase 1 storage format decision.

7. **Adding handlers to 7451-line main.ts (C3)** — Create `electron/writing-service.ts` as separate module following existing pattern (x-automations-service.ts). Phase 1 boundary.

8. **Tailwind Preflight strips editor formatting (H4)** — Scope all editor styles under `.writing-editor .ProseMirror`, apply `@tailwindcss/typography` prose classes only to content div. Phase 1 CSS architecture.

## Implications for Roadmap

Based on research, suggested 6-phase structure:

### Phase 1: Foundation (Project + Chapter CRUD)
**Rationale:** File structure, project/chapter CRUD, and basic TipTap editor must exist before any other feature can work. This phase establishes the skeleton.

**Delivers:** Project creation, chapter-based file structure, TipTap editor with markdown storage, autosave, outline navigation sidebar, word count

**Addresses:** Table stakes features (project structure, chapter navigation, editor, word count) + foundational architecture decisions

**Avoids:** C1 (memory leak prevention), C2 (separate store + shouldRerenderOnTransaction), C3 (separate service files), C4 (storage format), H3 (separate DB), H4 (CSS scoping), H5 (async file I/O)

**Implementation scope:** 7 new Electron service functions, 1 new Zustand store, 6-8 React components, 30+ IPC channels, paths.ts additions, fs-validation.ts fix

**Research flag:** Standard patterns (Electron IPC, TipTap integration, file I/O). No additional research needed.

### Phase 2: Inline Feedback System
**Rationale:** The core innovation. Without inline feedback, this is just a text editor. This validates the entire UX concept early.

**Delivers:** Text selection tracking, floating feedback popover, agent communication via gateway, streaming responses, multiple alternatives display, accept/reject with undo

**Addresses:** AI collaboration table stakes (on-demand only, highlight-to-chat, alternatives with reasoning, agent routing)

**Avoids:** H1 (cursor jump prevention via suggestion panel), H2 (context builder with tier system design)

**Implementation scope:** writing-feedback-service.ts, 4 new React components (InlineFeedbackPopover, AlternativesDisplay, AgentFeedbackSelector), TipTap custom extension for selection tracking, gateway integration

**Research flag:** Standard patterns (gateway.sendChatWithCallbacks already used in ChatPanel). No additional research needed.

### Phase 3: Memory Store (Characters, Timeline, Facts)
**Rationale:** Memory makes AI feedback context-aware. Phase 2 feedback works but is generic; Phase 3 feedback knows your characters and timeline.

**Delivers:** Character profiles CRUD, timeline events CRUD, verified facts CRUD, context panel display, auto-injection into agent prompts

**Addresses:** Differentiator features (memory store, context-aware responses, NovelCrafter's Codex pattern)

**Avoids:** H2 (context window management via multi-tier system implementation)

**Implementation scope:** writing-memory-service.ts, 6 new React components (ContextPanel, CharacterCard, CharacterEditor, TimelineView, TimelineEditor, MemoryManager), context building enhancement

**Research flag:** Standard patterns (JSON file management, basic context injection). No additional research needed.

### Phase 4: Research Library & Sources (SQLite)
**Rationale:** SQLite for relational queries (facts linked to sources). Phase 3 establishes facts in JSON; Phase 4 migrates to SQLite and adds sources.

**Delivers:** Per-project sources.db, source management UI, fact-to-source linking, Researcher agent fact-checking workflow

**Addresses:** Differentiator features (research library with source-to-passage linking, fact verification)

**Avoids:** H3 (per-project DB isolation already established in Phase 1)

**Implementation scope:** database.ts additions (getWritingDb), sources.db schema, 4 new React components (ResearchLibrary, SourceEditor, FactChecker), facts migration from JSON to SQLite

**Research flag:** Standard patterns (better-sqlite3 already in use, straightforward schema). No additional research needed.

### Phase 5: Outline Mode & Version History
**Rationale:** Polish on top of core flow. Phase 1-3 enables writing + feedback; Phase 5 adds project management.

**Delivers:** Drag-drop chapter reordering, outline view, version history sidebar, version comparison diff

**Addresses:** Table stakes features (version history, drag-drop reordering)

**Implementation scope:** Outline mode component with drag-drop, version history UI, diff view component (react-diff-viewer-continued)

**Research flag:** Standard patterns (drag-drop via react-beautiful-dnd or similar, diff display library chosen). No additional research needed.

### Phase 6: Jess Integration & Polish
**Rationale:** Jess adds memoir-specific emotional guidance. Infrastructure from Phase 2 already supports any agent; this is prompt engineering + UX.

**Delivers:** Jess agent prompts for emotional feedback, boundary guidance, trauma-pacing suggestions, style guide enforcement, keyboard shortcuts, reading time estimate

**Addresses:** Differentiator features (emotional/therapeutic guidance, Jess agent), table stakes polish (focus mode, reading time)

**Implementation scope:** Jess-specific system prompts, emotional tone indicators in context panel, style guide system, keyboard shortcut handlers, focus mode CSS

**Research flag:** Prompt engineering domain knowledge (narrative therapy frameworks, memoir writing patterns). May need research-phase if Jess guidance proves complex.

### Phase Ordering Rationale

- **Phase 1 establishes all architecture decisions that cannot be changed later:** separate store, per-project DB, storage format, service boundaries, CSS scoping. Every pitfall marked "Phase 1" is architectural.
- **Phase 2 validates the core value proposition early** (inline feedback) so we know the interaction model works before building memory/research layers on top.
- **Phase 3 depends on Phase 2** (context building feeds memory into feedback) but can start with manual memory entry — auto-detection deferred.
- **Phase 4 depends on Phase 3** (facts must exist before linking to sources). SQLite migration is the most architecturally complex piece.
- **Phase 5-6 are polish** that work on top of the core flow. These can be reordered or deferred based on user feedback after Phase 1-3.

**Dependency chain:** Phase 1 (foundation) → Phase 2 (feedback uses foundation) → Phase 3 (memory enhances feedback) → Phase 4 (sources extend memory) → Phase 5-6 (polish).

**Scope creep boundaries:** Don't build version control branches before having content (S1). Don't build vector search before having 50+ chapters (S2). Don't design for 5-agent collaboration before single-agent works (S3). TipTap as WYSIWYG, not a markdown code editor (S4). Don't optimize for 1000 pages before loading 10 pages (S5). Writing is one panel, not a layout system rebuild (S6).

### Research Flags

**Phases with standard patterns (skip research-phase):**
- **Phase 1-5:** All use existing patterns from codebase (Electron IPC, Zustand stores, TipTap docs, better-sqlite3, gateway integration). Research complete.

**Phases likely needing deeper research:**
- **Phase 6 (Jess integration):** Prompt engineering for emotional guidance, narrative therapy frameworks, boundary-setting patterns for memoir writing. Research needed if guidance quality is critical. Can start with basic prompts and iterate.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | TipTap v3.19.0 verified via official docs + npm + GitHub. All other libraries already in stack or verified actively maintained. |
| Features | HIGH | Features validated across 6 established tools (Scrivener, NovelCrafter, Sudowrite, Notion AI, iA Writer, Cursor). Anti-features validated via user community discussions. |
| Architecture | HIGH | Based on direct source code analysis of froggo-dashboard codebase. All patterns follow existing service structure. |
| Pitfalls | HIGH | TipTap issues verified via GitHub (C1, C2, M5). Electron patterns verified via codebase (C3, H3, H5). ProseMirror concepts well-documented (H1, C4). |

**Overall confidence:** HIGH

### Gaps to Address

- **TipTap markdown round-trip fidelity:** The `@tiptap/markdown` extension is labeled beta. Edge cases may exist. Mitigation: Store as TipTap JSON (not markdown), treat markdown as import/export format only, test round-trips early in Phase 1.

- **Context window budget validation:** The 200k token budget is theoretical. Real-world testing with a 50-chapter project needed to validate that hot/warm/cold tier system stays within bounds. Mitigation: Design token budget tracking in Phase 1, implement in Phase 3, tune tiers based on actual chapter sizes.

- **Gateway session cleanup:** Project-scoped agent sessions (`agent:writer:writing:{projectId}`) need explicit cleanup when project closes to avoid zombie sessions. Pattern exists for dashboard sessions but writing has different lifecycle. Mitigation: Add cleanup handlers in Phase 2 when session management is implemented.

- **Jess prompt engineering:** Emotional guidance quality depends on prompt design, not code. Narrative therapy frameworks and boundary-setting patterns for memoir need validation with real content. Mitigation: Start with basic empathetic prompts in Phase 6, iterate based on user feedback, consider research-phase if guidance proves inadequate.

## Sources

### Primary (HIGH confidence)
- **TipTap Official Documentation** — v3 capabilities, performance guide, React integration, extensions
- **TipTap GitHub** — v3.19.0 release notes, issues #5654 (memory leak), #4491 (performance), #4492 (NodeView perf)
- **Froggo Dashboard Codebase** — electron/main.ts (7451 lines), database.ts, paths.ts, store.ts, gateway.ts, existing service patterns
- **better-sqlite3, diff, chokidar, react-diff-viewer-continued** — npm registry, version compatibility, maintenance status
- **Scrivener, NovelCrafter, Sudowrite, Notion AI, iA Writer** — official documentation, feature comparisons, user reviews

### Secondary (MEDIUM confidence)
- **Writing tool reviews** — Kindlepreneur reviews (Sudowrite, NovelCrafter), writing tool comparisons
- **AI writing research** — preserving voice, homogenization problem, flow state writing
- **Context window research** — Maxim AI context strategies, Datagrid attention analysis, lost-in-the-middle phenomenon
- **Memoir writing guides** — timeline creation, emotional pacing, sensitivity considerations

### Tertiary (LOW confidence — patterns only, not facts)
- **Hacker News discussions** — AI autocomplete as focus destroyer (user opinions, not validated research)
- **Community discussions** — ProseMirror performance patterns, Zustand multi-store patterns

---
*Research completed: 2026-02-12*
*Ready for roadmap: yes*
