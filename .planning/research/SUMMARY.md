# Project Research Summary

**Project:** Froggo.app v2.1 — AI-Powered Writing UX Redesign
**Domain:** Conversational AI book creation system (Electron app)
**Researched:** 2026-02-13
**Confidence:** HIGH

## Executive Summary

The v2.1 milestone adds three interconnected features to Froggo's existing TipTap-based writing module: (1) an AI-powered project setup wizard that guides authors through conversational book planning, (2) a 3-pane resizable layout (chapters | AI chat | editor) replacing the current 2-pane design, and (3) a conversational writing flow where AI generates prose in the chat pane and users explicitly insert it into the editor. This represents a paradigm shift from the existing "highlight text, get feedback" model to "plan with AI, write through conversation."

The recommended approach is clean and minimal: add exactly **two npm packages** (`react-resizable-panels` for the 3-pane layout, `@tiptap/markdown` for markdown-to-editor content insertion) and build custom components for the wizard and chat pane using the existing OpenClaw Gateway infrastructure. The existing feedback popover (BubbleMenu) remains functional — both interaction modes coexist. The entire implementation fits into 3 well-defined phases with clear dependency ordering.

**Key risks are manageable:** The wizard must enforce structured output from AI conversation (use tool-calling or JSON schema enforcement, not free-form parsing). The chat pane and TipTap editor will fight over DOM focus (solved with TipTap's Focus extension + stored selection state). Content insertion from chat to editor must validate against TipTap's schema (markdown → ProseMirror conversion via `@tiptap/markdown`). All three risks have well-documented solutions from TipTap community patterns and existing codebase patterns.

## Key Findings

### Recommended Stack

The existing stack (React 18, TipTap 3.19.0, Zustand, Tailwind, Electron 28, OpenClaw Gateway) is **completely sufficient** for v2.1. Only 2 new dependencies are needed:

**New packages:**
- **`react-resizable-panels` v4.6.2**: 3-pane resizable layout with min/max constraints, keyboard accessibility, and automatic layout persistence. Powers shadcn/ui's Resizable component. Built by Brian Vaughn (ex-React core team). Zero runtime dependencies. 1,551 npm dependents make it the dominant choice.
- **`@tiptap/markdown` v3.19.0**: Enables `editor.commands.insertContent(markdown, {contentType: 'markdown'})` for AI-generated prose insertion. Official TipTap extension matching existing TipTap version. Handles markdown → ProseMirror schema conversion.

**What was explicitly rejected:**
- Wizard libraries (react-step-wizard, MUI Stepper): Wrong abstraction. The wizard is conversational, not form-based.
- Streamdown: Marginal improvement over existing `react-markdown` for streaming chat. Can upgrade later if needed.
- Vercel AI SDK: Redundant with OpenClaw Gateway.
- Custom resizable panel implementation: `react-resizable-panels` is battle-tested and zero-dep.

### Expected Features

Research across Sudowrite, Novelcrafter, Squibler, ChatGPT Canvas, and Cursor IDE identified clear feature expectations:

**Must have (table stakes):**
- **Setup wizard with conversational planning**: Users expect guided book planning before writing (Sudowrite's Story Engine, Novelcrafter's Plan mode). Must be conversational (AI asks questions, proposes structure), not form-based.
- **3-pane layout (chapters | chat | editor)**: ChatGPT Canvas, Cursor IDE, Squibler all use this pattern. Panes must be resizable and collapsible.
- **Streaming AI responses in chat**: Every modern AI tool streams tokens. Users expect real-time text appearance.
- **"Insert into editor" action**: Defining UX pattern across CKEditor AI, Type.ai, ChatGPT Canvas. AI generates in chat → user reviews → explicit insert. Never auto-replace.
- **Chat history persistence**: Multi-turn conversation with context across sessions.
- **Context-aware prompting**: AI knows current chapter, project outline, characters, timeline.

**Should have (differentiators):**
- **Agent-specialized planning**: Use Jess (emotional arc) for memoirs, Writer (plot structure) for novels. No competitor does agent-specialized setup wizards.
- **Creative director mode**: The wizard is a conversation, not a form. User and agent collaborate on structure iteratively.
- **Wizard outputs feed memory store**: Characters/timeline from wizard auto-populate the memory tabs. No manual re-entry.

**Defer (v2+):**
- Drag content from chat to editor (complex DnD, "Insert" button is sufficient)
- Outline-to-beats-to-prose pipeline (powerful but complex data model)
- Resizable panes (collapsible is MVP, resize is polish)
- Cross-chapter context in chat (start with current chapter + memory, add summaries later)
- Story arc visualization (store as markdown initially)

### Architecture Approach

The architecture integrates cleanly with the existing Electron + React structure. The current `ProjectEditor.tsx` (2-pane layout with toggleable right panels) is replaced entirely with a 3-pane `PanelGroup` from `react-resizable-panels`. The chat pane is a new component that reuses the existing `gateway.sendChatWithCallbacks()` pattern from `FeedbackPopover.tsx`. Content flows from chat to editor via a Zustand-based decoupling pattern: `chatStore.sendToEditor()` → `writingStore.setPendingInsert()` → `ChapterEditor` watches `pendingInsert` and calls TipTap's `insertContent()`.

**Major components:**
1. **SetupWizard**: Multi-turn AI conversation using `gateway.sendChatWithCallbacks` with dedicated session key (`agent:writer:writing-wizard:{wizardId}`). Maintains running wizard state object (chapters, characters, timeline) extracted from AI conversation using tool calls or JSON schema enforcement. On completion, calls new `writing:project:createFromWizard` IPC handler to atomically create project + chapters + memory.
2. **ChatPane**: Persistent AI chat with message list, agent picker (reuses existing `AgentPicker`), and "Insert into editor" button. Uses separate session key (`agent:{agent}:writing-chat:{projectId}`) from inline feedback to prevent context contamination. New `chatPaneStore.ts` manages chat state independently from `writingStore.ts`.
3. **WorkspacePane**: Wrapper around existing `ChapterEditor` + `ContextPanel` + `VersionPanel`. The 3-pane layout is chapters | chat | workspace, not chapters | chat | editor | context.

**Critical integration points:**
- **Focus management**: TipTap's Focus extension + stored selection state (`writingStore.lastEditorSelection`) prevents BubbleMenu from disappearing when chat input receives focus.
- **Content insertion**: `@tiptap/markdown` converts AI markdown to ProseMirror nodes. Always insert at well-defined position (cursor, end of chapter, or insertion marker), never raw cursor position.
- **Session key isolation**: Chat pane (`agent:{agent}:writing-chat:{projectId}`), inline feedback (`agent:{agent}:writing:{projectId}:feedback`), wizard (`agent:writer:writing-wizard:{wizardId}`) use distinct namespaces.

### Critical Pitfalls

1. **Wizard AI produces unstructured/inconsistent data**: Multi-turn conversation must populate `chapters.json`, `characters.json`, `timeline.json` from AI responses. Without structured output enforcement (tool calls or JSON schema), AI returns prose instead of parseable JSON. Character edits mid-conversation create duplicates. **Solution:** Maintain running wizard state object updated after each AI turn using tool-calling (e.g., `update_chapter_outline`, `add_character` tools). Show live preview of extracted structure alongside conversation. Validate final structure before writing to disk.

2. **Focus war between chat pane and TipTap editor**: Clicking chat input collapses editor selection, BubbleMenu disappears, cursor jumps to wrong position (Firefox bug). The existing `FeedbackPopover` already has workarounds (`preventDefault`, `savedSelection`), but persistent chat can't use `preventDefault` on every interaction. **Solution:** Use TipTap Focus extension to keep selection visually highlighted when editor loses focus. Store selection in `writingStore.lastEditorSelection` on every change. Make BubbleMenu's `shouldShow` check stored selection, not live focus.

3. **Chat-to-editor insertion corrupts document/undo**: AI generates prose in chat, user clicks "Insert", content lands at random cursor position or splits mid-paragraph. Undo removes entire multi-paragraph block as one step. Autosave fires mid-insertion. **Solution:** Always insert at well-defined position (end of chapter, after paragraph, insertion marker). Wrap insertion in single ProseMirror transaction with undo label. Auto-save version snapshot BEFORE insertion. Sanitize AI markdown through `@tiptap/markdown` to validate against schema.

4. **Existing 2-pane layout code fights new 3-pane layout**: Current `ProjectEditor.tsx` uses flex layout with conditional `ContextPanel`/`VersionPanel` as mutually exclusive overlays. Bolting a chat pane onto this creates width calculation bugs, panel overlap, and toggle button positioning issues. **Solution:** Replace layout architecture entirely (only 70 lines). Use `react-resizable-panels` with 3 panels: chapters (min 180px, default 240px, collapsible), chat (min 280px, default 35%), editor+context (min 300px, flex-1). Move ContextPanel/VersionPanel into editor pane as tabs, not additional flex children.

5. **Wizard state lost on navigation/app restart**: Wizard conversation takes 10-30 minutes. Navigating away or app crash loses accumulated state. Current `WritingWorkspace.tsx` has no "wizard in progress" concept. **Solution:** Persist wizard state to `wizard-state.json` after every AI turn. Use gateway session key pattern for conversation history preservation. Mark project as `status: 'setup'` so UI knows to resume wizard. Add confirmation dialog when navigating away from in-progress wizard.

## Implications for Roadmap

Based on research, recommend **3 sequential phases** with clear dependency ordering:

### Phase 1: Foundation (Chat Infrastructure)
**Rationale:** Build the chat pane infrastructure first because both the 3-pane layout AND the wizard depend on it. Extract shared utilities from FeedbackPopover, create chat state management, establish the chat-to-editor data flow pattern. This phase is non-blocking — existing features continue working.

**Delivers:**
- `chatPaneStore.ts` — chat state management (messages, streaming, agent selection)
- `src/lib/writingContext.ts` — shared context builders (extracted from FeedbackPopover)
- `writingStore.pendingInsert` mechanism — decoupled chat-to-editor communication
- `WorkspacePane.tsx` — wrapper around ChapterEditor (prepares for 3-pane integration)

**Addresses:** Table stakes for conversational writing flow (chat history, streaming, context-aware prompting)

**Avoids:** Focus war pitfall (H2) — foundation work doesn't touch layout yet

**Research flag:** Standard patterns, skip research. Gateway integration pattern already proven in FeedbackPopover.

### Phase 2: 3-Pane Layout + Conversational Writing
**Rationale:** With chat infrastructure ready, replace the 2-pane layout and integrate the chat pane. This is the core UX change. Building it before the wizard means the editor is ready to receive content from either manual chat or wizard output.

**Delivers:**
- `ChatPane.tsx` + `ChatMessage.tsx` — persistent chat UI with streaming AI responses
- Redesigned `ProjectEditor.tsx` — 3-pane layout using `react-resizable-panels`
- Chat-to-editor content flow — "Insert" button → `pendingInsert` → TipTap insertion
- `@tiptap/markdown` integration — markdown content insertion
- Session key namespacing — chat, feedback, wizard isolated

**Uses:**
- `react-resizable-panels` for layout
- `@tiptap/markdown` for content insertion
- Existing gateway streaming pattern

**Addresses:**
- Table stakes: 3-pane layout, resizable panes, streaming AI responses, insert-to-editor action
- Differentiators: Chat-driven chapter writing (existing highlight-feedback + new chat-generate-insert)

**Avoids:**
- Layout conflict pitfall (C4) — complete rewrite prevents bolting onto old structure
- Focus war pitfall (C2) — TipTap Focus extension + stored selection
- Insertion corruption pitfall (C3) — schema validation + well-defined insertion points

**Research flag:** Moderate complexity. TipTap insertion patterns are well-documented. Layout with `react-resizable-panels` is straightforward. Test at window widths 1024px-1920px.

### Phase 3: Setup Wizard
**Rationale:** The wizard is a separate entry flow that produces project data for the chat-enabled editor. Building it last means: (1) chat infrastructure is battle-tested, (2) wizard conversations can be tested in the full editor immediately, (3) wizard outputs (chapters, characters) populate an already-functional writing environment.

**Delivers:**
- `wizardStore.ts` — wizard state, step management, conversation history, structured data extraction
- `SetupWizard.tsx` + child components — conversational planning UI
- `writing:project:createFromWizard` IPC handler — atomic project creation with all metadata
- Wizard state persistence — `wizard-state.json` for resume-on-restart
- Extended `project.json` schema — optional fields (storyArc, themes, wizardComplete)

**Uses:**
- Chat infrastructure from Phase 1 (reuse `gateway.sendChatWithCallbacks`, context builders)
- Existing memory store services (createCharacter, createTimeline, createFact)

**Addresses:**
- Table stakes: Conversational planning, brain dump input, chapter outline generation, character generation, review & confirm
- Differentiators: Agent-specialized planning (Jess for memoirs, Writer for novels), creative director mode, wizard-to-memory auto-population

**Avoids:**
- Structured output pitfall (C1) — use tool-calling or JSON schema enforcement, not free-form parsing
- Wizard state loss pitfall (H1) — persist after every turn, support resume
- Memory store bypass pitfall (M2) — bulk-create IPC handler for atomic writes

**Research flag:** HIGH complexity. Structured output extraction from multi-turn AI conversation is the hardest technical challenge. Test wizard thoroughly with: (1) happy path (complete wizard in one session), (2) resume path (quit mid-wizard, restart, resume), (3) editing path (change character name mid-conversation). Use Claude's tool-calling for structured extraction.

### Phase Ordering Rationale

- **Foundation before layout**: Chat state management and context utilities are needed by both the chat pane (Phase 2) and wizard (Phase 3). Building them first prevents duplication.
- **Layout before wizard**: The wizard produces projects that open in the 3-pane editor. Building the editor first means wizard testing happens in the real environment, not a stub.
- **Sequential phases prevent integration hell**: Each phase delivers working features. Phase 1 is invisible to users (refactor). Phase 2 is usable immediately (manual chat-based writing). Phase 3 adds guided planning.

**Dependency chain:**
```
Phase 1: chatPaneStore + writingContext + pendingInsert mechanism
   ↓
Phase 2: ChatPane + 3-pane layout + chat-to-editor flow
   ↓
Phase 3: SetupWizard (uses chatPaneStore patterns + creates projects for 3-pane editor)
```

### Research Flags

**Needs deeper research during planning:**
- **Phase 3 (Wizard)**: Structured output extraction from LLM conversation. Research Claude's tool-calling API, test prompt patterns for reliable JSON extraction, validate character/chapter data schemas. This is a novel integration — no codebase precedent.

**Standard patterns (skip research-phase):**
- **Phase 1 (Foundation)**: Zustand store creation, context utility extraction. Existing patterns in feedbackStore.ts and FeedbackPopover.tsx.
- **Phase 2 (Layout)**: `react-resizable-panels` is well-documented with official examples. TipTap `insertContent` is in official docs. Gateway streaming is proven in FeedbackPopover.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Both new packages verified on npm with React 18 peer deps. `react-resizable-panels` v4.6.2 published Feb 7 2026, 1551 dependents. `@tiptap/markdown` v3.19.0 matches existing TipTap version. |
| Features | HIGH | Multiple competitors (Sudowrite, Novelcrafter, Squibler, ChatGPT Canvas, Cursor) validate the 3-pane + wizard + chat-to-editor pattern. Table stakes confirmed across 5+ sources. |
| Architecture | HIGH | Direct source code analysis of existing codebase. All integration points mapped to actual files (ProjectEditor.tsx, FeedbackPopover.tsx, writingStore.ts, gateway.ts, writing-project-service.ts). Patterns proven in v2.0. |
| Pitfalls | HIGH | 4 of 5 critical pitfalls have documented solutions in TipTap community (Focus extension, insertContent validation, BubbleMenu focus handling). Wizard structured output is a known LLM challenge with established solutions (tool-calling, JSON schema enforcement). |

**Overall confidence:** HIGH

### Gaps to Address

**Wizard structured output extraction specifics:** Research identified the problem (AI conversation → structured JSON) and the solution category (tool-calling or JSON schema), but the exact prompt engineering and tool definitions need testing during Phase 3 planning. Recommendation: use `/gsd:research-phase` for Phase 3 to validate Claude's tool-calling API for character/chapter extraction.

**Chat session context window management:** The PITFALLS research flags unbounded context growth in long sessions (M4). The gateway's session history behavior isn't fully documented in the existing `gateway.ts`. During Phase 2 execution, test: (1) how many messages before gateway truncates history, (2) whether explicit context management is needed. Fallback: use conversation summarization every 10 messages.

**TipTap markdown conversion edge cases:** `@tiptap/markdown` handles standard markdown, but AI-generated prose might include constructs outside StarterKit schema (tables, footnotes, task lists). During Phase 2, test AI-generated markdown insertion and verify graceful degradation for unsupported elements.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** (direct file reading):
  - `src/components/writing/ChapterEditor.tsx` — TipTap editor configuration
  - `src/components/writing/FeedbackPopover.tsx` — Gateway streaming pattern
  - `src/components/writing/ProjectEditor.tsx` — Current layout structure
  - `src/store/writingStore.ts`, `feedbackStore.ts`, `memoryStore.ts` — State management patterns
  - `electron/writing-project-service.ts`, `writing-memory-service.ts` — File storage patterns
  - `src/lib/gateway.ts` — WebSocket client API
- **npm registry verification**:
  - `react-resizable-panels@4.6.2` — published Feb 7 2026, peer deps validated
  - `@tiptap/markdown@3.19.0` — official TipTap extension
- **Official documentation**:
  - [TipTap insertContent API](https://tiptap.dev/docs/editor/api/commands/content/insert-content)
  - [TipTap Focus Extension](https://tiptap.dev/docs/editor/extensions/functionality/focus)
  - [TipTap Markdown Extension](https://tiptap.dev/docs/editor/markdown)
  - [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels)
  - [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)

### Secondary (MEDIUM confidence)
- **Competitor analysis**:
  - [Sudowrite Story Engine Tutorial](https://www.digitaltrends.com/computing/how-to-use-sudowrite-story-engine-write-novel/)
  - [Novelcrafter Write Interface Docs](https://www.novelcrafter.com/help/docs/write/the-write-interface)
  - [Squibler Review (Reedsy)](https://reedsy.com/studio/resources/squibler-review)
  - [ChatGPT Canvas Guide](https://ai-basics.com/how-to-use-chatgpt-canvas/)
- **UX patterns**:
  - [Shape of AI — Inline Action Pattern](https://www.shapeof.ai/patterns/inline-action)
  - [CKEditor AI Features](https://ckeditor.com/ai-assistant/)
- **TipTap community**:
  - [TipTap streaming discussion #5563](https://github.com/ueberdosis/tiptap/discussions/5563)
  - [TipTap Firefox focus bug #5980](https://github.com/ueberdosis/tiptap/issues/5980)
  - [TipTap selection when unfocused #4963](https://github.com/ueberdosis/tiptap/discussions/4963)

### Tertiary (LOW confidence)
- [Best AI Writing Tools 2026 (Kindlepreneur)](https://kindlepreneur.com/best-ai-writing-tools/) — Market overview, used for landscape validation only
- [20+ GenAI UX Patterns (UX Collective)](https://uxdesign.cc/20-genai-ux-patterns-examples-and-implementation-tactics-5b1868b7d4a1) — Conceptual patterns, not implementation-specific

---
*Research completed: 2026-02-13*
*Ready for roadmap: yes*
