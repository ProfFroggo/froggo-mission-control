# Requirements: Writing System

**Defined:** 2026-02-12 (v2.0), updated 2026-02-13 (v2.1)
**Core Value:** Kevin can create a new book project by conversing with an AI agent that plans the story arc, chapter outline, themes, and characters -- then write in a 3-pane layout where AI chat dialogue drives content into the workspace.

## v2 Requirements (Complete)

All v2.0 requirements shipped 2026-02-13. 44/44 complete.

<details>
<summary>v2.0 requirements (44 complete)</summary>

### Foundation

- [x] **FOUND-01**: User can create a new writing project with title and type (memoir/novel)
- [x] **FOUND-02**: User can see a list of all writing projects with stats (word count, chapter count)
- [x] **FOUND-03**: User can open a writing project and see its chapter list
- [x] **FOUND-04**: User can create, rename, and delete chapters within a project
- [x] **FOUND-05**: User can edit chapter content in a rich text editor with markdown support
- [x] **FOUND-06**: Chapter content auto-saves with debounce (no manual save button needed)
- [x] **FOUND-07**: User can navigate between chapters via outline sidebar
- [x] **FOUND-08**: Writing workspace accessible from main dashboard sidebar navigation
- [x] **FOUND-09**: User can see word count per chapter and total project word count
- [x] **FOUND-10**: Writing projects stored as file-based structure (markdown chapters, JSON metadata)

### Editor

- [x] **EDIT-01**: Rich text editor supports headings, bold, italic, lists, blockquotes, links
- [x] **EDIT-02**: Editor loads from and saves to markdown files (bidirectional)
- [x] **EDIT-03**: Editor handles 10k+ word chapters without performance degradation
- [x] **EDIT-04**: User can undo/redo changes with standard keyboard shortcuts
- [x] **EDIT-05**: Editor toolbar shows formatting options (headings, bold, italic, lists)

### Inline Feedback

- [x] **FEED-01**: User can highlight text in the editor and see a feedback popover
- [x] **FEED-02**: User can type feedback/instructions in the popover and send to an AI agent
- [x] **FEED-03**: AI agent responds with 2-3 alternative versions of the highlighted text
- [x] **FEED-04**: User can accept an alternative (replaces highlighted text) or dismiss
- [x] **FEED-05**: User can select which agent to send feedback to (Writer, Researcher, Jess)
- [x] **FEED-06**: AI response streams in real-time (not blank screen then full response)
- [x] **FEED-07**: Feedback interactions are logged per chapter (JSONL append-only)
- [x] **FEED-08**: AI context includes current chapter, outline, and memory store data

### Memory Store

- [x] **MEM-01**: User can create/edit/delete character profiles (name, relationship, description, traits)
- [x] **MEM-02**: User can create/edit/delete timeline events (date, description, chapter refs)
- [x] **MEM-03**: User can create/edit/delete verified facts (claim, source, status)
- [x] **MEM-04**: Memory store displays in context panel alongside editor
- [x] **MEM-05**: Memory store data is automatically injected into AI agent context for feedback
- [x] **MEM-06**: Memory store persists as JSON files per project

### Research Library

- [x] **RES-01**: User can add research sources (title, author, type, URL, notes)
- [x] **RES-02**: User can link sources to specific facts in the memory store
- [x] **RES-03**: User can mark facts as verified/disputed/needs-source
- [x] **RES-04**: Research data stored in per-project SQLite database
- [x] **RES-05**: Researcher agent can be asked to fact-check highlighted claims

### Outline & Versions

- [x] **OUT-01**: User can see project outline with collapsible chapter tree
- [x] **OUT-02**: User can reorder chapters via drag-and-drop
- [x] **OUT-03**: User can save version snapshots of chapters before major edits
- [x] **OUT-04**: User can view and restore previous chapter versions
- [x] **OUT-05**: Version comparison shows differences between versions

### Agent Integration

- [x] **AGENT-01**: Writer agent provides style, pacing, and narrative feedback
- [x] **AGENT-02**: Researcher agent provides fact-checking and source verification
- [x] **AGENT-03**: Jess agent provides emotional guidance and memoir-specific support
- [x] **AGENT-04**: Each agent has project-scoped sessions (context persists within project)
- [x] **AGENT-05**: Agent communication uses existing OpenClaw Gateway WebSocket

</details>

## v2.1 Requirements

Requirements for Writing UX Redesign milestone. Scoped from research (2026-02-13).

### Chat Infrastructure

- [ ] **CHAT-01**: User can chat with AI agents (Writer, Researcher, Jess) in a persistent chat pane alongside the editor
- [ ] **CHAT-02**: AI responses stream in real-time (token by token) in the chat pane
- [ ] **CHAT-03**: User can select which agent to chat with via agent picker in chat header
- [ ] **CHAT-04**: Chat history persists across sessions (per-project, stored to disk)
- [ ] **CHAT-05**: AI context includes current chapter content, project outline, and memory store data
- [ ] **CHAT-06**: User can insert AI-generated content from chat into the editor with one click ("Send to editor")
- [ ] **CHAT-07**: Content insertion validates against TipTap schema via markdown conversion and inserts at cursor or end of chapter
- [ ] **CHAT-08**: User can copy and retry chat messages
- [ ] **CHAT-09**: Chat maintains multi-turn conversation context via gateway sessions
- [ ] **CHAT-10**: Chat pane uses separate gateway sessions from inline feedback (no context contamination)

### Three-Pane Layout

- [ ] **LAYOUT-01**: Writing workspace uses 3-pane layout: chapters sidebar | AI chat pane | content workspace
- [ ] **LAYOUT-02**: Panes are resizable via drag handles (react-resizable-panels)
- [ ] **LAYOUT-03**: Chat pane and chapters sidebar are individually collapsible
- [ ] **LAYOUT-04**: Pane sizes and collapse state persist across sessions (localStorage)
- [ ] **LAYOUT-05**: Layout works at window widths from 1024px to 1920px+

### Setup Wizard

- [ ] **WIZARD-01**: User can start a new book project through a conversational AI wizard that guides planning (story arc, chapters, themes, characters)
- [ ] **WIZARD-02**: User can provide a brain dump / free-form description of their book idea as the starting point
- [ ] **WIZARD-03**: Wizard generates character profiles from the planning conversation and populates memory store
- [ ] **WIZARD-04**: Wizard generates a chapter outline from the planning conversation
- [ ] **WIZARD-05**: Wizard generates story arc / plot structure summary
- [ ] **WIZARD-06**: User can review and edit the proposed plan (characters, chapters, arc) before creating the project
- [ ] **WIZARD-07**: User can skip the wizard and use quick-create (existing title + type form remains)
- [ ] **WIZARD-08**: Wizard state persists across navigation and app restarts (resume mid-wizard)
- [ ] **WIZARD-09**: Wizard uses agent-specialized prompts (Jess for memoir emotional arc, Writer for novel plot structure)
- [ ] **WIZARD-10**: On completion, wizard atomically creates project with chapters, characters, and timeline populated from conversation
- [ ] **WIZARD-11**: User can select or let AI infer the genre/type beyond memoir/novel

## v3 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Advanced Features

- **ADV-01**: PDF/ePub export for publication-ready manuscripts
- **ADV-02**: Vector search for semantic retrieval across chapters
- **ADV-03**: Story arc visualization across chapters
- **ADV-04**: Auto-detection of characters/events from chapter text
- **ADV-05**: Timeline visualization (chronological + narrative order)
- **ADV-06**: Character relationship graphs
- **ADV-07**: Writing session statistics and productivity tracking
- **ADV-08**: Focus/distraction-free writing mode
- **ADV-09**: Sensitivity/boundary annotations for memoir content
- **ADV-10**: Style guide enforcement via AI
- **ADV-11**: Drag content from chat to editor (DnD between panes)
- **ADV-12**: Outline-to-beats-to-prose pipeline (beat expansion via chat)
- **ADV-13**: Cross-chapter context in chat (chapter summaries as context)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time multi-user collaboration | Single-user workflow, CRDT complexity unjustified |
| AI autocomplete/ghost text | Research confirms it destroys creative voice -- anti-feature |
| AI-generated first drafts | User writes, AI assists -- never the other way around |
| "Generate entire book" button | Results are generic and soulless; keep human in the loop |
| Auto-replacing editor content | AI results are suggestions, not overwrites (Shape of AI pattern) |
| Multi-agent chat rooms | One agent at a time; agent switching is sufficient |
| Custom AI model selection | Gateway model routing handles this already |
| Complex plot structure templates | Let agent suggest structure conversationally, not force templates |
| electron/main.ts monolith breakup | Separate effort, not writing-related |
| preload namespace rename | Cosmetic, deferred |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 through FOUND-10 | Phase 5 | Complete |
| EDIT-01 through EDIT-05 | Phase 5 | Complete |
| FEED-01 through FEED-08 | Phase 6 | Complete |
| MEM-01 through MEM-06 | Phase 7 | Complete |
| RES-01 through RES-05 | Phase 8 | Complete |
| OUT-01 through OUT-05 | Phase 9 | Complete |
| AGENT-01 | Phase 6 | Complete |
| AGENT-02 | Phase 8 | Complete |
| AGENT-03 | Phase 10 | Complete |
| AGENT-04 | Phase 6 | Complete |
| AGENT-05 | Phase 6 | Complete |
| CHAT-01 | Phase 11 | Pending |
| CHAT-02 | Phase 11 | Pending |
| CHAT-03 | Phase 11 | Pending |
| CHAT-04 | Phase 11 | Pending |
| CHAT-05 | Phase 11 | Pending |
| CHAT-06 | Phase 11 | Pending |
| CHAT-07 | Phase 11 | Pending |
| CHAT-08 | Phase 11 | Pending |
| CHAT-09 | Phase 11 | Pending |
| CHAT-10 | Phase 11 | Pending |
| LAYOUT-01 | Phase 11 | Pending |
| LAYOUT-02 | Phase 11 | Pending |
| LAYOUT-03 | Phase 11 | Pending |
| LAYOUT-04 | Phase 11 | Pending |
| LAYOUT-05 | Phase 11 | Pending |
| WIZARD-01 | Phase 12 | Pending |
| WIZARD-02 | Phase 12 | Pending |
| WIZARD-03 | Phase 12 | Pending |
| WIZARD-04 | Phase 12 | Pending |
| WIZARD-05 | Phase 12 | Pending |
| WIZARD-06 | Phase 12 | Pending |
| WIZARD-07 | Phase 12 | Pending |
| WIZARD-08 | Phase 12 | Pending |
| WIZARD-09 | Phase 12 | Pending |
| WIZARD-10 | Phase 12 | Pending |
| WIZARD-11 | Phase 12 | Pending |

**Coverage:**
- v2.0 requirements: 44/44 complete
- v2.1 requirements: 26/26 mapped (15 Phase 11 + 11 Phase 12)
- Unmapped: 0

---
*Requirements defined: 2026-02-12*
*Last updated: 2026-02-13 -- v2.1 traceability added (26 requirements mapped to Phases 11-12)*
