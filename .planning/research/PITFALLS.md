# Domain Pitfalls: v2.1 Writing UX Redesign

**Domain:** Adding AI-powered setup wizard, 3-pane layout, and conversational content generation to existing TipTap writing module
**Researched:** 2026-02-13
**Overall Confidence:** HIGH (verified against existing codebase + TipTap docs + community issues)
**Scope:** Pitfalls specific to ADDING these features to the existing v2.0 system. See v2.0 PITFALLS for foundational pitfalls (TipTap memory leaks, CSS scoping, etc.) which were already addressed.

---

## Critical Pitfalls

### C1: Setup Wizard AI Produces Unstructured or Inconsistent Data

**What goes wrong:** The setup wizard is a multi-turn AI conversation that must produce structured output (chapter outline, characters, timeline events, story arc). The existing `createProject()` in `writing-project-service.ts` creates a bare project with just `{id, title, type}`. The wizard needs to populate `chapters.json`, `memory/characters.json`, `memory/timeline.json`, and potentially a new `project.json` with story arc data -- all from free-form AI conversation. Without structured output enforcement, the AI returns prose descriptions instead of parseable data structures. Each turn may contradict previous turns. The user says "actually, change the protagonist's name" and the AI acknowledges it in text but the previously-extracted character JSON still has the old name.

**Warning signs:**
- Wizard completes but `characters.json` is empty or has only 1 character when 5 were discussed
- Chapter titles extracted from conversation don't match what user agreed to
- Timeline events have inconsistent date formats or missing fields
- User edits a character during wizard and the final output has both old and new versions
- `JSON.parse()` failures in the extraction step because AI returned markdown instead of JSON

**Prevention:**
- Do NOT parse free-form conversation into structured data at the end. Instead, maintain a running "wizard state" object that is updated after each AI turn using structured output extraction (tool calls or JSON schema enforcement)
- Use the OpenClaw gateway's existing `sendChatWithCallbacks` pattern but add a post-processing step after each `onEnd` that extracts structured updates from the AI response
- Define a clear schema for wizard state: `{ title, type, storyArc, chapters: [{title, summary}], characters: [{name, relationship, traits}], timeline: [{date, description}] }`
- Show the user a live preview of extracted structure alongside the conversation (e.g., a sidebar showing "Chapters so far: 1. X, 2. Y") so they can catch extraction errors in real-time
- On wizard completion, validate the final structure before writing to disk. If validation fails, show the user what's missing and let them fix it in a form, not by continuing the AI conversation
- Consider using Claude's tool-use capability: define tools like `update_chapter_outline`, `add_character`, `modify_character` that the AI calls during conversation, producing guaranteed-schema output

**Which phase:** Setup Wizard phase. This is the core technical challenge of the wizard.

**Confidence:** HIGH -- verified via [OpenAI Structured Outputs docs](https://platform.openai.com/docs/guides/structured-outputs) and [Agenta's guide to structured outputs](https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms). The problem of LLMs producing inconsistent JSON is well-documented across all providers.

---

### C2: Focus War Between Chat Pane and TipTap Editor

**What goes wrong:** The v2.1 3-pane layout places an AI chat input directly alongside the TipTap editor. The existing `ChapterEditor.tsx` uses `BubbleMenu` (line 131-147) which shows/hides based on text selection state. When the user clicks the chat input to type a message, the editor loses focus, the selection collapses, and the BubbleMenu disappears. Worse, when the user clicks back into the editor, TipTap's focus behavior in Firefox restores the cursor to the *last known position* rather than where they clicked ([TipTap issue #5980](https://github.com/ueberdosis/tiptap/issues/5980)). The existing `FeedbackPopover.tsx` already has a workaround for this (`onMouseDown={(e) => e.preventDefault()}` at line 409 and `savedSelection` state at lines 249-250), but a persistent chat pane cannot use `preventDefault` on every interaction -- the user needs to actually type in the chat input.

**Warning signs:**
- User highlights text in editor, clicks chat pane to ask about it, selection disappears
- BubbleMenu flickers or vanishes when chat input receives focus
- After using chat, clicking back into editor puts cursor at wrong position
- User can't copy text from editor and reference it in chat -- selection is lost on focus change
- Existing inline feedback stops working because BubbleMenu's `shouldShow` returns false when editor isn't focused

**Prevention:**
- Use TipTap's Focus extension to keep selection visually highlighted even when editor loses focus. The existing `ChapterEditor.tsx` does not import this extension
- Store editor selection in writingStore (`lastEditorSelection: {from, to}`) on every selection change. When chat needs to reference selected text, read from store, not from live editor state
- Make BubbleMenu's `shouldShow` check the stored selection, not just `editor.state.selection.empty`. This decouples BubbleMenu visibility from DOM focus
- For the chat pane: when the user clicks "insert into editor" on an AI response, restore focus with `editor.chain().focus().insertContentAt(storedSelection, content).run()`
- Consider making BubbleMenu and chat pane mutually exclusive: if chat pane is open and visible, suppress BubbleMenu entirely and show a "selected text" indicator in the chat pane instead. This eliminates the focus conflict
- Test explicitly in Firefox (existing bug with focus restoration)

**Which phase:** 3-Pane Layout phase. Must be solved before chat-to-editor content flow works.

**Confidence:** HIGH -- verified via [TipTap Focus extension docs](https://tiptap.dev/docs/editor/extensions/functionality/focus), [TipTap issue #4963](https://github.com/ueberdosis/tiptap/discussions/4963) (keeping selection visible when focus leaves), [TipTap issue #5980](https://github.com/ueberdosis/tiptap/issues/5980) (Firefox cursor bug), and the existing `FeedbackPopover.tsx` which already demonstrates this exact problem.

---

### C3: Chat-to-Editor Content Insertion Corrupts Document or Undo History

**What goes wrong:** The conversational writing flow means AI generates prose in the chat pane, and the user clicks "Insert" to add it to the editor. The naive implementation calls `editor.commands.insertContent(aiHtml)`. Problems: (1) If the AI output contains HTML that doesn't conform to the TipTap schema, it is silently dropped (the v2.0 PITFALLS C4 schema issue). (2) The insertion lands at whatever position the cursor happens to be at, which may not be where the user intended. (3) The insertion is a single undo step, but if the AI generated 3 paragraphs, the user can't undo just one paragraph. (4) If the user was in the middle of typing when they click "Insert", the insertion splits their current paragraph. (5) The existing autosave (`AUTOSAVE_DELAY = 1500ms` in `ChapterEditor.tsx` line 15) fires during or immediately after insertion, potentially saving a half-inserted state.

**Warning signs:**
- AI generates a heading + 3 paragraphs in chat, user clicks Insert, only 2 paragraphs appear (schema stripped the heading because it was nested wrong)
- Content inserts in the middle of a sentence because cursor was positioned there
- Ctrl+Z after accepting AI content undoes the entire multi-paragraph insertion as one atomic operation, or worse, undoes only part of it
- Autosave triggers between individual insertContentAt commands if insertion is done in multiple steps
- Content appears without proper paragraph breaks (AI HTML has `<br>` but TipTap expects `<p>` nodes)

**Prevention:**
- Parse AI HTML through TipTap's schema BEFORE insertion: create a temporary editor instance or use `editor.schema.nodeFromJSON()` to validate. Show the user a preview of what will be inserted
- Always insert at a well-defined position: end of current chapter, after current paragraph, or at a user-placed "insertion marker". Never insert at raw cursor position
- Wrap the insertion in a single ProseMirror transaction with a descriptive label for undo: `editor.chain().focus().insertContentAt(position, content, {updateSelection: true}).run()`
- Auto-save the version BEFORE AI insertion (call `writing:version:save` with label "Before AI insert") so the user can always restore
- Sanitize AI HTML: strip any elements not in the TipTap schema, convert `<br>` to paragraph breaks, normalize heading levels
- For multi-paragraph insertions, insert as a single content block, not paragraph-by-paragraph. TipTap's `insertContent` handles arrays: `editor.commands.insertContent([{type: 'paragraph', content: ...}, ...])`

**Which phase:** Conversational Writing Flow phase. This is the most complex interaction in the entire redesign.

**Confidence:** HIGH -- verified via [TipTap insertContent docs](https://tiptap.dev/docs/editor/api/commands/content/insert-content), [TipTap content streaming discussion #5563](https://github.com/ueberdosis/tiptap/discussions/5563), and existing `FeedbackPopover.tsx` `handleAccept()` (line 364-380) which already demonstrates the insertion pattern but for small text replacements, not multi-paragraph blocks.

---

### C4: Existing 2-Pane Layout Code Fights the New 3-Pane Layout

**What goes wrong:** The current `ProjectEditor.tsx` renders a 2-pane layout: `ChapterSidebar` (fixed 256px via `w-64`) + editor (flex-1). The `ContextPanel` and `VersionPanel` are toggled with state and render conditionally as additional panes (lines 66-67). The v2.1 redesign adds a persistent chat pane as the middle column, making it chapters | chat | editor. But the existing code treats the right-side panels (`ContextPanel`, `VersionPanel`) as overlays that are mutually exclusive (lines 16-17: toggling one closes the other). Attempting to add a chat pane to this architecture means: (1) The chat pane competes with ContextPanel/VersionPanel for right-side space, (2) The `flex-1` on the editor div (line 27) doesn't account for a fixed-width or resizable chat pane, (3) The panel toggle buttons (lines 39-64) are positioned `absolute top-2 right-2` inside the editor div and will overlap with the new pane boundary.

**Warning signs:**
- Chat pane and ContextPanel render on top of each other
- Editor width calculation is wrong -- content area is too narrow or overflows
- Panel toggle buttons float over the chat pane
- Opening VersionPanel closes the chat pane (because of the mutual exclusion logic)
- On narrow screens, the 3-pane layout crushes all panes to unusable widths

**Prevention:**
- Replace the current layout architecture entirely rather than bolting onto it. The current `ProjectEditor.tsx` is only 70 lines -- it's cheap to rewrite
- Use `react-resizable-panels` (by Brian Vaughn) for the 3-pane layout. It handles min/max constraints, persistence, keyboard accessibility, and resize handles. The existing code uses no resizing library
- Define clear layout structure: `PanelGroup direction="horizontal"` with 3 panels: chapters (min 180px, default 240px, collapsible), chat (min 280px, default 35%), editor (min 300px, default 50%)
- Move ContextPanel and VersionPanel into the editor pane as tabs/drawers, not as additional flex children of the root layout. The 3-pane layout is chapters | chat | editor+context
- Remove the mutual exclusion logic between ContextPanel and VersionPanel -- they should be tabs within the editor's right section, not competing panes
- Set `minSize` constraints on all panels to prevent the TipTap editor from being crushed below its minimum usable width (~300px)
- Persist panel sizes to localStorage so users don't have to re-resize every session

**Which phase:** 3-Pane Layout phase. This is the foundational layout change that everything else sits on top of.

**Confidence:** HIGH -- verified by reading `ProjectEditor.tsx` (the actual code) and [react-resizable-panels docs](https://github.com/bvaughn/react-resizable-panels). Known issues with dynamic panels: [issue #372](https://github.com/bvaughn/react-resizable-panels/issues/372), [issue #323](https://github.com/bvaughn/react-resizable-panels/issues/323).

---

## High Risk Pitfalls

### H1: Wizard State Lost on Navigation or App Restart

**What goes wrong:** The setup wizard is a multi-turn AI conversation that might take 10-30 minutes. The user is 15 turns into planning their book structure when they accidentally click the sidebar to check a task on the Kanban board. The current `WritingWorkspace.tsx` checks `activeProjectId` and renders either `ProjectSelector` or `ProjectEditor` -- there is no concept of a "wizard in progress" state. Navigating away from the writing panel destroys the wizard component and all accumulated state. Similarly, if the Electron app crashes or the user quits, the wizard conversation and extracted structure are lost.

**Warning signs:**
- User navigates away from writing panel and returns to find wizard reset to step 1
- App crash during wizard loses 20 minutes of planning conversation
- User clicks "Back to projects" and wizard state is gone with no confirmation dialog
- Wizard conversation history (the AI messages) cannot be resumed because the gateway session was single-use

**Prevention:**
- Persist wizard state to disk after every AI turn. Use a `wizard-state.json` file in the project directory: `~/froggo/writing-projects/{projectId}/wizard-state.json`
- The wizard state should include: current step, accumulated structured data (chapters, characters, etc.), conversation history (messages array), and wizard completion status
- On mount, check if `wizard-state.json` exists and is incomplete -- offer to resume
- Use the gateway session key pattern: `agent:writer:writing:{projectId}:wizard`. The OpenClaw gateway preserves session history, so resuming the session key resumes the conversation context
- Add an "are you sure?" confirmation when navigating away from an in-progress wizard
- Mark the project as `status: 'setup'` in `project.json` so the UI knows to show the wizard instead of the editor when opening this project
- On wizard completion, delete `wizard-state.json` and update project status to `'active'`

**Which phase:** Setup Wizard phase. Must be designed into the wizard from the start, not bolted on.

**Confidence:** HIGH -- the navigation pattern is verified by reading `WritingWorkspace.tsx` (which has no wizard state awareness) and `writingStore.ts` (which has no persistence for in-progress creation state).

---

### H2: Gateway Session Key Collision Between Chat Pane and Inline Feedback

**What goes wrong:** The existing `FeedbackPopover.tsx` uses session keys like `agent:writer:writing:{projectId}` (line 258). The new chat pane will also need a gateway session for conversational writing. If both use the same session key pattern, they share conversation history. This means: (1) The inline feedback prompt pollutes the chat conversation context, (2) The chat conversation's instructions about "write chapter 3" appear when the user next highlights text for inline feedback, (3) The gateway's `chat.history` returns an interleaved mess of feedback requests and chat messages. The existing `FeedbackPopover` already switches agents (writer/researcher/jess) on the same session pattern, which somewhat works because each agent gets its own session key. But the chat pane might use the same agents.

**Warning signs:**
- User asks for feedback on a paragraph, and the AI response references a previous chat conversation about chapter structure
- Chat pane shows inline feedback exchanges in its history
- Switching agents in the chat pane resets the session unexpectedly
- Gateway `sessions.list` shows dozens of stale sessions from both feedback and chat interactions

**Prevention:**
- Use distinct session key namespaces: `agent:{agent}:writing:{projectId}:feedback` for inline feedback and `agent:{agent}:writing:{projectId}:chat` for the chat pane
- Update the existing `FeedbackPopover.tsx` session key (line 258) to include the `:feedback` suffix
- Consider whether the chat pane should maintain a single persistent session per project (carries context across the entire writing session) vs. fresh sessions per interaction (no context bleed). Persistent is better for "write chapter 3" style long conversations
- The wizard should also have its own session namespace: `agent:{agent}:writing:{projectId}:wizard`
- Clean up stale sessions: when a project is closed, optionally call `sessions.delete` on the chat session to prevent session buildup

**Which phase:** 3-Pane Layout phase (when chat pane is created). But the session key refactor of `FeedbackPopover` should happen in the layout phase too, before adding the chat pane.

**Confidence:** HIGH -- verified by reading `FeedbackPopover.tsx` line 258 and `gateway.ts` `sendChatWithCallbacks` method. The session key pattern is critical to gateway behavior.

---

### H3: AI Chat Generates Content in Wrong Format for TipTap

**What goes wrong:** The AI in the chat pane generates prose as markdown (because that is the natural output format of LLMs). But the existing `ChapterEditor.tsx` works with TipTap's internal HTML representation. The existing `saveChapter` stores content as-is (line 329 of `writing-project-service.ts` writes raw content to `.md` files). There is a format mismatch: (1) AI outputs markdown, (2) TipTap expects HTML, (3) Files on disk are `.md` but contain HTML from TipTap. If the chat-to-editor flow naively inserts AI markdown into TipTap, it renders as literal markdown syntax (asterisks visible, hash signs visible). If it converts markdown to HTML first, the conversion may produce HTML that doesn't match TipTap's schema.

**Warning signs:**
- Inserted text shows raw markdown: `**bold text**` appears literally with asterisks
- Headings from AI appear as `# Chapter Title` instead of formatted headings
- Bullet lists from AI appear as lines starting with `- ` instead of actual list items
- Some markdown constructs (tables, footnotes, code blocks) crash the insertion because TipTap's StarterKit schema doesn't support them

**Prevention:**
- Build a dedicated `markdownToTipTap(markdown: string): string` utility that converts AI markdown to TipTap-compatible HTML. Use a library like `marked` or `markdown-it` for the markdown-to-HTML step, then validate the resulting HTML against TipTap's schema
- Alternatively, instruct the AI to output HTML directly in the system prompt: "Output content as HTML using only these tags: p, h1-h3, strong, em, ul, ol, li, blockquote, a". This is simpler but less natural for the AI
- The safest approach: convert AI markdown to a ProseMirror document node using TipTap's markdown extension (`tiptap-markdown`), which handles the schema mapping. But note the v2.0 PITFALLS warning about lossy conversion
- Whichever approach, write tests that cover: headings, bold, italic, lists, blockquotes, links, and importantly, UNSUPPORTED constructs (tables, code blocks, images) -- verify these degrade gracefully instead of crashing
- The existing `.md` files on disk already contain HTML (from TipTap's `getHTML()`), not real markdown. Acknowledge this naming inconsistency and either rename to `.html` or document that "`.md` files contain TipTap HTML"

**Which phase:** Conversational Writing Flow phase. But the conversion utility should be built and tested during the 3-Pane Layout phase when the chat pane is being created.

**Confidence:** HIGH -- verified by reading `ChapterEditor.tsx` (uses `getHTML()`), `writing-project-service.ts` (stores to `.md` files), and the TipTap StarterKit configuration (lines 62-81 of `ChapterEditor.tsx` which defines the supported schema).

---

### H4: Wizard Conversation Doesn't Know About Existing Project Data

**What goes wrong:** If the wizard is designed only for new projects, it works fine. But users will want to "re-plan" or "extend" an existing project -- add new chapters to an existing outline, introduce new characters after writing 5 chapters, restructure the story arc. The wizard AI has no context about what already exists in the project unless it's explicitly provided. The existing memory store (`characters.json`, `timeline.json`, `facts.json`) and chapter list need to be injected into the wizard's system prompt. Without this, the AI suggests characters that already exist, proposes chapters that overlap with written ones, or contradicts established plot points.

**Warning signs:**
- AI suggests a character named "Sarah" when "Sarah" already exists in `characters.json` with different traits
- AI proposes 12 chapters when 8 already exist and are partially written
- Wizard creates duplicate entries in memory stores (two versions of the same character)
- User asks to "add 3 more chapters" and gets a complete rewrite of the outline

**Prevention:**
- Build the wizard to work in two modes: "new project" (blank slate) and "extend project" (existing context)
- For "extend project" mode, inject existing data into the system prompt:
  - Project title and type from `project.json`
  - Existing chapter titles and word counts from `chapters.json`
  - All characters from `memory/characters.json`
  - Timeline from `memory/timeline.json`
  - Key facts from `memory/facts.json`
- Format this context clearly: "This project already has the following structure: [chapters], [characters], [timeline]. The user wants to extend/modify this."
- When the wizard produces updates, use UPSERT logic for characters (match by name, update if exists, create if new) rather than blind INSERT
- For chapters, distinguish between "proposed new chapters" and "existing chapters" in the wizard state

**Which phase:** Setup Wizard phase, but specifically the "extend existing project" variant which should be Phase 2 of the wizard (after basic new-project wizard works).

**Confidence:** MEDIUM -- the new project flow is straightforward, but the "extend" flow is where complexity lives. Existing memory store APIs (in `writing-memory-service.ts`) don't have upsert logic -- they only have create/update/delete with explicit IDs.

---

## Medium Risk Pitfalls

### M1: Chat Pane Scroll Position Fights with TipTap Editor Scroll

**What goes wrong:** Both the chat pane (message list) and the TipTap editor have independent scroll containers. When the user scrolls in the chat pane, the mouse wheel event might bubble to the editor if the chat reaches its scroll boundary. On macOS with elastic scrolling, overscroll in one pane can appear to move the other. Additionally, when AI generates a response in the chat pane and the chat auto-scrolls to the bottom, this can steal scroll focus from the editor where the user was reading.

**Warning signs:**
- User scrolls to the end of chat messages and the editor starts scrolling too
- Chat auto-scroll after AI response causes visible "jump" in the editor pane
- Scrolling feels "sticky" at the boundary between panes
- Trackpad momentum scrolling passes through pane boundaries

**Prevention:**
- Ensure both scroll containers have `overflow-y: auto` with no scroll propagation to parent. Use `overscroll-behavior: contain` CSS property on both panes
- For chat auto-scroll, only auto-scroll if the user was already at the bottom of the chat (track scroll position relative to scrollHeight). If the user scrolled up to read earlier messages, don't auto-scroll
- Test with macOS trackpad specifically -- elastic/momentum scrolling is the worst case

**Which phase:** 3-Pane Layout phase.

**Confidence:** HIGH -- this is a known issue with any multi-scroll-container layout.

---

### M2: Wizard Populates Memory Store But Bypasses Existing CRUD Validation

**What goes wrong:** The wizard needs to bulk-create characters, timeline events, and chapters from the AI conversation output. The existing memory service (`writing-memory-service.ts`) has individual CRUD operations: `createCharacter` creates one character at a time, reading the full JSON array, appending, and writing back. If the wizard calls `createCharacter` 8 times in sequence, it reads and rewrites `characters.json` 8 times. Worse, if any single write fails mid-sequence (disk full, permission error), the memory store is left in a partial state with 4 of 8 characters created.

**Warning signs:**
- Wizard completion takes 5+ seconds because of sequential file I/O for each entity
- Partial wizard state: 5 characters created but 0 timeline events because the timeline write failed
- Race condition: wizard writes `characters.json` while the ContextPanel is reading it for display
- Duplicate characters if wizard is re-run after a partial failure

**Prevention:**
- Add a bulk-create IPC handler: `writing:memory:bulk-populate` that takes the entire wizard output and writes all files atomically (characters, timeline, facts, chapters) in a single operation
- Use a transaction pattern: write all files to temp locations first, then rename them all at once. If any write fails, none are committed
- Add a `writing:project:setup-complete` IPC handler that takes the full wizard output and does everything: create chapters, populate memory, update project metadata
- Keep the individual CRUD operations for manual editing, but use the bulk operation for wizard output
- Validate the wizard output against schemas before any writes

**Which phase:** Setup Wizard phase.

**Confidence:** HIGH -- verified by reading `writing-memory-service.ts` which does individual file reads/writes with no batch support.

---

### M3: New 3-Pane Layout Breaks on Small Screens and Panel Resize

**What goes wrong:** The current layout works at full desktop width because `ChapterSidebar` is fixed at 256px and the editor takes the rest. The 3-pane layout adds a chat pane (minimum ~280px for usable chat), so the minimum total width is ~256 + 280 + 300 = 836px. On a 13" MacBook at default resolution, the window might be 1200px, leaving only ~664px for editor + chat after the sidebar. If the user resizes panels unevenly, the TipTap editor can be crushed to a width where the toolbar wraps, the BubbleMenu doesn't fit, and text is nearly unreadable.

**Warning signs:**
- Editor toolbar wraps to 2 lines when editor pane is narrow
- BubbleMenu extends outside the editor pane boundary
- Text in editor is crushed to 10 words per line
- Chat pane is too narrow for message bubbles
- Panels can be resized to 0px width, completely hiding content with no way to restore

**Prevention:**
- Set minimum panel widths: sidebar 180px (collapsible to 0), chat 280px, editor 300px
- Make the sidebar collapsible (with a toggle button) to reclaim space. When collapsed, only show a thin icon strip or nothing
- Use `react-resizable-panels` which supports `minSize` (as percentage) and `collapsible` props
- Add a "layout preset" system: "Focus" (sidebar collapsed, chat hidden, editor full), "Write" (sidebar + chat + editor), "Plan" (sidebar + chat, no editor). This lets users switch without manual resizing
- Persist panel sizes to localStorage so the user's preferred layout survives restarts
- Test at 1024px window width -- this is the minimum reasonable desktop width

**Which phase:** 3-Pane Layout phase.

**Confidence:** HIGH -- verified via [react-resizable-panels known issues](https://github.com/bvaughn/react-resizable-panels/issues/323) and basic arithmetic on the current layout widths.

---

### M4: Chat Session Context Grows Unbounded During Long Writing Sessions

**What goes wrong:** The chat pane maintains a persistent gateway session for the writing conversation. Over a 4-hour writing session, the user sends 50+ messages to the AI. The OpenClaw gateway accumulates the full conversation history in the session. Each message includes the system prompt with chapter context, memory context, and the AI's response. After 50 exchanges, the session context could exceed 200k tokens, causing: (1) API errors from exceeding context limits, (2) Degraded AI quality (lost-in-the-middle effect), (3) Slow response times, (4) High token costs.

**Warning signs:**
- AI responses get slower over a long session (>15 messages)
- AI "forgets" instructions from early in the conversation
- Gateway returns error about token limits
- Token usage per message increases over time (visible in analytics)

**Prevention:**
- Don't rely on the gateway's built-in session history for long conversations. Instead, manage context explicitly
- Build a "conversation summarizer" that periodically (every 10 messages) creates a summary of the conversation so far and starts a fresh session with that summary as context
- Set a maximum conversation length (e.g., 20 messages) and auto-summarize when exceeded
- Show the user a "context indicator" (e.g., "AI remembers last 15 messages") so they understand the limitation
- For each message, explicitly construct the context: system prompt + conversation summary + last N messages + current chapter excerpt. Don't let the gateway auto-accumulate
- Consider using the existing feedback pattern: each message is a standalone request with full context, rather than a persistent conversation. This is simpler but loses conversational flow

**Which phase:** Conversational Writing Flow phase.

**Confidence:** MEDIUM -- depends on how the OpenClaw gateway handles session history truncation (may already have built-in limits, but the existing `gateway.ts` has a 180-second timeout per request which suggests it expects bounded interactions, not long sessions).

---

### M5: Existing `writingStore.ts` State Shape Doesn't Support 3-Pane Layout

**What goes wrong:** The current `writingStore.ts` tracks: projects list, active project, active chapter ID/content, chapter loading/dirty state. The 3-pane layout needs additional state: chat messages, chat input, chat streaming state, wizard state, panel sizes, layout mode, insertion preview, selected text for chat reference. If all this lands in `writingStore`, the store becomes bloated and every chat keystroke triggers re-renders in the chapter sidebar and editor through Zustand's subscription mechanism.

**Warning signs:**
- Typing in chat input causes visible re-render flicker in the chapter sidebar
- Store has 40+ state fields and 20+ actions
- Multiple components subscribe to the whole store instead of selectors
- Chat state persistence conflicts with chapter state persistence

**Prevention:**
- Create separate stores for each pane's local state:
  - `writingStore.ts` -- project/chapter state (already exists)
  - `chatStore.ts` -- chat messages, input, streaming state, session management
  - `wizardStore.ts` -- wizard step, accumulated structure, conversation history
- Share cross-cutting state through a thin coordination layer, not by merging stores. Example: "current chapter ID" lives in `writingStore`, and `chatStore` reads it via `useWritingStore(s => s.activeChapterId)` to contextualize chat requests
- The existing `feedbackStore.ts` is a good pattern -- it's small, focused, and independent. Follow this pattern for new stores
- Use Zustand selectors religiously: `useChatStore(s => s.messages)` not `useChatStore()`

**Which phase:** 3-Pane Layout phase (when creating the chat pane). But the store architecture decision should be made before writing any chat component code.

**Confidence:** HIGH -- verified by reading `writingStore.ts` (269 lines, already substantial) and `feedbackStore.ts` (51 lines, good example of focused store).

---

## Integration-Specific Pitfalls

### I1: Wizard Output Doesn't Match Existing `createProject` / `createChapter` Flow

**What goes wrong:** Currently, `ProjectSelector.tsx` calls `createProject(title, type)` which creates a bare project directory structure. Then `ChapterSidebar.tsx` calls `createChapter(title)` one at a time. The wizard needs to do both in one atomic operation: create project with all chapters, characters, and timeline pre-populated. But the existing IPC handlers are designed for incremental, user-driven creation. The wizard would need to call `createProject`, then call `createChapter` N times, then call `createCharacter` M times -- a sequence of 20+ IPC round-trips that can fail partway through.

**Prevention:**
- Create a new IPC handler: `writing:project:create-from-wizard` that takes the full wizard output and creates everything in one call
- This handler should: create project dir, write `project.json` with enhanced metadata (story arc, themes), write `chapters.json` with all chapters, create all chapter `.md` files (empty or with AI-generated content), write `memory/characters.json`, write `memory/timeline.json`
- Return success only if everything was created. On any failure, clean up partial state (delete the project directory)
- Keep the existing `createProject` for manual creation (for users who don't want the wizard)
- The `ProjectSelector.tsx` should offer two paths: "New Project" (existing manual flow) and "New Project with AI" (wizard flow)

**Which phase:** Setup Wizard phase.

**Confidence:** HIGH -- verified by reading the existing creation flow in `writing-project-service.ts` and `writingStore.ts`.

---

### I2: Chat Pane Reuses `gateway.sendChatWithCallbacks` But Needs Different UX Semantics

**What goes wrong:** The existing `FeedbackPopover.tsx` uses `gateway.sendChatWithCallbacks` for one-shot request/response interactions (highlight text, send prompt, get alternatives). The chat pane needs a conversational interaction (persistent session, message history, streaming display, user can send follow-ups). The gateway API is the same, but the UX layer is completely different. If the chat pane tries to reuse the FeedbackPopover's pattern, it will: (1) not show conversation history, (2) lose context between messages, (3) not handle the case where the user sends a new message while a previous response is still streaming.

**Prevention:**
- Build the chat pane's gateway interaction as a new module (`src/lib/writingChat.ts`) that wraps `gateway.sendChatWithCallbacks` with conversational semantics:
  - Maintains a local message history (array of `{role, content, timestamp}`)
  - Queues outgoing messages if a response is still streaming
  - Constructs context-aware prompts that include conversation history
  - Handles session persistence and resumption
- Do NOT modify the FeedbackPopover or its gateway interaction -- they serve a different purpose and work well as-is
- The chat pane should manage its own `runId` tracking (the gateway returns a `runId` from `sendChatWithCallbacks`). The existing gateway already has `runCallbacks` per runId, so concurrent feedback and chat requests won't interfere at the gateway level

**Which phase:** Conversational Writing Flow phase.

**Confidence:** HIGH -- verified by reading `gateway.ts` `sendChatWithCallbacks` (line 677) and `FeedbackPopover.tsx` `handleSend` (line 244).

---

### I3: Existing `project.json` Schema Lacks Wizard/Setup Metadata

**What goes wrong:** The current `ProjectMeta` in `writing-project-service.ts` (line 20) is: `{id, title, type, createdAt, updatedAt}`. The wizard needs to store: story arc, themes, target audience, tone, setting, time period, and wizard completion status. If these are added as new fields to `project.json`, existing projects (created before v2.1) won't have them, causing `undefined` access errors. If a new file is created (e.g., `project-meta.json`), there are now two sources of truth for project metadata.

**Prevention:**
- Extend `ProjectMeta` with optional fields: `storyArc?: string`, `themes?: string[]`, `tone?: string`, `setting?: string`, `wizardComplete?: boolean`. All new fields must be optional to maintain backward compatibility with existing projects
- Add a migration check: when `getProject()` loads a project that was created pre-v2.1 (no wizard fields), treat it as `wizardComplete: true` (skip wizard for legacy projects)
- Validate the extended schema on read: if a field is missing, use a default value rather than crashing
- Do NOT create a separate metadata file -- keep everything in `project.json` to maintain a single source of truth

**Which phase:** Setup Wizard phase (schema extension happens when wizard is built).

**Confidence:** HIGH -- verified by reading the `ProjectMeta` interface in `writing-project-service.ts`.

---

## Scope Creep Warnings (Specific to v2.1)

### S1: Building a Full Chat UI Framework Instead of a Simple Message List

**The trap:** Building a complete chat system with message editing, deletion, reactions, threading, file attachments, message search, and typing indicators for the writing chat pane. Looking at the existing `ChatPanel.tsx` (the main dashboard chat) and thinking "let's reuse/extend that."

**Reality check:** The writing chat pane is a focused tool for "tell the AI what to write." It needs: a message input, a scrollable message list, streaming response display, and an "insert into editor" button on AI messages. That's it.

**Guideline:** Build the simplest possible chat component. If it works well, iterate. Do NOT import or extend the existing ChatPanel -- it has 15+ features the writing chat doesn't need and carries gateway/session complexity that will pollute the writing module.

---

### S2: AI-Powered Chapter Ordering and Story Arc Visualization

**The trap:** The wizard produces a chapter outline, so naturally the next step is to build an interactive story arc visualization with draggable plot points, tension curves, character appearance tracking, and timeline views.

**Reality check:** The existing `ChapterSidebar.tsx` already has drag-and-drop reordering via `@dnd-kit`. A simple numbered list of chapters with "move up/down" is sufficient for the AI-planned outline. Visualization is a v3 feature.

**Guideline:** Wizard outputs chapter titles and summaries. They appear in `ChapterSidebar` exactly like manually-created chapters. No new visualization components.

---

### S3: Real-Time AI Streaming Into the Editor (Ghost Text / Copilot Style)

**The trap:** Instead of the chat-then-insert flow, building a Copilot-style inline completion where the AI streams text directly into the editor as the user writes. This was explicitly identified as an anti-feature in the v2.0 research ("AI autocomplete/ghost text -- destroys creative voice") and is listed in PROJECT.md's Out of Scope.

**Reality check:** The v2.1 design is deliberate: AI generates content in the chat pane, user reviews it, then explicitly inserts it. This preserves the user's creative agency. Ghost text bypasses this review step.

**Guideline:** NO ghost text. NO inline streaming. Content always flows: Chat -> Review -> Insert. This is a design principle, not a technical limitation.

---

### S4: Multi-Agent Chat Rooms for Collaborative Planning

**The trap:** The wizard uses one agent, but since there are multiple agents (writer, researcher, jess), building a "planning room" where all three discuss the book structure simultaneously.

**Reality check:** Multi-agent conversations are exponentially harder to manage (who speaks next, conflicting suggestions, UI for 3+ simultaneous streams). The wizard should use one agent (writer) with access to memory/research context. Individual agents can be consulted in separate sessions.

**Guideline:** One agent per conversation. The chat pane has an agent picker (similar to `FeedbackPopover`'s `AgentPicker`). Switching agents starts a new session. No simultaneous multi-agent output.

---

## Phase-Specific Risk Summary

| Phase | Highest Risks | Must-Address Pitfalls |
|-------|---------------|----------------------|
| Setup Wizard | C1, H1, H4, M2, I1, I3 | Structured data extraction from AI conversation, wizard state persistence, bulk creation handler, project schema extension |
| 3-Pane Layout | C2, C4, M1, M3, M5, H2 | Focus management between chat and editor, layout architecture rewrite, panel sizing, store architecture, session key namespacing |
| Conversational Writing Flow | C3, H3, M4, I2 | Content insertion format/corruption, markdown-to-TipTap conversion, context window management, chat gateway wrapper |

---

## Sources

### TipTap / ProseMirror
- [TipTap Focus Extension](https://tiptap.dev/docs/editor/extensions/functionality/focus)
- [TipTap BubbleMenu Extension](https://tiptap.dev/docs/editor/extensions/functionality/bubble-menu)
- [TipTap insertContent Command](https://tiptap.dev/docs/editor/api/commands/content/insert-content)
- [TipTap streamContent API](https://tiptap.dev/docs/content-ai/capabilities/generation/text-generation/stream)
- [TipTap Focus in Firefox #5980](https://github.com/ueberdosis/tiptap/issues/5980)
- [TipTap Selection When Unfocused #4963](https://github.com/ueberdosis/tiptap/discussions/4963)
- [TipTap Streaming Markdown #5563](https://github.com/ueberdosis/tiptap/discussions/5563)
- [TipTap Dropdown in BubbleMenu #4145](https://github.com/ueberdosis/tiptap/discussions/4145)

### Layout
- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels)
- [Unstable Multi-Panel Widths #323](https://github.com/bvaughn/react-resizable-panels/issues/323)
- [Dynamic Panel Adding #372](https://github.com/bvaughn/react-resizable-panels/issues/372)

### AI / Structured Output
- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [Agenta Guide to Structured Outputs](https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms)
- [Thoughtbot: Consistent Data from LLM with JSON Schema](https://thoughtbot.com/blog/get-consistent-data-from-your-llm-with-json-schema)

### Codebase (verified by direct reading)
- `src/components/writing/ChapterEditor.tsx` -- TipTap editor with BubbleMenu
- `src/components/writing/FeedbackPopover.tsx` -- Existing AI feedback with gateway integration
- `src/components/writing/ProjectEditor.tsx` -- Current 2-pane layout
- `src/components/writing/ProjectSelector.tsx` -- Current project creation flow
- `src/store/writingStore.ts` -- Writing state management
- `src/store/feedbackStore.ts` -- Feedback state management (good pattern)
- `src/lib/gateway.ts` -- WebSocket gateway client
- `electron/writing-project-service.ts` -- File-based project/chapter CRUD
- `electron/writing-memory-service.ts` -- Characters/timeline/facts storage
- `electron/writing-version-service.ts` -- Version snapshots
- `electron/paths.ts` -- Centralized path resolver
