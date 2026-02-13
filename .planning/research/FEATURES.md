# Feature Landscape: AI-Powered Writing UX Redesign

**Domain:** AI-collaborative book creation (setup wizard, 3-pane writing layout, conversational writing flow)
**Researched:** 2026-02-13
**Context:** New milestone for Froggo.app writing module. Existing features: project creation, chapter CRUD, TipTap editor, inline feedback (highlight > chat > alternatives), memory store (characters/timeline/facts), research library, versioning. NEW features: AI project setup wizard, 3-pane layout, conversational writing flow.
**Overall Confidence:** MEDIUM-HIGH (based on analysis of Sudowrite, Novelcrafter, Squibler, ChatGPT Canvas, Lex.page, Cursor IDE patterns, and Shape of AI UX patterns)

---

## Existing Features (Already Built)

Understanding what exists is critical for scoping what's new.

| Feature | Current State | Relevance to New Work |
|---------|--------------|----------------------|
| Project creation (title + type) | Simple form: title + memoir/novel toggle | **Will be replaced** by setup wizard |
| Chapter CRUD | Full: create, rename, delete, reorder (drag-drop) | **Keeps working** -- wizard generates initial chapters |
| TipTap rich text editor | Working: autosave, undo/redo, word count, toolbar | **Stays as-is** -- becomes the "workspace" pane |
| Inline feedback (BubbleMenu) | Highlight text > pick agent > get 3 alternatives > accept | **Coexists** with new chat pane |
| Memory store (characters, timeline, facts) | Context panel (right sidebar, 272px) | **Moves/integrates** into 3-pane layout |
| Research library (sources + fact-check) | Part of context panel | **Stays** -- might move into chat context |
| Chapter versioning + diff | Version panel (toggle, mutually exclusive with context) | **Stays** -- independent feature |
| Agent picker (Writer, Researcher, Jess) | Inline in feedback popover | **Extends** to chat pane agent selection |
| Gateway integration | `gateway.sendChatWithCallbacks` with streaming | **Reused** by chat pane |

**Key takeaway:** The existing system is highlight-centric (select text > get feedback). The new system adds a conversation-centric flow (chat with agent > content flows to editor). These are complementary, not replacements.

---

## Table Stakes

Features users expect from AI-powered writing tools with these capabilities. Missing any of these makes the feature feel broken.

### 1. Project Setup Wizard

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|-------------|-------|
| **Conversational planning flow** | Sudowrite's Story Engine and Novelcrafter's Plan interface both establish that authors expect guided, step-by-step book planning before writing. Not a blank form -- a back-and-forth dialogue. | HIGH | Gateway streaming, new store | The wizard IS the conversation. Agent asks questions ("What's your book about?"), user answers, agent proposes structure. This is the core UX innovation. |
| **Brain dump / free-form input** | Sudowrite starts with a "Brain dump" field: write everything about the novel. This is the most natural entry point. Users have scattered ideas, not structured outlines. | LOW | Text input | Single large textarea or chat message. Agent synthesizes structure from raw ideas. |
| **Genre/type selection** | Every book planning tool asks for genre. It shapes AI tone, structure suggestions, and pacing advice. Current system only has memoir/novel. | LOW | Existing type field | Expand from 2 types to: memoir, novel, short stories, nonfiction, poetry, screenplay. Or let the agent infer from conversation. |
| **Character generation/definition** | Sudowrite and Squibler both generate characters from story context. Novelcrafter's Codex is character-first. Authors expect to define or generate key characters during planning. | MEDIUM | Existing memory store (characters) | Wizard outputs characters directly into the memory store. |
| **Chapter outline generation** | Both Sudowrite and Novelcrafter generate chapter outlines from story concepts. This is the primary deliverable of the planning phase. | MEDIUM | Existing chapter CRUD | Agent proposes chapters, user approves/edits, chapters get created. |
| **Story arc / plot structure** | Sudowrite's Story Engine generates plot structure. Novelcrafter offers preset structures (3-act, hero's journey, etc.). Authors expect structural guidance. | MEDIUM | New data model (story arc metadata) | Store arc metadata alongside project. Could be as simple as a markdown document or structured JSON. |
| **Review and confirm before creating** | ChatGPT Canvas shows edits in real-time with accept/reject. Shape of AI's inline action pattern requires verification before committing. Users MUST see and approve the plan before it becomes project structure. | MEDIUM | UI for plan review | Show proposed outline, characters, arc summary. User clicks "Create Project" to materialize. |
| **Ability to skip wizard** | Some users know exactly what they want. Forcing a 10-step wizard is hostile. Quick-create should still exist. | LOW | Existing create flow | Keep the simple "title + type" form as an alternative path. |

### 2. Three-Pane Writing Layout

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|-------------|-------|
| **Persistent chapter navigation (left pane)** | Novelcrafter, Sudowrite, Squibler all have left-side chapter navigation. Scrivener established this pattern decades ago. | LOW | Existing ChapterSidebar | Already built. Just needs to be the left pane in the 3-pane layout. |
| **Central content workspace (middle pane)** | ChatGPT Canvas puts the document on the right, chat on the left. Cursor IDE puts editor in center, chat in sidebar. The content workspace is always the widest pane. | LOW | Existing ChapterEditor | Already built. Becomes the center pane. |
| **AI chat pane (right or left)** | ChatGPT Canvas: chat left, document right. Cursor: editor center, chat right. Novelcrafter: chat as separate mode. Squibler: AI assistant on right side. The industry standard is emerging as **chat on one side, editor on the other**, but position varies. | HIGH | New component, gateway integration | **This is the biggest new feature.** A persistent chat interface for conversational writing. |
| **Resizable panes** | Users expect to drag borders between panes. Some want more editor space, some want more chat space. Novelcrafter and Cursor both support this. | MEDIUM | Split-pane library or CSS | Use a splitter library or CSS resize handles. |
| **Collapsible panes** | Users should be able to hide the chat or chapter list for focused writing. Novelcrafter has "Focus Mode." Sudowrite has it too. | LOW | Toggle state | Already have toggle buttons for context/version panels. Extend pattern. |
| **Pane state persistence** | If user collapses chat pane, it should stay collapsed on next visit. Pane widths should persist. | LOW | localStorage | Store layout preferences per-project or globally. |

### 3. Conversational Writing Flow

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|-------------|-------|
| **Streaming AI responses** | Every modern AI chat streams tokens. Users expect to see text appearing in real-time, not a loading spinner followed by a wall of text. | LOW | Existing gateway streaming | Already have `sendChatWithCallbacks` with `onDelta`. Reuse directly. |
| **Chat history persistence** | Users expect to scroll up and see previous messages. ChatGPT, Cursor, and every chat interface preserves history. Squibler's "Ask Me Anything" now remembers context within the chat. | MEDIUM | New store (chat history), persistence | Store messages per-project-per-chapter (or per-project globally). Critical for continuity across sessions. |
| **"Send to editor" / "Insert" action** | This is THE defining UX pattern for conversational writing. Chat generates content, user clicks a button to send it to the editor. CKEditor's AI features support "seamless escalation" between chat and editor. Writesonic has "Send to Chatsonic." Type.ai has "Apply edits." | HIGH | Editor insertion API, content parsing | Need to parse chat responses, identify insertable content blocks, and provide one-click insertion into TipTap at cursor position or end of chapter. |
| **Agent selection in chat** | Users should pick which agent they're talking to. Already have Writer/Researcher/Jess. Extend to chat pane. | LOW | Existing AgentPicker | Reuse component. |
| **Context-aware prompting** | The AI should know what chapter is open, what the project is about, what characters exist. Novelcrafter's Codex auto-injects relevant context. Cursor uses @ mentions for context addition. | MEDIUM | Existing memory store, chapter context | Already building context in FeedbackPopover's `buildPrompt`. Extract and reuse for chat pane. |
| **Message actions (copy, retry, edit)** | Standard chat UX: copy message, regenerate response, edit and resend. ChatGPT has all of these. | MEDIUM | UI components | Copy is trivial. Retry resends last user message. Edit replaces last message and resends. |
| **Multi-turn conversation** | The chat should maintain context across multiple messages within a session. Not just one-shot prompts. Squibler upgraded to "fully interactive AI chat" with ongoing conversation. | MEDIUM | Session management via gateway | Gateway sessions already support multi-turn. Key is using consistent session keys per project/chapter. |

---

## Differentiators

Features that set Froggo apart. Not expected, but highly valued. These are where the competitive advantage lives.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|-------------|-------|
| **Agent personality in wizard** | Most tools use a generic AI. Froggo has Jess (emotional guidance), Writer (narrative craft), Researcher (accuracy). The setup wizard could use Jess for memoir (emotional arc planning) and Writer for novels (plot structure). No competitor does agent-specialized planning. | MEDIUM | Agent-specific wizard prompts | Jess asks "What emotional journey do you want the reader to go through?" Writer asks "What's the central conflict?" This is deeply differentiated. |
| **"Creative director" mode** | Kevin described wanting to "work with an agent to plan the book." Not just fill in forms -- have a real creative conversation. Like working with a human editor or writing coach. Sudowrite's wizard is form-based. Novelcrafter's planning is structural. Neither is conversational. | HIGH | High-quality prompting, wizard UX | The wizard IS the chat. Agent guides, asks questions, proposes, iterates. User approves. Then project materializes. This is the key differentiator. |
| **Drag content from chat to editor** | Beyond "insert" button -- actually drag a paragraph from chat into a specific position in the editor. No competitor does this. CKEditor supports drag-drop natively. | HIGH | TipTap drag-drop API, DnD implementation | Technically challenging but very powerful UX. Would need careful implementation of HTML5 drag-and-drop between panes. |
| **Chat-driven chapter writing** | Instead of writing in the editor and asking AI for help, write BY CHATTING. Tell the agent "Write the opening paragraph of chapter 3, it should establish the setting of the family kitchen in 1987." Agent writes, user reviews in chat, clicks insert. Sudowrite has a version of this (Auto Write mode) but it's not conversational. | HIGH | Chat + editor integration, smart insertion | This inverts the existing model. Currently: write > highlight > get feedback. New: chat > generate > insert into editor. Both should coexist. |
| **Outline-to-beats-to-prose pipeline** | Novelcrafter has a "Scene Beats" system: outline beats, then expand to prose. This is powerful but Novelcrafter requires manual beat entry. Froggo could auto-generate beats from the wizard's chapter outline, then expand each beat conversationally. | HIGH | Beat data model, wizard > beats > prose flow | Three-stage pipeline: wizard generates outline > outline becomes beats per chapter > user expands beats to prose via chat. |
| **Cross-chapter context in chat** | When writing chapter 5, the AI should know what happened in chapters 1-4. Novelcrafter's Codex does this. But Froggo could do it conversationally: "What happened with the character Sarah in chapter 2?" and the AI answers from project context. | MEDIUM | Chapter content indexing, context injection | Use chapter summaries (auto-generated or from wizard) as context. Don't inject full chapter text -- too expensive. |
| **Wizard output feeds memory store** | Characters defined in wizard auto-populate the Characters tab. Timeline events from the arc populate the Timeline tab. No manual re-entry needed. | MEDIUM | Wizard > memory store pipeline | Parse wizard conversation outputs into structured data. Requires reliable extraction from agent responses. |
| **Split-view: outline + editor** | Show the chapter outline/beats alongside the editor, not just in the chat. Writer can see "what should happen" while writing "what does happen." Novelcrafter does this with scene summaries visible in the write interface. | MEDIUM | Layout variant, beats display component | Alternative to chat pane: show outline/beats on one side, editor on the other. Could be a toggle mode. |

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain that waste effort or harm UX.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **"Generate entire book" button** | Sudowrite and BookWizard-type tools offer one-click book generation. Results are generic, soulless, and useless for serious writers. Kevin wants to WRITE with AI assistance, not have AI write FOR him. This also creates massive token costs for garbage output. | Guide the writing process conversationally. Generate paragraphs and scenes, not entire books. Keep the human in the loop at every step. |
| **Mandatory wizard (no skip option)** | Forcing every project through a multi-step wizard is hostile to users who know what they want. Some projects need quick creation. | Offer both paths: wizard for new ideas, quick-create for known structure. |
| **Wizard as a form, not a conversation** | Sudowrite's Story Engine is essentially a long form (braindump, genre, characters, outline fields). This is better than nothing but misses the "creative director" insight. | Make the wizard a conversation. Agent asks, user answers, agent proposes. Back-and-forth until the plan is right. |
| **Auto-replacing editor content** | Some AI tools auto-inject generated text into the document without user confirmation. This violates the Shape of AI "inline action" pattern: AI results should be suggestions, not overwrites. CKEditor and Type.ai both require explicit acceptance. | Always preview AI content in chat first. User explicitly clicks "Insert" or "Apply" to move content to editor. Never auto-replace. |
| **Separate planning and writing apps** | Novelcrafter has distinct Plan, Write, Chat, and Review modes. Switching between modes loses context. The 3-pane layout keeps everything visible simultaneously. | Single view with all three panes. Context is always available. No mode-switching required for the core workflow. |
| **Complex plot structure tools** | Save-the-cat beat sheets, hero's journey templates, Snowflake method generators. These appeal to a niche of plotters but most writers find them constraining. Novelcrafter offers preset structures but they're optional. | Let the agent suggest structure conversationally based on the story, not force a template. If user wants 3-act structure, they can ask for it. |
| **Token-heavy background indexing** | Auto-summarizing every chapter, running continuous embedding updates, real-time similarity search. These are expensive and provide marginal benefit for a single-user app. | Summarize chapters on-demand or at save time. Use existing memory store (manually curated characters/timeline/facts) as primary context. Only auto-index when user explicitly requests it. |
| **Inline AI writing (ghost text / copilot)** | Lex.page does "+++ to autocomplete." GitHub Copilot does ghost text. This works for code but interrupts creative writing flow. Writers need to think, not just accept completions. Sudowrite found this was less popular than their Write mode which generates on explicit request. | Keep AI generation explicit: user asks in chat or requests via feedback popover. No ghost text or unsolicited completions in the editor. |
| **Multi-user collaboration** | Google Docs-style real-time collaboration. Kevin is a single user. Adding collaboration infrastructure (CRDTs, conflict resolution, presence) is massive complexity for zero value. | Single-user only. No collaboration features. If needed later, it's a separate milestone. |
| **Custom AI model selection** | Novelcrafter lets users bring their own API key and pick models. Squibler uses its own models. This is irrelevant for Froggo -- it already has a model fallback chain via the gateway. | Use existing gateway and model routing. No model picker needed. |

---

## Feature Dependencies

```
PROJECT SETUP WIZARD
  |
  +-- Brain dump / free-form input (LOW)
  +-- Genre/type selection (LOW)
  +-- Conversational planning flow (HIGH)
  |     |
  |     +-- Agent selection (existing AgentPicker)
  |     +-- Gateway streaming (existing)
  |     +-- Chat history store (NEW - shared with writing chat)
  |
  +-- Character generation (MEDIUM)
  |     |
  |     +-- Memory store integration (existing)
  |
  +-- Chapter outline generation (MEDIUM)
  |     |
  |     +-- Chapter CRUD (existing)
  |
  +-- Story arc generation (MEDIUM)
  |     |
  |     +-- New data model for arc metadata
  |
  +-- Review & confirm (MEDIUM)
        |
        +-- Plan preview component (NEW)
        +-- "Create Project" materializer (NEW)

THREE-PANE LAYOUT
  |
  +-- Chapter sidebar - left pane (existing ChapterSidebar)
  +-- Editor workspace - center pane (existing ChapterEditor)
  +-- Chat pane - right pane (NEW)
  |     |
  |     +-- Chat message list (NEW)
  |     +-- Chat input with agent picker (NEW)
  |     +-- Streaming display (reuse gateway pattern)
  |     +-- Chat history store (shared with wizard)
  |
  +-- Resizable panes (MEDIUM)
  +-- Collapsible panes (LOW)
  +-- Pane state persistence (LOW)

CONVERSATIONAL WRITING FLOW
  |
  +-- Chat pane (from 3-pane layout above)
  +-- "Send to editor" action (HIGH)
  |     |
  |     +-- Content block parsing (identify insertable content)
  |     +-- TipTap insertion API
  |     +-- Cursor position awareness
  |
  +-- Context-aware prompting (MEDIUM)
  |     |
  |     +-- Memory store context (existing buildMemoryContext)
  |     +-- Chapter content context (existing pattern)
  |     +-- Project outline context (from wizard data)
  |
  +-- Multi-turn conversation (MEDIUM)
        |
        +-- Session key management
        +-- Gateway session persistence
```

**Critical path:** Chat history store > Chat pane UI > Send to editor integration. Everything else can be layered on.

---

## MVP Recommendation

For MVP, prioritize features that deliver the core user story: "I create a project by planning with an AI agent, then write using a 3-pane layout where chat generates content for the editor."

### Phase 1: Chat Pane + 3-Pane Layout (build the foundation)

Must build:
1. **Chat pane component** -- persistent chat UI with agent picker, message list, input field, streaming display
2. **Chat history store** -- messages per project, persisted to disk
3. **3-pane layout** -- chapters | editor | chat, with collapsible chat pane
4. **"Insert into editor" button** -- one-click to send chat content to TipTap at cursor

Why first: This is the infrastructure that both the wizard and writing flow depend on. Build the chat pane once, use it everywhere. The writing flow is immediately useful even without the wizard -- users can start chatting with agents right away.

### Phase 2: Project Setup Wizard (the creative director experience)

Must build:
1. **Wizard conversation flow** -- agent-guided planning conversation
2. **Plan extraction and preview** -- parse agent's proposed outline, characters, arc into structured data
3. **Plan review and confirm UI** -- show proposed plan, let user edit, confirm to create project
4. **Project materialization** -- create chapters, populate memory store from wizard output

Why second: Depends on the chat infrastructure from Phase 1. The wizard IS a chat conversation with a specialized prompt. Building chat first means the wizard is mostly a new route/prompt, not new infrastructure.

### Defer to post-MVP:

- **Drag content from chat to editor** -- complex DnD implementation, "Insert" button is sufficient for MVP
- **Outline-to-beats-to-prose pipeline** -- powerful but complex data model, can add later
- **Resizable panes** -- collapsible is enough for MVP, resize is polish
- **Cross-chapter context in chat** -- start with current chapter + memory store context, add chapter summaries later
- **Story arc visualization** -- store arc as markdown initially, visualize later
- **Split-view outline + editor** -- the chat pane serves this purpose initially

---

## UX Patterns from Competitors (Synthesized)

### Pattern: ChatGPT Canvas (Two-Pane Chat + Document)

**How it works:** Screen splits into chat (left) and document (right). User converses on one side, AI makes changes to document in real-time. Changes appear with diff highlighting. User can accept/reject.

**What to steal:**
- Bidirectional content flow (chat to doc AND doc to chat)
- Real-time change highlighting
- Version history with diff
- Shortcut actions on document content ("suggest edits," "adjust length")

**What to avoid:**
- Canvas is designed for short documents, not 100-chapter books
- No chapter navigation -- everything is one document
- Mode-switching (regular chat vs canvas mode)

### Pattern: Cursor IDE (Chat Sidebar + Editor)

**How it works:** Editor in center, chat panel on right. Chat generates code, user reviews, applies to files. @ mentions for context (files, docs). Multi-file awareness.

**What to steal:**
- @ mentions for context ("@chapter-3" to reference chapter content)
- Chat-generated content with explicit "Apply" action
- Context-awareness (knows what file/chapter is open)
- Multi-turn conversation in sidebar

**What to avoid:**
- Code-centric patterns that don't translate (diffs, linting)
- Tab-heavy interface (writing needs focus)

### Pattern: Novelcrafter (Plan + Write + Chat + Review modes)

**How it works:** Four separate modes switched via top nav. Plan mode: outline with acts/chapters/scenes. Write mode: editor with scene beats. Chat mode: conversational AI. Review mode: editing passes.

**What to steal:**
- Codex (story wiki) as context for all AI interactions
- Scene beats system (outline beats, then expand to prose)
- Matrix view for tracking outlines, POV, subplots
- Scene-level metadata (POV, word count, summary)

**What to avoid:**
- Mode-switching forces context loss
- Chat is isolated from the editor (separate mode)
- Plan is structural, not conversational

### Pattern: Sudowrite Story Engine (Wizard + Write modes)

**How it works:** Story Engine is a multi-step form: braindump > genre > characters > outline > write. Each step can be auto-generated or manually filled. After setup, writing happens in a separate editor with AI Write modes (Guided/Auto).

**What to steal:**
- Brain dump as entry point (most natural for writers)
- Step-by-step planning that builds on previous steps
- "Generate" button at each step (AI proposes, user confirms)
- Story Bible as persistent context

**What to avoid:**
- Form-based wizard (not conversational)
- Steps are rigid and sequential
- Writing mode is separate from planning

### Pattern: Squibler (Chat Sidebar + Editor)

**How it works:** Chapters on left, editor in center, AI assistant ("Smart Writer") on right. Recently upgraded to fully interactive chat with context memory. "Ask Squibler" tooltip for inline edits.

**What to steal:**
- Right-side AI chat with ongoing conversation
- Context memory within chat sessions
- Inline "Ask Squibler" for quick in-place edits (similar to existing BubbleMenu feedback)

**What to avoid:**
- Generic AI personality (no specialized agents)
- Limited planning/wizard features

---

## Froggo-Specific Integration Notes

### How Wizard Outputs Map to Existing Data Models

| Wizard Output | Existing Data Model | Integration |
|--------------|-------------------|-------------|
| Characters | `memoryStore.characters` | Direct write via existing bridge `writing.memory.addCharacter` |
| Timeline events | `memoryStore.timeline` | Direct write via existing bridge `writing.memory.addTimeline` |
| Chapter outline | `writingStore.createChapter` | Loop: create chapters in order from outline |
| Story arc | **NEW** -- no existing model | Store as project metadata (markdown or JSON field on project) |
| Synopsis/braindump | **NEW** -- no existing model | Store as project metadata |
| Genre/type | `writingStore.createProject(title, type)` | Extend type enum or add genre field |

### How Chat Pane Reuses Existing Infrastructure

| Existing | Reuse In Chat Pane |
|----------|-------------------|
| `gateway.sendChatWithCallbacks` | Core streaming for chat messages |
| `buildMemoryContext` from FeedbackPopover | Context injection for chat prompts |
| `AgentPicker` component | Agent selection in chat header |
| Session key pattern (`agent:${agent}:writing:${projectId}`) | Multi-turn chat sessions |
| `window.clawdbot.writing` bridge | Persist chat history via Electron IPC |

### Layout Transition Plan

**Current layout:**
```
[ ChapterSidebar | ChapterEditor [ + ContextPanel OR VersionPanel ] ]
```

**New layout:**
```
[ ChapterSidebar | ChapterEditor | ChatPane ]
```

**Key decisions:**
- ContextPanel (characters/timeline/facts/sources) currently occupies the right side. Chat pane will also be on the right side. Options:
  1. **Tabs within right pane** -- chat tab + context tabs (like Novelcrafter's top nav). Recommended: keeps layout simple.
  2. **Move context into chat** -- chat can access and display memory store inline. More integrated but more complex.
  3. **Context as collapsible sub-panel** -- below or above chat. Gets crowded.
- VersionPanel should become a modal or overlay, not a pane replacement.
- BubbleMenu feedback (existing inline system) should remain functional. It's a different interaction pattern (selection-driven vs conversation-driven) and both have value.

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Table stakes for wizard | HIGH | Sudowrite Story Engine, Novelcrafter Plan, and Squibler all confirm these features. Multiple sources agree. |
| Table stakes for 3-pane layout | HIGH | ChatGPT Canvas, Cursor, Squibler, Novelcrafter all use this pattern. Well-established. |
| Table stakes for conversational flow | HIGH | "Send to editor" pattern confirmed across CKEditor, Type.ai, Writesonic, ChatGPT Canvas. |
| Differentiators | MEDIUM | Agent-specialized planning is a novel approach -- no competitor does this. Can't verify market value, but the UX concept is sound based on how the agents already work in the feedback popover. |
| Anti-features | HIGH | "Generate entire book" failure mode is well-documented. Auto-replacing content is a known anti-pattern per Shape of AI. |
| Integration with existing code | HIGH | Reviewed actual source code. Data models, gateway integration, and component structure are clear. |

---

## Sources

### AI Writing Tools (Direct Analysis)
- [Sudowrite Story Engine](https://sudowrite.com/) -- Wizard-style book planning
- [Sudowrite Review 2026 (NerdyNav)](https://nerdynav.com/sudowrite-review/) -- UI layout, Guided/Auto Write modes
- [Sudowrite Story Engine Tutorial (Digital Trends)](https://www.digitaltrends.com/computing/how-to-use-sudowrite-story-engine-write-novel/) -- Step-by-step wizard process
- [Novelcrafter App Layout](https://www.novelcrafter.com/help/docs/app/app-layout) -- Four-mode interface structure
- [Novelcrafter Write Interface](https://www.novelcrafter.com/help/docs/write/the-write-interface) -- Editor layout, scene beats, AI integration
- [Novelcrafter Plan Interface](https://www.novelcrafter.com/help/docs/plan/the-plan-interface) -- Outline views, story structure
- [Squibler Review (AllAboutAI)](https://www.allaboutai.com/ai-reviews/squibler-io/) -- Chat sidebar, Smart Writer
- [Squibler Review (Reedsy)](https://reedsy.com/studio/resources/squibler-review) -- Interface layout, AI chat upgrade
- [Type.ai](https://type.ai/) -- "Apply edits" pattern from chat to document
- [Lex.page](https://lex.page/) -- Inline suggestions, Ask Lex sidebar, AI text visibility

### UX Patterns (Design Research)
- [ChatGPT Canvas (OpenAI)](https://openai.com/index/introducing-canvas/) -- Two-pane chat + document pattern
- [ChatGPT Canvas Guide (ai-basics.com)](https://ai-basics.com/how-to-use-chatgpt-canvas/) -- Inline editing, version history, shortcut actions
- [Shape of AI -- Inline Action Pattern](https://www.shapeof.ai/patterns/inline-action) -- Accept/reject/refine AI suggestions
- [Shape of AI](https://www.shapeof.ai) -- UX patterns for AI design
- [Where Should AI Sit in Your UI (UX Collective)](https://uxdesign.cc/where-should-ai-sit-in-your-ui-1710a258390e) -- Sidebar chat placement patterns
- [20+ GenAI UX Patterns (UX Collective)](https://uxdesign.cc/20-genai-ux-patterns-examples-and-implementation-tactics-5b1868b7d4a1) -- Content generation, memory patterns
- [CKEditor AI Features](https://ckeditor.com/ai-assistant/) -- Chat-to-editor escalation pattern
- [AI UX Anti-Patterns (Bootcamp)](https://medium.com/design-bootcamp/ai-ux-anti-patterns-common-design-traps-to-avoid-fa487c8f24af) -- Common design traps

### Ecosystem Surveys
- [Best AI Writing Tools for Authors 2026 (Kindlepreneur)](https://kindlepreneur.com/best-ai-writing-tools/) -- Market overview
- [Best AI for Writing a Book 2026 (Monday.com)](https://monday.com/blog/ai-agents/best-ai-for-writing-a-book/) -- Hybrid workflow recommendation
- [Best AI for Writing Fiction 2026 (MyLifeNote)](https://blog.mylifenote.ai/the-11-best-ai-tools-for-writing-fiction-in-2026/) -- Competitive landscape
